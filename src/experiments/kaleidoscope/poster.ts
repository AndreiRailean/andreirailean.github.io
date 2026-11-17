import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/kaleidoscope/runner"

/**
 * What Kaleidoscope looks like when somebody should want to click it.
 *
 * The figure starts nearly empty and its families are born across the first
 * seconds, so hold the clock and grow a minute of it first.
 *
 * The primary rolls its seed, so the poster pins one.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — what a bare address lands on.
  settings: { seed: 2 },
  prepare: ({ api }) => {
    api.pause(true)
    api.clear()
    // Under each-root renewal the figure is never finished; a minute in, every
    // family has been born and the oldest are on their second life.
    api.settle(60)
  },
  // The clock is held, so waiting changes nothing but the chrome, which takes
  // `--ui-fade` to leave.
  dwellMs: 800,
}

export default poster
