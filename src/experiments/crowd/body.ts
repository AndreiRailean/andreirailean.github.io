/**
 * What a person is, in metres and seconds.
 *
 * **Nothing here is a taste, so nothing here is a setting.** The line this piece
 * draws is the same one Walkers draws: a slider exists where somebody could
 * reasonably want a different world, a constant exists where the world already
 * decided. How tall people are, how wide a head is, how fast the legs go — all
 * measured, all here. How many of them there are and which way they are going —
 * settings.
 *
 * ## Heads barely differ, and at eye level that stops mattering
 *
 * A four-year-old's head is about seven-eighths of an adult's across, where
 * their stature is barely more than half. From directly overhead that is nearly
 * the whole signal, and Walkers had to fight it — `view.ts` there is a long note
 * about how little of a person's size survives the trip up to a plan view.
 *
 * **From inside the crowd the fight is over before it starts.** A head is placed
 * in the frame by where it is, and a child's head sits 60 cm lower than the
 * adult's beside it. Two circles of nearly the same size at visibly different
 * heights is a child and a parent, instantly, with nothing drawn but the
 * circles. The cue the plan view could not have is the one this view gets for
 * free, and it is the reason the piece works at all.
 *
 * ## Gait comes out of the legs, so children step faster with nobody saying so
 *
 * Stride length at a person's own preferred speed is about 0.83 of their
 * stature, and cadence is two steps per stride — 1.75 m and 1.4 m/s give about
 * 116 steps a minute, which is what a person actually walks at. Feed a 1.10 m
 * child through the same two lines and it comes out at 146, which is also what a
 * child actually walks at. Neither number is written down.
 */

import { gaussian, type Rng } from "@/experiments/random"

/**
 * Adult stature, as a mixture of two normals rather than one.
 *
 * A single distribution over adults has to be wide enough to cover both sexes,
 * which makes it flat — and a flat one puts too many people at the extremes,
 * where a crowd reads as a cartoon of variety. Two narrow ones at 1.75 and 1.62
 * is what a real crowd looks like: a lot of people within a few centimetres of
 * each other, and a genuine step between the two clusters.
 */
const ADULT_TALL = { mean: 1.75, sd: 0.07 }
const ADULT_SHORT = { mean: 1.62, sd: 0.065 }

/**
 * One adult's stature, in metres.
 *
 * Here rather than at the point of use so that the two clusters and the widths
 * are stated once, beside the reason for them. A crowd is the one place where
 * getting a distribution slightly wrong is visible in aggregate and invisible in
 * any single person.
 */
export function adultStature(rng: Rng): number {
  const cluster = rng() < 0.5 ? ADULT_TALL : ADULT_SHORT
  return cluster.mean + gaussian(rng) * cluster.sd
}

/** The age band children are drawn from, in years. */
export const CHILD_AGES = { min: 2, max: 12 }

/**
 * Stature of a child at a given age, in metres.
 *
 * Growth between two and twelve is close enough to linear that a curve would be
 * pretending: 0.87 m at two and 1.49 m at twelve, and the straight line between
 * them is within two centimetres of the growth charts the whole way.
 */
export const statureAtAge = (age: number): number => 0.75 + 0.062 * age

/**
 * Head breadth in metres, including hair, from stature.
 *
 * **Deliberately a weak function of height, because a head is.** Head breadth
 * scales as roughly the fifth root of stature across the whole human range, so
 * the fit here is a straight line with four fifths of its value in the constant
 * term: a 1.10 m child comes out at 0.141 against an adult's 0.152, a ratio of
 * 1.08. Anybody tempted to make children read smaller by widening this gap is
 * making the crowd wrong in the one place it is currently right — reach for
 * where the head *is*, which is already doing the work.
 */
export const headBreadth = (stature: number): number => 0.152 * (0.8 + 0.2 * (stature / 1.75))

/** Vertex-to-chin, in metres. A child's head is proportionally larger, hence the same shape of fit. */
export const headHeight = (stature: number): number => 0.225 * (0.78 + 0.22 * (stature / 1.75))

/**
 * Height of the centre of the head above the ground, in metres.
 *
 * What the projection actually places. Not eye height and not stature: the
 * circle is the head, so its centre is half a head down from the top of it.
 */
export const headCentre = (stature: number): number => stature - headHeight(stature) / 2

/**
 * Eye height above the ground, which is 0.935 of stature.
 *
 * **The observer's setting is their stature, not this**, and the difference is
 * 11 cm — enough that reading one for the other puts the whole crowd on the
 * wrong side of the horizon while looking like nothing worse than a crowd of
 * short people. It was exactly that for the piece's first afternoon.
 */
export const EYE_RATIO = 0.935
export const eyeHeight = (stature: number): number => EYE_RATIO * stature

/**
 * Half the shoulder width, plus the room a person keeps around themselves.
 *
 * Biacromial breadth is about 0.40 m for an adult, so 0.20 m of body — and
 * nobody walks within 0.20 m of a stranger, so this is a little more than that
 * and stands for the disc a person is unwilling to have entered. It is the `R`
 * every avoidance calculation is written against.
 */
export const bodyRadius = (stature: number): number => 0.23 * (0.6 + 0.4 * (stature / 1.75))

/** Leg length, for the pendulum below. Greater trochanter height is about 0.53 of stature. */
export const legLength = (stature: number): number => 0.53 * stature

/**
 * The speed this person walks at when nothing is in their way, in metres/second.
 *
 * A walking leg is a pendulum, so preferred speed goes as the square root of leg
 * length — the same Froude scaling that makes small animals take quick short
 * steps. An adult of 1.75 m walks at 1.34 m/s, which is the anchor; everybody
 * else is that scaled by `sqrt(stature / 1.75)`.
 *
 * **Gravity is absent on purpose, and a `sqrt(g / 9.81)` factor was here doing
 * nothing.** Froude scaling is `v ∝ sqrt(g·L)`, but this is anchored on a
 * measured human speed rather than derived from first principles, so `g` divides
 * out exactly. Writing it anyway made the line look like physics it was not
 * doing, and it multiplied by one.
 *
 * `vigour` is the person's own deviation from it, a multiplier the crowd draws
 * per person so that two people of the same height are not the same walker.
 */
export const freeSpeed = (stature: number, vigour: number): number => 1.34 * Math.sqrt(stature / 1.75) * vigour

/**
 * Stride length in metres at a given speed — two steps, left and right.
 *
 * 0.83 statures at the person's own preferred speed, growing as the 0.6 power of
 * how much faster than that they are going. The exponent is Grieve's, from
 * treadmill data: people lengthen their stride and quicken their cadence
 * together, and neither alone accounts for a speed change.
 */
export function strideLength(stature: number, speed: number, preferred: number): number {
  const ratio = Math.max(0.15, speed / Math.max(0.05, preferred))
  return 0.83 * stature * Math.pow(ratio, 0.6)
}

/** Steps per second: two per stride, hence the 2. */
export function cadence(stature: number, speed: number, preferred: number): number {
  if (speed <= 0.02) return 0
  return (2 * speed) / strideLength(stature, speed, preferred)
}

/**
 * How far a walking head rises and falls, and how far it swings sideways.
 *
 * The head traces a flattened figure of eight. It rises about 2.3 cm above and
 * below its mean **once per step** — the body vaults over each stiff leg in turn
 * — and swings about 2 cm either side **once per stride**, because the weight
 * goes over one foot and then the other and that is two steps.
 *
 * Both are given as amplitudes, both scale with stature, and both are far too
 * small to see on anybody else at ten metres. They are not there to be seen on
 * anybody else: the one head they are unmistakable on is the observer's own,
 * where the whole frame moves with them, and a frame that does not do this reads
 * as a camera on rails rather than as a person.
 */
export const BOB_RISE = 0.023
export const BOB_SWAY = 0.02
