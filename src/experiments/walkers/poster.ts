import type { ExperimentApi } from "@/experiments/walkers/api"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Walkers looks like when somebody should want to click it.
 *
 * A cold start is an empty field. People arrive at a rate, groups take another
 * half-minute to reach the spots they are heading for, and the ones who are
 * going to sit down have not sat down yet — so frame one is a picture of a park
 * before the park happens, and no amount of dwelling in the capture script fixes
 * it at a sensible cost, because dwelling is wall-clock and this needs minutes.
 *
 * `settle` is the piece's own verb for exactly this: run the simulation forward
 * without drawing it. Two minutes gets the population to its target, the
 * picnickers onto the ground, and the crowd through one full turnover, which is
 * the state the piece spends the rest of its life in. The last stretch of it is
 * walked over the trail as well, so a primary whose whole picture is where
 * people have been arrives with a ground that has been crossed rather than a
 * clean one — see `TRACE_WARM` in `walkers.ts`, which exists because of this
 * recipe.
 *
 * **It names no preset**, which is the section's arrangement rather than an
 * omission: the poster is one of the three surfaces that read the primary, so
 * promoting a scene to first moves the index card with it. See `../AGENTS.md`
 * on position one.
 *
 * One shutter, not several. Unlike Starry Night there is nothing transient worth
 * hunting for — the picture is a crowd rather than an event, and every frame two
 * minutes in is as good as every other. What varies between captures is which
 * particular afternoon the seed and the settle produce; that is fixed by the
 * preset carrying a seed, so this recipe is as reproducible as the section gets.
 */
const poster: PosterRecipe<ExperimentApi> = {
  prepare: ({ api }) => {
    api.settle(120)
  },

  // Nothing to wait for once it is settled: the crowd is established and the
  // next frame looks like this one.
  dwellMs: 0,
}

export default poster
