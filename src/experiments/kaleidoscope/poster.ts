import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/kaleidoscope/runner"

/**
 * What Kaleidoscope looks like when somebody should want to click it.
 *
 * A drawing starts as a point at the centre, so a bare capture is empty. Hold
 * the clock and grow the first drawing until every tip has stopped: the moment
 * it holds is the whole drawing, before it undraws.
 *
 * The primary rolls its seed, so the poster pins one: seed 2 grew 80 lines in
 * the segment when measured, where the thinnest of six seeds grew 42.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — what a bare address lands on.
  settings: { seed: 2 },
  prepare: ({ api }) => {
    api.pause(true)
    api.clear()
    for (let t = 0; t < 200 && api.stats().phase === "grow"; t += 0.5) api.settle(0.5)
  },
  // The clock is held, so waiting changes nothing but the chrome, which takes
  // `--ui-fade` to leave.
  dwellMs: 800,
}

export default poster
