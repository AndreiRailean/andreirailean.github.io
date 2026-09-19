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

/** A point drawn uniformly over a disc. `sqrt` because area grows with r². */
export function discPoint(rng: Rng, radius: number): { x: number; y: number } {
  const r = radius * Math.sqrt(rng())
  const angle = rng() * Math.PI * 2
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) }
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
 * What it costs is the re-entering. Measured over 150 seconds of a crowd all
 * walking at the observer, 4,500 people:
 *
 * | re-entry angle | re-entries per second |
 * | -------------- | --------------------- |
 * | flux-weighted  | 99                    |
 * | uniform        | 232                   |
 *
 * **2.35x the work for an identical picture**, and each re-entry draws a fresh
 * errand and rewrites a velocity. So this is an efficiency, said to be one, and
 * `tests/unit/crowd/throng.test.ts` guards it on the re-entry rate — which is
 * the only statistic that can see it. A density check cannot, and one was
 * written that could not, and it passed against a broken version of this
 * function for an hour before anybody tried breaking it on purpose.
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
