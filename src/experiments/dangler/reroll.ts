import type { Controls } from "@/experiments/kit/controls"
import { normalizeSettings, SEED_BOUNDS, type Settings } from "@/experiments/dangler/settings"

/**
 * A fresh arrangement.
 *
 * Lives here rather than in the chrome because it is Dangler's, not the kit's:
 * no other piece has a seed, and rerolling is a statement about how this scene
 * is built. The chrome offers it as a bar button and the console API exposes it,
 * and both call this — one definition, so the button and the API cannot come to
 * mean different things.
 */
export function reroll(controls: Controls<Settings>, seed?: number): number {
  const next = seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1))
  controls.apply(normalizeSettings({ ...controls.getSettings(), seed: next }))
  return controls.getSettings().seed
}
