import { describe, expect, it } from "vitest"
import { distance, enter, inside, outline, type Corner, type InsetShape, type Shape } from "@/experiments/artdeco/frame"

const base: Shape = {
  hx: 400,
  hy: 250,
  oval: false,
  corner: "square",
  cornerSize: 60,
  steps: 3,
  insets: 0,
  insetDepth: 40,
  insetShape: "box",
}
const CORNERS: Corner[] = ["square", "chamfer", "steps", "round", "notch"]
const INSETS: InsetShape[] = ["box", "steps", "chevron"]

describe("artdeco frame", () => {
  it("is mirrored left to right and top to bottom in every shape", () => {
    for (const corner of CORNERS)
      for (const insetShape of INSETS)
        for (const insets of [0, 1, 3]) {
          const poly = outline({ ...base, corner, insetShape, insets }, 0, 0)
          for (const [x, y] of poly) {
            expect(distance(poly, -x, y)).toBeLessThan(1e-6)
            expect(distance(poly, x, -y)).toBeLessThan(1e-6)
          }
        }
  })

  it("takes the corner and insets out of the middle", () => {
    // Just inside the box's corner and just inside the middle of the top edge.
    const corner: [number, number] = [-395, -245]
    const top: [number, number] = [0, -245]
    const plain = outline(base, 0, 0)
    expect(inside(plain, ...corner)).toBe(true)
    expect(inside(plain, ...top)).toBe(true)
    for (const c of ["chamfer", "steps", "round", "notch"] as Corner[])
      expect(inside(outline({ ...base, corner: c }, 0, 0), ...corner)).toBe(false)
    // One inset sits on the middle third of each side.
    expect(inside(outline({ ...base, insets: 1 }, 0, 0), ...top)).toBe(false)
  })

  it("finds where a ray enters, and the edge it enters by", () => {
    const poly = outline(base, 0, 0)
    const hit = enter(poly, 0, 400, 0, -1)
    expect(hit!.t).toBeCloseTo(150)
    expect(Math.abs(hit!.uy)).toBeLessThan(1e-9)
    // An inset is band reaching into the middle, so the middle starts 40 further on.
    expect(enter(outline({ ...base, insets: 1 }, 0, 0), 0, 400, 0, -1)!.t).toBeCloseTo(190)
  })

  it("does not count leaving the edge, missing, or a graze as entering", () => {
    const poly = outline(base, 0, 0)
    expect(enter(poly, 0, 250.01, 0, 1)).toBeNull()
    expect(enter(poly, 0, 400, 1, 0)).toBeNull()
    // Along the line of the bottom edge: touches its corners, never enters.
    expect(enter(poly, -600, 250, 1, 0)).toBeNull()
  })

  it("reports a start inside as 0", () => {
    expect(enter(outline(base, 0, 0), 0, 0, 0, 1)!.t).toBe(0)
  })
})
