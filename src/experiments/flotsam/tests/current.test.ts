import { describe, expect, it } from "vitest"
import { createCurrent, currentAt, type CurrentSpec } from "@/experiments/flotsam/current"

/**
 * The current.
 *
 * The two properties here are the ones the piece leans on for its whole
 * argument: the current is the only thing that transports, and the eddies must
 * stir without gathering, so that everything gathered on screen is the waves'
 * doing. Both were wrong once and neither was visible.
 */
const PATCH = { width: 64, height: 40 }

const PLAIN: CurrentSpec = { seed: 3, drift: 0, bearing: 0, eddies: 1, gyre: 8 }

const build = (spec: Partial<CurrentSpec> = {}) => createCurrent({ ...PLAIN, ...spec }, PATCH.width, PATCH.height)

const velocity = (current: ReturnType<typeof createCurrent>, x: number, y: number, t = 0) => {
  const out = { x: 0, y: 0 }
  currentAt(current, x, y, t, out)
  return out
}

describe("the set and the drift", () => {
  it("flows at exactly the speed asked for, toward exactly the bearing asked for", () => {
    const current = build({ drift: 0.7, bearing: 120, eddies: 0 })
    const at = velocity(current, 13, -4)
    expect(Math.hypot(at.x, at.y)).toBeCloseTo(0.7, 9)
    expect((Math.atan2(at.y, at.x) * 180) / Math.PI).toBeCloseTo(120, 9)
  })

  it("uses the same dial as the waves and the light: 0 is right, 90 is up", () => {
    const east = velocity(build({ drift: 1, bearing: 0, eddies: 0 }), 0, 0)
    const north = velocity(build({ drift: 1, bearing: 90, eddies: 0 }), 0, 0)
    expect(east.x).toBeCloseTo(1, 9)
    expect(east.y).toBeCloseTo(0, 9)
    expect(north.x).toBeCloseTo(0, 9)
    expect(north.y).toBeCloseTo(1, 9)
  })

  it("is uniform, so it moves everything and gathers nothing", () => {
    const current = build({ drift: 0.4, bearing: 33, eddies: 0 })
    const a = velocity(current, -900, 250, 17)
    const b = velocity(current, 7000, -3, 4001)
    expect(a).toEqual(b)
  })
})

describe("the eddies", () => {
  /**
   * The property the module exists for. It is asserted rather than trusted
   * because `currentAt` is two lines that are algebraically indistinguishable
   * from several wrong ones, and nothing about a wrong one looks wrong: the
   * flotsam simply piles up somewhere and reads as a spectacular result.
   */
  it("is divergence-free everywhere, so water neither appears nor disappears", () => {
    const current = build({ eddies: 1.4, gyre: 6 })
    const h = 1e-4

    let worst = 0
    for (let i = 0; i < 400; i++) {
      const x = (i / 400) * PATCH.width - PATCH.width / 2
      const y = Math.sin(i) * PATCH.height * 0.4
      const t = i * 0.09
      const divergence =
        (velocity(current, x + h, y, t).x - velocity(current, x - h, y, t).x) / (2 * h) +
        (velocity(current, x, y + h, t).y - velocity(current, x, y - h, t).y) / (2 * h)
      worst = Math.max(worst, Math.abs(divergence))
    }
    // Central differences on a field of order 1 m/s over metres: this is the
    // floor set by floating point, not a tolerance anyone chose.
    expect(worst).toBeLessThan(1e-5)
  })

  /**
   * The half that was missed. Divergence-free on the plane is not enough: the
   * specks live on a wrapped patch, and a flow that is not periodic on it
   * stretches the fundamental domain and folds it back unevenly. Measured with
   * a non-periodic field, one minute of eddies alone took the index of
   * dispersion from 1 to 134.
   */
  it("is periodic on the patch, in both directions", () => {
    const current = build({ eddies: 0.9, gyre: 5 })
    for (const [x, y, t] of [
      [3, 7, 0],
      [-19, 11, 12.5],
      [0.5, -8, 40],
    ] as const) {
      const here = velocity(current, x, y, t)
      expect(velocity(current, x + PATCH.width, y, t).x).toBeCloseTo(here.x, 9)
      expect(velocity(current, x + PATCH.width, y, t).y).toBeCloseTo(here.y, 9)
      expect(velocity(current, x, y + PATCH.height, t).x).toBeCloseTo(here.x, 9)
      expect(velocity(current, x, y + PATCH.height, t).y).toBeCloseTo(here.y, 9)
    }
  })

  it("never exceeds the speed it was set to", () => {
    const current = build({ eddies: 0.35, gyre: 9 })
    let fastest = 0
    for (let i = 0; i < 2000; i++) {
      const at = velocity(current, i * 0.37 - 300, i * 0.83 - 700, i * 0.05)
      fastest = Math.max(fastest, Math.hypot(at.x, at.y))
    }
    expect(fastest).toBeLessThanOrEqual(0.35 + 1e-9)
    // And it does get somewhere near it, or the control would be a lie in the
    // other direction.
    expect(fastest).toBeGreaterThan(0.15)
  })

  it("keeps a large gyre rather than rounding it away to nothing", () => {
    // A turn wider than the patch quantises to zero cycles, which would be a
    // term with no velocity in it at all. One cycle across the patch is the
    // largest eddy a patch can hold; anything bigger is a uniform current.
    const current = build({ eddies: 0.5, gyre: 5000 })
    let fastest = 0
    for (let i = 0; i < 500; i++) {
      const at = velocity(current, i * 0.31 - 40, i * 0.17 - 20, 0)
      fastest = Math.max(fastest, Math.hypot(at.x, at.y))
    }
    expect(fastest).toBeGreaterThan(0.1)
  })

  it("gives the same field for the same seed and patch, and a different one otherwise", () => {
    expect(velocity(build(), 5, 5, 3)).toEqual(velocity(build(), 5, 5, 3))
    expect(velocity(build({ seed: 4 }), 5, 5, 3)).not.toEqual(velocity(build(), 5, 5, 3))
    // A different patch is a different field, unavoidably: the quantisation is
    // to whole cycles across it. This is why the current is rebuilt on a resize.
    const wider = createCurrent(PLAIN, PATCH.width * 3, PATCH.height)
    expect(velocity(wider, 5, 5, 3)).not.toEqual(velocity(build(), 5, 5, 3))
  })

  it("wanders, so the field never settles into a fixed picture", () => {
    const current = build({ eddies: 0.6, gyre: 7 })
    expect(velocity(current, 2, 3, 0)).not.toEqual(velocity(current, 2, 3, 90))
  })
})
