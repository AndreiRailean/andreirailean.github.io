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

import {
  BOB_RISE,
  BOB_SWAY,
  bodyRadius,
  cadence,
  eyeHeight,
  RUN_RISE,
  RUN_SWAY,
  runBounce,
  runCadence,
  runSpeed,
} from "@/experiments/crowd/body"
import { avoid } from "@/experiments/crowd/steering"
import type { Person } from "@/experiments/crowd/throng"
import { hikingPace, LANE_SPRING, lanePush, type Frame, type Path, type PathHint } from "@/experiments/crowd/path"
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
const GAP_WALKING = [0.85, 3.1]
const GAP_STOPPED = [0.5, 2.2]

/**
 * Seconds a look at the ground is held.
 *
 * **Longer than a glance at a person, and it took two goes to get there.** It
 * first reused the walking hold of 0.15–0.5 s against a neck that settles in
 * about half a second, so the head was recalled before it had arrived and a look
 * aimed 22° down measured 8°. Lengthened to 0.45–1.1 it still only reached part
 * way: the tenth percentile of the whole gaze sat on the bias, 0.4° off it.
 *
 * **A held target the head never reaches is not a shorter version of the
 * movement, it is a different one** — and the number to check it against is the
 * settling time, not intuition about how long a glance feels. This is a *follow*
 * rather than a check: you look at the stall as you go past it.
 */
const HOLD_GROUND = [0.9, 2.2]

/** Seconds between glances while there is somebody to talk to. Shorter: a conversation is a rhythm. */
const GAP_TALKING = [0.35, 1.6]

/**
 * What the next glance is about, as shares.
 *
 * Written out rather than chained through nested rolls, because the chained
 * version hid its own weights: a "20% of the time" that was really 20% of
 * whatever fell past the branch above it.
 */
const SHARE_COMPANION = 0.5
const SHARE_UP = 0.09
const SHARE_SPOT = 0.3

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
 * The chance that a look taken while standing becomes where you go next.
 *
 * **A stop had no consequence, and that is what made the walk a straight line.**
 * Measured over five minutes of the market: thirty-two stops, and the median
 * change of heading across one of them was 1.1° — the most any stop achieved was
 * 2.9°. The whole route was a slow aimless drift of about ±30° that wandered
 * back to where it started, plus sidesteps.
 *
 * The mechanism meant to provide turning could not fire. It read
 * `if (Math.abs(yawOffset) > NECK_LIMIT)` — turn the body when the neck runs out
 * — but `yawOffset` springs toward a target that is *already clamped* to
 * `NECK_LIMIT`, and a critically damped spring does not overshoot. So the branch
 * was unreachable, the piece's own note claimed the behaviour, and nothing
 * anywhere said otherwise. **A mechanism nobody has seen fire is a claim, not a
 * mechanism.**
 *
 * What replaces it is the reason people change direction in a market: you look
 * at something, and then you go to it. So when a look ends while standing, it
 * sometimes becomes the new line — the body pivots round to where the head
 * already is, and the head comes back to centre as it arrives, which is one
 * movement rather than two.
 */
const TURN_ON_LOOK = 0.38

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

/**
 * Natural frequency of the body's facing, in radians per second.
 *
 * **A body has rotational inertia and a rate limiter does not.** The facing used
 * to chase `atan2(vy, vx)` — the *instantaneous* velocity direction — clipped to
 * `TURN_WALKING`. In a crowd that velocity is being shoved about by avoidance at
 * up to 7 m/s², which at walking speed is more than two degrees of direction per
 * 1/120 s step, so the target was jittering far faster than any body turns and
 * the limiter simply clipped it. What came out was a camera at its turn cap with
 * the direction reversing on 14% of steps — a 15 Hz shake, reported as "strange
 * jitter… in video games that usually indicates collisions".
 *
 * It was not the collisions. It was the facing having no mass. A critically
 * damped spring filters the high-frequency component and follows the low, which
 * is what inertia does; `TURN_WALKING` stays as a ceiling for the rare genuine
 * turn. 4.5 rad/s settles a real change of direction in under a second while
 * rejecting anything above a couple of hertz.
 */
const COURSE_OMEGA = 4.5

/** The same, while standing. A deliberate pivot, slower than a walking correction. */
const PIVOT_OMEGA = 2.6

/**
 * How far off your own facing you will travel before turning, in radians.
 *
 * **This is what makes sidestepping exist at all, and without it there was
 * none.** The body's facing used to track `atan2(vy, vx)` — the direction it
 * was actually moving — so by construction you always faced exactly where you
 * were going, and the measured angle between the two had a median of 1.4° and
 * a 90th percentile under 8°. That is not how anybody gets past anybody in a
 * corridor: you keep facing down the corridor and you step sideways.
 *
 * So the facing follows the line you *intend* to walk, and avoidance shows up
 * as lateral displacement off it. 35° is where that stops being a sidestep: past
 * it you are crabbing rather than walking, and real shoulders come round. So the
 * facing is pulled back to within this of the actual travel, which makes the
 * turn a consequence of a large or sustained deviation rather than a rule.
 */
const STRAFE_LIMIT = 0.61

/**
 * How far the gaze will go below and above its resting line, in radians.
 *
 * **`pitch` is a bias, not a lock, and it used to be a lock.** A walking person
 * looks at the ground they are about to walk on, at a face, at a child's head
 * which is most of a metre below their own — the head goes up and down as
 * readily as side to side, and peripheral vision is what lets you do it without
 * stopping. Holding the vertical fixed while the horizontal wandered was half a
 * head movement.
 *
 * Down reaches further than up because that is where most of it is: the ground,
 * and every head shorter than yours. But up is not nothing, and it was nearly
 * nothing here — a vertical drift of a few degrees either side of the bias, which
 * never rose far enough above level to read as looking up at all.
 */
const PITCH_DOWN = 0.58
const PITCH_UP = 0.55

/**
 * How far ahead and how far to the side a thing worth looking at is, in metres.
 *
 * One range for the ground in front of your feet and for a stall, a dog or a
 * stone beside the path, because they are the same thing: **a point that does
 * not move, which you then walk past.** See `Look`.
 *
 * **Placed to still be worth looking at in a second's time.** A glance ends when
 * the thing goes further round than the neck reaches, and something 2 m ahead
 * and 3.5 m to the side is already at 60° — so it left the neck's range almost
 * at once, the hold was cut, and the head was recalled before it had arrived.
 * That is the same fault as a hold shorter than the neck's settling time,
 * reached from the other end, and it took the whole downward range with it:
 * the 10th percentile of the gaze went back to sitting on the bias. Further
 * ahead and less to the side gives the sweep a few seconds to run.
 */
const SPOT_AHEAD = [3.2, 8]

/**
 * How far round from the line of travel a thing worth looking at can be.
 *
 * **Scaled by the sweep, so standing still widens it.** Placed as a fixed
 * ahead-and-to-the-side box, spots reached about 37° whether the observer was
 * walking or stopped — which left a stopped observer's head at 14° at the 90th
 * percentile, when stopping to look around is the one time it should be going
 * furthest. The floor keeps the walking case wide enough for the thing Andrei
 * described: at a market you do turn your head to look at a stall.
 */
const SPOT_BEARING_MIN = 0.65

/**
 * Seconds an overhead look is held, and how far off the thing being watched is.
 *
 * **Looking up is a different movement from looking down, and the difference is
 * that it follows something.** You look at the ground because you are about to
 * walk on it: a check, half a second, done. You look up because something caught
 * your eye, and then you track it.
 *
 * **Far enough and slow enough to still be there in a second.** A glance ends
 * when its subject goes further round than the neck reaches, which is the right
 * rule and bites hardest here: something 9 m away crossing at 9 m/s sweeps past
 * 66° in under a second, so the look was cut before the head arrived and the
 * time spent gazing above level fell from 12% to 1.5%. Same fault as a hold
 * shorter than the settling time, reached from a third direction.
 *
 * **Nothing is drawn up there, and the gaze goes anyway.** Andrei's reason, which
 * is better than the one this comment used to give: "we're only drawing heads.
 * if we only followed things that are there, we'd only be following heads. we
 * want to follow birds, rocks, etc. So sometimes we need to invent a thing to
 * look at (and not show it)."
 *
 * So inventing the subject is the mechanism rather than a shortcut around a
 * missing one. A gaze restricted to what the renderer knows about is the
 * renderer's gaze, and in a piece that draws one kind of object it would be a
 * gaze that only ever tracked that object. **Roughly two glances in five go to
 * something that does not exist** — the birds here, and the rocks, dogs and
 * stalls in `SPOT_AHEAD`.
 */
const HOLD_UP = [1.5, 3.4]
const UP_HEIGHT = [5, 19]
const UP_RANGE = [14, 40]
const UP_SPEED = [1, 4]

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
  /** The people walking with the observer, who are most of where the gaze goes when there are any. */
  companions: Person[]
  /** Half the corridor the crowd is confined to, so the observer is held by the same walls. */
  halfWidth: number
  /** The line the way follows. Walking along a street is walking along this. */
  path: Path
  /** The one I am chasing, if anybody. */
  quarry: Person | null
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
  let courseVel = 0
  /** Which way the head is pointing, absolute. Always `course` plus the offset below. */
  let yaw = 0
  /** How far the head is off the body, in radians. Rest is zero. */
  let yawOffset = 0
  let yawVel = 0
  /** What the head is currently looking at. Re-aimed every step while it is held. */
  let look: Look = { kind: "ahead" }
  /** Where that puts the head, as offsets from the course and from the pitch bias. */
  let glanceTo = 0
  let glanceUp = 0
  /** How far the head is off its resting pitch. Rest is zero, which is the `pitch` setting. */
  let pitchOffset = 0
  let pitchVel = 0
  let untilGlance = 0
  let holdLeft = 0
  /** Where the body would like to be pointing. Only reachable by pivoting, and only when stopped. */
  let aimTarget = 0

  let walking = true
  let untilState = 0

  /** Radians. One full cycle of the head's rise per step. */
  let phase = 0
  /** Whether my gait is a run. See `runSpeed`: it is a threshold on my own legs, not on a setting. */
  let running = false
  /** How far the bob has moved from a walk's to a run's, 0 to 1. */
  let runMix = 0
  let clock = 0

  let stature = current.height

  const force = { x: 0, y: 0 }
  /** My place on the way, and my nearest point on a loop from last step. */
  const frame: Frame = { lateral: 0, cos: 1, sin: 0 }
  const hint: PathHint = { pathAt: -1 }

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

  /** The resting line of sight, in radians. The `pitch` setting, which is in degrees. */
  const bias = () => (current.pitch * Math.PI) / 180

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
  /**
   * Where the next glance goes, as offsets from the course and from the resting
   * pitch — and whether it is the kind of look that is held.
   *
   * **Two dimensions, because a head has two.** The horizontal half is unchanged
   * and is mostly whoever is about to pass closest. The vertical half is new and
   * is mostly the ground: it is what a walking person actually looks at, and it
   * comes with a second thing for free — glancing at somebody computes the angle
   * to *their head*, so looking at a child is looking down, by exactly as much
   * as a child is shorter.
   */
  /**
   * What the current glance is aimed at, **in the world rather than in angles**.
   *
   * A glance used to be a pair of angles fixed when it was chosen, which makes
   * every look a stare: the head snaps to a bearing and holds it while the world
   * slides past underneath. What a person does is look *at something*, and the
   * angles then follow from the fact that they are walking.
   *
   * Aiming at a point gets all of it from one mechanism — a stall sweeps round
   * and down as you pass it, the ground ahead is the same thing at `z = 0`, a
   * bird is a point with a velocity, a face is a point that walks — and the look
   * ends itself when its subject goes further round than the neck reaches, which
   * is the glance ending because the world moved.
   */
  type Look =
    | { kind: "ahead" }
    | { kind: "person"; person: Person; wide: number }
    | { kind: "spot"; x: number; y: number; z: number; vx: number; vy: number; vz: number; wide: number }

  /** Where a look points now, as offsets from the course and from the resting pitch. */
  function aimAt(look: Look): { yaw: number; up: number; worth: boolean } {
    if (look.kind === "ahead") return { yaw: 0, up: 0, worth: true }
    const eye = eyeHeight(stature)
    const tx = look.kind === "person" ? look.person.x : look.x
    const ty = look.kind === "person" ? look.person.y : look.y
    const tz = look.kind === "person" ? look.person.head : look.z

    const dx = tx - x
    const dy = ty - y
    const flat = Math.sqrt(dx * dx + dy * dy)
    let yaw = Math.atan2(dy, dx) - course
    while (yaw > Math.PI) yaw -= Math.PI * 2
    while (yaw < -Math.PI) yaw += Math.PI * 2
    // Absolute, then taken back to an offset from the resting line, so a face at
    // eye level cancels the bias rather than adding to it.
    const up = Math.atan2(tz - eye, Math.max(0.4, flat)) - bias()

    return {
      yaw: Math.max(-look.wide, Math.min(look.wide, yaw)),
      up: Math.max(-PITCH_DOWN, Math.min(PITCH_UP, up)),
      // Still worth following: not round further than the neck reaches, and not
      // on top of you. When it stops being worth it the glance ends, which is
      // the glance ending because the world moved — the right reason.
      worth: Math.abs(yaw) <= look.wide && flat > 0.35,
    }
  }

  /** Move whatever is being watched. Only the things that move on their own have a velocity. */
  function driftLook(look: Look, dt: number): void {
    if (look.kind !== "spot") return
    look.x += look.vx * dt
    look.y += look.vy * dt
    look.z += look.vz * dt
  }

  /** Pick something to look at, and how long to give it. */
  function pickGlance(crowd: Neighbourhood, sweep: number): { look: Look; hold: number } {
    if (sweep <= 0) return { look: { kind: "ahead" }, hold: 0 }

    const cos = Math.cos(course)
    const sin = Math.sin(course)
    const roll = rng()

    // **A conversation is most of where the head goes when there is one.** A
    // companion is reachable with the whole neck rather than the walking sweep,
    // because turning to talk to somebody beside you is exactly the movement the
    // small walking sweep exists to rule out.
    const mates = crowd.companions
    // **The share is zero when there is nobody to talk to, and the boundaries
    // below are built from it.** Writing `roll < SHARE_COMPANION` and then
    // `roll < SHARE_COMPANION + SHARE_UP` with a constant first term is the
    // chained-roll fault this file already has a comment warning about: with no
    // companion the first branch is skipped, its half of the probability falls
    // through to the next one, and looking at the sky went from 9% of glances to
    // 59%. Measured as a gaze above level a quarter of the time, walking alone,
    // with no downward range left at all.
    // **The one I am chasing takes glances first**, as many as `chase` gives
    // them — keeping somebody in sight is what a chase is — and the rest of the
    // gaze is shared out below exactly as it was.
    const runaway = crowd.quarry
    if (runaway && current.chase > 0 && rng() < 0.55 * current.chase) {
      return { look: { kind: "person", person: runaway, wide: NECK_LIMIT }, hold: between(HOLD_STOPPED, rng()) }
    }

    const pCompanion = mates.length > 0 ? SHARE_COMPANION : 0
    if (mates.length > 0 && roll < pCompanion) {
      const mate = mates[Math.floor(rng() * mates.length)]!
      return { look: { kind: "person", person: mate, wide: NECK_LIMIT }, hold: between(HOLD_STOPPED, rng()) }
    }

    // Something overhead, followed rather than stared at. See `HOLD_UP`.
    if (roll < pCompanion + SHARE_UP) {
      const range = between(UP_RANGE, rng())
      const bearing = course + (rng() - 0.5) * 1.4
      const heading = rng() * Math.PI * 2
      const speed = between(UP_SPEED, rng())
      return {
        look: {
          kind: "spot",
          x: x + Math.cos(bearing) * range,
          y: y + Math.sin(bearing) * range,
          z: between(UP_HEIGHT, rng()),
          vx: Math.cos(heading) * speed,
          vy: Math.sin(heading) * speed,
          vz: (rng() - 0.55) * 1.6,
          wide: NECK_LIMIT,
        },
        hold: between(HOLD_UP, rng()),
      }
    }

    // Something on the ground, or on it: a stall, a dog, a stone, the paving two
    // metres in front of your feet. All the same thing — a point that does not
    // move — and half of them are the ground itself.
    if (roll < pCompanion + SHARE_UP + SHARE_SPOT) {
      const range = between(SPOT_AHEAD, rng())
      const spread = Math.min(NECK_LIMIT, Math.max(SPOT_BEARING_MIN, sweep))
      const bearing = course + (rng() - 0.5) * 2 * spread
      return {
        look: {
          kind: "spot",
          x: x + Math.cos(bearing) * range,
          y: y + Math.sin(bearing) * range,
          z: rng() < 0.55 ? 0 : rng() * 1.3,
          vx: 0,
          vy: 0,
          vz: 0,
          wide: NECK_LIMIT,
        },
        hold: between(HOLD_GROUND, rng()),
      }
    }

    // Whoever is about to pass closest — tracked as they pass, not stared past.
    let found: Person | null = null
    let bestScore = Infinity
    const near = crowd.neighbours(x, y, 14)
    for (let n = 0; n < 20 && near.length > 0; n++) {
      const person = near[Math.floor(rng() * near.length)]
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

    const hold = between(walking ? HOLD_WALKING : HOLD_STOPPED, rng())
    if (!found) return { look: { kind: "ahead" }, hold }
    return { look: { kind: "person", person: found, wide: sweep }, hold }
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
    // Where I am on the way, once a step, for the line, the walls and my lane.
    const here = crowd.path.frame(x, y, frame, hint)
    const confine = Math.max(0, Math.min(1, 1 - crowd.halfWidth / 25))
    if (confine > 0) {
      // Along the way *here*: on a trail the line to hold is the one the path
      // runs in at my feet, which is what walking a bend is.
      let off = aim - (crowd.path.straight ? 0 : Math.atan2(here.sin, here.cos))
      while (off > Math.PI / 2) off -= Math.PI
      while (off < -Math.PI / 2) off += Math.PI
      aim -= off * confine * 1.4 * dt
    }

    // The hill has its say on my pace too, by the same function as everybody
    // else's — or I would stride up a climb past a crowd that is labouring.
    const grade = crowd.path.flat ? 0 : crowd.path.groundSlope(x) * Math.cos(aim)
    // **After them.** The line I mean to walk turns toward the person in red,
    // by as much as `chase` says. It is the aim that turns, not the course, so
    // the negotiation with the crowd still decides where I actually go.
    const runaway = crowd.quarry
    if (runaway && current.chase > 0) {
      let off = Math.atan2(runaway.y - y, runaway.x - x) - aim
      while (off > Math.PI) off -= Math.PI * 2
      while (off < -Math.PI) off += Math.PI * 2
      aim += off * current.chase * 2.5 * dt
    }
    const wanted = walking ? current.walk * hikingPace(grade, current.effort) : 0
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
    if (crowd.path.straight) {
      const outside = Math.abs(y) - crowd.halfWidth + 0.8
      if (outside > 0) force.y -= Math.sign(y) * outside * 7
    } else {
      const lat = here.lateral
      const outside = Math.abs(lat) - crowd.halfWidth + 0.8
      if (outside > 0) {
        force.x += here.sin * Math.sign(lat) * outside * 7
        force.y -= here.cos * Math.sign(lat) * outside * 7
      }
    }

    // My side of the way: my own line if I am holding one, otherwise the same
    // rule as everybody else's.
    if ((current.keep !== 0 || current.hold > 0) && walking && Number.isFinite(crowd.halfWidth)) {
      const lateral = here.lateral
      const push =
        current.hold > 0
          ? (current.line * crowd.halfWidth - lateral) * LANE_SPRING * current.hold
          : lanePush(lateral, crowd.halfWidth, Math.cos(aim - Math.atan2(here.sin, here.cos)), current.keep)
      force.x += -here.sin * push
      force.y += here.cos * push
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

    // The gait, which drives the bob. The same two lines every other person in
    // the crowd gets, off the same anatomy in `body.ts`.
    // **Walking or running is a gait, not a speed**, and it switches with
    // hysteresis — a person does not flicker between the two at the threshold,
    // they commit. Up at the Froude threshold, down a little below it.
    const threshold = runSpeed(stature)
    if (!running && speed > threshold * 1.04) running = true
    else if (running && speed < threshold * 0.9) running = false
    // The switch itself is eased over a couple of steps, or the frame would
    // jump from one bob to the other in a single frame.
    runMix += ((running ? 1 : 0) - runMix) * Math.min(1, dt * 3)
    const stepRate = running ? runCadence(stature, speed) : cadence(stature, speed, Math.max(0.4, current.walk))
    phase += stepRate * dt * Math.PI * 2

    // **The head: a glance is a departure and a return.** Between glances the
    // commanded offset is zero, which is straight ahead, so the rest state of the
    // head is the direction of travel and everything else is temporary.
    const stopped = speed < 0.25
    const sweep = (stopped ? SWEEP_STOPPED : SWEEP_WALKING) * Math.min(1.3, Math.max(0, current.looking))

    if (holdLeft > 0) {
      holdLeft -= dt
      // **Re-aimed, not held.** The thing being looked at is a point in the
      // world, so walking past it sweeps the gaze round and down by itself, a
      // bird crosses the sky, and a face is followed as it passes.
      driftLook(look, dt)
      const aim = aimAt(look)
      glanceTo = aim.yaw
      glanceUp = aim.up
      // It went round further than the neck reaches, or you are on top of it.
      if (!aim.worth) holdLeft = 0
      if (holdLeft <= 0) {
        // **A stop is where the walk changes direction**, and what it changes to
        // is whatever was just being looked at. See `TURN_ON_LOOK`: the body
        // pivots round to where the head already is, and the head returns to
        // centre as it arrives, so it reads as one movement.
        if (stopped && rng() < TURN_ON_LOOK) aimTarget = course + yawOffset
        look = { kind: "ahead" }
        glanceTo = 0
        glanceUp = 0
      }
    } else {
      untilGlance -= dt
      if (untilGlance <= 0) {
        const pick = pickGlance(crowd, Math.min(sweep, NECK_LIMIT))
        look = pick.look
        const aim = aimAt(look)
        glanceTo = aim.yaw
        glanceUp = aim.up
        holdLeft = pick.hold
        // A conversation has a rhythm to it, so the gaps are shorter when there
        // is somebody to have one with.
        const gap = crowd.companions.length > 0 ? GAP_TALKING : stopped ? GAP_STOPPED : GAP_WALKING
        untilGlance = holdLeft + between(gap, rng())
      }
    }

    // **Critically damped, not rate limited.** It accelerates out of rest and
    // decelerates into the target with no overshoot and no hard stop, which is
    // the difference between a head turning and a turret slewing. `NECK` is kept
    // as a ceiling only, for the rare large offset.
    const pull = -2 * NECK_OMEGA * yawVel - NECK_OMEGA * NECK_OMEGA * (yawOffset - glanceTo)
    yawVel = Math.max(-NECK, Math.min(NECK, yawVel + pull * dt))
    yawOffset += yawVel * dt

    // The vertical, on the same spring. Nodding is the same neck.
    const lift = -2 * NECK_OMEGA * pitchVel - NECK_OMEGA * NECK_OMEGA * (pitchOffset - glanceUp)
    pitchVel = Math.max(-NECK, Math.min(NECK, pitchVel + lift * dt))
    pitchOffset = Math.max(-PITCH_DOWN, Math.min(PITCH_UP, pitchOffset + pitchVel * dt))

    // A head parked past its limit is not something people do. Unreachable in
    // practice — the glance target is clamped to the same limit and the spring
    // does not overshoot — but cheap, and the clamp is the honest place for it.
    if (Math.abs(yawOffset) > NECK_LIMIT) {
      yawOffset = Math.sign(yawOffset) * NECK_LIMIT
    }

    // **The body turns toward where it is going; it is never assigned there.**
    // Moving, that is the velocity. Standing, it is wherever the body has
    // decided to face, so a stop is where the walk can change direction. Either
    // way it is rate limited, because a body cannot pivot in one frame and the
    // version that could produced a 172° step — see `TURN_WALKING`.
    const moving = speed > 0.12
    if (moving) {
      // **Face the line you mean to walk, not the one the crowd is shoving you
      // along.** The difference between the two *is* the sidestep. See
      // `STRAFE_LIMIT`, which is the point at which it stops being one.
      const travel = Math.atan2(vy, vx)
      let drift = travel - aim
      while (drift > Math.PI) drift -= Math.PI * 2
      while (drift < -Math.PI) drift += Math.PI * 2
      aimTarget = Math.abs(drift) <= STRAFE_LIMIT ? aim : travel - Math.sign(drift) * STRAFE_LIMIT
    }
    let toward = aimTarget - course
    while (toward > Math.PI) toward -= Math.PI * 2
    while (toward < -Math.PI) toward += Math.PI * 2

    // **Sprung, not rate limited.** See `COURSE_OMEGA`: the target is the
    // instantaneous velocity direction and it jitters far faster than a body
    // turns, so what is needed is a filter with mass, not a clip. The ceiling is
    // kept for the rare genuine turn.
    const omega = moving ? COURSE_OMEGA : PIVOT_OMEGA
    courseVel += (omega * omega * toward - 2 * omega * courseVel) * dt
    const cap = moving ? TURN_WALKING : PIVOT
    courseVel = Math.max(-cap, Math.min(cap, courseVel))
    const pivot = courseVel * dt
    course += pivot
    // The line being walked comes round with the body, so setting off again goes
    // the new way rather than snapping back to the old one.
    if (!moving) aim += pivot

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
    /**
     * Where the eye is pointing vertically, in radians. The `pitch` setting plus
     * wherever the current glance has taken it.
     */
    get pitch() {
      return bias() + pitchOffset
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
      const walkRise = Math.sin(phase) * BOB_RISE
      const runRise = runBounce(phase / (Math.PI * 2)) * RUN_RISE
      const rise = walkRise + (runRise - walkRise) * runMix
      const sway = BOB_SWAY + (RUN_SWAY - BOB_SWAY) * runMix
      return {
        z: eyeHeight(stature) + rise * amount * moving,
        sway: Math.sin(phase / 2) * sway * amount * moving,
      }
    },

    step,

    resettle(next: Settings): void {
      current = next
      stature = current.height
    },

    stats() {
      return { x, y, yaw, course, speed: Math.hypot(vx, vy), walking, running, stature, clock }
    },
  }
}
