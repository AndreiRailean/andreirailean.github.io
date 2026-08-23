import type { Controls } from "@/experiments/starry-night/controls"
import type { WakeLock } from "@/experiments/starry-night/wakelock"
import { CONTROLS, normalizeSettings, PRESETS, type Settings } from "@/experiments/starry-night/settings"

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
  /** Every control with its bounds and tooltip. */
  controls: () => { key: string; label: string; min: number; max: number; hint: string }[]
  /** Open or close the settings panel; omit to toggle. Returns the new state. */
  panel: (open?: boolean) => boolean
  /** Pin idle on or off — hiding the cursor and chrome. Omit to resume auto. */
  idle: (force?: boolean | null) => void
  /** The shareable URL for the current settings. */
  url: () => string
  /** Whether the screen is currently being held awake. */
  awake: () => boolean
}

declare global {
  interface Window {
    experiment?: ExperimentApi
  }
}

export function createApi(controls: Controls, wakeLock: WakeLock): ExperimentApi {
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

    controls: () => CONTROLS.map(({ key, label, min, max, hint }) => ({ key, label, min, max, hint })),

    panel(open) {
      const next = open ?? !controls.isPanelOpen()
      controls.setPanelOpen(next)
      return next
    },

    idle(force = null) {
      controls.setIdle(force)
    },

    url: () => window.location.href,

    awake: () => wakeLock.held(),
  }
}
