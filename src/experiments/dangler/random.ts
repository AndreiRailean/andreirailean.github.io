/**
 * Where an anchor goes: Dangler's own placement strategy.
 *
 * The generators everything here is built on — `hashSeed`, `makeRng`, `gaussian`
 * — moved to `../random.ts` when a third piece wanted them; see
 * `../docs/adr/20260829-a-third-copy-of-the-generators-moves-to-the-section.md`.
 * What stayed is what is *this piece's choice about this piece's scale*, and it
 * stayed for the reason in
 * `../docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`: an R2
 * sequence is right for eighty anchors and comes out as a visible lattice at
 * nine thousand specks, so it must not travel to the next piece by being
 * somewhere convenient.
 *
 * The important property remains *stability*: anchor 7 sits in the same place
 * whether the scene holds eight strands or eighty, which is why these are
 * indexed by `i` rather than pulled from a stream.
 */

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
