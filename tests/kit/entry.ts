/**
 * The fixture's boot: what `Piece.astro` is for a real piece. Bundled and served
 * by `tests/support/kit-fixture.ts`; the settings it boots are in `fixture.ts`.
 */
import { boot } from "@/experiments/gallery/boot"
import type { Chrome, Live } from "@/experiments/piece"
import {
  CONTROLS,
  namesASetting,
  normalizeSettings,
  PRESETS,
  reconcile,
  reroll,
  settingsFromQuery,
  urlForSettings,
  type Settings,
} from "./fixture"

const boxed = !window.location.pathname.startsWith("/column/")

const CHROME: Chrome<Settings> = {
  slug: "kit-fixture",
  title: "Kit fixture",
  canvas: "field",
  groups: ["basic", "shape", { name: "layer", governor: "layer", off: false }],
  boxes: boxed,
  // Published on <html> so a test can see the gallery tint the page from a scene.
  theme: (settings) => ({ data: { fixtureMode: settings.mode } }),
  actions: [
    { label: "reroll", hint: "A fresh seed.", shortcut: "r", verb: "reroll" },
    { label: "nudge", hint: "Counts itself.", shortcut: "n", verb: "nudge" },
  ],
  hatches: { debug: "flag" },
  banner: [["experiment.get()", "current settings"]],
}

type Stats = { changes: number; nudges: number; debug: boolean; paused: boolean }

function start(canvas: HTMLCanvasElement, settings: Settings): Live<Settings, Record<string, () => unknown>, Stats> {
  const stats: Stats = { changes: 0, nudges: 0, debug: false, paused: false }
  const draw = (scene: Settings) => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const context = canvas.getContext("2d")
    if (!context) return
    context.fillStyle = `hsl(${scene.amount * 30} 60% 50%)`
    context.fillRect(0, 0, canvas.width / 2, canvas.height / 2)
  }
  draw(settings)
  return {
    setSettings: (next) => {
      stats.changes++
      draw(next)
    },
    setPaused: (held) => {
      stats.paused = held
    },
    stats: () => ({ ...stats }),
    destroy: () => {},
    verbs: {
      nudge: () => ++stats.nudges,
      debug: (on?: unknown) => (stats.debug = on !== false),
    },
  }
}

boot({
  settings: {
    CHROME,
    CONTROLS,
    normalizeSettings,
    reconcile: reconcile as never,
    settingsFromQuery,
    namesASetting,
    urlForSettings,
    reroll,
  },
  presets: PRESETS,
  start,
})
