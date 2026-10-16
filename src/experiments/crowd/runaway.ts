/**
 * The person in red: how they want to move, as decisions that can be tested
 * one at a time.
 *
 * Moved out of `throng.ts`'s closure unchanged — the same arithmetic and the
 * same draws from the throng's `place` stream, in the same order — so that a
 * catch, a bolt, a re-arm, a hide and a junction can each be checked with a
 * runaway, an observer and the ground under them, rather than by chasing
 * somebody round the market for four minutes and hoping it happens (#287).
 *
 * The throng owns one `RunawayState` and hands every call a `RunawayWorld`:
 * where I am, the ground, and the stream. Nothing here keeps a reference to
 * either between calls.
 */
import type { Boulder, Boulders } from "@/experiments/crowd/boulders"
import type { Settings } from "@/experiments/crowd/settings"
import type { Stalls } from "@/experiments/crowd/stalls"
import type { Person } from "@/experiments/crowd/throng"
import type { Rng } from "@/experiments/random"

/** Metres. Close enough that I have caught the person in red: an arm's reach and a body. */
export const CAUGHT_AT = 1.1

/** Share of their waits in which they do not notice me coming, so the chase ends in a catch. */
export const CAUGHT_SHARE = 0.6

/** How far a runaway looks for a boulder to get behind, in metres. */
export const HIDE_REACH = 25

/** Seconds a runaway keeps one boulder between us before breaking for another. */
export const COVER_FOR = [5, 14] as const

/** Share of hidings in which they do not see me coming round, so hiding can still end in a catch. */
export const UNAWARE = 0.3

/** Metres they must get away before they can be caught again. */
export const REARM_AT = 5

/** Seconds we stand together once caught, before they bolt again. */
export const CAUGHT_FOR = [2.5, 5]

/** What the runaway is in the middle of. One per throng, reset when the chase is set up. */
export type RunawayState = {
  /** Whether the person in red is running off, or dawdling and letting me close. */
  fleeing: boolean
  /**
   * Seconds left of being caught, or 0. **Being caught is a state of its own**:
   * "if i catch them we can stand together for a little bit, then they run away
   * and I chase them again. tom and jerry style." Without it a catch was a
   * runaway dawdling beside me while I circled them, which read as wrestling.
   */
  caughtFor: number
  /**
   * Whether a catch can happen. Disarmed when they bolt and re-armed only once
   * they are properly away: they bolt from within arm's reach, and without this
   * the next step caught them again — measured at 55 catches in four minutes on
   * one seed, a runaway who never got away at all.
   */
  armed: boolean
  /** How far they run before stopping, and how close they let me get before running again. Redrawn each time. */
  farGap: number
  nearGap: number
  /**
   * Where the runaway is making for when there are boulders: the far side of
   * one, from me. **A runaway on open ground runs straight away from me**, which
   * puts them dead ahead — the crosshair the stalls were built to break. With
   * boulders the way to lose somebody is to get one between you, so that is
   * what they run for, and then they are simply gone until they break cover.
   */
  hiding: boolean
  /** The boulder being kept between us, and how much longer before they break for another. */
  cover: Boulder | null
  coverFor: number
  /** Whether they have got round to the far side yet. Until then, me being close is why they are running, not a reason to break. */
  inCover: boolean
  /** Some of the time they are not watching for me behind their boulder, and that is how I catch them. */
  unaware: boolean
  hideCandidates: Boulder[]
}

/** Everything a runaway's decision reads from outside it. Asked fresh on every call. */
export type RunawayWorld = {
  observer: { x: number; y: number }
  boulders: Boulders
  stalls: Stalls
  /** The way's half-width, or not finite on open ground. */
  halfWidth: number
  current: Pick<Settings, "walk" | "flee">
  place: Rng
}

export function createRunaway(): RunawayState {
  return {
    fleeing: true,
    caughtFor: 0,
    armed: true,
    farGap: 14,
    nearGap: 3,
    hiding: false,
    cover: null,
    coverFor: 0,
    inCover: false,
    unaware: false,
    hideCandidates: [],
  }
}

/** The far side of a boulder from me, `r + 1.2` out from its centre: where somebody behind it stands. */
export function farSide(b: Boulder, observer: { x: number; y: number }): { x: number; y: number } {
  const bx = b.x - observer.x
  const by = b.y - observer.y
  const bd = Math.max(1e-3, Math.sqrt(bx * bx + by * by))
  return { x: b.x + (bx / bd) * (b.r + 1.2), y: b.y + (by / bd) * (b.r + 1.2) }
}

/**
 * Choose a boulder to get behind, or none. Never the one just left, never one
 * whose far side is back past me, and never one nearer me than they are.
 */
export function pickHide(state: RunawayState, person: Person, world: RunawayWorld): void {
  const { observer, boulders, place } = world
  state.hiding = false
  const previous = state.cover
  state.cover = null
  if (!boulders.active) return
  const dx = person.x - observer.x
  const dy = person.y - observer.y
  const d = Math.max(1e-3, Math.sqrt(dx * dx + dy * dy))
  let best = -Infinity
  for (const b of boulders.within(person.x, person.y, HIDE_REACH, state.hideCandidates)) {
    if (b === previous) continue
    const bx = b.x - observer.x
    const by = b.y - observer.y
    const bd = Math.max(1e-3, Math.sqrt(bx * bx + by * by))
    const hx = b.x + (bx / bd) * (b.r + 1.2)
    const hy = b.y + (by / bd) * (b.r + 1.2)
    const tx = hx - person.x
    const ty = hy - person.y
    const td = Math.max(1e-3, Math.sqrt(tx * tx + ty * ty))
    // Not back past me to get there.
    const away = (tx * dx + ty * dy) / (td * d)
    if (away < -0.2 || bd < d * 0.8) continue
    const score = away + place() * 0.6 - td / 40
    if (score > best) {
      best = score
      state.cover = b
      state.hiding = true
    }
  }
  state.coverFor = COVER_FOR[0] + place() * (COVER_FOR[1] - COVER_FOR[0])
  state.inCover = false
  state.unaware = place() < UNAWARE
}

/**
 * **Keeping a boulder between us, not running to a spot behind it.** A fixed
 * spot was built first and hid them 0% of the time: I follow their trail, so
 * I came round the boulder the same way they had and there they were. The
 * far side is recomputed from where I am every step, so if I come round one
 * way they go round the other — and they break for the next boulder when I
 * get close or when they have been there a while.
 */
export function keepCover(state: RunawayState, person: Person, d: number, dt: number, world: RunawayWorld): void {
  const { observer, current, place } = world
  const b = state.cover!
  state.coverFor -= dt
  const bx = b.x - observer.x
  const by = b.y - observer.y
  const bd = Math.max(1e-3, Math.sqrt(bx * bx + by * by))
  const hx = b.x + (bx / bd) * (b.r + 1.2)
  const hy = b.y + (by / bd) * (b.r + 1.2)
  const tx = hx - person.x
  const ty = hy - person.y
  const td = Math.sqrt(tx * tx + ty * ty)
  if (td < 2) state.inCover = true
  if (state.coverFor <= 0 && d > b.r + 8 && !state.unaware) {
    // Waited long enough and I am nowhere near: a better boulder.
    pickHide(state, person, world)
    if (state.hiding) return
  }
  if (state.inCover && d < b.r * 0.6 + 3.5 && !state.unaware) {
    // Found: bolt, straight away from me, and hide again once clear.
    state.hiding = false
    state.cover = null
    state.fleeing = true
    state.farGap = 9 + place() * 12
    const away = Math.atan2(person.y - observer.y, person.x - observer.x)
    person.gx = Math.cos(away)
    person.gy = Math.sin(away)
    return
  }
  if (state.unaware && state.inCover) {
    // Not watching for me: they stay put and I come round and catch them.
    person.preferred = 0
    return
  }
  if (td > 1e-3) {
    person.gx = tx / td
    person.gy = ty / td
  }
  const mine = Math.max(0.6, current.walk)
  // Hurry while out of position, settle once there.
  person.preferred = mine * current.flee * Math.min(1, td / 3)
}

/**
 * At an aisle crossing, which way to go: straight on, or a quarter turn either
 * way, scored by how far each takes them from me plus a draw, with a turn
 * favoured and a way back toward me never taken. `heading` is the way they are
 * facing; the answer is a multiple of a quarter turn.
 *
 * **In the aisles, a runaway picks a way at each crossing, and prefers a
 * corner.** Scoring by distance from me alone was built first: from behind in
 * the same aisle straight on always wins, so they ran down it dead ahead of me
 * and sat in the middle of the frame 77% of the time — the crosshair the stalls
 * were meant to break. A child trying to lose you ducks round corners, so a
 * turn is favoured, and a way back toward me is never taken.
 */
export function junctionHeading(heading: number, dx: number, dy: number, d: number, place: Rng): number {
  const quarter = Math.PI / 2
  const base = Math.round(heading / quarter) * quarter
  let best = base
  let bestScore = -Infinity
  for (const turn of [0, quarter, -quarter]) {
    const h = base + turn
    const away = (Math.cos(h) * dx + Math.sin(h) * dy) / Math.max(1, d)
    if (away < -0.3) continue
    const score = away * 0.5 + place() + (turn === 0 ? 0 : 0.7)
    if (score > bestScore) {
      bestScore = score
      best = h
    }
  }
  return best
}

/**
 * How the person in red wants to move: two states, and the switching between
 * them is the chase.
 *
 * **A pace that varies smoothly with distance does not make a chase — it was
 * built first and measured.** Any such law has a distance at which their pace
 * equals mine, and the gap settles there: two minutes of the market ended on
 * 4 m, 4 m, 4 m, 4 m, whatever the shape of the ramp. What a child who has
 * run off actually does is a relaxation oscillator. They run until they are
 * far enough away to feel safe, stop and dawdle — looking at something,
 * looking back — until you are nearly on them, and run again. Two states with
 * a gap between their thresholds cannot settle, which is the point.
 *
 * Both thresholds are redrawn at every switch, so the rhythm does not repeat.
 * On open ground their heading wanders and bends away from me when I am
 * close; in a corridor it is the way itself, like everybody's.
 */
export function flee(state: RunawayState, person: Person, dt: number, world: RunawayWorld): void {
  const { observer, stalls, halfWidth, current, place } = world
  const dx = person.x - observer.x
  const dy = person.y - observer.y
  const d = Math.sqrt(dx * dx + dy * dy)
  // Caught: stand together, then bolt with a head start. The bolt goes down
  // whichever way along their aisle is further from me.
  if (state.caughtFor > 0) {
    state.caughtFor -= dt
    person.preferred = 0
    if (state.caughtFor <= 0) {
      state.caughtFor = 0
      state.fleeing = true
      state.farGap = 9 + place() * 12
      const away = Math.atan2(dy, dx)
      const quarter = Math.PI / 2
      const heading = stalls.active ? Math.round(away / quarter) * quarter : away
      person.gx = Math.cos(heading)
      person.gy = Math.sin(heading)
      person.preferred = Math.max(0.6, current.walk) * current.flee * 1.3
      state.armed = false
    }
    return
  }
  if (!state.armed && d > REARM_AT) state.armed = true
  if (state.armed && d < CAUGHT_AT) {
    state.caughtFor = CAUGHT_FOR[0] + place() * (CAUGHT_FOR[1] - CAUGHT_FOR[0])
    person.preferred = 0
    state.hiding = false
    return
  }
  if (state.hiding) {
    keepCover(state, person, d, dt, world)
    if (state.hiding) return
  }
  if (state.fleeing && d > state.farGap) {
    state.fleeing = false
    // Far enough ahead to lose me: behind the nearest boulder, rather than
    // waiting in the open.
    pickHide(state, person, world)
    if (state.hiding) {
      keepCover(state, person, d, dt, world)
      return
    }
    // Some of the time they do not see me coming, and I catch them.
    state.nearGap = place() < CAUGHT_SHARE ? 0 : 2 + place() * 2.5
  } else if (!state.fleeing && d < state.nearGap) {
    state.fleeing = true
    state.farGap = 9 + place() * 12
  }
  let heading = Math.atan2(person.gy, person.gx)
  if (stalls.active) {
    const crossing = stalls.junction(person.x, person.y)
    if (crossing >= 0 && crossing !== person.junction) {
      person.junction = crossing
      heading = junctionHeading(heading, dx, dy, d, place)
    }
    person.gx = Math.cos(heading)
    person.gy = Math.sin(heading)
    // Laid back along the aisle if a turn has carried them past the crossing.
    const runs = stalls.runs(person.x, person.y)
    if (runs === 1 && Math.abs(person.gx) < 0.7) {
      person.gx = person.gx >= 0 ? 1 : -1
      person.gy = 0
    } else if (runs === 2 && Math.abs(person.gy) < 0.7) {
      person.gx = 0
      person.gy = person.gy >= 0 ? 1 : -1
    }
    const mine = Math.max(0.6, current.walk)
    person.preferred = state.fleeing ? mine * current.flee : mine * 0.2
    return
  }
  heading += (place() - 0.5) * (state.fleeing ? 0.9 : 3) * Math.sqrt(dt) * 2
  if (!Number.isFinite(halfWidth) && d > 1e-3) {
    // Away from me, harder the closer I am, and only while running: a child
    // dawdling is not steering.
    const away = Math.atan2(dy, dx)
    let off = away - heading
    while (off > Math.PI) off -= Math.PI * 2
    while (off < -Math.PI) off += Math.PI * 2
    if (state.fleeing) heading += off * Math.min(1, 4 / Math.max(1, d)) * dt * 2
  } else {
    // Along the way, forward: in a corridor nobody runs off sideways.
    let off = heading
    while (off > Math.PI) off -= Math.PI * 2
    while (off < -Math.PI) off += Math.PI * 2
    heading -= off * dt * 2
  }
  person.gx = Math.cos(heading)
  person.gy = Math.sin(heading)
  const mine = Math.max(0.6, current.walk)
  person.preferred = state.fleeing ? mine * current.flee : mine * 0.2
}
