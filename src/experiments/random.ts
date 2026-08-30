/**
 * Seeded randomness: a mixer, a generator, and a normal draw.
 *
 * **In the kit because a third piece wanted it**, which is the only condition
 * the section allows a thing to be hoisted on — ADR-0002 as narrowed by
 * `../docs/adr/20260828-the-piece-is-independent-the-gallery-is-not`, and
 * applied once already to `wakelock.ts` in
 * `../docs/adr/20260829-the-third-copy-moves-to-the-kit.md`. Dangler and Flotsam
 * carried byte-identical copies of everything below; Psyxels would have been the
 * third.
 *
 * What is here is only the part all three want, and they want it for the same
 * reason — *stability*. Strand 7, speck 7 and the cell at (3, 5) must draw the
 * same numbers whatever else the scene holds, which is why every caller derives
 * a private generator from `hashSeed(seed, …salts)` rather than pulling from one
 * shared stream.
 *
 * What is **not** here is every placement strategy built on top of it: Dangler's
 * `r2Point` and `discPoint`, Flotsam's `homeFor`. Those stay with their pieces,
 * because a placement strategy is a choice about a scale and does not travel —
 * see `../docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`, where
 * copying one from an eighty-anchor canopy to a nine-thousand-speck sea laid a
 * visible lattice across the water.
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
 * Salts keep independent uses of one seed from correlating: a thing's shape and
 * its colour draw from separately salted generators, so widening the hue spread
 * cannot quietly move anything.
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
 * The clamp is not tidiness. Hue spread is a σ in degrees in all three pieces,
 * and an unclamped 4σ outlier at σ=60 puts one thing 240° from the base hue —
 * a single element of an entirely wrong colour, appearing at random, which reads
 * as a bug rather than as variation.
 */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), Number.EPSILON)
  const v = rng()
  const value = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.max(-2.5, Math.min(2.5, value))
}
