import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/psyxels/runner"

/**
 * What Psyxels looks like when someone should want to click it: its first
 * frame, which is what the landing page opens on.
 *
 * **This recipe used to run ninety seconds**, so that the field had repacked a
 * dozen times and the psyxels were spread across their own cycles rather than
 * sharing one. That is true of the motion, and at plate size the two frames
 * read as the same word. Andrei: "psyxels loads first preset right away. i
 * don't see why we need 90s." The index draws each plate live or falls back to
 * this poster (`../docs/adr/20261102-the-index-draws-its-plates.md`), and the
 * run was most of the plate's cost.
 *
 * No preset named, deliberately, and for the reason Dangler's and Flotsam's
 * recipes give: a bare URL lands on the first preset, so opening the piece and
 * photographing it are the same act and the poster cannot come to show a scene
 * the landing page does not.
 *
 * Not byte-reproducible even though the field is: `run()` steps a fixed number
 * of times from a fixed seed and puts every psyx in the same place, but the
 * frame is caught at whatever point the breathing has reached, and the breath is
 * read off the same clock. Two captures differ by a shade rather than by a
 * picture, and both churn the file — which is what the slug filter on
 * `pnpm run posters` is for.
 */
const poster: PosterRecipe<ExperimentApi> = {
  /**
   * Half a second, and not for the piece's sake. It is for the *chrome*: the
   * capture pins the piece idle, and the bar fades out over `--ui-fade`, so a
   * shutter firing at once catches the controls half gone. The first capture
   * here had a ghost of the preset bar lying across the bottom of the letter.
   * The index ignores it, since this piece has no `settle` to spend it on.
   */
  dwellMs: 500,

  /**
   * And the brightest of several, because a fresh field breathes in unison:
   * every psyx is the same age, so the whole word dims and brightens together.
   * One shutter half a second in caught a trough, dimmer than the plate the
   * index draws a few frames after the start, near full breath. Six shots three
   * seconds wide cover a breath.
   */
  attempts: 6,
}

export default poster
