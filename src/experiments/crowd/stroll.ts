/**
 * The person carrying the camera: where they are going, and where they are looking.
 *
 * ## This is the module the piece is about
 *
 * Every other experiment in this section renders a world. This one renders a
 * world *and a point of view inside it*, and the point of view is a walking
 * person rather than a camera. Almost everything that makes the picture read as
 * being **in** a crowd rather than watching one is decided here.
 *
 * ## I am avoided, and I avoid — and the second half is the one that was missing
 *
 * The crowd steering round the observer is the obvious half and it is not
 * enough. A camera that holds its line while everybody else gives way is a
 * bulldozer: the crowd parts, nothing is ever negotiated, and the walk reads as
 * a vehicle's. So the observer runs the **same** anticipatory avoidance every
 * other person does, against the same neighbours, and the course is whatever
 * comes out of it rather than a heading anybody set. The small persistent
 * sidesteps that produces are the thing the brief asks for by name.
 *
 * It also means `course` is derived and `yaw` is not the same thing as it. The
 * body goes where the negotiation puts it; the head points where it is looking.
 *
 * ## Walking, stopping, and why stopping is a state rather than an event
 *
 * `pausing` is the **share of the walk spent stopped**, not a rate of stopping.
 * Given as a rate it produces short frequent halts, which read as hesitation;
 * given as a share, turning it up lengthens the stops as well as making them
 * more frequent, which is what somebody looking at things actually does. Two
 * independent exponential timescales, and the share falls out of their ratio.
 *
 * Starting and stopping ramp over about a second, because a person does not step
 * from 1.3 m/s to nothing. The ramp is also what keeps the bob honest through a
 * stop: cadence comes out of speed, so the stride slows and dies rather than
 * being switched off.
 *
 * ## Looking is a neck with a speed limit
 *
 * A gaze is a target and a turn rate, never a new angle assigned directly. A
 * neck manages about 120°/s comfortably, and that limit is most of what makes a
 * glance read as a glance — an instantaneous change of heading is a cut, and a
 * cut in a first-person view reads as the camera being edited rather than as
 * somebody looking.
 *
 * What gets looked at, in order of how often: whoever is about to pass closest,
 * and nothing in particular. The first is what matters — the head turns toward
 * the person the body is already negotiating with, which is what a person does,
 * and is why the looking never feels random.
 */

import { BOB_RISE, BOB_SWAY, bodyRadius, cadence, eyeHeight } from "@/experiments/crowd/body"
import { avoid } from "@/experiments/crowd/steering"
import type { Person } from "@/experiments/crowd/throng"
import { makeRng, hashSeed, type Rng } from "@/experiments/random"
import type { Settings } from "@/experiments/crowd/settings"

/**
 * Radians per second the neck will ever be asked for — a ceiling, not a rate.
 *
 * 3.5 rad/s is 200°/s, which is toward the top of what a deliberate look
 * manages. It is set **above** anything the spring below produces on purpose: a
 * critically damped step peaks at about `0.37 · ω · amplitude`, so the largest
 * glance this piece can ask for peaks at 3.4. Clipping it would flatten the top
 * of the velocity profile, which is precisely the bang-bang shape the spring was
 * brought in to remove — and at 2.1 it clipped on 7% of frames while standing.
 */
const NECK = 3.5

/**
 * Natural frequency of the neck, in radians per second.
 *
 * **The head is a critically damped spring, and the first version was not.** It
 * turned at a constant `NECK` rad/s until it reached its target and then stopped
 * dead, which is a bang-bang velocity profile: instant start, flat middle,
 * instant stop. Measured over two minutes of walking, the head was motionless
 * 73% of the time and at the speed cap for 18% — so two thirds of all head
 * movement was at maximum speed. That is exactly what "robotic" means, and no
 * amount of lowering `NECK` fixes it, because the problem is the *shape* of the
 * profile rather than its height.
 *
 * Critically damped means it accelerates out of rest, decelerates into the
 * target, and never overshoots. 8 rad/s settles a glance in about half a second,
 * which is what a head actually takes.
 */
const NECK_OMEGA = 8

/** How far off the line of travel the head will go at all. Past this a person turns their shoulders. */
const NECK_LIMIT = 1.15

/**
 * How far the head swings on one glance, in radians, before `looking` scales it.
 *
 * **Walking and stopped are different movements, not the same one at different
 * rates.** Walking, the head barely leaves centre — you are watching where you
 * are going and a glance is a few degrees and back. Stopped, you actually look
 * at things. The first version used one amplitude for both and held a 60° offset
 * for a second and a half while walking, which does not read as a glance at all:
 * a held offset reads as the direction you are facing, so the forward optical
 * flow then looks like the whole body has turned.
 */
const SWEEP_WALKING = 0.3
const SWEEP_STOPPED = 1.0

/**
 * Seconds a glance is held at its far point before the head comes back.
 *
 * **A glance returns. It does not stay.** Both ends are short, because the rest
 * position of a head is straight ahead and everything else is a departure from
 * it — which is the half the first version had no concept of at all: it picked a
 * new absolute target every time and simply left the head wherever that put it.
 */
const HOLD_WALKING = [0.15, 0.5]
const HOLD_STOPPED = [0.5, 1.8]

/** Seconds between the end of one glance and the start of the next. */
const GAP_WALKING = [1.4, 4.5]
const GAP_STOPPED = [0.5, 2.2]

/**
 * Radians per second the body pivots at when standing.
 *
 * **Turning to face something is a body movement, not a neck movement.** A head
 * held past its comfortable range is not what a person does; they turn. So a
 * stopped observer pivots toward a new line and then sets off along it, which is
 * how the walk changes direction at all.
 */
const PIVOT = 1.1

/**
 * Radians per second the body will turn at while walking.
 *
 * **Not a stylistic limit — a discontinuity guard, and it caught a real one.**
 * The course used to be assigned straight from `atan2(vy, vx)` the instant the
 * speed crossed a threshold. Near that threshold the velocity is mostly
 * avoidance jitter and points anywhere, so the body — and the camera bolted to
 * it — snapped by up to 172° in a single 1/120 s step. Measured as a peak of
 * 20,600°/s against a neck that manages 200.
 *
 * It is invisible in a still and unmistakable in motion, and it predates the
 * glance rework: it is a good part of what "robotic" was. A body lags its own
 * velocity, which is also why this is the honest model rather than a clamp — you
 * can step sideways while still facing forward, and this is what lets it.
 */
const TURN_WALKING = 2

/** Seconds a start or a stop is ramped over. */
const RAMP = 0.9

/** How firmly the course returns to the line being walked, per second. Matches the crowd's. */
const RETURN = 2.2

/** Metres per second squared. */
const MAX_ACCEL = 7

/** How far the line being walked wanders, in radians per second of standard deviation. */
const WANDER = 0.09

/** What the observer needs of the crowd: whoever is close enough to matter. */
export type Neighbourhood = {
  neighbours: (x: number, y: number, radius: number) => Person[]
  /** Half the corridor the crowd is confined to, so the observer is held by the same walls. */
  halfWidth: number
}

export type Stroll = ReturnType<typeof createStroll>

export function createStroll(settings: Settings, seed: number) {
  let current = settings
  const rng: Rng = makeRng(hashSeed(seed, 77))

  let x = 0
  let y = 0
  let vx = 0
  let vy = 0

  /**
   * The line being walked, before the crowd has its say.
   *
   * Starts along the world's axis — I am one of the people in the stream — and
   * wanders slowly, because nobody crosses a square in a straight line.
   */
  let aim = 0
  /** Which way the body is actually going. Derived from the velocity, not set. */
  let course = 0
  /** Which way the head is pointing, absolute. Always `course` plus the offset below. */
  let yaw = 0
  /** How far the head is off the body, in radians. Rest is zero. */
  let yawOffset = 0
  let yawVel = 0
  /** Where the current glance is taking the head, as an offset. Zero between glances. */
  let glanceTo = 0
  let untilGlance = 0
  let holdLeft = 0
  /** Where the body would like to be pointing. Only reachable by pivoting, and only when stopped. */
  let aimTarget = 0

  let walking = true
  let untilState = 0

  /** Radians. One full cycle of the head's rise per step. */
  let phase = 0
  let clock = 0

  let stature = current.height

  const force = { x: 0, y: 0 }

  /**
   * Seconds the next stretch of walking, or of standing, should last.
   *
   * Two independent timescales whose ratio is `pausing`, which is why it behaves
   * like a share of the walk rather than like a frequency. Exponential, so the
   * lengths have no characteristic value and the walk does not develop a rhythm
   * anybody can anticipate.
   */
  function spell(going: boolean): number {
    const share = current.pausing
    if (share <= 0) return going ? Infinity : 0
    if (share >= 1) return going ? 0 : Infinity
    const scale = 9 * (going ? 1 - share : share)
    return Math.max(0.4, -Math.log(Math.max(1e-6, rng())) * scale)
  }

  const between = ([low, high]: number[], r: number) => low! + r * (high! - low!)

  /**
   * How far the next glance should take the head off centre, as a signed offset.
   *
   * **An offset rather than an absolute angle, and that is the whole repair.**
   * The first version chose an absolute direction and pointed the head at it,
   * which left the head wherever the last interesting thing had been — so the
   * rest state was arbitrary instead of straight ahead, and a 60° offset sat
   * there for a second and a half looking like the body had turned.
   *
   * What is looked at is unchanged and worth keeping: mostly whoever is about to
   * pass closest, who is also the person the body is already negotiating with.
   * The difference is that they are now glanced *toward* rather than fixed on —
   * somebody at 80° gets a glance of whatever the sweep allows, which is what
   * noticing someone in the corner of your eye actually is.
   */
  function pickGlance(people: Person[], sweep: number): number {
    if (sweep <= 0) return 0

    let found: Person | null = null
    let bestScore = Infinity
    const cos = Math.cos(course)
    const sin = Math.sin(course)

    // A sample rather than a sweep. Twenty draws finds somebody worth looking at
    // essentially every time and costs nothing.
    for (let n = 0; n < 20 && people.length > 0; n++) {
      const person = people[Math.floor(rng() * people.length)]
      if (!person) continue
      const dx = person.x - x
      const dy = person.y - y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < 0.6 || distance > 14) continue
      const ahead = (dx * cos + dy * sin) / distance
      if (ahead < -0.2) continue
      const score = distance * (1.6 - ahead)
      if (score < bestScore) {
        bestScore = score
        found = person
      }
    }

    // Nobody in particular: a small drift to one side, which is most of what a
    // head does when there is nothing to look at.
    if (!found) return (rng() - 0.5) * sweep

    let offset = Math.atan2(found.y - y, found.x - x) - course
    while (offset > Math.PI) offset -= Math.PI * 2
    while (offset < -Math.PI) offset += Math.PI * 2
    return Math.max(-sweep, Math.min(sweep, offset))
  }

  function step(dt: number, crowd: Neighbourhood): void {
    clock += dt

    // Walking or standing, on its own clock. The ramp below turns the state into
    // a speed; nothing here assigns a speed directly.
    untilState -= dt
    if (untilState <= 0) {
      walking = !walking
      untilState = spell(walking)
      // A walk with no stopping in it, or the other way round: skip straight
      // past rather than flickering between the two every step.
      if (untilState <= 0) {
        walking = !walking
        untilState = spell(walking)
      }
    }

    // The line being walked wanders. Scaled by the step so the wander is a
    // property of the walk rather than of the frame rate.
    aim += (rng() - 0.5) * WANDER * Math.sqrt(dt) * 2

    // **In a street you walk along the street.** Free wandering is right on open
    // ground and wrong the moment there are walls: in a seven-metre corridor it
    // has the observer walking diagonally into the side, so the channel recedes
    // off the edge of the frame instead of down the middle of it. The pull back
    // to the corridor's line grows as the corridor narrows and is nothing at all
    // on open ground, which is the same shape as the wall force and for the same
    // reason — it is the room running out, not a rail.
    const confine = Math.max(0, Math.min(1, 1 - crowd.halfWidth / 25))
    if (confine > 0) {
      let off = aim
      while (off > Math.PI / 2) off -= Math.PI
      while (off < -Math.PI / 2) off += Math.PI
      aim -= off * confine * 1.4 * dt
    }

    const wanted = walking ? current.walk : 0
    const desiredX = Math.cos(aim) * wanted
    const desiredY = Math.sin(aim) * wanted

    force.x = (desiredX - vx) * RETURN
    force.y = (desiredY - vy) * RETURN

    // The same avoidance everybody else runs, against the same neighbours. This
    // is what makes the walk a negotiation rather than a parting of the crowd.
    const me = { x, y, vx, vy, radius: bodyRadius(stature) }
    const strength = 1.9 * current.spacing * current.spacing
    for (const person of crowd.neighbours(x, y, 3.6)) {
      avoid(me, person, strength, force)
    }

    // The same corridor wall the crowd gets. **Without it the observer walks out
    // through the side of the street** and stands in the empty ground beside it
    // watching the crowd file past, which is a different piece.
    const outside = Math.abs(y) - crowd.halfWidth + 0.8
    if (outside > 0) force.y -= Math.sign(y) * outside * 7

    const magnitude = Math.sqrt(force.x * force.x + force.y * force.y)
    if (magnitude > MAX_ACCEL) {
      force.x = (force.x / magnitude) * MAX_ACCEL
      force.y = (force.y / magnitude) * MAX_ACCEL
    }

    // A ramp on the *speed* as well as the force, so a stop is a stop rather
    // than a drift that avoidance keeps nudging along.
    vx += force.x * dt
    vy += force.y * dt
    const speed = Math.sqrt(vx * vx + vy * vy)
    const ceiling = wanted > 0 ? wanted * 1.35 : (current.walk / RAMP) * dt * 2
    if (speed > ceiling && speed > 1e-6) {
      vx = (vx / speed) * ceiling
      vy = (vy / speed) * ceiling
    }

    x += vx * dt
    y += vy * dt

    // The gait, which drives the bob. The same two lines every other person in
    // the crowd gets, off the same anatomy in `body.ts`.
    phase += cadence(stature, speed, Math.max(0.4, current.walk)) * dt * Math.PI * 2

    // **The head: a glance is a departure and a return.** Between glances the
    // commanded offset is zero, which is straight ahead, so the rest state of the
    // head is the direction of travel and everything else is temporary.
    const stopped = speed < 0.25
    const sweep = (stopped ? SWEEP_STOPPED : SWEEP_WALKING) * Math.min(1.3, Math.max(0, current.looking))

    if (holdLeft > 0) {
      holdLeft -= dt
      if (holdLeft <= 0) glanceTo = 0
    } else {
      untilGlance -= dt
      if (untilGlance <= 0) {
        glanceTo = pickGlance(crowd.neighbours(x, y, 14), Math.min(sweep, NECK_LIMIT))
        holdLeft = between(stopped ? HOLD_STOPPED : HOLD_WALKING, rng())
        untilGlance = holdLeft + between(stopped ? GAP_STOPPED : GAP_WALKING, rng())
      }
    }

    // **Critically damped, not rate limited.** It accelerates out of rest and
    // decelerates into the target with no overshoot and no hard stop, which is
    // the difference between a head turning and a turret slewing. `NECK` is kept
    // as a ceiling only, for the rare large offset.
    const pull = -2 * NECK_OMEGA * yawVel - NECK_OMEGA * NECK_OMEGA * (yawOffset - glanceTo)
    yawVel = Math.max(-NECK, Math.min(NECK, yawVel + pull * dt))
    yawOffset += yawVel * dt

    // **The body turns for anything the neck should not hold.** A head parked at
    // its limit is not something people do; they turn to face the thing. Only
    // while stopped, because turning while walking is a change of route rather
    // than a look, and that is what `aim` already does slowly.
    if (Math.abs(yawOffset) > NECK_LIMIT) {
      const over = yawOffset - Math.sign(yawOffset) * NECK_LIMIT
      yawOffset -= over
      if (stopped) aimTarget += over
    }

    // **The body turns toward where it is going; it is never assigned there.**
    // Moving, that is the velocity. Standing, it is wherever the body has
    // decided to face, so a stop is where the walk can change direction. Either
    // way it is rate limited, because a body cannot pivot in one frame and the
    // version that could produced a 172° step — see `TURN_WALKING`.
    if (speed > 0.12) aimTarget = Math.atan2(vy, vx)
    let toward = aimTarget - course
    while (toward > Math.PI) toward -= Math.PI * 2
    while (toward < -Math.PI) toward += Math.PI * 2
    const rate = speed > 0.12 ? TURN_WALKING : PIVOT
    const pivot = Math.max(-rate * dt, Math.min(rate * dt, toward))
    course += pivot
    // The line being walked comes round with the body, so setting off again goes
    // the new way rather than snapping back to the old one.
    if (speed <= 0.12) aim += pivot

    yaw = course + yawOffset
  }

  return {
    get x() {
      return x
    },
    get y() {
      return y
    },
    get vx() {
      return vx
    },
    get vy() {
      return vy
    },
    get yaw() {
      return yaw
    },
    get course() {
      return course
    },
    /** The world's grain, which is the line I set out along and do not change. */
    get axis() {
      return 0
    },
    get speed() {
      return Math.hypot(vx, vy)
    },
    get walking() {
      return walking
    },
    get clock() {
      return clock
    },
    /**
     * My own disc, so the crowd can avoid it.
     *
     * **Never scaled by `spacing`**, which is how much room *the crowd* keeps.
     * Scaling both ends made the setting quadratic in its own effect and made a
     * high value feel like being repelled rather than like being given room.
     */
    get radius() {
      return bodyRadius(stature)
    },

    /**
     * Where the eye actually is this instant, bob included.
     *
     * The rise is one cycle per **step** and the sway one per **stride**, which
     * is two steps — hence the half. Both amplitudes are measurements from
     * `body.ts`, and `bob` is the one place in this piece where a measured
     * quantity is scaled by a taste. It earns that: at 1 the motion is invisible
     * and the control exists so it can be turned up far enough to see what it
     * was doing.
     *
     * `moving` fades both out as the walk stops, because a standing person's
     * head does not trace a gait it is not performing.
     */
    eye(): { z: number; sway: number } {
      const amount = current.bob
      const moving = Math.min(1, Math.hypot(vx, vy) / 0.35)
      return {
        z: eyeHeight(stature) + Math.sin(phase) * BOB_RISE * amount * moving,
        sway: Math.sin(phase / 2) * BOB_SWAY * amount * moving,
      }
    },

    step,

    resettle(next: Settings): void {
      current = next
      stature = current.height
    },

    stats() {
      return { x, y, yaw, course, speed: Math.hypot(vx, vy), walking, stature, clock }
    },
  }
}
