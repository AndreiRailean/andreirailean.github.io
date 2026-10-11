import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/hexgrid/runner"

/**
 * What Hexgrid looks like when somebody should want to click it.
 *
 * A cycle starts from outlines only, so a bare capture is a black grid. And
 * with a wave fade there is no moment when every hex is lit: colour travels
 * out as a band. So hold the clock, walk the first cycle in tenths of a second,
 * and go back to whichever moment had the most colour on screen.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — what a bare address lands on.
  settings: {},
  prepare: ({ api }) => {
    api.pause(true)
    api.clear()
    const { period } = api.stats().loop
    let best = { at: 0, lit: -1 }
    for (let at = 0; at < period - 0.1; at += 0.1) {
      api.settle(at === 0 ? 0 : 0.1)
      const { lit } = api.stats()
      if (lit > best.lit) best = { at, lit }
    }
    api.clear()
    api.settle(best.at)
  },
  // The clock is held, so waiting changes nothing but the chrome, which takes
  // `--ui-fade` to leave: at 0 its labels were still ghosted into the capture.
  dwellMs: 800,
}

export default poster
