/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * See `../starry-night/runner.ts` for what a runner is and why the decoding
 * happens here rather than in whatever loads it. A piece opts in by having this
 * file; nothing looks for one that does not, which is why `scripts/runners.ts`
 * has no list to add a slug to.
 *
 * **What made this piece ready to have one is that it already tore itself
 * down.** A wall mounts and unmounts repeatedly, which is the only host that
 * ever surfaces a leaked listener — #168 was four pieces sharing one, found by
 * exactly that. This piece registers a single named `resize` handler and drops
 * it in `stop()`, so `destroy` is `stop` and no new method was needed.
 */

import { decodeScene } from "@/experiments/address"
import { createBubbles } from "@/experiments/bubbles/bubbles"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/bubbles/settings"

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
 * piece's later defaults.
 *
 * This piece needs that more than most: eight rounds of Andrei's feedback
 * retired thirteen slots between them, twice changing what a number *means*
 * while leaving the number alone. A scene published today is read by the
 * registry it was written against, because these bytes carry that registry.
 */
function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`bubbles: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
  return normalizeSettings(decoded as Partial<Settings>)
}

export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const water = createBubbles(canvas, read(scene))
  water.start()

  /**
   * Water that has been going a while, rather than jets just switched on.
   *
   * The surface is empty at t=0 and **nothing here is delivered at the size it
   * ends up**: a bubble can only grow by meeting another, so the size range a
   * scene describes is earned over tens of seconds. A wall mounting an
   * unsettled scene shows a black rectangle filling in while somebody watches.
   *
   * `settle` also draws its last frames rather than stepping past them, which
   * this piece needs and the others do not: a scene with a wake builds its
   * streaks frame by frame, so a fast-forward that draws once arrives with no
   * wake at all. The published primary has one.
   *
   * Seconds of *water*, not of wall clock, so it is unaffected by the scene's
   * own playback — which matters here, where the published scenes run at an
   * eighth speed.
   */
  water.settle(30)

  return {
    setScene: (next) => water.setSettings(read(next)),
    setPaused: water.setPaused,
    stats: water.stats,
    // `stop()` is teardown here, not the pause — it drops the resize listener.
    destroy: water.stop,
  }
}
