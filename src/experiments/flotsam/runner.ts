/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * See `../starry-night/runner.ts` for what a runner is and why the decoding
 * happens here rather than in whatever loads it.
 *
 * A piece opts in by having this file. Nothing looks for one that does not.
 */

import { decodeScene } from "@/experiments/address"
import { createFlotsam } from "@/experiments/flotsam/flotsam"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/flotsam/settings"
import type { Live, PieceApi, Rerollable } from "@/experiments/piece"

/** The whole contract between a runner and whatever hosts it. */
export type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

/** What a host may ask of any runner. Empty, matching Starry Night's. */
export type MountOptions = Record<string, never>

/** Normalisation happens behind the freeze, so a published scene survives this piece's later defaults. */
function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`flotsam: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
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
  const sea = createFlotsam(canvas, settings)
  sea.start()

  return {
    setSettings: sea.setSettings,
    setPaused: sea.setPaused,
    stats: sea.stats,
    destroy: sea.stop,
    verbs: {
      run: (seconds: number) => sea.run(seconds),
      debug: (on: boolean) => sea.setDebug(on),
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
     * `stop()` is this piece's teardown, not merely its pause.
     *
     * The type says so — "those are teardown and setup — they drop and re-add
     * the resize listener" — and `setPaused` is the one that parks the frame
     * without unwinding anything. So a runner's `destroy` is `stop`, and the
     * piece needs no new method to be freezable.
     *
     * It drops every listener it took, which it did not when this file was
     * written: the reduced-motion watcher stayed subscribed and held the whole
     * closure — canvas, settings, 8,500 specks — for each mount torn down. Real
     * only for a host that mounts repeatedly, which is what a wall is. Fixed in
     * #168 and checked by `tests/unit/experiments-listeners.test.ts`.
     */
    destroy: live.destroy,
  }
}
