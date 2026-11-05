import type { ExperimentApi } from "@/experiments/bubbles/runner"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Bubbles looks like when somebody should want to click it.
 *
 * **The scene does not exist at t=0, and here that is not a detail.** The
 * surface starts empty and the only way a bubble gets bigger is by meeting
 * another one, so the size range the settings describe is *earned*. A shutter at
 * frame one photographs black.
 *
 * **`standing still`, not the primary, and that is a trade.** This recipe has
 * two readers: the poster capture, and the index, which draws the plate live in
 * a few hundred milliseconds or falls back to this poster
 * (`../docs/adr/20261102-the-index-draws-its-plates.md`). The primary cannot be
 * drawn in that time. Its pool is full within a second, so every second of its
 * water costs about 830 ms at plate size, and the bright rim its poster used to
 * show gathers over about thirty seconds of it. `standing still` keeps a
 * smaller foam in a frozen background flow, filled in after about eight
 * seconds, and `warm` gets there in about 220 ms. Andrei suggested it for
 * exactly this, because "it appears to have a stable steady state".
 *
 * **`warm` rather than `settle`**, so the capture and the plate take the same
 * route to the same moment. See `WARM_STEP` in `bubbles.ts` for what its
 * coarser step costs in accuracy, which is about a fifth of the foam.
 *
 * **One shot.** The jets and the background are fixed by the preset's seed, and
 * a settled `standing still` changes slowly, so frames further apart offer no
 * real choice between them. Not reproducible all the same: every bubble is
 * drawn from a stream that has been running since the page loaded.
 */
const poster: PosterRecipe<ExperimentApi> = {
  preset: "standing still",
  prepare: ({ api }) => api.warm(8),
}

export default poster
