import { describe, expect, it } from "vitest"
import {
  childrenIn,
  crosses,
  mayYield,
  paceDrift,
  playChoice,
  sitsChance,
  stoppingChance,
  strays,
  urgeChoice,
  yieldChance,
  type Activity,
  type PlayChoice,
} from "@/experiments/walkers/crowd"
import { makeRng } from "@/experiments/random"

/**
 * The choices somebody in the park makes, one at a time, with no park.
 *
 * Each of these used to be checked by running a crowd for a minute or two and
 * counting what came out — a quadrant tally, a share of children, whether any
 * child was ever seen jumping. That measured the decision through everything
 * else the crowd does, at the cost of the whole simulation, and mostly measured
 * the random number generator. A decision is a function of what the person
 * knows, so it is tested as one: constructed inputs, a seeded stream where a
 * draw is involved, and the share asserted directly. `crowd.test.ts` keeps the
 * few short runs that prove these are wired into the walk.
 *
 * Every case below was seen red with the fault it names put back.
 */

/** A frame of the size the scene usually shows: about 12 × 7.5 m. */
const FRAME = { halfWidth: 6, halfHeight: 3.75 }
const PACE = { paceLow: 1.1, paceHigh: 1.5 }

describe("who stops", () => {
  it("never stops anybody at 0, and stops everybody at 1", () => {
    expect(stoppingChance({ ...PACE, settling: 0 }, FRAME)).toBe(0)
    expect(stoppingChance({ ...PACE, settling: 1 }, FRAME)).toBe(1)
  })

  /**
   * `settling` is a fraction of the *crowd*, not of arrivals. Applied to
   * arrivals, 0.3 left three quarters of everybody in shot stationary and the
   * park looked asleep. Seen failing: with `stoppingChance` returning `settling`
   * itself, the arrivals bound fails, and the crowd fraction that would come out
   * is 0.87 against 0.3 asked for.
   */
  it("asks for far fewer stopping arrivals than the crowd fraction, so the crowd comes out at the fraction", () => {
    for (const settling of [0.1, 0.3, 0.6]) {
      const arrivals = stoppingChance({ ...PACE, settling }, FRAME)
      expect(arrivals).toBeGreaterThan(0)
      expect(arrivals).toBeLessThan(settling)

      // Little's law forwards: a stopper stays `ratio` times as long as a
      // crosser, so the share of the crowd that is stopped is `p·r / (p·r + 1 − p)`.
      const pace = (PACE.paceLow + PACE.paceHigh) / 2
      const ratio = 120 / Math.max(4, (FRAME.halfWidth + FRAME.halfHeight) / pace)
      const stopped = (arrivals * ratio) / (arrivals * ratio + (1 - arrivals))
      expect(stopped).toBeCloseTo(settling, 5)
    }
  })

  it("lets some stopped groups sit, and fewer of those with children", () => {
    expect(sitsChance(false)).toBeGreaterThan(0)
    expect(sitsChance(true)).toBeGreaterThan(0)
    expect(sitsChance(true)).toBeLessThan(sitsChance(false))
  })
})

describe("who is a child", () => {
  it("makes no children at all when asked for none, at any group size", () => {
    const rng = makeRng(1)
    for (let draw = 0; draw < 2000; draw++) expect(childrenIn(1 + (draw % 5), 0, rng)).toBe(0)
  })

  it("always leaves somebody to be the adult", () => {
    const rng = makeRng(2)
    for (let draw = 0; draw < 2000; draw++) {
      const size = 2 + (draw % 4)
      expect(childrenIn(size, 1, rng)).toBe(size - 1)
    }
  })

  /**
   * Seen failing: with the per-member draw inflated by 1.4 — the old
   * over-correction for the cap — a group of three at 0.3 comes out 0.39
   * children, which is the half-child crowd it produced.
   */
  it("makes children at the rate asked for, less the cap", () => {
    const rng = makeRng(3)
    let children = 0
    const groups = 20_000
    for (let draw = 0; draw < groups; draw++) children += childrenIn(3, 0.3, rng)
    // E[min(2, Binomial(3, 0.3))] / 3 = (0.9 − 0.027) / 3 = 0.291.
    expect(children / (groups * 3)).toBeGreaterThan(0.28)
    expect(children / (groups * 3)).toBeLessThan(0.3)
  })

  it("makes a lone child rarer than a child in company", () => {
    const rng = makeRng(4)
    let lone = 0
    const draws = 20_000
    for (let draw = 0; draw < draws; draw++) lone += childrenIn(1, 0.3, rng)
    expect(lone / draws).toBeGreaterThan(0.09)
    expect(lone / draws).toBeLessThan(0.12)
  })
})

describe("who gives way", () => {
  const moving = (vx: number, vy: number) => ({ vx, vy, speed: Math.hypot(vx, vy) })

  it("counts a crossing, and not somebody coming head on or going the same way", () => {
    expect(crosses(moving(1.3, 0), moving(0, 1.3))).toBe(true)
    expect(crosses(moving(1.3, 0), moving(-1.3, 0))).toBe(false)
    expect(crosses(moving(1.3, 0), moving(1.1, 0.1))).toBe(false)
  })

  it("does not count somebody barely moving, on either side", () => {
    expect(crosses(moving(0.2, 0), moving(0, 1.3))).toBe(false)
    expect(crosses(moving(1.3, 0), moving(0, 0.2))).toBe(false)
  })

  /**
   * Nobody to cross means `soonest` is infinite, and then nobody stops. A rate
   * that fires anyway is a walker stopping for no reason, which reads as a
   * stutter. Seen failing: with the horizon test dropped, the first case is true.
   */
  it("never stops for nobody, and stops only for a crossing about to happen", () => {
    expect(mayYield(Infinity, 10, 0)).toBe(false)
    expect(mayYield(5, 10, 0)).toBe(false)
    expect(mayYield(0.5, 10, 0)).toBe(true)
    // Already giving way: the decision stands for its own duration.
    expect(mayYield(0.5, 10, 11)).toBe(false)
  })

  it("is a rate per second, the same at any step", () => {
    const perSecond = (dt: number) => -Math.log(1 - yieldChance(dt)) / dt
    expect(perSecond(1 / 60)).toBeCloseTo(1.4, 6)
    expect(perSecond(1 / 120)).toBeCloseTo(1.4, 6)
    // Two half-steps are one whole step.
    expect(1 - (1 - yieldChance(1 / 120)) ** 2).toBeCloseTo(yieldChance(1 / 60), 12)
  })
})

describe("nobody holds one speed for ever", () => {
  /**
   * A walker drew a speed on arrival and held it exactly, and a field of dots
   * each gliding at its own fixed rate read as something swimming. Measured
   * intra-individual variability over a walk is a coefficient of variation of
   * five to ten per cent. Seen failing: with `paceDrift` returning 1, the
   * spread is zero.
   */
  it("drifts one person's pace by a few per cent over a walk, and never stops them", () => {
    for (const phase of [0, 1.7, 4.2]) {
      const samples: number[] = []
      for (let clock = 0; clock < 120; clock += 0.5) samples.push(paceDrift(clock, phase))
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
      const spread = Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length)
      expect(spread / mean).toBeGreaterThan(0.02)
      expect(Math.min(...samples)).toBeGreaterThan(0.8)
    }
  })

  it("lets a steady group dawdle or hurry, and more of them in a park than on a concourse", () => {
    const share = (settling: number, urge: string) => {
      let count = 0
      for (let draw = 0; draw < 1000; draw++) if (urgeChoice((draw + 0.5) / 1000, settling) === urge) count++
      return count / 1000
    }
    for (const urge of ["dawdle", "hurry", "steady"]) expect(share(0.5, urge), urge).toBeGreaterThan(0)
    expect(share(1, "dawdle")).toBeGreaterThan(share(0, "dawdle"))
  })
})

describe("a child's leash", () => {
  const ACTIVITIES: Activity[] = [
    "walking",
    "running",
    "standing",
    "sitting",
    "crouching",
    "chasing",
    "fleeing",
    "darting",
    "fallen",
  ]

  /**
   * A *fleeing* child was outside the leash in the first version, and one was
   * measured twenty-one metres from its parent. Seen failing: with `fleeing`
   * excused alongside `sitting`, the fleeing case reads false.
   */
  it("calls back a child past it in every state that is going somewhere", () => {
    for (const activity of ACTIVITIES) {
      const going = activity !== "sitting" && activity !== "fallen"
      expect(strays(3.5, activity), activity).toBe(going)
      expect(strays(3.3, activity), activity).toBe(false)
    }
  })
})

describe("a child's play", () => {
  const sweep = (energy: number, hasQuarry: boolean, hop: number, speed: number) => {
    const seen = new Set<PlayChoice>()
    for (let draw = 0; draw < 2000; draw++) seen.add(playChoice((draw + 0.5) / 2000, energy, hasQuarry, hop, speed))
    return seen
  }

  /**
   * Each move is a band of one draw, and a threshold typed wrong silently
   * removes one — the crowd still looks busy and the piece has quietly lost
   * jumping. Seen failing: with the jump's bound typed 0.26 instead of 0.31,
   * `jump` is never chosen.
   */
  it("reaches every move at full play", () => {
    const seen = sweep(1.5, true, 0, 1.2)
    for (const move of ["chase", "dart", "crouch", "jump", "fall", "carry on"] as const) {
      expect(seen, `never chose to ${move}`).toContain(move)
    }
  })

  it("chooses nothing at all when play is off", () => {
    expect([...sweep(0, true, 0, 1.2)]).toEqual(["carry on"])
  })

  it("chases only with somebody to chase, jumps only from the ground, and falls only at speed", () => {
    expect(sweep(1.5, false, 0, 1.2)).not.toContain("chase")
    expect(sweep(1.5, false, 0, 1.2)).toContain("dart")
    expect(sweep(1.5, true, 0.2, 1.2)).not.toContain("jump")
    expect(sweep(1.5, true, 0, 0.5)).not.toContain("fall")
  })
})
