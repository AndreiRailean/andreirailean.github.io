import type { Preset } from "@/experiments/kit/controls"

/*
 * What a preset's seed says, kept apart from `controls.ts` so the index, which
 * applies presets to draw its plates, does not import the bar to do it.
 */

/** A preset's seed that is rolled afresh each time the preset is applied. */
export const ROLL = "roll"

/** Whether a preset leaves its seed to be rolled. */
export const rollsSeed = (preset: { settings: unknown }): boolean =>
  (preset.settings as { seed?: unknown }).seed === ROLL

/**
 * A preset applied as written, for a caller with nothing to roll a seed with.
 *
 * Refuses a preset that rolls rather than letting the validator quietly swap
 * `"roll"` for its default seed, which would pin every such preset to one
 * arrangement while reading as rolled. `boot.ts` passes `sceneFromPreset`.
 */
export function presetAsWritten<S>(normalize: (patch: S) => S, preset: Preset<S>): S {
  if (rollsSeed(preset)) {
    throw new Error(`Preset ${JSON.stringify(preset.label)} rolls its seed, and nothing was given to roll it with.`)
  }
  // A pinned preset names every setting, so it is a whole scene already.
  return normalize({ ...preset.settings } as S)
}

/**
 * A preset's settings as a whole scene, with `seed` standing in for a rolled
 * one and a pinned seed kept.
 *
 * For a reader that needs a preset without chance in it: a test of what the
 * validator does to a preset, or one replaying an arrangement it was written
 * against.
 */
export function presetWithSeed<S>(preset: Preset<S>, seed: number): S {
  return { ...preset.settings, ...(rollsSeed(preset) ? { seed } : {}) } as S
}
