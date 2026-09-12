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

export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const strands = createDangler(canvas, read(scene))
  strands.start()

  return {
    /**
     * A scene change settles the ropes, the way the piece's own poster does.
     *
     * Without it the new scene's strands arrive at the previous scene's
     * positions and fall into place, which reads as the piece loading rather
     * than as the piece being different. `settle()` returns once it is still.
     */
    setScene: (next) => {
      strands.setSettings(read(next))
      strands.settle()
    },
    setPaused: strands.setPaused,
    stats: strands.stats,

    /**
     * `stop()` is this piece's teardown, not merely its pause — the type says
     * so, and `setPaused` is the one that parks the frame without unwinding.
     *
     * It drops every listener it took, which it did not when this file was
     * written. This piece's case was the more interesting of the two: the
     * reduced-motion handler was an inline arrow, so no reference existed and
     * the `removeEventListener` was *unwritable* rather than forgotten. #168.
     */
    destroy: strands.stop,
  }
}
