import { describe, expect, it } from "vitest"
import { makeCanopy } from "@/experiments/dangler/canopy"
import { canopyTremble } from "@/experiments/dangler/wind"
import { createSway } from "@/experiments/dangler/sway"

/**
 * Sway is coherent where tremble is not, and that is the entire difference.
 *
 * This is the one failure in the piece that was found by a human rather than by
 * measurement: `tremble` moves each anchor independently and reads as the
 * *observer* being jostled, so the canopy stops being an object and there is no
 * stable frame left to read the scene against. It made people queasy. Gentler
 * did not fix it; only coherence did.
 *
 * So `sway` carries the whole canopy rigidly — lean, twist and bob are rotations
 * and a translation, which preserve anchor separations to machine precision. The
 * strain assertion below is the property the module exists for.
 */

const SHAPE = { extent: 2.4, ceiling: 4.2, relief: 0.9, branches: 0 }
const FRAME = 1 / 60

type Point = { x: number; y: number; z: number }

const rest: Point[] = Array.from({ length: 30 }, (_, i) => makeCanopy(7, SHAPE).anchorFor(i))

/** Worst change in the distance between any two anchors, as a fraction. */
function worstStrain(moved: Point[]): number {
  let worst = 0
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      const before = Math.hypot(rest[i]!.x - rest[j]!.x, rest[i]!.y - rest[j]!.y, rest[i]!.z - rest[j]!.z)
      const after = Math.hypot(moved[i]!.x - moved[j]!.x, moved[i]!.y - moved[j]!.y, moved[i]!.z - moved[j]!.z)
      if (before > 1e-6) worst = Math.max(worst, Math.abs(after - before) / before)
    }
  }
  return worst
}

/** Drive the canopy hard for a while, then read the shape of the anchor cloud. */
function drivenHard() {
  const sway = createSway()
  const out = { x: 0, y: 0, z: 0 }
  let clock = 0
  for (let i = 0; i < 400; i++) {
    clock += FRAME
    sway.update(9, 4, clock, FRAME, 1)
  }
  const moved = rest.map((anchor) => {
    sway.displace(anchor.x, anchor.y, anchor.z, out)
    return { x: anchor.x + out.x, y: anchor.y + out.y, z: anchor.z + out.z }
  })
  return { sway, moved, clock }
}

describe("createSway", () => {
  it("actually moves the canopy", () => {
    const { moved } = drivenHard()
    const travelled = Math.max(
      ...moved.map((point, i) => Math.hypot(point.x - rest[i]!.x, point.y - rest[i]!.y, point.z - rest[i]!.z)),
    )
    expect(travelled).toBeGreaterThan(0.15)
  })

  it("keeps every anchor pair exactly as far apart", () => {
    expect(worstStrain(drivenHard().moved)).toBeLessThan(1e-5)
  })

  it("is a different thing from tremble, on purpose", () => {
    const out = { x: 0, y: 0, z: 0 }
    const trembled = rest.map((anchor) => {
      canopyTremble(anchor.x, anchor.y, 3.3, 1, out)
      return { x: anchor.x + out.x, y: anchor.y + out.y, z: anchor.z + out.z }
    })
    expect(worstStrain(trembled)).toBeGreaterThan(1e-3)
  })

  it("returns to centre in still air, exactly rather than nearly", () => {
    const { sway, clock } = drivenHard()
    const out = { x: 0, y: 0, z: 0 }
    let now = clock
    for (let i = 0; i < 3000; i++) {
      now += FRAME
      sway.update(0, 0, now, FRAME, 1)
    }
    sway.displace(rest[0]!.x, rest[0]!.y, rest[0]!.z, out)
    expect(sway.atRest()).toBe(true)
    expect(Math.hypot(out.x, out.y, out.z)).toBeLessThan(1e-3)
  })

  it("is perfectly still at 0", () => {
    const off = createSway()
    const out = { x: 0, y: 0, z: 0 }
    off.update(9, 4, 1.5, FRAME, 0)
    off.displace(rest[0]!.x, rest[0]!.y, rest[0]!.z, out)
    expect(off.atRest()).toBe(true)
    // Magnitudes, so a -0 component still counts as still. See wind.test.ts.
    expect([Math.abs(out.x), Math.abs(out.y), Math.abs(out.z)]).toEqual([0, 0, 0])
  })

  it("overshoots upright after a gust, rather than gliding back", () => {
    // Underdamped on purpose: a canopy that eased back to centre reads as a
    // mechanism rather than something hanging.
    const kick = createSway()
    const out = { x: 0, y: 0, z: 0 }
    const lean: number[] = []
    let now = 0
    for (let i = 0; i < 240; i++) {
      now += FRAME
      kick.update(i < 30 ? 14 : 0, 0, now, FRAME, 1)
      kick.displace(0, 0, SHAPE.ceiling, out)
      lean.push(out.x)
    }
    expect(Math.max(...lean)).toBeGreaterThan(0.05)
    expect(Math.min(...lean)).toBeLessThan(-0.005)
  })
})
