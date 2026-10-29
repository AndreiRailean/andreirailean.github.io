import type { ExperimentApi } from "@/experiments/melting/runner"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Melting looks like when somebody should want to click it.
 *
 * **The lamp is a function of its seed and the moment**, so a fixed moment
 * makes the poster reproducible: the primary carries a seed, and `goto` puts
 * the lamp at one moment and draws it there whole, with nothing to settle.
 * Without it every capture would be whatever minute the shutter landed in.
 *
 * The moment, written inline because `prepare` runs in the page and closes
 * over nothing, was picked by eye from a handful of candidates.
 */

const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — which is what a bare address
  // lands on, and therefore what the plate is promising.
  settings: {},
  prepare: ({ api }) => {
    api.pause(true)
    api.goto(1_800_000_101)
  },
  // The clock is held, so waiting changes nothing but the chrome, which pausing
  // brings back and which takes `--ui-fade` to leave again — hexgrid's lesson.
  dwellMs: 800,
}

export default poster
