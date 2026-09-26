import { describe, expect, it } from "vitest"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { normalizeSettings, PRESETS } from "@/experiments/crowd/settings"
import { DEG, STEP, wrap } from "./support"

describe("the walk goes somewhere, rather than in a straight line", () => {
  function route(label: string, seconds: number) {
    const settings = normalizeSettings(PRESETS.find((p) => p.label === label)!.settings)
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    const start = me.course
    const swings: number[] = []
    let worstTurn = 0
    let wasWalking = true
    let courseAtStop = 0
    let stops = 0

    for (let t = 0; t < seconds; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (me.walking !== wasWalking) {
        if (!me.walking) courseAtStop = me.course
        else {
          stops++
          worstTurn = Math.max(worstTurn, Math.abs(wrap(me.course - courseAtStop)) * DEG)
        }
        wasWalking = me.walking
      }
      swings.push(Math.abs(wrap(me.course - start)) * DEG)
    }
    swings.sort((a, b) => a - b)
    return {
      stops,
      worstTurn,
      // **A percentile, not the maximum.** The instantaneous heading swings by
      // 30° during any sidestep and comes straight back; what says whether the
      // walk went somewhere is where it spends its time, not its worst frame.
      // The street's heading at 30-second marks was 0, 1, 1, -1, -4° while its
      // maximum was 33.6°, so the maximum was measuring avoidance.
      sustained: swings[Math.floor(swings.length * 0.9)]!,
    }
  }

  it("changes direction at a stop, because a stop is what a stop is for", () => {
    // **The walk used to be a straight line and nothing said so.** Measured over
    // five minutes of the market: thirty-two stops, and the median change of
    // heading across one was 1.1° with a maximum of 2.9°. Everything else was a
    // slow aimless drift of about ±30° that wandered back where it started.
    //
    // The mechanism that was supposed to turn the body **could not fire**: it
    // read `if (Math.abs(yawOffset) > NECK_LIMIT)`, and `yawOffset` springs
    // toward a target already clamped to that same limit, with no overshoot.
    // The note claimed the behaviour, the code could not produce it, and only
    // Andrei looking at it found out — "i think the motion is always in a
    // straight line. is that correct?"
    const market = route("market", 300)
    expect(market.stops).toBeGreaterThan(10)
    // Some stop, somewhere, sends the walk a genuinely different way.
    expect(market.worstTurn).toBeGreaterThan(25)
    // And over five minutes that adds up to going somewhere.
    expect(market.sustained).toBeGreaterThan(45)
  }, 300_000)

  it("does not do it in a street, because a street has walls", () => {
    // The control, and the reason this is not just "turn more": the same code
    // in a seven-metre corridor leaves the heading inside a few degrees, because
    // the pull toward the corridor's line is stronger than a glance. Turning to
    // face a stall in a street you cannot leave would walk you into the wall.
    const street = route("the street", 300)
    expect(street.sustained).toBeLessThan(20)
  }, 300_000)
})
