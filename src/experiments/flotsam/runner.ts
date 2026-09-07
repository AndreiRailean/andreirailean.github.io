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

export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const sea = createFlotsam(canvas, read(scene))
  sea.start()

  return {
    setScene: (next) => sea.setSettings(read(next)),
    setPaused: sea.setPaused,
    stats: sea.stats,

    /**
     * `stop()` is this piece's teardown, not merely its pause.
     *
     * The type says so — "those are teardown and setup — they drop and re-add
     * the resize listener" — and `setPaused` is the one that parks the frame
     * without unwinding anything. So a runner's `destroy` is `stop`, and the
     * piece needs no new method to be freezable.
     *
     * **One listener outlives it**: `stillOnly.addEventListener("change", …)`,
     * the reduced-motion watcher, which `stop()` does not remove. Harmless for
     * a page that mounts once and harmless here — the callback only wakes a
     * loop that is no longer running — but it is a genuine leak for a host that
     * mounts and unmounts repeatedly, and it belongs to the piece rather than
     * to this file.
     */
    destroy: sea.stop,
  }
}
