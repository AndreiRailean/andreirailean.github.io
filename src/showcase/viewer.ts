/**
 * The showcase viewer: one published scene on screen, and a way to the next.
 *
 * **One mount at a time, never a feed.** The obvious reading of "scroll through
 * published work like Instagram" is a column of live embeds, and it is not
 * survivable: every piece here is a full-viewport 2d canvas with its own
 * animation loop, and twenty of them mounted at once is twenty backing stores
 * and twenty loops competing for one main thread. Pausing the off-screen ones
 * does not help — a paused canvas still holds its pixels. So the wall is a
 * sequence, not a column, and exactly one entry is mounted.
 *
 * ## Why it does not go through `embed.js`
 *
 * The embed loader is deliberately narrow: it takes two URLs and gives back
 * nothing, because it is a liability shared by every third-party page that has
 * ever pasted the tag. Driving a wall needs `setScene` and `destroy`, and
 * putting those on `window.showcase` would ship wall machinery to every host
 * that never asked for it.
 *
 * So this file loads the same frozen artefact the same way `embed.ts` does — a
 * dynamic import of `/showcase/runners/<slug>.<hash>.js` — and keeps the
 * `Mounted` handle that `runner.mount()` already returns. Same runners, same
 * scene strings, nothing new on the shared surface.
 *
 * **It imports the built artefact and never a piece's source.** The dependency
 * runs one way: see
 * `src/experiments/docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`.
 *
 * ## Known second copies
 *
 * Off-screen and hidden-tab pausing exist here and in `gallery/embed.ts`. The
 * section hoists on the third copy, not the second, and this one is a backstop
 * rather than a mechanism — only the entry in view is mounted at all, so there
 * is rarely an off-screen instance to pause. Failure handling is deliberately
 * *not* a second copy: a dead runner on a host page means leave the host's own
 * background alone, and here the runner is the page, so it has to say so.
 */

import { axisOf, commits, type Axis } from "@/experiments/gallery/gesture"
import { runnerUrl, type WallEntry } from "@/showcase/wall"

/**
 * The gesture arithmetic is the gallery's, imported rather than copied.
 *
 * It is pure, needs no DOM and knows nothing about a piece, and a wall that
 * committed to different swipe thresholds than the section's interactive view
 * would be a difference nobody chose. If the showcase is ever lifted out of
 * this repo, this is the one import that has to travel with it.
 */

/** What every runner hands back, whatever piece it holds. */
type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

type RunnerModule = { mount: (canvas: HTMLCanvasElement, scene: string) => Mounted }

/** How long the scene's name stays up after it arrives. */
const PLACARD_MS = 2600

/** Runner modules already fetched, by URL. The browser caches the bytes; this caches the evaluation. */
const modules = new Map<string, Promise<RunnerModule>>()

function load(url: string): Promise<RunnerModule> {
  const existing = modules.get(url)
  if (existing) return existing
  // Not a literal, so bundling leaves it as a real dynamic import.
  const pending = import(/* @vite-ignore */ url) as Promise<RunnerModule>
  modules.set(url, pending)
  return pending
}

export type ViewerOptions = {
  wall: readonly WallEntry[]
  /** Which entry the document was served for. */
  start: number
}

/**
 * The wall and the starting entry, as the document carried them.
 *
 * Returns `null` rather than throwing on anything malformed: a viewer that
 * cannot read its own page has nothing to show and should leave the document
 * alone, not take it down with an exception in its first statement.
 */
function boot(): ViewerOptions | null {
  const tag = document.getElementById("showcase-data")
  if (!tag?.textContent) return null
  try {
    const parsed = JSON.parse(tag.textContent) as ViewerOptions
    if (!Array.isArray(parsed.wall) || parsed.wall.length === 0) return null
    if (typeof parsed.start !== "number") return null
    return parsed
  } catch {
    return null
  }
}

export function mountViewer(options: ViewerOptions | null = boot()): void {
  if (!options) return
  const { wall, start } = options
  const found = document.getElementById("showcase")
  const foundStage = found?.querySelector<HTMLElement>(".stage")
  if (!(found instanceof HTMLElement) || !foundStage) return

  // Declared rather than narrowed: the handlers below are function
  // declarations and so are hoisted, which puts them outside the guard's
  // narrowing as far as the checker is concerned.
  const root: HTMLElement = found
  const stage: HTMLElement = foundStage
  const placard = root.querySelector<HTMLElement>(".placard")
  const sceneName = root.querySelector<HTMLElement>(".placard .scene")
  const pieceName = root.querySelector<HTMLElement>(".placard .piece")
  const noteText = root.querySelector<HTMLElement>(".placard .note")
  const counter = root.querySelector<HTMLElement>(".counter")
  const trouble = root.querySelector<HTMLElement>(".trouble")
  const held = root.querySelector<HTMLElement>(".held")

  let at = start
  let mounted: Mounted | null = null
  let canvas: HTMLCanvasElement | null = null
  let showing: WallEntry | null = null
  let paused = false
  /** Bumped on every move, so a slow mount that lost the race cannot install itself. */
  let generation = 0
  let placardTimer = 0

  const entry = () => wall[at]!

  // --- the placard ---------------------------------------------------------

  function say(shown: WallEntry) {
    if (sceneName) sceneName.textContent = shown.title
    if (pieceName) pieceName.textContent = shown.pieceTitle
    if (noteText) noteText.textContent = shown.note
    if (counter) counter.textContent = `${at + 1} / ${wall.length}`
    if (!placard) return
    placard.dataset.going = "false"
    window.clearTimeout(placardTimer)
    placardTimer = window.setTimeout(() => {
      placard.dataset.going = "true"
    }, PLACARD_MS)
  }

  /** The placard comes back on any sign of life, the way the section's chrome does. */
  function wakePlacard() {
    if (showing) say(showing)
  }

  // --- mounting ------------------------------------------------------------

  function teardown() {
    mounted?.destroy()
    mounted = null
    canvas?.remove()
    canvas = null
  }

  /**
   * Shows an entry, reusing what is already running when it can.
   *
   * The common case on a wall ordered by piece is that the next entry shares a
   * runner, and then this is one `setScene` call and no allocation at all —
   * which is the whole reason the viewer keeps a handle rather than re-mounting
   * an embed. Crossing pieces is the expensive path and is unavoidable.
   */
  async function show(next: WallEntry) {
    const mine = ++generation
    trouble?.setAttribute("hidden", "")

    if (mounted && showing && showing.runner === next.runner) {
      mounted.setScene(next.scene)
      showing = next
      say(next)
      void prefetchNeighbours()
      return
    }

    teardown()
    root.dataset.state = "loading"

    let module: RunnerModule
    try {
      module = await load(runnerUrl(next))
    } catch (error) {
      if (mine !== generation) return
      fail(next, error)
      return
    }
    if (mine !== generation) return

    const fresh = document.createElement("canvas")
    fresh.className = "piece"
    stage.append(fresh)

    try {
      // The canvas has to be in the DOM before mounting: a piece measures
      // `clientWidth` on the way up.
      mounted = module.mount(fresh, next.scene)
    } catch (error) {
      fresh.remove()
      fail(next, error)
      return
    }

    canvas = fresh
    showing = next
    paused = false
    root.dataset.state = "running"
    held?.setAttribute("hidden", "")
    say(next)
    void prefetchNeighbours()
  }

  /**
   * A dead runner is fatal here, unlike on a host page.
   *
   * `embed.ts` empties its container so the host's own background shows, which
   * is right for a decoration and wrong for a gallery: the runner *is* the
   * page. So it says what happened and leaves the wall navigable, because the
   * next entry is very likely a different runner and perfectly fine.
   */
  function fail(which: WallEntry, error: unknown) {
    root.dataset.state = "failed"
    if (trouble) {
      trouble.removeAttribute("hidden")
      const what = trouble.querySelector(".what")
      if (what) what.textContent = `${which.title} could not be loaded.`
    }
    console.warn("[showcase] runner failed", which.id, error)
  }

  /**
   * Fetches the neighbours' runners without mounting them.
   *
   * Evaluating a module is cheap; mounting is not. This is what makes crossing
   * into a new piece feel like a scene change rather than a page load, and it
   * is the whole of the "preload" idea — no second canvas, no second loop.
   */
  async function prefetchNeighbours() {
    for (const step of [1, -1]) {
      const neighbour = wall[at + step]
      if (neighbour) void load(runnerUrl(neighbour)).catch(() => {})
    }
  }

  // --- moving --------------------------------------------------------------

  function go(to: number, push = true) {
    const clamped = Math.min(wall.length - 1, Math.max(0, to))
    if (clamped === at && showing) return
    at = clamped
    if (push) history.pushState({ at }, "", `/showcase/${entry().id}/`)
    document.title = `${entry().title} — Showcase`
    void show(entry())
  }

  function setPaused(next: boolean) {
    if (!mounted || next === paused) return
    paused = next
    mounted.setPaused(paused)
    root.dataset.paused = String(paused)
    if (held) held.hidden = !paused
    wakePlacard()
  }

  // --- the gesture ---------------------------------------------------------

  let from: { x: number; y: number; at: number; id: number } | null = null
  let axis: Axis | null = null

  /** Anything the wall drew over the piece takes its own taps. */
  const isFurniture = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("[data-showcase-furniture]"))

  function onPointerDown(event: PointerEvent) {
    if (from || isFurniture(event.target)) return
    from = { x: event.clientX, y: event.clientY, at: event.timeStamp, id: event.pointerId }
    axis = null
    wakePlacard()
  }

  function onPointerMove(event: PointerEvent) {
    if (!from || event.pointerId !== from.id) return
    axis ??= axisOf(event.clientX - from.x, event.clientY - from.y)
  }

  function onPointerUp(event: PointerEvent) {
    if (!from || event.pointerId !== from.id) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    const elapsed = event.timeStamp - from.at
    const settled = axis
    from = null
    axis = null

    // A tap holds the piece. Both axes move the wall: it is one list, so a
    // sideways swipe meaning something else would be a distinction without a
    // difference — unlike the section's view, where across is scenes within a
    // piece and down is the wall.
    if (!settled) {
      setPaused(!paused)
      return
    }
    const travel = settled === "y" ? dy : dx
    if (commits(travel, elapsed)) go(at + (travel < 0 ? 1 : -1))
  }

  window.addEventListener("pointerdown", onPointerDown, { passive: true })
  window.addEventListener("pointermove", onPointerMove, { passive: true })
  window.addEventListener("pointerup", onPointerUp, { passive: true })
  window.addEventListener("pointercancel", onPointerUp, { passive: true })

  // --- the keyboard, which is how this is looked at on a desktop -----------

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
      case "j":
      case "PageDown":
        event.preventDefault()
        go(at + 1)
        break
      case "ArrowUp":
      case "ArrowLeft":
      case "k":
      case "PageUp":
        event.preventDefault()
        go(at - 1)
        break
      case " ":
      case "Spacebar":
        event.preventDefault()
        setPaused(!paused)
        break
      case "Home":
        event.preventDefault()
        go(0)
        break
      case "End":
        event.preventDefault()
        go(wall.length - 1)
        break
    }
  })

  // The wheel moves the wall, one entry per gesture rather than per event: a
  // trackpad emits a burst of a dozen for one flick.
  let wheelIdle = true
  let wheelTimer = 0
  window.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) < 8) return
      window.clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(() => {
        wheelIdle = true
      }, 220)
      if (!wheelIdle) return
      wheelIdle = false
      go(at + (event.deltaY > 0 ? 1 : -1))
    },
    { passive: true },
  )

  for (const button of root.querySelectorAll<HTMLElement>("[data-go]")) {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.go)
      if (Number.isFinite(step)) go(at + step)
    })
  }

  // --- the frame, which is a look rather than a mechanism ------------------

  /**
   * Framed or full-bleed.
   *
   * Full-bleed is the default and is what the pieces were tuned for — a phone
   * viewport is a viewport, which is the case `area^0.75` was written for. The
   * framed look is here to be compared against it, not because it is known to
   * be better.
   *
   * **Toggling it dispatches a resize.** Every piece re-measures on `window`'s
   * resize event and nothing else, so changing the canvas's size without the
   * window changing leaves the piece drawing at the old measurements. A host
   * that resizes a piece owes it that event.
   */
  function setFramed(on: boolean) {
    root.dataset.framed = String(on)
    try {
      localStorage.setItem("showcase-framed", String(on))
    } catch {
      // A private window. The look is a preference, not state worth insisting on.
    }
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))
  }

  const frameToggle = root.querySelector<HTMLElement>("[data-frame-toggle]")
  frameToggle?.addEventListener("click", () => setFramed(root.dataset.framed !== "true"))
  try {
    if (localStorage.getItem("showcase-framed") === "true") setFramed(true)
  } catch {
    // Same.
  }

  // --- behaving itself -----------------------------------------------------

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) mounted?.setPaused(true)
    else if (!paused) mounted?.setPaused(false)
  })

  window.addEventListener("popstate", (event) => {
    const state = event.state as { at?: number } | null
    if (typeof state?.at === "number") go(state.at, false)
  })

  // --- boot ----------------------------------------------------------------

  history.replaceState({ at }, "", location.pathname)
  void show(entry())

  // A handle for looking at it while it is being built, matching the section's
  // idiom of a piece publishing one.
  Object.assign(window, {
    showcaseWall: {
      go,
      at: () => at,
      entry: () => entry(),
      stats: () => mounted?.stats(),
    },
  })
}
