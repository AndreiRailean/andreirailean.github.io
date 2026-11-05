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
 * **The primary is `standing still` because of this recipe's second reader.**
 * The index draws each plate live in a few hundred milliseconds or falls back
 * to this poster (`../docs/adr/20261102-the-index-draws-its-plates.md`), and
 * `time bubbles`, the primary before it, could not be drawn in that time: its
 * pool is full within a second, so every second of its water costs about
 * 830 ms at plate size, and the bright rim its poster showed gathers over about
 * thirty. `standing still` keeps a smaller foam in a frozen background flow,
 * filled in after about eight seconds, and `warm` gets there in about 220 ms.
 * Andrei suggested it for exactly this, because "it appears to have a stable
 * steady state", and then promoted it so the plate shows where its link lands.
 *
 * **`warm` rather than `settle`**, so the capture and the plate take the same
 * route to the same moment. See `WARM_STEP` in `bubbles.ts` for what its
 * coarser step costs in accuracy, which is about a fifth of the foam.
 *
 * **One shot.** A settled `standing still` changes slowly, so frames further
 * apart offer no real choice between them. Not reproducible: the primary names
 * no seed, so where the jets sit and which eddies the background is made of
 * are rolled on every load.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary, which is what a bare address
  // lands on and therefore what the plate is promising.
  prepare: ({ api }) => api.warm(8),
}

export default poster
