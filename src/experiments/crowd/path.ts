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

import type { Rng } from "@/experiments/random"
import { bandEntry, bandPoint } from "@/experiments/crowd/random"

/**
 * Where a point sits relative to the way: how far across it, and which way the
 * way runs there. What every consumer actually needs, asked once per person
 * per step.
 */
export type Frame = {
  /** Signed distance across the way from its centre. Positive is to the left of the way's direction. */
  lateral: number
  /** The way's direction at the nearest point, as a unit vector. */
  cos: number
  sin: number
}

/**
 * Somewhere to remember the nearest point on a loop between steps.
 *
 * A person moves a few millimetres a step, so last step's nearest point is a
 * couple of comparisons from this step's. Without it a loop is a scan of four
 * thousand points per person per step. A graph path ignores it.
 */
export type PathHint = { pathAt: number }

export type Path = {
  /** True when nothing bends, so callers can skip the rotations entirely. */
  straight: boolean
  /** True for a loop: a way that comes back to where it started. */
  closed: boolean
  /** Where `(x, y)` sits relative to the way. Writes into `out` and returns it. */
  frame: (x: number, y: number, out: Frame, hint?: PathHint) => Frame
  /** Signed distance across the way. A convenience with no hint, so not for a hot loop on a loop. */
  lateral: (x: number, y: number) => number
  /** The way's direction at the point nearest `(x, y)`, in radians. A convenience, like `lateral`. */
  along: (x: number, y: number) => number
  /** A point in the band `inner ≤ |lateral| ≤ outer` inside the disc about `(ox, oy)`, uniform along the way. */
  sample: (rng: Rng, radius: number, ox: number, oy: number, inner: number, outer: number) => { x: number; y: number }
  /** Where somebody re-enters that band at `radius`, on the side `angle` says they come from. */
  entry: (
    rng: Rng,
    angle: number,
    radius: number,
    ox: number,
    oy: number,
    inner: number,
    outer: number,
  ) => { x: number; y: number }
  /**
   * Metres of centre line inside the disc, or null to mean "use the straight
   * corridor's area" — which is what every graph path does, because every scene
   * built on one was measured with that formula.
   */
  lengthWithin: (ox: number, oy: number, radius: number) => number | null
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

/** A path that is a graph `y = c(x)`: straight, or meandering. Everything before the loop was one. */
export type GraphPath = Path & {
  /** The centre of the way at `x`. */
  centre: (x: number) => number
  /** Slope of the centre line at `x`, dy/dx. */
  slope: (x: number) => number
  /** Largest slope anywhere on the path, so a sampler can normalise its acceptance. */
  steepest: number
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
): GraphPath {
  const relief = createGround(climb, hills, phaseC, phaseD)
  if (bend <= 0) {
    return graph({
      ...relief,
      straight: true,
      centre: () => 0,
      slope: () => 0,
      lateral: (_x, y) => y,
      steepest: 0,
      minRadius: Infinity,
    })
  }

  const k1 = (Math.PI * 2) / meander
  const k2 = k1 / SECOND
  const a1 = bend * (1 - SECOND_SHARE)
  const a2 = bend * SECOND_SHARE
  const offset = a1 * Math.sin(phaseA) + a2 * Math.sin(phaseB)

  const centre = (x: number) => a1 * Math.sin(k1 * x + phaseA) + a2 * Math.sin(k2 * x + phaseB) - offset
  const slope = (x: number) => a1 * k1 * Math.cos(k1 * x + phaseA) + a2 * k2 * Math.cos(k2 * x + phaseB)

  return graph({
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
  })
}

type GraphParts = Pick<
  GraphPath,
  | "straight"
  | "centre"
  | "slope"
  | "lateral"
  | "steepest"
  | "minRadius"
  | "flat"
  | "ground"
  | "groundSlope"
  | "steepestClimb"
>

/**
 * The rest of the interface for a graph path, in terms of its slope.
 *
 * **Exactly the arithmetic the piece used before loops existed**: the frame is
 * the slope's angle and `lateral` as it was, and sampling and re-entry are
 * `bandPoint` and `bandEntry` unchanged. Every scene before the loop was
 * measured on these, so they are wrapped rather than rewritten.
 */
function graph(parts: GraphParts): GraphPath {
  const path: GraphPath = {
    ...parts,
    closed: false,
    frame: (x, y, out) => {
      if (parts.straight) {
        out.lateral = y
        out.cos = 1
        out.sin = 0
        return out
      }
      const s = parts.slope(x)
      const c = 1 / Math.sqrt(1 + s * s)
      out.lateral = (y - parts.centre(x)) * c
      out.cos = c
      out.sin = s * c
      return out
    },
    along: (x) => Math.atan(parts.slope(x)),
    sample: (rng, radius, ox, oy, inner, outer) => bandPoint(rng, radius, ox, oy, path, inner, outer),
    entry: (rng, angle, radius, ox, oy, inner, outer) => bandEntry(rng, angle, radius, ox, oy, path, inner, outer),
    lengthWithin: () => null,
  }
  return path
}

/** Points per metre of loop, and the bounds on how many a loop may have. */
const LOOP_SPACING = 0.5
const LOOP_POINTS = { min: 256, max: 4096 }

/**
 * A way that comes back to where it started: a closed curve of length
 * `length`, starting at `(ax, ay)` heading `angle`, turning to the left.
 *
 * ## Smooth everywhere, sharp in places
 *
 * "the run needs to be smooth without abrupt turns - like a car turning would
 * follow a curve." So the shape is a radius about a centre that varies with
 * two harmonics, `1 + a·cos 2θ + b·cos 3θ` — every derivative continuous, so
 * curvature never jumps, and `corners` sets how unequal the turns are. At 0 it
 * is a circle; near 1 it has two or three tight turns and long gentle sides
 * between them. `minRadius` reports the tightest, measured off the curve
 * rather than bounded, because this shape has no neat closed form for it.
 *
 * ## A polyline, resampled evenly
 *
 * About two points a metre, each with its tangent. The nearest point to a
 * person is found by walking from last step's (`PathHint`), which is a couple
 * of comparisons, and then projected onto the segment either side so `lateral`
 * is continuous rather than stepping every half metre.
 */
export function createLoop(
  length: number,
  corners: number,
  phaseA: number,
  phaseB: number,
  ax: number,
  ay: number,
  angle: number,
  climb = 0,
  hills = 300,
  phaseC = 0,
  phaseD = 0,
): Path {
  const relief = createGround(climb, hills, phaseC, phaseD)
  const a = 0.34 * corners
  const b = 0.2 * corners

  // Dense in angle first, then resampled evenly in arc length.
  const dense = 8192
  const dx: number[] = []
  const dy: number[] = []
  for (let k = 0; k <= dense; k++) {
    const t = (k / dense) * Math.PI * 2
    const r = 1 + a * Math.cos(2 * t + phaseA) + b * Math.cos(3 * t + phaseB)
    dx.push(r * Math.cos(t))
    dy.push(r * Math.sin(t))
  }
  const cumulative = [0]
  for (let k = 1; k <= dense; k++) {
    cumulative.push(cumulative[k - 1]! + Math.hypot(dx[k]! - dx[k - 1]!, dy[k]! - dy[k - 1]!))
  }
  const perimeter = cumulative[dense]!
  const scale = length / perimeter
  const n = Math.max(LOOP_POINTS.min, Math.min(LOOP_POINTS.max, Math.round(length / LOOP_SPACING)))
  const px = new Float64Array(n)
  const py = new Float64Array(n)
  let at = 0
  for (let i = 0; i < n; i++) {
    const want = (i / n) * perimeter
    while (at < dense - 1 && cumulative[at + 1]! < want) at++
    const span = cumulative[at + 1]! - cumulative[at]!
    const f = span > 0 ? (want - cumulative[at]!) / span : 0
    px[i] = (dx[at]! + (dx[at + 1]! - dx[at]!) * f) * scale
    py[i] = (dy[at]! + (dy[at + 1]! - dy[at]!) * f) * scale
  }

  // Tangents by central difference, then the whole loop turned and moved so
  // point 0 is at the anchor facing `angle`.
  const tx = new Float64Array(n)
  const ty = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    const prev = (i - 1 + n) % n
    const ex = px[next]! - px[prev]!
    const ey = py[next]! - py[prev]!
    const len = Math.hypot(ex, ey) || 1
    tx[i] = ex / len
    ty[i] = ey / len
  }
  const turn = angle - Math.atan2(ty[0]!, tx[0]!)
  const c = Math.cos(turn)
  const s = Math.sin(turn)
  const x0 = px[0]!
  const y0 = py[0]!
  for (let i = 0; i < n; i++) {
    const lx = px[i]! - x0
    const ly = py[i]! - y0
    px[i] = ax + lx * c - ly * s
    py[i] = ay + lx * s + ly * c
    const vx = tx[i]!
    const vy = ty[i]!
    tx[i] = vx * c - vy * s
    ty[i] = vx * s + vy * c
  }

  const step = length / n
  let tightest = Infinity
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    const bend = Math.abs(Math.atan2(tx[i]! * ty[next]! - ty[i]! * tx[next]!, tx[i]! * tx[next]! + ty[i]! * ty[next]!))
    if (bend > 1e-9) tightest = Math.min(tightest, step / bend)
  }

  const distSq = (i: number, x: number, y: number) => {
    const ex = px[i]! - x
    const ey = py[i]! - y
    return ex * ex + ey * ey
  }

  function nearest(x: number, y: number, hint?: PathHint): number {
    let i = hint && hint.pathAt >= 0 && hint.pathAt < n ? hint.pathAt : -1
    if (i < 0) {
      let best = Infinity
      for (let k = 0; k < n; k++) {
        const d = distSq(k, x, y)
        if (d < best) {
          best = d
          i = k
        }
      }
    } else {
      // Downhill from last step's point. A person moves millimetres a step, so
      // this is one or two comparisons; the cap is for a teleport.
      let d = distSq(i, x, y)
      for (let guard = 0; guard < n; guard++) {
        const forward = (i + 1) % n
        const back = (i - 1 + n) % n
        const df = distSq(forward, x, y)
        const db = distSq(back, x, y)
        if (df < d && df <= db) {
          i = forward
          d = df
        } else if (db < d) {
          i = back
          d = db
        } else break
      }
    }
    if (hint) hint.pathAt = i
    return i
  }

  function frame(x: number, y: number, out: Frame, hint?: PathHint): Frame {
    const i = nearest(x, y, hint)
    // Project onto whichever neighbouring segment the point is over, so the
    // lateral offset is continuous between polyline points.
    const forward = tx[i]! * (x - px[i]!) + ty[i]! * (y - py[i]!) >= 0
    const j = forward ? (i + 1) % n : (i - 1 + n) % n
    const sx = px[j]! - px[i]!
    const sy = py[j]! - py[i]!
    const segSq = sx * sx + sy * sy || 1
    const t = Math.max(0, Math.min(1, ((x - px[i]!) * sx + (y - py[i]!) * sy) / segSq))
    const cx = px[i]! + sx * t
    const cy = py[i]! + sy * t
    let ux = tx[i]! + (tx[j]! - tx[i]!) * t
    let uy = ty[i]! + (ty[j]! - ty[i]!) * t
    const ul = Math.hypot(ux, uy) || 1
    ux /= ul
    uy /= ul
    out.lateral = ux * (y - cy) - uy * (x - cx)
    out.cos = ux
    out.sin = uy
    return out
  }

  const scratch: Frame = { lateral: 0, cos: 1, sin: 0 }

  const across = (rng: Rng, inner: number, outer: number) =>
    inner > 0 ? (rng() < 0.5 ? -1 : 1) * (inner + rng() * (outer - inner)) : (rng() * 2 - 1) * outer

  const at2 = (i: number, lateral: number) => ({ x: px[i]! - ty[i]! * lateral, y: py[i]! + tx[i]! * lateral })

  // The stretch of loop inside a disc, cached for the run of calls a restock makes.
  let cacheKey = ""
  let inside: number[] = []
  function insideDisc(ox: number, oy: number, radius: number): number[] {
    const key = `${ox.toFixed(2)},${oy.toFixed(2)},${radius.toFixed(2)}`
    if (key === cacheKey) return inside
    cacheKey = key
    inside = []
    for (let i = 0; i < n; i++) if (distSq(i, ox, oy) <= radius * radius) inside.push(i)
    return inside
  }

  return {
    ...relief,
    straight: false,
    closed: true,
    minRadius: tightest,
    frame,
    lateral: (x, y) => frame(x, y, scratch).lateral,
    along: (x, y) => {
      frame(x, y, scratch)
      return Math.atan2(scratch.sin, scratch.cos)
    },
    sample(rng, radius, ox, oy, inner, outer) {
      const pool = insideDisc(ox, oy, radius)
      for (let attempt = 0; attempt < 40 && pool.length > 0; attempt++) {
        const p = at2(pool[Math.floor(rng() * pool.length)]!, across(rng, inner, outer))
        if ((p.x - ox) * (p.x - ox) + (p.y - oy) * (p.y - oy) <= radius * radius) return p
      }
      return at2(nearest(ox, oy), across(rng, inner, outer))
    },
    entry(rng, angle, radius, ox, oy, inner, outer) {
      // Where the loop crosses a circle a band's width inside the boundary, so
      // the point placed is inside the world whichever side of the way it is.
      const ring = Math.max(1, radius - outer)
      const ringSq = ring * ring
      let best = -1
      let bestOff = Infinity
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n
        const a0 = distSq(i, ox, oy) - ringSq
        const a1 = distSq(k, ox, oy) - ringSq
        if (a0 > 0 === a1 > 0) continue
        let off = Math.atan2(py[i]! - oy, px[i]! - ox) - angle
        off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)))
        if (off < bestOff) {
          bestOff = off
          best = i
        }
      }
      // The whole loop inside the world: nobody should be leaving it, and
      // anybody who has is simply put back somewhere on it.
      if (best < 0) return this.sample(rng, radius, ox, oy, inner, outer)
      return at2(best, across(rng, inner, outer))
    },
    lengthWithin: (ox, oy, radius) => insideDisc(ox, oy, radius).length * step,
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
 * How hard somebody is pulled toward their own side of the way, per second
 * squared per metre off their lane.
 *
 * **A pull, not a wall** — a fifth of the wall's stiffness — and it still
 * saturates early. On a 4.5 m two-way trail the share of walkers on their own
 * side was 0.45 with no rule, 0.88 at `keep` 0.2, 0.997 at 0.4 and 1.000 at 1:
 * the avoidance that would carry an overtake across the middle loses to it well
 * before the top of the track.
 */
export const LANE_SPRING = 1.4

/**
 * The across-the-way push toward a lane, for somebody heading `along` the path
 * (+1 with the path's +x, −1 against it, anything between for a diagonal).
 *
 * `keep` is signed: positive keeps left of one's own direction of travel,
 * negative keeps right, 0 is no rule. Returned as a signed magnitude along the
 * path's normal, the direction in which `lateral` grows.
 */
export function lanePush(lateral: number, halfWidth: number, along: number, keep: number): number {
  if (keep === 0 || !Number.isFinite(halfWidth)) return 0
  const target = Math.sign(keep) * along * halfWidth * 0.5
  return (target - lateral) * LANE_SPRING * Math.abs(keep)
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
