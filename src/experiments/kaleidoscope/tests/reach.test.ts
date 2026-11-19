import { describe, expect, it } from "vitest"
import { farthestBar, neverDecides, DEFAULT_SETTINGS, type Settings } from "@/experiments/kaleidoscope/settings"

const bars = (patch: Partial<Settings>): Settings => ({
  ...DEFAULT_SETTINGS,
  symmetry: "mirror",
  from: "sides",
  stops: "own",
  curl: 0,
  ...patch,
})

describe("farthestBar", () => {
  it("is where a square bar on a quarter-turn segment meets the middle and the frame at once", () => {
    // Edge at 45°, square to it: it reaches the middle after r and the frame
    // after √(1 − r²), so the most it grows is at r = 1/√2.
    expect(farthestBar(bars({ segments: 4, lean: 0, flip: 0 }))).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it("puts concentric's first decisions between a step of 13% and 14%", () => {
    // Measured on the piece, seed 942088, 60 s, after the joint fix: 11
    // decisions at step 13, none at step 14.
    const concentric = bars({ segments: 32, lean: -42, flip: 0.7 })
    expect(neverDecides({ ...concentric, step: 13 })).toBe(false)
    expect(neverDecides({ ...concentric, step: 14 })).toBe(true)
  })

  it("is unbounded wherever a bar is not sure to meet its reflection", () => {
    const narrow = { segments: 32, lean: -42, flip: 0.7, step: 40 }
    expect(neverDecides(bars(narrow))).toBe(true)
    expect(farthestBar(bars({ ...narrow, from: "centre" }))).toBe(Infinity)
    expect(farthestBar(bars({ ...narrow, symmetry: "turn" }))).toBe(Infinity)
    expect(farthestBar(bars({ ...narrow, stops: "none" }))).toBe(Infinity)
    expect(farthestBar(bars({ ...narrow, curl: 10 }))).toBe(Infinity)
  })
})
