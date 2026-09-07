import type { Starfield, StarfieldStats } from "@/experiments/starry-night/starfield"
import { createBaseApi, reportControls, type BaseApi, type ControlReport } from "@/experiments/kit/api"
import type { Controls } from "@/experiments/kit/controls"
import type { WakeLock } from "@/experiments/kit/wakelock"
import {
  CONTROLS,
  normalizeSettings,
  PRESETS,
  type Settings,
  settingsFromQuery,
} from "@/experiments/starry-night/settings"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser and
 * hard to poke at by hand, so every control is also reachable from here. Values
 * pass through the same clamping as the query string, so the API cannot put the
 * sky into a state a URL could not.
 */
export type ExperimentApi = BaseApi<Settings> & {
  /**
   * Every control the panel shows, in panel order, one entry per settings key.
   *
   * The kit's `ControlReport` since #130; this piece wrote the same union out
   * itself before that. A union rather than a flat shape with bounds because two
   * of these rows have none: depth is one of three named strategies and invert
   * is a boolean. **Reporting them as numbers is a lie a sweep believes** —
   * `set({ mode: 2 })` is rejected by the validator and falls back to the
   * default, so a test moving every control through this list would pass while
   * touching neither.
   */
  controls: () => ControlReport[]
  /** What the sky costs to draw right now, and how fast it is running. */
  stats: () => StarfieldStats
}

/**
 * Printed once on load rather than on devtools opening, which cannot be detected
 * reliably. The console keeps it, so it is waiting whenever the panel is opened.
 */
export function announceApi(): void {
  const lines = [
    ["experiment.get()", "current settings"],
    ["experiment.set({ hue: 30 })", "change one or more"],
    ['experiment.preset("clay")', "load a preset by name or number"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the sky where it is, or let it run on"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.awake()", "is the display being held awake"],
    ["experiment.stats()", "dots, fill calls per frame, fps, and whether the loop is running"],
    ["experiment.url()", "a link that restores this exact state"],
  ]
  const width = Math.max(...lines.map(([call]) => call.length))
  const body = lines.map(([call, note]) => `  ${call.padEnd(width)}   ${note}`).join("\n")

  console.log(`%cStarry Night%c is scriptable from here.\n\n${body}\n`, "font-weight:600", "font-weight:400")
}

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, sky: Starfield): ExperimentApi {
  return {
    // The chrome half — get, set, preset, presets, panel, pause, idle, url,
    // fullscreen, awake — comes from the kit. It was written out here, and
    // identically in three other pieces, until the fourth copy; see
    // src/experiments/kit/api.ts. `sky` is this piece's scene, and the only
    // thing the base handle asks of it is `setPaused`.
    ...createBaseApi({
      controls,
      wakeLock,
      scene: sky,
      presets: PRESETS,
      normalize: normalizeSettings,
      fromQuery: settingsFromQuery,
    }),

    // The kit's, since #130. The switch it replaces was written out here and in
    // Walkers, differing by one optional field — `group`, which this piece's
    // panel does not use.
    //
    // It switched on the kind rather than going through `isNumericControl`,
    // whose negative branch narrows to nothing useful: the numeric alias is
    // parameterised by `NumericKey` while the union is parameterised by every
    // key, so TypeScript cannot subtract one from the other. The kit's version
    // is generic over the key type and has the same shape for the same reason.
    controls: () => reportControls(CONTROLS),

    stats: () => sky.stats(),
  }
}
