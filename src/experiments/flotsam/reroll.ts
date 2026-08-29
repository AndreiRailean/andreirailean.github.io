import type { Controls } from "@/experiments/kit/controls"
import { normalizeSettings, SEED_BOUNDS, type Settings } from "@/experiments/flotsam/settings"

/**
 * A fresh sea and a fresh scattering.
 *
 * The seed decides three separate things here — the phases and directions of
 * the wave trains, the shape of the eddy field, and every piece's size, colour
 * and home — so a re-roll is a genuinely different stretch of water at the same
 * settings, rather than the same water shuffled.
 *
 * Lives beside the piece rather than in the kit because it is the piece's, the
 * same way Dangler's is. The bar button and the console API both call this, so
 * they cannot come to mean different things.
 */
export function reroll(controls: Controls<Settings>, seed?: number): number {
  const next = seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1))
  controls.apply(normalizeSettings({ ...controls.getSettings(), seed: next }))
  return controls.getSettings().seed
}
