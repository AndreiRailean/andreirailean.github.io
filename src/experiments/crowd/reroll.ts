import type { Controls } from "@/experiments/kit/controls"
import { normalizeSettings, SEED_BOUNDS, type Settings } from "@/experiments/crowd/settings"

/**
 * A different set of strangers at the same settings.
 *
 * The seed decides everything about who is out there — how tall they are, which
 * of them are children, who is with whom, which way each of them is going, and
 * the order I meet them. It also seeds the walk itself, so a re-roll changes
 * where I stop and what I turn to look at.
 *
 * Lives beside the piece rather than in the kit for the reason Walkers' does:
 * hoisting it would put the setting name `seed` inside a kit that knows nothing
 * about what any setting means. The bar button and the console API both call
 * this, so they cannot come to mean different things.
 */
export function reroll(controls: Controls<Settings>, seed?: number): number {
  const next = seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1))
  controls.apply(normalizeSettings({ ...controls.getSettings(), seed: next }))
  return controls.getSettings().seed
}
