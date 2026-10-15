import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/artdeco/runner"

/**
 * What Art Deco looks like when somebody should want to click it.
 *
 * A drawing starts as one short line at the bottom, so a bare capture is
 * nearly empty. Hold the clock and grow the first drawing until every tip has
 * stopped: the moment it holds is the whole drawing, before it undraws.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — what a bare address lands on.
  settings: {},
  prepare: ({ api }) => {
    api.pause(true)
    api.clear()
    for (let t = 0; t < 120 && api.stats().phase === "growing"; t += 0.5) api.settle(0.5)
  },
  // The clock is held, so waiting changes nothing but the chrome, which takes
  // `--ui-fade` to leave.
  dwellMs: 800,
}

export default poster
