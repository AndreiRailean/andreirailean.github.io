import { describe, expect, it } from "vitest"
import { makeCanopy } from "@/experiments/dangler/canopy"

/**
 * The invisible object overhead that the strands hang from.
 *
 * The invariant that matters most in the whole piece lives here: anchor `i`
 * comes from an R2 sequence indexed by `i`, never from successive draws. Break
 * it and raising the strand count reshuffles the strands already on screen.
 */

const SHAPE = { extent: 2.6, ceiling: 4, relief: 0.9, branches: 0 }

const anchorsOf = (canopy: ReturnType<typeof makeCanopy>, count: number) =>
  Array.from({ length: count }, (_, i) => canopy.anchorFor(i))

describe("anchorFor", () => {
  it("is a pure function of the seed and the index", () => {
    // Two canopies built the same way must agree, because nothing may depend on
    // how many anchors were asked for or in what order.
    const one = makeCanopy(7, SHAPE)
    const other = makeCanopy(7, SHAPE)
    expect(anchorsOf(one, 3)).toEqual(anchorsOf(other, 3))
  })

  it("does not move an anchor as the count grows", () => {
    const canopy = makeCanopy(7, SHAPE)
    const few = anchorsOf(canopy, 6)
    const many = anchorsOf(canopy, 60)
    expect(few).toEqual(many.slice(0, few.length))
  })

  it("keeps every anchor inside the canopy disc", () => {
    const canopy = makeCanopy(7, SHAPE)
    const furthest = Math.max(...anchorsOf(canopy, 200).map((a) => Math.hypot(a.x, a.y)))
    expect(furthest).toBeLessThanOrEqual(SHAPE.extent + 1e-6)
  })
})

describe("relief", () => {
  it("varies the height of the ceiling", () => {
    const heights = anchorsOf(makeCanopy(7, SHAPE), 200).map((a) => a.z)
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.2)
  })

  it("is a flat ceiling at 0", () => {
    const flat = makeCanopy(7, { ...SHAPE, relief: 0 })
    for (const anchor of anchorsOf(flat, 4)) expect(anchor.z).toBeCloseTo(SHAPE.ceiling, 6)
  })

  it("makes neighbouring anchors closer in height than distant ones", () => {
    // Relief is a surface, not noise: without this it would be per-anchor jitter
    // and the canopy would not read as one object.
    const points = anchorsOf(makeCanopy(7, SHAPE), 120)
    let nearTotal = 0
    let nearCount = 0
    let farTotal = 0
    let farCount = 0
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const apart = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y)
        const heightDifference = Math.abs(points[i]!.z - points[j]!.z)
        if (apart < 0.4) {
          nearTotal += heightDifference
          nearCount++
        } else if (apart > 3) {
          farTotal += heightDifference
          farCount++
        }
      }
    }
    expect(nearTotal / nearCount).toBeLessThan(farTotal / farCount)
  })
})

describe("branches", () => {
  const CLUMPED = { extent: 2.4, ceiling: 4.2, relief: 0.9, branches: 5 }

  /** Mean distance between every pair, in the ground plane. */
  const spread = (points: { x: number; y: number }[]) => {
    let total = 0
    let pairs = 0
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        total += Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y)
        pairs++
      }
    }
    return total / pairs
  }

  it("still does not move an anchor as the count grows", () => {
    const canopy = makeCanopy(7, CLUMPED)
    expect(anchorsOf(canopy, 6)).toEqual(anchorsOf(canopy, 60).slice(0, 6))
  })

  it("keeps clustered anchors inside the canopy", () => {
    for (const anchor of anchorsOf(makeCanopy(7, CLUMPED), 60)) {
      expect(Math.hypot(anchor.x, anchor.y)).toBeLessThanOrEqual(CLUMPED.extent + 1e-6)
    }
  })

  it("clumps the anchors of one arm together", () => {
    // Or there are no clumps and the control does nothing.
    const anchors = anchorsOf(makeCanopy(7, CLUMPED), 60)
    const oneArm = anchors.filter((_, i) => i % CLUMPED.branches === 0)
    expect(spread(oneArm)).toBeLessThan(spread(anchors) * 0.75)
  })

  // Arms have to span the radius. Holding them back to the outer part of it grew
  // a bare disc in the middle as `spread` widened, and drove every bulb to the
  // edge of the frame. Separation comes from `sweep` instead, which costs no
  // coverage.
  it("reaches in close to the trunk and out to the rim", () => {
    const radii = anchorsOf(makeCanopy(7, CLUMPED), 60).map((a) => Math.hypot(a.x, a.y))
    expect(Math.min(...radii)).toBeLessThan(CLUMPED.extent * 0.16)
    expect(Math.max(...radii)).toBeGreaterThan(CLUMPED.extent * 0.85)
  })

  it("spans most of the radius even at two arms", () => {
    // Two is the hard case: few samples, so a narrow per-arm range shows up as
    // poor coverage of the canopy as a whole.
    const radii = anchorsOf(makeCanopy(7, { ...CLUMPED, branches: 2 }), 40).map((a) => Math.hypot(a.x, a.y))
    expect(Math.min(...radii)).toBeLessThan(CLUMPED.extent * 0.16)
    expect(Math.max(...radii)).toBeGreaterThan(CLUMPED.extent * 0.8)
  })

  it("is the old even scatter when off, so recorded scenes are untouched", () => {
    const off = makeCanopy(7, { ...CLUMPED, branches: 0 })
    const reference = makeCanopy(7, { extent: 2.4, ceiling: 4.2, relief: 0.9, branches: 0 })
    for (const i of [0, 1, 2, 17]) expect(off.anchorFor(i)).toEqual(reference.anchorFor(i))
  })
})
