import type { ExperimentApi } from "@/experiments/bubbles/api"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Bubbles looks like when somebody should want to click it.
 *
 * **The scene does not exist at t=0, and here that is not a detail.** The
 * surface starts empty and the only way a bubble gets bigger is by meeting
 * another one, so the size range the settings describe is *earned* over about
 * half a minute of jets. A shutter at frame one photographs black; one at five
 * seconds photographs a tub of identical specks, which is a true picture of this
 * piece at five seconds and a false one of the piece. `settle` is what makes it
 * the piece.
 *
 * **The picture accumulates now, and that warning came due.** This docblock used
 * to say it did not, and that the day a scene with a wake was promoted to first
 * the recipe would have to say how many frames. `time bubbles` has `trail` at
 * 0.35, so the streaks are a rendering artefact built up frame by frame rather
 * than simulation state: stepping the water forward and drawing once gives a
 * frame with no wake in it at all.
 *
 * The fix is in the piece rather than here, because all three surfaces that
 * arrive somewhere without watching it happen fall into it together — this
 * poster, the note's backdrop and the reduced-motion still. `settle` now draws
 * its last `WAKE_FRAMES` frames instead of stepping past them, so every one of
 * them gets a wake without having to remember to ask.
 *
 * **It is not reproducible**, for a reason the piece cannot fix and should not:
 * the seed fixes where the jets are, which way they turn and which eddies the
 * background is made of, and nothing else.
 * Every bubble after that is drawn from a stream that has been running since the
 * page loaded. Two captures are two different minutes of the same tub — hence a
 * few tries, since coalescence is bursty and a shutter can land in a quiet
 * second.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — which is what a bare address
  // lands on, and therefore what the plate is promising.
  settings: {},

  // Long dwells, because what makes a frame worth hanging here is a few large
  // bubbles, and those take tens of seconds to build and about a second to
  // burst. Frames closer together than this are all from the same population
  // and offer no real choice between them.
  dwellMs: 4_000,
  attempts: 8,
}

export default poster
