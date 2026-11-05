import type { PosterRecipe } from "@/experiments/poster"
import type { ExperimentApi } from "@/experiments/hexgrid/runner"

/**
 * What Hexgrid looks like when somebody should want to click it.
 *
 * A cycle starts from outlines only, so a bare capture is a black grid. And
 * with a wave fade there is no moment when every hex is lit: colour travels
 * out as a band. So hold the clock, walk the first cycle in tenths of a second,
 * and go back to whichever moment had the most colour on screen.
 */
const poster: PosterRecipe<ExperimentApi> = {
  // No preset named, so it captures the primary — what a bare address lands on.
  settings: {},
  prepare: ({ api }) => {
    api.pause(true)
    api.clear()
    const { period } = api.stats().loop
    // How far apart the search looks, in seconds of loop. It was a tenth,
    // which on the primary's 15.8 s loop is 158 settles, each one drawn, and
    // 1.3 s on the preview box, against the 600 ms the index allows a plate
    // (../docs/adr/20261102-the-index-draws-its-plates.md). The brightness
    // holds near its peak for seconds at a time, about 0.9 lit from 7 s to
    // 9.5 s on the primary, so half a second finds a moment as lit at a fifth
    // of the cost. Jumping to the moment found costs 5 ms; the search was the
    // whole price. Declared in here because the capture serialises this
    // function into the page, and nothing from the module goes with it.
    const stride = 0.5
    let best = { at: 0, lit: -1 }
    for (let at = 0; at < period - stride; at += stride) {
      api.settle(at === 0 ? 0 : stride)
      const { lit } = api.stats()
      if (lit > best.lit) best = { at, lit }
    }
    api.clear()
    api.settle(best.at)
  },
  // The clock is held, so waiting changes nothing but the chrome, which takes
  // `--ui-fade` to leave: at 0 its labels were still ghosted into the capture.
  dwellMs: 800,
}

export default poster
