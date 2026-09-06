/**
 * The embed loader: the host-side half, bundled to `/showcase/embed.js`.
 *
 * Gallery rather than kit, on the section's own test. Which runner a page gets,
 * how it is addressed and how it behaves as a guest are **imposed** — every
 * piece is embedded the same way and none of them gets to move it. The kit is
 * what a piece is *offered* and may decline; nothing here is declinable, and
 * nothing here draws a control.
 *
 * It knows nothing about any piece. It cannot name a setting, a preset, or
 * Starry Night. It reads an artefact, loads the runner that artefact names, and
 * behaves itself on a page it does not own.
 *
 * ```html
 * <div data-showcase="/showcase/artefacts/home.json"></div>
 * <script type="module" src="/showcase/embed.js"></script>
 * ```
 *
 * The host styles that element however it likes — fixed and full-bleed for a
 * page background, a plain block for one section. The embed only fills it.
 *
 * **Unversioned on purpose.** A runner is content-addressed and never changes
 * again; this file is the one mutable part, and therefore the only thing that
 * can be fixed for every embed at once when a browser breaks something. It is
 * kept small because everything in it is a liability shared by every page that
 * has ever pasted the tag.
 */

type Artefact = {
  id: string
  /** Where the frozen runner lives, relative to the artefact. */
  runner: string
  /**
   * Named settings blobs. A host picks by **name** and never sees a setting, so
   * a light and a dark scene cost the host no knowledge of what either means.
   */
  variants: Record<string, unknown>
  /** Used when the host asks for a variant this artefact does not have. */
  defaultVariant: string
}

type Mounted = {
  setSettings: (settings: unknown) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

type Instance = {
  container: HTMLElement
  artefact: Artefact
  mounted: Mounted
  variant: string
  /** Off-screen and hidden-tab are separate reasons; either one holds it. */
  onScreen: boolean
  tabVisible: boolean
}

const instances: Instance[] = []

const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false

/** A wanted name is only a hint: an artefact without it keeps its default. */
function pickVariant(artefact: Artefact, wanted?: string): string {
  if (wanted && wanted in artefact.variants) return wanted
  const guess = prefersDark() ? "dark" : "light"
  if (guess in artefact.variants) return guess
  return artefact.defaultVariant
}

/** Surfaced on the container, so the state is legible without a console. */
function report(instance: Instance): void {
  instance.container.dataset.showcaseState = instance.onScreen && instance.tabVisible ? "running" : "paused"
  instance.container.dataset.showcaseVariant = instance.variant
}

function applyHold(instance: Instance): void {
  instance.mounted.setPaused(!instance.onScreen || !instance.tabVisible)
  report(instance)
}

async function mountOne(container: HTMLElement): Promise<void> {
  const source = container.dataset.showcase
  if (!source) return

  const response = await fetch(source)
  if (!response.ok) throw new Error(`showcase: ${source} returned ${response.status}`)
  const artefact = (await response.json()) as Artefact

  const canvas = document.createElement("canvas")
  // The embed owns "fill the container" and nothing else. Where the container
  // sits, how big it is and what is stacked over it are the host's business.
  canvas.style.cssText = "display:block;width:100%;height:100%;"
  container.append(canvas)

  // Resolved against the artefact rather than the page, so an artefact served
  // from another origin still finds its own runner. Not a literal, so bundling
  // leaves it as a real dynamic import.
  const runnerUrl = new URL(artefact.runner, new URL(source, location.href)).href
  const runner = (await import(/* @vite-ignore */ runnerUrl)) as {
    mount: (canvas: HTMLCanvasElement, settings: unknown) => Mounted
  }

  const variant = pickVariant(artefact, container.dataset.showcaseVariant)
  const instance: Instance = {
    container,
    artefact,
    mounted: runner.mount(canvas, artefact.variants[variant]),
    variant,
    onScreen: true,
    tabVisible: !document.hidden,
  }
  instances.push(instance)

  // A background that keeps drawing while scrolled away, or while the tab is
  // in the background, is the difference between decoration and a battery
  // complaint. The embed's job, not the piece's.
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        instance.onScreen = entry.isIntersecting
        applyHold(instance)
      }
    }).observe(container)
  }

  document.addEventListener("visibilitychange", () => {
    instance.tabVisible = !document.hidden
    applyHold(instance)
  })

  report(instance)
}

/**
 * The host's one lever, for a page whose theme is its own invention.
 *
 * A page that leaves this alone gets `prefers-color-scheme` for free and never
 * needs to know this exists. A page with a class-based toggle — as this site has
 * — watches its own element and calls this, which keeps the knowledge of what
 * "dark" means in the only place that has it.
 */
function setVariant(wanted: string): void {
  for (const instance of instances) {
    const next = pickVariant(instance.artefact, wanted)
    if (next === instance.variant) continue
    instance.variant = next
    instance.mounted.setSettings(instance.artefact.variants[next])
    report(instance)
  }
}

const stats = () =>
  instances.map(({ artefact, variant, mounted }) => ({
    id: artefact.id,
    variant,
    ...(mounted.stats() as object),
  }))

declare global {
  interface Window {
    showcase?: { setVariant: (variant: string) => void; stats: () => unknown[] }
  }
}

window.showcase = { setVariant, stats }

/**
 * Failure leaves the host page exactly as it was.
 *
 * A dead network, a missing artefact or a blocked script all end with the
 * container emptied, so whatever CSS background the host already has is what
 * shows. The canvas has to be in the DOM before mounting — the piece measures
 * `clientWidth` — so it is removed on the way out rather than withheld on the
 * way in.
 *
 * A prerendered still would be a prettier failure and would also be a whole
 * pipeline, for a case every host has already solved for itself.
 */
for (const element of document.querySelectorAll<HTMLElement>("[data-showcase]")) {
  void mountOne(element).catch((error: unknown) => {
    element.dataset.showcaseState = "failed"
    element.replaceChildren()
    console.warn("[showcase] embed failed; leaving the host background alone", error)
  })
}

export {}
