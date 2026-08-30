/**
 * Where a speck starts: Flotsam's own placement strategy.
 *
 * The generators this is built on — `hashSeed` and `makeRng` — moved to
 * `../random.ts` when a third piece wanted them; see
 * `../docs/adr/20260829-a-third-copy-of-the-generators-moves-to-the-section.md`.
 * `homeFor` stayed, because a placement strategy is a choice about a scale and
 * the choice below is the one this piece's counts forced —
 * `../docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`.
 */

import { hashSeed, makeRng } from "@/experiments/random"

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
