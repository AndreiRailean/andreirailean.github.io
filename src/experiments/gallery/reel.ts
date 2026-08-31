import { axisOf, commits, resist, scrubSteps, type Axis } from "@/experiments/gallery/gesture"

/**
 * The interactive view: a piece full-bleed on a touch device, with two axes of
 * swipe.
 *
 * Horizontal moves through the piece's presets, vertical moves through the wall.
 * Neither wraps — the collection has a top and a bottom exactly as the index
 * does, and the way out is an X rather than a place you arrive at by
 * overshooting.
 *
 * **It reaches the piece through `window.experiment` and nothing else.**
 * `gallery/` may not import a piece and does not need to: every piece already
 * publishes `preset(n)` and `presets()`, because anything reachable only by
 * pointer is untestable headlessly. That handle is the whole seam, so this file
 * knows nothing about settings, hues, or what any piece draws. See the console
 * API section of `src/experiments/AGENTS.md`.
 *
 * **Imposed, like the rest of the gallery.** A visitor should not have to
 * relearn how to leave, or which way the next piece is, in the next room.
 */

/** How far a drag carries one preset in the scrubbing feel, in px. */
const SCRUB_STRIDE = 64

/** How far a blocked axis can be pulled before it stops giving, in px. */
const RESIST_LIMIT = 96

/** The outgoing slide: long enough to read as a departure, short enough not to be a wait. */
const LEAVE_MS = 260

/** How long the poster is crossfaded out over, once the piece has drawn. */
const CURTAIN_MS = 420

/** How long the one-time gesture hint stays up. */
const HINT_MS = 6000

/**
 * Three feels, so the gesture can be judged by using it rather than described.
 *
 * - `quiet` — nothing on screen moves. The preset changes on release, and the
 *   placard names it.
 * - `drag` — the piece follows the finger and either snaps back or carries on out.
 * - `scrub` — presets change continuously under the fingertip, so one long drag
 *   riffles through every scene a piece has.
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
 * **Not `window.location.search` at the point of use.** A piece landed on
 * bare rewrites its own address to the primary preset's full query — that is the
 * whole point of the landing rewrite, so a visitor leaves with a link to the
 * scene they saw — and the rewrite drops every param that is not a setting.
 * Reading the live address afterwards therefore says two false things: that this
 * visit did not ask for the interactive view, and that the address carries a
 * scene the poster is not a still of. Both were live bugs, and the second lifted
 * the poster with a jump-cut on every bare landing.
 *
 * This module's script runs before the piece's, so import time is before the
 * rewrite.
 *
 * Guarded only so the unit runner can import this file for the pure address
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

/** Whether the address describes a scene the piece's own poster is a still of. */
export function posterMatchesScene(search: string): boolean {
  return [...new URLSearchParams(search).keys()].every((key) => CARRIED.includes(key))
}

/** The piece's own scriptable handle, structurally. `window.experiment` is typed `unknown` on purpose. */
type PieceHandle = {
  preset: (which: number) => unknown
  presets: () => string[]
}

function pieceHandle(): PieceHandle | null {
  const api = window.experiment
  if (!api || typeof api !== "object") return null
  const candidate = api as Partial<PieceHandle>
  return typeof candidate.preset === "function" && typeof candidate.presets === "function"
    ? (candidate as PieceHandle)
    : null
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

/**
 * Waits for the piece to publish its handle, and then for it to have drawn.
 *
 * The second wait is not belt-and-braces: every piece here marks the scene dirty
 * and asks for one animation frame, so the canvas is still empty at the moment
 * the handle appears. It is the same window `tests/AGENTS.md` warns about reading
 * a canvas inside, and lifting the poster during it shows a black rectangle.
 */
async function pieceDrawn(): Promise<PieceHandle | null> {
  for (let attempt = 0; attempt < 300; attempt++) {
    const handle = pieceHandle()
    if (handle) {
      await nextFrame()
      await nextFrame()
      return handle
    }
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
  if (!(root instanceof HTMLElement)) return

  const html = document.documentElement
  const curtain = document.querySelector<HTMLImageElement>(".curtain")
  const label = root.querySelector<HTMLElement>(".scene")
  const hint = root.querySelector<HTMLElement>(".hint")

  /**
   * Lifts the poster held over the canvas.
   *
   * Runs whatever the pointer is: it is what stops a cold landing being a black
   * rectangle for as long as the piece takes to draw, which is as true with a
   * mouse as with a finger.
   */
  async function raiseCurtain() {
    if (!curtain) return
    if (!posterMatchesScene(ENTRY)) {
      // A link carrying settings is a link to a scene the poster is not of. The
      // posters are captured from the primary preset, which is what a bare
      // address renders and nothing else.
      curtain.remove()
      return
    }
    await pieceDrawn()
    curtain.style.transition = `opacity ${CURTAIN_MS}ms ease-out`
    curtain.style.opacity = "0"
    window.setTimeout(() => curtain.remove(), CURTAIN_MS + 60)
  }

  if (!isReel()) {
    void raiseCurtain()
    return
  }

  const feel = feelOf()
  root.hidden = false
  html.dataset.reel = feel

  const previous = neighbourFrom(root, "previous")
  const next = neighbourFrom(root, "next")

  let handle: PieceHandle | null = null
  let names: string[] = []
  /** Which preset is on screen, or -1 for a scene that is nobody's preset — a shared link. */
  let index = -1
  let leaving = false

  const surfaces = (): HTMLElement[] =>
    [...document.querySelectorAll<HTMLElement>("canvas"), curtain].filter(
      (element): element is HTMLElement => Boolean(element) && element!.isConnected,
    )

  function offset(x: number, y: number, animate = false) {
    for (const surface of surfaces()) {
      surface.style.transition = animate ? `transform ${LEAVE_MS}ms cubic-bezier(0.2, 0, 0.1, 1)` : "none"
      surface.style.transform = x === 0 && y === 0 ? "" : `translate3d(${x}px, ${y}px, 0)`
    }
  }

  /**
   * Which preset the piece is actually on.
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

  /** What the placard says at rest: the scene's name, or the piece's when the scene is nobody's preset. */
  function sayScene() {
    index = readIndex()
    say(names[index] ?? document.title)
  }

  function toPreset(wanted: number) {
    if (!handle || names.length === 0) return
    const clamped = Math.min(names.length - 1, Math.max(0, wanted))
    if (clamped === index) return
    handle.preset(clamped + 1)
    index = clamped
    say(names[index] ?? "")
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
      // A tap. The kit's idle timer has already woken the chrome on `touchstart`;
      // all this owes the visitor is the placard saying where they are.
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
    if (commits(dy, elapsed) && towards) {
      leaveTo(towards, dy < 0 ? -1 : 1)
      return
    }
    offset(0, 0, feel === "drag")
    sayScene()
  }

  window.addEventListener("pointerdown", onPointerDown, { passive: true })
  window.addEventListener("pointermove", onPointerMove, { passive: true })
  window.addEventListener("pointerup", onPointerUp, { passive: true })
  window.addEventListener("pointercancel", onPointerUp, { passive: true })

  // --- boot ----------------------------------------------------------------

  void (async () => {
    handle = await pieceDrawn()
    names = handle?.presets() ?? []
    sayScene()
    void raiseCurtain()

    // Nothing on the screen says the two axes exist, so the first visit is told
    // once. It rides the placard, so it leaves with the chrome.
    if (hint && !sessionStorage.getItem("reel-hinted")) {
      hint.hidden = false
      sessionStorage.setItem("reel-hinted", "1")
      window.setTimeout(() => {
        hint.hidden = true
      }, HINT_MS)
    }
  })()
}
