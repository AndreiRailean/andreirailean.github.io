/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * See `../starry-night/runner.ts` for what a runner is and why the decoding
 * happens here rather than in whatever loads it. The short version: a packed
 * scene is positional, so only the registry that wrote it can read it, and this
 * bundle is by construction the code that wrote it.
 *
 * A piece opts in by having this file. Nothing looks for one that does not.
 */

import { decodeScene } from "@/experiments/address"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/crowd/settings"
import { createCrowd } from "@/experiments/crowd/crowd"

/** The whole contract between a runner and whatever hosts it. */
export type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

/**
 * What a host may ask of any runner, whatever piece it holds.
 *
 * Empty, matching the others. A frozen runner cannot grow a parameter later — an
 * artefact would have to be republished against a newer one — so it is cheaper
 * to have than to add.
 */
export type MountOptions = Record<string, never>

/** Normalisation happens behind the freeze, so a published scene survives this piece's later defaults. */
function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`crowd: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
  return normalizeSettings(decoded as Partial<Settings>)
}

export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const square = createCrowd(canvas, read(scene))
  square.start()

  return {
    setScene: (next) => square.setSettings(read(next)),
    setPaused: square.setPaused,
    stats: square.stats,
    destroy: square.destroy,
  }
}
