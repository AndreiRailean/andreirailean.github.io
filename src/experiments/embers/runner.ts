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

export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const fire = createEmbers(canvas, read(scene))
  fire.start()

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
  fire.settle(14)

  return {
    setScene: (next) => fire.setSettings(read(next)),
    setPaused: fire.setPaused,
    stats: fire.stats,
    // `stop()` is teardown here, not the pause — it drops both listeners. See
    // the note at the top.
    destroy: fire.stop,
  }
}
