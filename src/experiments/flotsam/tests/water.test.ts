import { describe, expect, it } from "vitest"
import { normalizeSettings, type Settings } from "@/experiments/flotsam/settings"
import { createWater, indexOfDispersion, RUN_STEP } from "@/experiments/flotsam/water"

/**
 * The water's physics, with no page and no canvas.
 *
 * These were browser tests until #287, reading the same numbers through
 * `window.experiment` after a build and a page load. Nothing in them was about
 * pixels: `transport`, `orbit`, `dispersion` and `minJacobian` are all computed
 * in `water.ts`, so they are asserted against it here, and the page keeps one
 * check that `stats()` reports what the water measured.
 *
 * The frame is the browser suite's viewport, 1280 × 900, because `span` is
 * metres across the shorter side and the thresholds below were measured at that
 * framing. It costs nothing here: no pixel is ever drawn.
 */
const WIDTH = 1280
const HEIGHT = 900

/** A uniform random scatter disperses at 1. The homes are drawn uniformly. */
const UNGATHERED = 1

/** Below this the sea has folded over itself; see `FlotsamStats.minJacobian`. */
const FOLDED = 0

function waterOf(patch: Partial<Settings>) {
  return createWater(normalizeSettings(patch), WIDTH, HEIGHT)
}

/** The rest positions, copied, so a later step cannot change what was read. */
const homes = (water: ReturnType<typeof waterOf>) => ({
  u: water.scatter.u.slice(),
  v: water.scatter.v.slice(),
})

/** Mean distance a rest position moved, in metres, the short way round the wrap. */
function meanTravel(water: ReturnType<typeof waterOf>, before: ReturnType<typeof homes>): number {
  const { u, v } = water.scatter
  const { patchWidth, patchHeight } = water.view
  const shortest = (d: number) => d - Math.round(d)
  let sum = 0
  for (let i = 0; i < before.u.length; i++) {
    sum += Math.hypot(shortest(u[i]! - before.u[i]!) * patchWidth, shortest(v[i]! - before.v[i]!) * patchHeight)
  }
  return sum / before.u.length
}

/**
 * The piece's thesis, and the one thing that must never break.
 *
 * A violent sea with no current at all: the flotsam swings by half a metre and
 * has to be exactly where it started, because the wave displacement is a closed
 * form recomputed from the rest position every frame and nothing about it
 * accumulates. Anything above zero here means a wave has started transporting,
 * which is what the whole piece says waves do not do.
 */
describe("what moves the flotsam", () => {
  it("goes nowhere at all on a sea with no current, however hard it shakes it", () => {
    const water = waterOf({ dots: 3000, steepness: 0.9, trains: 1, drift: 0, eddies: 0, stokes: 0 })
    const before = homes(water)

    water.run(120)
    water.survey()

    // Not "close": the same numbers. Nothing is allowed to accumulate.
    expect(water.scatter.u).toEqual(before.u)
    expect(water.scatter.v).toEqual(before.v)
    expect(water.stats().transport).toBe(0)
    expect(water.stats().orbit).toBeGreaterThan(0.1)
  })

  /**
   * The other half of the same claim: a current a hundred times slower than the
   * swinging is the thing that actually moves flotsam.
   */
  it("is carried by a slow current where a fast sea carries it nowhere", () => {
    // Few dots: transport is a mean speed, and needs no density to mean something.
    const water = waterOf({ dots: 300, steepness: 0.9, drift: 0.2, bearing: 0, eddies: 0, stokes: 0 })
    const before = homes(water)

    water.run(10)

    expect(water.stats().transport).toBeCloseTo(0.2, 3)
    // And it went that far: two metres in ten seconds, every piece of it.
    expect(meanTravel(water, before)).toBeCloseTo(2, 2)
  })

  /**
   * Wave drift is invisible on any single frame by construction — that is the
   * point of it — so the only way to check it exists is to skip a minute forward
   * and ask where everything went.
   */
  it("is moved by wave drift over a minute and by nothing over a frame", () => {
    const water = waterOf({
      dots: 300,
      trains: 1,
      shortest: 8,
      longest: 8,
      steepness: 0.6,
      drift: 0,
      eddies: 0,
      stokes: 1,
    })

    const start = homes(water)
    water.run(RUN_STEP)
    // uₛ = Q²c, and an eight-metre wave runs at 3.5 m/s, so 0.36 × 3.5.
    const speed = water.stats().transport
    expect(speed).toBeGreaterThan(0.5)
    expect(speed).toBeLessThan(2)
    // One frame's worth is a couple of centimetres — against an orbit of tens.
    expect(meanTravel(water, start)).toBeLessThan(0.05)
    water.survey()
    expect(water.stats().orbit).toBeGreaterThan(meanTravel(water, start) * 10)

    // A minute, and the drift is the whole of the distance. Summed a frame at a
    // time, because a minute of it is further than the patch is wide and a
    // wrapped position cannot say how many times it has been round.
    let travelled = 0
    for (let frame = 0; frame < 60 / RUN_STEP; frame++) {
      const was = homes(water)
      water.step(RUN_STEP)
      travelled += meanTravel(water, was)
    }
    expect(travelled).toBeGreaterThan(speed * 60 * 0.9)

    water.setSettings({ ...water.settings, stokes: 0 })
    const parked = homes(water)
    water.run(RUN_STEP)
    expect(water.stats().transport).toBe(0)
    expect(water.scatter.u).toEqual(parked.u)
  })
})

describe("what gathers the flotsam", () => {
  /**
   * The emergent behaviour the piece exists for, and there is no way to see it in
   * a still: a scatter that has gathered and one that has not both look like a
   * scatter of dots.
   */
  it("is gathered into lines by a steep sea, and not by a flat one", () => {
    const water = waterOf({
      dots: 9000,
      trains: 1,
      shortest: 6,
      longest: 6,
      steepness: 0,
      drift: 0,
      eddies: 0,
      stokes: 0,
    })

    water.survey()
    expect(water.stats().dispersion).toBeCloseTo(UNGATHERED, 0)

    water.setSettings({ ...water.settings, steepness: 0.85 })
    water.run(4)
    water.survey()
    const steep = water.stats()

    expect(steep.dispersion).toBeGreaterThan(3)
    // And it is genuinely the waves: the compression that did it is reported too.
    expect(steep.minJacobian).toBeLessThan(0.2)
    expect(steep.minJacobian).toBeGreaterThan(FOLDED)
  })

  /**
   * The bug that cost an afternoon and looked like a triumph.
   *
   * The eddies are incompressible *and* periodic on the wrapped patch, which
   * together are what stop them concentrating anything — so that every clump on
   * screen is the waves' doing. Before the periodicity, one minute of this took
   * the dispersion from 1 to 134: it emptied most of the frame and swept
   * everything into a few clots, and it looked like a spectacular emergent result
   * rather than a torus with a seam in it.
   *
   * That the field is divergence-free and periodic is `current.test.ts`; this
   * asks that the stepping advects through it on the wrapped patch without
   * gathering, which is the integrator's half (the midpoint note on `advance`).
   * Fifteen seconds, as in the browser: with the periodicity removed (cycles not
   * rounded to whole numbers in `createCurrent`) that is already enough to fail.
   */
  it("is stirred by eddies without any of it gathering", () => {
    const water = waterOf({ dots: 3000, steepness: 0, drift: 0, stokes: 0, eddies: 0.9, gyre: 3, span: 8 })

    water.survey()
    const before = water.stats().dispersion
    water.run(15)
    water.survey()
    const after = water.stats()

    // It really did stir: fifteen seconds at nearly a metre a second over
    // three-metre gyres is several turnovers, not a nudge.
    expect(after.transport).toBeGreaterThan(0.1)
    expect(after.dispersion).toBeLessThan(1.25)
    expect(Math.abs(after.dispersion - before)).toBeLessThan(0.3)
  })
})

/**
 * **The water moves each speck by its own response.** How the response falls
 * with size is `waves.test.ts` ("size response"), and that a big speck is handed
 * a smaller one than a small speck is `scatter.test.ts`. What is left is that
 * the survey displaces each piece by its own entry in the table, which `orbit`
 * reads. A browser test until #287; it read nothing but `orbit`. The ratio
 * measured 51-52 at run(0.5), run(1) and run(3) on 2026-09-07; the bound is 20.
 */
describe("what a raft does on a chop", () => {
  it("ignores the chop a speck beside it is tracing", () => {
    const water = waterOf({ dots: 300, trains: 1, shortest: 1.2, longest: 1.2, steepness: 0.8, span: 6 })

    const orbit = (sizes: { smallest: number; largest: number }) => {
      water.setSettings({ ...water.settings, ...sizes })
      water.run(0.5)
      water.survey()
      return water.stats().orbit
    }

    const specks = orbit({ smallest: 0.004, largest: 0.006 })
    const rafts = orbit({ smallest: 1, largest: 1.2 })
    expect(rafts).toBeGreaterThan(0)
    expect(specks).toBeGreaterThan(rafts * 20)
  })
})

describe("the index of dispersion", () => {
  it("reads 0 on an even grid, under 1 on a smoothed one, and more where counts bunch", () => {
    expect(indexOfDispersion([4, 4, 4, 4])).toBe(0)
    // Variance a half, mean 1: more even than a random scatter, which reads 1.
    expect(indexOfDispersion([0, 2, 1, 1, 0, 2, 1, 1])).toBe(0.5)
    expect(indexOfDispersion([0, 0, 0, 8])).toBe(6)
    expect(indexOfDispersion([0, 0, 0])).toBe(0)
  })
})
