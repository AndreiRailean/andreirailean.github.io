/**
 * The line the crowd is laid along, which is a straight one unless it bends.
 *
 * Everything that used to say "the corridor is `|y| < halfWidth` about `y = 0`"
 * now asks this instead: where the centre of the way is at a given `x`, which
 * way it runs there, and how far a point is from it across its own width.
 * **A straight path answers exactly what the old code assumed** — centre 0,
 * angle 0, lateral offset `y` — so every scene that does not bend is the same
 * walk it was, and `straight` lets the hot loop skip the trigonometry.
 *
 * ## A meander, not a zigzag
 *
 * Two sines of unrelated wavelength, so the bends do not repeat on a beat the
 * eye can find, both shifted so the centre passes through the origin where the
 * observer starts. "A river meandering without sharp turns": what bounds a turn
 * is curvature, which for `A·sin(kx)` peaks at `A·k²`, so the tightest bend is
 * the one the `meander` wavelength and `bend` amplitude together allow —
 * `minRadius` reports it rather than letting anybody infer it from a picture.
 *
 * ## Lateral is measured across the path, approximately
 *
 * `(y − c(x)) · cos θ` is the perpendicular distance to the centre line for a
 * line that is locally straight, which a meander with a radius of tens of metres
 * is over the width of a trail. It is not the true distance to a curve, and it
 * does not need to be: what it is used for is walls, which are soft.
 */

export type Path = {
  /** True when nothing bends, so callers can skip the rotations entirely. */
  straight: boolean
  /** The centre of the way at `x`. */
  centre: (x: number) => number
  /** Slope of the centre line at `x`, dy/dx. */
  slope: (x: number) => number
  /** Signed distance across the path from its centre. Positive is to the left of travel along +x. */
  lateral: (x: number, y: number) => number
  /** Largest slope anywhere on the path, so a sampler can normalise its acceptance. */
  steepest: number
  /** Tightest radius of turn anywhere on the path, in metres. Infinite when straight. */
  minRadius: number
  /** True when the ground is level everywhere. */
  flat: boolean
  /**
   * Height of the ground at `x`, in metres, relative to where the observer started.
   *
   * **This is what makes a trail legible from inside it.** On level ground
   * every head is within a metre of eye height, so a winding line of them
   * collapses onto the horizon and its bends are only a left-right spread. A
   * trail that climbs and falls lifts the far bends above the horizon and drops
   * others below it, and the line of heads draws the shape of the hillside.
   */
  ground: (x: number) => number
  /** Gradient of the ground at `x`, along +x: rise over run. */
  groundSlope: (x: number) => number
  /** Steepest gradient of the ground, rise over run. */
  steepestClimb: number
}

/** Ratio of the second wavelength to the first. Irrational-ish, so the two never line up. */
const SECOND = 0.4142

/** Share of the amplitude the second, shorter sine carries. */
const SECOND_SHARE = 0.3

export function createPath(
  bend: number,
  meander: number,
  phaseA: number,
  phaseB: number,
  climb = 0,
  hills = 300,
  phaseC = 0,
  phaseD = 0,
): Path {
  const relief = createGround(climb, hills, phaseC, phaseD)
  if (bend <= 0) {
    return {
      ...relief,
      straight: true,
      centre: () => 0,
      slope: () => 0,
      lateral: (_x, y) => y,
      steepest: 0,
      minRadius: Infinity,
    }
  }

  const k1 = (Math.PI * 2) / meander
  const k2 = k1 / SECOND
  const a1 = bend * (1 - SECOND_SHARE)
  const a2 = bend * SECOND_SHARE
  const offset = a1 * Math.sin(phaseA) + a2 * Math.sin(phaseB)

  const centre = (x: number) => a1 * Math.sin(k1 * x + phaseA) + a2 * Math.sin(k2 * x + phaseB) - offset
  const slope = (x: number) => a1 * k1 * Math.cos(k1 * x + phaseA) + a2 * k2 * Math.cos(k2 * x + phaseB)

  return {
    ...relief,
    straight: false,
    centre,
    slope,
    lateral: (x, y) => {
      const s = slope(x)
      return (y - centre(x)) / Math.sqrt(1 + s * s)
    },
    steepest: a1 * k1 + a2 * k2,
    // Curvature is at most the sum of the two terms' peaks, and the slope term in
    // the denominator only makes it smaller, so this is a floor on the radius.
    minRadius: 1 / (a1 * k1 * k1 + a2 * k2 * k2),
  }
}

/**
 * The lie of the land: the same two-sine construction as the bends, along `x`.
 *
 * Its own wavelength and its own phases, so a climb does not line up with a
 * bend on a beat — a trail that turned exactly at every crest would read as
 * built rather than found.
 */
function createGround(
  climb: number,
  hills: number,
  phaseC: number,
  phaseD: number,
): { flat: boolean; ground: (x: number) => number; groundSlope: (x: number) => number; steepestClimb: number } {
  if (climb <= 0) return { flat: true, ground: () => 0, groundSlope: () => 0, steepestClimb: 0 }
  const k1 = (Math.PI * 2) / hills
  const k2 = k1 / SECOND
  const a1 = climb * (1 - SECOND_SHARE)
  const a2 = climb * SECOND_SHARE
  const offset = a1 * Math.sin(phaseC) + a2 * Math.sin(phaseD)
  return {
    flat: false,
    ground: (x) => a1 * Math.sin(k1 * x + phaseC) + a2 * Math.sin(k2 * x + phaseD) - offset,
    groundSlope: (x) => a1 * k1 * Math.cos(k1 * x + phaseC) + a2 * k2 * Math.cos(k2 * x + phaseD),
    steepestClimb: a1 * k1 + a2 * k2,
  }
}

/**
 * How much a gradient changes somebody's walking speed, as a multiplier.
 *
 * **Tobler's hiking function**, `6·exp(−3.5·|grade + 0.05|)` km/h, taken
 * relative to level ground so it multiplies whatever pace a person already
 * has. Its fastest point is a gentle descent of 5%, and it is asymmetric:
 * climbing 25% is about 0.44 of level pace, descending it about 0.58. `effort`
 * blends from no effect at 0 to the whole function at 1, so the difference it
 * makes — the crowd concertinaing on every climb — can be switched off and
 * looked at.
 *
 * `grade` is along the direction of travel, so the same hillside is a climb
 * for one person and a descent for the one coming the other way.
 */
export function hikingPace(grade: number, effort: number): number {
  if (effort <= 0) return 1
  const tobler = Math.exp(-3.5 * Math.abs(grade + 0.05)) / Math.exp(-3.5 * 0.05)
  return 1 + effort * (tobler - 1)
}
