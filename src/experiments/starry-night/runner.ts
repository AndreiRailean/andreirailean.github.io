/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * A **runner** is this file bundled — the piece's drawing code, frozen, with no
 * chrome, no kit, no presets and no URL handling. It is what a published
 * background executes, and `scripts/runners.ts` is what freezes it.
 *
 * **Preparing a runner is the piece's business; hosting one is not.** Which
 * scene modules go in, and what `mount` hands back, are decisions only this
 * experiment can make. How runners are named, versioned and served is imposed on
 * every piece alike, and lives in `scripts/runners.ts` and `gallery/embed.ts`.
 *
 * A piece opts in by having this file. Nothing looks for one that does not.
 */

import { decodeScene } from "@/experiments/address"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/starry-night/settings"
import { createStarfield } from "@/experiments/starry-night/starfield"
import type { Live, PieceApi } from "@/experiments/piece"

/**
 * The whole contract between a runner and whatever hosts it.
 *
 * Deliberately tiny, and deliberately says nothing about this piece: a host
 * holds one of these without knowing which experiment it came from.
 */
export type Mounted = {
  /** Swap scenes without tearing down — what makes a theme change seamless. */
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

/**
 * What a host may ask of any runner, whatever piece it holds.
 *
 * Empty for now. It exists because a frozen runner cannot grow a parameter
 * later — an artefact would have to be republished against a newer one — so it
 * is cheaper to have than to add.
 */
export type MountOptions = Record<string, never>

/**
 * A scene is the **packed address string**, and this is the only thing that can
 * read it.
 *
 * Decoding belongs here rather than in the loader for two reasons that are
 * really one. A packed scene is positional — the slot index in `REGISTRY` *is*
 * the version — so reading it needs the registry that wrote it, and this bundle
 * is by construction the code that wrote it. Put the decoder in the shared
 * loader instead and it would have to carry every piece's registry, at every
 * version anyone had ever published.
 *
 * Normalisation happens here too, for the same reason it always did: behind the
 * freeze, so a published scene is immune to this piece's later defaults.
 *
 * An unreadable string throws. The loader empties its container and the host's
 * own background is what shows — see `gallery/embed.ts`.
 */
function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`starry-night: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
  return normalizeSettings(decoded as Partial<Settings>)
}

/**
 * The piece live: what the gallery's page drives, and what `mount` below is
 * written in terms of, so there is one way a point becomes pixels.
 *
 * The verbs are the piece's own, and reach the console and the bar through
 * `gallery/boot.ts`. See
 * `../docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 */
export function start(canvas: HTMLCanvasElement, settings: Settings) {
  const field = createStarfield(canvas, settings)
  field.start()

  return {
    setSettings: field.setSettings,
    setPaused: field.setPaused,
    stats: field.stats,
    destroy: field.destroy,
    verbs: {},
  } satisfies Live<Settings>
}

/** `window.experiment` on this piece's page, derived rather than written out. */
export type ExperimentApi = PieceApi<
  Settings,
  ReturnType<typeof start>["verbs"],
  ReturnType<ReturnType<typeof start>["stats"]>
>

export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const live = start(canvas, read(scene))

  return {
    setScene: (next) => live.setSettings(read(next)),
    setPaused: live.setPaused,
    stats: live.stats,
    destroy: live.destroy,
  }
}
