/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * A **runner** is this file bundled — the piece's drawing code, frozen, with no
 * chrome, no kit, no presets and no URL handling. It is what a published
 * background actually executes, and `scripts/runners.ts` is what freezes it.
 *
 * **Preparing a runner is the piece's business; hosting one is not.** Which
 * scene modules go in, and what `mount` hands back, are decisions only this
 * experiment can make. How runners are named, versioned and served is imposed on
 * every piece alike and lives in `scripts/runners.ts` and
 * `gallery/embed.ts`.
 *
 * A piece opts in by having this file. Nothing looks for one that does not.
 */

import { createStarfield } from "@/experiments/starry-night/starfield"
import { normalizeSettings, type Settings } from "@/experiments/starry-night/settings"

/**
 * The whole contract between a runner and whatever hosts it.
 *
 * Deliberately tiny, and deliberately says nothing about this piece: a host
 * holds one of these without knowing which experiment it came from.
 */
export type Mounted = {
  /** Swap settings without tearing down — what makes a theme change seamless. */
  setSettings: (settings: unknown) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

/**
 * What a host may ask of any runner, whatever piece it holds.
 *
 * Empty for now. It exists because a frozen runner cannot grow an option later —
 * an artefact would have to be republished against a newer one to gain it — so
 * the parameter is cheaper to have than to add.
 */
export type MountOptions = Record<string, never>

/**
 * Settings arrive as `unknown` on purpose.
 *
 * **Normalisation happens in here, behind the freeze.** That is the mechanism
 * that keeps a published scene immune to this piece's later defaults: a host
 * that validated settings itself would have to be upgraded in step with every
 * piece, which is the coupling a runner exists to remove.
 */
export function mount(canvas: HTMLCanvasElement, settings: unknown, _options: MountOptions = {}): Mounted {
  const field = createStarfield(canvas, normalizeSettings((settings ?? {}) as Partial<Settings>))
  field.start()

  return {
    setSettings: (next) => field.setSettings(normalizeSettings((next ?? {}) as Partial<Settings>)),
    setPaused: field.setPaused,
    stats: field.stats,
    destroy: field.destroy,
  }
}
