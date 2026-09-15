/**
 * The showcase viewer: one published scene on screen, and a way to the next.
 *
 * **One mount at a time, never a column.** The obvious way to build a scrolling
 * gallery is a column of live embeds, and it is not survivable here: every piece
 * is a full-viewport 2d canvas with its own animation loop, and twenty of them
 * mounted at once is twenty backing stores and twenty loops competing for one
 * main thread. Pausing the off-screen ones does not help — a paused canvas still
 * holds its pixels. So the wall is a sequence, and exactly one entry is mounted.
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
 *
 * **Idle-hiding is the second of them**, against `kit/controls.ts` — same
 * number, same `?idle=` hatch, no shared code. `src/showcase/AGENTS.md` says
 * what would move on the third.
 */

import { axisOf, commits, type Axis } from "@/experiments/gallery/gesture"
import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { runnerUrl, type WallEntry } from "@/showcase/wall"

/**
 * Two imports from the section, and both are pure arithmetic.
 *
 * **The gesture** is the gallery's: a wall that committed to different swipe
 * thresholds than the section's interactive view would be a difference nobody
 * chose.
 *
 * **The generators** are the section's, by the same test that put them there —
 * `../experiments/docs/adr/20260829-a-third-copy-of-the-generators-moves-to-the-section.md`
 * hoisted them out of three pieces precisely so the fourth caller would not
 * write mulberry32 again. Shuffling a wall is that fourth caller. Copying them
 * in here to honour the letter of "the showcase imports nothing from a piece"
 * would have broken the rule that clause exists to serve.
 *
 * Neither is a piece, neither touches a DOM, and both are tested in the node
 * suite. That is the line: **the showcase imports the section's arithmetic and
 * never a piece's behaviour.** If the showcase is ever lifted out of this repo,
 * these two travel with it.
 */

/** What every runner hands back, whatever piece it holds. */
type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

type RunnerModule = { mount: (canvas: HTMLCanvasElement, scene: string) => Mounted }

/**
 * How long the furniture stays up after the last sign of life.
 *
 * 2500 is `IDLE_MS` in `kit/controls.ts`, and this is a **second copy rather
 * than an import**: nothing here reaches into a piece or the kit, and a wall
 * that receded on a different clock from the experiments would be a difference
 * nobody chose. The section hoists on the third copy, not the second — see the
 * note in `src/showcase/AGENTS.md` about what would have to move.
 */
const IDLE_MS = 2500

/**
 * How long each entry holds the screen when `?play` asked for autoplay but not
 * for a number.
 *
 * Thirty seconds is long enough for a piece that takes a moment to become
 * itself — embers builds up, psyxels is immediately what it is — and short
 * enough that a room notices the wall is a wall. It is a starting point rather
 * than a finding: `?play=45` is the control, which is the whole reason there is
 * no control.
 */
const PLAY_MS = 30_000

/** The shortest autoplay anyone can ask for, so `?play=0.01` cannot thrash a mount. */
const PLAY_FLOOR_MS = 1000

/** How long a play or pause mark holds before it starts going, matching `gallery/reel.ts`. */
const MARK_MS = 850

/** How long it takes to go, matching the transition in `Wall.astro`. */
const MARK_GOING_MS = 450

/** How long an entry may hold the screen, in milliseconds. `max` of 0 is off. */
export type PlaySpan = { min: number; max: number }

const OFF: PlaySpan = { min: 0, max: 0 }

/**
 * How long each entry holds the screen, read off `?play`.
 *
 * **One parameter doing all of it**, rather than a switch, a number and a
 * spread: a wall on a kiosk is configured entirely by its address, and
 * `?play=30&autoplay=1&jitter=15` would be three things to get wrong where one
 * will do.
 *
 * - absent — off. This has to be the default, or every link anybody has shared
 *   becomes a slideshow that walks away from the scene it was sent for.
 * - `?play` — on, at `PLAY_MS` exactly.
 * - `?play=45` — on, at forty-five seconds exactly.
 * - `?play=20-45` — on, somewhere in between, drawn afresh for every scene.
 * - `?play=0`, or anything at or below zero — off, said out loud.
 *
 * **A range rather than a jitter percentage**, because a range is the thing
 * being asked for and a percentage is a thing to convert. Reversed ends are
 * taken as written and sorted: `?play=45-20` is nobody's mistake worth failing.
 *
 * **An unreadable number is on rather than off**, which is the one choice here
 * worth stating. `?play=thirty` is unambiguously somebody asking for autoplay,
 * and the failure that matters is the silent one: a kiosk that shows a single
 * frozen scene all week looks exactly like a kiosk nobody configured.
 *
 * Exported because it is a string in and two numbers out, which per
 * `tests/AGENTS.md` is the unit runner's and not a browser's.
 */
export function playSpan(asked: string | null): PlaySpan {
  if (asked === null) return OFF
  const text = asked.trim()
  if (text === "") return { min: PLAY_MS, max: PLAY_MS }

  // Split before parsing, or `Number("20-45")` is `NaN` and a range reads as
  // unreadable. Two non-empty halves or it is not a range — which is also what
  // keeps a bare `-45` out of here and on the single-number path, where it is
  // negative and therefore off.
  const halves = text.split("-")
  if (halves.length === 2 && halves[0]!.trim() !== "" && halves[1]!.trim() !== "") {
    const low = seconds(halves[0]!)
    const high = seconds(halves[1]!)
    if (low !== null && high !== null && low > 0 && high > 0) {
      return { min: Math.min(low, high), max: Math.max(low, high) }
    }
  }

  const only = seconds(text)
  if (only === null) return { min: PLAY_MS, max: PLAY_MS }
  if (only <= 0) return OFF
  return { min: only, max: only }
}

/** One end of a span, in milliseconds, floored — or `null` if it is not a number at all. */
function seconds(text: string): number | null {
  const value = Number(text)
  if (!Number.isFinite(value)) return null
  if (value <= 0) return value
  return Math.max(PLAY_FLOOR_MS, value * 1000)
}

/** A fresh draw from a span. Exact when the span has no width, so `?play=30` means thirty. */
export function pickInterval(span: PlaySpan, rng: Rng): number {
  if (!span.max) return 0
  if (span.max === span.min) return span.min
  return span.min + rng() * (span.max - span.min)
}

/**
 * One lap of the wall in a shuffled order, as a permutation of its indices.
 *
 * **A shuffled lap rather than a random jump**, and the difference is the whole
 * point of asking for this. Picking uniformly at random each time repeats: on a
 * wall of twenty-four it shows the same scene twice running about one step in
 * twenty-four, and clusters visibly over an evening — which is *more* repetitive
 * than the fixed order it was meant to relieve, in the one way a viewer
 * actually notices. A lap shows every scene exactly once and then reshuffles,
 * the way a music player does.
 *
 * `after` is the entry currently on screen, kept out of the first position so
 * the seam between two laps is not the one place a repeat is allowed to happen.
 */
export function lap(length: number, rng: Rng, after = -1): number[] {
  const order = Array.from({ length }, (_, index) => index)
  for (let index = length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1))
    ;[order[index], order[swap]] = [order[swap]!, order[index]!]
  }
  if (length > 1 && order[0] === after) {
    const other = 1 + Math.floor(rng() * (length - 1))
    ;[order[0], order[other]] = [order[other]!, order[0]!]
  }
  return order
}

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
  const sceneName = root.querySelector<HTMLElement>(".placard .scene")
  const pieceName = root.querySelector<HTMLElement>(".placard .piece")
  const noteText = root.querySelector<HTMLElement>(".placard .note")
  const counter = root.querySelector<HTMLElement>(".counter")
  const trouble = root.querySelector<HTMLElement>(".trouble")
  const held = root.querySelector<HTMLElement>(".mark.held")
  const playing = root.querySelector<HTMLElement>(".mark.playing")

  let at = start
  let mounted: Mounted | null = null
  let canvas: HTMLCanvasElement | null = null
  let showing: WallEntry | null = null
  let paused = false
  /** How long each entry holds before the wall moves on. `max` of 0 is a wall that does not. */
  let span: PlaySpan = OFF
  /** Whether the wall plays its curated order or a shuffled lap of it. */
  let shuffling = false
  /**
   * The randomness, seeded once.
   *
   * **Seeded rather than `Math.random`**, for the reason `playwright.config.ts`
   * gives about the pieces: a failure has to be a real difference and not
   * weather. `?seed=7` pins the sequence, which is what lets a browser test
   * assert anything about a shuffled wall at all — and incidentally what lets a
   * run that looked good be run again.
   */
  let rng: Rng = makeRng(hashSeed(Date.now()))
  /** The lap in progress when shuffling, and how far into it the wall has got. */
  let order: number[] = []
  let orderAt = 0
  /** Bumped on every move, so a slow mount that lost the race cannot install itself. */
  let generation = 0

  const entry = () => wall[at]!

  // --- the mark in the middle ----------------------------------------------

  let markShowing: HTMLElement | null = null
  let markHoldTimer = 0
  let markGoneTimer = 0

  const putAway = (element: HTMLElement) => {
    element.hidden = true
    delete element.dataset.going
  }

  /**
   * Shows one mark, which then goes.
   *
   * **One slot and one timer pair for both**, so play and pause cannot be up at
   * once and a fast double-tap replaces the first mark rather than racing it —
   * the arrangement `gallery/reel.ts` arrived at for the same problem. Leaving
   * `hidden` restarts the transition for free, since `hidden` is `display:
   * none` and a re-shown element transitions from its initial state.
   */
  function flashMark(element: HTMLElement | null) {
    if (!element) return
    window.clearTimeout(markHoldTimer)
    window.clearTimeout(markGoneTimer)
    if (markShowing && markShowing !== element) putAway(markShowing)

    putAway(element)
    element.hidden = false
    markShowing = element

    markHoldTimer = window.setTimeout(() => {
      element.dataset.going = "true"
      markGoneTimer = window.setTimeout(() => {
        putAway(element)
        if (markShowing === element) markShowing = null
      }, MARK_GOING_MS)
    }, MARK_MS)
  }

  function clearMark() {
    window.clearTimeout(markHoldTimer)
    window.clearTimeout(markGoneTimer)
    if (markShowing) putAway(markShowing)
    markShowing = null
  }

  // --- the furniture, which is up only while somebody is moving -------------

  /**
   * Anything the wall drew over the piece: it takes its own taps, and it is
   * what the idle timer waits on when the pointer comes to rest on it.
   */
  const isFurniture = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("[data-showcase-furniture]"))

  /**
   * Pinned by `?idle=`, or `null` to let the timer decide.
   *
   * The kit's escape hatch, for the same reason it has one: furniture that
   * fades after two and a half seconds is a target a check has to race, and a
   * flaky check is worse than no check. `?idle=0` holds it up, `?idle=1` holds
   * it away. It lives in this closure rather than in the address because
   * moving along the wall is a `pushState` that rewrites the path.
   */
  let pinnedIdle: boolean | null = null
  let idleTimer = 0
  /** Where the pointer last was, so it is not taken away from under a cursor resting on it. */
  let overFurniture = false

  function setIdle(idle: boolean) {
    root.dataset.idle = String(idle)
  }

  /**
   * A sign of life. Everything comes back, and the clock starts again.
   *
   * **The timer does not run while the pointer rests on a control.** Idle
   * furniture takes no clicks, so fading a button out from under a stationary
   * cursor would turn the next click into a tap on the piece — which pauses it.
   * The kit holds off for the same reason, on the panel.
   */
  function goActive() {
    window.clearTimeout(idleTimer)
    if (pinnedIdle !== null) {
      setIdle(pinnedIdle)
      return
    }
    setIdle(false)
    if (overFurniture) return
    idleTimer = window.setTimeout(() => setIdle(true), IDLE_MS)
  }

  // --- the placard ---------------------------------------------------------

  /**
   * A scene has arrived: name it, wake the furniture, start its turn.
   *
   * All three hang off the same moment on purpose. A scene arriving is a sign
   * of life in its own right, so this wakes rather than being woken — otherwise
   * the name of a scene that took a second to load would get whatever was left
   * of a clock started before it, and the same goes for its turn on screen.
   */
  function say(shown: WallEntry) {
    if (sceneName) sceneName.textContent = shown.title
    if (pieceName) pieceName.textContent = shown.pieceTitle
    if (noteText) noteText.textContent = shown.note
    if (counter) counter.textContent = `${at + 1} / ${wall.length}`
    goActive()
    schedulePlay()
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
    // A fresh mount is running, so the readout has to say so. Setting the flag
    // without the attribute left the wall reading `data-paused="true"` over a
    // piece that was plainly moving — invisible in code and obvious on screen.
    paused = false
    root.dataset.paused = "false"
    root.dataset.state = "running"
    // A new scene arrives playing, so a mark left over from the previous one
    // would be describing a piece that is no longer on the screen.
    clearMark()
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
    // A wall left running steps past a dead runner instead of parking on the
    // card, which is autoplay paying for itself: the failure that needed
    // somebody to walk over and press an arrow now lasts one interval.
    schedulePlay()
  }

  /**
   * Fetches the neighbours' runners without mounting them.
   *
   * Evaluating a module is cheap; mounting is not. This is what makes crossing
   * into a new piece feel like a scene change rather than a page load, and it
   * is the whole of the "preload" idea — no second canvas, no second loop.
   *
   * **It asks where the wall is actually going**, which is not `at + 1` once
   * shuffling is on. Warming `at + 1` while playing a lap would prefetch a
   * runner nobody is about to want and leave the one that plays next cold — the
   * stutter between pieces that the prefetch exists to remove, restored by a
   * feature that never mentioned it. `peekNext()` is the same thing the timer
   * will use, so the two cannot drift.
   */
  async function prefetchNeighbours() {
    // A set, because the three overlap whenever the wall is in its plain order.
    for (const index of new Set([peekNext(), at + 1, at - 1])) {
      const neighbour = wall[index]
      if (neighbour) void load(runnerUrl(neighbour)).catch(() => {})
    }
  }

  // --- moving --------------------------------------------------------------

  /**
   * Moves the wall, and leaves the address alone unless a person moved it.
   *
   * **A wall playing itself writes no history at all**, and this is the third
   * answer to the same question rather than a refinement of the second. Pushing
   * piled up an entry every interval. Replacing fixed that and was still wrong,
   * for a reason no browser shows you: **on a kiosk the address is the
   * configuration, not a location.** A wrapper that enforces a start URL — or
   * an allow-list, or a "return home" rule — sees the rewrite as the page
   * navigating away and puts the configured URL back. The wall then plays for
   * one interval, tries to move, and is reset to the first entry. Forever, and
   * looking for all the world like the wall cannot navigate.
   *
   * So an automatic step changes the scene and nothing else. **A person moving
   * still pushes**, because that is navigation and the back button should
   * work — and it carries the query with it, so arrowing off a `?play` address
   * does not quietly switch autoplay off.
   *
   * What this gives up is that a reload during autoplay no longer lands on the
   * scene that was showing. That is the right trade the moment you ask what a
   * reload is *for* here: on a kiosk it is a restart, and what it should come
   * back to is the playlist it was configured with, not whichever scene
   * happened to be up.
   *
   * `"none"` is also the `popstate` case, where the history has already moved
   * and writing to it again would fight the browser.
   */
  function go(to: number, how: "push" | "none" = "push") {
    const clamped = Math.min(wall.length - 1, Math.max(0, to))
    if (clamped === at && showing) return
    at = clamped
    // The query is the wall's configuration and survives a move: `?play`,
    // `?shuffle`, `?seed` and `?idle` all have to outlive an arrow key.
    if (how === "push") history.pushState({ at }, "", `/showcase/${entry().id}/${location.search}`)
    document.title = `${entry().title} — Showcase`
    void show(entry())
  }

  function setPaused(next: boolean) {
    if (!mounted || next === paused) return
    paused = next
    mounted.setPaused(paused)
    root.dataset.paused = String(paused)
    flashMark(paused ? held : playing)
    goActive()
    // Holding the piece holds the wall. Looking at one frame is a thing a
    // gallery is for, and having it slide away in twenty seconds would make the
    // hold useless exactly when somebody is using it.
    schedulePlay()
  }

  // --- autoplay, for a screen nobody is standing at ------------------------

  /**
   * Stepping through the wall on a timer, for a kiosk.
   *
   * **The wrap belongs here and not to `go()`.** A person pressing ↓ on the
   * last entry should stop, because they asked for the next one and there is
   * not one; a wall left running should come round, because the alternative is
   * a screen showing the final scene until somebody walks over to it — which is
   * the bug this exists to fix, one entry later than the original.
   *
   * **The clock is per scene, not a metronome.** Every arrival reschedules, so
   * an entry that took two seconds to fetch still gets its full turn, and
   * pressing ↓ halfway through gives the next one a whole interval rather than
   * the remainder of this one.
   *
   * Nothing else restarts it. A mouse moving wakes the furniture and that is
   * feedback enough; a stray cursor on a kiosk should not be able to stall the
   * wall indefinitely.
   */
  let playTimer = 0

  /**
   * Where the wall goes next, without going there.
   *
   * The prefetch and the timer both need this and must agree, so there is one
   * of it. Refilling an exhausted lap here rather than at the moment of moving
   * is deliberate: it means the first entry of the next lap is warmed a whole
   * interval before it plays, exactly like any other.
   */
  function peekNext(): number {
    if (!shuffling) return (at + 1) % wall.length
    if (orderAt >= order.length) {
      order = lap(wall.length, rng, at)
      orderAt = 0
    }
    return order[orderAt]!
  }

  /**
   * The same, consumed.
   *
   * **The skip is not paranoia.** A person can navigate by hand into an entry
   * that is still ahead in the current lap, and that position then comes round
   * naming the scene already on screen. `go()` returns early on a move to where
   * it already is, so nothing would call `say()`, nothing would reschedule, and
   * the wall would stop for good — a hang rather than a glitch. One skip is
   * enough because a lap holds each index once; the fallback is there so this
   * can never be the thing that stops a kiosk.
   */
  function takeNext(): number {
    if (!shuffling) return (at + 1) % wall.length
    for (let tries = 0; tries < 2; tries++) {
      const next = peekNext()
      orderAt += 1
      if (next !== at) return next
    }
    return (at + 1) % wall.length
  }

  function schedulePlay() {
    window.clearTimeout(playTimer)
    // A held piece, a hidden tab and a wall of one all mean there is nothing to
    // count down to. The hidden-tab case matters most: the piece is already
    // paused there, and advancing invisibly would burn the wall for nobody.
    if (!span.max || paused || document.hidden || wall.length < 2) return
    // Drawn per scene rather than once, which is the whole of `?play=20-45`.
    playTimer = window.setTimeout(() => go(takeNext(), "none"), pickInterval(span, rng))
  }

  // --- the gesture ---------------------------------------------------------

  // --- showing it on a big screen ------------------------------------------

  /**
   * Fullscreen, and keeping the machine awake while in it.
   *
   * **Both belong to the showcase rather than to a piece.** A piece draws; how
   * it is presented is the room's business, exactly as play and pause are. The
   * builder has no equivalent and does not want one — there you are working on
   * a scene with a panel open, and the reason to go fullscreen is the reason
   * this surface exists.
   *
   * **The wake lock is tied to fullscreen rather than to playing**, which is
   * the conservative half of the choice. Every entry animates forever, so a
   * lock held whenever something is running would inhibit sleep for anyone who
   * merely left the tab open — rude, and not what was asked for. Entering
   * fullscreen is the unambiguous "I am showing this to a room" gesture, and it
   * is the one that should cost the battery.
   */
  let wakeLock: WakeLockSentinel | null = null

  async function holdWake() {
    // Not supported on every browser, and refused outright when the document is
    // not visible. Either way the showcase still works; it just will not stop
    // the screensaver, which is a degradation rather than a failure.
    if (wakeLock || !("wakeLock" in navigator)) return
    try {
      wakeLock = await navigator.wakeLock.request("screen")
      // The browser drops it on tab switch or lock without telling the caller
      // through any other channel, so the sentinel has to be forgotten here or
      // the next `holdWake` sees a live lock that is not live.
      wakeLock.addEventListener("release", () => {
        wakeLock = null
      })
    } catch {
      wakeLock = null
    }
  }

  async function dropWake() {
    const held = wakeLock
    wakeLock = null
    await held?.release().catch(() => {})
  }

  const isFullscreen = () => document.fullscreenElement !== null

  async function toggleFullscreen() {
    try {
      if (isFullscreen()) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch (error) {
      // Refused when the gesture was not user-initiated, and unavailable in
      // some embedded contexts. Nothing to recover: the wall is unchanged.
      console.warn("[showcase] fullscreen refused", error)
    }
  }

  document.addEventListener("fullscreenchange", () => {
    root.dataset.fullscreen = String(isFullscreen())
    if (isFullscreen()) void holdWake()
    else void dropWake()
    // Every piece re-measures on window resize and nothing else, and entering
    // fullscreen changes the viewport without always emitting one.
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))
  })

  // --- the gesture ---------------------------------------------------------

  let from: { x: number; y: number; at: number; id: number } | null = null
  let axis: Axis | null = null

  function onPointerDown(event: PointerEvent) {
    // A touch is the only sign of life a phone gives — there is no mousemove
    // there — so this wakes before the swipe guard rather than after it.
    goActive()
    if (from || isFurniture(event.target)) return
    from = { x: event.clientX, y: event.clientY, at: event.timeStamp, id: event.pointerId }
    axis = null
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

  // --- what counts as somebody being there ---------------------------------

  /**
   * A mouse moving is the whole of the desktop case, and the target it moves
   * over is how `goActive` knows whether a cursor has come to rest on a
   * control. Reading it here rather than from `pointerover`/`pointerout` keeps
   * the flag exactly as fresh as the last movement, with nothing to go stale.
   */
  window.addEventListener(
    "mousemove",
    (event) => {
      overFurniture = isFurniture(event.target)
      goActive()
    },
    { passive: true },
  )

  // Leaving the window is not resting on a button, whatever the last move said.
  root.addEventListener("mouseleave", () => {
    overFurniture = false
    goActive()
  })

  // Tabbing to a control has to bring it back, or the focus ring is the only
  // thing on screen and the button under it is invisible.
  window.addEventListener("focusin", () => goActive())

  // --- the keyboard, which is how this is looked at on a desktop -----------

  window.addEventListener("keydown", (event) => {
    // Before the chord guard: Cmd+Tab back into the window is somebody arriving,
    // even though it means nothing to the wall.
    goActive()
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
      case "f":
      case "F":
        event.preventDefault()
        void toggleFullscreen()
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
      goActive()
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

  const fullscreenToggle = root.querySelector<HTMLElement>("[data-fullscreen-toggle]")
  fullscreenToggle?.addEventListener("click", () => void toggleFullscreen())
  try {
    if (localStorage.getItem("showcase-framed") === "true") setFramed(true)
  } catch {
    // Same.
  }

  // --- behaving itself -----------------------------------------------------

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) mounted?.setPaused(true)
    else if (!paused) mounted?.setPaused(false)
    // The wall waits with the piece. Coming back to a tab that had quietly
    // walked nine entries on while nobody could see it is not a slideshow.
    schedulePlay()
    // A wake lock does not survive the tab being hidden — the browser releases
    // it and will not give it back on its own. Coming back to a fullscreen wall
    // that has quietly stopped holding the screen awake is the failure nobody
    // would notice until the screensaver arrived mid-showing.
    if (!document.hidden && isFullscreen()) void holdWake()
  })

  window.addEventListener("popstate", (event) => {
    const state = event.state as { at?: number } | null
    if (typeof state?.at === "number") go(state.at, "none")
  })

  // --- boot ----------------------------------------------------------------

  // Read before the path is rewritten below, which is what drops the query.
  const params = new URLSearchParams(location.search)
  const asked = params.get("idle")
  if (asked !== null) pinnedIdle = asked !== "0"
  span = playSpan(params.get("play"))

  /*
   * The shuffle, and the seed under it.
   *
   * **Shuffling is opt-in and the curated order stays the default.** `wall.ts`
   * is hand-ordered and nothing regenerates it; a `?play` address somebody
   * already has should keep meaning what it meant yesterday. `?shuffle` is one
   * word to add for a kiosk, which is the only place the order was ever the
   * problem.
   *
   * The seed is the clock unless `?seed=` says otherwise, so two kiosks side by
   * side do not play in step — and so one sequence can be asked for again.
   * `hashSeed` rather than the raw value because mulberry32 takes the low bits
   * of what it is given, and `?seed=1` beside `?seed=2` should be two different
   * walls rather than two walks through nearly the same one.
   */
  const shuffleAsked = params.get("shuffle")
  shuffling = shuffleAsked !== null && shuffleAsked !== "0"
  const seedAsked = Number(params.get("seed"))
  rng = makeRng(hashSeed(Number.isFinite(seedAsked) && params.get("seed") !== null ? seedAsked : Date.now()))

  /*
   * Seeds `history.state` so `popstate` has an index to read, and **leaves the
   * address exactly as it was given**.
   *
   * It used to pass `location.pathname`, which quietly deleted the query on the
   * first frame. Harmless-looking, and two real faults: the address bar read
   * `/showcase/` a moment after you typed `/showcase/?play=20-45&shuffle`,
   * which looks precisely like a redirect that ate your parameters — and a
   * reload then came back with autoplay off, so a kiosk that restarts for any
   * reason silently reverts to one frozen scene.
   *
   * Omitting the URL argument is the documented way to change the state
   * without touching the address, and it is the only form that leaves a kiosk's
   * configured URL intact.
   */
  history.replaceState({ at }, "")
  goActive()
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
