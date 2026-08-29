import { describe, expect, it } from "vitest"
import { makeRng } from "@/experiments/kit/random"
import { GLYPH_COUNT, GLYPHS, nextGlyph } from "@/experiments/psyxels/glyphs"

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
