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
import { createArtdeco } from "@/experiments/artdeco/artdeco"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/artdeco/settings"
import { saveFile } from "@/experiments/artdeco/svg"

export type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

export type MountOptions = Record<string, never>

function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`artdeco: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
  return normalizeSettings(decoded as Partial<Settings>)
}

export function start(canvas: HTMLCanvasElement, settings: Settings) {
  const scene = createArtdeco(canvas, settings)
  scene.start()
  let seed = settings.seed

  return {
    setSettings: (next: Settings) => {
      seed = next.seed
      scene.setSettings(next)
    },
    setPaused: scene.setPaused,
    stats: scene.stats,
    destroy: scene.stop,
    verbs: {
      settle: (seconds: number) => scene.settle(settleSeconds(seconds)),
      clear: () => scene.clear(),
      debug: (on?: boolean) => scene.debug(on),
      /** Saves what is on screen as black-on-white SVG, and returns the file's name. */
      svg: () => {
        const name = `artdeco-${seed}.svg`
        const date = new Date().toISOString()
        const about = {
          generator: "www.andrei.md",
          title: `Art Deco, seed ${seed}`,
          // The address bar holds the scene, so it is the link that reproduces it.
          description: `Saved from Art Deco, an experiment at www.andrei.md, on ${date.slice(0, 10)}. The scene: ${location.href}`,
          source: location.href,
          date,
        }
        saveFile(name, scene.svg(about), "image/svg+xml")
        return name
      },
    },
  } satisfies Live<Settings>
}

export type ExperimentApi = PieceApi<
  Settings,
  ReturnType<typeof start>["verbs"],
  ReturnType<ReturnType<typeof start>["stats"]>
>

/** The drawing starts from the bottom; a host that wants it grown settles it first. */
export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const live = start(canvas, read(scene))
  return {
    setScene: (next) => live.setSettings(read(next)),
    setPaused: live.setPaused,
    stats: live.stats,
    destroy: live.destroy,
  }
}
