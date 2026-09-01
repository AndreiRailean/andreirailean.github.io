import { axisOf, commits, resist, scrubSteps, type Axis } from "@/experiments/gallery/gesture"

/**
 * The interactive view: a piece full-bleed on a touch device, with two axes of
 * swipe and a tap that holds it.
 *
 * Across moves through the piece's scenes, up and down move through the wall,
 * and a tap pauses. Neither axis wraps — the collection has a top and a bottom
 * exactly as the index does, and the way out is an X rather than a place you
 * arrive at by overshooting.
 *
 * **It reaches the piece through `window.experiment` and nothing else.**
 * `gallery/` may not import a piece and does not need to: every piece publishes
 * `preset(n)`, `presets()` and `pause()`, because anything reachable only by
 * pointer is untestable headlessly. That handle is the whole seam, so this file
 * knows nothing about settings, hues, or what any piece draws. See the console
 * API section of `src/experiments/AGENTS.md`.
 *
 * **Imposed, like the rest of the gallery.** A visitor should not have to
 * relearn how to leave, or which way the next piece is, in the next room.
 */

/** How far a drag carries one scene in the scrubbing feel, in px. */
const SCRUB_STRIDE = 64

/** How far a blocked axis can be pulled before it stops giving, in px. */
const RESIST_LIMIT = 96

/** The outgoing slide: long enough to read as a departure, short enough not to be a wait. */
const LEAVE_MS = 260

/** How long each thing in the middle of the screen stays up before it starts going. */
const MARK_MS = 850
const NAME_MS = 1300
const WORD_MS = 1500

/** How long anything there takes to go, matching the transition in `Reel.astro`. */
const GOING_MS = 600

/** How long the one-time gesture hint stays up. */
const HINT_MS = 6000

/**
 * Three feels, so the gesture can be judged by using it rather than described.
 *
 * - `quiet` — nothing on screen moves. The scene changes on release, and the
 *   placard names it.
 * - `drag` — the piece follows the finger and either snaps back or carries on out.
 * - `scrub` — scenes change continuously under the fingertip, so one long drag
 *   riffles through everything a piece has.
 *
 * Chosen with `?feel=`. Not a setting, so it never joins the shareable query
 * string a piece builds from its own state.
 */
const FEELS = ["quiet", "drag", "scrub"] as const
export type Feel = (typeof FEELS)[number]

/** Non-setting params the view carries from one piece to the next. */
const CARRIED: readonly string[] = ["reel", "feel"]

/**
 * The address as it arrived, read once at import.
 *
 * **Not `window.location.search` at the point of use.** A piece landed on bare
 * rewrites its own address to the primary preset's full query — that is the
 * point of the landing rewrite, so a visitor leaves with a link to the scene
 * they saw — and the rewrite drops every param that is not a setting. Reading
 * the live address afterwards therefore claims this visit never asked for the
 * interactive view, which was a live bug the browser suite caught.
 *
 * This module's script runs before the piece's, so import time is before the
 * rewrite. Guarded only so the unit runner can import this file for the pure
 * helpers below; nothing here runs anywhere but a browser.
 */
const ENTRY = typeof window === "undefined" ? "" : window.location.search

/**
 * Whether this visit gets the interactive view.
 *
 * A touch device, or `?reel=1` — an escape hatch in the section's existing
 * idiom, beside `?panel=1` and `?idle=`. It is not only for tools: it is how the
 * view gets looked at on a desktop while it is being built, and `?reel=0` is how
 * a tablet asks for the panel back.
 */
export function isReel(search: string = ENTRY): boolean {
  const forced = new URLSearchParams(search).get("reel")
  if (forced === "1") return true
  if (forced === "0") return false
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches
}

export function feelOf(search: string = ENTRY): Feel {
  const asked = new URLSearchParams(search).get("feel")
  return FEELS.find((feel) => feel === asked) ?? "quiet"
}

/** The address of another piece, carrying the params that describe how this view is being looked at. */
export function pieceHref(slug: string, search = ""): string {
  const from = new URLSearchParams(search)
  const carried = new URLSearchParams()
  for (const name of CARRIED) {
    const value = from.get(name)
    if (value !== null) carried.set(name, value)
  }
  const query = carried.toString()
  return `/experiments/${slug}/${query ? `?${query}` : ""}`
}

/** The piece's own scriptable handle, structurally. `window.experiment` is typed `unknown` on purpose. */
type PieceHandle = {
  preset: (which: number) => unknown
  presets: () => string[]
  pause: (held?: boolean) => boolean
}

function pieceHandle(): PieceHandle | null {
  const api = window.experiment
  if (!api || typeof api !== "object") return null
  const candidate = api as Partial<PieceHandle>
  const complete =
    typeof candidate.preset === "function" &&
    typeof candidate.presets === "function" &&
    typeof candidate.pause === "function"
  return complete ? (candidate as PieceHandle) : null
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

/** Waits for the piece to publish its handle. It is a module script, so it arrives after the document. */
async function pieceReady(): Promise<PieceHandle | null> {
  for (let attempt = 0; attempt < 300; attempt++) {
    const handle = pieceHandle()
    if (handle) return handle
    await nextFrame()
  }
  return null
}

type Neighbour = { slug: string; title: string }

function neighbourFrom(root: HTMLElement, which: "previous" | "next"): Neighbour | null {
  const slug = root.dataset[which]
  return slug ? { slug, title: root.dataset[`${which}Title`] ?? slug } : null
}

/**
 * Mounts the view.
 *
 * Called from `Reel.astro`'s own script rather than from a piece's page, so the
 * only thing a page has to say about any of this is `chrome: !isReel()`.
 */
export function mountReel(): void {
  const root = document.getElementById("reel")
  if (!(root instanceof HTMLElement) || !isReel()) return

  const html = document.documentElement
  const label = root.querySelector<HTMLElement>(".scene")
  const dots = root.querySelector<HTMLElement>(".dots")
  const hint = root.querySelector<HTMLElement>(".hint")
  const middle = root.querySelector<HTMLElement>(".middle")
  const held = root.querySelector<HTMLElement>(".mark.held")
  const playing = root.querySelector<HTMLElement>(".mark.playing")
  const name = root.querySelector<HTMLElement>(".name")
  const word = root.querySelector<HTMLElement>(".word")

  const feel = feelOf()
  root.hidden = false
  html.dataset.reel = feel

  const previous = neighbourFrom(root, "previous")
  const next = neighbourFrom(root, "next")

  let handle: PieceHandle | null = null
  let names: string[] = []
  /** Which scene is on screen, or -1 for one that is nobody's preset — a shared link. */
  let index = -1
  let paused = false
  let leaving = false

  const surfaces = () => [...document.querySelectorAll<HTMLElement>("canvas")]

  function offset(x: number, y: number, animate = false) {
    for (const surface of surfaces()) {
      surface.style.transition = animate ? `transform ${LEAVE_MS}ms cubic-bezier(0.2, 0, 0.1, 1)` : "none"
      surface.style.transform = x === 0 && y === 0 ? "" : `translate3d(${x}px, ${y}px, 0)`
    }
  }

  /**
   * Which scene the piece is actually on.
   *
   * The kit publishes it on `<html>` beside its idle state; reading that rather
   * than comparing settings is what keeps this file free of any opinion about
   * what a piece's settings mean.
   */
  function readIndex(): number {
    const published = Number(html.dataset.preset)
    return html.dataset.preset !== undefined && Number.isInteger(published) ? published : -1
  }

  const say = (text: string) => {
    if (label) label.textContent = text
  }

  function markDots() {
    if (!dots) return
    for (const [at, dot] of [...dots.children].entries()) {
      if (dot instanceof HTMLElement) dot.dataset.here = String(at === index)
    }
  }

  /** What the placard says at rest: the scene's name, or the piece's when the scene is nobody's preset. */
  function sayScene() {
    index = readIndex()
    say(names[index] ?? document.title)
    markDots()
  }

  // --- the middle slot -----------------------------------------------------

  let showing: HTMLElement | null = null
  let holdTimer = 0
  let goneTimer = 0

  const put = (element: HTMLElement) => {
    element.hidden = true
    delete element.dataset.going
  }

  /**
   * Shows one thing in the middle of the screen, which then goes.
   *
   * One slot and one timer pair for all of them, so two cannot be up at once
   * and a second flash always replaces the first rather than racing it. The
   * arrival animation restarts for free: `hidden` is `display: none`, and
   * leaving that state re-runs a CSS animation.
   */
  function flash(element: HTMLElement | null, text: string | null, holdMs: number) {
    if (!middle || !element) return
    window.clearTimeout(holdTimer)
    window.clearTimeout(goneTimer)
    if (showing && showing !== element) put(showing)

    if (text !== null) element.textContent = text
    put(element)
    element.hidden = false
    showing = element
    middle.hidden = false

    holdTimer = window.setTimeout(() => {
      element.dataset.going = "true"
      goneTimer = window.setTimeout(() => {
        put(element)
        if (showing === element) {
          showing = null
          middle.hidden = true
        }
      }, GOING_MS)
    }, holdMs)
  }

  // --- holding the piece ---------------------------------------------------

  function setPaused(next: boolean) {
    if (!handle || next === paused) return
    paused = handle.pause(next)
    flash(paused ? held : playing, null, MARK_MS)
  }

  /**
   * Changing scene while the piece is held.
   *
   * A held piece still has to show the scene it was just moved to, and every
   * piece here marks itself dirty and waits for an animation frame — so the hold
   * is lifted for exactly the two frames that takes and then put back. Simply
   * re-pausing would cancel the frame before it ran and leave the previous scene
   * on the canvas under the new scene's name.
   */
  function drawWhileHeld() {
    if (!handle || !paused) return
    handle.pause(false)
    requestAnimationFrame(() => requestAnimationFrame(() => handle?.pause(true)))
  }

  function toPreset(wanted: number) {
    if (!handle || names.length === 0) return
    const clamped = Math.min(names.length - 1, Math.max(0, wanted))
    if (clamped === index) return
    handle.preset(clamped + 1)
    index = clamped
    say(names[index] ?? "")
    markDots()
    drawWhileHeld()
  }

  /** The name a horizontal gesture would land on, for the placard to preview mid-drag. */
  const wouldLand = (dx: number) => names[Math.min(names.length - 1, Math.max(0, index + (dx < 0 ? 1 : -1)))]

  function leaveTo(neighbour: Neighbour, away: -1 | 1) {
    if (leaving) return
    leaving = true
    say(neighbour.title)
    const go = () => window.location.assign(pieceHref(neighbour.slug, ENTRY))
    if (feel === "quiet") {
      go()
      return
    }
    offset(0, away * window.innerHeight, true)
    window.setTimeout(go, LEAVE_MS)
  }

  // --- the gesture ---------------------------------------------------------

  let from: { x: number; y: number; at: number; id: number; index: number } | null = null
  let axis: Axis | null = null
  let scrubbed = 0

  const isFurniture = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(".out"))

  function onPointerDown(event: PointerEvent) {
    if (leaving || from || isFurniture(event.target)) return
    index = readIndex()
    from = { x: event.clientX, y: event.clientY, at: event.timeStamp, id: event.pointerId, index }
    axis = null
    scrubbed = 0
  }

  function onPointerMove(event: PointerEvent) {
    if (!from || event.pointerId !== from.id) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y

    axis ??= axisOf(dx, dy)
    if (!axis) return

    if (axis === "x") {
      if (feel === "scrub") {
        // Left is forward, so a drag leftwards walks up the list.
        const steps = scrubSteps(-dx, SCRUB_STRIDE)
        if (steps !== scrubbed) {
          scrubbed = steps
          toPreset(from.index + steps)
        }
        return
      }
      const blocked = (dx < 0 && index >= names.length - 1) || (dx > 0 && index <= 0)
      if (feel === "drag") offset(blocked ? resist(dx, RESIST_LIMIT) : dx, 0)
      say(wouldLand(dx) ?? document.title)
      return
    }

    const towards = dy < 0 ? next : previous
    if (feel === "drag") offset(0, towards ? dy : resist(dy, RESIST_LIMIT))
    if (towards) say(towards.title)
  }

  function onPointerUp(event: PointerEvent) {
    if (!from || event.pointerId !== from.id) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    const elapsed = event.timeStamp - from.at
    const settled = axis
    from = null
    axis = null

    if (!settled) {
      // A tap holds the piece, or lets it go. The kit's idle timer has already
      // woken the chrome on `touchstart`, so the placard comes back with it.
      setPaused(!paused)
      sayScene()
      return
    }

    if (settled === "x") {
      if (feel !== "scrub" && commits(dx, elapsed)) toPreset(index + (dx < 0 ? 1 : -1))
      offset(0, 0, feel === "drag")
      sayScene()
      return
    }

    const towards = dy < 0 ? next : previous
    if (commits(dy, elapsed)) {
      if (towards) {
        leaveTo(towards, dy < 0 ? -1 : 1)
        return
      }
      /*
       * The ends of the vertical axis were silent, and a swipe that met the end
       * of the wall was indistinguishable from one the view had failed to
       * register — which is the reading a visitor reaches for first.
       */
      flash(word, dy < 0 ? "the end of the wall" : "the start of the wall", WORD_MS)
    }
    offset(0, 0, feel === "drag")
    sayScene()
  }

  window.addEventListener("pointerdown", onPointerDown, { passive: true })
  window.addEventListener("pointermove", onPointerMove, { passive: true })
  window.addEventListener("pointerup", onPointerUp, { passive: true })
  window.addEventListener("pointercancel", onPointerUp, { passive: true })

  // --- boot ----------------------------------------------------------------

  /*
   * Which piece this is, named over the gap where it boots.
   *
   * Before anything is awaited, because the gap is the point: a piece arrives as
   * an empty canvas, and between two full-bleed graphics that makes arriving
   * somewhere new and arriving nowhere look the same. It is also the swipe's
   * only acknowledgement — the placard is still naming the scene, and on a slow
   * piece the first frames say nothing either.
   */
  flash(name, document.title, NAME_MS)

  void (async () => {
    handle = await pieceReady()
    names = handle?.presets() ?? []

    if (dots) {
      dots.replaceChildren(...names.map(() => document.createElement("li")))
    }
    sayScene()

    /*
     * The placard is a readout of the piece, not a record of the last gesture.
     *
     * Watching the kit's published scene rather than updating the label at each
     * of the places that change one: a preset loaded from the console, or a
     * setting nudged, would otherwise leave the name and the lit dot describing
     * a scene that is no longer on the screen.
     */
    new MutationObserver(() => {
      if (readIndex() !== index) sayScene()
    }).observe(html, { attributes: true, attributeFilter: ["data-preset"] })

    // The dots say the scenes go across; nothing says the wall goes up and down.
    if (hint && !sessionStorage.getItem("reel-hinted")) {
      hint.hidden = false
      sessionStorage.setItem("reel-hinted", "1")
      window.setTimeout(() => {
        hint.hidden = true
      }, HINT_MS)
    }
  })()
}
