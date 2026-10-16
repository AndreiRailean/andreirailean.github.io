import { describe, expect, it } from "vitest"
import { frameStep, MAX_FRAME } from "@/experiments/flotsam/clock"

/**
 * The frame clock, as a function. It replaced the playback browser test, which
 * watched a real page for 600 ms at full speed and 600 ms at a quarter and
 * compared the two inside loose bounds. Seen red 2026-10-16 by applying
 * `playback` twice (`step: elapsed * playback * playback`).
 */
describe("frameStep", () => {
  it("adds nothing on the first frame", () => {
    expect(frameStep(0, 98_765, 1)).toEqual({ elapsed: 0, step: 0 })
  })

  it("moves the sea by the wall time between frames, at playback 1", () => {
    const { elapsed, step } = frameStep(1000, 1016, 1)
    expect(elapsed).toBeCloseTo(0.016)
    expect(step).toBeCloseTo(0.016)
  })

  it("slows by exactly the playback factor, and stops at zero", () => {
    const full = frameStep(1000, 1200, 1).step
    expect(full).toBeCloseTo(0.2, 9)
    expect(frameStep(1000, 1200, 0.25).step).toBeCloseTo(full / 4, 9)
    expect(frameStep(1000, 1200, 0.1).step).toBeCloseTo(full / 10, 9)
    expect(frameStep(1000, 1200, 0).step).toBe(0)
  })

  it("never takes more than one capped frame, however long the tab was away", () => {
    expect(frameStep(1000, 1000 + 60_000, 1)).toEqual({ elapsed: MAX_FRAME, step: MAX_FRAME })
  })
})
