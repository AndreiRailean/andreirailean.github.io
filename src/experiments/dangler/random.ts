/**
 * Seeded randomness.
 *
 * Everything about an arrangement is drawn from here, so a seed plus the
 * geometry settings is the whole description of a scene — which is what lets an
 * arrangement survive a URL.
 *
 * The important property is not randomness but *stability*: strand 7 must draw the
 * same numbers whether the scene holds eight strands or eighty. That is why
 * callers derive a private generator per strand from `hashSeed(seed, index)`
 * rather than pulling from one shared stream, and why anchor positions come from
 * a low-discrepancy sequence indexed by `i` rather than from successive draws.
 */

export type Rng = () => number

/** Avalanche mixer. Two rounds is enough to decorrelate adjacent indices. */
function mix(value: number): number {
  let h = value | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Combines a seed with any number of salts into a new seed.
 *
 * Salts are what keep independent uses of one seed from correlating: a strand's
 * shape and a strand's colour draw from `hashSeed(seed, w, SHAPE)` and
 * `hashSeed(seed, w, COLOUR)`, so widening the hue spread cannot quietly move a
 * strand.
 */
export function hashSeed(seed: number, ...salts: number[]): number {
  let h = mix(seed)
  for (const salt of salts) h = mix(h ^ mix(salt))
  return h >>> 0
}

/** mulberry32 — small, fast, and good enough for placing dots. */
export function makeRng(seed: number): Rng {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A standard normal draw, clamped to ±2.5σ.
 *
 * The clamp is not tidiness. Hue spread is a σ in degrees, and an unclamped 4σ
 * outlier at σ=60 puts a bead 240° from the base hue — one bead of the wrong
 * colour entirely, appearing at random, which reads as a bug rather than as
 * variation.
 */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), Number.EPSILON)
  const v = rng()
  const value = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.max(-2.5, Math.min(2.5, value))
}

/** Reciprocal of the plastic number, and its square: the R2 sequence's steps. */
const R2_A1 = 0.7548776662466927
const R2_A2 = 0.5698402909980532

const frac = (value: number) => value - Math.floor(value)

/**
 * The i-th point of a 2D R2 low-discrepancy sequence, offset by the seed.
 *
 * Chosen over successive random draws because it is indexed rather than
 * streamed: point `i` does not depend on how many points were asked for. Raising
 * the strand count therefore adds strands instead of reshuffling the ones already on
 * screen. It also spreads far more evenly than uniform random, so anchors do not
 * clump into accidental pairs.
 */
export function r2Point(index: number, offsetU: number, offsetV: number): [number, number] {
  return [frac(offsetU + R2_A1 * (index + 1)), frac(offsetV + R2_A2 * (index + 1))]
}

/** Maps the unit square onto a disc of the given radius, preserving even area. */
export function discPoint(u: number, v: number, radius: number): [number, number] {
  const r = radius * Math.sqrt(u)
  const theta = 2 * Math.PI * v
  return [r * Math.cos(theta), r * Math.sin(theta)]
}
