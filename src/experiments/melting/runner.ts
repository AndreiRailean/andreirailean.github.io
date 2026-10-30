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
import { createMelting } from "@/experiments/melting/melting"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/melting/settings"

export type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

export type MountOptions = Record<string, never>

function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`melting: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
  return normalizeSettings(decoded as Partial<Settings>)
}

export function start(canvas: HTMLCanvasElement, settings: Settings) {
  const scene = createMelting(canvas, settings)
  scene.start()

  return {
    setSettings: scene.setSettings,
    setPaused: scene.setPaused,
    stats: scene.stats,
    destroy: scene.stop,
    verbs: {
      settle: (seconds: number) => scene.settle(settleSeconds(seconds)),
      goto: (at: number) => scene.goto(Number(at) || 0),
      debug: (on?: boolean) => scene.debug(on),
      blobs: () => scene.blobs(),
    },
  } satisfies Live<Settings>
}

export type ExperimentApi = PieceApi<
  Settings,
  ReturnType<typeof start>["verbs"],
  ReturnType<ReturnType<typeof start>["stats"]>
>

/** No settling needed: the scene is a function of its time, drawn whole from the first frame. */
export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const live = start(canvas, read(scene))
  return {
    setScene: (next) => live.setSettings(read(next)),
    setPaused: live.setPaused,
    stats: live.stats,
    destroy: live.destroy,
  }
}
