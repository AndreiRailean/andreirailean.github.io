import { describe, expect, it } from "vitest"
import { gaussian, hashSeed, makeRng, shuffle, signed } from "@/experiments/random"

/**
 * The seeded generators everything else in the piece is built on. If these are
 * not reproducible then nothing downstream can be: a scene is only shareable
 * because a seed and an index fully determine it.
 */

describe("makeRng", () => {
  it("is deterministic for one seed", () => {
    const first = makeRng(hashSeed(7, 3, 0x5ba9e))
    const second = makeRng(hashSeed(7, 3, 0x5ba9e))
    const draw = (rng: () => number) => Array.from({ length: 5 }, () => rng())
    expect(draw(first)).toEqual(draw(second))
  })

  it("decorrelates adjacent indices", () => {
    // Strand i and strand i+1 must not draw near-identical values, or a scene reads
    // as a gradient rather than a scatter.
    const at3 = makeRng(hashSeed(7, 3, 0x5ba9e))()
    const at4 = makeRng(hashSeed(7, 4, 0x5ba9e))()
    expect(Math.abs(at3 - at4)).toBeGreaterThan(0.01)
  })
})

describe("gaussian", () => {
  const SAMPLES = 20_000

  const distribution = () => {
    const rng = makeRng(1)
    let min = 9
    let max = -9
    let sum = 0
    let sumOfSquares = 0
    for (let i = 0; i < SAMPLES; i++) {
      const value = gaussian(rng)
      min = Math.min(min, value)
      max = Math.max(max, value)
      sum += value
      sumOfSquares += value * value
    }
    return { min, max, mean: sum / SAMPLES, sd: Math.sqrt(sumOfSquares / SAMPLES) }
  }

  it("is clamped to ±2.5", () => {
    // Clamped rather than truly normal, so one unlucky draw cannot hand a strand
    // an absurd length.
    const { min, max } = distribution()
    expect(min).toBeGreaterThanOrEqual(-2.5)
    expect(max).toBeLessThanOrEqual(2.5)
  })

  it("is still roughly standard", () => {
    const { mean, sd } = distribution()
    expect(Math.abs(mean)).toBeLessThan(0.03)
    expect(Math.abs(sd - 1)).toBeLessThan(0.06)
  })
})

describe("signed", () => {
  it("is the same bits as the expression it replaced", () => {
    // Eight pieces wrote `rng() * 2 - 1` inline. Adopting `signed` must not move a
    // seeded scene, so the comparison is exact, not approximate.
    const a = makeRng(hashSeed(11, 2))
    const b = makeRng(hashSeed(11, 2))
    for (let i = 0; i < 1000; i++) expect(signed(a)).toBe(b() * 2 - 1)
  })

  it("covers both sides of zero within [-1, 1)", () => {
    const rng = makeRng(3)
    const draws = Array.from({ length: 2000 }, () => signed(rng))
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(-1)
    expect(Math.max(...draws)).toBeLessThan(1)
    expect(draws.some((v) => v < -0.9) && draws.some((v) => v > 0.9)).toBe(true)
  })
})

describe("shuffle", () => {
  /** The loop bubbles, dotfield and hexgrid each carried before it was hoisted. */
  function inline(rng: () => number, items: number[]): number[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[items[i], items[j]] = [items[j]!, items[i]!]
    }
    return items
  }

  it("draws in the order the inline copies did, so no seeded scene moves", () => {
    for (const seed of [1, 7, 42, 9001]) {
      for (const length of [0, 1, 2, 17, 256, 391]) {
        const order = Array.from({ length }, (_, i) => i)
        const expected = inline(makeRng(seed), [...order])
        expect(shuffle(makeRng(seed), [...order])).toEqual(expected)
      }
    }
  })

  it("shuffles a typed array's prefix in place and leaves the rest", () => {
    // Bubbles' permutation table is 512 long and shuffles its first half, then doubles it.
    const table = new Uint8Array(512)
    for (let i = 0; i < 256; i++) table[i] = i
    shuffle(makeRng(5), table.subarray(0, 256))
    const expected = inline(
      makeRng(5),
      Array.from({ length: 256 }, (_, i) => i),
    )
    expect([...table.subarray(0, 256)]).toEqual(expected)
    expect(table.subarray(256).every((v) => v === 0)).toBe(true)
  })

  it("returns a permutation, not a resample", () => {
    const shuffled = shuffle(
      makeRng(8),
      Array.from({ length: 100 }, (_, i) => i),
    )
    expect([...shuffled].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i))
    expect(shuffled).not.toEqual(Array.from({ length: 100 }, (_, i) => i))
  })
})
