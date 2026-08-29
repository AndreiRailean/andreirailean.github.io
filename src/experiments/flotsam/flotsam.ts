/**
 * The engine: canvas, the clock, and everything drawn on it.
 *
 * Holds the sea, the current and the flotsam together and decides what a
 * settings change costs. The three are rebuilt independently, because they
 * change on different occasions: turning up the steepness rebuilds the waves and
 * leaves every piece where the current has taken it, and changing a colour
 * rebuilds the population without disturbing the water.
 *
 * ## What moves, and what only appears to
 *
 * Each piece of flotsam owns a *rest position* — the parcel of water it is
 * sitting on — and that is the only thing this file ever integrates. Where it is
 * drawn is the rest position plus the wave displacement, which is a pure
 * function of that position and the clock and is recomputed from scratch every
 * frame.
 *
 * That split is the piece. Waves cannot accumulate, so a sea of any violence
 * leaves the flotsam exactly where it found it; currents can, so a drift of a
 * few centimetres a second empties the frame. There is no integration error to
 * creep in, no reason for anything to escape, and `transport` and `orbit` in the
 * stats are the two halves of it, separately measurable.
 */

import { createCurrent, currentAt, type Current } from "@/experiments/flotsam/current"
import { GROUND, VIGNETTE } from "@/experiments/flotsam/palette"
import { createScatter, tune, type Scatter } from "@/experiments/flotsam/scatter"
import { createSpecks, type Specks } from "@/experiments/flotsam/specks"
import { needsScatter, needsSea, type Settings } from "@/experiments/flotsam/settings"
import { makeView, screenX, screenY, worldX, worldY, wrap, type View } from "@/experiments/flotsam/view"
import {
  createSea,
  heading,
  jacobian,
  sample,
  gustSea,
  HEIGHT,
  OFFSET_X,
  OFFSET_Y,
  SAMPLE_SIZE,
  SLOPE_X,
  SLOPE_Y,
  type Sea,
} from "@/experiments/flotsam/waves"

export type FlotsamStats = {
  dots: number
  /** Wave trains in the sea. */
  trains: number
  /** Σ Aₙkₙ, the sea's total steepness. 1 is where the water folds. */
  steepness: number
  /**
   * Smallest area-compression factor found anywhere on the patch this frame.
   *
   * Below 1 the flotsam is being gathered, and **at or below 0 the displacement
   * map has folded** and the sea is inside out. A still cannot tell the two
   * apart; this is the piece's equivalent of Dangler's constraint error.
   */
  minJacobian: number
  /**
   * Index of dispersion of the flotsam over a grid of the frame: the variance of
   * the per-cell counts divided by their mean.
   *
   * 1 is a uniform random scatter, which is exactly where the piece starts,
   * because that is how the homes are drawn. Above 1 is clustered. **This is the
   * number that says the waves are gathering the flotsam into lines**, and no
   * screenshot can be made to say it.
   *
   * It reads gathering coarser than a cell and is blind to anything finer, which
   * is worth knowing before trusting a low number: a wave shorter than about
   * four crests to the frame compresses the water just as hard and barely moves
   * this at all.
   */
  dispersion: number
  /** RMS wave displacement across the population, in metres. What swinging costs. */
  orbit: number
  /** Mean speed of the rest positions, in m/s. What actually takes flotsam away. */
  transport: number
  /** Pieces that reached the canvas this frame. */
  drawnDots: number
  /** Summed sprite area drawn this frame, in css px². The real cost model. */
  fillPx: number
  /**
   * How much light the scene is making, as alpha-weighted sprite area over the
   * area of the canvas.
   *
   * 1 is a frame's worth of fully-lit pixels, spread however it happens to be
   * spread. **No single control owns this** — the count, both ends of the size
   * range, the size mix, the gleam and the exposure all move it, which is
   * exactly why it is worth reporting: judging "too bright" by eye means judging
   * it on one monitor in one room, and every other way of dimming a scene also
   * empties, narrows or flattens it.
   */
  light: number
  /** Seconds of sea simulated since the piece opened. */
  clock: number
  fps: number
  /** False when the loop has parked itself because nothing is moving. */
  running: boolean
}

export type Flotsam = {
  start: () => void
  stop: () => void
  setSettings: (next: Settings) => void
  /** Advance the sea by this many seconds at once, then redraw. */
  run: (seconds: number) => void
  stats: () => FlotsamStats
  /** Draw the wave crests and the current, which the piece never shows. */
  setDebug: (on: boolean) => void
}

/**
 * Sharpness of the specular lobe.
 *
 * Sets how wide the glitter path is. Low and every piece glints faintly all the
 * time, which reads as fog rather than water; high and only the few pieces at
 * exactly the mirror angle light up, which reads as sparks. Twenty is about
 * where the bands become bands.
 */
const SHINE = 20

/** What a piece keeps when it is turned away from the light, and its peak gain. */
const GLINT_FLOOR = 0.45
const GLINT_GAIN = 2.6

/** Largest halo a glinting piece may bloom to, as a multiple of `gleam`. */
const MAX_BLOOM = 2

/** Fixed step `run()` advances in. Small enough that a fast current is smooth. */
const RUN_STEP = 1 / 60

/** Ceiling on `run()`, so a mistyped argument cannot lock the tab up. */
const MAX_RUN_STEPS = 60_000

/** Grid the dispersion statistic is measured on. Cells, not pixels. */
const GRID_X = 40
const GRID_Y = 24

/** Lattice the Jacobian is sampled on. Coarse: it is looking for a fold, not a value. */
const PROBE_X = 25
const PROBE_Y = 15

/**
 * Narrowing a `const` does not reach into hoisted function declarations, and
 * every draw routine below is one — so the guard has to produce a non-null type
 * rather than assert one at the call site.
 */
function require2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Flotsam: no 2d context")
  return context
}

export function createFlotsam(canvas: HTMLCanvasElement, initial: Settings): Flotsam {
  const context = require2d(canvas)

  const stillOnly = window.matchMedia("(prefers-reduced-motion: reduce)")

  let settings = initial
  let sea: Sea = createSea(settings)
  let scatter: Scatter = createScatter({ ...settings })
  tune(scatter, sea)

  const specks: Specks = createSpecks(context)

  let width = 0
  let height = 0
  let dpr = 1
  let background: HTMLCanvasElement | null = null
  let view: View = makeView(settings.span, 1, 1, sea)
  // After the view, always: the eddy field is quantised to whole cycles across
  // the patch, so it cannot be built until the patch is known. See `current.ts`.
  let current: Current = createCurrent(settings, view.patchWidth, view.patchHeight)

  let frame = 0
  let running = false
  let debug = false
  let clock = 0
  let previous = 0
  let fps = 0
  let drawnDots = 0
  let orbit = 0
  let transport = 0
  let minJacobian = 1
  let dispersion = 0
  /** Set when the picture needs repainting without anything having moved. */
  let dirty = true

  /** Reused, so sampling the sea allocates nothing however many pieces there are. */
  const water = new Float64Array(SAMPLE_SIZE)
  const flow = { x: 0, y: 0 }
  const cells = new Int32Array(GRID_X * GRID_Y)

  /**
   * Reduced motion gets a still frame, not a slowed one.
   *
   * Unlike Dangler this cannot be expressed by pinning settings to zero, because
   * the waves have no speed setting to pin — their speed comes from their length
   * through the dispersion relation, and a sea with a wavelength has a period
   * whether anyone wants one or not. So the clock is simply not advanced, which
   * gives a still of the sea at t = 0 with all its shape and gathering intact
   * rather than the flat water that zeroing the steepness would give.
   */
  const isAnimated = () =>
    !stillOnly.matches &&
    (settings.steepness > 0 || settings.drift > 0 || settings.eddies > 0 || (settings.stokes > 0 && sea.steepness > 0))

  const waterMoves = () => settings.drift > 0 || settings.eddies > 0 || (settings.stokes > 0 && sea.reach > 0)

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
    view = makeView(settings.span, width, height, sea)
    current = createCurrent(settings, view.patchWidth, view.patchHeight)
    background = null
  }

  /**
   * The water, rendered once per resize.
   *
   * A full-viewport gradient every frame will not hold 60fps. Baked into an
   * opaque buffer it becomes a single blit with no blending at all.
   *
   * **This is the only thing drawn that is not a piece of flotsam.** The sea
   * itself is never rendered — no surface, no crests, no shading. Everything you
   * read as water is read off the specks: how they swing, where they gather, and
   * when they catch the light. Drawing the surface was never tried, because the
   * moment it exists the flotsam is decoration on top of it rather than the only
   * evidence there is.
   */
  function paintBackground(): HTMLCanvasElement {
    const buffer = document.createElement("canvas")
    buffer.width = Math.max(1, Math.round(width))
    buffer.height = Math.max(1, Math.round(height))
    const ctx = buffer.getContext("2d")
    if (!ctx) return buffer

    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, buffer.width, buffer.height)

    const radius = Math.hypot(buffer.width, buffer.height) / 2
    const vignette = ctx.createRadialGradient(
      buffer.width / 2,
      buffer.height / 2,
      radius * 0.25,
      buffer.width / 2,
      buffer.height / 2,
      radius,
    )
    vignette.addColorStop(0, "rgb(0 0 0 / 0%)")
    vignette.addColorStop(1, `rgb(0 0 0 / ${Math.round(VIGNETTE * 100)}%)`)
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, buffer.width, buffer.height)
    return buffer
  }

  /** The halfway vector between the light and the eye, which is straight down. */
  function halfway(): [number, number, number] {
    const [ax, ay] = heading(settings.azimuth)
    const elevation = (settings.elevation * Math.PI) / 180
    const cos = Math.cos(elevation)
    const lx = ax * cos
    const ly = ay * cos
    const lz = Math.sin(elevation)
    // The eye is at (0, 0, 1): straight down at the water, everywhere in frame.
    const length = Math.hypot(lx, ly, lz + 1) || 1
    return [lx / length, ly / length, (lz + 1) / length]
  }

  /**
   * Advances the rest positions. The one place anything accumulates.
   *
   * **Midpoint rather than Euler.** The eddy field is incompressible and
   * periodic on the patch, which together are what let `current.ts` promise that
   * it stirs the flotsam without ever concentrating it — so that every clump on
   * screen is the waves' doing. An integrator does not inherit that promise for
   * free: a forward Euler step lands slightly outside the true arc on a turning
   * flow, and the error compounds into a slow expansion away from each gyre.
   * Measured with the waves off and `eddies` at 0.9 over a three-metre gyre, one
   * minute of Euler took the index of dispersion to 1.08 where midpoint left it
   * at 0.96 — a real drift, small, and bought back for one extra evaluation of
   * three cosines.
   *
   * It is worth being clear that this is the *small* half of the problem. The
   * same measurement against a field that was incompressible but not periodic on
   * the patch read **134**, and no integrator would have helped; see the
   * torus note in `current.ts`.
   *
   * Wave drift is left out of the midpoint probe deliberately: it is uniform
   * over space, so it cannot bend a trajectory and cannot change an area either
   * way.
   */
  function advance(elapsed: number): void {
    if (!waterMoves()) {
      transport = 0
      return
    }

    const stokes = settings.stokes
    const half = elapsed / 2
    let speed = 0

    for (let i = 0; i < scatter.count; i++) {
      const x = worldX(view, scatter.u[i]!)
      const y = worldY(view, scatter.v[i]!)

      currentAt(current, x, y, clock, flow)
      currentAt(current, x + flow.x * half, y + flow.y * half, clock + half, flow)

      const vx = flow.x + stokes * scatter.stokesX[i]!
      const vy = flow.y + stokes * scatter.stokesY[i]!
      speed += Math.hypot(vx, vy)

      scatter.u[i] = wrap(scatter.u[i]! + (vx * elapsed) / view.patchWidth)
      scatter.v[i] = wrap(scatter.v[i]! + (vy * elapsed) / view.patchHeight)
    }

    transport = scatter.count > 0 ? speed / scatter.count : 0
  }

  function draw(): void {
    resize()
    if (!background) background = paintBackground()

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.globalCompositeOperation = "source-over"
    context.globalAlpha = 1
    context.drawImage(background, 0, 0, width, height)

    // The wind, once a frame rather than once a speck. Everything below — the
    // displacement, the slope, the fold check — reads the sea as this leaves it.
    gustSea(sea, settings.gusts, clock)

    specks.reset()
    cells.fill(0)
    drawnDots = 0

    context.globalCompositeOperation = "lighter"

    const [hx, hy, hz] = halfway()
    const { glint, shade, gleam, exposure } = settings
    const reach = sea.reach || 1
    const trains = scatter.trains
    let orbitSum = 0

    for (let i = 0; i < scatter.count; i++) {
      const x = worldX(view, scatter.u[i]!)
      const y = worldY(view, scatter.v[i]!)
      sample(sea, x, y, clock, scatter.response, i * trains, water)

      const px = screenX(view, x + water[OFFSET_X]!)
      const py = screenY(view, y + water[OFFSET_Y]!)

      const core = scatter.radius[i]! / view.metresPerPx
      // Exposure first, so everything downstream — the bloom included — is
      // scaled by it. A dimmer scene should have less glare, not the same glare
      // around dimmer pieces.
      let brightness = scatter.brightness[i]! * exposure

      // Height reads the crests; slope reads the faces. The two show the same
      // wave a quarter cycle apart, which is why both are controls.
      if (shade > 0) {
        brightness *= Math.max(0, 1 + shade * Math.max(-1, Math.min(1, water[HEIGHT]! / reach)))
      }

      if (glint > 0) {
        // Flotsam lies flat and turns with the surface, so its facet normal is
        // the water's. This is the whole reason the waves are visible: bands of
        // pieces come round to the mirror angle together and flare together.
        const nx = -water[SLOPE_X]!
        const ny = -water[SLOPE_Y]!
        const length = Math.hypot(nx, ny, 1) || 1
        const facing = (nx * hx + ny * hy + hz) / length
        const spec = facing > 0 ? facing ** SHINE : 0
        brightness *= 1 - glint + glint * (GLINT_FLOOR + GLINT_GAIN * spec)
      }

      if (brightness <= 0) continue

      // Bloom rather than clipping: additive drawing saturates at full alpha, so
      // a piece brighter than nominal has nowhere left to go except outward,
      // which is what glare does anyway.
      const halo = core + gleam * Math.min(MAX_BLOOM, brightness)
      const bound = halo + 2
      if (px < -bound || py < -bound || px > width + bound || py > height + bound) continue

      specks.draw(px, py, core, halo, scatter.hue[i]!, scatter.saturation[i]!, brightness)
      drawnDots++
      orbitSum += water[OFFSET_X]! * water[OFFSET_X]! + water[OFFSET_Y]! * water[OFFSET_Y]!

      if (px >= 0 && py >= 0 && px < width && py < height) {
        const cx = Math.min(GRID_X - 1, Math.floor((px / width) * GRID_X))
        const cy = Math.min(GRID_Y - 1, Math.floor((py / height) * GRID_Y))
        cells[cy * GRID_X + cx]!++
      }
    }

    orbit = drawnDots > 0 ? Math.sqrt(orbitSum / drawnDots) : 0
    dispersion = indexOfDispersion()
    minJacobian = probeJacobian()

    context.globalCompositeOperation = "source-over"
    context.globalAlpha = 1
    if (debug) drawDebug()
  }

  /** Variance over mean of the per-cell counts. See `FlotsamStats.dispersion`. */
  function indexOfDispersion(): number {
    let total = 0
    for (let i = 0; i < cells.length; i++) total += cells[i]!
    if (total === 0) return 0

    const mean = total / cells.length
    let variance = 0
    for (let i = 0; i < cells.length; i++) {
      const d = cells[i]! - mean
      variance += d * d
    }
    return variance / cells.length / mean
  }

  /** Sweeps the patch for the worst area compression. See `FlotsamStats.minJacobian`. */
  function probeJacobian(): number {
    let worst = Infinity
    for (let j = 0; j < PROBE_Y; j++) {
      const y = worldY(view, (j + 0.5) / PROBE_Y)
      for (let i = 0; i < PROBE_X; i++) {
        const value = jacobian(sea, worldX(view, (i + 0.5) / PROBE_X), y, clock)
        if (value < worst) worst = value
      }
    }
    return worst === Infinity ? 1 : worst
  }

  /**
   * The waves and the current, which the piece never shows.
   *
   * Not a nicety. With only the flotsam visible, a sea running the wrong way, a
   * current running the wrong way and a response table full of zeroes all look
   * identical — a scatter of dots that is not doing very much. This is the
   * difference between debugging and guessing, and it is where the sign of the
   * horizontal displacement was checked the one time it mattered.
   */
  function drawDebug(): void {
    const centreX = width / 2
    const centreY = height / 2
    const diagonal = Math.hypot(width, height)

    for (const train of sea.trains) {
      const spacing = train.wavelength / view.metresPerPx
      if (spacing < 6) continue

      // Crests are the lines where the phase is a multiple of 2π. Perpendicular
      // to the direction of travel, and marching along it at the phase speed.
      const dirX = train.dx
      const dirY = -train.dy
      const offset = ((train.omega * clock - train.phase) / (2 * Math.PI)) * spacing
      const start = -Math.ceil(diagonal / spacing)

      context.strokeStyle = `rgb(90 200 255 / ${Math.min(0.5, train.amplitude * train.k * 0.6).toFixed(3)})`
      context.lineWidth = 1
      context.beginPath()
      for (let n = start; n <= -start; n++) {
        const along = n * spacing + (offset % spacing)
        const ax = centreX + dirX * along
        const ay = centreY + dirY * along
        context.moveTo(ax - dirY * diagonal, ay + dirX * diagonal)
        context.lineTo(ax + dirY * diagonal, ay - dirX * diagonal)
      }
      context.stroke()
    }

    // The current, as arrows on a grid. A uniform set and a swirl look the same
    // in the flotsam until you can see the field they came from.
    context.strokeStyle = "rgb(255 150 90 / 70%)"
    context.lineWidth = 1.5
    const arrowSeconds = 3
    for (let j = 0; j < 6; j++) {
      for (let i = 0; i < 10; i++) {
        const x = worldX(view, (i + 0.5) / 10)
        const y = worldY(view, (j + 0.5) / 6)
        currentAt(current, x, y, clock, flow)
        const fromX = screenX(view, x)
        const fromY = screenY(view, y)
        // Arrows are drawn as where the water gets to in three seconds, so their
        // length is metres of travel rather than an arbitrary gain.
        const toX = screenX(view, x + flow.x * arrowSeconds)
        const toY = screenY(view, y + flow.y * arrowSeconds)
        context.beginPath()
        context.moveTo(fromX, fromY)
        context.lineTo(toX, toY)
        context.stroke()
        context.fillStyle = "rgb(255 150 90 / 70%)"
        context.fillRect(fromX - 1.5, fromY - 1.5, 3, 3)
      }
    }
  }

  function tick(now: number): void {
    frame = requestAnimationFrame(tick)

    const elapsed = previous === 0 ? 0 : Math.min(0.25, (now - previous) / 1000)
    previous = now
    if (elapsed > 0) fps += (1 / elapsed - fps) * 0.1

    if (isAnimated()) {
      clock += elapsed
      advance(elapsed)
      draw()
      dirty = false
      return
    }

    // `dirty` covers everything that changes the picture without the sea moving:
    // a resize, the debug overlay, a colour. Without it the loop parks and the
    // canvas keeps whatever was last on it — and setting `canvas.width` on a
    // resize clears it, so the piece would simply vanish when the window changed
    // size or a screenshot was taken. That happened in Dangler; it is the same
    // loop and it would happen here.
    if (dirty) {
      dirty = false
      draw()
      return
    }

    // Genuinely nothing moving and nothing to redraw. Park until something asks
    // for a frame again — which is also the reduced-motion path, so that needs
    // no separate one.
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
    background = null
    resize()
    wake()
  }

  window.addEventListener("resize", onResize)
  stillOnly.addEventListener("change", wake)

  return {
    start() {
      resize()
      draw()
      wake()
    },

    stop() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
      window.removeEventListener("resize", onResize)
    },

    setSettings(next) {
      const before = settings
      settings = next

      if (needsSea(before, settings)) sea = createSea(settings)

      if (needsScatter(before, settings)) {
        // A new seed redraws every piece's size, colour and home, so nothing
        // carries over; anything else keeps the positions the current has spent
        // a minute establishing.
        scatter = createScatter({ ...settings }, before.seed === settings.seed ? scatter : undefined)
      }
      tune(scatter, sea)

      // The view depends on the sea's reach, and the current on the view, so
      // these two are in this order and after everything above.
      view = makeView(settings.span, width, height, sea)
      // Cheap enough to rebuild unconditionally — three terms — and everything
      // in it comes from the seed and the patch, so rebuilding is idempotent and
      // loses no state.
      current = createCurrent(settings, view.patchWidth, view.patchHeight)
      wake()
    },

    /**
     * Advance the sea by a stretch of time in one call.
     *
     * This piece's answer to Dangler's `settle()`, and it exists for the same
     * reason: the thing worth looking at is not the first frame. Nothing here
     * relaxes, but plenty of it is *slow* — Stokes drift moves flotsam at
     * centimetres a second and the gathering takes a wave period or two to
     * establish — and neither a poster nor a test can afford to sit through it
     * in real time. Stepped rather than jumped, because the current is
     * integrated and a single enormous step would take every piece in a
     * straight line through the eddies it should have curved around.
     */
    run(seconds) {
      const steps = Math.min(MAX_RUN_STEPS, Math.max(0, Math.round(seconds / RUN_STEP)))
      for (let i = 0; i < steps; i++) {
        clock += RUN_STEP
        advance(RUN_STEP)
      }
      draw()
    },

    stats: () => ({
      dots: scatter.count,
      trains: sea.trains.length,
      steepness: sea.steepness,
      minJacobian,
      dispersion,
      orbit,
      transport,
      drawnDots,
      fillPx: Math.round(specks.fill()),
      light: Math.round((specks.lit() / Math.max(1, width * height)) * 1000) / 1000,
      clock,
      fps: Math.round(fps * 10) / 10,
      running,
    }),

    setDebug(on) {
      debug = on
      wake()
    },
  }
}
