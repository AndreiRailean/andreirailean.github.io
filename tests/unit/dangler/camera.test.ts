import { describe, expect, it } from "vitest"
import { makeCamera, project } from "@/experiments/dangler/camera"

/**
 * The camera is at the origin looking straight up, so a bulb at (x, y, z)
 * projects to (f·x/z, f·y/z). Size and screen position both come from dividing
 * by depth, which is why descending bulbs grow and splay at once — and why a
 * wire directly overhead collapses to a point.
 */

const SIZE = 800
const CENTRE = SIZE / 2

describe("project", () => {
  const camera = makeCamera(100, 0, SIZE, SIZE)

  it("makes a nearer bulb larger", () => {
    const high = project(camera, 1.2, 0, 4)!
    const low = project(camera, 1.2, 0, 2.4)!
    expect(low.scale).toBeGreaterThan(high.scale)
  })

  it("slides a nearer bulb further from the vanishing point", () => {
    // Growing and splaying are the same division. A bulb that grew without
    // moving outward would mean the projection had been decoupled.
    const high = project(camera, 1.2, 0, 4)!
    const low = project(camera, 1.2, 0, 2.4)!
    expect(low.x - CENTRE).toBeGreaterThan(high.x - CENTRE)
  })

  it("collapses a wire directly overhead to the vanishing point", () => {
    expect(project(camera, 0, 0, 4)!.x).toBeCloseTo(CENTRE, 9)
  })

  it("culls anything inside the near clip", () => {
    expect(project(camera, 0, 0, 0.05)).toBeNull()
  })

  it("moves the vanishing point off centre when tilted", () => {
    const tilted = makeCamera(100, 30, SIZE, SIZE)
    expect(Math.abs(project(tilted, 0, 0, 4)!.y - CENTRE)).toBeGreaterThan(50)
  })
})
