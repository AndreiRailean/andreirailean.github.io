import type { Controls } from "@/experiments/kit/controls"
import { normalizeSettings, SEED_BOUNDS, type Settings } from "@/experiments/dangler/settings"

/**
 * A fresh arrangement.
 *
 * Lives here rather than in the kit, and the reason is not the one this comment
 * used to give. "No other piece has a seed" was true when it was written and is
 * now false in three pieces, whose copies of this function are byte-identical to
 * it — each one citing the previous one's conclusion without re-reading its
 * premise. What actually keeps it out of the kit is that hoisting it would put
 * the setting name `seed` inside the kit, and the kit knows nothing about what
 * any setting means. Once `createBaseApi` supplies `set`, what is left here is
 * two lines.
 *
 * The chrome offers it as a bar button and the console API exposes it, and both
 * call this — one definition, so the button and the API cannot come to mean
 * different things.
 */
export function reroll(controls: Controls<Settings>, seed?: number): number {
  const next = seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1))
  controls.apply(normalizeSettings({ ...controls.getSettings(), seed: next }))
  return controls.getSettings().seed
}
