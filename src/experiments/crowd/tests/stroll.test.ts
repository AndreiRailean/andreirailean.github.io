import { describe, expect, it } from "vitest"
import {
  aimAt,
  confinement,
  courseStep,
  facingTarget,
  glanceKind,
  HOLD_GROUND,
  HOLD_UP,
  NECK,
  NECK_LIMIT,
  NECK_OMEGA,
  neckStep,
  PIVOT,
  PITCH_UP,
  SHARE_COMPANION,
  SHARE_SPOT,
  SHARE_UP,
  spellLength,
  SPOT_AHEAD,
  SPOT_BEARING_MIN,
  spotSpread,
  STOPPED_BELOW,
  sweepFor,
  STRAFE_LIMIT,
  TURN_ON_LOOK,
  TURN_WALKING,
  turnsToLook,
  UP_HEIGHT,
  UP_RANGE,
  type GlanceKind,
} from "@/experiments/crowd/stroll"
import { makeRng } from "@/experiments/random"
import { PRESETS } from "@/experiments/crowd/presets"
import { DEG, STEP, watch, walk, wrap } from "./support"

/**
 * The person carrying the camera, one decision at a time.
 *
 * **These used to be walks.** Every property here was checked by walking the
 * market for one to five minutes and reading statistics off the result — 557 s
 * of the unit job, one test alone 271 s. Each property is a decision made by
 * one function in `stroll.ts`, so each is checked on that function with the
 * inputs that matter, and a few short walks in a small world check that the
 * functions are the ones the walk actually calls (#287).
 *
 * Every "break it" note below was done: the fault named was put back and the
 * test was seen to go red.
 */

const ROLLS = 100_000
/** Evenly spaced rolls over [0, 1), so a share is exact rather than sampled. */
const share = (kind: GlanceKind, mates: number, run: number) => {
  let hits = 0
  for (let i = 0; i < ROLLS; i++) if (glanceKind((i + 0.5) / ROLLS, mates, run) === kind) hits++
  return hits / ROLLS
}

describe("what a glance is about", () => {
  it("is mostly a companion when there is one, and otherwise shares out as written", () => {
    expect(share("companion", 2, 0)).toBeCloseTo(SHARE_COMPANION, 3)
    expect(share("up", 2, 0)).toBeCloseTo(SHARE_UP, 3)
    expect(share("spot", 2, 0)).toBeCloseTo(SHARE_SPOT, 3)
  })

  it("does not hand the companion's share to the sky when walking alone", () => {
    // **The chained-roll fault.** The companion branch is skipped with nobody
    // to talk to, and the branches after it were written as
    // `roll < SHARE_COMPANION + SHARE_UP` with a constant first term — so the
    // companion's half fell through and looking up went from 9% of glances to
    // 59%: a gaze above level a quarter of the time with no downward range
    // left. Break it: a constant `pCompanion` takes "up" to 0.59 here.
    expect(share("companion", 0, 0)).toBe(0)
    expect(share("up", 0, 0)).toBeCloseTo(SHARE_UP, 3)
    expect(share("spot", 0, 0)).toBeCloseTo(SHARE_SPOT, 3)
  })

  it("nearly drops the sky at a run", () => {
    // "It is much harder to run and follow birds right over your head."
    expect(share("up", 0, 1)).toBeCloseTo(SHARE_UP * 0.1, 3)
  })
})

describe("how far a glance goes, walking and stopped", () => {
  // **Stopping to look around is the one time the head should go furthest.**
  // This was read off a 45-person walk's 90th percentile, which measured 14.5
  // against its line of 20 at density 5 with nothing wrong (#287). Break it:
  // set `SWEEP_STOPPED` to the walking 0.3 and the first two tests go red.
  it("sweeps a stopped head more than three times as wide as a walking one", () => {
    expect(sweepFor(0, 1)).toBeGreaterThan(3 * sweepFor(1.3, 1))
    expect(sweepFor(STOPPED_BELOW - 0.01, 1)).toBeGreaterThan(3 * sweepFor(STOPPED_BELOW, 1))
  })

  it("puts a stopped observer's spots wider, and a walker's no narrower than a stall beside them", () => {
    const walking = spotSpread(sweepFor(1.3, 1), 0)
    const stopped = spotSpread(sweepFor(0, 1), 0)
    expect(stopped).toBeGreaterThan(walking * 1.4)
    expect(stopped).toBeLessThanOrEqual(NECK_LIMIT)
    // The floor: walking, you still turn your head to look at a stall.
    expect(walking).toBe(SPOT_BEARING_MIN)
  })

  it("scales with `looking`, up to a limit, and is nothing at nothing", () => {
    expect(sweepFor(0, 0.5)).toBeCloseTo(sweepFor(0, 1) / 2, 12)
    expect(sweepFor(0, 5)).toBe(sweepFor(0, 1.3))
    expect(sweepFor(0, 0)).toBe(0)
    expect(sweepFor(1.3, -1)).toBe(0)
  })
})

describe("where a look puts the head", () => {
  const eye = { x: 0, y: 0, course: 0, eye: 1.6, bias: (-4 * Math.PI) / 180 }

  it("cancels the bias for a face at eye level, and looks down at a child", () => {
    // Absolute, then taken back to an offset, so a face at eye level is no
    // offset from level: the bias is undone, not added to.
    expect(aimAt(2, 0, 1.6, eye, NECK_LIMIT).up).toBeCloseTo(-eye.bias, 9)
    expect(aimAt(2, 0, 1.0, eye, NECK_LIMIT).up).toBeLessThan(-eye.bias - 0.2)
  })

  it("can look well down at the ground ahead, and well up at something overhead", () => {
    // Down: the nearest ground spot, straight ahead. The walk used to never
    // get there (see `HOLD_GROUND` and the neck test below).
    expect((aimAt(SPOT_AHEAD[0]!, 0, 0, eye, NECK_LIMIT).up + eye.bias) * DEG).toBeLessThan(-20)
    // Up: "i see it gazing down, but haven't detected an up gaze yet." The
    // highest, nearest bird is past 15° and inside the pitch range.
    const bird = aimAt(UP_RANGE[0]!, 0, UP_HEIGHT[1]!, eye, NECK_LIMIT).up + eye.bias
    expect(bird * DEG).toBeGreaterThan(15)
    expect(bird).toBeLessThanOrEqual(PITCH_UP + eye.bias + 1e-9)
  })

  it("stops being worth it when the thing goes round past the neck, or is on top of you", () => {
    expect(aimAt(1, 1, 0, eye, NECK_LIMIT).worth).toBe(true)
    expect(aimAt(-1, 0.2, 0, eye, NECK_LIMIT).worth).toBe(false)
    expect(aimAt(0.2, 0, 0, eye, NECK_LIMIT).worth).toBe(false)
    // And the offset it asks for is never past the neck.
    expect(Math.abs(aimAt(-1, 0.2, 0, eye, NECK_LIMIT).yaw)).toBeLessThanOrEqual(NECK_LIMIT)
  })
})

/** Drive the neck from rest toward `target` for `seconds`. */
function turnHead(target: number, seconds: number, omega = NECK_OMEGA) {
  let offset = 0
  let vel = 0
  let peak = 0
  let atCap = 0
  let still = 0
  let steps = 0
  let overshoot = 0
  for (let t = 0; t < seconds; t += STEP) {
    ;[offset, vel] = neckStep(offset, vel, target, omega, STEP)
    peak = Math.max(peak, Math.abs(vel))
    if (Math.abs(vel) >= NECK - 1e-9) atCap++
    if (Math.abs(vel) < 0.02) still++
    overshoot = Math.max(overshoot, Math.sign(target) * (offset - target))
    steps++
  }
  return { offset, peak, atCap: atCap / steps, still: still / steps, overshoot }
}

describe("the neck", () => {
  it("eases in and out of a glance rather than slewing at its cap", () => {
    // **Bang-bang was the first version**: a constant rate to the target and a
    // dead stop, motionless 73% of the time and at its cap for 18% — "very
    // abrupt... i quickly turn my head and stop". Break it: a constant-rate
    // step puts the largest glance at its cap for most of the move.
    const largest = turnHead(NECK_LIMIT, 0.6)
    expect(largest.atCap).toBe(0)
    // A critically damped step peaks near 0.37·ω·amplitude, which is why `NECK`
    // sits above it: clipping would flatten the top of the profile back toward
    // the bang-bang shape.
    expect(largest.peak).toBeLessThan(NECK)
    expect(largest.peak).toBeGreaterThan(0.3 * NECK_OMEGA * NECK_LIMIT)
    // And it never overshoots, which is the property the old turning guard
    // tripped over: an offset springing toward a target clamped to the limit
    // can never pass the limit.
    expect(largest.overshoot).toBeLessThanOrEqual(1e-9)
  })

  it("arrives within the shortest hold it is given, looking down or looking up", () => {
    // **A held target the head never reaches is a different movement**, and it
    // happened three times: a look aimed 22° down measured 8°, then 0.4° off
    // the bias, because the hold was barely longer than the half second the
    // neck takes. Break it: the old walking hold of 0.15 s reaches a third of
    // the way.
    const down = (-22 * Math.PI) / 180
    expect(turnHead(down, HOLD_GROUND[0]!).offset / down).toBeGreaterThan(0.95)
    expect(turnHead(0.5, HOLD_UP[0]!).offset / 0.5).toBeGreaterThan(0.95)
  })
})

describe("the body", () => {
  it("faces the line it means to walk while it is pushed off it, until that stops being a sidestep", () => {
    // **No sidestep existed while the body faced its velocity**: by
    // construction it always pointed where it was going, a median offset of
    // 1.4°. Facing the intended line is what makes being pushed sideways a
    // sidestep. Past `STRAFE_LIMIT` it is crabbing, and the shoulders come round.
    expect(facingTarget(0.3, 0)).toBe(0)
    expect(facingTarget(-0.3, 0)).toBe(0)
    expect(facingTarget(1.2, 0)).toBeCloseTo(1.2 - STRAFE_LIMIT, 12)
    expect(facingTarget(-1.2, 0)).toBeCloseTo(-1.2 + STRAFE_LIMIT, 12)
    // Across the wrap, the short way round.
    expect(facingTarget(Math.PI - 0.1, -Math.PI + 0.1)).toBe(-Math.PI + 0.1)
  })

  it("filters a jittering heading rather than shaking with it", () => {
    // **The jitter**: "strange jitter... in video games that usually indicates
    // collisions". The facing chased the instantaneous velocity through a rate
    // limiter, which clipped avoidance jitter instead of filtering it — the
    // direction reversed on 14% of steps at 120 Hz. The control below is that
    // limiter, fed the same jitter, and it shakes.
    const run = (follow: (course: number, vel: number, toward: number) => [number, number]) => {
      // Avoidance noise is not white: a push lasts a few steps. So the heading
      // it produces wanders about ±10° on a tenth-of-a-second timescale.
      const rng = makeRng(7)
      let target = 0
      let course = 0
      let vel = 0
      let last = 0
      let reversals = 0
      let sumSq = 0
      const steps = 120 * 10
      for (let i = 0; i < steps; i++) {
        target = target * 0.92 + (rng() - 0.5) * 0.12
        ;[course, vel] = follow(course, vel, target - course)
        const rate = vel
        if (rate * last < 0) reversals++
        last = rate
        sumSq += rate * rate
      }
      return { rms: Math.sqrt(sumSq / steps) * DEG, reversals: reversals / steps }
    }
    const sprung = run((course, vel, toward) => {
      const next = courseStep(vel, toward, true, STEP)
      return [course + next * STEP, next]
    })
    const limited = run((course, _vel, toward) => {
      const rate = Math.max(-TURN_WALKING, Math.min(TURN_WALKING, toward / STEP))
      return [course + rate * STEP, rate]
    })
    // Measured: the limiter reverses on 30% of steps pinned near its cap, the
    // spring on 3% at 8°/s — against 1.4% and 9.8°/s in the market itself.
    expect(limited.reversals).toBeGreaterThan(0.1)
    expect(limited.rms).toBeGreaterThan(60)
    expect(sprung.reversals).toBeLessThan(0.04)
    expect(sprung.rms).toBeLessThan(18)
  })

  it("never turns faster than a person can, however far the target jumps", () => {
    // **The snap**: the course was assigned straight from `atan2(vy, vx)` the
    // moment the speed crossed a threshold, so the body — and the camera bolted
    // to it — moved 172° in one step: 20,600°/s against a neck of 200.
    for (const moving of [true, false]) {
      let vel = 0
      let peak = 0
      for (let t = 0; t < 2; t += STEP) {
        vel = courseStep(vel, (172 * Math.PI) / 180, moving, STEP)
        peak = Math.max(peak, Math.abs(vel))
      }
      expect(peak).toBeLessThanOrEqual(moving ? TURN_WALKING : PIVOT)
    }
    // And neck and body together, turning at once, stay under 400°/s.
    expect((NECK + TURN_WALKING) * DEG).toBeLessThan(400)
  })
})

describe("stopping, and turning at a stop", () => {
  it("spends `pausing` of the walk stopped, by lengthening stops as well as adding them", () => {
    for (const pausing of [0.2, 0.5, 0.8]) {
      const rng = makeRng(11)
      let going = 0
      let standing = 0
      for (let i = 0; i < 20_000; i++) {
        going += spellLength(pausing, true, rng)
        standing += spellLength(pausing, false, rng)
      }
      expect(standing / (going + standing)).toBeCloseTo(pausing, 1)
    }
    // The ends are states, not rates: never stopping, never walking.
    const never = () => {
      throw new Error("drew a roll with no choice to make")
    }
    expect(spellLength(0, true, never)).toBe(Infinity)
    expect(spellLength(1, false, never)).toBe(Infinity)
  })

  it("turns to what it was looking at, sometimes, and only when standing", () => {
    // Walking it never does, and draws nothing doing it.
    const never = () => {
      throw new Error("drew a roll while walking")
    }
    expect(turnsToLook(false, never)).toBe(false)
    const rng = makeRng(3)
    let turned = 0
    for (let i = 0; i < 20_000; i++) if (turnsToLook(true, rng)) turned++
    expect(turned / 20_000).toBeCloseTo(TURN_ON_LOOK, 1)
  })

  it("pivots the body round to the look it is taking up", () => {
    // What a turn at a stop does: the body pivots to where the head already
    // is. A look 50° off, taken up, is a 50° change of heading.
    let course = 0
    let vel = 0
    const target = (50 * Math.PI) / 180
    for (let t = 0; t < 4; t += STEP) {
      vel = courseStep(vel, target - course, false, STEP)
      course += vel * STEP
    }
    expect(Math.abs(course - target) * DEG).toBeLessThan(2)
  })

  it("holds the walk to the street's line in a corridor, and not on open ground", () => {
    // In a seven-metre corridor free wandering walks you diagonally into the
    // wall; on open ground there is no line to hold.
    expect(confinement(3.5)).toBeGreaterThan(0.8)
    expect(confinement(25)).toBe(0)
    expect(confinement(Infinity)).toBe(0)
  })
})

/**
 * **The wiring: that the walk calls the functions above.** Short, and in a world
 * of a few hundred people rather than the market's nine thousand, which is all
 * any of it needs. Each one is the property a person saw, measured end to end.
 */
const SMALL = { reach: 12 }
const STREET = PRESETS.find((preset) => preset.label === "the street")!

describe("the walk, end to end, in a small world", () => {
  it("rests the head ahead while walking, and glances through the neck's spring", () => {
    // **Two people, not forty-five, and no stopped half.** How far a glance
    // goes walking and stopped is `sweepFor` and `spotSpread`, above. The
    // percentiles this used to read could not see it: with the walking sweep
    // raised to the stopped one the walking p90 went *down*, 17.0 to 9.4, and
    // the stopped p90 measured 14.5 against its line of 20 at density 5 with
    // nothing wrong (#287). What is left is the wiring: the head comes back to
    // ahead, and it gets there through `neckStep`. Break it: set the offset
    // straight to the glance's target and the peak turn reads 7,000°/s.
    const walking = watch({ ...SMALL, density: 0.5, walk: 1.2, pausing: 0, looking: 1, companions: 0 }, 40)
    expect(walking.median).toBeLessThan(4)
    expect(walking.stillFraction).toBeLessThan(0.45)
    expect(walking.peakTurn).toBeLessThan(400)
  })

  it("changes direction at its stops", () => {
    // **The walk was a straight line and nothing said so**: thirty-two stops
    // in five minutes, the largest change of heading across one 2.9°, because
    // the only mechanism for turning was a guard that could not fire. Break
    // it: put `Math.abs(yawOffset) > NECK_LIMIT` back in place of
    // `turnsToLook` and no stop here turns more than a few degrees.
    // Nobody else needs to be there for this, so almost nobody is.
    const { me, crowd } = walk({ ...SMALL, density: 2, pausing: 0.5, looking: 1, companions: 0 }, 0)
    let wasWalking = me.walking
    let courseAtStop = 0
    let worst = 0
    let stops = 0
    for (let t = 0; t < 120; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (me.walking !== wasWalking) {
        if (!me.walking) courseAtStop = me.course
        else {
          stops++
          worst = Math.max(worst, Math.abs(wrap(me.course - courseAtStop)) * DEG)
        }
        wasWalking = me.walking
      }
    }
    expect(stops).toBeGreaterThan(5)
    expect(worst).toBeGreaterThan(25)
  })

  it("does not wander off a street's line, because a street has walls", () => {
    // The control, and the reason this is not just "turn more": the same code
    // in a seven-metre corridor keeps the heading near the corridor's line.
    // Turning to face a stall in a street you cannot leave walks you into the
    // wall. Measured as where the heading spends its time, not its worst frame:
    // any sidestep swings it 30° for a moment and straight back.
    const { me, crowd } = walk({ ...STREET.settings, ...SMALL, density: 2 }, 0)
    const swings: number[] = []
    for (let t = 0; t < 120; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      swings.push(Math.abs(wrap(me.course)) * DEG)
    }
    swings.sort((a, b) => a - b)
    expect(swings[Math.floor(swings.length * 0.9)]).toBeLessThan(20)
  })

  it("keeps companions beside me through a crowd", () => {
    // **A companion is the one person still there in a minute's time.** They
    // keep station in my own frame and are never re-entered at the boundary.
    // **The crowd is what this is about**, so it has to be thick enough to push:
    // with the companion's spring taken out, the median gap was 0.89 m among
    // forty-five people — a pass — and 2.66 among the 136 here. The market's
    // 217 cost 3.3 s and adds nothing (#287).
    //
    // **It used to say "and looks at them", and could not see that.** It
    // counted the time my head was within 20° of a companion, against 0.05:
    // 0.37 as shipped, and 0.19 with every look at a person aimed four metres
    // to one side of them — and with nobody else about the two came out the
    // same. Glancing about sweeps across a companion walking at 40° often
    // enough on its own. Which glances go to a companion is `glanceKind`, and
    // where a look puts the head is `aimAt`, both above; the wiring between them
    // is not something this statistic can see.
    const { me, crowd } = walk({ ...SMALL, density: 30, companions: 2, looking: 1 }, 5)
    const gaps: number[] = []
    for (let t = 0; t < 35; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      for (const mate of crowd.companions) gaps.push(Math.hypot(mate.x - me.x, mate.y - me.y))
    }
    gaps.sort((a, b) => a - b)
    expect(crowd.stats().companions).toBe(2)
    expect(crowd.people.length).toBeGreaterThan(100)
    expect(gaps[Math.floor(gaps.length / 2)]).toBeGreaterThan(0.5)
    expect(gaps[Math.floor(gaps.length / 2)]).toBeLessThan(1.4)
    expect(gaps[gaps.length - 1]).toBeLessThan(6)
  })
})
