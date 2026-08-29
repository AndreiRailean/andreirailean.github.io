import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/psyxels/api"

/**
 * What Psyxels looks like when someone should want to click it.
 *
 * Frame one is a field that has never repacked: every pixel is the size the
 * seed first gave it, every pixel is at the same age, and the arrival ease has
 * them all at the same brightness. That is a picture of the packing, which is
 * half the piece, and it is missing the half that moves.
 *
 * Ninety seconds is a dozen or so size changes per square at the landing scene's
 * churn — long enough that the field on the poster is one the seed alone would
 * never have produced, and that the pixels are spread across their own cycles
 * rather than sharing one.
 *
 * No preset named, deliberately, and for the reason Dangler's and Flotsam's
 * recipes give: a bare URL lands on the first preset, so opening the piece and
 * photographing it are the same act and the poster cannot come to show a scene
 * the landing page does not.
 *
 * Not byte-reproducible even though the field is: `run()` steps a fixed number
 * of times from a fixed seed and puts every pixel in the same place, but the
 * frame is caught at whatever point the breathing has reached, and the breath is
 * read off the same clock. Two captures differ by a shade rather than by a
 * picture, and both churn the file — which is what the slug filter on
 * `npm run posters` is for.
 */
const poster: PosterRecipe<ExperimentApi> = {
  prepare: ({ api }) => api.run(90),

  /**
   * Half a second, and not for the piece's sake — `run()` has already put the
   * field where it should be.
   *
   * It is for the *chrome*. The capture pins the piece idle before the recipe
   * runs, and the bar fades out over `--ui-fade`; `run()` then blocks the main
   * thread for about as long as that fade, so a shutter firing the instant it
   * returns catches the controls half gone. The first capture here had a ghost
   * of the preset bar lying across the bottom of the letter.
   */
  dwellMs: 500,
}

export default poster
