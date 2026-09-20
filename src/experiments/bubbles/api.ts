import { createBaseApi, reportControls, type BaseApi, type ControlReport } from "@/experiments/kit/api"
import type { Controls } from "@/experiments/kit/controls"
import type { WakeLock } from "@/experiments/kit/wakelock"
import type { Bubbles, BubblesStats } from "@/experiments/bubbles/bubbles"
import { CONTROLS, normalizeSettings, PRESETS, settingsFromQuery, type Settings } from "@/experiments/bubbles/settings"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser, so
 * every control is reachable from here too. Values pass through the same
 * validator the query string does, so the API cannot put the water into a state
 * a URL could not.
 */
export type ExperimentApi = BaseApi<Settings> & {
  /** Every control the panel shows, in panel order, one entry per settings key. */
  controls: () => ControlReport[]
  /** What the surface is doing, and what it costs to draw. */
  stats: () => BubblesStats
  /**
   * Run the water forward without waiting for it, in seconds.
   *
   * The piece needs it: at t=0 the surface is empty, and the foam that the
   * settings actually describe takes twenty seconds of jets to build. The
   * poster, the note's backdrop and the reduced-motion still all go through
   * here, and all three would otherwise be a black rectangle.
   */
  settle: (seconds: number) => void
  /** Sweep the surface clean and watch it fill again. Also the `x` key. */
  clear: () => void
}

/** Printed once on load. The console keeps it, so it waits until the panel is opened. */
export function announceApi(): void {
  const lines = [
    ["experiment.get()", "current settings"],
    ["experiment.set({ jets: 6 })", "change one or more"],
    ['experiment.preset("slick")', "load a preset by name or number"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.settle(30)", "run the water forward thirty seconds"],
    ["experiment.clear()", "sweep the surface clean (or press x)"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the water where it is, or let it run on"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.stats()", "bubbles alive, the biggest, merges, pops, fps"],
    ["experiment.decode(url)", "what scene an address describes"],
    ["experiment.url()", "a link that restores this exact state"],
  ]
  const width = Math.max(...lines.map(([call]) => call!.length))
  const body = lines.map(([call, note]) => `  ${call!.padEnd(width)}   ${note}`).join("\n")

  console.log(`%cBubbles%c is scriptable from here.\n\n${body}\n`, "font-weight:600", "font-weight:400")
}

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, water: Bubbles): ExperimentApi {
  return {
    // The chrome half — get, set, preset, presets, panel, pause, decode, idle,
    // url, fullscreen, awake — comes from the kit. See `@/experiments/kit/api`.
    ...createBaseApi({
      controls,
      wakeLock,
      scene: water,
      presets: PRESETS,
      normalize: normalizeSettings,
      fromQuery: settingsFromQuery,
    }),

    controls: () => reportControls(CONTROLS),

    stats: () => water.stats(),

    settle(seconds) {
      water.settle(Math.max(0, Math.min(600, Number(seconds) || 0)))
    },

    clear() {
      water.clear()
    },
  }
}
