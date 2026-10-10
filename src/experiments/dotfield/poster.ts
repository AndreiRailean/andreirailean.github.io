import type { ExperimentApi } from "@/experiments/dotfield/runner"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Dotfield looks like when somebody should want to click it.
 *
 * Every column starts where the wind already has it, so the first frame is
 * representative. A couple of seconds lets the first gusts arrive.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — what a bare address lands on.
  settings: {},
  dwellMs: 2_000,
}

export default poster
