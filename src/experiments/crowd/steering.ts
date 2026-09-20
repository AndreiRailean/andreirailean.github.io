/**
 * Why two people miss each other, and why it has to be anticipatory.
 *
 * ## The obvious model is visibly wrong and the correct one is barely harder
 *
 * Keep dots apart with a force that grows as they get close and every encounter
 * plays out the same way: two people walk straight at each other and then
 * flinch. Real pedestrians settle nearly every encounter before it is close, by
 * reading where the other person is *going to be*. So everything below is
 * written on **time to collision** rather than on distance, and the whole
 * character of the crowd follows from that one choice:
 *
 * - two people on courses that never meet ignore each other completely, however
 *   narrowly they pass — which is what makes a dense crowd readable rather than
 *   a mass of mutual flinching;
 * - two people on converging courses start easing apart while they are still
 *   several metres away, so the correction is a lean rather than a swerve;
 * - opposing streams sort themselves into files within a few metres, with
 *   nothing in this file knowing what a file is.
 *
 * The form is Karamouzas' — an interaction energy `k·exp(-τ/τ₀)/τ²` that was fit
 * to recorded pedestrian trajectories rather than invented. The exponential is
 * what makes people ignore a collision half a minute away; the `1/τ²` is what
 * makes an imminent one dominate everything else they were doing.
 *
 * ## τ is solved exactly, and the sign of the result is the whole thing
 *
 * `timeToCollision` returns the first moment the two discs touch, or `Infinity`
 * for a pair that never do. **`Infinity` is the common case** and the one worth
 * getting right: a crowd where most pairs return a finite τ is a crowd that
 * shuffles. The one case with no useful answer is a pair already overlapping,
 * which returns 0 and is handled by the contact term instead.
 */

export type Avoider = {
  x: number
  y: number
  vx: number
  vy: number
  /** The radius of the disc this person will not have entered. */
  radius: number
}

/**
 * Seconds. An encounter further off than this is ignored almost completely,
 * which is what stops somebody steering around a person they will pass in a
 * minute's time.
 */
export const HORIZON = 3

/**
 * Seconds. An encounter further off than this is not considered at all.
 *
 * Not the same number as `HORIZON`, which shapes the exponential. This is where
 * the shape has fallen far enough to stop paying for: at τ = 4 the force is 2%
 * of what it is at τ = 1, and cutting there rather than at 7.5 s costs nothing
 * anybody can see and is a third of the pair work.
 *
 * **It is also what sets the detail radius in `throng.ts`.** The fastest pair
 * this piece can produce closes at 5.2 m/s, so four seconds of that is 21 m, and
 * a detail radius any larger than that is simulating encounters nobody in it can
 * yet be having. Raise the pace band's maximum and both numbers move together.
 */
export const CUTOFF = 4

/** Below this, τ is treated as this. Without a floor an imminent collision divides by zero. */
const TAU_FLOOR = 0.12

/**
 * The first moment two discs touch if neither changes course.
 *
 * `Infinity` when they never do — including when they are moving apart, which is
 * the same thing. `0` when they already overlap.
 */
export function timeToCollision(a: Avoider, b: Avoider): number {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const R = a.radius + b.radius

  const gap = rx * rx + ry * ry - R * R
  if (gap <= 0) return 0

  // Relative velocity of b as seen from a, negated: the rate at which the gap
  // between them closes.
  const vx = a.vx - b.vx
  const vy = a.vy - b.vy

  const closing = rx * vx + ry * vy
  if (closing <= 0) return Infinity

  const speed2 = vx * vx + vy * vy
  if (speed2 <= 1e-9) return Infinity

  const disc = closing * closing - speed2 * gap
  if (disc <= 0) return Infinity

  return (closing - Math.sqrt(disc)) / speed2
}

/**
 * The acceleration `a` should take to avoid `b`, in metres per second squared.
 *
 * Added into `out` rather than returned, because this is called for every pair
 * in a neighbourhood and allocating a vector per pair is most of the frame in a
 * dense crowd.
 *
 * **The direction is the gap at the moment of closest approach**, not the
 * current line between them. That distinction is what turns a flinch into a
 * lean: two people walking parallel and slightly converging are pushed
 * *sideways* by this, not backwards, because sideways is where the gap is going
 * to be too small.
 */
export function avoid(a: Avoider, b: Avoider, strength: number, out: { x: number; y: number }): void {
  const tau = timeToCollision(a, b)
  if (tau === Infinity || tau > CUTOFF) return

  const vx = a.vx - b.vx
  const vy = a.vy - b.vy

  // Where b will be relative to a when they are closest.
  let nx = b.x - a.x - vx * tau
  let ny = b.y - a.y - vy * tau
  // `Math.sqrt` of the sum rather than `Math.hypot`. The latter guards against
  // an intermediate overflow on numbers this piece cannot produce — positions
  // are metres and velocities are walking speeds — and it is several times
  // slower in the one loop that dominates the frame.
  let length = Math.sqrt(nx * nx + ny * ny)

  // Dead centre, or already overlapping: there is no closest-approach direction
  // to read, so fall back to the line between them. Two people walking exactly
  // at each other is rare in a simulation and constant in a corridor.
  if (length < 1e-6) {
    nx = b.x - a.x
    ny = b.y - a.y
    length = Math.sqrt(nx * nx + ny * ny)
    if (length < 1e-6) return
  }

  const clamped = Math.max(TAU_FLOOR, tau)
  const magnitude = (strength * Math.exp(-clamped / HORIZON)) / (clamped * clamped)

  out.x -= (nx / length) * magnitude
  out.y -= (ny / length) * magnitude
}

/**
 * **There is no contact term here, and there was one for an afternoon.**
 *
 * The reasoning that put it there reads well and is wrong: anticipation is a
 * force on a *future* collision, so two people already inside each other should
 * feel nothing from it — τ is zero and the closest-approach direction is
 * degenerate. Both halves are false. `timeToCollision` returns 0 for an overlap
 * rather than something unusable, and at τ = 0 the closest-approach direction
 * collapses to the line between the two people, which is exactly the direction a
 * contact term would have pushed along. The `TAU_FLOOR` then makes the magnitude
 * enormous, and the caller's acceleration cap turns it into a firm shove.
 *
 * So the contact term was a second opinion about a force that was already
 * saturated, and the measurement says so flatly. Forty seconds of walk on each
 * of the five scenes, with it and without:
 *
 * | scene          | overlapping pairs per step | worst overlap |
 * | -------------- | -------------------------- | ------------- |
 * | market         | 2.414 → 2.522              | −0.490 m both |
 * | concourse      | 2.526 → 2.392              | −0.419 m both |
 * | standing still | 3.511 → 3.459              | −0.535 m both |
 * | the far end    | 0.300 → 0.293              | −0.399 m both |
 * | waist high     | 2.095 → 2.046              | −0.469 m both |
 *
 * The counts move by less than they move between seeds. **The worst overlap is
 * identical to three decimals in all five**, which is the tell: the contact term
 * was never once the binding force, in any encounter, in either direction.
 *
 * Do not put it back without a measurement that says it does something. If two
 * people are seen to walk through each other, the cause is upstream — see the
 * detail radius in `throng.ts` and `overlapsSeen` in its stats.
 */
