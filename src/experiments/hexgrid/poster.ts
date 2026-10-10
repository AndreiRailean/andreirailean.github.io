import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/hexgrid/runner"

/**
 * What Hexgrid looks like when somebody should want to click it.
 *
 * The loop starts from outlines only, so a bare capture is a black grid. Hold
 * the clock and move it to the middle of the hold, where every hex has its
 * colour: the picture the piece keeps coming back to.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — what a bare address lands on.
  settings: {},
  prepare: ({ api }) => {
    api.pause(true)
    api.clear()
    const { loop } = api.stats()
    api.settle((loop.full + loop.fade) / 2)
  },
  // The clock is held, so waiting changes nothing but the chrome, which takes
  // `--ui-fade` to leave: at 0 its labels were still ghosted into the capture.
  dwellMs: 800,
}

export default poster
