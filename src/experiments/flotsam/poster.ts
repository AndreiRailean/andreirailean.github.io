import type { ExperimentApi } from "@/experiments/flotsam/api"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Flotsam looks like when someone should want to click it.
 *
 * The moment is the whole recipe. Frame one is a *uniform* scatter of specks —
 * the homes are drawn uniformly and nothing has happened to them yet — which is
 * a picture of the piece before it has done the only thing it does. The
 * gathering takes a wave period or two to establish, and the drift a good deal
 * longer. So the shutter waits, and `api.run()` is how it waits without a
 * capture taking half a minute.
 *
 * Forty seconds, which is about five periods of the longest train in the landing
 * scene. Long enough for the flotsam to have collected into lines and for the
 * current to have carried them somewhere; not so long that the reader is looking
 * at a different scene from the one the page opens on.
 *
 * No preset named, deliberately, and for the reason Dangler's recipe gives: a
 * bare URL lands on the first preset, so opening the piece and photographing it
 * are the same act and the poster cannot come to show a scene the landing page
 * does not. Naming it here would be a second place to change, and the one that
 * gets forgotten.
 *
 * Not byte-reproducible, although everything about the sea is. The seed fixes
 * the wave phases, the eddy field and every speck, and `run()` steps a fixed
 * number of times — so two captures put the same flotsam in the same places. The
 * sprites do not: their gradients are dithered with `Math.random` to break the
 * banding an eight-bit ramp would otherwise show, which moves every alpha by up
 * to half a level. Invisible to a person, and enough to churn the file, which is
 * what the slug filter on `npm run posters` is for.
 */
const poster: PosterRecipe<ExperimentApi> = {
  prepare: ({ api }) => api.run(40),

  // No dwell. `run` has already put the sea where it should be, and waiting
  // would only pick a different point in the same motion at the cost of a
  // slower capture.
  dwellMs: 0,
}

export default poster
