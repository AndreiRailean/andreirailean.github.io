/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * See `../starry-night/runner.ts` for what a runner is and why the decoding
 * happens here rather than in whatever loads it. A piece opts in by having this
 * file; nothing looks for one that does not.
 *
 * **What made this piece ready to have one is that it already tore itself
 * down.** A wall mounts and unmounts repeatedly, which is the only host that
 * ever surfaces a leaked listener — `#168` was four pieces sharing one, found
 * by exactly that. Embers registers two, both named handlers, both dropped in
 * `stop()`, so `destroy` is `stop` and no new method was needed.
 */

import { decodeScene } from "@/experiments/address"
import { createEmbers } from "@/experiments/embers/embers"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/embers/settings"
import type { Live, PieceApi } from "@/experiments/piece"

/** The whole contract between a runner and whatever hosts it. */
export type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

/** What a host may ask of any runner. Empty, matching the others'. */
export type MountOptions = Record<string, never>

/**
 * Normalisation happens behind the freeze, so a published scene survives this
 * piece's later defaults — and this piece has moved a great deal since its
 * first scene was approved, which is the case the freeze is for.
 */
function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`embers: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
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
  const fire = createEmbers(canvas, settings)
  fire.start()
  let debugging = false

  return {
    setSettings: fire.setSettings,
    setPaused: fire.setPaused,
    stats: fire.stats,
    destroy: fire.stop,
    verbs: {
      settle: (seconds: number) => fire.settle(Math.max(0, Math.min(600, Number(seconds) || 0))),
      burst: () => fire.burst(),
      debug: (on?: boolean) => {
        debugging = on === undefined ? !debugging : Boolean(on)
        fire.setDebug(debugging)
        return debugging
      },
    },
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

  /**
   * A fire that has been going a while, rather than one just lit.
   *
   * The wall mounts a scene and shows it immediately, and this piece arrives
   * empty: an ember takes a second or two to cross the frame, so an unsettled
   * mount is a black rectangle that fills in while somebody watches. Every
   * other surface that asks this piece to arrive somewhere — the poster, the
   * note's backdrop, the reduced-motion still — goes through the same verb.
   *
   * Seconds of *fire*, not of wall clock, so it is unaffected by the scene's
   * own playback.
   */
  live.verbs.settle(14)

  return {
    setScene: (next) => live.setSettings(read(next)),
    setPaused: live.setPaused,
    stats: live.stats,
    // `stop()` is teardown here, not the pause — it drops both listeners. See
    // the note at the top.
    destroy: live.destroy,
  }
}
