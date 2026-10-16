import { describe, expect, it } from "vitest"
import { frameAdvance, MAX_FRAME } from "@/experiments/psyxels/clock"

/**
 * The frame clock, as a function rather than as a page left running.
 *
 * These replaced two browser tests that waited on real timers: "playback scales
 * the clock, and pauses it" (two 400 ms waits) and the resume half of "holding
 * the field stops its clock", whose bound — the clock must not take the 3 s
 * hold in one step — could never fail: the cap below already limited any one
 * frame to 0.1 s, so removing the resume's `last = 0` added at most that.
 * Removing the cap, which is what actually stands between a long hold and a
 * jump, fails "never moves more than one capped frame"; seen red 2026-10-16.
 */
describe("frameAdvance", () => {
  it("adds nothing on the first frame after a start or a resume", () => {
    expect(frameAdvance(0, 123_456, 1, false)).toBe(0)
  })

  it("advances by the wall time between frames, at playback 1", () => {
    expect(frameAdvance(1000, 1016, 1, false)).toBeCloseTo(0.016)
  })

  it("never moves more than one capped frame, however long the gap", () => {
    // A held field, a background tab, or a resume that kept the old `last`.
    expect(frameAdvance(1000, 1000 + 3000, 1, false)).toBe(MAX_FRAME)
    expect(frameAdvance(1000, 1000 + 3_600_000, 2, false)).toBe(MAX_FRAME * 2)
  })

  it("scales with playback in one place, and stops at playback 0", () => {
    const at1 = frameAdvance(1000, 1050, 1, false)
    expect(at1).toBeCloseTo(0.05, 9)
    expect(frameAdvance(1000, 1050, 2, false)).toBeCloseTo(at1 * 2, 9)
    expect(frameAdvance(1000, 1050, 0.25, false)).toBeCloseTo(at1 / 4, 9)
    expect(frameAdvance(1000, 1050, 0, false)).toBe(0)
  })

  it("holds still under reduced motion", () => {
    expect(frameAdvance(1000, 1016, 1, true)).toBe(0)
  })
})
