/**
 * The embed loader: the host-side half, bundled to `/showcase/embed.js`.
 *
 * Gallery rather than kit, on the section's own test. Which runner a page gets,
 * how it is addressed and how it behaves as a guest are **imposed** — every
 * piece is embedded the same way and none of them gets to move it. The kit is
 * what a piece is *offered* and may decline; nothing here is declinable, and
 * nothing here draws a control.
 *
 * It knows nothing about any piece. It cannot name a setting, read a scene, or
 * name Starry Night. It loads the runner a page pins, hands it the scene string
 * verbatim, and behaves itself on a page it does not own.
 *
 * ```html
 * <div data-showcase-runner="https://www.andrei.md/showcase/runners/starry-night.<hash>.js"
 *      data-showcase-scene="<packed>"></div>
 * <script type="module" src="https://www.andrei.md/showcase/embed.js"></script>
 * ```
 *
 * That is the whole of what a copy-embed button produces, and the whole of what
 * a page needs. The host styles the element however it likes — fixed and
 * full-bleed for a page background, a plain block for one section. The embed
 * only fills it.
 *
 * **Unversioned on purpose.** A runner is content-addressed and never changes
 * again; this file is the one mutable part, and therefore the only thing that
 * can be fixed for every embed at once when a browser breaks something. It is
 * kept small because everything in it is a liability shared by every page that
 * has ever pasted the tag.
 */

type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

type Instance = {
  container: HTMLElement
  mounted: Mounted
  /**
   * The scenes this page pinned, by name. `light` is the base attribute; any
   * `data-showcase-scene-<name>` adds another.
   */
  scenes: Record<string, string>
  showing: string
  /**
   * Whether `prefers-color-scheme` still decides.
   *
   * **A host that calls `setVariant` takes over for good.** Themes are a
   * convenience the embed offers, not a thing it insists on: a site whose theme
   * is a class rather than a media query has to be able to drive this, and an
   * embed that kept second-guessing it would fight the page it is a guest on.
   */
  followSystem: boolean
  /** Off-screen and hidden-tab are separate reasons; either one holds it. */
  onScreen: boolean
  tabVisible: boolean
}

const instances: Instance[] = []
const darkMedia = window.matchMedia?.("(prefers-color-scheme: dark)")

/** A wanted name is only a hint: a page without that scene keeps the one it has. */
function pick(instance: Instance, wanted: string): string {
  return wanted in instance.scenes ? wanted : instance.showing
}

/** Surfaced on the container, so the state is legible without a console. */
function report(instance: Instance): void {
  instance.container.dataset.showcaseState = instance.onScreen && instance.tabVisible ? "running" : "paused"
  instance.container.dataset.showcaseVariant = instance.showing
}

function applyHold(instance: Instance): void {
  instance.mounted.setPaused(!instance.onScreen || !instance.tabVisible)
  report(instance)
}

function show(instance: Instance, wanted: string): void {
  const next = pick(instance, wanted)
  if (next === instance.showing) return
  instance.showing = next
  instance.mounted.setScene(instance.scenes[next]!)
  report(instance)
}

/**
 * Every scene this element pins.
 *
 * `data-showcase-scene` is the base one and is called `light`, because that is
 * what it will be on a page that only ever names one and then adds a dark
 * counterpart. A page naming one scene never learns that variants exist.
 */
function scenesOf(container: HTMLElement): Record<string, string> {
  const scenes: Record<string, string> = {}
  const base = container.dataset.showcaseScene
  if (base) scenes.light = base
  for (const { name, value } of Array.from(container.attributes)) {
    const match = /^data-showcase-scene-(.+)$/.exec(name)
    if (match && value) scenes[match[1]!] = value
  }
  return scenes
}

async function mountOne(container: HTMLElement): Promise<void> {
  const runnerUrl = container.dataset.showcaseRunner
  const scenes = scenesOf(container)
  if (!runnerUrl || Object.keys(scenes).length === 0) return

  const canvas = document.createElement("canvas")
  // The embed owns "fill the container" and nothing else. Where the container
  // sits, how big it is and what is stacked over it are the host's business.
  canvas.style.cssText = "display:block;width:100%;height:100%;"
  container.append(canvas)

  // Not a literal, so bundling leaves it as a real dynamic import.
  const runner = (await import(/* @vite-ignore */ runnerUrl)) as {
    mount: (canvas: HTMLCanvasElement, scene: string) => Mounted
  }

  const wanted = container.dataset.showcaseVariant ?? (darkMedia?.matches ? "dark" : "light")
  const showing = wanted in scenes ? wanted : (Object.keys(scenes)[0] as string)

  const instance: Instance = {
    container,
    mounted: runner.mount(canvas, scenes[showing]!),
    scenes,
    showing,
    followSystem: container.dataset.showcaseVariant === undefined,
    onScreen: true,
    tabVisible: !document.hidden,
  }
  instances.push(instance)

  // A background that keeps drawing while scrolled away, or while the tab is in
  // the background, is the difference between decoration and a battery
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
 * A page that leaves this alone follows `prefers-color-scheme` and keeps
 * following it — including a change made while the page is open, which is the
 * whole point of listening rather than reading once at mount. A page with a
 * class-based toggle calls this instead, and by calling it says "I decide now".
 */
function setVariant(wanted: string): void {
  for (const instance of instances) {
    instance.followSystem = false
    show(instance, wanted)
  }
}

// Live, not once at mount. Reading `prefers-color-scheme` a single time is how a
// background ends up on yesterday's scheme in a session that outlives sunset.
darkMedia?.addEventListener("change", (event) => {
  for (const instance of instances) {
    if (instance.followSystem) show(instance, event.matches ? "dark" : "light")
  }
})

const stats = () =>
  instances.map(({ container, showing, followSystem, mounted }) => ({
    runner: container.dataset.showcaseRunner,
    variant: showing,
    followSystem,
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
 * A dead network, a blocked script or an unreadable scene all end with the
 * container emptied, so whatever CSS background the host already has is what
 * shows. The canvas has to be in the DOM before mounting — the piece measures
 * `clientWidth` — so it is removed on the way out rather than withheld on the
 * way in.
 *
 * A prerendered still would be a prettier failure and would also be a whole
 * pipeline, for a case every host has already solved for itself.
 */
for (const element of document.querySelectorAll<HTMLElement>("[data-showcase-runner]")) {
  void mountOne(element).catch((error: unknown) => {
    element.dataset.showcaseState = "failed"
    element.replaceChildren()
    console.warn("[showcase] embed failed; leaving the host background alone", error)
  })
}

export {}
