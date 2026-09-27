import { describe, expect, it } from "vitest"
import { CULL_ALPHA, halfFovH, horizonFor, makeCamera, NEAR, project } from "@/experiments/crowd/camera"

/**
 * The eye. Three of these guard faults that look like ordinary pictures.
 */

const eye = (over: Partial<Parameters<typeof makeCamera>> = []) => over

/** Looking along +x from the origin at 1.6 m, on a 1000x800 frame. */
const straight = (pitchDegrees = 0, fov = 60) =>
  makeCamera(0, 0, 1.6, 0, (pitchDegrees * Math.PI) / 180, fov, 20, 1000, 800)

describe("what is behind the eye", () => {
  it("is not projected at all", () => {
    expect(project(straight(), -5, 0, 1.6)).toBeNull()
  })

  it("is not projected even when it is beside as well as behind", () => {
    // **This is the one that matters.** A negative depth divides to a mirrored
    // screen position *in front of* the eye, so the crowd behind the observer is
    // drawn across the crowd ahead of them — at plausible sizes, in plausible
    // places, looking exactly like an ordinary crowd.
    for (const angle of [Math.PI * 0.55, Math.PI * 0.75, Math.PI, Math.PI * 1.4]) {
      const at = project(straight(), Math.cos(angle) * 8, Math.sin(angle) * 8, 1.6)
      expect(at, `a head at ${Math.round((angle * 180) / Math.PI)}° reached the frame`).toBeNull()
    }
  })

  it("stops at the near plane rather than at zero", () => {
    expect(project(straight(), NEAR * 0.99, 0, 1.6)).toBeNull()
    expect(project(straight(), NEAR * 1.5, 0, 1.6)).not.toBeNull()
  })
})

describe("the pitch", () => {
  it("moves the horizon up when the eye looks down", () => {
    const level = project(straight(0), 40, 0, 1.6)!
    const down = project(straight(-10), 40, 0, 1.6)!
    expect(down.sy).toBeLessThan(level.sy)
  })

  it("is a rotation of the frame, not an offset of the screen", () => {
    // A screen offset is the tempting shortcut, and picking the discriminating
    // case took two goes. **Two points at eye height cannot tell the two apart**
    // — for them a rotation reduces exactly to `focal * tan(pitch)`, the same
    // number for every distance — so a test built on those passes either way and
    // is the "structurally impossible" shape the root `AGENTS.md` names.
    //
    // What separates them is two points at *different heights and the same
    // distance*. A rotation moves what counts as depth by the height, so the
    // gap between a tall head and a short one at six metres changes with the
    // pitch. An offset moves both by the same amount and the gap cannot change.
    const gapAt = (pitch: number) => project(straight(pitch), 6, 0, 1.0)!.sy - project(straight(pitch), 6, 0, 2.2)!.sy
    expect(Math.abs(gapAt(-20) - gapAt(0))).toBeGreaterThan(3)
  })

  it("still refuses what the rotation puts behind the eye", () => {
    // Something just above the eye and very close is behind a steeply raised
    // line of sight. The depth is measured along the sight line, so the near
    // check has to happen after the rotation, not before it.
    expect(project(straight(-80), 0.4, 0, 3)).toBeNull()
  })
})

describe("the fade", () => {
  it("is exponential in the distance, with nothing added", () => {
    const camera = straight()
    const near = project(camera, 10, 0, 1.6)!
    const far = project(camera, 30, 0, 1.6)!
    // Twenty metres of air, three times over ten: the ratio is the cube.
    expect(far.alpha).toBeCloseTo(near.alpha * Math.exp(-20 / 20), 10)
  })

  it("puts the horizon exactly where a head stops being showable", () => {
    for (const fade of [3, 20, 80]) {
      const camera = makeCamera(0, 0, 1.6, 0, 0, 60, fade, 1000, 800)
      const at = project(camera, horizonFor(fade), 0, 1.6)!
      expect(at.alpha).toBeCloseTo(CULL_ALPHA, 6)
    }
  })
})

describe("the frame", () => {
  it("measures the field of view across the shorter side, whichever it is", () => {
    const landscape = makeCamera(0, 0, 1.6, 0, 0, 60, 20, 1000, 800)
    const portrait = makeCamera(0, 0, 1.6, 0, 0, 60, 20, 800, 1000)
    expect(landscape.focal).toBe(portrait.focal)
  })

  it("shows more crowd to the sides on a wide window rather than a squashed copy", () => {
    const wide = makeCamera(0, 0, 1.6, 0, 0, 60, 20, 1600, 800)
    const square = makeCamera(0, 0, 1.6, 0, 0, 60, 20, 800, 800)
    expect(wide.focal).toBe(square.focal)
    expect(halfFovH(wide)).toBeGreaterThan(halfFovH(square))
  })
})

// Kept so an unused import cannot quietly make this file smaller than it reads.
void eye
