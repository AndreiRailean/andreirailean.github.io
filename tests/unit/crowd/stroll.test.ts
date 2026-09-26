import { describe, expect, it } from "vitest"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { normalizeSettings, PRESETS, type Settings } from "@/experiments/crowd/settings"

/**
 * The market, by name. These checks were written against it when it was the
 * primary, and a primary moves — "catch me" took the place on 2026-09-26 —
 * so they say which scene they mean rather than which position.
 */
const MARKET = PRESETS.find((preset) => preset.label === "market")!

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
  const settings = normalizeSettings({ ...MARKET.settings, ...patch })
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
  return {
    median: at(0.5),
    p90: at(0.9),
    within10: offsets.filter((o) => o * DEG <= 10).length / offsets.length,
    peakTurn: peakTurn * DEG,
    stillFraction: 1 - moving / steps,
  }
}

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
