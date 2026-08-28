import type { ExperimentApi } from "@/experiments/starry-night/api"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Starry Night looks like when someone should want to click it.
 *
 * Unlike Dangler, this piece needs no warming up. `rebuildLayers()` seeds every
 * layer with a staggered phase precisely so they do not all fade in together,
 * which means frame one already shows a sky mid-life rather than an empty one.
 * The instinct to "let it evolve first" is right for the other piece and wrong
 * for this one.
 *
 * The short dwell is not for the layers, then, but for the glimmers: they spawn
 * at a rate per second, so a shutter at t=0 catches a sky with none of the
 * flaring the summary promises.
 */
const poster: PosterRecipe<ExperimentApi> = {
  preset: "deep field",

  // Glimmers spawn at half a second's worth per second and are gone as fast, so
  // one shutter almost always catches a sky with none of the flaring the
  // summary promises. Twelve tries two seconds apart covers about half a minute
  // of sky and keeps the brightest of them.
  dwellMs: 2_000,
  attempts: 12,
}

export default poster
