import type { ExperimentApi } from "@/experiments/crowd/runner"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Crowd looks like when somebody should want to click it: its first frame.
 *
 * **This recipe used to settle forty-five seconds**, on the reasoning that a cold
 * start is "a square before the square happens": nobody has negotiated a
 * crossing, no files have formed, and the observer has not started walking. All
 * of that is true of the motion and none of it shows in a still. Compared side
 * by side at plate size, the first frame and the settled one read as the same
 * square. People on the horizon, a few near enough to be large.
 *
 * And the recipe has a second reader now. The index draws each plate live in a
 * few hundred milliseconds or falls back to this poster
 * (`../docs/adr/20261102-the-index-draws-its-plates.md`), and a second of this
 * crowd costs about 650 ms to simulate at plate size, so forty-five of them
 * kept the plate on its poster for good. The first frame takes 176 ms.
 *
 * **It names no preset**: the poster is one of the surfaces that read the
 * primary, so promoting a scene to first moves the index card with it. The
 * primary names no seed, so each capture, like each plate, is a different
 * square.
 */
const poster: PosterRecipe<ExperimentApi> = {
  dwellMs: 0,
}

export default poster
