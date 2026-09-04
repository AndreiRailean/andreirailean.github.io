import { describe, expect, it } from "vitest"
import { makeRng } from "@/experiments/random"
import { armsOf, GLYPH_COUNT, GLYPHS, nextGlyph } from "@/experiments/psyxels/glyphs"

/**
 * The vocabulary and the walk through it.
 *
 * What makes a psyx read as one thing changing rather than a slot being
 * refilled is that consecutive frames are *related*. That is a property of the
 * transition weights and nothing else, so it is checked here rather than left to
 * a screenshot, where a psyx showing a good sequence and a psyx showing white
 * noise look the same at eight psyxels across.
 */

const MINUS = 0
const PLUS = 1
const CIRCLED_MINUS = 2
const CROSS = 6

/** Every mark, as the walk wants them: an index list rather than a count. */
const ALL = Array.from({ length: GLYPH_COUNT }, (_, i) => i)

/** How often each frame follows `from`, over a long seeded walk. */
function follows(from: number, allowed: readonly number[], draws = 20000): number[] {
  const rng = makeRng(2024)
  const tally = new Array<number>(GLYPH_COUNT).fill(0)
  for (let i = 0; i < draws; i++) tally[nextGlyph(from, allowed, rng())]!++
  return tally
}

const MOON = 9
const STAR = 10

/** How many features two frames disagree on — `glyphs.ts` owns the same sum. */
const apart = (a: number, b: number) =>
  (["h", "v", "diagonal", "ring", "fill"] as const).filter((key) => GLYPHS[a]![key] !== GLYPHS[b]![key]).length

describe("the vocabulary", () => {
  it("opens with the four signs the piece was described from", () => {
    expect(GLYPHS.slice(0, 4).map((glyph) => [glyph.h, glyph.v, glyph.ring])).toEqual([
      [true, false, false],
      [true, true, false],
      [true, false, true],
      [true, true, true],
    ])
  })

  /**
   * **Two marks at distance zero would make the walk between them meaningless.**
   *
   * A drawn mark's features are a claim about kinship rather than a description
   * of its shape, so nothing about the geometry stops one being given a vector
   * another already holds — and the transition weights are `KINSHIP ** (d - 1)`,
   * which at `d === 0` comes out *larger* than a one-feature step. The pair
   * would then follow each other almost to the exclusion of the rest.
   */
  it("gives every mark a vector no other mark holds", () => {
    for (let a = 0; a < GLYPH_COUNT; a++) {
      for (let b = a + 1; b < GLYPH_COUNT; b++) {
        expect(apart(a, b), `${a} vs ${b}`).toBeGreaterThan(0)
      }
    }
  })

  /**
   * The drawn marks are appended, so a preset naming a smaller vocabulary means
   * exactly the frames it always did.
   */
  it("keeps the drawn marks last, behind the nine that were decomposed", () => {
    expect(GLYPHS.slice(0, 9).every((glyph) => glyph.paint === undefined)).toBe(true)
    expect(GLYPHS[MOON]!.paint).toBeTypeOf("function")
    expect(GLYPHS[STAR]!.paint).toBeTypeOf("function")
    expect(GLYPH_COUNT).toBe(11)
  })

  /**
   * What a drawn mark's vector is *for*: a crescent should sit beside a bare
   * ring, and a star beside the plus whose four points it pulls the waist in on.
   */
  it("puts each drawn mark one step from the sign it belongs beside", () => {
    const RING = 4
    expect(apart(MOON, RING)).toBe(1)
    expect(apart(STAR, PLUS)).toBe(1)
    for (let other = 0; other < GLYPH_COUNT; other++) {
      if (other !== MOON) expect(apart(MOON, other), `moon vs ${other}`).toBeGreaterThanOrEqual(1)
      if (other !== STAR) expect(apart(STAR, other), `star vs ${other}`).toBeGreaterThanOrEqual(1)
    }
  })
})

describe("nextGlyph", () => {
  it("always changes something, and stays inside the chosen set", () => {
    const rng = makeRng(7)
    for (let count = 1; count <= GLYPH_COUNT; count++) {
      const allowed = ALL.slice(0, count)
      for (const current of allowed) {
        for (let i = 0; i < 200; i++) {
          const next = nextGlyph(current, allowed, rng())
          expect(allowed).toContain(next)
          if (count > 1) expect(next).not.toBe(current)
        }
      }
    }
  })

  /**
   * The set a scene chooses is arbitrary, not a prefix — which is the whole
   * point of naming marks rather than counting them.
   */
  it("walks a scattered set as readily as a contiguous one", () => {
    const rng = makeRng(11)
    const allowed = [0, 4, 9, 10]
    for (const current of [...allowed, 3, 7]) {
      for (let i = 0; i < 200; i++) {
        const next = nextGlyph(current, allowed, rng())
        expect(allowed).toContain(next)
        if (allowed.includes(current)) expect(next).not.toBe(current)
      }
    }
  })

  it("has nowhere to go in a set of one", () => {
    expect(nextGlyph(0, [0], 0.99)).toBe(0)
    expect(nextGlyph(3, [7], 0.99)).toBe(7)
  })

  it("prefers a frame one feature away to one two away", () => {
    const tally = follows(MINUS, ALL)
    // A plus adds a stroke; a circled minus adds a ring; a cross replaces the
    // stroke *and* is a different kind of mark.
    expect(tally[PLUS]!).toBeGreaterThan(tally[CROSS]! * 2)
    expect(tally[CIRCLED_MINUS]!).toBeGreaterThan(tally[CROSS]! * 2)
  })

  it("still reaches the far half of the vocabulary rather than orbiting one frame", () => {
    const tally = follows(MINUS, ALL)
    for (let glyph = 0; glyph < GLYPH_COUNT; glyph++) {
      if (glyph === MINUS) continue
      expect(tally[glyph]!).toBeGreaterThan(0)
    }
  })

  it("brings a psyx back inside a set it is no longer part of", () => {
    for (let i = 0; i < 50; i++) expect([0, 1, 2]).toContain(nextGlyph(8, [0, 1, 2], i / 50))
  })
})

/**
 * A cross is a plus turned, not a shape of its own.
 *
 * Saying so in the geometry is what keeps the two the same size and the same
 * weight without anyone maintaining that by hand — and it deletes a branch. It
 * is no longer an *animation*: interpolating between frames was tried and taken
 * out, because a large plus mid-morph is a pair of stubs rather than a sign.
 */
describe("armsOf", () => {
  const BAR = 8
  const RING = 4

  it("draws a cross as the upright pair turned by an eighth", () => {
    const plus = armsOf(PLUS)
    const cross = armsOf(CROSS)
    expect(plus.along && plus.across).toBe(true)
    expect(cross.along && cross.across).toBe(true)
    expect(plus.spin).toBe(0)
    expect(cross.spin).toBeCloseTo(Math.PI / 4, 12)
  })

  it("gives an upright mark no turn, and a bare ring no arms", () => {
    for (const glyph of [MINUS, PLUS, CIRCLED_MINUS, BAR]) expect(armsOf(glyph).spin).toBe(0)
    expect(armsOf(RING).along).toBe(false)
    expect(armsOf(RING).across).toBe(false)
    expect(armsOf(BAR).along).toBe(false)
    expect(armsOf(BAR).across).toBe(true)
  })
})
