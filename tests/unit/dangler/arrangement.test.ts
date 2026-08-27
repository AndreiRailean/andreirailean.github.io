import { describe, expect, it } from "vitest"
import { buildArrangement, flickerAt } from "@/experiments/dangler/arrangement"
import { DEFAULT_SETTINGS, normalizeSettings } from "@/experiments/dangler/settings"

/**
 * Seed → wire specs and the bulb table.
 *
 * Each wire draws its shape and its colour from separately salted generators, so
 * that raising the wire count adds wires beside the ones already on screen
 * rather than reshuffling them — the same class of bug as Starry Night resetting
 * every layer's phase on a settings change.
 */

describe("buildArrangement", () => {
  it("leaves the specs of existing wires untouched when the count grows", () => {
    const few = buildArrangement({ ...DEFAULT_SETTINGS, wires: 3 })
    const many = buildArrangement({ ...DEFAULT_SETTINGS, wires: 30 })
    expect(few.specs).toEqual(many.specs.slice(0, few.specs.length))
  })

  it("leaves the bulbs of existing wires untouched too", () => {
    const few = buildArrangement({ ...DEFAULT_SETTINGS, wires: 3 })
    const many = buildArrangement({ ...DEFAULT_SETTINGS, wires: 30 })
    const shared = 3 * DEFAULT_SETTINGS.beads
    for (const key of ["hue", "along", "angle"] as const) {
      expect(Array.from(few[key].subarray(0, shared))).toEqual(Array.from(many[key].subarray(0, shared)))
    }
  })
})

/**
 * `flicker` drew a rate in hertz and used it as radians per second, so every
 * bulb wavered with a period of eleven to fifty seconds. The control was live,
 * the maths was fine, and it was invisible — neither a type checker nor a
 * screenshot can reach a bug about a timescale. So these assert the timescale a
 * viewer would actually experience.
 */
describe("flicker", () => {
  const arrangement = buildArrangement(normalizeSettings({ wires: 4, beads: 12, flicker: 1 }))
  const rate = arrangement.flickerRate[0]!
  const phase = arrangement.flickerPhase[0]!

  const sampled = (amount: number) => {
    let low = Infinity
    let high = -Infinity
    let biggestSecond = 0
    for (let t = 0; t < 20; t += 0.01) {
      const value = flickerAt(rate, phase, t, amount)
      low = Math.min(low, value)
      high = Math.max(high, value)
      biggestSecond = Math.max(biggestSecond, Math.abs(value - flickerAt(rate, phase, t + 1, amount)))
    }
    return { low, high, biggestSecond }
  }

  it("leaves a bulb exactly steady at 0", () => {
    expect(flickerAt(1, 0.4, 3.3, 0)).toBe(1)
    expect(flickerAt(1, 0.4, 9.1, 0)).toBe(1)
  })

  it("cycles every bulb within a few seconds, and none as a strobe", () => {
    const rates = Array.from(arrangement.flickerRate.subarray(0, arrangement.beadCount))
    expect(1 / Math.min(...rates)).toBeLessThan(4)
    expect(1 / Math.max(...rates)).toBeGreaterThan(0.25)
  })

  it("swings brightness substantially, and within a single second", () => {
    const { low, high, biggestSecond } = sampled(1)
    expect(high - low).toBeGreaterThan(0.5)
    expect(biggestSecond).toBeGreaterThan(0.3)
  })

  it("is scaled by the control", () => {
    const { high } = sampled(1)
    let halfAmplitude = 0
    for (let t = 0; t < 20; t += 0.01) {
      halfAmplitude = Math.max(halfAmplitude, Math.abs(flickerAt(rate, phase, t, 0.5) - 1))
    }
    expect(Math.abs(halfAmplitude - (high - 1) / 2)).toBeLessThan(0.02)
  })
})
