/**
 * The fire itself, which is the one thing in the piece nobody can see.
 *
 * Three ways an ember leaves a fire, and they look different because they *are*
 * different events:
 *
 * - **Sputter.** The steady background. Char flakes lift off the bed and are
 *   simply handed to the air, with barely any speed of their own. Everything
 *   about where they go afterwards belongs to `air.ts`. This is the majority of
 *   the population and the least interesting single ember.
 *
 * - **Splinter.** Wood char decrepitates: pockets of trapped gas and steam reach
 *   pressure and burst, throwing a tight fan of small hot fragments at several
 *   metres a second. These are the ones that *shoot* — they leave ballistically,
 *   outrun the plume, decelerate under their own drag in a couple of tenths of a
 *   second, and then have to be caught by the air like everything else. That
 *   deceleration is not scripted; it is what `τ = fall/g` does to something
 *   launched at 8 m/s.
 *
 * - **Burst.** The fire itself surges — a log shifts, a pocket of volatiles
 *   lights — and a slug of embers goes up together on a puff of hot gas. This is
 *   the only one of the three that touches the air rather than just adding to it:
 *   it asks `air.ts` for a vortex pair and raises the bed's vigour, so the plume
 *   swells, the gas gets hotter, the firelight under the frame brightens and the
 *   emission rate climbs, all off the same number. A burst that only emitted
 *   more embers read as a hiccup in a particle count.
 *
 * ## Where along the bed
 *
 * Not uniformly. The bed is hottest on its axis and the emission follows the
 * same `sech²` profile the plume's velocity does, which is not a coincidence —
 * they have the same cause. So embers mostly come from the middle of the fire
 * and occasionally from its edge, and the ones from the edge are the ones that
 * miss the column.
 */

import { gaussian, hashSeed, makeRng, type Rng } from "@/experiments/random"
import type { Air } from "@/experiments/embers/air"
import type { Settings } from "@/experiments/embers/settings"

/**
 * Embers a second at `sputter = 1`, per metre of bed width.
 *
 * Set from the other end, because this is not a number anybody can estimate: an
 * ember's *life* is what the physics decides, and it comes out at three or four
 * seconds of burning against under a second of crossing a close frame — so more
 * than half of them leave the picture rather than going out in it. The rate that
 * fills a frame is therefore the rate that replaces what leaves it, and at
 * `sputter = 1` on a half-metre fire that is about three hundred a second. The
 * first version of this file guessed 26 and produced a fire with forty embers
 * over it.
 */
const SPUTTER_RATE = 520

/** Fragments one splinter throws. */
const SPLINTER_MIN = 3
const SPLINTER_MAX = 14

/** How many embers a burst sends up, at `sputter = 1`. */
const BURST_SLUG = 40

/** How long a burst keeps emitting for, seconds. A slug, not a spike. */
const BURST_SPILL = 0.55

/**
 * What the bed asks for when it wants an ember.
 *
 * A position, a launch velocity, a temperature multiplier and a size bias. The
 * scene owns the pool, so the bed cannot make one — it describes one and hands
 * the description over. That is also what keeps `bed.ts` free of the view: none
 * of these are in pixels and none of them know how big the window is.
 */
export type Spawn = {
  /**
   * Which of the three this is, so the scene can tell an *event* from the
   * background when the population ceiling binds.
   *
   * The bed already knows; it used not to say, and the cost was that `splinters`
   * and `bursts` competed with `sputter` for slots first-come. On a wide fire
   * asking for thousands of lifted flakes a second, the rare interesting thing
   * lost every race — measured at 1.4% of splinter fragments ever being born
   * with the control at maximum.
   */
  kind: "lift" | "splinter" | "burst"
  x: number
  y: number
  vx: number
  vy: number
  /** Multiplies `heat`. A splinter fragment comes off hotter than a lifted flake. */
  heat: number
  /** Multiplies the size draw. Splinters are small; a burst throws bigger pieces. */
  size: number
}

export type Bed = {
  /** Run the fire for a step, asking `emit` for each ember it wants. */
  step: (dt: number, air: Air, emit: (spawn: Spawn) => void) => void
  /** Make a burst happen now. The `b` shortcut and the poster recipe use it. */
  burst: () => void
  setSettings: (next: Settings) => void
  /** Bursts since the piece started. The only way to tell one happened from a number. */
  bursts: number
}

export function createBed(initial: Settings, seed: number): Bed {
  let settings = initial
  let bursts = 0

  const rng: Rng = makeRng(hashSeed(seed, 0x62656431))

  /** Fractional embers owed, so a rate below one a frame is not rounded to nothing. */
  let owed = 0
  let nextSplinter = 0
  let nextBurst = 0
  /** Seconds of burst spill left, and the rate it is being spent at. */
  let spill = 0
  let spillRate = 0
  /** Set by `burst()`, which has no `Air` to hand. Consumed by the next step. */
  let forced = false

  const half = () => Math.max(0.02, settings.bed / 2)

  /**
   * A position across the bed, weighted to the middle.
   *
   * The inverse of the `sech²` profile has no closed form worth writing, so this
   * is rejection sampling with a bound of one — two draws on average, and it is
   * exact rather than a Gaussian that looks similar and has the wrong tails.
   */
  function acrossBed(): number {
    for (let tries = 0; tries < 8; tries++) {
      const s = (rng() * 2 - 1) * 1.9
      const th = Math.tanh(s)
      if (rng() < 1 - th * th) return s * half()
    }
    return 0
  }

  function lift(air: Air, emit: (spawn: Spawn) => void): void {
    const x = air.axisAt(0) + acrossBed()
    emit({
      kind: "lift",
      x,
      y: 0.02 + rng() * 0.05,
      // Barely any speed of its own: a lifted flake starts by going wherever
      // the air over the coals is going, which the scene reads for it.
      vx: gaussian(rng) * 0.25,
      vy: 0.3 + rng() * 0.8,
      heat: 1,
      size: 1,
    })
  }

  function splinter(air: Air, emit: (spawn: Spawn) => void): void {
    const x = air.axisAt(0) + acrossBed()
    const count = SPLINTER_MIN + Math.floor(rng() * (SPLINTER_MAX - SPLINTER_MIN))
    // One cone per event, so a splinter reads as a single thing bursting rather
    // than as several unrelated fast embers.
    const heading = Math.PI / 2 + gaussian(rng) * 0.5
    const spread = 0.12 + rng() * 0.35
    const speed = 2.6 + rng() * 6.5

    for (let at = 0; at < count; at++) {
      const angle = heading + gaussian(rng) * spread
      const fast = speed * (0.55 + rng() * 0.75)
      emit({
        kind: "splinter",
        x: x + gaussian(rng) * 0.01,
        y: 0.01 + rng() * 0.02,
        vx: Math.cos(angle) * fast,
        vy: Math.sin(angle) * fast,
        // Fresh from inside a coal, so hotter than anything the surface offers.
        heat: 1.1 + rng() * 0.12,
        size: 0.45 + rng() * 0.35,
      })
    }
  }

  function beginBurst(air: Air): void {
    bursts++
    spill = BURST_SPILL
    spillRate = (BURST_SLUG * Math.max(0.35, settings.sputter) * (0.7 + rng() * 0.8)) / BURST_SPILL
    // The air is told first, so the pair's circulation is set from the swollen
    // plume — see `Air.puff`.
    air.puff(1.4 + rng() * 1.3, 0.7 + rng() * 0.7)
  }

  function fromBurst(air: Air, emit: (spawn: Spawn) => void): void {
    const x = air.axisAt(0) + acrossBed() * 1.3
    emit({
      kind: "burst",
      x,
      y: 0.02 + rng() * 0.08,
      vx: gaussian(rng) * 0.5,
      vy: 0.8 + rng() * 2.2,
      heat: 1.04 + rng() * 0.1,
      // A surge lifts pieces a steady draught could not, so the slug skews big.
      size: 1.25 + rng() * 0.5,
    })
  }

  return {
    step(dt, air, emit) {
      // Vigour multiplies the steady rate, which is what makes a burst brighten
      // the base of the column rather than only launching a slug.
      const rate = SPUTTER_RATE * settings.sputter * settings.bed * air.vigour()
      owed += rate * dt
      while (owed >= 1) {
        owed -= 1
        lift(air, emit)
      }

      if (settings.pops > 0) {
        nextSplinter -= dt
        if (nextSplinter <= 0) {
          splinter(air, emit)
          // Exponential intervals. A splinter every 1/rate seconds exactly is a
          // machine, and the ear for this is better than the eye expects.
          nextSplinter = -Math.log(Math.max(1e-6, rng())) / settings.pops
        }
      }

      if (settings.bursts > 0) {
        nextBurst -= dt
        if (nextBurst <= 0) {
          forced = true
          nextBurst = -Math.log(Math.max(1e-6, rng())) / (settings.bursts / 60)
        }
      }

      // Asked for by the clock above or by hand. Read the same way either way,
      // so `bursts` at zero still leaves the shortcut and the poster recipe a
      // way to make one happen.
      if (forced) {
        forced = false
        beginBurst(air)
      }

      if (spill > 0) {
        spill -= dt
        owed += spillRate * dt
        while (owed >= 1) {
          owed -= 1
          fromBurst(air, emit)
        }
        if (spill <= 0) spillRate = 0
      }
    },

    burst() {
      // Deferred to the next step, because a burst needs the air and this is
      // reachable from the console handle where there is none to hand.
      forced = true
    },

    setSettings(next) {
      settings = next
    },

    get bursts() {
      return bursts
    },
  }
}
