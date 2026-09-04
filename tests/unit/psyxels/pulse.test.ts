import { describe, expect, it } from "vitest"
import type { Psyx } from "@/experiments/psyxels/field"
import { arrivalOf, BIRTH_S, breathOf, levelOf, MORPH_MAX, morphOf, spanOf, spinOf } from "@/experiments/psyxels/pulse"
import { DEFAULT_SETTINGS, type Settings } from "@/experiments/psyxels/settings"

/**
 * The three factors that decide how bright a psyx is.
 *
 * They are separate so that each can be reasoned about, and the reasoning is
 * what these pin: a threshold that fades instead of cutting loses the letter's
 * edge, and a curve that does not flatten loses the letter's interior.
 */

const psyx = (over: Partial<Psyx> = {}): Psyx => ({
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
  from: 0,
  flicked: 0,
  gap: 1,
  edge: 0,
  luck: 0,
  offsetX: 0,
  turn: 0,
  offsetY: 0,
  rate: 1,
  hue: 0,
  hueFrom: 0,
  phase: 0,
  swing: 1,
  ...over,
})

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over })

describe("levelOf", () => {
  it("makes a hole rather than a fade below the threshold", () => {
    expect(levelOf(0.39, 0, 0.4, 0, 0.5)).toBe(0)
    expect(levelOf(0.4, 0, 0.4, 0, 0.5)).toBe(0)
    expect(levelOf(0.41, 0, 0.4, 0, 0.5)).toBeGreaterThan(0)
  })

  it("leaves a full square at full strength whatever the curve", () => {
    for (const flatten of [0, 0.5, 1]) expect(levelOf(1, 0, 0.4, 0, flatten)).toBeCloseTo(1, 12)
  })

  /**
   * The reason this is a curve and not a lift. The first version added
   * `(1 - ink) × flatten`, which looks right on a letter — ink is 1 almost
   * everywhere — and gives a photograph a hard cut with no shading above it.
   */
  it("still shades the tones above the threshold when flatten is low", () => {
    const dim = levelOf(0.55, 0, 0.5, 0, 0.1)
    const bright = levelOf(0.85, 0, 0.5, 0, 0.1)
    expect(bright / dim).toBeGreaterThan(2.5)
  })

  it("all but erases that shading when flatten is high", () => {
    const dim = levelOf(0.55, 0, 0.5, 0, 1)
    const bright = levelOf(0.85, 0, 0.5, 0, 1)
    expect(bright / dim).toBeLessThan(1.25)
  })

  it("rises with coverage at every setting", () => {
    for (const flatten of [0, 0.4, 0.88, 1]) {
      let last = -1
      for (let ink = 0.3; ink <= 1.0001; ink += 0.05) {
        const level = levelOf(ink, 0, 0.3, 0, flatten)
        expect(level).toBeGreaterThanOrEqual(last)
        expect(level).toBeLessThanOrEqual(1)
        last = level
      }
    }
  })
})

describe("breathOf", () => {
  it("is exactly one when the pulse is off, so nothing is spent to hold still", () => {
    for (let t = 0; t < 4; t += 0.37) expect(breathOf(psyx(), settings({ pulse: 0 }), t, 0.3)).toBe(1)
  })

  it("swings between full and the depth asked for, and never past either", () => {
    const scene = settings({ pulse: 0.6, tempo: 1, wave: 0 })
    const one = psyx({ swing: 1 })
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
  it("brings psyxels at one place into step whatever their own rates were", () => {
    const scene = settings({ pulse: 1, tempo: 0.5, wave: 1 })
    const quick = psyx({ rate: 2.1, phase: 0.8 })
    const slow = psyx({ rate: 0.4, phase: 0.15 })
    for (const t of [0, 3, 11, 40]) {
      expect(breathOf(quick, scene, t, 0.25)).toBeCloseTo(breathOf(slow, scene, t, 0.25), 10)
    }
  })

  it("leaves them alone at the other end of the same control", () => {
    const scene = settings({ pulse: 1, tempo: 0.5, wave: 0 })
    const quick = psyx({ rate: 2.1, phase: 0.8 })
    const slow = psyx({ rate: 0.4, phase: 0.15 })
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

describe("morphOf", () => {
  const changed = (over: Partial<Psyx> = {}) => psyx({ from: 0, glyph: 1, flicked: 10, gap: 1, ...over })

  it("runs from the instant of the change to the end of its span, eased at both ends", () => {
    const scene = settings({ morph: 0.4 })
    const span = 0.4
    expect(morphOf(changed(), scene, 10)).toBe(0)
    expect(morphOf(changed(), scene, 10 + span / 2)).toBeCloseTo(0.5, 6)
    expect(morphOf(changed(), scene, 10 + span)).toBe(1)
    expect(morphOf(changed(), scene, 40)).toBe(1)

    // Eased: the first tenth of the span moves the mark far less than the middle.
    const early = morphOf(changed(), scene, 10 + span * 0.1)
    const middle = morphOf(changed(), scene, 10 + span * 0.55) - morphOf(changed(), scene, 10 + span * 0.45)
    expect(early).toBeLessThan(middle)
  })

  it("is a hard cut at zero, which is what the piece did before it had this", () => {
    const scene = settings({ morph: 0 })
    expect(morphOf(changed(), scene, 10)).toBe(1)
    expect(morphOf(changed(), scene, 10.0001)).toBe(1)
  })

  /**
   * The transition is a share of the hold it starts, not a duration. The flicker
   * control spans two orders of magnitude: a fixed quarter-second is languid at
   * one change every two seconds and never completes at five a second, which
   * would leave the field permanently between frames.
   */
  it("always finishes inside the hold it belongs to", () => {
    for (const gap of [0.08, 0.2, 1, 4, 30]) {
      for (const morph of [0.1, 0.55, 1]) {
        const span = Math.min(MORPH_MAX, morph * gap)
        expect(span).toBeLessThanOrEqual(gap)
        expect(morphOf(changed({ gap }), settings({ morph }), 10 + gap)).toBe(1)
      }
    }
  })

  it("never takes longer than the cap, however slow the psyx is", () => {
    // A psyx changing twice a minute would otherwise spend twenty seconds
    // mid-morph, which is not a slow change of frame — it is a psyx that never
    // shows one.
    expect(morphOf(changed({ gap: 30 }), settings({ morph: 1 }), 10 + MORPH_MAX)).toBe(1)
  })
})

/**
 * A large psyx has more gravity: it arrives and leaves faster than fine grain.
 *
 * Eased over the same span as a speck, a coarse mark spends its whole arrival as
 * a translucent ghost of itself and its whole departure as a hole — and being
 * large, both read as an event rather than as grain moving.
 */
describe("spanOf", () => {
  it("takes the coarsest psyx in and out in a third of the time the finest needs", () => {
    expect(spanOf(1, 1)).toBeLessThan(spanOf(0, 1) * 0.4)
    expect(spanOf(0, 1)).toBe(BIRTH_S)
  })

  it("falls all the way along, and never to nothing", () => {
    let last = Infinity
    for (let share = 0; share <= 1.0001; share += 0.1) {
      const span = spanOf(share, 1)
      expect(span).toBeLessThanOrEqual(last)
      expect(span).toBeGreaterThan(0)
      last = span
    }
    // A share past the coarsest square — a psyx overlapping into its neighbour's
    // — must not run the ease backwards.
    expect(spanOf(4, 1)).toBe(spanOf(1, 1))
  })
})

/**
 * `ease` is the piece's second way to slow something down, and the only one that
 * does not also slow how *often* things happen.
 */
describe("ease", () => {
  const held = (over: Partial<Psyx> = {}) => psyx({ from: 0, glyph: 1, flicked: 0, ...over })

  it("stretches and compresses every transition without touching a rate", () => {
    expect(spanOf(0.5, 2)).toBeCloseTo(spanOf(0.5, 1) * 2, 10)
    expect(spanOf(0.5, 0.5)).toBeCloseTo(spanOf(0.5, 1) * 0.5, 10)
    // The gravity of a large psyx survives it: still quicker than fine grain at
    // any setting.
    expect(spanOf(1, 3)).toBeLessThan(spanOf(0, 3))
  })

  it("lifts the cap on a change of frame, which is what made playback the only lever", () => {
    const waiting = held({ gap: 30 })
    const scene = settings({ morph: 1 })
    // Unstretched, a transition can never run past the cap however long the hold.
    expect(morphOf(waiting, { ...scene, ease: 1 }, MORPH_MAX * 0.99)).toBeLessThan(1)
    expect(morphOf(waiting, { ...scene, ease: 1 }, MORPH_MAX + 0.01)).toBe(1)
    // Stretched, it runs on.
    expect(morphOf(waiting, { ...scene, ease: 4 }, MORPH_MAX + 0.01)).toBeLessThan(1)
  })
})

/**
 * A bearing is a *property of the psyx*, not of the frame it is showing, which
 * is what keeps a mark from jumping as it morphs into the next one.
 */
describe("spinOf", () => {
  const settings = (spin: number): Settings => ({ ...DEFAULT_SETTINGS, spin })

  it("leaves every mark upright at zero, whatever the psyx rolled", () => {
    for (const turn of [0, 0.13, 0.5, 0.99]) expect(spinOf(psyx({ turn }), settings(0))).toBe(0)
  })

  it("opens a spread around upright rather than walking the field round the circle", () => {
    // The middle roll is the one that stays put; the ends go opposite ways by
    // the same amount, so winding the control up does not rotate the scene.
    expect(spinOf(psyx({ turn: 0.5 }), settings(1))).toBe(0)
    expect(spinOf(psyx({ turn: 0 }), settings(1))).toBeCloseTo(-Math.PI, 10)
    expect(spinOf(psyx({ turn: 1 }), settings(1))).toBeCloseTo(Math.PI, 10)
  })

  it("scales with the control, so a low setting is a tilt and a high one is a bearing", () => {
    const far = psyx({ turn: 1 })
    expect(spinOf(far, settings(0.1))).toBeCloseTo(Math.PI * 0.1, 10)
    expect(Math.abs(spinOf(far, settings(0.1)))).toBeLessThan(Math.abs(spinOf(far, settings(0.5))))
  })

  it("does not move while a psyx is mid-change, because it is the psyx's and not the frame's", () => {
    const mid = psyx({ turn: 0.2, glyph: 4, from: 9 })
    const after = { ...mid, glyph: 9, from: 4 }
    expect(spinOf(after, settings(0.6))).toBe(spinOf(mid, settings(0.6)))
  })
})
