/**
 * Anatomy and gait: everything about a person that is measured rather than
 * chosen.
 *
 * The piece's one design rule is that this file has no settings in it. A number
 * here is a number somebody measured — stature, head breadth, the height a head
 * rises on each step — and the panel cannot reach any of it. What the panel gets
 * is the population those measurements are drawn from: how many children, how
 * fast the adults like to walk, how much the gait is exaggerated for looking at.
 *
 * The reason is that the brief is realism, and the tempting sliders here are all
 * ways to be wrong. A cadence control would let a crowd walk at a stride
 * frequency their legs cannot produce, and it would be reached for constantly,
 * because getting the *look* right by turning the mechanism wrong is always the
 * quickest fix available. Cadence is not a taste; it falls out of leg length and
 * speed, and the whole reason children read as children from above is that
 * theirs comes out higher without anything saying so.
 *
 * ## Where the numbers come from
 *
 * - **Stature.** Adult male 1.75 m (σ 0.07), adult female 1.62 m (σ 0.065),
 *   which are the usual Western anthropometric figures. Children 2–12 are a
 *   straight line through the growth charts: 0.87 m at two, 1.49 m at twelve.
 * - **Head breadth** 0.152 m for an adult, scaled by stature to the power 0.23.
 *   The exponent is derived rather than picked: head circumference at age three
 *   is about 49 cm against an adult 56, a ratio of 0.875, while the stature
 *   ratio is 0.558 — and ln(0.875)/ln(0.558) is 0.23. This is the single most
 *   important number in the piece, because it is why a child's head is only
 *   slightly smaller than an adult's, and why the rest of the size difference
 *   you see has to come from the camera.
 * - **Cephalic index** 0.78 breadth over length, so a head from above is an oval
 *   about a quarter longer than it is wide. That oval is what makes a head's
 *   facing legible at eight pixels across.
 * - **Bideltoid breadth** 0.259 × stature — the width that decides who fits
 *   through a gap.
 * - **Leg length** 0.53 × stature, and **step length** 0.41 × stature at
 *   preferred speed, both from Winter's gait tables.
 * - **Preferred speed** through the Froude number, Fr = v²/(gL). Free-flowing
 *   pedestrians average 1.34 m/s, which for an adult's 0.91 m leg is Fr ≈ 0.20 —
 *   and holding Fr fixed across a population is what makes short people walk
 *   proportionally slower. Walking gives way to running around Fr = 0.5.
 * - **Head oscillation** about 4.5 cm peak to peak vertically, once per step,
 *   and 4 cm laterally, once per stride, which is two steps. Running roughly
 *   triples the vertical and nearly removes the lateral.
 */

import { gaussian, hashSeed, makeRng, type Rng } from "@/experiments/random"

/** Standard gravity, for the Froude relations below. */
const G = 9.81

/** The stature every proportion here is quoted against. */
export const REFERENCE_STATURE = 1.72

/** Leg length as a fraction of stature (Winter). */
const LEG_RATIO = 0.53

/** Step length as a fraction of stature, at preferred speed. */
const STEP_RATIO = 0.41

/** Adult head breadth in metres, and the allometric exponent derived above. */
const HEAD_BREADTH = 0.152
const HEAD_EXPONENT = 0.23

/** Breadth over length. A head from above is an oval, not a circle. */
const CEPHALIC_INDEX = 0.78

/** Vertex-to-chin over breadth, so head height comes from the same one number. */
const HEAD_HEIGHT_RATIO = 0.66

/** Bideltoid breadth as a fraction of stature. */
const SHOULDER_RATIO = 0.259

export type Age = "adult" | "child"

export type Body = {
  age: Age
  /** Metres, floor to vertex. */
  stature: number
  /** Metres, side to side. What the head's oval is drawn from. */
  headBreadth: number
  /** Metres, front to back. */
  headLength: number
  /** Metres, vertex to chin. Only used to find where the head's centre is. */
  headHeight: number
  /** Metres from the ground to the middle of the head, standing. */
  headHeightStanding: number
  /** Metres from the ground to the middle of the head, sitting on the ground. */
  headHeightSitting: number
  /** Metres. Half the bideltoid breadth: the radius that has to fit through gaps. */
  radius: number
  /** Metres. */
  legLength: number
  /** Metres per second, walking, when nothing is in the way. */
  preferredSpeed: number
  /** Metres per second, running. */
  runSpeed: number
}

/**
 * Stature for a child of a given age, from the growth charts.
 *
 * A straight line rather than the real sigmoid, because it is being sampled over
 * ten years in the middle of the curve where the two agree to a centimetre.
 */
export const childStature = (age: number) => 0.87 + 0.062 * (age - 2)

/**
 * The head's oval, from stature alone.
 *
 * Exported separately because the poster and the tests want to state the
 * adult-to-child size ratio without building a whole person.
 */
export const headBreadthFor = (stature: number) => HEAD_BREADTH * Math.pow(stature / REFERENCE_STATURE, HEAD_EXPONENT)

/**
 * Preferred walking speed for a given stature, holding the Froude number fixed.
 *
 * `adultSpeed` is what an adult of the reference stature would choose; everyone
 * else gets the speed with the same Fr, which comes out as a square root of the
 * stature ratio. A 1.10 m child walks at 0.80 of the adult's pace — slower, but
 * not as much slower as their legs are short, which is the whole content of the
 * Froude scaling and is exactly what makes a child at the edge of their group
 * look like they are working at it.
 */
export const speedForStature = (adultSpeed: number, stature: number) =>
  adultSpeed * Math.sqrt(stature / REFERENCE_STATURE)

/** The Froude number a given stature is walking at. Above ~0.5 people run. */
export const froude = (speed: number, stature: number) => (speed * speed) / (G * LEG_RATIO * stature)

/**
 * Builds one person.
 *
 * `adultSpeed` is drawn by the caller from the pace band, so a group can be
 * given one pace and its members' own speeds derived from their heights.
 */
export function makeBody(rng: Rng, age: Age, adultSpeed: number): Body {
  const stature = age === "child" ? childStature(2 + rng() * 10) : adultStature(rng)

  const headBreadth = headBreadthFor(stature)
  const headHeight = headBreadth / HEAD_HEIGHT_RATIO
  const preferredSpeed = speedForStature(adultSpeed, stature)

  return {
    age,
    stature,
    headBreadth,
    headLength: headBreadth / CEPHALIC_INDEX,
    headHeight,
    headHeightStanding: stature - headHeight / 2,
    // Sitting on the ground, the vertex is a little over half of stature up.
    headHeightSitting: 0.53 * stature - headHeight / 2,
    radius: (SHOULDER_RATIO * stature) / 2,
    legLength: LEG_RATIO * stature,
    preferredSpeed,
    // A comfortable jog is about twice a walk, and a child's still scales with
    // their legs. Children run proportionally harder than adults do, which is
    // why this is not simply doubled.
    runSpeed: preferredSpeed * (age === "child" ? 2.35 : 2.05),
  }
}

/**
 * An adult's height, drawn from one of the two sex distributions.
 *
 * Both are used rather than an averaged single distribution because the mixture
 * is bimodal enough to see: a crowd drawn from one 1.685 m distribution has a
 * visibly narrower spread of head sizes than a real one.
 */
function adultStature(rng: Rng): number {
  const male = rng() < 0.5
  const stature = (male ? 1.75 : 1.62) + gaussian(rng) * (male ? 0.07 : 0.065)
  return Math.max(1.45, Math.min(2.02, stature))
}

/**
 * How long a step is at a given speed.
 *
 * People go faster by lengthening the step *and* quickening it, in roughly equal
 * measure — step length goes as about the square root of speed. Getting this
 * wrong is visible: hold step length fixed and a hurrying walker's cadence
 * doubles, which reads as a cartoon scurry.
 */
export const stepLength = (body: Body, speed: number) =>
  STEP_RATIO * body.stature * Math.pow(Math.max(0.15, speed) / Math.max(0.15, body.preferredSpeed), 0.55)

/** Steps per second at a given speed. Two of these make one stride. */
export const cadence = (body: Body, speed: number) => Math.max(0.2, speed / stepLength(body, speed))

/**
 * What the gait does to the head, in metres, at a point in the stride.
 *
 * `stride` is a phase in [0, 1) covering two steps. The rise and fall happens
 * once per *step*, so at twice that frequency; the sway happens once per stride,
 * because the weight goes over one foot and then the other.
 *
 * Both amplitudes grow with speed and both are quoted against stature, so a
 * child bobs less in absolute terms and about the same in proportion — which is
 * right, and is why the crowd does not read as a set of one thing at different
 * zooms.
 */
export function gaitOffset(
  body: Body,
  stride: number,
  speed: number,
  running: boolean,
): { rise: number; sway: number } {
  const effort = Math.min(2.2, Math.max(0.2, speed / Math.max(0.2, body.preferredSpeed)))
  const turn = stride * Math.PI * 2

  if (running) {
    // A runner leaves the ground, so the vertical excursion is three times a
    // walker's and shaped less like a sine — flatter at the top of the flight
    // phase, sharper at the landing. The lateral sway all but disappears,
    // because the feet land closer to the midline.
    const rise = 0.035 * body.stature * effort * Math.sin(turn * 2)
    return { rise, sway: 0.004 * body.stature * Math.sin(turn) }
  }

  return {
    rise: 0.013 * body.stature * Math.pow(effort, 0.8) * Math.sin(turn * 2),
    sway: 0.011 * body.stature * Math.pow(effort, 0.5) * Math.sin(turn),
  }
}

/**
 * The wander of a head that is standing still.
 *
 * Quiet standing is not still: the body is an inverted pendulum being caught
 * continuously, and the head describes a centimetre or two of slow irregular
 * ellipse at a fraction of a hertz. Two sines at an irrational ratio, so it
 * never repeats, which is cheaper than a random walk and does not drift away.
 */
export function posturalSway(body: Body, clock: number, phase: number): { x: number; y: number } {
  const amplitude = 0.009 * body.stature
  return {
    x: amplitude * Math.sin(clock * 0.41 + phase) + amplitude * 0.6 * Math.sin(clock * 0.67 + phase * 2.3),
    y: amplitude * Math.sin(clock * 0.29 + phase * 1.7) + amplitude * 0.6 * Math.sin(clock * 0.53 + phase),
  }
}

/**
 * A person's build, from a seed and an index.
 *
 * Indexed rather than streamed, so walker seven is the same person however many
 * others have come and gone before them — the same reason every other piece in
 * the section derives a private generator per unit instead of pulling from one
 * shared stream.
 */
export const rngFor = (seed: number, ...salts: number[]): Rng => makeRng(hashSeed(seed, ...salts))
