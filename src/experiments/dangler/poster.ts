import type { ExperimentApi } from "@/experiments/dangler/api"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Dangler looks like when someone should want to click it.
 *
 * The moment matters here more than anywhere. `api.settle()` exists because a
 * screenshot taken while the strands are still relaxing shows a shape the piece
 * never actually holds, and nothing about the image says so — a poster that
 * skipped it would be a picture of a scene halfway through falling.
 *
 * `dreamy` carries its own `seed`, so this is reproducible without inventing a
 * poster-only one: the same preset settles to the same arrangement every run.
 */
const poster: PosterRecipe<ExperimentApi> = {
  preset: "dreamy",

  prepare: ({ api }) => {
    // Twice, deliberately. The first pass converges the solver from the layout;
    // the second runs it again from rest, which is where the strands stop
    // drifting between frames and the still stops depending on when it fired.
    api.settle()
    api.settle()
  },

  // No dwell. Once settled the scene is only breathing on the breeze, and
  // waiting would pick a different point in the same sway for no gain.
  dwellMs: 0,
}

export default poster
