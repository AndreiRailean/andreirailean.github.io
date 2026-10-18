/**
 * The scene: a canvas, a clock, and a crowd on the ground under it.
 *
 * Everything interesting is in the modules this composes — `crowd.ts` for what
 * people do, `steering.ts` for why they miss each other, `body.ts` for what a
 * person is, `draw.ts` for what reaches the glass. What is left here is the
 * three things that are genuinely about running it:
 *
 * ## The simulation runs on a fixed step
 *
 * Avoidance is stiff: the force between two people closing at speed goes as
 * 1/τ³, and a frame long enough for τ to change materially inside it produces an
 * overshoot that reads as a flinch. So the clock is accumulated and drained in
 * fixed 1/120 s steps whatever the display is doing, and the frame is drawn
 * wherever the last one left off. Four steps is the ceiling per frame — a tab
 * coming back from the background must not try to catch up on a minute of park.
 *
 * ## Reduced motion gets a still, and it is a *populated* still
 *
 * Not an empty field. The crowd is built and run forward for a few seconds
 * before the single frame is drawn, so what a visitor who has asked for no
 * animation gets is a photograph of a park rather than a picture of the moment
 * before anyone arrived.
 *
 * ## Playback is applied in exactly one place
 *
 * The step handed to `crowd.step`. Everything time-dependent in the piece —
 * gait, gaze, play, the rate people arrive — is integrated through it or reads
 * the clock it advances, so half speed is the same afternoon watched slowly
 * rather than a different afternoon.
 */

import { context2d, fitCanvas } from "@/experiments/simulation/canvas"
import { parkingLoop, settleSeconds } from "@/experiments/simulation/loop"
import { createCrowd, type Crowd, type CrowdStats } from "@/experiments/walkers/crowd"
import { drawDebug, drawFrame, makeTrail, paintGround, paintTrails, type Layers } from "@/experiments/walkers/draw"
import { groundOf, type Ground } from "@/experiments/walkers/palette"
import { needsRecast, needsRemeasure, type Settings } from "@/experiments/walkers/settings"
import { makeView, type View } from "@/experiments/walkers/view"

export type WalkersStats = CrowdStats & {
  /**
   * Seconds of park that have been simulated.
   *
   * The only exact read of whether time is passing, and the reason it is here:
   * `settle` was once silently capped at an eighth of a second and *nothing*
   * could tell. Every other number in this object is a property of a crowd, and
   * a crowd that has not moved looks exactly like one that has.
   */
  clock: number
  /** Heads actually drawn last frame. */
  heads: number
  /** Square metres of ground in frame. Density is quoted against this. */
  area: number
  /**
   * The camera height, in metres, that the last frame was projected from.
   *
   * Read off the view the renderer was handed rather than off the settings, so
   * it says the setting reached the picture. Where a head lands for a given
   * height is `placeHeads`'s, and is tested there; a pixel reading cannot stand
   * in for this one, because the height also sets the world's margin and so the
   * cast, and a different crowd differs on the glass whatever the lens did.
   */
  camera: number
  /** Rolling average, so a heavy setting shows up as a number. */
  fps: number
  /**
   * Whether the RAF loop is going.
   *
   * False under `prefers-reduced-motion`, which gets one populated still and no
   * loop — an invariant no screenshot can show, because a still park and a
   * running one look identical in a photograph.
   */
  running: boolean
}

export type Walkers = {
  setSettings: (settings: Settings) => void
  stats: () => WalkersStats
  start: () => void
  stop: () => void
  /** Park the frame, or let it run on. Not `stop`, which is teardown. */
  setPaused: (paused: boolean) => void
  /** Run the simulation forward without drawing. Seconds of park. */
  settle: (seconds: number) => void
  setDebug: (on: boolean) => void
  destroy: () => void
}

/** Seconds. Small enough that the stiffest interaction stays stable. */
const STEP = 1 / 120

/** Never catch up on more than this in one frame. */
const MAX_STEPS = 4

/**
 * How much of a settle the ground is made to remember, in time constants.
 *
 * A `settle` runs the crowd forward without drawing, and the trail is drawn
 * rather than simulated, so a settled park used to arrive on perfectly clean
 * ground — which was fine while every preset that mattered had `traces` at
 * zero, and stopped being fine the moment the primary was a scene with nothing
 * in it *but* traces. The poster, the note's backdrop and the one frame a
 * reduced-motion visitor gets are all stills of a settled park, and all three
 * came out as bare ground with a few one-second stubs on it.
 *
 * Four time constants is where a mark is down to under two per cent — the
 * residue the fade leaves anyway — so warming for longer would add nothing
 * anyone can see.
 */
const TRACE_WARM = 4

/**
 * Piece seconds between trail passes while warming.
 *
 * `DEPOSIT` is a rate, so a coarser pass lays proportionally more and the ink
 * per second comes out the same either way. What does not survive coarsening
 * is the *spacing*: a walker covers 5 cm between passes at this rate against a
 * mark 20 cm across, and a runner 13 cm, so the marks still overlap into a
 * line. At a quarter of a second they do not, and the trail comes out as
 * dotted lines nobody drew.
 */
const TRACE_PASS = 1 / 24

/**
 * The most warming any one settle will do, in seconds.
 *
 * It is wall-clock the visitor waits for — a landing under reduced motion runs
 * this before it can paint. A 6-second trail wants 24 and is under the cap; a
 * 42-second one wants 168, gets 30, and comes out thinner than the same scene
 * running. Thin is a fair trade for a page that paints; gappy is not, which is
 * why the cap shortens the window rather than coarsening the pass.
 */
const MAX_WARM = 30

/** How long the crowd is run before a reduced-motion still is taken. */
const STILL_SECONDS = 12

export function createWalkers(canvas: HTMLCanvasElement, initial: Settings): Walkers {
  const context = context2d(canvas, "Walkers")
  const stillOnly = window.matchMedia("(prefers-reduced-motion: reduce)")

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1

  let view: View = makeView(settings.span, settings.camera, 1, 1)
  let ground: Ground = groundOf(settings)

  const layers: Layers = { ground: null, trail: null }

  /** Where the clock was when the last frame was drawn, for the trail's decay. */
  let drawnAt = 0
  /** The camera height the last frame was projected from. Zero until one is. */
  let drawnFrom = 0

  /**
   * Built here, but **not populated here.**
   *
   * A canvas has no size until it is in the document and measured, so the view
   * above is a placeholder — and populating against it puts the whole opening
   * crowd inside a few square metres at the centre of the frame, which then
   * spends the next minute dispersing. It looked like a bug in the spawner and
   * was a bug in the order of two lines. `start()` measures first and fills
   * after.
   */
  let crowd: Crowd = createCrowd({ view, settings })

  let carry = 0
  let heads = 0
  let debug = false

  const isAnimated = () => !stillOnly.matches

  function resize(): void {
    const next = fitCanvas(canvas, { width, height, dpr })
    if (!next) return
    ;({ width, height, dpr } = next)

    remeasure()
    layers.ground = null
    layers.trail = makeTrail(width, height)
  }

  function remeasure(): void {
    // Far enough out that nobody is seen to appear, and that the population
    // controller has a pipeline to count: `arrivalHorizon` is derived from this,
    // so it sets how long somebody spends walking in. A share of the span, since
    // that is what decides how far "out of shot" has to be — it used to carry a
    // term for the longest shadow, which is what set it while there was a sun.
    //
    // **A twelfth of the span, not a third.** The margin is a border around the
    // frame, so its cost is quadratic in itself: at span 14 a third took the
    // world from 4.2 m of margin to 7.6, which is four times the ground and four
    // times the people simulated to show the same picture — the opening cast is
    // scattered across the whole world, not the frame. The browser spec's
    // densest case went from comfortable to 56 seconds against a 60-second
    // timeout, which is how it was noticed. A twelfth lands within a metre of
    // what the old rule gave a scene with an ordinary sun in it.
    const margin = 3 + settings.camera * 0.02 + settings.span * 0.12
    view = makeView(settings.span, settings.camera, width || 1, height || 1, margin)
    crowd.remeasure(view, settings)
  }

  function draw(): void {
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (!layers.ground && width > 0) {
      layers.ground = paintGround(width, height, dpr, ground, settings.seed)
    }

    heads = drawFrame(context, {
      walkers: crowd.walkers,
      view,
      settings,
      ground,
      layers,
      clock: crowd.clock,
      // Capped. A `settle` advances the crowd without drawing, so the next
      // frame's gap is however many minutes were asked for — and the ground's
      // memory would be wiped by its own decay in one step. Capping it means a
      // settled scene simply starts its traces from now, which is honest: the
      // ground has not seen anybody walk over it yet.
      elapsed: Math.max(0, Math.min(0.5, crowd.clock - drawnAt)),
      width,
      height,
    })

    drawnAt = crowd.clock
    drawnFrom = view.camera

    if (debug) drawDebug(context, crowd.walkers, crowd.groups, view)
  }

  /**
   * Run the simulation forward without drawing, for a stated number of seconds.
   *
   * **Not the same ceiling as the frame loop's.** `MAX_STEPS` exists so a tab
   * coming back from the background does not try to catch up on a minute of
   * park; this is somebody deliberately asking for a minute of park. The first
   * version reused that ceiling and quietly capped every call at sixteen steps
   * — an eighth of a second — so the poster recipe's `settle(120)` did nothing
   * at all, every still was of a crowd that had barely started arriving, and the
   * frames looked half as busy as the density said they were. Nothing errored
   * and nothing looked broken; it just was.
   */
  function advance(seconds: number): void {
    const total = settleSeconds(seconds)
    const steps = Math.round(total / STEP)

    // The last stretch of it is walked over the trail as well as simulated, so
    // that a still of a settled park is a still of ground somebody has crossed.
    // See `TRACE_WARM`. Everything before the window is left undrawn because it
    // has already faded — the saving is the whole reason there is a window.
    const warming = layers.trail !== null && settings.traces > 0 && width > 0
    const warm = warming ? Math.min(total, settings.traces * TRACE_WARM, MAX_WARM) : 0
    const from = steps - Math.round(warm / STEP)
    const every = Math.max(1, Math.round(TRACE_PASS / STEP))

    for (let step = 0; step < steps; step++) {
      crowd.step(STEP)
      // Counted back from the end, so the final step always lays a mark and the
      // crowd is standing on its own last footprints.
      if (layers.trail && step >= from && (steps - 1 - step) % every === 0) {
        paintTrails(layers.trail, crowd.walkers, view, settings, every * STEP)
      }
    }

    // The next frame is a continuation of this, not a jump: without it the draw
    // loop reads a gap of however long the settle was and fades the ground it
    // has just been given.
    drawnAt = crowd.clock
  }

  const loop = parkingLoop({
    clamp: 0.25,
    frame(elapsed) {
      if (!isAnimated()) return "idle"
      carry += elapsed * settings.timescale
      let steps = 0
      while (carry >= STEP && steps < MAX_STEPS) {
        crowd.step(STEP)
        carry -= STEP
        steps++
      }
      // Whatever is left over after the ceiling is dropped rather than banked:
      // a tab returning from the background should resume, not fast-forward.
      if (steps === MAX_STEPS) carry = 0
      return "moved"
    },
    draw,
  })
  const wake = loop.wake

  const onResize = () => {
    resize()
    wake()
  }

  window.addEventListener("resize", onResize)
  stillOnly.addEventListener("change", wake)

  return {
    start() {
      resize()
      if (crowd.walkers.length === 0) crowd.fill()
      // A still gets a park that has been going a while rather than one that
      // has just been switched on.
      if (!isAnimated()) advance(STILL_SECONDS)
      draw()
      wake()
    },

    stop() {
      loop.hold()
      window.removeEventListener("resize", onResize)
      stillOnly.removeEventListener("change", wake)
    },

    setPaused(paused) {
      if (!paused) {
        wake()
        return
      }
      loop.hold()
    },

    settle(seconds) {
      advance(settleSeconds(seconds))
      wake()
    },

    setDebug(on) {
      debug = on
      wake()
    },

    setSettings(next) {
      const before = settings
      settings = next

      ground = groundOf(settings)

      if (needsRecast(before, settings)) {
        crowd = createCrowd({ view, settings })
        remeasure()
        crowd.fill()
        // A new cast has not walked anywhere yet, so the ground should not
        // remember the old one having done so.
        if (layers.trail) layers.trail = makeTrail(width, height)
      } else if (needsRemeasure(before, settings)) {
        remeasure()
      } else {
        crowd.remeasure(view, settings)
      }

      crowd.recolour(settings)

      // The ground bakes its colour and its blotches, so any of those moving
      // means repainting it — and nothing else does.
      if (
        before.hue !== settings.hue ||
        before.tint !== settings.tint ||
        before.dusk !== settings.dusk ||
        before.seed !== settings.seed
      ) {
        layers.ground = null
      }

      wake()
    },

    stats() {
      return {
        ...crowd.stats(),
        clock: crowd.clock,
        heads,
        area: view.area,
        camera: drawnFrom,
        fps: loop.fps(),
        running: loop.running(),
      }
    },

    destroy() {
      loop.hold()
      window.removeEventListener("resize", onResize)
      stillOnly.removeEventListener("change", wake)
    },
  }
}
