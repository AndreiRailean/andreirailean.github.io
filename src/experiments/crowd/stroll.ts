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

/** Radians per second the neck can manage. About 120°/s — a brisk but unhurried turn. */
const NECK = 2.1

/** How far off the line of travel the head will go. Past this a person turns their shoulders too. */
const NECK_LIMIT = 1.15

/** Seconds a gaze is held. Drawn around this. */
const DWELL = 1.6

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
  /** Which way the head is pointing, absolute. */
  let yaw = 0
  let gaze = 0
  let untilLook = 0

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

  /**
   * Pick something to look at, as an absolute angle.
   *
   * A sample rather than a sweep. The crowd is thousands of people and this runs
   * a couple of times a second; twenty draws finds somebody worth looking at
   * essentially every time, and costs nothing.
   */
  function chooseGaze(people: Person[]): number {
    const strength = current.looking
    if (strength <= 0) return course

    // Straight ahead a fair share of the time. A head always turned toward
    // something reads as a search rather than as a walk.
    if (rng() > 0.35 + 0.45 * Math.min(1, strength)) return course + (rng() - 0.5) * 0.25

    let found: Person | null = null
    let bestScore = Infinity
    const cos = Math.cos(course)
    const sin = Math.sin(course)

    for (let n = 0; n < 20 && people.length > 0; n++) {
      const person = people[Math.floor(rng() * people.length)]
      if (!person) continue
      const dx = person.x - x
      const dy = person.y - y
      const distance = Math.hypot(dx, dy)
      if (distance < 0.6 || distance > 14) continue
      // Ahead counts for more, and so does close. Somebody behind the shoulder
      // is not looked at, because the neck would not reach them anyway.
      const ahead = (dx * cos + dy * sin) / distance
      if (ahead < -0.2) continue
      const score = distance * (1.6 - ahead)
      if (score < bestScore) {
        bestScore = score
        found = person
      }
    }

    if (!found) return course + (rng() - 0.5) * 0.6 * strength
    return Math.atan2(found.y - y, found.x - x)
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

    // The body faces where it is going, and only while it is going somewhere —
    // a course read off a velocity of nothing is a course that spins.
    if (speed > 0.12) course = Math.atan2(vy, vx)

    // The gait, which drives the bob. The same two lines every other person in
    // the crowd gets, off the same anatomy in `body.ts`.
    phase += cadence(stature, speed, Math.max(0.4, current.walk)) * dt * Math.PI * 2

    untilLook -= dt
    if (untilLook <= 0) {
      gaze = chooseGaze(crowd.neighbours(x, y, 14))
      untilLook = DWELL * (0.4 + rng() * 1.4)
    }

    // The neck's limit is applied to the *offset* from the course rather than to
    // the absolute angle, so the head cannot end up looking backwards however
    // the course moves under it.
    let offset = gaze - course
    while (offset > Math.PI) offset -= Math.PI * 2
    while (offset < -Math.PI) offset += Math.PI * 2
    const limit = NECK_LIMIT * Math.min(1.3, Math.max(0, current.looking))
    offset = Math.max(-limit, Math.min(limit, offset))

    let turn = course + offset - yaw
    while (turn > Math.PI) turn -= Math.PI * 2
    while (turn < -Math.PI) turn += Math.PI * 2
    yaw += Math.max(-NECK * dt, Math.min(NECK * dt, turn))
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
