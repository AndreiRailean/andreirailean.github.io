import type { Controls } from "@/experiments/kit/controls"
import { normalizeSettings, SEED_BOUNDS, type Settings } from "@/experiments/psyxels/settings"

/**
 * A fresh packing of the same picture.
 *
 * The seed decides every split that was not forced by detail, and every pixel's
 * frame, rate, phase and colour — so a re-roll is a genuinely different field
 * over an identical subject. The letter does not move; everything it is made of
 * does.
 *
 * Lives beside the piece rather than in the kit because it is the piece's, the
 * same way Dangler's and Flotsam's are. The bar button and the console API both
 * call this, so they cannot come to mean different things.
 */
export function reroll(controls: Controls<Settings>, seed?: number): number {
  const next = seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1))
  controls.apply(normalizeSettings({ ...controls.getSettings(), seed: next }))
  return controls.getSettings().seed
}
