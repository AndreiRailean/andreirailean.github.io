import type { Starfield, StarfieldStats } from "@/experiments/starry-night/starfield"
import type { Controls } from "@/experiments/kit/controls"
import { setFullscreen, toggleFullscreen } from "@/experiments/kit/fullscreen"
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
export type ExperimentApi = {
  /** Current settings. */
  get: () => Settings
  /** Merge a partial change; returns what was actually applied after clamping. */
  set: (patch: Partial<Settings>) => Settings
  /** Load a preset by 1-based number or by name. */
  preset: (which: number | string) => Settings
  /** Preset names, in keyboard order. */
  presets: () => string[]
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
  /** Open or close the settings panel; omit to toggle. Returns the new state. */
  panel: (open?: boolean) => boolean
  /** Pin idle on or off — hiding the cursor and chrome. Omit to resume auto. */
  idle: (force?: boolean | null) => void
  /** The shareable URL for the current settings. */
  url: () => string
  /** Enter or leave fullscreen; omit to toggle. Resolves to whether it is on. */
  fullscreen: (on?: boolean) => Promise<boolean>
  /** Whether the screen is currently being held awake. */
  awake: () => boolean
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

export type ControlReport =
  | { kind: "slider" | "range"; keys: string[]; label: string; hint: string; min: number; max: number }
  | { kind: "choice"; keys: string[]; label: string; hint: string; options: string[] }
  | { kind: "toggle"; keys: string[]; label: string; hint: string }

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, sky: Starfield): ExperimentApi {
  return {
    get: () => controls.getSettings(),

    set(patch) {
      const next = normalizeSettings(patch, controls.getSettings())
      controls.apply(next)
      return next
    },

    preset(which) {
      const found = typeof which === "number" ? PRESETS[which - 1] : PRESETS.find(({ label }) => label === which)
      if (!found) {
        throw new Error(`No such preset: ${JSON.stringify(which)}. Try ${PRESETS.map((p) => p.label).join(", ")}.`)
      }
      const next = normalizeSettings(found.settings)
      controls.apply(next)
      return next
    },

    presets: () => PRESETS.map(({ label }) => label),

    controls: () =>
      CONTROLS.map((control): ControlReport => {
        const shared = { keys: keysOf(control), label: control.label, hint: control.hint }
        // Switched on the discriminant rather than through `isNumericControl`,
        // whose negative branch narrows to nothing useful: the numeric alias is
        // parameterised by `NumericKey` while the union is parameterised by every
        // key, so TypeScript cannot subtract one from the other.
        switch (control.kind) {
          case "choice":
            return { kind: "choice", ...shared, options: control.options.map(({ value }) => value) }
          case "toggle":
            return { kind: "toggle", ...shared }
          default:
            return { kind: control.kind, ...shared, min: control.min, max: control.max }
        }
      }),

    panel(open) {
      const next = open ?? !controls.isPanelOpen()
      controls.setPanelOpen(next)
      return next
    },

    idle(force = null) {
      controls.setIdle(force)
    },

    url: () => window.location.href,

    fullscreen: (on) => (on === undefined ? toggleFullscreen() : setFullscreen(on)),

    awake: () => wakeLock.held(),

    stats: () => sky.stats(),
  }
}
