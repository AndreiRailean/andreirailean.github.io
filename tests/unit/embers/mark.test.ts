import { describe, expect, it } from "vitest"
import { coreRadius, haloRadius } from "@/experiments/embers/draw"
import { MARKS } from "@/experiments/embers/settings"

/**
 * The geometry of one mark, which is also the piece's frame budget.
 *
 * Compositing a scaled sprite costs its destination **area**, so a frame costs
 * the sum of the squares of the halo radii — which makes `flare` the performance
 * control and `count` not, the opposite of what anybody guesses and the single
 * least obvious thing about the piece.
 *
 * This was a browser test asserting on `drawMs`, and it was genuinely flaky for
 * a reason no threshold fixes: a wall-clock ratio under four parallel workers
 * has contention added to both halves, so it approaches 1 at enough load. The
 * relationship is arithmetic, so it is checked as arithmetic; the measured
 * magnitude — 27 ms against 5 ms at three thousand embers — is recorded in
 * `src/experiments/embers/AGENTS.md`, which is where a measurement belongs.
 */

/** What a frame actually pays for one mark. */
const cost = (halo: number) => (2 * halo) ** 2

describe("the halo", () => {
  it("is the whole cost, and grows as the square of flare's effect on it", () => {
    const core = coreRadius(3, 200, 0.6)
    const quiet = haloRadius(core, 0.6, 0.6, "ember")
    const loud = haloRadius(core, 0.6, 2.4, "ember")

    // Four times the flare is about 3.4 times the radius, because the radius has
    // a constant term in it — and therefore about 11 times the area. **More than
    // four**, which is the whole claim: the cost is superlinear in flare where it
    // is merely linear in the number of embers.
    expect(loud / quiet).toBeGreaterThan(3)
    expect(cost(loud) / cost(quiet)).toBeGreaterThan(4 * 2)
  })

  it("more than doubles its cost for every doubling of flare, everywhere on the track", () => {
    const core = coreRadius(2, 200, 0.5)
    for (const flare of [0.2, 0.4, 0.8, 1.5]) {
      const single = cost(haloRadius(core, 0.5, flare, "ember"))
      const double = cost(haloRadius(core, 0.5, flare * 2, "ember"))
      expect(double / single, `flare ${flare} → ${flare * 2}`).toBeGreaterThan(2)
    }
  })

  it("is absent at zero, so the marks can be looked at bare", () => {
    for (const mark of MARKS) {
      expect(haloRadius(coreRadius(3, 200, 0.8), 0.8, 0, mark)).toBe(0)
    }
  })

  it("grows with brightness, which is what makes a hot ember look bigger", () => {
    const faint = haloRadius(coreRadius(3, 200, 0.1), 0.1, 1, "ember")
    const bright = haloRadius(coreRadius(3, 200, 0.9), 0.9, 1, "ember")
    expect(bright).toBeGreaterThan(faint)
  })

  it("is smallest on a spark and largest on a mote, which has nothing else", () => {
    const of = (mark: (typeof MARKS)[number]) => haloRadius(coreRadius(3, 200, 0.6), 0.6, 1, mark)
    expect(of("spark")).toBeLessThan(of("ember"))
    expect(of("mote")).toBeGreaterThan(of("ember"))
  })
})

describe("the core", () => {
  /**
   * The central drawing problem, stated as a number.
   *
   * At any framing this piece has, almost every ember is sub-pixel. So the mark
   * cannot be its physical size — and it cannot be a fixed size either, or the
   * population stops looking sorted by weight, which is the one thing the drag
   * physics buys.
   */
  it("floors a sub-pixel ember at something a screen can show", () => {
    // 3 mm at 200 px/m is 0.3 px of radius.
    expect((3 / 2000) * 200).toBeLessThan(0.5)
    expect(coreRadius(3, 200, 0.5)).toBeGreaterThan(0.4)
  })

  it("still lets a close framing show how big an ember really is", () => {
    // The same ember at span 1 m rather than 4.5 m.
    expect(coreRadius(8, 900, 0.5)).toBeGreaterThan(coreRadius(8, 200, 0.5) * 2)
  })

  it("keeps heavy embers visibly larger than light ones, wherever the floor is", () => {
    expect(coreRadius(12, 900, 0.5)).toBeGreaterThan(coreRadius(1, 900, 0.5))
  })
})
