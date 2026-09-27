/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * See `../starry-night/runner.ts` for what a runner is and why the decoding
 * happens here rather than in whatever loads it.
 *
 * A piece opts in by having this file. Nothing looks for one that does not.
 */

import { decodeScene } from "@/experiments/address"
import { createDangler } from "@/experiments/dangler/dangler"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/dangler/settings"
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
  if (!decoded) throw new Error(`dangler: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
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
  const strands = createDangler(canvas, settings)
  strands.start()

  return {
    setSettings: strands.setSettings,
    setPaused: strands.setPaused,
    stats: strands.stats,
    destroy: strands.stop,
    verbs: {
      settle: () => strands.settle(),
      debug: (on: boolean) => strands.setDebug(on),
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
    /**
     * A scene change settles the ropes, the way the piece's own poster does.
     *
     * Without it the new scene's strands arrive at the previous scene's
     * positions and fall into place, which reads as the piece loading rather
     * than as the piece being different. `settle()` returns once it is still.
     */
    setScene: (next) => {
      live.setSettings(read(next))
      live.verbs.settle()
    },
    setPaused: live.setPaused,
    stats: live.stats,

    /**
     * `stop()` is this piece's teardown, not merely its pause — the type says
     * so, and `setPaused` is the one that parks the frame without unwinding.
     *
     * It drops every listener it took, which it did not when this file was
     * written. This piece's case was the more interesting of the two: the
     * reduced-motion handler was an inline arrow, so no reference existed and
     * the `removeEventListener` was *unwritable* rather than forgotten. #168.
     */
    destroy: live.destroy,
  }
}
