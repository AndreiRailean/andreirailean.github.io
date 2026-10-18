import { describe, expect, it } from "vitest"
import { seaStep } from "@/experiments/flotsam/clock"

/**
 * The frame clock, as a function. It replaced the playback browser test, which
 * watched a real page for 600 ms at full speed and 600 ms at a quarter and
 * compared the two inside loose bounds. Seen red 2026-10-16 by applying
 * `playback` twice (`step: elapsed * playback * playback`).
 *
 * The first frame adding nothing and the cap on a long frame belong to the
 * section's `parkingLoop` since 2026-10-18, and `tests/unit/simulation-loop.test.ts`
 * holds them there.
 */
describe("seaStep", () => {
  it("moves the sea by the wall time between frames, at rate 1", () => {
    expect(seaStep(0.016, 1)).toBeCloseTo(0.016)
  })

  it("slows by exactly the rate, and stops at zero", () => {
    const full = seaStep(0.2, 1)
    expect(full).toBeCloseTo(0.2, 9)
    expect(seaStep(0.2, 0.25)).toBeCloseTo(full / 4, 9)
    expect(seaStep(0.2, 0.1)).toBeCloseTo(full / 10, 9)
    expect(seaStep(0.2, 0)).toBe(0)
  })
})
