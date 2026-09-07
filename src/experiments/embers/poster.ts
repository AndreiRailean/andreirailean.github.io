import type { ExperimentApi } from "@/experiments/embers/api"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Embers looks like when somebody should want to click it.
 *
 * **The scene does not exist at t=0.** An ember takes a second or two to cross
 * the frame, so frame one is a fire that has just been lit and a picture with
 * almost nothing in it. `settle` runs it forward.
 *
 * It used to also have to warn that the picture *accumulated*, and that a
 * fast-forward drawing only its final frame would land on a fire with no tails.
 * That is gone: the tail is drawn from the path each ember remembers, so a frame
 * is a frame and a settled fire photographs like a running one.
 *
 * **It is still not reproducible**, for a reason the piece cannot fix and should
 * not: a fire is a continuous emission with no arrangement to seed. Two captures
 * are two different minutes of the same fire. Hence a few tries and the
 * brightest kept — a shutter that lands between bursts catches a thinner column
 * than the summary promises, which is nothing wrong with that frame, just not
 * the one worth hanging.
 */
const poster: PosterRecipe<ExperimentApi> = {
  preset: "wide hearth",

  /**
   * The primary, wound up a little — and no longer re-framed.
   *
   * This used to override `span`, because the primary was a narrow fire and a
   * 16:9 still of a vertical column is mostly empty picture. The primary is now
   * a bed wider than the frame, which fills a wide still by itself, so the only
   * thing left to wind up is how busy the fire is: a shutter catching a thin
   * moment reads as a sparse piece rather than as a quiet second of a busy one.
   */
  settings: { sputter: 1.6, bursts: 12, playback: 0.35 },

  dwellMs: 1_400,
  attempts: 8,
}

export default poster
