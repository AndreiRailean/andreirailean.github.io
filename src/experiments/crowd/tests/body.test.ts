import { describe, expect, it } from "vitest"
import {
  BOB_RISE,
  cadence,
  eyeHeight,
  freeSpeed,
  headBob,
  headBreadth,
  headCentre,
  RUN_RISE,
  statureAtAge,
} from "@/experiments/crowd/body"

/**
 * The anatomy, and the one claim the whole piece rests on.
 */

const ADULT = 1.75
const FOUR_YEAR_OLD = statureAtAge(4)

describe("why this view works where the plan view did not", () => {
  it("gives a child a head nearly as wide as an adult's", () => {
    // The fact that defeats the view from directly above: head breadth barely
    // scales with stature, so from far enough up a crowd of adults and children
    // is very nearly uniform.
    const ratio = headBreadth(ADULT) / headBreadth(FOUR_YEAR_OLD)
    expect(ratio).toBeGreaterThan(1.03)
    expect(ratio).toBeLessThan(1.12)
  })

  it("and puts it half a metre lower, which is the cue this view gets for free", () => {
    // The same two people, seen from inside the crowd. Nothing else in the piece
    // distinguishes a child; if this gap ever closes, it stops having children
    // in it at all.
    expect(headCentre(ADULT) - headCentre(FOUR_YEAR_OLD)).toBeGreaterThan(0.5)
  })
})

describe("the observer's own height", () => {
  it("is a stature, and eye height is eleven centimetres less", () => {
    // **The distinction that was a real bug.** The setting was eye height for an
    // afternoon, so `1.70` meant a person 1.82 m tall — taller than nine adults
    // in ten — and every preset built on it put the whole crowd below the
    // horizon while looking like nothing worse than a crowd of short people.
    expect(ADULT - eyeHeight(ADULT)).toBeGreaterThan(0.1)
    expect(ADULT - eyeHeight(ADULT)).toBeLessThan(0.13)
  })

  it("puts an average adult's head on the horizon of an average adult's eye", () => {
    // What "some are taller than me, others are shorter" needs in order to be
    // true: the middle of the crowd should sit at the middle of the frame.
    expect(Math.abs(headCentre(ADULT) - eyeHeight(ADULT))).toBeLessThan(0.05)
  })
})

describe("the gait, which nothing states", () => {
  it("makes a child step faster than the adult they are walking with", () => {
    // Both at their own free speed. Nothing in the piece says children step
    // faster; it comes out of leg length twice — once through `freeSpeed` and
    // once through the stride.
    const adult = cadence(ADULT, freeSpeed(ADULT, 1), freeSpeed(ADULT, 1))
    const child = cadence(FOUR_YEAR_OLD, freeSpeed(FOUR_YEAR_OLD, 1), freeSpeed(FOUR_YEAR_OLD, 1))
    expect(child).toBeGreaterThan(adult * 1.2)
  })

  it("puts an adult at about two steps a second, which is what a person walks at", () => {
    // 1.75 m at 1.34 m/s is 110-120 steps a minute in every gait study there is.
    // The number is here so that a change to the stride relation has to argue
    // with reality rather than with taste.
    const steps = cadence(ADULT, 1.34, 1.34) * 60
    expect(steps).toBeGreaterThan(108)
    expect(steps).toBeLessThan(124)
  })

  it("quickens when somebody speeds up, rather than only lengthening the stride", () => {
    const easy = cadence(ADULT, 1.1, 1.34)
    const brisk = cadence(ADULT, 1.9, 1.34)
    expect(brisk).toBeGreaterThan(easy)
    // But not proportionally: the stride grows too, so cadence goes as the 0.4
    // power of speed rather than the first. Doubling the speed must not double
    // the step rate.
    expect(brisk / easy).toBeLessThan(1.9 / 1.1)
  })

  it("stops entirely when somebody stops, rather than marking time", () => {
    expect(cadence(ADULT, 0, 1.34)).toBe(0)
  })
})

/**
 * The bob, on one head that is not going anywhere.
 *
 * **These used to be walks**: my head's bounce was measured by running the
 * runner's way for twenty seconds, and nobody else's was measured at all
 * (#287). A head bobs by its step phase and its speed and nothing else, so a
 * phase swept through one stride, at a speed, is the whole of it. That a walk
 * advances the phase is the gait's, above; that the crowd and I are drawn with
 * this is one frame in `draw.test.ts` and my runner's bounce in
 * `structure.test.ts`.
 *
 * Every "break it" note below was done.
 */
describe("the bob", () => {
  const WALKING = 1.34
  /** Over one stride, two steps: how far the head rises and falls, and how far it sways. */
  function stride(runMix: number, speed: number, amount = 1) {
    const out = { rise: 0, sway: 0 }
    let low = Infinity
    let high = -Infinity
    let left = Infinity
    let right = -Infinity
    for (let i = 0; i < 720; i++) {
      headBob((i / 720) * 4 * Math.PI, runMix, speed, amount, out)
      low = Math.min(low, out.rise)
      high = Math.max(high, out.rise)
      left = Math.min(left, out.sway)
      right = Math.max(right, out.sway)
    }
    return { rise: high - low, sway: right - left }
  }

  it("does nothing on somebody standing still, walking or running", () => {
    // Break it: drop `moving` and a standing crowd bobs on the spot.
    for (const runMix of [0, 0.5, 1]) {
      const still = stride(runMix, 0)
      expect(still.rise).toBe(0)
      expect(still.sway).toBe(0)
    }
  })

  it("rises and falls about 4.6 cm in a walk and 8 cm in a run, and sways less in a run", () => {
    // "maybe because my bobbing is still walk-like": a run is a bigger bounce.
    // Break it: give the run a walk's rise and the third line goes red.
    const walk = stride(0, WALKING)
    const run = stride(1, 3)
    expect(walk.rise).toBeCloseTo(2 * BOB_RISE, 3)
    expect(run.rise).toBeCloseTo(2 * RUN_RISE, 3)
    expect(run.rise).toBeGreaterThan(walk.rise * 1.5)
    expect(run.sway).toBeLessThan(walk.sway * 0.5)
  })

  it("rises once a step and sways once a stride", () => {
    // A step on, the rise is back where it was and the weight is on the other foot.
    // Break it: sway at the step's rate and the second line goes red.
    const out = { rise: 0, sway: 0 }
    const a = { ...headBob(0.7, 0, WALKING, 1, out) }
    const b = { ...headBob(0.7 + 2 * Math.PI, 0, WALKING, 1, out) }
    expect(b.rise).toBeCloseTo(a.rise, 12)
    expect(b.sway).toBeCloseTo(-a.sway, 12)
    expect(Math.abs(a.sway)).toBeGreaterThan(0.005)
  })

  it("fades in with speed, scales with the setting, and eases from a walk to a run", () => {
    expect(stride(0, 0.35 / 2).rise).toBeCloseTo(stride(0, WALKING).rise / 2, 6)
    expect(stride(0, WALKING, 3).rise).toBeCloseTo(stride(0, WALKING).rise * 3, 6)
    expect(stride(0, WALKING, 0).rise).toBe(0)
    const halfway = stride(0.5, 3).rise
    expect(halfway).toBeGreaterThan(stride(0, 3).rise)
    expect(halfway).toBeLessThan(stride(1, 3).rise)
  })
})
