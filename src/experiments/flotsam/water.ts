/**
 * The water without a canvas: what moves, where it is seen, and what it measures.
 *
 * Everything `flotsam.ts` used to do between "the clock moved" and "put a speck
 * on the canvas" lives here — the sea, the current and the flotsam, the one
 * integration step, where each piece lands on screen and how brightly, and the
 * numbers `stats()` reports about all of it. Nothing in this file touches a
 * canvas or a window, so the physics is a unit test rather than a browser one
 * (#287): a sea that gathers and a sea that does not are numbers here, and the
 * page only has to show that it draws what this file says.
 *
 * `flotsam.ts` keeps the canvas, the loop, the specks and the debug overlay. It
 * calls `survey()` once a frame and draws the pieces the survey left visible, in
 * the order it left them, which is the order they were drawn in before.
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
import { createScatter, tune, type Scatter } from "@/experiments/flotsam/scatter"
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

/** Fixed step `run()` advances in. Small enough that a fast current is smooth. */
export const RUN_STEP = 1 / 60

/** Ceiling on `run()`, so a mistyped argument cannot lock the tab up. */
const MAX_RUN_STEPS = 60_000

/** Grid the dispersion statistic is measured on. Cells, not pixels. */
const GRID_X = 40
const GRID_Y = 24

/** Lattice the Jacobian is sampled on. Coarse: it is looking for a fold, not a value. */
const PROBE_X = 25
const PROBE_Y = 15

/**
 * What the water measures about itself. See `FlotsamStats` in `flotsam.ts` for
 * what each number means; the comments live there, beside the rest of the stats.
 */
export type WaterStats = {
  dots: number
  trains: number
  steepness: number
  minJacobian: number
  dispersion: number
  orbit: number
  transport: number
  drawnDots: number
  clock: number
}

/**
 * Where the last survey put every piece, for the canvas to draw.
 *
 * Indexed by piece, and only meaningful for the indices in `visible[0 … count)`,
 * which are in ascending order — the order the pieces were drawn in when this
 * was one loop in `flotsam.ts`, kept so the additive canvas sums in the same
 * order as it always did.
 */
export type Survey = {
  count: number
  visible: Int32Array
  px: Float64Array
  py: Float64Array
  core: Float64Array
  halo: Float64Array
  brightness: Float64Array
}

export type Water = {
  readonly settings: Settings
  readonly sea: Sea
  readonly scatter: Scatter
  readonly current: Current
  readonly view: View
  /** Seconds of sea simulated since the water was made. */
  readonly clock: number
  /** Whether anything integrates: a current, eddies, or wave drift on a sea that has any. */
  moves: () => boolean
  /**
   * Take a new frame size. The view follows the frame and the current follows
   * the view, because the eddy field is quantised to whole cycles across the
   * patch — so both are rebuilt, and nothing that has been integrated is lost.
   */
  resize: (width: number, height: number) => void
  setSettings: (next: Settings) => void
  /** Move the clock on and integrate across the gap. The one place anything accumulates. */
  step: (elapsed: number) => void
  /**
   * Advance the sea by a stretch of time in one call, in fixed steps.
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
  run: (seconds: number) => void
  /**
   * Where every piece is on screen this frame and how bright, and the
   * measurements that come with it: orbit, dispersion, the fold check.
   *
   * Also lets the wind gust the sea, once a frame rather than once a speck, so
   * it is called once per drawn frame and never just to read a number.
   */
  survey: () => Survey
  stats: () => WaterStats
}

export function createWater(initial: Settings, width = 1, height = 1): Water {
  let settings = initial
  let sea: Sea = createSea(settings)
  let scatter: Scatter = createScatter({ ...settings })
  tune(scatter, sea)

  let view: View = makeView(settings.span, width, height, sea)
  // After the view, always: the eddy field is quantised to whole cycles across
  // the patch, so it cannot be built until the patch is known. See `current.ts`.
  let current: Current = createCurrent(settings, view.patchWidth, view.patchHeight)

  let clock = 0
  let orbit = 0
  let transport = 0
  let minJacobian = 1
  let dispersion = 0

  /** Reused, so sampling the sea allocates nothing however many pieces there are. */
  const water = new Float64Array(SAMPLE_SIZE)
  const flow = { x: 0, y: 0 }
  const cells = new Int32Array(GRID_X * GRID_Y)

  let survey: Survey = emptySurvey(0)

  const moves = () => settings.drift > 0 || settings.eddies > 0 || (settings.stokes > 0 && sea.reach > 0)

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
   * Advances the rest positions.
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
    if (!moves()) {
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

  function step(elapsed: number): void {
    clock += elapsed
    advance(elapsed)
  }

  function measure(): Survey {
    const { width, height } = view
    // The wind, once a frame rather than once a speck. Everything below — the
    // displacement, the slope, the fold check — reads the sea as this leaves it.
    gustSea(sea, settings.gusts, clock)

    if (survey.px.length !== scatter.count) survey = emptySurvey(scatter.count)
    const { visible, px: xs, py: ys, core: cores, halo: halos, brightness: lights } = survey
    let count = 0
    cells.fill(0)

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

      // The glare's size does not follow a piece's brightness, and used not to.
      // Blooming an over-bright piece outward sounds right and cost more than it
      // was worth: it made the glare's inner edge wander as the waves lit a piece
      // and let it go, so the sprite bucket it fell in flipped back and forth and
      // large pieces visibly pulsed. Over-brightness now reads the way the
      // palette intends — a piece sums past full in the strong channels and clips
      // toward white — which is both cheaper and what real glare looks like.
      const halo = core + gleam
      const bound = halo + 2
      if (px < -bound || py < -bound || px > width + bound || py > height + bound) continue

      visible[count++] = i
      xs[i] = px
      ys[i] = py
      cores[i] = core
      halos[i] = halo
      lights[i] = brightness
      orbitSum += water[OFFSET_X]! * water[OFFSET_X]! + water[OFFSET_Y]! * water[OFFSET_Y]!

      if (px >= 0 && py >= 0 && px < width && py < height) {
        const cx = Math.min(GRID_X - 1, Math.floor((px / width) * GRID_X))
        const cy = Math.min(GRID_Y - 1, Math.floor((py / height) * GRID_Y))
        cells[cy * GRID_X + cx]!++
      }
    }

    survey.count = count
    orbit = count > 0 ? Math.sqrt(orbitSum / count) : 0
    dispersion = indexOfDispersion(cells)
    minJacobian = probeJacobian(sea, view, clock)
    return survey
  }

  return {
    get settings() {
      return settings
    },
    get sea() {
      return sea
    },
    get scatter() {
      return scatter
    },
    get current() {
      return current
    },
    get view() {
      return view
    },
    get clock() {
      return clock
    },

    moves,

    resize(nextWidth, nextHeight) {
      width = nextWidth
      height = nextHeight
      view = makeView(settings.span, width, height, sea)
      current = createCurrent(settings, view.patchWidth, view.patchHeight)
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
    },

    step,

    run(seconds) {
      const steps = Math.min(MAX_RUN_STEPS, Math.max(0, Math.round(seconds / RUN_STEP)))
      for (let i = 0; i < steps; i++) step(RUN_STEP)
    },

    survey: measure,

    stats: () => ({
      dots: scatter.count,
      trains: sea.trains.length,
      steepness: sea.steepness,
      minJacobian,
      dispersion,
      orbit,
      transport,
      drawnDots: survey.count,
      clock,
    }),
  }
}

function emptySurvey(size: number): Survey {
  return {
    count: 0,
    visible: new Int32Array(size),
    px: new Float64Array(size),
    py: new Float64Array(size),
    core: new Float64Array(size),
    halo: new Float64Array(size),
    brightness: new Float64Array(size),
  }
}

/** Variance over mean of the per-cell counts. See `FlotsamStats.dispersion`. */
export function indexOfDispersion(cells: ArrayLike<number>): number {
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
export function probeJacobian(sea: Sea, view: View, clock: number): number {
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
