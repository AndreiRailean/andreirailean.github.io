import type { ExperimentApi } from "@/experiments/crowd/api"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Crowd looks like when somebody should want to click it.
 *
 * A cold start is a crowd that has been placed and has not yet done anything:
 * nobody has negotiated a crossing, no files have formed, no group has been
 * squeezed through a gap, and the observer is standing still because their first
 * stretch of walking has not begun. It is a picture of a square before the
 * square happens, and dwelling in the capture script cannot fix it at a sensible
 * cost because dwelling is wall-clock and this needs a minute.
 *
 * `settle` is the piece's own verb for exactly that. Forty-five seconds puts the
 * observer forty metres into the walk — far enough that every person in
 * frame arrived through the boundary rather than being placed there — and gets
 * the crowd through one full turnover, which is the state the piece spends the
 * rest of its life in.
 *
 * **It names no preset**, which is the section's arrangement rather than an
 * omission: the poster is one of the three surfaces that read the primary, so
 * promoting a scene to first moves the index card with it.
 *
 * One shutter. Unlike Starry Night there is nothing transient worth hunting for
 * — the picture is a crowd rather than an event — and the seed in the primary
 * fixes which minute of which walk it is, so this recipe is as reproducible as
 * the section gets.
 *
 * **Forty-five seconds is about fifteen of wall clock**, which is affordable
 * here and is not affordable on a page load — see `STILL_SECONDS` in `crowd.ts`
 * and the backdrop in the note's page, both of which want the same thing and
 * cannot pay for it.
 */
const poster: PosterRecipe<ExperimentApi> = {
  prepare: ({ api }) => {
    api.settle(45)
  },

  // Nothing to wait for once it has settled: the walk is established and the
  // next frame looks like this one.
  dwellMs: 0,
}

export default poster
