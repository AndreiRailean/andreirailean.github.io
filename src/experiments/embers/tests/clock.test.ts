import { describe, expect, it } from "vitest"
import { framePlan } from "@/experiments/embers/embers"

/**
 * The frame loop's clock, which had a bug that only slow motion could show.
 *
 * The simulation used to run on a fixed step drained from an accumulator: a
 * frame added `elapsed × playback` to a carry and took a step whenever the carry
 * reached a sixtieth. At full speed that is one step a frame and looks right. At
 * 0.12x a wall frame is worth two thousandths of a second of fire, so the carry
 * reached a sixtieth every *eighth* frame — the piece advanced once and then held
 * still for seven. Slow motion came out as stop motion, and the slower you set
 * it the worse it got, which is the opposite of what the control is for.
 *
 * A screenshot cannot show any of this: every individual frame is correct. What
 * is wrong is the sequence.
 */
describe("a wall frame becomes simulation steps", () => {
  const FRAME = 1 / 60

  it("advances on every frame, at every playback the control offers", () => {
    // The control's own track, ends included.
    for (const playback of [0.05, 0.12, 0.25, 0.5, 1, 1.5, 2]) {
      const plan = framePlan(FRAME, playback)
      expect(plan.substeps, `playback ${playback} took no step`).toBeGreaterThan(0)
      expect(plan.advance, `playback ${playback} advanced no time`).toBeGreaterThan(0)
      expect(plan.dt).toBeGreaterThan(0)
    }
  })

  it("advances by exactly the time that elapsed, scaled", () => {
    expect(framePlan(FRAME, 0.25).advance).toBeCloseTo(FRAME * 0.25, 12)
    expect(framePlan(FRAME, 1).advance).toBeCloseTo(FRAME, 12)
    // And the substeps account for all of it, with nothing banked or dropped —
    // a remainder left behind is the accumulator fault in miniature.
    for (const playback of [0.05, 0.37, 1, 2]) {
      const plan = framePlan(FRAME, playback)
      expect(plan.dt * plan.substeps).toBeCloseTo(plan.advance, 12)
    }
  })

  it("takes smaller steps the slower it runs, never longer ones", () => {
    const slow = framePlan(FRAME, 0.1)
    const real = framePlan(FRAME, 1)
    expect(slow.dt).toBeLessThan(real.dt)
    for (const playback of [0.05, 0.5, 1, 2]) {
      expect(framePlan(FRAME, playback).dt).toBeLessThanOrEqual(1 / 60 + 1e-12)
    }
  })

  it("subdivides a long frame rather than taking one long step", () => {
    // A 100 ms frame at double speed is 200 ms of fire; no single step may be
    // longer than the ceiling, because the vortex advection is explicit Euler
    // and would cut the corners off an eddy.
    const plan = framePlan(0.1, 2)
    expect(plan.substeps).toBeGreaterThan(1)
    expect(plan.dt).toBeLessThanOrEqual(1 / 60 + 1e-12)
  })

  it("resumes rather than fast-forwarding after a tab comes back", () => {
    // Sixty seconds away must not be sixty seconds of catch-up in one frame.
    const plan = framePlan(60, 1)
    expect(plan.advance).toBeLessThanOrEqual(4 / 60 + 1e-12)
    expect(plan.substeps).toBeLessThanOrEqual(4)
  })

  it("stands still only when it is actually stopped", () => {
    expect(framePlan(0, 1).substeps).toBe(0)
    expect(framePlan(FRAME, 0).substeps).toBe(0)
  })
})
