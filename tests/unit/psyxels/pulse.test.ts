import { describe, expect, it } from "vitest"
import type { Pixel } from "@/experiments/psyxels/field"
import { arrivalOf, breathOf, BIRTH_S, levelOf } from "@/experiments/psyxels/pulse"
import { DEFAULT_SETTINGS, type Settings } from "@/experiments/psyxels/settings"

/**
 * The three factors that decide how bright a pixel is.
 *
 * They are separate so that each can be reasoned about, and the reasoning is
 * what these pin: a threshold that fades instead of cutting loses the letter's
 * edge, and a curve that does not flatten loses the letter's interior.
 */

const pixel = (over: Partial<Pixel> = {}): Pixel => ({
  x: 0,
  y: 0,
  size: 20,
  depth: 0,
  ink: 1,
  r: 1,
  g: 1,
  b: 1,
  born: 0,
  glyph: 0,
  rate: 1,
  hue: 0,
  phase: 0,
  swing: 1,
  ...over,
})

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over })

describe("levelOf", () => {
  it("makes a hole rather than a fade below the threshold", () => {
    expect(levelOf(0.39, 0.4, 0.5)).toBe(0)
    expect(levelOf(0.4, 0.4, 0.5)).toBe(0)
    expect(levelOf(0.41, 0.4, 0.5)).toBeGreaterThan(0)
  })

  it("leaves a full square at full strength whatever the curve", () => {
    for (const flatten of [0, 0.5, 1]) expect(levelOf(1, 0.4, flatten)).toBeCloseTo(1, 12)
  })

  /**
   * The reason this is a curve and not a lift. The first version added
   * `(1 - ink) × flatten`, which looks right on a letter — ink is 1 almost
   * everywhere — and gives a photograph a hard cut with no shading above it.
   */
  it("still shades the tones above the threshold when flatten is low", () => {
    const dim = levelOf(0.55, 0.5, 0.1)
    const bright = levelOf(0.85, 0.5, 0.1)
    expect(bright / dim).toBeGreaterThan(2.5)
  })

  it("all but erases that shading when flatten is high", () => {
    const dim = levelOf(0.55, 0.5, 1)
    const bright = levelOf(0.85, 0.5, 1)
    expect(bright / dim).toBeLessThan(1.25)
  })

  it("rises with coverage at every setting", () => {
    for (const flatten of [0, 0.4, 0.88, 1]) {
      let last = -1
      for (let ink = 0.3; ink <= 1.0001; ink += 0.05) {
        const level = levelOf(ink, 0.3, flatten)
        expect(level).toBeGreaterThanOrEqual(last)
        expect(level).toBeLessThanOrEqual(1)
        last = level
      }
    }
  })
})

describe("breathOf", () => {
  it("is exactly one when the pulse is off, so nothing is spent to hold still", () => {
    for (let t = 0; t < 4; t += 0.37) expect(breathOf(pixel(), settings({ pulse: 0 }), t, 0.3)).toBe(1)
  })

  it("swings between full and the depth asked for, and never past either", () => {
    const scene = settings({ pulse: 0.6, tempo: 1, wave: 0 })
    const one = pixel({ swing: 1 })
    let low = 1
    let high = 0
    for (let t = 0; t < 4; t += 1 / 60) {
      const value = breathOf(one, scene, t, 0)
      low = Math.min(low, value)
      high = Math.max(high, value)
    }
    expect(high).toBeCloseTo(1, 2)
    expect(low).toBeCloseTo(0.4, 2)
  })

  /**
   * `wave` has to take the *rate* as well as the phase. Pixels running at their
   * own speeds drift apart within a few cycles however they were aligned, so a
   * wave built from phase alone smears back into a simmer while you watch it —
   * which is what it did.
   */
  it("brings pixels at one place into step whatever their own rates were", () => {
    const scene = settings({ pulse: 1, tempo: 0.5, wave: 1 })
    const quick = pixel({ rate: 2.1, phase: 0.8 })
    const slow = pixel({ rate: 0.4, phase: 0.15 })
    for (const t of [0, 3, 11, 40]) {
      expect(breathOf(quick, scene, t, 0.25)).toBeCloseTo(breathOf(slow, scene, t, 0.25), 10)
    }
  })

  it("leaves them alone at the other end of the same control", () => {
    const scene = settings({ pulse: 1, tempo: 0.5, wave: 0 })
    const quick = pixel({ rate: 2.1, phase: 0.8 })
    const slow = pixel({ rate: 0.4, phase: 0.15 })
    expect(breathOf(quick, scene, 3, 0.25)).not.toBeCloseTo(breathOf(slow, scene, 3, 0.25), 2)
  })
})

describe("arrivalOf", () => {
  it("takes a newcomer from nothing to itself, and stays there", () => {
    expect(arrivalOf(10, 10)).toBe(0)
    expect(arrivalOf(10 + BIRTH_S / 2, 10)).toBeCloseTo(0.5, 6)
    expect(arrivalOf(10 + BIRTH_S, 10)).toBe(1)
    expect(arrivalOf(400, 10)).toBe(1)
  })

  it("eases in and out rather than ramping", () => {
    const early = arrivalOf(0.05 * BIRTH_S, 0)
    const middle = arrivalOf(0.5 * BIRTH_S, 0) - arrivalOf(0.45 * BIRTH_S, 0)
    expect(early).toBeLessThan(middle)
  })
})
