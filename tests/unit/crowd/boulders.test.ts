import { describe, expect, it } from "vitest"
import { makeCamera } from "@/experiments/crowd/camera"
import { drawFrame, makeScratch } from "@/experiments/crowd/draw"
import { DEFAULT_SETTINGS } from "@/experiments/crowd/settings"
import { createBoulders, type Boulder } from "@/experiments/crowd/boulders"
import { createPath } from "@/experiments/crowd/path"
import type { Person } from "@/experiments/crowd/throng"

/**
 * Boulders, which hide whoever is behind them.
 *
 * **Each hidden case is paired with a visible one** that differs in one thing,
 * because "nobody was hidden" passes as readily when the test is broken as when
 * the boulder is — the absence-without-presence shape the root `AGENTS.md`
 * lists.
 */

const noop = () => {}
/** Every method a no-op: these tests read what the draw decided, not what it painted. */
const glass = new Proxy({}, { get: () => noop, set: () => true }) as unknown as CanvasRenderingContext2D

/** Standing still at `(x, y)`, head at 1.6 m. */
const standing = (x: number, y: number): Person =>
  ({ x, y, vx: 0, vy: 0, phase: 0, running: false, head: 1.6, headR: 0.1, quarry: false }) as unknown as Person

/** Looking along +x from the origin, eye at 1.6 m. */
const camera = makeCamera(0, 0, 1.6, 0, 0, 62, 60, 1600, 1000)

function frame(people: Person[], boulders: Boulder[]) {
  return drawFrame(glass, {
    people,
    camera,
    ground: () => 0,
    settings: DEFAULT_SETTINGS,
    width: 1600,
    height: 1000,
    scratch: makeScratch(),
    boulders,
  })
}

const rock = (x: number, y: number, r: number): Boulder => ({ x, y, r, side: 1 })

describe("a boulder", () => {
  it("hides somebody straight behind it, and not somebody straight in front", () => {
    expect(frame([standing(40, 0)], [rock(20, 0, 4)]).hidden).toBe(1)
    expect(frame([standing(12, 0)], [rock(20, 0, 4)]).hidden).toBe(0)
  })

  it("hides nobody when it is not between us", () => {
    expect(frame([standing(40, 0)], [rock(20, 12, 4)]).hidden).toBe(0)
  })

  it("hides somebody close behind it at the side, not only dead behind", () => {
    expect(frame([standing(40, 1.5)], [rock(20, 0, 4)]).hidden).toBe(1)
    expect(frame([standing(40, 10)], [rock(20, 0, 4)]).hidden).toBe(0)
  })

  it("cuts somebody straddling its edge from behind, and not from in front", () => {
    // On the sight line that grazes the boulder, nudged just outside it so the
    // head's centre is clear and its disc is not. **Behind the grazing ring
    // the edge must cut the head; in front of it the head must be painted
    // over the boulder** — the two cases any single depth for the sphere
    // gets wrong one of.
    const r = 4
    // The boulder's centre is on the ground and the eye is 1.6 m up, so at eye
    // height it is a circle of this radius — which is what a level sight line grazes.
    const atEye = Math.sqrt(r * r - 1.6 * 1.6)
    const graze = Math.asin(atEye / 20) + 0.1 / 26 / 2
    const at = (d: number) => standing(Math.cos(graze) * d, Math.sin(graze) * d)
    const behind = frame([at(26)], [rock(20, 0, r)])
    const front = frame([at(14)], [rock(20, 0, r)])
    expect(behind.hidden).toBe(0)
    expect(front.hidden).toBe(0)
    expect(behind.cut).toBe(1)
    expect(front.cut).toBe(0)
  })

  it("hides over the top of itself only as high as it stands", () => {
    // A dome 1 m high cannot hide a head at 1.6 m seen from 1.6 m.
    expect(frame([standing(40, 0)], [rock(20, 0, 1)]).hidden).toBe(0)
    expect(frame([standing(40, 0)], [rock(20, 0, 2)]).hidden).toBe(1)
  })

  it("throws no outline when I am inside it, rather than blacking out the frame", () => {
    const inside = frame([standing(40, 0)], [rock(1, 0, 3)])
    expect(inside.rocks).toBe(0)
    expect(inside.hidden).toBe(0)
    expect(frame([standing(40, 0)], [rock(10, 0, 3)]).rocks).toBe(1)
  })
})

describe("a grid of boulders", () => {
  /**
   * "if they're laid out not in straight lines, but more like a hexagonal grid,
   * turns would always be required". Asserted on the layout itself: on a square
   * grid each boulder has four neighbours at one period, on a hexagonal one six
   * — and scattered, neither, which is the control that says the count can fail.
   */
  const open = createPath(0, 300, 0, 0)
  function neighbours(layout: number) {
    const rocks = createBoulders(0.4, 3, 11, open, Infinity, 1000, 1000, layout, 6)
    const found = rocks.within(0, 0, 40, [])
    const period = 2 * 3 + 6
    const counts = found.map(
      (b) => found.filter((o) => o !== b && Math.abs(Math.hypot(o.x - b.x, o.y - b.y) - period) < 0.01).length,
    )
    return { found: found.length, most: Math.max(...counts) }
  }

  it("puts four at one period round each boulder on a square grid, six on a hexagonal one", () => {
    expect(neighbours(1).found).toBeGreaterThan(20)
    expect(neighbours(1).most).toBe(4)
    expect(neighbours(2).most).toBe(6)
    expect(neighbours(0).most).toBeLessThan(2)
  })

  it("keeps where I start a crossing of passages, not a boulder", () => {
    for (const layout of [1, 2]) {
      const rocks = createBoulders(0.4, 3, 11, open, Infinity, 0, 0, layout, 6)
      expect(rocks.inside(0, 0)).toBe(0)
      expect(rocks.within(0, 0, 12, []).length).toBeGreaterThan(0)
    }
  })
})
