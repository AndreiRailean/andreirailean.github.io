import { describe, expect, it } from "vitest"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { normalizeSettings, PRESETS } from "@/experiments/crowd/settings"
import { DEG, STEP, watch, wrap } from "./support"

describe("the head, while walking", () => {
  // **Alone**, because a companion is deliberately reachable with the whole
  // neck: turning to talk to somebody beside you is exactly the movement the
  // small walking sweep exists to rule out, and the market preset now walks
  // with two.
  const walking = watch({ walk: 1.2, pausing: 0, looking: 1, companions: 0 }, 120)

  it("rests looking where it is going", () => {
    // **The rest state is straight ahead**, which is the half the first version
    // had no concept of: it pointed the head at whatever was interesting and
    // left it there, so the median offset was 17.7°. A head that sits off-centre
    // does not read as a head turned — it reads as a body turned, because in a
    // first-person view with no body drawn those look identical.
    expect(walking.median).toBeLessThan(4)
  })

  it("glances and comes back, rather than holding a turn", () => {
    // "If I'm walking, I turn my head only slightly and then turn it back."
    // Was 62.6° at the 90th percentile, held.
    //
    // **The ceiling moved from 20° to 30° on purpose, and that is a change to
    // the claim rather than a relaxed threshold.** A walking head now also looks
    // at things beside the path — "at a market specifically, that's how one
    // walks and looks" — which is a real turn of 30-40° for a second or two.
    // What must still hold is that it is a *glance*: the head rests at centre
    // (the test above) and comes back to it.
    expect(walking.p90).toBeLessThan(30)
    // And the resting state is the majority state, which is what "comes back"
    // means when it is measured rather than asserted.
    expect(walking.within10).toBeGreaterThan(0.5)
  })

  it("is almost never still, because easing means always moving a little", () => {
    // The tell of a rate-limited neck is a head that is *motionless* most of the
    // time and then moves at full speed. A sprung one is nearly always somewhere
    // in an ease. Was 73% still.
    expect(walking.stillFraction).toBeLessThan(0.45)
  })
})

describe("the head, while stopped", () => {
  const stopped = watch({ walk: 0, pausing: 1, looking: 1, companions: 0 }, 120)

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

describe("the body: sidestepping, and not shaking", () => {
  /** Where the body is going against where it is pointing, through a crowd. */
  function crowdWalk(label: string, seconds: number) {
    const settings = normalizeSettings(PRESETS.find((p) => p.label === label)!.settings)
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)

    const offs: number[] = []
    let lastCourse = me.course
    let lastRate = 0
    let reversals = 0
    let rates = 0
    let sumSq = 0
    let lateral = 0
    let forward = 0

    for (let t = 0; t < seconds; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      const rate = wrap(me.course - lastCourse) / STEP
      lastCourse = me.course
      if (t >= 10) {
        rates++
        sumSq += rate * rate
        if (rate * lastRate < 0) reversals++
      }
      lastRate = rate
      const speed = Math.hypot(me.vx, me.vy)
      if (t < 10 || speed < 0.3) continue
      offs.push(Math.abs(wrap(Math.atan2(me.vy, me.vx) - me.course)))
      lateral += Math.abs(-me.vx * Math.sin(me.course) + me.vy * Math.cos(me.course)) * STEP
      forward += (me.vx * Math.cos(me.course) + me.vy * Math.sin(me.course)) * STEP
    }

    offs.sort((a, b) => a - b)
    return {
      strafeP90: offs[Math.floor(offs.length * 0.9)]! * DEG,
      sideways: lateral / forward,
      facingRms: Math.sqrt(sumSq / rates) * DEG,
      reversals: reversals / rates,
    }
  }

  const street = crowdWalk("the street", 90)

  it("gets past people by stepping sideways, not by turning", () => {
    // **The body faces the line it means to walk; the crowd displaces it off
    // that line.** It used to face `atan2(vy, vx)` — wherever it was being
    // pushed — so by construction it always pointed exactly where it was going
    // and there was no sidestep at all: a median offset of 1.4° and a 90th
    // percentile under 8°, in a seven-metre corridor where sidestepping is the
    // only way past anybody.
    expect(street.strafeP90).toBeGreaterThan(6)
    // And it is a sidestep rather than crabbing: `STRAFE_LIMIT` is where the
    // shoulders come round.
    expect(street.strafeP90).toBeLessThan(35)
    // Roughly a quarter of a metre a second of lateral travel at walking pace,
    // which over a three-second encounter is the 0.75 m it takes to clear
    // somebody.
    expect(street.sideways).toBeGreaterThan(0.03)
  }, 120_000)

  it("keeps the camera steady while it does", () => {
    // **The jitter, in numbers.** Reported as "strange jitter… in video games
    // that usually indicates collisions". It was not the collisions: the facing
    // chased the instantaneous velocity through a hard rate limiter, and a
    // limiter has no inertia, so it clipped a target that was jittering at
    // 7 m/s² of avoidance instead of filtering it. The direction reversed on
    // 14% of steps at 120 Hz — a 15 Hz shake — with the turn rate pinned at its
    // cap of 115°/s.
    //
    // Sprung instead, and pointed at the intended line rather than the pushed
    // one, it measures 9.8°/s rms with 1.4% reversals.
    expect(street.facingRms).toBeLessThan(18)
    expect(street.reversals).toBeLessThan(0.04)
  }, 120_000)
})
