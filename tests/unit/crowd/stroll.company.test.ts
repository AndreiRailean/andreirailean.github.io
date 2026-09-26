import { describe, expect, it } from "vitest"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { normalizeSettings } from "@/experiments/crowd/settings"
import { DEG, MARKET, STEP, wrap } from "./support"

describe("walking with somebody", () => {
  function withMates(count: number, seconds: number) {
    const settings = normalizeSettings({ ...MARKET.settings, companions: count })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    const gaps: number[] = []
    let atMate = 0
    let samples = 0
    for (let t = 0; t < seconds; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (t < 10) continue
      samples++
      const mates = crowd.companions
      for (const mate of mates) gaps.push(Math.hypot(mate.x - me.x, mate.y - me.y))
      if (mates[0]) {
        const toMate = Math.atan2(mates[0].y - me.y, mates[0].x - me.x)
        if (Math.abs(wrap(me.yaw - toMate)) < 0.35) atMate++
      }
    }
    gaps.sort((a, b) => a - b)
    return {
      count: crowd.stats().companions,
      median: gaps[Math.floor(gaps.length / 2)] ?? 0,
      worst: gaps[gaps.length - 1] ?? 0,
      lookingAt: atMate / samples,
    }
  }

  it("keeps them beside me rather than letting the crowd carry them off", () => {
    // **A companion is the one person still there in a minute's time**, which is
    // the whole of what distinguishes them from the traffic. They keep station
    // in the observer's own frame, so the pair turns as a pair, and they are
    // never re-entered at the boundary the way everybody else is.
    const two = withMates(2, 90)
    expect(two.count).toBe(2)
    expect(two.median).toBeGreaterThan(0.5)
    expect(two.median).toBeLessThan(1.4)
    // Even at the worst moment of being squeezed by the crowd, still beside me.
    // Measured at 4.9 m at its very worst over ninety seconds, which is one bad
    // moment of a dense crowd coming between you rather than a companion lost.
    expect(two.worst).toBeLessThan(6)
  }, 180_000)

  it("gets looked at, which is most of where the head goes when there is one", () => {
    const alone = withMates(0, 60)
    const pair = withMates(1, 60)
    expect(alone.count).toBe(0)
    expect(alone.lookingAt).toBe(0)
    expect(pair.lookingAt).toBeGreaterThan(0.05)
  }, 180_000)
})

describe("the gaze goes up and down, not only side to side", () => {
  function gaze(patch: Record<string, number>, seconds: number) {
    const settings = normalizeSettings({ ...MARKET.settings, ...patch })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    const pitches: number[] = []
    let aboveLevel = 0
    for (let t = 0; t < seconds; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (t < 10) continue
      pitches.push(me.pitch * DEG)
      if (me.pitch > 0) aboveLevel++
    }
    pitches.sort((a, b) => a - b)
    return {
      // Clamped: `at(1)` indexed one past the end and handed back `undefined`,
      // which `toBeLessThan` fails on with no hint that the *index* was the
      // problem rather than the piece.
      at: (q: number) => pitches[Math.min(pitches.length - 1, Math.floor(pitches.length * q))]!,
      aboveLevel: aboveLevel / pitches.length,
    }
  }

  const alone = gaze({ pitch: -4, companions: 0, looking: 1 }, 150)

  it("rests where `pitch` says, because it is a bias and not a lock", () => {
    expect(Math.abs(alone.at(0.5) - -4)).toBeLessThan(2)
  }, 180_000)

  it("looks down at the ground and at things it walks past", () => {
    // **Three goes at this, all the same mistake.** A look aimed 22° down
    // measured 8°, then 0.4° off the bias, because the hold was barely longer
    // than the half second the neck takes to arrive — and once because a spot
    // placed far to the side swept past the neck's reach before the head got
    // there, which ends the glance for a good reason at a bad moment.
    //
    // **The number to check a hold against is the settling time**, not intuition
    // about how long a glance feels.
    expect(alone.at(0.1)).toBeLessThan(-7)
    expect(alone.at(0)).toBeGreaterThan(-40)
  }, 180_000)

  it("looks up, which it did not at all", () => {
    // "i see it gazing down, but haven't detected an up gaze yet. like looking
    // at a bird and following its flight while walking." It had a vertical
    // drift of a few degrees either side of the bias, which never rose far
    // enough above level to read as looking up.
    expect(alone.at(0.999)).toBeGreaterThan(15)
    expect(alone.aboveLevel).toBeGreaterThan(0.02)
    expect(alone.at(1)).toBeLessThan(35)
  }, 180_000)

  it("does not spend the walk staring at the sky when there is nobody to talk to", () => {
    // **The chained-roll fault, which this file had a comment warning about and
    // then committed.** The companion branch is skipped when there is no
    // companion, but the branches after it were written as
    // `roll < SHARE_COMPANION + SHARE_UP` with a constant first term — so the
    // companion's half of the probability fell through to the next branch and
    // looking up went from 9% of glances to 59%. Measured as a gaze above level
    // 25.9% of the time, walking alone, with no downward range left at all.
    //
    // The tell is that it only appears in the scene where a *different* branch
    // is disabled, which is why a single-scene check would not have found it.
    expect(alone.aboveLevel).toBeLessThan(0.2)
    const withMates = gaze({ pitch: -4, companions: 2, looking: 1 }, 90)
    expect(withMates.aboveLevel).toBeLessThan(0.2)
  }, 180_000)
})
