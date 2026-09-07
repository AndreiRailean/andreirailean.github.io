import type { ExperimentApi } from "@/experiments/embers/api"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Embers looks like when somebody should want to click it.
 *
 * Two things about this piece make its recipe unlike the others':
 *
 * **The scene does not exist at t=0.** An ember takes a second or two to cross
 * the frame, so frame one is a fire that has just been lit and a picture with
 * almost nothing in it. `settle` runs it forward.
 *
 * **The picture accumulates.** Every preset has `trail` above zero, so what is
 * on the glass is built out of the last couple of dozen frames rather than being
 * a function of the current state — which means a fast-forward that draws only
 * its final frame lands on a fire with no trails at all. `settle` therefore
 * *draws* the last stretch of what it steps; see `embers.ts`. This is the same
 * trap Psyxels hit from the other side, and the three surfaces that fall into it
 * are the three that ask the piece to arrive somewhere without watching it get
 * there: this poster, the note's backdrop, and the reduced-motion still.
 *
 * **And it is not reproducible**, for a reason the piece cannot fix and should
 * not: a fire is a continuous emission with no arrangement to seed. Two captures
 * are two different minutes of the same fire. Hence a few tries and the
 * brightest kept — a shutter that lands between bursts catches a thinner column
 * than the summary promises, which is nothing wrong with that frame, just not
 * the one worth hanging.
 */
const poster: PosterRecipe<ExperimentApi> = {
  preset: "campfire",

  async prepare({ api }) {
    // Long enough for embers to have reached the top of the frame and for two
    // or three bursts to have gone through at six a minute.
    api.settle(30)
  },

  dwellMs: 1_400,
  attempts: 8,
}

export default poster
