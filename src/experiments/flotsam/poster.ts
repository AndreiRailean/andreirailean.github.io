import type { ExperimentApi } from "@/experiments/flotsam/runner"
import type { PosterRecipe } from "@/experiments/poster"

/**
 * What Flotsam looks like when someone should want to click it: its first
 * frame.
 *
 * **This recipe used to run forty seconds**, on the claim that frame one is a
 * uniform scatter of specks. It is not. The specks' *homes* are uniform, and
 * that is where the piece starts, but a speck is drawn where the waves have
 * displaced it from its home, so the lines the waves gather it into are there
 * in the first frame. What forty seconds added was drift: the current carrying
 * those lines somewhere else, which in a still is just a different place for
 * them. Compared side by side at plate size, the two read as the same sea.
 *
 * And the recipe has a second reader now. The index draws each plate live in a
 * few hundred milliseconds or falls back to this poster
 * (`../docs/adr/20261102-the-index-draws-its-plates.md`), and forty seconds of
 * this sea cost about four. The first frame takes 219 ms.
 *
 * No preset named, deliberately, and for the reason Dangler's recipe gives: a
 * bare URL lands on the first preset, so opening the piece and photographing it
 * are the same act.
 *
 * Not byte-reproducible. The sprites' gradients are dithered with
 * `Math.random` to break the banding an eight-bit ramp would otherwise show,
 * which is invisible to a person and enough to churn the file. That is what
 * the slug filter on `pnpm run posters` is for.
 */
const poster: PosterRecipe<ExperimentApi> = {
  dwellMs: 0,
}

export default poster
