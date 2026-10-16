import { describe, expect, it } from "vitest"
import { makeRng } from "@/experiments/random"
import { makeBody } from "@/experiments/walkers/body"
import type { Walker } from "@/experiments/walkers/crowd"
import { eraseTile, placeHeads } from "@/experiments/walkers/draw"
import { CONTROLS, normalizeSettings } from "@/experiments/walkers/settings"
import { lift, makeView, type View } from "@/experiments/walkers/view"

/**
 * The ground has to forget.
 *
 * A canvas holds eight bits of alpha and quantises the erase alpha to eight
 * bits before applying it, so `destination-out` at alpha `a` leaves
 * `round(dst * (1 - round(255a) / 255))` and a pixel stops moving once
 * `dst * round(255a)` drops below half a level. The decay therefore has a
 * floor at `127.5 / round(255a)` levels, and everything below it is permanent
 * — which is the flat grey wash the fade exists to prevent, arriving by way of
 * the renderer rather than the model.
 *
 * Nothing in the picture says so. The trail looked like a trail, faded like a
 * trail, and then stopped, and the only way to see it was to leave the piece
 * running for two minutes and measure the frame: mean luminance went 58 to 107
 * between 45 and 150 seconds with the naive fade, and 32 to 31 with this one.
 * That is far too slow to be a test, so what is checked here is the arithmetic
 * that decides the erase, against the range of settings a viewer can reach.
 */
const traces = CONTROLS.find((control) => control.kind === "slider" && control.key === "traces")
const longest = traces && traces.kind === "slider" ? traces.max : 90

/** What one frame would take off, in levels of 255, at a trail and frame time. */
const perFrame = (seconds: number, step: number) => 255 * (1 - Math.exp(-step / seconds))

/**
 * Where a pixel stops, in levels, for an erase of `levels`.
 *
 * The inner `round` is the canvas quantising the alpha before it multiplies,
 * and it is not a refinement: at an erase of 2.4 levels it is the difference
 * between a predicted floor of 53 and the 63 a real canvas stops at. Checked
 * against Chromium at eight different alphas; this form reproduced every one.
 */
const residue = (levels: number) => (Math.round(levels) === 0 ? Infinity : 127.5 / Math.round(levels))

/**
 * Frame times the piece is actually drawn at: 30 to 120 fps, and `playback`
 * from a quarter to double, which scales piece time and so the decay with it.
 */
const steps: number[] = []
for (const fps of [30, 60, 90, 120]) {
  for (const playback of [0.25, 0.5, 0.65, 1, 2]) steps.push(playback / fps)
}

describe("the trail's decay", () => {
  it("leaves under two per cent behind, everywhere on the slider", () => {
    for (let seconds = 1; seconds <= longest; seconds++) {
      for (const step of steps) {
        const applied = perFrame(seconds, step) * eraseTile(perFrame(seconds, step), 1) ** 2
        expect(residue(applied)).toBeLessThan(5.6)
      }
    }
  })

  it("erases in steps small enough for the blit to hide", () => {
    for (let seconds = 1; seconds <= longest; seconds++) {
      for (const step of steps) {
        const applied = perFrame(seconds, step) * eraseTile(perFrame(seconds, step), 1) ** 2
        expect(applied / 255).toBeLessThan(0.4)
      }
    }
  })

  /**
   * The reason the obvious version is not the one in the file. Erasing the
   * whole buffer every frame is a tile of one, and at the settings the presets
   * ship with it stalls at half the range or does not move at all.
   */
  it("would stall above a mid grey if every pixel were erased every frame", () => {
    // A tile of one is the whole buffer every frame. Measured on a real canvas
    // at these two settings: it stops at 127, and at the slowed clock the
    // alpha rounds away and the mark never fades at all.
    expect(residue(perFrame(6, 1 / 60))).toBeCloseTo(127.5, 1)
    expect(residue(perFrame(6, 0.65 / 60))).toBe(Infinity)
  })

  it("does not chase the frame rate", () => {
    // A machine wobbling either side of the boundary must not keep retiling:
    // every change starts the phases' clocks again, and enough of them stop
    // the decay dead.
    const boundary = 6
    let tile = eraseTile(perFrame(boundary, 1 / 60), 1)
    for (const step of [1 / 58, 1 / 62, 1 / 59, 1 / 61]) {
      expect(eraseTile(perFrame(boundary, step), tile)).toBe(tile)
      tile = eraseTile(perFrame(boundary, step), tile)
    }
  })
})

/**
 * The camera is a pinhole, and this is where that becomes a place on the glass.
 *
 * A head sits nearer the lens than the ground does, so it lands outward from
 * the centre of the frame by `lift` — camera / (camera − z) — and is drawn
 * larger by the same factor. This was a browser test that settled a park and
 * read the mean radius of the bright pixels, which in a young park counted
 * grass as heads and failed 4 runs in 6 (#287). The claim is about one function
 * and one walker, so that is all it builds.
 *
 * The walkers here are walking with `bob` at zero, which takes the gait's rise
 * and sway out of the head's position, and walking takes the postural drift of
 * somebody standing with it. What is left is posture over feet, so every
 * expectation is exact.
 */
describe("where a head lands on the glass", () => {
  const settings = normalizeSettings({ bob: 0 })
  const HEAD = 1.7

  /** Only what `placeHeads` reads; the rest of a walker is the crowd's business. */
  const walker = (x: number, y: number, posture = HEAD): Walker =>
    ({
      x,
      y,
      facing: 0,
      speed: 1.3,
      stride: 0,
      posture,
      hop: 0,
      phase: 0,
      activity: "walking",
      body: makeBody(makeRng(3), "adult", 1.34),
    }) as unknown as Walker

  const frame = (camera: number) => makeView(12, camera, 1280, 800)

  /** Distance from the centre of the frame, in pixels. */
  const radius = (view: View, placed: { sx: number; sy: number }) =>
    Math.hypot(placed.sx - view.width / 2, placed.sy - view.height / 2)

  /** How much further out the head is than the feet. */
  const thrown = (camera: number) => {
    const view = frame(camera)
    const [head] = placeHeads([walker(4, -3)], view, settings, 0)
    return radius(view, head!) / (5 * view.pxPerMetre)
  }

  it("throws a head outward by camera / (camera − height): nearly a quarter at nine metres", () => {
    expect(lift(frame(9), HEAD)).toBeCloseTo(9 / (9 - HEAD), 9)
    expect(thrown(9)).toBeCloseTo(9 / (9 - HEAD), 6)
    expect(thrown(9)).toBeGreaterThan(1.2)
  })

  it("barely moves it from a camera a hundred and twenty metres up", () => {
    expect(thrown(120)).toBeCloseTo(120 / (120 - HEAD), 6)
    expect(thrown(120)).toBeLessThan(1.015)
  })

  it("throws it along its own radius, in every quarter of the frame", () => {
    const view = frame(9)
    for (const [x, y] of [
      [3, 2],
      [-3, 2],
      [-3, -2],
      [3, -2],
    ] as const) {
      const [head] = placeHeads([walker(x, y)], view, settings, 0)
      const dx = (head!.sx - view.width / 2) / view.pxPerMetre
      const dy = (view.height / 2 - head!.sy) / view.pxPerMetre
      expect(Math.atan2(dy, dx), `direction at ${x},${y}`).toBeCloseTo(Math.atan2(y, x), 9)
      expect(Math.hypot(dx, dy), `outward at ${x},${y}`).toBeGreaterThan(Math.hypot(x, y) * 1.2)
    }
  })

  it("leaves a head under the lens exactly where it is, however low the camera", () => {
    const view = frame(4)
    const [head] = placeHeads([walker(0, 0)], view, settings, 0)
    expect(head!.sx).toBeCloseTo(view.width / 2, 9)
    expect(head!.sy).toBeCloseTo(view.height / 2, 9)
  })

  it("draws a head larger by the same factor it is thrown outward", () => {
    const view = frame(9)
    const feet = walker(4, -3)
    const [head] = placeHeads([feet], view, settings, 0)
    expect(head!.radius / ((feet.body.headBreadth / 2) * view.pxPerMetre)).toBeCloseTo(thrown(9), 9)
  })

  it("paints the higher of two heads last, so it is the one in front", () => {
    const placed = placeHeads([walker(1, 1, 1.7), walker(1, 1, 1.1)], frame(9), settings, 0)
    expect(placed.map((item) => item.z)).toEqual([1.1, 1.7])
  })
})
