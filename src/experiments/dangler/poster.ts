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
 * No preset named, deliberately. A bare URL now lands on the first preset — see
 * `settingsForLanding` — so opening the piece and photographing it is the same
 * act, and the poster cannot come to show a scene the landing page does not.
 * Naming it here would be a second place to change, and the one that gets
 * forgotten.
 *
 * Not byte-reproducible, despite the preset carrying a `seed`. The seed fixes
 * the *arrangement* — where the anchors sit, how each strand is shaped — and
 * that comes out the same every run. The sway does not: the wind is derived
 * from the clock as well as the seed, so the shutter catches the strands at a
 * different point in the same breeze. Two captures look alike to a person and
 * differ to `git`, which is the whole reason for the slug filter.
 */
const poster: PosterRecipe<ExperimentApi> = {
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
