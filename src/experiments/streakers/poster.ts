import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/streakers/runner"

/**
 * What Streakers looks like when somebody should want to click it.
 *
 * Nothing to wait for: a scene is built already full, every line back-filled
 * with the dots it would hold after one crossing, so the first frame is the
 * steady state. One short dwell lets the boot settle; no `settle` is needed.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — what a bare address lands on.
  settings: {},
  dwellMs: 1_000,
}

export default poster
