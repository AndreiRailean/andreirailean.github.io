/**
 * The scene: a canvas, a clock, a crowd, and one person walking through it.
 *
 * Everything interesting is in the modules this composes — `throng.ts` for who
 * is out there, `steering.ts` for why they miss each other, `stroll.ts` for the
 * person the camera belongs to, `body.ts` for what a person is, `camera.ts` for
 * how a head reaches the glass, `draw.ts` for what it looks like when it gets
 * there. What is left here is the three things that are genuinely about running
 * it:
 *
 * ## The simulation runs on a fixed step
 *
 * Avoidance is stiff — the force between two people closing at speed goes as
 * `1/τ²` — and a frame long enough for `τ` to change materially inside it
 * overshoots, which reads as a flinch. So the clock is accumulated and drained
 * in fixed 1/120 s steps whatever the display is doing. Four steps is the
 * ceiling per frame: a tab coming back from the background must not try to catch
 * up on a minute of walking.
 *
 * ## The observer steps first, and reads the crowd from the last step
 *
 * `stroll.step` needs neighbours, which come from the spatial hash `throng.step`
 * rebuilds — so one of them is a step behind. It is the observer, and the
 * staleness is one 1/120 s tick, which is under a centimetre of anybody's
 * movement. Doing it the other way round would mean rebuilding the hash twice.
 *
 * ## Playback is applied in exactly one place
 *
 * The step handed to the two `step` calls. Everything time-dependent — my
 * stride, the crowd's, the looking, the stopping — is integrated through it, so
 * half speed is the same walk watched slowly rather than a slower walk.
 *
 * ## Reduced motion gets a still, and it is a still of a walk already happening
 *
 * Not the first frame. At `t = 0` the observer is standing in a crowd that has
 * been placed and has not yet sorted itself out — nobody has negotiated
 * anything, no files have formed, and half the frame is people at exactly their
 * preferred speed on exactly their preferred heading. So the still is taken
 * after the walk has been going a while, which is also what the poster recipe
 * and the note's backdrop want and for the same reason.
 */

import { makeCamera, type Camera } from "@/experiments/crowd/camera"
import { drawFrame, makeScratch, type Scratch } from "@/experiments/crowd/draw"
import { createStroll, type Stroll } from "@/experiments/crowd/stroll"
import { createThrong, MAX_PEOPLE, type Throng, type ThrongStats } from "@/experiments/crowd/throng"
import { needsRecast, needsRestock, type Settings } from "@/experiments/crowd/settings"

export type CrowdStats = ThrongStats & {
  /** Where I am and what I am doing. */
  me: { x: number; y: number; yaw: number; course: number; speed: number; walking: boolean; stature: number }
  /**
   * Heads that reached the glass last frame.
   *
   * **Filled during the draw, not computed in `stats()`.** So it is stale until
   * a frame has run, which matters to a check reading it straight after a
   * `set()` — see the frame-wait note in `tests/AGENTS.md`. Everything else in
   * this object is computed when it is asked for and has no such window.
   */
  drawn: number
  /** How many `fill()` calls the batching cost last frame. The whole point of the batching. */
  fills: number
  /** Screen radius of the nearest head drawn, in CSS pixels. */
  largest: number
  /**
   * Milliseconds the last frame spent drawing, as a rolling average.
   *
   * Here because `fps` cannot answer the only question worth asking about the
   * draw. A frame loop is capped by the display, so a piece drawing in 1 ms and
   * a piece drawing in 10 both report 60 — and "is the frame the simulation or
   * the paint" is not a question anybody can settle by looking.
   *
   * Filled while drawing, like `drawn`, `fills` and `largest`.
   */
  drawMs: number
  /** The ceiling on the population, so a reader can tell a budgeted world from a fogged one. */
  budget: number
  /** Rolling average, so a heavy setting shows up as a number. */
  fps: number
  /**
   * Whether the frame loop is going.
   *
   * False under `prefers-reduced-motion`, which gets one still and no loop — an
   * invariant no screenshot can show, because a held crowd and a walking one
   * look identical in a photograph.
   */
  running: boolean
}

export type Crowd = {
  setSettings: (settings: Settings) => void
  stats: () => CrowdStats
  start: () => void
  stop: () => void
  /** Park the frame, or let it run on. Not `stop`, which is teardown. */
  setPaused: (paused: boolean) => void
  /** Run the walk forward without drawing it. Seconds. */
  settle: (seconds: number) => void
  destroy: () => void
}

/** Seconds. Small enough that the stiffest interaction stays stable. */
const STEP = 1 / 120

/** Never catch up on more than this in one frame. */
const MAX_STEPS = 4

/** The longest any one `settle` will run, in seconds of walk. */
const MAX_SETTLE = 600

/**
 * How long the walk is run before a reduced-motion still is taken.
 *
 * **Short, and it used to be twenty-five.** A settle is synchronous — it is
 * wall-clock a visitor waits with a blank page — and it costs about a third of a
 * second per second of walk at a market's density, so twenty-five seconds was an
 * eight-second freeze on a page load, for the one audience that has asked for
 * less rather than more.
 *
 * It is short because `throng.ts` now places nobody inside anybody, which is
 * most of what the long settle was buying: what was left was the crowd sorting
 * out a few dozen opening overlaps in full view. What a settle still buys is
 * structure — files, squeezed groups — and **a still cannot show structure that
 * is defined by motion.** Two seconds is enough to take the edge off the
 * placement and nothing beyond it is visible in one frame.
 */
const STILL_SECONDS = 2

function require2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Crowd: no 2d context")
  return context
}

export function createCrowd(canvas: HTMLCanvasElement, initial: Settings): Crowd {
  const context = require2d(canvas)
  const stillOnly = window.matchMedia("(prefers-reduced-motion: reduce)")

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1

  let me: Stroll = createStroll(settings, settings.seed)
  let crowd: Throng = createThrong(settings, me)

  const scratch: Scratch = makeScratch()

  let frame = 0
  let running = false
  let previous = 0
  let carry = 0
  let fps = 0
  let drawn = 0
  let fills = 0
  let largest = 0
  let drawMs = 0
  /** Set when the picture needs repainting without anybody having moved. */
  let dirty = true

  const isAnimated = () => !stillOnly.matches && settings.playback > 0

  function resize(): void {
    const nextWidth = canvas.clientWidth || window.innerWidth
    const nextHeight = canvas.clientHeight || window.innerHeight
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2)
    if (nextWidth === width && nextHeight === height && nextDpr === dpr) return

    width = nextWidth
    height = nextHeight
    dpr = nextDpr
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }

  /**
   * The eye, where it is this instant.
   *
   * The sway is lateral in the **body's** frame rather than the head's: it comes
   * from the weight going over one foot and then the other, and turning to look
   * at somebody does not change which foot you are on. Getting that wrong is
   * invisible until the head is turned ninety degrees, at which point the sway
   * becomes a lurch forward and back.
   */
  function eyeCamera(): Camera {
    const { z, sway } = me.eye()
    const right = me.course - Math.PI / 2
    return makeCamera(
      me.x + Math.cos(right) * sway,
      me.y + Math.sin(right) * sway,
      z,
      me.yaw,
      (settings.pitch * Math.PI) / 180,
      settings.fov,
      settings.fade,
      width,
      height,
    )
  }

  function draw(): void {
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    const started = performance.now()
    const result = drawFrame(context, {
      people: crowd.people,
      camera: eyeCamera(),
      settings,
      width,
      height,
      scratch,
    })
    drawMs += (performance.now() - started - drawMs) * 0.1
    drawn = result.drawn
    fills = result.fills
    largest = result.largest
  }

  /** One tick of the world. The observer first — see the docblock. */
  function advance(dt: number): void {
    me.step(dt, crowd)
    crowd.step(dt)
  }

  /**
   * Run the walk forward without drawing it.
   *
   * **Not the same ceiling as the frame loop's.** `MAX_STEPS` exists so a tab
   * returning from the background does not catch up on a minute of walking;
   * this is somebody deliberately asking for a minute of walking. Reusing that
   * ceiling here is a live failure in this section's history — a `settle(120)`
   * silently capped at an eighth of a second, with nothing to show for it and
   * nothing that errored.
   */
  function runForward(seconds: number): void {
    const total = Math.max(0, Math.min(MAX_SETTLE, seconds))
    const steps = Math.round(total / STEP)
    for (let i = 0; i < steps; i++) advance(STEP)
  }

  function tick(now: number): void {
    frame = requestAnimationFrame(tick)

    const elapsed = previous === 0 ? 0 : Math.min(0.25, (now - previous) / 1000)
    previous = now
    if (elapsed > 0) fps += (1 / elapsed - fps) * 0.1

    if (isAnimated()) {
      carry += elapsed * settings.playback
      let steps = 0
      while (carry >= STEP && steps < MAX_STEPS) {
        advance(STEP)
        carry -= STEP
        steps++
      }
      // Whatever is left after the ceiling is dropped rather than banked: a tab
      // coming back should resume, not fast-forward.
      if (steps === MAX_STEPS) carry = 0
      draw()
      dirty = false
      return
    }

    // Everything that changes the picture without anybody moving: a resize, a
    // colour, a field of view. Without this the loop parks and the canvas keeps
    // whatever was last on it — and setting `canvas.width` on a resize clears
    // it, so the piece would simply vanish when the window changed size.
    if (dirty) {
      dirty = false
      draw()
      return
    }

    cancelAnimationFrame(frame)
    frame = 0
    running = false
  }

  function wake(): void {
    dirty = true
    if (running) return
    running = true
    previous = 0
    frame = requestAnimationFrame(tick)
  }

  const onResize = () => {
    resize()
    wake()
  }

  window.addEventListener("resize", onResize)
  stillOnly.addEventListener("change", wake)

  function teardown(): void {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    running = false
    window.removeEventListener("resize", onResize)
    stillOnly.removeEventListener("change", wake)
  }

  return {
    start() {
      resize()
      // A still of a walk that is already happening, not of the moment before
      // anybody has negotiated anything.
      if (!isAnimated()) runForward(STILL_SECONDS)
      draw()
      wake()
    },

    stop: teardown,

    setPaused(paused) {
      if (!paused) {
        wake()
        return
      }
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
    },

    settle(seconds) {
      runForward(seconds)
      dirty = true
      wake()
    },

    setSettings(next) {
      const before = settings
      settings = next

      if (needsRecast(before, settings)) {
        me = createStroll(settings, settings.seed)
        crowd = createThrong(settings, me)
      } else {
        me.resettle(settings)
        crowd.resettle(settings)
        if (needsRestock(before, settings)) crowd.restock(settings)
      }

      wake()
    },

    stats() {
      return {
        ...crowd.stats(),
        me: me.stats(),
        drawn,
        fills,
        largest,
        drawMs,
        budget: MAX_PEOPLE,
        fps,
        running,
      }
    },

    destroy: teardown,
  }
}
