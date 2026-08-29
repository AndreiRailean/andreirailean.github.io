import { describe, expect, it } from "vitest"
import { createScatter, tune, type ScatterSpec } from "@/experiments/flotsam/scatter"
import { createSea, type SeaSpec } from "@/experiments/flotsam/waves"

/**
 * The flotsam.
 *
 * The invariant worth protecting is stability: speck `i` must be the same speck
 * whatever else changed. Dangler broke exactly this once, and the symptom was
 * that dragging a count slider restirred the whole scene.
 */
const PLAIN: ScatterSpec = {
  seed: 5,
  dots: 400,
  smallest: 0.004,
  largest: 0.5,
  sizeMix: 0.5,
  hue: 200,
  hueSpread: 12,
  variance: 0.5,
}

const SEA: SeaSpec = {
  seed: 5,
  trains: 3,
  shortest: 0.5,
  longest: 20,
  steepness: 0.7,
  peak: 0,
  gusts: 0,
  heading: 0,
  spread: 30,
}

describe("stability", () => {
  it("keeps a speck's size, colour and home when the count is raised", () => {
    const few = createScatter({ ...PLAIN, dots: 400 })
    const many = createScatter({ ...PLAIN, dots: 9000 })

    for (const i of [0, 7, 123, 399]) {
      expect(many.radius[i]).toBe(few.radius[i])
      expect(many.hue[i]).toBe(few.hue[i])
      expect(many.saturation[i]).toBe(few.saturation[i])
      expect(many.u[i]).toBe(few.u[i])
      expect(many.v[i]).toBe(few.v[i])
    }
  })

  it("keeps a speck's size when only the colour settings change", () => {
    const before = createScatter(PLAIN)
    const after = createScatter({ ...PLAIN, hue: 40, hueSpread: 70 })
    expect([...after.radius]).toEqual([...before.radius])
    expect([...after.hue]).not.toEqual([...before.hue])
  })

  it("carries live positions across a rebuild, so a colour change does not restir the water", () => {
    const before = createScatter(PLAIN)
    before.u[3] = 0.9137
    before.v[3] = 0.2211

    const after = createScatter({ ...PLAIN, hue: 90 }, before)
    expect(after.u[3]).toBeCloseTo(0.9137, 6)
    expect(after.v[3]).toBeCloseTo(0.2211, 6)
  })

  it("gives a speck added by raising the count its own home rather than someone else's", () => {
    const before = createScatter({ ...PLAIN, dots: 10 })
    for (let i = 0; i < 10; i++) before.u[i] = 0.5

    const after = createScatter({ ...PLAIN, dots: 12 }, before)
    expect(after.u[9]).toBe(0.5)
    expect(after.u[10]).not.toBe(0.5)
    expect(after.u[10]).toBe(createScatter({ ...PLAIN, dots: 12 }).u[10])
  })

  it("scatters a different sea for a different seed", () => {
    const a = createScatter(PLAIN)
    const b = createScatter({ ...PLAIN, seed: 6 })
    expect([...a.u]).not.toEqual([...b.u])
    expect([...a.radius]).not.toEqual([...b.radius])
  })
})

describe("sizes", () => {
  it("stays inside the range at both ends", () => {
    const scatter = createScatter({ ...PLAIN, dots: 5000, smallest: 0.01, largest: 0.4 })
    for (let i = 0; i < scatter.count; i++) {
      expect(scatter.radius[i]).toBeGreaterThanOrEqual(0.01 - 1e-9)
      expect(scatter.radius[i]).toBeLessThanOrEqual(0.4 + 1e-9)
    }
  })

  /**
   * The distribution, not the range. Log-uniform was tried and puts a sixth of
   * the population in the top octave, which comes out as white confetti with the
   * fine haze the gathering is legible in buried under it.
   */
  it("puts almost everything at the small end, as a power law does", () => {
    const scatter = createScatter({ ...PLAIN, dots: 20_000, smallest: 0.004, largest: 0.4 })
    const above = (limit: number) => [...scatter.radius].filter((r) => r > limit).length / scatter.count

    // n(r) ∝ r⁻² on [a, b] gives P(r > x) = (1/x − 1/b)/(1/a − 1/b).
    const predict = (x: number) => (1 / x - 1 / 0.4) / (1 / 0.004 - 1 / 0.4)
    expect(above(0.04)).toBeCloseTo(predict(0.04), 2)
    expect(above(0.2)).toBeCloseTo(predict(0.2), 2)
    // Which is to say: nine in ten under four centimetres, one in a hundred over
    // twenty.
    expect(above(0.04)).toBeLessThan(0.11)
    expect(above(0.2)).toBeLessThan(0.02)
  })

  /**
   * The exponent was a constant until someone reached for a dimmer scene and
   * found that every lever on brightness also changed what was afloat. Keeping
   * the range wide while making the large end rarer is the thing that was
   * wanted, and it is exactly this.
   */
  it("thins the large end as the mix comes down, without narrowing the range", () => {
    const above = (sizeMix: number, limit: number) => {
      const scatter = createScatter({ ...PLAIN, dots: 20_000, smallest: 0.004, largest: 0.4, sizeMix })
      return [...scatter.radius].filter((r) => r > limit).length / scatter.count
    }

    // Strictly monotone: every step down makes big pieces rarer.
    const fractions = [1, 0.75, 0.5, 0.25, 0].map((mix) => above(mix, 0.04))
    for (let i = 1; i < fractions.length; i++) expect(fractions[i]!).toBeLessThan(fractions[i - 1]!)

    // The steepest setting is n(r) ∝ r⁻⁴, where a piece ten times the smallest
    // is ten thousand times rarer. That is meant to be a sea of dust with the
    // occasional object in it — but the occasional object has to still turn up,
    // or the upper handle of the size control has quietly gone dead.
    const steep = createScatter({ ...PLAIN, dots: 20_000, smallest: 0.004, largest: 0.4, sizeMix: 0 })
    expect([...steep.radius].filter((r) => r > 0.04).length).toBeGreaterThan(5)
    expect(Math.min(...steep.radius)).toBeLessThan(0.005)
  })

  it("is uniform at 1, log-uniform at 0.75 and the old power law at 0.5", () => {
    const sample = (sizeMix: number) => [
      ...createScatter({ ...PLAIN, dots: 40_000, smallest: 0.01, largest: 1, sizeMix }).radius,
    ]

    // Uniform in radius: half the pieces above the arithmetic midpoint.
    const uniform = sample(1)
    expect(uniform.filter((r) => r > 0.505).length / uniform.length).toBeCloseTo(0.5, 1)

    // Log-uniform: half above the *geometric* midpoint, which is equal numbers
    // per octave. This is the removable singularity in `drawRadius`, so it is
    // worth checking that the branch agrees with its own neighbourhood.
    const octaves = sample(0.75)
    expect(octaves.filter((r) => r > 0.1).length / octaves.length).toBeCloseTo(0.5, 1)
    const nearly = sample(0.7501)
    expect(nearly.filter((r) => r > 0.1).length / nearly.length).toBeCloseTo(0.5, 1)

    // n(r) ∝ r⁻²: P(r > x) = (1/x − 1/b)/(1/a − 1/b).
    const power = sample(0.5)
    expect(power.filter((r) => r > 0.1).length / power.length).toBeCloseTo((10 - 1) / (100 - 1), 2)
  })

  it("survives a range collapsed to a point", () => {
    const scatter = createScatter({ ...PLAIN, dots: 50, smallest: 0.03, largest: 0.03 })
    // Six places, not nine: radii live in a Float32Array, so three centimetres
    // comes back as 0.029999999.
    for (let i = 0; i < scatter.count; i++) expect(scatter.radius[i]).toBeCloseTo(0.03, 6)
  })
})

describe("tuning to a sea", () => {
  it("builds one response per speck per train, and only redoes it when the count changes", () => {
    const scatter = createScatter({ ...PLAIN, dots: 200 })
    const sea = createSea(SEA)
    tune(scatter, sea)

    expect(scatter.trains).toBe(3)
    expect(scatter.response.length).toBe(200 * 3)
    for (const value of scatter.response) {
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it("gives a big speck a smaller response than a small one to the same train", () => {
    const scatter = createScatter({ ...PLAIN, dots: 3000, smallest: 0.004, largest: 0.8 })
    const sea = createSea({ ...SEA, trains: 1, shortest: 1, longest: 1 })
    tune(scatter, sea)

    let smallest = 0
    let largest = 0
    for (let i = 0; i < scatter.count; i++) {
      if (scatter.radius[i]! < scatter.radius[smallest]!) smallest = i
      if (scatter.radius[i]! > scatter.radius[largest]!) largest = i
    }
    expect(scatter.response[smallest]).toBeGreaterThan(0.99)
    expect(scatter.response[largest]).toBeLessThan(0.2)
  })

  it("points every speck's wave drift the same way, since one sea has one downwind", () => {
    const scatter = createScatter({ ...PLAIN, dots: 500 })
    tune(scatter, createSea({ ...SEA, trains: 1, shortest: 4, longest: 4, spread: 0, heading: 0 }))

    for (let i = 0; i < scatter.count; i++) {
      expect(scatter.stokesX[i]).toBeGreaterThan(0)
      expect(Math.abs(scatter.stokesY[i]!)).toBeLessThan(Math.abs(scatter.stokesX[i]!))
    }
  })

  it("carries no wave drift at all on flat water", () => {
    const scatter = createScatter({ ...PLAIN, dots: 100 })
    tune(scatter, createSea({ ...SEA, steepness: 0 }))
    for (let i = 0; i < scatter.count; i++) {
      expect(scatter.stokesX[i]).toBe(0)
      expect(scatter.stokesY[i]).toBe(0)
    }
  })
})
