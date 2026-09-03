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

import { createCrowd, type Crowd, type CrowdStats } from "@/experiments/walkers/crowd"
import {
  drawDebug,
  drawFrame,
  makeShadowBuffer,
  makeTrailBuffer,
  paintGround,
  type Layers,
} from "@/experiments/walkers/draw"
import { groundOf, type Ground } from "@/experiments/walkers/palette"
import { needsRecast, needsRemeasure, type Settings } from "@/experiments/walkers/settings"
import { makeSun, makeView, type Sun, type View } from "@/experiments/walkers/view"

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

/** How long the crowd is run before a reduced-motion still is taken. */
const STILL_SECONDS = 12

function require2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Walkers: no 2d context")
  return context
}

export function createWalkers(canvas: HTMLCanvasElement, initial: Settings): Walkers {
  const context = require2d(canvas)
  const stillOnly = window.matchMedia("(prefers-reduced-motion: reduce)")

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1

  let view: View = makeView(settings.span, settings.camera, 1, 1)
  let sun: Sun = makeSun(settings.sunAzimuth, settings.sun)
  let ground: Ground = groundOf(settings, sun)

  const layers: Layers = { ground: null, shadow: null, trail: null }

  /** Where the clock was when the last frame was drawn, for the trail's decay. */
  let drawnAt = 0

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
  let crowd: Crowd = createCrowd({ view, settings, sun })

  let frame = 0
  let running = false
  let previous = 0
  let carry = 0
  let fps = 0
  let heads = 0
  let debug = false
  /** Set when the picture needs repainting without anything having moved. */
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

    remeasure()
    layers.ground = null
    layers.shadow = makeShadowBuffer(width, height)
    layers.trail = makeTrailBuffer(width, height)
  }

  function remeasure(): void {
    // The margin has to clear the longest shadow, or somebody still outside the
    // frame throws one into it with nobody attached to it.
    const margin = 3 + settings.camera * 0.02 + sun.reach * 2.2
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
      sun,
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
    const steps = Math.round(Math.max(0, Math.min(600, seconds)) / STEP)
    for (let step = 0; step < steps; step++) crowd.step(STEP)
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
        crowd.step(STEP)
        carry -= STEP
        steps++
      }
      // Whatever is left over after the ceiling is dropped rather than banked:
      // a tab returning from the background should resume, not fast-forward.
      if (steps === MAX_STEPS) carry = 0
      draw()
      dirty = false
      return
    }

    // Everything that changes the picture without the crowd moving: a resize, a
    // colour, the overlay. Without this the loop parks and the canvas keeps
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
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
      window.removeEventListener("resize", onResize)
      stillOnly.removeEventListener("change", wake)
    },

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
      advance(Math.max(0, Math.min(600, seconds)))
      dirty = true
      wake()
    },

    setDebug(on) {
      debug = on
      dirty = true
      wake()
    },

    setSettings(next) {
      const before = settings
      settings = next

      sun = makeSun(settings.sunAzimuth, settings.sun)
      ground = groundOf(settings, sun)

      if (needsRecast(before, settings)) {
        crowd = createCrowd({ view, settings, sun })
        remeasure()
        crowd.fill()
        // A new cast has not walked anywhere yet, so the ground should not
        // remember the old one having done so.
        if (layers.trail) layers.trail = makeTrailBuffer(width, height)
      } else if (needsRemeasure(before, settings)) {
        remeasure()
      } else {
        crowd.remeasure(view, settings)
      }

      crowd.recolour(settings, sun)

      // The ground bakes its colour and its blotches, so any of those moving
      // means repainting it — and nothing else does.
      if (
        before.hue !== settings.hue ||
        before.tint !== settings.tint ||
        before.dusk !== settings.dusk ||
        before.seed !== settings.seed ||
        before.sun !== settings.sun ||
        before.shadow !== settings.shadow
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
        fps,
        running,
      }
    },

    destroy() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
      window.removeEventListener("resize", onResize)
      stillOnly.removeEventListener("change", wake)
    },
  }
}
