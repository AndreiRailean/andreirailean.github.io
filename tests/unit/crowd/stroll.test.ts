import { describe, expect, it } from "vitest"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { normalizeSettings, PRESETS, type Settings } from "@/experiments/crowd/settings"

/**
 * The person carrying the camera, and specifically what their head does.
 *
 * **Every number here comes from a complaint.** The first version of the neck
 * turned at a constant rate to an absolute target and stopped dead, and what
 * that looked like was: "very abrupt — appears that I'm looking forward, then I
 * quickly turn my head and stop, then I turn again." Measured, it was
 * motionless 73% of the time and at its speed cap for 18%, holding a 60° offset
 * for a second and a half while walking.
 *
 * None of that is visible in a still, and all of it is obvious in motion, which
 * is the worst combination this section has — so it is pinned here in numbers.
 */

const STEP = 1 / 120
const DEG = 180 / Math.PI
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function watch(patch: Partial<Settings>, seconds: number) {
  const settings = normalizeSettings({ ...PRESETS[0]!.settings, ...patch })
  const me = createStroll(settings, settings.seed)
  const crowd = createThrong(settings, me)

  const offsets: number[] = []
  let peakTurn = 0
  let lastYaw = me.yaw
  let moving = 0
  let steps = 0

  for (let t = 0; t < seconds; t += STEP) {
    me.step(STEP, crowd)
    crowd.step(STEP)
    const turn = Math.abs(wrap(me.yaw - lastYaw)) / STEP
    lastYaw = me.yaw
    // The opening stretch is skipped for the offsets but not for the turn rate,
    // because a rate read across a skipped gap is a rate across that gap — which
    // reported 20,000°/s and sent this measurement after a phantom once already.
    if (t < 10) continue
    peakTurn = Math.max(peakTurn, turn)
    offsets.push(Math.abs(wrap(me.yaw - me.course)))
    if (turn > 0.02) moving++
    steps++
  }

  offsets.sort((a, b) => a - b)
  const at = (p: number) => offsets[Math.floor(offsets.length * p)]! * DEG
  return { median: at(0.5), p90: at(0.9), peakTurn: peakTurn * DEG, stillFraction: 1 - moving / steps }
}

describe("the head, while walking", () => {
  const walking = watch({ walk: 1.2, pausing: 0, looking: 1 }, 120)

  it("rests looking where it is going", () => {
    // **The rest state is straight ahead**, which is the half the first version
    // had no concept of: it pointed the head at whatever was interesting and
    // left it there, so the median offset was 17.7°. A head that sits off-centre
    // does not read as a head turned — it reads as a body turned, because in a
    // first-person view with no body drawn those look identical.
    expect(walking.median).toBeLessThan(4)
  })

  it("glances small and comes back, rather than holding a turn", () => {
    // "If I'm walking, I turn my head only slightly and then turn it back."
    // Was 62.6° at the 90th percentile; a walking glance should be a few degrees.
    expect(walking.p90).toBeLessThan(20)
  })

  it("is almost never still, because easing means always moving a little", () => {
    // The tell of a rate-limited neck is a head that is *motionless* most of the
    // time and then moves at full speed. A sprung one is nearly always somewhere
    // in an ease. Was 73% still.
    expect(walking.stillFraction).toBeLessThan(0.45)
  })
})

describe("the head, while stopped", () => {
  const stopped = watch({ walk: 0, pausing: 1, looking: 1 }, 120)

  it("actually looks around", () => {
    // "Only when I'm stopped do I turn my head." Standing, the sweep is a real
    // look rather than a glance.
    expect(stopped.p90).toBeGreaterThan(20)
  })

  it("still does not keep it turned", () => {
    // "...but I don't keep it turned." The median is the rest state, and the
    // rest state is centre whether moving or not.
    expect(stopped.median).toBeLessThan(12)
  })
})

describe("nothing moves the view faster than a person can", () => {
  it("never snaps, in either scene", () => {
    // **This caught a real discontinuity and it was not the neck.** The course
    // was assigned straight from `atan2(vy, vx)` the moment the speed crossed a
    // threshold, where the velocity is mostly avoidance jitter and points
    // anywhere — so the body, and the camera bolted to it, snapped by up to 172°
    // in one 1/120 s step. That is 20,600°/s against a neck that manages 200,
    // and it is invisible in a still.
    //
    // The ceiling is the neck's plus the body's, since turning while glancing
    // does both at once.
    for (const scene of [
      { walk: 1.2, pausing: 0.3 },
      { walk: 0, pausing: 1 },
    ]) {
      expect(watch(scene, 60).peakTurn).toBeLessThan(400)
    }
  }, 120_000)
})
