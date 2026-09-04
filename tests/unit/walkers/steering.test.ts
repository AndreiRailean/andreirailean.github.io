import { describe, expect, it } from "vitest"
import {
  avoidance,
  HORIZON,
  overlapOf,
  passingBias,
  personalSpace,
  seek,
  SIDE_PREFERENCE,
  timeToCollision,
  weightBehind,
  type Disc,
  type Force,
} from "@/experiments/walkers/steering"

/**
 * The avoidance law, on its own.
 *
 * Worth testing away from the crowd because the whole piece rests on one claim:
 * that people react to *when* they would collide rather than to how far apart
 * they are. Every property below distinguishes the two — a distance-based
 * repulsion would fail all of them, and would still look plausible in a
 * screenshot.
 */

const walker = (patch: Partial<Disc> = {}): Disc => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0.22, ...patch })

const out: Force = { x: 0, y: 0 }

describe("time to collision", () => {
  it("is the gap over the closing speed, head on", () => {
    const a = walker({ x: 0, vx: 1 })
    const b = walker({ x: 5, vx: -1 })
    // Five metres apart, 0.44 m of body between them, closing at 2 m/s.
    expect(timeToCollision(a, b)).toBeCloseTo((5 - 0.44) / 2, 6)
  })

  it("is infinite when they are not closing at all", () => {
    expect(timeToCollision(walker({ x: 0, vx: 1 }), walker({ x: 5, vx: 1 }))).toBe(Infinity)
    expect(timeToCollision(walker({ x: 0 }), walker({ x: 5 }))).toBe(Infinity)
  })

  it("is infinite for a course that passes clear, however close", () => {
    // Crossing paths, but b is a metre to the side and moving away laterally.
    const a = walker({ x: 0, y: 0, vx: 1 })
    const b = walker({ x: 5, y: 1, vx: 1, vy: 1 })
    expect(timeToCollision(a, b)).toBe(Infinity)
  })

  it("is zero when they are already touching", () => {
    expect(timeToCollision(walker({ x: 0 }), walker({ x: 0.3, vx: -1 }))).toBe(0)
  })
})

describe("avoidance", () => {
  it("brakes rather than swerves when the approach is exactly head on", () => {
    const a = walker({ x: 0, vx: 1.3 })
    const b = walker({ x: 4, vx: -1.3 })
    avoidance(a, b, out)

    expect(out.x).toBeLessThan(0)
    expect(Math.abs(out.y)).toBeLessThan(1e-9)
  })

  /**
   * The one that separates this model from a repulsion.
   *
   * Two people the same distance apart, one on a converging course and one on a
   * course that misses. A distance-based force gives them the same answer. This
   * gives the second one nothing at all.
   */
  it("ignores somebody who is going to miss and reacts to somebody who is not", () => {
    const converging = { a: walker({ vx: 1.3 }), b: walker({ x: 4, vx: -1.3 }) }
    const clear = { a: walker({ vx: 1.3 }), b: walker({ x: 4, vx: 1.3 }) }

    avoidance(converging.a, converging.b, out)
    const reacted = Math.hypot(out.x, out.y)

    avoidance(clear.a, clear.b, out)
    const ignored = Math.hypot(out.x, out.y)

    expect(reacted).toBeGreaterThan(0.1)
    expect(ignored).toBe(0)
  })

  it("reacts harder the sooner the collision is", () => {
    const near = walker({ x: 2, vx: -1.3 })
    const far = walker({ x: 6, vx: -1.3 })

    avoidance(walker({ vx: 1.3 }), near, out)
    const soon = Math.hypot(out.x, out.y)
    avoidance(walker({ vx: 1.3 }), far, out)
    const later = Math.hypot(out.x, out.y)

    expect(soon).toBeGreaterThan(later)
  })

  it("stops caring past the horizon", () => {
    // Far enough that the collision is well over the cutoff away.
    const a = walker({ vx: 0.4 })
    const b = walker({ x: 0.4 * HORIZON * 8, vx: -0.4 })
    avoidance(a, b, out)
    expect(Math.hypot(out.x, out.y)).toBeLessThan(0.01)
  })

  it("steps aside as well as slowing, when the approach is off centre", () => {
    const a = walker({ vx: 1.3 })
    const b = walker({ x: 4, y: 0.3, vx: -1.3 })
    avoidance(a, b, out)

    // Away from the side b is on, and enough of it to matter.
    expect(out.y).toBeLessThan(0)
    expect(Math.abs(out.y)).toBeGreaterThan(0.05 * Math.abs(out.x))
  })

  it("is symmetric: each pushes the other the opposite way", () => {
    const a = walker({ vx: 1.3 })
    const b = walker({ x: 4, y: 0.3, vx: -1.3 })

    avoidance(a, b, out)
    const first = { x: out.x, y: out.y }
    avoidance(b, a, out)

    expect(out.x).toBeCloseTo(-first.x, 6)
    expect(out.y).toBeCloseTo(-first.y, 6)
  })
})

describe("personal space", () => {
  it("keeps two people apart who are not moving at all", () => {
    // Exactly the case the anticipatory term cannot see: tau is infinite.
    const a = walker({ x: 0 })
    const b = walker({ x: 0.6 })
    avoidance(a, b, out)
    expect(Math.hypot(out.x, out.y)).toBe(0)

    personalSpace(a, b, out)
    expect(out.x).toBeLessThan(0)
  })

  it("falls away with distance and reaches nothing at conversational range", () => {
    personalSpace(walker(), walker({ x: 0.6 }), out)
    const close = Math.abs(out.x)
    personalSpace(walker(), walker({ x: 1.4 }), out)
    const away = Math.abs(out.x)

    expect(close).toBeGreaterThan(away * 4)
    personalSpace(walker(), walker({ x: 4 }), out)
    expect(out.x).toBe(0)
  })
})

describe("the vision cone", () => {
  it("weights somebody ahead above somebody behind, and never to nothing", () => {
    const a = walker({ vx: 1.3 })
    const ahead = weightBehind(a, 1, 0)
    const behind = weightBehind(a, -1, 0)
    const beside = weightBehind(a, 0, 1)

    expect(ahead).toBeCloseTo(1, 6)
    expect(behind).toBeLessThan(0.3)
    expect(behind).toBeGreaterThan(0)
    expect(beside).toBeGreaterThan(behind)
    expect(beside).toBeLessThan(ahead)
  })

  it("has no opinion about anyone when the walker is standing still", () => {
    expect(weightBehind(walker(), -1, 0)).toBe(1)
  })
})

describe("contact and seeking", () => {
  it("measures how far two bodies have been pushed into each other", () => {
    expect(overlapOf(walker(), walker({ x: 1 }))).toBe(0)
    expect(overlapOf(walker(), walker({ x: 0.4 }))).toBeCloseTo(0.04, 9)
  })

  it("steers toward a wanted velocity rather than snapping to it", () => {
    const a = walker({ vx: 0 })
    seek(a, 1.3, 0, 0.5, out)
    // Half a second's relaxation: the acceleration is the shortfall over tau.
    expect(out.x).toBeCloseTo(2.6, 9)
    expect(out.y).toBe(0)
  })
})

describe("the side to pass on", () => {
  const avoidanceFor = (a: Disc, b: Disc): Force => {
    const force: Force = { x: 0, y: 0 }
    avoidance(a, b, force)
    return force
  }

  it("steps to the walker's own right when somebody is coming the other way", () => {
    // Walking along +x, so their right is −y.
    const a = walker({ vx: 1.3 })
    const b = walker({ x: 3, vx: -1.3 })
    const avoid = avoidanceFor(a, b)

    passingBias(a, b, avoid, SIDE_PREFERENCE, 1, out)
    expect(out.y).toBeLessThan(0)
    expect(Math.abs(out.x)).toBeLessThan(1e-9)

    passingBias(a, b, avoid, SIDE_PREFERENCE, -1, out)
    expect(out.y).toBeGreaterThan(0)
  })

  /**
   * The property that keeps it from taking the piece over.
   *
   * Written as a constant nudge per oncoming neighbour, it summed over
   * everybody in view and brought the whole crowd to a quarter of a walking
   * pace. As a fraction of the avoidance it can never be larger than the
   * manoeuvre it is choosing a side for.
   */
  it("is a fraction of the avoidance it belongs to, never more", () => {
    const a = walker({ vx: 1.3 })
    const b = walker({ x: 3, vx: -1.3 })
    const avoid = avoidanceFor(a, b)

    passingBias(a, b, avoid, SIDE_PREFERENCE, 1, out)
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(Math.hypot(avoid.x, avoid.y) * SIDE_PREFERENCE, 9)
  })

  it("says nothing where there is no avoidance to bias", () => {
    // Somebody four metres away on a course that misses: no manoeuvre, no side.
    const a = walker({ vx: 1.3 })
    const b = walker({ x: 4, y: 3, vx: -1.3, vy: 3 })
    passingBias(a, b, avoidanceFor(a, b), SIDE_PREFERENCE, 1, out)
    expect(out.x).toBe(0)
    expect(out.y).toBe(0)
  })

  /**
   * Overtaking has no convention. Biasing it puts a permanent sideways drift on
   * anybody following anybody, which reads as the whole crowd sliding.
   */
  it("says nothing about somebody going the same way", () => {
    const a = walker({ vx: 1.3 })
    const b = walker({ x: 3, vx: 1 })
    passingBias(a, b, { x: 1, y: 0 }, SIDE_PREFERENCE, 1, out)
    expect(out.x).toBe(0)
    expect(out.y).toBe(0)
  })

  it("says nothing at all about somebody standing still", () => {
    passingBias(walker({ vx: 0.05 }), walker({ x: 3, vx: -1.3 }), { x: 1, y: 0 }, SIDE_PREFERENCE, 1, out)
    expect(out.x).toBe(0)
    expect(out.y).toBe(0)
  })
})
