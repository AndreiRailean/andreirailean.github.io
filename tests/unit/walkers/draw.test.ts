import { describe, expect, it } from "vitest"
import { eraseTile } from "@/experiments/walkers/draw"
import { CONTROLS } from "@/experiments/walkers/settings"

/**
 * The ground has to forget.
 *
 * A canvas holds eight bits of alpha and `destination-out` at alpha `a` leaves
 * `round(dst * (1 - a))`, so a pixel stops moving once `dst * a` drops below
 * half a level. The decay therefore has a floor at `127.5 / a` levels, and
 * everything below it is permanent — which is the flat grey wash the fade
 * exists to prevent, arriving by way of the renderer rather than the model.
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

/** What one frame would take off, in 255ths, at a given trail and frame time. */
const perFrame = (seconds: number, step: number) => 255 * (1 - Math.exp(-step / seconds))

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
        // 127.5 / applied is where a pixel stops, in 255ths.
        expect(127.5 / applied).toBeLessThan(5.5)
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
    const naive = 127.5 / perFrame(6, 1 / 60)
    expect(naive).toBeGreaterThan(127)
    // At a slowed clock the per-frame alpha rounds to nothing at all.
    expect(perFrame(6, 0.65 / 60)).toBeLessThan(0.5)
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
