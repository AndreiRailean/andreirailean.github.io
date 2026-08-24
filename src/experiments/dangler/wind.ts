/**
 * The air: a steady breeze, and gusts on top of it.
 *
 * Kept apart from the engine because it is the one piece of the simulation with
 * no state of its own — the wind at a given moment is a pure function of the
 * clock and the seed. That makes it checkable without a browser, which matters
 * for gusts especially: a burst is over in a couple of seconds and a still frame
 * cannot say whether one was ever scheduled.
 */

import { hashSeed, makeRng } from "@/experiments/dangler/random"
import type { Settings } from "@/experiments/dangler/settings"

/** Peak breeze acceleration at `breeze` 1, in world units per second². */
const BREEZE_STRENGTH = 3.2

/**
 * Peak gust acceleration at `gust` 1, in world units per second².
 *
 * Deliberately well above gravity's 9.81. A gust is supposed to be an event —
 * it should visibly throw the wires and then leave them to settle, which is the
 * whole difference between it and the breeze.
 */
const GUST_STRENGTH = 14

/** How fast a gust front crosses the canopy, in world units per second. */
const GUST_SPEED = 9

const GUST_ATTACK = 0.12
const GUST_DECAY = 1.6

/**
 * Maximum of the raw envelope, so `gust` 1 means exactly `GUST_STRENGTH`.
 *
 * Found by sampling rather than written down. The peak moves whenever the
 * attack or decay above is retuned, and a stale constant here would quietly
 * rescale what the whole slider means.
 */
const GUST_PEAK = (() => {
  let peak = 0
  for (let t = 0; t < 4; t += 0.002) {
    const value = (1 - Math.exp(-t / GUST_ATTACK)) * Math.exp(-t / GUST_DECAY)
    if (value > peak) peak = value
  }
  return peak
})()

const SALT_GUST = 0x6057

/** Gusts kept in play at once, so a burst's tail can overlap the next one. */
const TRACKED = 3

export type Gust = {
  /** When the front reaches the upwind edge of the canopy, in seconds. */
  start: number
  /** 0..1 before `GUST_STRENGTH` is applied. */
  strength: number
  dirX: number
  dirY: number
}

/**
 * Rises fast and falls slowly — the shape of a real gust, and the reason one
 * reads as a shove rather than as the breeze briefly increasing.
 */
export function gustEnvelope(since: number): number {
  if (since <= 0) return 0
  return ((1 - Math.exp(-since / GUST_ATTACK)) * Math.exp(-since / GUST_DECAY)) / GUST_PEAK
}

/**
 * The gusts that could be in play at `clock`, newest last.
 *
 * Derived from the clock rather than accumulated, so it needs no state and two
 * runs of the same seed produce the same weather. Each gust is jittered within
 * its slot, so a rate of six a minute is an average rather than a metronome.
 */
export function scheduleGusts(seed: number, clock: number, perMinute: number, out: Gust[]): void {
  out.length = 0
  if (perMinute <= 0) return

  const period = 60 / perMinute
  const current = Math.floor(clock / period)

  for (let k = current - (TRACKED - 2); k <= current + 1; k++) {
    if (k < 0) continue
    const rng = makeRng(hashSeed(seed, k, SALT_GUST))
    const start = k * period + rng() * period * 0.7
    const angle = rng() * Math.PI * 2
    out.push({
      start,
      // Never a uniform sequence of identical shoves.
      strength: 0.5 + 0.5 * rng(),
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
    })
  }
}

/**
 * Largest anchor displacement at `tremble` 1, in world units.
 *
 * Small on purpose. The rates below sit well above a hanging wire's own swing
 * period — a 0.65m wire swings at about 0.6Hz — because near it the anchor
 * *pumps* the wire instead of shaking it: at the first rates tried, 25mm of
 * anchor travel drove 0.43m of tip travel, which is swinging, not shivering.
 * Off resonance the wire follows its anchor and stops, which is the whole
 * character being aimed at.
 */
export const TREMBLE_REACH = 0.03

/**
 * How far the canopy has shaken the anchor at `(x, y)` from where it is pinned.
 *
 * The object overhead is not rigid, and this is it shivering. It is a
 * *displacement* rather than a force on purpose: a force integrates, so wires
 * under one sweep steadily outward, while an anchor that trembles drags its wire
 * about by roughly its own travel and no further. The cluster stays where it is
 * and comes alive, instead of blowing apart — which is precisely what a gust
 * cannot do however it is tuned.
 *
 * Three incommensurate rates per axis, phased by position, so no two wires
 * shiver alike and the whole canopy never lines up.
 */
export function canopyTremble(
  x: number,
  y: number,
  clock: number,
  amount: number,
  out: { x: number; y: number; z: number },
): void {
  const reach = amount * TREMBLE_REACH
  const px = x * 12.9 + y * 4.7
  const py = y * 11.3 - x * 5.1

  out.x =
    reach *
    (0.6 * Math.sin(18.3 * clock + px) +
      0.3 * Math.sin(29.1 * clock + py + 1.3) +
      0.1 * Math.sin(45.9 * clock + px * 1.7))
  out.y =
    reach *
    (0.6 * Math.sin(15.9 * clock + py + 2.4) +
      0.3 * Math.sin(33.3 * clock + px + 0.6) +
      0.1 * Math.sin(53.7 * clock + py * 1.4))
  // Vertical too, which is what sends a stretch down the wire rather than
  // merely swinging it.
  out.z = reach * 0.7 * (0.7 * Math.sin(23.1 * clock + px + py) + 0.3 * Math.sin(39.3 * clock + px - py + 1.9))
}

export type Wind = {
  /** Call once per frame, before stepping. */
  update: (settings: Settings, clock: number) => void
  /** Acceleration on the wire anchored at `(x, y)`, written into `out`. */
  at: (x: number, y: number, out: { x: number; y: number; z: number }) => void
  /** Whether any air is moving at all. */
  blowing: () => boolean
}

export function createWind(): Wind {
  const gusts: Gust[] = []
  let clock = 0
  let breeze = 0
  let gust = 0
  let extent = 1

  return {
    update(settings, now) {
      clock = now
      breeze = settings.breeze
      gust = settings.gust
      extent = settings.extent
      scheduleGusts(settings.seed, clock, gust > 0 ? settings.gustRate : 0, gusts)
    },

    at(x, y, out) {
      out.x = 0
      out.y = 0
      out.z = 0

      if (breeze > 0) {
        const strength = breeze * BREEZE_STRENGTH
        // A slowly turning prevailing direction, so the scene has a wind rather
        // than a jitter, with smaller variation riding on top of it. Layered
        // sines rather than noise: cheap, smooth, and they never repeat at any
        // period anyone will sit through. Position enters the phase, so the
        // variation crosses the canopy instead of arriving everywhere at once.
        const prevailing = 0.37 * clock
        const steady = 0.55 + 0.45 * Math.sin(0.11 * clock)
        out.x +=
          strength *
          (steady * Math.cos(prevailing) +
            0.6 * Math.sin(0.83 * clock + x * 0.9 + y * 0.4) +
            0.3 * Math.sin(1.9 * clock + y * 1.7))
        out.y +=
          strength *
          (steady * Math.sin(prevailing) +
            0.6 * Math.sin(0.71 * clock + y * 0.8 - x * 0.5 + 2.1) +
            0.3 * Math.sin(2.3 * clock + x * 1.5 + 0.7))
        out.z += strength * 0.15 * Math.sin(0.53 * clock + x + y)
      }

      if (gust <= 0) return

      for (const burst of gusts) {
        // The front crosses the canopy rather than arriving everywhere at once,
        // so a gust reads as a wave passing through. Kept fast on purpose: the
        // wires being thrown *together* is what makes a burst legible, and too
        // slow a front turns one event into a ripple nobody reads as wind.
        const reach = (extent - (x * burst.dirX + y * burst.dirY)) / GUST_SPEED
        const envelope = gustEnvelope(clock - burst.start - reach)
        if (envelope <= 0) continue

        const push = gust * GUST_STRENGTH * burst.strength * envelope
        out.x += push * burst.dirX
        out.y += push * burst.dirY
        // A little lift, so a gust does not merely shove sideways.
        out.z += push * 0.18
      }
    },

    blowing: () => breeze > 0 || gust > 0,
  }
}
