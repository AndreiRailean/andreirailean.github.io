import { describe, expect, it } from "vitest"
import { gaussian, hashSeed, makeRng } from "@/experiments/dangler/random"

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
    // Wire i and wire i+1 must not draw near-identical values, or a scene reads
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
    // Clamped rather than truly normal, so one unlucky draw cannot hand a wire
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
