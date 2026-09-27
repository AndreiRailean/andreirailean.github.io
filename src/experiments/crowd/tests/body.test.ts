import { describe, expect, it } from "vitest"
import { cadence, eyeHeight, freeSpeed, headBreadth, headCentre, statureAtAge } from "@/experiments/crowd/body"

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
