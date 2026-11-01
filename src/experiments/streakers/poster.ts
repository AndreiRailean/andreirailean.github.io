import type { PosterRecipe } from "@/experiments/poster"
// Relative, because `pnpm run posters` imports this under plain node, which
// erases type imports but cannot resolve the `@/` alias for a value.
import { PRESETS } from "./presets.ts"
import type { ExperimentApi } from "@/experiments/streakers/runner"

/**
 * What Streakers looks like when somebody should want to click it.
 *
 * Nothing to wait for: a scene is built already full, every line back-filled
 * with the dots it would hold after one crossing, so the first frame is the
 * steady state. One short dwell lets the boot settle; no `settle` is needed.
 */

/**
 * The primary as it looked in the poster's old 1024px frame, drawn in the
 * plate's 608px one.
 *
 * Streakers keeps the same number of lines whatever the frame, and sizes its
 * dots and the gaps between them in css px. When posters moved to the plate's
 * size (#341), its 420 lines packed 1.7× closer and the dots stopped being
 * shrunk to 0.6×, and Andrei found it "a little dense … it used to have smaller
 * dots". So the poster scales the primary by the same 0.6 instead, all of it
 * by length. The line count too, which looks as if it should go by area and
 * does not: a line crosses the whole frame, so how close lines sit is their
 * number over the frame's width, and the first capture scaled by area came out
 * visibly sparser than the old poster.
 */
const SHRINK = 608 / 1024
const primary = PRESETS[0]!.settings

const poster: PosterRecipe<ExperimentApi> = {
  settings: {
    emitters: Math.round(primary.emitters * SHRINK),
    gap: Math.round(primary.gap * SHRINK),
    size: Math.round(primary.size * SHRINK * 10) / 10,
  },
  dwellMs: 1_000,
}

export default poster
