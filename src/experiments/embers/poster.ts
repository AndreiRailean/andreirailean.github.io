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
  preset: "winter blues",

  /**
   * The primary, with only its events wound up.
   *
   * This used to override `span` and `sputter`, and both had gone stale: it
   * re-framed because an older primary was a narrow fire and a 16:9 still of a
   * vertical column is mostly empty picture, and it *lowered* sputter from a
   * value tuned for a different scene while the comment claimed to be raising
   * it. Every primary since has been a bed wider than the frame, which fills a
   * wide still by itself, and `winter blues` is already busy.
   *
   * So the only thing left to ask for is more of what a single frame is least
   * likely to catch. A shutter landing between bursts photographs a quiet second
   * of a lively piece, which is nothing wrong with that second — just not the
   * one worth hanging.
   */
  settings: { bursts: 12 },

  // Wider sampling than a piece with a fixed arrangement needs, and for a
  // reason particular to a windy scene: the crosswind wanders on its own slow
  // clock, so eight frames 1.4 s apart all land inside one phase of it and can
  // all be lopsided the same way. Ten frames 2.2 s apart covers twenty-two
  // seconds and gets a choice.
  dwellMs: 2_200,
  attempts: 10,
}

export default poster
