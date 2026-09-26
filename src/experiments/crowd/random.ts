/**
 * Where people are put, which is this piece's own problem and not the kit's.
 *
 * The generators underneath — `hashSeed`, `makeRng`, `gaussian` — are the
 * section's, in `../random.ts`. **A placement strategy is not**, because it is a
 * choice about a scale and does not travel: Dangler's R2 sequence is right for
 * eighty anchors and comes out as a visible lattice at nine thousand specks. See
 * `../docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`.
 *
 * What this piece needs is unusual enough to make the point again. The crowd is
 * not placed once; it is *recycled*, continuously, around an observer who is
 * moving through it — so the question is never "where do the people go" but
 * "where does one person enter, so that the crowd they are entering stays
 * uniform". That has an exact answer and it is `entryAngle` below.
 */

import type { Rng } from "@/experiments/random"
import type { GraphPath } from "@/experiments/crowd/path"

/** A point drawn uniformly over a disc. `sqrt` because area grows with r². */
export function discPoint(rng: Rng, radius: number): { x: number; y: number } {
  const r = radius * Math.sqrt(rng())
  const angle = rng() * Math.PI * 2
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) }
}

/**
 * A point drawn uniformly over a disc **intersected with a corridor**.
 *
 * The disc is centred on the observer; the corridor is a strip of half-width
 * `half` about `y = 0` that is **fixed in the world**, so `observerY` is how far
 * the observer currently sits off its centre line. The returned point is an
 * offset from the observer, in both axes.
 *
 * **Both halves of that were wrong once and each cost something.**
 *
 * Clamping instead of sampling stacks every point outside the corridor onto its
 * two boundary lines — a 4 m corridor in a 113 m world rejects 96% of disc
 * samples, so 96% of the crowd went onto two lines with nothing between them and
 * 33 heads reached the screen out of 632.
 *
 * Forgetting `observerY` is worse, because it looks fine for a minute. The
 * corridor is fixed and the disc is not, so a placement that ignores where the
 * observer has drifted to keeps putting people around `y = 0` while the observer
 * walks away from it. The crowd is slowly left behind: at three minutes the
 * observer was 115 m off the centre line with **nobody at all inside 56 m** and
 * re-entries running away at 339 a second, having started at 90.
 *
 * Sampled properly: for a given `y` the disc runs to `±sqrt(R² − y²)`, so `y` is
 * drawn over the part of the strip the disc actually reaches, with density
 * proportional to that chord, and `x` uniformly along it.
 */
export function corridorPoint(rng: Rng, radius: number, observerY: number, half: number): { x: number; y: number } {
  // Open ground: no corridor at all, and the disc is simply the disc.
  if (!Number.isFinite(half)) return discPoint(rng, radius)

  const low = Math.max(-radius, -half - observerY)
  const high = Math.min(radius, half - observerY)
  // The observer is outside their own corridor, which the wall force should
  // prevent. Put people on the nearest legal line rather than dividing by a
  // negative span.
  if (high <= low) return { x: 0, y: (low + high) / 2 }
  if (low <= -radius && high >= radius) return discPoint(rng, radius)

  for (let attempt = 0; attempt < 24; attempt++) {
    const y = low + rng() * (high - low)
    const chord = Math.sqrt(Math.max(0, radius * radius - y * y))
    if (rng() * radius > chord) continue
    return { x: (rng() * 2 - 1) * chord, y }
  }
  return { x: 0, y: low + rng() * (high - low) }
}

/**
 * The angle at which somebody travelling in direction `(ux, uy)` should enter
 * the world.
 *
 * **Not a uniform angle — and not for the reason this file first gave.**
 *
 * The claim was that a uniform angle drains the crowd from the side the observer
 * is walking into. It is a good story and it is false, and a control proved it
 * by *passing*: breaking this function to return a uniform angle changed the
 * measured density ahead of the observer against behind them by nothing at all.
 * The uniform version is self-correcting. Somebody re-entered on the wrong side
 * of the disc is already leaving it, so they are re-entered again immediately,
 * and again, until they land somewhere they can stay — and what survives is the
 * same distribution this function computes in closed form.
 *
 * What it costs is the re-entering: 142 a second against 335 for a uniform
 * angle, over a steady-state window. That is the first thing it buys, and it is
 * what `tests/unit/crowd/throng.test.ts` guards it on.
 *
 * **It buys uniformity too, but only once the world is big.** In a small world
 * the uniform version keeps up and the crowd comes out evenly spread either way,
 * which is how a density check written to guard this function came to pass
 * against a broken one. With the world sized by `reach` it no longer keeps up —
 * the outer rings spread 1.362 against 1.007. Both statements were true when
 * they were made; only the second is true now.
 *
 * The closed form: the rate at which a uniform crowd crosses a boundary element
 * is its density times the inward component of velocity, so the entry angle is
 * distributed as `cos` about the direction the person is coming *from*. Sampling
 * that is one `asin` — for `δ` in (−π/2, π/2) with density proportional to
 * `cos δ`, the inverse CDF is `asin(2ξ − 1)`.
 *
 * `(ux, uy)` is velocity **relative to the observer**, because the disc is the
 * observer's. Somebody standing perfectly still is entering the world at the
 * speed the observer is leaving them behind, and this gets that right for free.
 */
export function entryAngle(rng: Rng, ux: number, uy: number): number {
  const speed = Math.hypot(ux, uy)
  // Nobody moving relative to the observer crosses any boundary at all, so
  // there is no distribution to sample and every angle is as good as another.
  if (speed < 1e-4) return rng() * Math.PI * 2
  const from = Math.atan2(-uy, -ux)
  return from + Math.asin(2 * rng() - 1)
}

/**
 * A heading for one person, given how much grain the crowd has.
 *
 * `stream` mixes between two distributions rather than blending two angles:
 * blending would put everybody at some intermediate heading and produce a crowd
 * that is uniformly a bit diagonal, which is not what a half-streamed crowd
 * looks like. A half-streamed crowd is half of it on the axis and half of it
 * doing its own thing, and those are different pictures.
 *
 * The axis is the observer's own line of travel, so `against` means what it
 * says: toward me.
 */
export function heading(rng: Rng, axis: number, stream: number, against: number): number {
  if (rng() >= stream) return rng() * Math.PI * 2
  // On the axis, with a few degrees of slop: a real file is not a queue of
  // people on a wire, and perfectly parallel walkers never trigger the
  // anticipation that makes the files form in the first place.
  const slop = (rng() - 0.5) * 0.35
  return (rng() < against ? axis + Math.PI : axis) + slop
}

/**
 * A point drawn uniformly over the part of a **band along a path** that falls
 * inside a disc, as an absolute position.
 *
 * The band is `|lateral|` between `inner` and `outer` — `0` and the half-width
 * for the way itself, the half-width and beyond it for a lining on either side.
 * `corridorPoint` is the straight, unlined case of this and stays the one that
 * scene uses, because the scenes built on it were measured against it.
 *
 * **Uniform along the path, not along `x`.** A sample uniform in `x` puts fewer
 * people per metre of path where it runs steeply across the axis, since a metre
 * of `x` there is more than a metre of way. Accepting in proportion to
 * `sec θ` undoes that, normalised by the steepest the path gets.
 */
export function bandPoint(
  rng: Rng,
  radius: number,
  ox: number,
  oy: number,
  path: GraphPath,
  inner: number,
  outer: number,
): { x: number; y: number } {
  const secMax = Math.sqrt(1 + path.steepest * path.steepest)
  const across = () => {
    const side = inner > 0 ? (rng() < 0.5 ? -1 : 1) : 1
    return inner > 0 ? side * (inner + rng() * (outer - inner)) : (rng() * 2 - 1) * outer
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = ox + (rng() * 2 - 1) * radius
    const s = path.slope(x)
    const sec = Math.sqrt(1 + s * s)
    if (!path.straight && rng() * secMax > sec) continue
    const y = path.centre(x) + across() * sec
    const dy = y - oy
    if ((x - ox) * (x - ox) + dy * dy <= radius * radius) return { x, y }
  }
  const s = path.slope(ox)
  return { x: ox, y: path.centre(ox) + across() * Math.sqrt(1 + s * s) }
}

/**
 * Where somebody re-enters a band along a path: the point on it at `radius`
 * from the observer, on the side the flux says they come from.
 *
 * `entryAngle` still decides the side — ahead or behind along the way — which
 * is the part of it that carries the flux. The rest of the angle is thrown
 * away, because in a band a few metres wide the circle meets it at only two
 * places and the across-the-band position is drawn uniformly instead.
 * Bisected along the path, since on a bend there is no closed form.
 */
export function bandEntry(
  rng: Rng,
  angle: number,
  radius: number,
  ox: number,
  oy: number,
  path: GraphPath,
  inner: number,
  outer: number,
): { x: number; y: number } {
  const along = Math.atan(path.slope(ox))
  const side = Math.cos(angle - along) >= 0 ? 1 : -1
  const lateral = inner > 0 ? (rng() < 0.5 ? -1 : 1) * (inner + rng() * (outer - inner)) : (rng() * 2 - 1) * outer
  const at = (t: number) => {
    const x = ox + side * t
    const s = path.slope(x)
    return { x, y: path.centre(x) + lateral * Math.sqrt(1 + s * s) }
  }
  let low = 0
  let high = radius * 2
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    const p = at(mid)
    const d = (p.x - ox) * (p.x - ox) + (p.y - oy) * (p.y - oy)
    if (d > radius * radius) high = mid
    else low = mid
  }
  return at(low)
}
