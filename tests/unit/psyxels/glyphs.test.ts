import { describe, expect, it } from "vitest"
import { makeRng } from "@/experiments/kit/random"
import { armsOf, blendGlyphs, GLYPH_COUNT, GLYPHS, nextGlyph } from "@/experiments/psyxels/glyphs"

/**
 * The vocabulary and the walk through it.
 *
 * What makes a pixel read as one thing changing rather than a slot being
 * refilled is that consecutive frames are *related*. That is a property of the
 * transition weights and nothing else, so it is checked here rather than left to
 * a screenshot, where a pixel showing a good sequence and a pixel showing white
 * noise look the same at eight pixels across.
 */

const MINUS = 0
const PLUS = 1
const CIRCLED_MINUS = 2
const CROSS = 6

/** A frame's features as the numbers a blend deals in. */
const featureNumbers = (glyph: number) => {
  const shape = GLYPHS[glyph]!
  return {
    h: Number(shape.h),
    v: Number(shape.v),
    diagonal: Number(shape.diagonal),
    ring: Number(shape.ring),
    fill: Number(shape.fill),
  }
}

/** How often each frame follows `from`, over a long seeded walk. */
function follows(from: number, count: number, draws = 20000): number[] {
  const rng = makeRng(2024)
  const tally = new Array<number>(GLYPH_COUNT).fill(0)
  for (let i = 0; i < draws; i++) tally[nextGlyph(from, count, rng())]!++
  return tally
}

describe("the vocabulary", () => {
  it("opens with the four signs the piece was described from", () => {
    expect(GLYPHS.slice(0, 4).map((glyph) => [glyph.h, glyph.v, glyph.ring])).toEqual([
      [true, false, false],
      [true, true, false],
      [true, false, true],
      [true, true, true],
    ])
  })
})

describe("nextGlyph", () => {
  it("always changes something, and stays inside the vocabulary", () => {
    const rng = makeRng(7)
    for (let count = 1; count <= GLYPH_COUNT; count++) {
      for (let current = 0; current < count; current++) {
        for (let i = 0; i < 200; i++) {
          const next = nextGlyph(current, count, rng())
          expect(next).toBeLessThan(count)
          expect(next).toBeGreaterThanOrEqual(0)
          if (count > 1) expect(next).not.toBe(current)
        }
      }
    }
  })

  it("has nowhere to go in a vocabulary of one", () => {
    expect(nextGlyph(0, 1, 0.99)).toBe(0)
  })

  it("prefers a frame one feature away to one two away", () => {
    const tally = follows(MINUS, GLYPH_COUNT)
    // A plus adds a stroke; a circled minus adds a ring; a cross replaces the
    // stroke *and* is a different kind of mark.
    expect(tally[PLUS]!).toBeGreaterThan(tally[CROSS]! * 2)
    expect(tally[CIRCLED_MINUS]!).toBeGreaterThan(tally[CROSS]! * 2)
  })

  it("still reaches the far half of the vocabulary rather than orbiting one frame", () => {
    const tally = follows(MINUS, GLYPH_COUNT)
    for (let glyph = 0; glyph < GLYPH_COUNT; glyph++) {
      if (glyph === MINUS) continue
      expect(tally[glyph]!).toBeGreaterThan(0)
    }
  })

  it("brings a pixel back inside a vocabulary that has shrunk under it", () => {
    for (let i = 0; i < 50; i++) expect(nextGlyph(8, 3, i / 50)).toBeLessThan(3)
  })
})

describe("blendGlyphs", () => {
  const scratch = () => ({ h: 0, v: 0, diagonal: 0, ring: 0, fill: 0 })

  it("is the frame it came from at the start and the frame it is going to at the end", () => {
    for (const [from, to] of [
      [MINUS, PLUS],
      [PLUS, CIRCLED_MINUS],
      [5, CROSS],
    ]) {
      expect(blendGlyphs(from!, to!, 0, scratch())).toEqual(featureNumbers(from!))
      expect(blendGlyphs(from!, to!, 1, scratch())).toEqual(featureNumbers(to!))
    }
  })

  it("leaves a settled pixel showing whole features", () => {
    const settled = blendGlyphs(CIRCLED_MINUS, CIRCLED_MINUS, 0.5, scratch())
    for (const value of Object.values(settled)) expect([0, 1]).toContain(value)
  })

  it("keeps a feature both frames share at full presence throughout", () => {
    // A circled minus becoming a circled plus must not blink its ring.
    for (let t = 0; t <= 1.0001; t += 0.1) {
      expect(blendGlyphs(CIRCLED_MINUS, 3, t, scratch()).ring).toBeCloseTo(1, 12)
    }
  })
})

/**
 * A plus becoming a cross is a *rotation*, and the arms never shorten.
 *
 * The diagonals are the upright pair turned by an eighth of a turn rather than a
 * third stroke pair, which is what makes that transition one movement. Drawn as
 * separate features it is four strokes retracting into the middle while four
 * others grow out of it — the same information, and a mark that visibly falls
 * apart on the way.
 */
describe("armsOf", () => {
  const scratch = () => ({ h: 0, v: 0, diagonal: 0, ring: 0, fill: 0 })
  const BAR = 8

  it("turns a plus into a cross without either arm losing length", () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const arms = armsOf(blendGlyphs(PLUS, CROSS, Math.min(1, t), scratch()))
      expect(arms.along).toBeCloseTo(1, 12)
      expect(arms.across).toBeCloseTo(1, 12)
    }
    expect(armsOf(blendGlyphs(PLUS, CROSS, 0, scratch())).spin).toBe(0)
    expect(armsOf(blendGlyphs(PLUS, CROSS, 1, scratch())).spin).toBeCloseTo(Math.PI / 4, 12)
  })

  it("turns the one stroke a minus has while the other grows across it", () => {
    const half = armsOf(blendGlyphs(MINUS, CROSS, 0.5, scratch()))
    expect(half.along).toBeCloseTo(1, 12)
    expect(half.across).toBeCloseTo(0.5, 12)
    expect(half.spin).toBeCloseTo(Math.PI / 8, 12)
  })

  it("gives an upright mark no turn at all", () => {
    for (const glyph of [MINUS, PLUS, CIRCLED_MINUS, BAR]) {
      expect(armsOf(blendGlyphs(glyph, glyph, 1, scratch())).spin).toBe(0)
    }
  })
})
