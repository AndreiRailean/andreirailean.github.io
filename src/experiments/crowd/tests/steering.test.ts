import { describe, expect, it } from "vitest"
import { avoid, CUTOFF, timeToCollision, type Avoider } from "@/experiments/crowd/steering"

/**
 * The avoidance, which is the one piece of physics the whole crowd rests on.
 *
 * Every test here is a property rather than a number, and the first one is the
 * property that distinguishes this model from the obvious wrong one: **two
 * people who are not going to collide feel nothing, however close they pass.**
 * A distance-based force fails that and produces a crowd of mutual flinching,
 * which is what the section's plan view found out the hard way.
 */

const walker = (over: Partial<Avoider>): Avoider => ({ x: 0, y: 0, vx: 0, vy: 0, radius: 0.23, ...over })

const push = (a: Avoider, b: Avoider, strength = 2) => {
  const out = { x: 0, y: 0 }
  avoid(a, b, strength, out)
  return out
}

describe("time to collision", () => {
  it("is infinite for two people walking parallel, however narrowly they miss", () => {
    // Half a centimetre of clearance and both going the same way at the same
    // speed. They never touch, so there is nothing to anticipate.
    const a = walker({ y: 0, vx: 1.4 })
    const b = walker({ y: 0.465, vx: 1.4 })
    expect(timeToCollision(a, b)).toBe(Infinity)
    expect(push(a, b)).toEqual({ x: 0, y: 0 })
  })

  it("is infinite for two people moving apart", () => {
    expect(timeToCollision(walker({ vx: -1 }), walker({ x: 2, vx: 1 }))).toBe(Infinity)
  })

  it("is the moment the discs touch, not the moment the centres meet", () => {
    // Head on, ten metres apart, closing at 2 m/s. The centres would meet at
    // t = 5; the discs touch when the gap is 0.46, so 0.23 s earlier.
    const tau = timeToCollision(walker({ vx: 1 }), walker({ x: 10, vx: -1 }))
    expect(tau).toBeCloseTo((10 - 0.46) / 2, 6)
  })

  it("is zero for two people already overlapping, which the contact term then owns", () => {
    expect(timeToCollision(walker({}), walker({ x: 0.3 }))).toBe(0)
  })
})

describe("the avoidance force", () => {
  it("pushes sideways, not backwards, for a pair that is only just converging", () => {
    // Walking the same way, a metre apart, with a slight closing drift. The
    // useful correction is lateral; braking would be a flinch.
    const a = walker({ y: 0, vx: 1.4, vy: 0.08 })
    const b = walker({ y: 1, vx: 1.4, vy: -0.08 })
    const force = push(a, b)
    expect(Math.abs(force.y)).toBeGreaterThan(Math.abs(force.x) * 6)
    // Away from b, which is at +y.
    expect(force.y).toBeLessThan(0)
  })

  it("weakens as the encounter moves further into the future", () => {
    const near = push(walker({ vx: 1 }), walker({ x: 3, vx: -1 }))
    const far = push(walker({ vx: 1 }), walker({ x: 7, vx: -1 }))
    expect(Math.hypot(near.x, near.y)).toBeGreaterThan(Math.hypot(far.x, far.y) * 3)
  })

  it("ignores an encounter past the cutoff entirely", () => {
    // Closing at 1 m/s from just beyond CUTOFF seconds away.
    const apart = CUTOFF * 1 + 1
    expect(push(walker({ vx: 0.5 }), walker({ x: apart, vx: -0.5 }))).toEqual({ x: 0, y: 0 })
  })

  it("has a direction even for a pair walking exactly at each other", () => {
    // Dead centre: the gap at closest approach is zero, so the closest-approach
    // direction is degenerate and the code has to fall back to the line between
    // them. Returning nothing here is a head-on corridor with no avoidance in it.
    const force = push(walker({ vx: 1.4 }), walker({ x: 4, vx: -1.4 }))
    expect(force.x).toBeLessThan(0)
    expect(Number.isFinite(force.y)).toBe(true)
  })
})

describe("an overlap, which there is no separate term for", () => {
  it("is the anticipation's job, and it does it", () => {
    // **This file had a contact term and now does not**, because the measurement
    // said it never once bound. The reasoning that justified it was that τ is
    // zero for an overlap and the closest-approach direction is degenerate;
    // both halves are wrong, and this is the test that says so.
    const force = push(walker({}), walker({ x: 0.3 }))
    expect(force.x).toBeLessThan(0)
    expect(force.y).toBe(0)
  })

  it("is handled even for two people standing perfectly still inside each other", () => {
    // The case a contact term was supposedly for: zero relative velocity, so
    // there is no future collision to anticipate. `timeToCollision` returns 0
    // rather than something unusable, the direction collapses to the line
    // between them, and the τ floor makes the shove firm.
    const force = push(walker({ vx: 0, vy: 0 }), walker({ x: 0.2, vx: 0, vy: 0 }))
    expect(force.x).toBeLessThan(-10)
  })

  it("pushes harder the deeper the overlap is not — it saturates, and the caller caps it", () => {
    // Worth knowing rather than fixing: below the τ floor the magnitude stops
    // depending on how deep the overlap is, and every caller clamps the total
    // acceleration anyway. A barely-touching pair and a merged pair get the same
    // shove, which is why nothing here is proportional to penetration.
    const shallow = push(walker({}), walker({ x: 0.45 }))
    const deep = push(walker({}), walker({ x: 0.05 }))
    expect(Math.abs(deep.x)).toBeCloseTo(Math.abs(shallow.x), 6)
  })
})
