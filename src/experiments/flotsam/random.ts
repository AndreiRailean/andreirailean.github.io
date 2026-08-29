/**
 * Seeded randomness.
 *
 * The second copy of this in the section — Dangler has the first. ADR-0002
 * defers extracting anything shared until a second *and* a third experiment
 * want it, and Starry Night wants none of it, so this is still the second
 * data point rather than the third. Fix a bug here and in Dangler's copy both.
 *
 * Trimmed rather than copied verbatim: this piece scatters nothing over a disc
 * and wants no low-discrepancy sequence, so `discPoint` and `r2Point` are
 * absent — see `homeFor` for why the second of those was removed after being
 * tried. What survives is the part both pieces need for the same reason —
 * *stability*. Speck 7 must draw the same size, colour and home whether the
 * scene holds a hundred specks or nine thousand, which is why everything here is
 * reached through `hashSeed(seed, index)` rather than pulled from one shared
 * stream.
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
 * Salts keep independent uses of one seed from correlating: a speck's size and
 * a speck's colour draw from separately salted generators, so widening the
 * colour spread cannot quietly resize anything.
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
 * The clamp is not tidiness. Colour spread is a σ in degrees, and an unclamped
 * 4σ outlier at σ=60 puts a speck 240° from the base hue — one dot of an
 * entirely wrong colour, appearing at random, which reads as a bug rather than
 * as variation.
 */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), Number.EPSILON)
  const v = rng()
  const value = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.max(-2.5, Math.min(2.5, value))
}

/**
 * Where speck `i` starts, as a fraction of the patch.
 *
 * Uniform random, indexed by `i` rather than streamed, which is what keeps
 * raising the count from restirring the water: speck seven has the same home
 * whether there are a hundred pieces or nine thousand.
 *
 * **Deliberately not a low-discrepancy sequence, which is what this was first.**
 * Dangler scatters its anchors with an R2 sequence because eighty anchors drawn
 * uniformly clump into accidental pairs, and the same argument was made here and
 * was wrong: at the counts this piece runs — thousands, drawn a pixel or two
 * across — R2's evenness is not invisible order, it is a *visible lattice*, and
 * the picture comes out ruled with faint diagonal lines nobody put there. It is
 * the same failure as Dangler's arms clumping, in the opposite direction, and it
 * costs the piece the one thing it is for: every structure on the water has to
 * be the waves' doing, and a lattice is structure the scatter brought with it.
 *
 * A uniform scatter also gives the `dispersion` statistic its canonical
 * baseline. Poisson noise disperses at exactly 1, so "above 1" means gathered
 * and nothing else — where against an R2 start the reading was a number between
 * two figures that both needed explaining.
 */
export function homeFor(seed: number, index: number): [number, number] {
  const rng = makeRng(hashSeed(seed, index))
  return [rng(), rng()]
}
