import { describe, expect, it } from "vitest"
import { buildArrangement } from "@/experiments/dangler/arrangement"
import { FIXED_DT, createRopes } from "@/experiments/dangler/rope"
import { DEFAULT_SETTINGS, normalizeSettings } from "@/experiments/dangler/settings"

/**
 * The solver: flat arrays, links, directional bending, settling.
 *
 * Almost nothing here is visible. A stretched wire, a wire that has quietly
 * straightened, an arrangement that reshuffled itself — all of them look like a
 * plausible scatter of dots. Numbers are the only way to tell, which is why
 * every assertion below corresponds to a bug that actually happened.
 */

type Ropes = ReturnType<typeof createRopes>

const tipOf = (ropes: Ropes, wire: number) => {
  const tip = ropes.offset[wire + 1]! - 1
  return { x: ropes.px[tip]!, y: ropes.py[tip]!, z: ropes.pz[tip]! }
}

const lengthOf = (ropes: Ropes, wire: number) => {
  let total = 0
  for (let i = ropes.offset[wire]!; i < ropes.offset[wire + 1]! - 1; i++) {
    total += Math.hypot(
      ropes.px[i + 1]! - ropes.px[i]!,
      ropes.py[i + 1]! - ropes.py[i]!,
      ropes.pz[i + 1]! - ropes.pz[i]!,
    )
  }
  return total
}

const settled = (settings = DEFAULT_SETTINGS) => {
  const arrangement = buildArrangement(settings)
  const ropes = createRopes(arrangement.specs)
  ropes.settle()
  return { arrangement, ropes }
}

describe("settling", () => {
  it("converges, and reports itself at rest", () => {
    const { ropes } = settled()
    expect(ropes.maxError()).toBeLessThan(1e-3)
    expect(ropes.atRest()).toBe(true)
  })

  it("holds every link at its rest length", () => {
    // A positional solver's stiffness is capped by its pass count, so the chain
    // reaches a steady state: settling longer never improves this, and neither
    // does iterating more. Shortening FIXED_DT is what buys accuracy.
    const { arrangement, ropes } = settled()
    let worst = 0
    for (let wire = 0; wire < ropes.wireCount; wire++) {
      const spec = arrangement.specs[wire]!
      const segment = spec.length / spec.segments
      for (let i = ropes.offset[wire]!; i < ropes.offset[wire + 1]! - 1; i++) {
        const link = Math.hypot(
          ropes.px[i + 1]! - ropes.px[i]!,
          ropes.py[i + 1]! - ropes.py[i]!,
          ropes.pz[i + 1]! - ropes.pz[i]!,
        )
        worst = Math.max(worst, Math.abs(link - segment) / segment)
      }
    }
    expect(worst).toBeLessThan(0.01)
  })

  it("keeps a wire pinned to its anchor, hanging below it", () => {
    const { arrangement, ropes } = settled()
    const anchor = arrangement.specs[0]!.anchor
    const head = Math.hypot(ropes.px[0]! - anchor.x, ropes.py[0]! - anchor.y, ropes.pz[0]! - anchor.z)
    expect(head).toBeLessThan(1e-6)
    expect(ropes.pz[ropes.offset[1]! - 1]!).toBeLessThan(anchor.z)
  })
})

describe("stiffness", () => {
  /** How far a settled wire's tip sits from directly below its anchor. */
  const tipOffset = (stiffness: number) => {
    const { ropes } = settled({ ...DEFAULT_SETTINGS, stiffness, irregularity: 0 })
    const head = ropes.offset[0]!
    const tip = ropes.offset[1]! - 1
    return Math.hypot(ropes.px[tip]! - ropes.px[head]!, ropes.py[tip]! - ropes.py[head]!)
  }

  // `stiffness` scales rest curvature, not constraint strength. Scaling strength
  // instead could not hold an arc against gravity at all, and partial
  // projections were unstable in a band of middling strengths — an 80-segment
  // wire crumpled into 90°-per-joint folds while the same wire was fine at both
  // weaker and full strength.
  it("hangs a limp wire nearly plumb", () => {
    expect(tipOffset(0)).toBeLessThan(0.05)
  })

  it("lets a stiff wire hold its bend", () => {
    // Measuring bending as the distance across two links would fail here: it is
    // second-order in the joint angle, so at 28 segments a 0.9 rad set differs
    // from straight by 0.014% — under the solver's own residual, which made a
    // rigid wire hang as limp as a chain.
    expect(tipOffset(1)).toBeGreaterThan(tipOffset(0) * 5)
  })
})

describe("growing the wire count", () => {
  it("preserves the wires already there, exactly", () => {
    const few = settled({ ...DEFAULT_SETTINGS, wires: 3 })
    const before = Array.from(few.ropes.px.subarray(0, few.ropes.offset[3]!))

    const many = buildArrangement({ ...DEFAULT_SETTINGS, wires: 10 })
    const grown = createRopes(many.specs, few.ropes)
    expect(Array.from(grown.px.subarray(0, grown.offset[3]!))).toEqual(before)
  })

  it("reports only the new wires as fresh", () => {
    // Settling everything zeroes velocities, so adding one wire would visibly
    // calm every other wire in a breeze.
    const few = settled({ ...DEFAULT_SETTINGS, wires: 3 })
    const many = buildArrangement({ ...DEFAULT_SETTINGS, wires: 10 })
    expect(createRopes(many.specs, few.ropes).freshWires).toEqual([3, 4, 5, 6, 7, 8, 9])
  })
})

/**
 * How a settings change avoids throwing the scene.
 *
 * Settling synchronously in response to one was tried and froze the main thread
 * for 3056ms on a single notch of the wires slider. A settings change has to stay
 * in the low milliseconds — the sliders are the instrument, and one that stalls
 * under the hand is unusable however good the scene is.
 */
describe("carrying and resampling", () => {
  const SETTINGS = normalizeSettings({ wires: 6, beads: 4, segments: 24, extent: 2, ceiling: 4, length: 3 })

  it("moves a wire exactly as far as its anchor went", () => {
    // The real sequence: the anchors move first, then each wire is carried after
    // its own. Carrying without moving the anchor would leave the wire hanging
    // from nowhere, which is not something the engine ever does.
    const { arrangement, ropes } = settled(SETTINGS)
    const shifted = arrangement.specs.map((spec) => ({
      ...spec,
      anchor: { x: spec.anchor.x + 1.5, y: spec.anchor.y - 0.5, z: spec.anchor.z + 0.25 },
    }))
    const before = tipOf(ropes, 0)
    ropes.update(shifted)
    for (let wire = 0; wire < shifted.length; wire++) ropes.carry(wire, 1.5, -0.5, 0.25)
    const after = tipOf(ropes, 0)
    expect(after.x - before.x).toBeCloseTo(1.5, 6)
    expect(after.z - before.z).toBeCloseTo(0.25, 6)
  })

  it("does not launch the wire it carried", () => {
    // Verlet reads velocity from the change in position, so a bodily move that
    // reads as one fires the wire off exactly as a teleport does. This is the
    // failure it replaced: relocating anchors left wires spinning at 139 m/s.
    const { arrangement, ropes } = settled(SETTINGS)
    const shifted = arrangement.specs.map((spec) => ({
      ...spec,
      anchor: { x: spec.anchor.x + 1.5, y: spec.anchor.y - 0.5, z: spec.anchor.z + 0.25 },
    }))
    ropes.update(shifted)
    for (let wire = 0; wire < shifted.length; wire++) ropes.carry(wire, 1.5, -0.5, 0.25)

    const before = tipOf(ropes, 0)
    ropes.step(null)
    const after = tipOf(ropes, 0)
    const speed = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z) / FIXED_DT
    expect(speed).toBeLessThan(0.5)
  })

  it("redraws a wire at a new particle count without moving it", () => {
    // Otherwise dragging the quality knob rearranges the scene. Laying out and
    // settling instead costs 106ms and discards whatever the wire was doing.
    const { ropes } = settled(SETTINGS)
    const shape = [0, 1, 2].map((wire) => ({ tip: tipOf(ropes, wire), length: lengthOf(ropes, wire) }))

    const finer = buildArrangement({ ...SETTINGS, segments: 48 })
    const resampled = createRopes(finer.specs, ropes)

    expect(resampled.particleCount).not.toBe(ropes.particleCount)
    shape.forEach((was, wire) => {
      const tip = tipOf(resampled, wire)
      expect(Math.hypot(tip.x - was.tip.x, tip.y - was.tip.y, tip.z - was.tip.z)).toBeLessThan(0.02)
      expect(Math.abs(lengthOf(resampled, wire) - was.length) / was.length).toBeLessThan(0.02)
    })
    expect(resampled.freshWires).toEqual([])
  })
})
