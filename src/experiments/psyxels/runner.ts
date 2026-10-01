/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * See `../starry-night/runner.ts` for what a runner is and why the decoding
 * happens here rather than in whatever loads it.
 *
 * ## The portrait
 *
 * Until #263 the portrait was a file the page handed the engine, and this
 * runner could not mount a scene that used it. It is an address in the scene
 * now — `picture` — which the engine fetches itself, with `crossOrigin` set so
 * the canvas can read it. A frozen runner carries the address and nothing
 * else, so the image's host is part of what a published portrait scene
 * depends on: `/experiments/psyxels/avatar.jpg` on this site, or any host that
 * sends `access-control-allow-origin`. See
 * `../docs/adr/20260912-the-image-is-an-input-not-a-subject.md`.
 *
 * A piece opts in by having this file. Nothing looks for one that does not.
 */

import { decodeScene } from "@/experiments/address"
import { createPsyxels } from "@/experiments/psyxels/psyxels"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/psyxels/settings"
import type { Live, PieceApi, Rerollable } from "@/experiments/piece"

/** The whole contract between a runner and whatever hosts it. */
export type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

/**
 * What a host may ask of any runner. Empty, matching Starry Night's — the
 * portrait, which was the obvious first option, travels in the scene instead.
 */
export type MountOptions = Record<string, never>

/** Normalisation happens behind the freeze, so a published scene survives this piece's later defaults. */
function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`psyxels: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
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
  const field = createPsyxels(canvas, settings)
  field.start()

  return {
    setSettings: field.setSettings,
    setPaused: field.setPaused,
    stats: field.stats,
    destroy: field.stop,
    verbs: {
      run: (seconds: number) => field.run(seconds),
      debug: (on: boolean) => field.setDebug(on),
    },
  } satisfies Live<Settings>
}

/** `window.experiment` on this piece's page, derived rather than written out. */
export type ExperimentApi = PieceApi<
  Settings,
  ReturnType<typeof start>["verbs"],
  ReturnType<ReturnType<typeof start>["stats"]>
> &
  Rerollable

export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const live = start(canvas, read(scene))

  return {
    setScene: (next) => live.setSettings(read(next)),
    setPaused: live.setPaused,
    stats: live.stats,

    /**
     * `stop()` is a complete teardown here — the most thorough of any piece.
     *
     * It disconnects the ResizeObserver and removes both the resize and the
     * avatar-load listeners, so unlike flotsam and dangler this leaves nothing
     * behind when a host mounts and unmounts repeatedly.
     */
    destroy: live.destroy,
  }
}
