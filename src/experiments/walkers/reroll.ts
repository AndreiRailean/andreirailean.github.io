import type { Controls } from "@/experiments/kit/controls"
import { normalizeSettings, SEED_BOUNDS, type Settings } from "@/experiments/walkers/settings"

/**
 * A different afternoon at the same settings.
 *
 * The seed decides everything about who turns up — how many are in each group,
 * how tall they are, which of them are children, what colour they are wearing,
 * which edge they come in by and where they are going. So a re-roll is a
 * genuinely different crowd rather than the same crowd shuffled, which is what
 * makes it worth a button: two crowds at identical settings look about as
 * different as two afternoons in the same park do.
 *
 * Lives beside the piece rather than in the kit for the reason Flotsam's does —
 * hoisting it would put the setting name `seed` inside a kit that knows nothing
 * about what any setting means. The bar button and the console API both call
 * this, so they cannot come to mean different things.
 */
export function reroll(controls: Controls<Settings>, seed?: number): number {
  const next = seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1))
  controls.apply(normalizeSettings({ ...controls.getSettings(), seed: next }))
  return controls.getSettings().seed
}
