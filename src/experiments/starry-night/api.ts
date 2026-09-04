import type { Starfield, StarfieldStats } from "@/experiments/starry-night/starfield"
import { createBaseApi, type BaseApi } from "@/experiments/kit/api"
import type { Controls } from "@/experiments/kit/controls"
import type { WakeLock } from "@/experiments/kit/wakelock"
import { CONTROLS, keysOf, normalizeSettings, PRESETS, type Settings } from "@/experiments/starry-night/settings"

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
   * Every control the panel shows, in panel order.
   *
   * A discriminated union rather than a flat shape with bounds, because two of
   * these rows have no bounds: depth is one of three named strategies and invert
   * is a boolean. Reporting them as numbers would be a lie a sweep believes —
   * `set({ mode: 2 })` is rejected by the validator and falls back to the
   * default, so a test moving every control through this list would pass while
   * touching neither. `keys` is a list because a range control drives two.
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

/**
 * One entry per **settings key**, not per control.
 *
 * A range owns two keys and used to report them as one entry with a `keys`
 * array, which was the only shape in the section that could not be driven by
 * `report.key`. Reading `.key` off it gave `undefined`, and a test that then set
 * that key wrote to a setting no piece has and passed because nothing moved —
 * see #85. Flattening matches what the other three pieces already did.
 *
 * `kind` is kept, and is this piece's own addition: it is what lets a caller
 * tell a choice from a toggle from a slider without guessing from which fields
 * are present.
 */
export type ControlReport =
  | { kind: "slider" | "range"; key: string; label: string; hint: string; min: number; max: number }
  | { kind: "choice" | "set"; key: string; label: string; hint: string; options: string[] }
  | { kind: "toggle"; key: string; label: string; hint: string }

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, sky: Starfield): ExperimentApi {
  return {
    // The chrome half — get, set, preset, presets, panel, pause, idle, url,
    // fullscreen, awake — comes from the kit. It was written out here, and
    // identically in three other pieces, until the fourth copy; see
    // src/experiments/kit/api.ts. `sky` is this piece's scene, and the only
    // thing the base handle asks of it is `setPaused`.
    ...createBaseApi({ controls, wakeLock, scene: sky, presets: PRESETS, normalize: normalizeSettings }),

    controls: () =>
      CONTROLS.flatMap((control): ControlReport[] =>
        keysOf(control).map((key): ControlReport => {
          const shared = { key: String(key), label: control.label, hint: control.hint }
          // Switched on the discriminant rather than through `isNumericControl`,
          // whose negative branch narrows to nothing useful: the numeric alias is
          // parameterised by `NumericKey` while the union is parameterised by every
          // key, so TypeScript cannot subtract one from the other.
          switch (control.kind) {
            case "choice":
              return { kind: "choice", ...shared, options: control.options.map(({ value }) => value) }
            case "toggle":
              return { kind: "toggle", ...shared }
            // Nothing here uses a set yet. It reports like a choice because
            // that is what it is — several answers from a fixed list.
            case "set":
              return { kind: "set", ...shared, options: control.options.map(({ value }) => value) }
            default:
              return { kind: control.kind, ...shared, min: control.min, max: control.max }
          }
        }),
      ),

    stats: () => sky.stats(),
  }
}
