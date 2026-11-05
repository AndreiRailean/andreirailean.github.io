import type { ExperimentApi } from "@/experiments/melting/runner"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Melting looks like when somebody should want to click it: the lamp as it
 * is right now.
 *
 * **The lamp is a function of its seed and the moment.** This recipe used to
 * `goto` one moment, picked by eye, so every capture was the same picture. Since
 * 2026-11-06 the plates on the index are meant to differ from load to load
 * (`../docs/adr/20261106-a-preset-names-a-look-not-an-arrangement.md`), and
 * this piece's presets keep their seed, because two screens showing the same
 * lamp is its premise. So the variety here is the moment: the plate holds
 * whatever the wall clock says when it is drawn, with nothing to settle.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — which is what a bare address
  // lands on, and therefore what the plate is promising.
  settings: {},
  prepare: ({ api }) => {
    api.pause(true)
  },
  // The clock is held, so waiting changes nothing but the chrome, which pausing
  // brings back and which takes `--ui-fade` to leave again — hexgrid's lesson.
  dwellMs: 800,
}

export default poster
