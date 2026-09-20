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
 * **The picture does not accumulate**, so no frames have to be drawn into it —
 * `trail` is 0 in the primary and every circle is drawn whole each frame. If a
 * scene with a wake is ever promoted to first, this recipe has to say how many
 * frames, and the note's backdrop and the reduced-motion still fall into it
 * together.
 *
 * **It is not reproducible**, for a reason the piece cannot fix and should not:
 * the seed fixes where the jets are and which way they turn, and nothing else.
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
