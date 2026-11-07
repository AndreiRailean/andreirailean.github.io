import type { ExperimentApi } from "@/experiments/walkers/runner"
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
 * without drawing it, walking the last stretch over the trail as well, so a
 * primary whose whole picture is where people have been arrives with ground
 * that has been crossed — see `TRACE_WARM` in `walkers.ts`.
 *
 * **Half a second, not two minutes.** This recipe used to settle 120 s, the
 * population at its target and the picnickers down, and the index could not
 * draw that: its plate is drawn live in a few hundred milliseconds or falls
 * back to this poster (`../docs/adr/20261102-the-index-draws-its-plates.md`),
 * and a second of this crowd costs about 600 ms on a box with no GPU, almost
 * all of it stepping 600-odd people rather than painting their trail. Andrei:
 * "there's enough to freeze on walkers within a second of opening it. may not
 * be as built-up as the current poster, but if the poster is allowed to do its
 * regular cycling it will eventually build up." Half a second draws strokes
 * rather than dots, and the plate takes about 500 ms; a whole second is
 * clearer still and comes to 800–1000 ms there, over the budget, which would
 * turn every plate after it into a poster. The ground builds as the plate is
 * woken, and keeps what it built, since a plate is paused rather than torn
 * down.
 *
 * **It names no preset**, which is the section's arrangement rather than an
 * omission: the poster is one of the three surfaces that read the primary, so
 * promoting a scene to first moves the index card with it. See `../AGENTS.md`
 * on position one.
 *
 * One shutter, not several. Unlike Starry Night there is nothing transient worth
 * hunting for — the picture is a crowd rather than an event, and every frame two
 * minutes in is as good as every other. What varies between captures is which
 * particular afternoon the seed and the settle produce, and the seed is rolled
 * on every load since presets stopped pinning one, so no two captures match.
 */
const poster: PosterRecipe<ExperimentApi> = {
  prepare: ({ api }) => {
    api.settle(0.5)
  },

  // Settled already: a wait would only add wall-clock time to the capture.
  dwellMs: 0,
}

export default poster
