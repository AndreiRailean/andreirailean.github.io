/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * See `../starry-night/runner.ts` for what a runner is and why the decoding
 * happens here rather than in whatever loads it. The scene registers a single
 * `resize` listener and drops it in `stop()`, so `destroy` is `stop`.
 */

import { settleSeconds } from "@/experiments/simulation/loop"
import { decodeScene } from "@/experiments/address"
import type { Live, PieceApi } from "@/experiments/piece"
import { createHexgrid } from "@/experiments/hexgrid/hexgrid"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/hexgrid/settings"

export type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

export type MountOptions = Record<string, never>

function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`hexgrid: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
  return normalizeSettings(decoded as Partial<Settings>)
}

export function start(canvas: HTMLCanvasElement, settings: Settings) {
  const scene = createHexgrid(canvas, settings)
  scene.start()

  return {
    setSettings: scene.setSettings,
    setPaused: scene.setPaused,
    stats: scene.stats,
    destroy: scene.stop,
    verbs: {
      settle: (seconds: number) => scene.settle(settleSeconds(seconds)),
      clear: () => scene.clear(),
      debug: (on?: boolean) => scene.debug(on),
    },
  } satisfies Live<Settings>
}

export type ExperimentApi = PieceApi<
  Settings,
  ReturnType<typeof start>["verbs"],
  ReturnType<ReturnType<typeof start>["stats"]>
>

/** The loop starts from outlines; a host that wants colour at once settles it first. */
export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const live = start(canvas, read(scene))
  return {
    setScene: (next) => live.setSettings(read(next)),
    setPaused: live.setPaused,
    stats: live.stats,
    destroy: live.destroy,
  }
}
