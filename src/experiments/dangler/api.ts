import type { Controls } from "@/experiments/dangler/controls"
import type { Dangler, DanglerStats } from "@/experiments/dangler/dangler"
import { setFullscreen, toggleFullscreen } from "@/experiments/dangler/fullscreen"
import { CONTROLS, normalizeSettings, PRESETS, type Settings } from "@/experiments/dangler/settings"
import type { WakeLock } from "@/experiments/dangler/wakelock"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser, so
 * every control is reachable from here too. Values pass through the same
 * clamping the query string uses, so the API cannot reach a state a URL could
 * not.
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
  /** Every control with its group, bounds and blurb. */
  controls: () => { key: string; group: string; label: string; min: number; max: number; hint: string }[]
  /** A fresh arrangement. Omit for a random seed; returns the seed used. */
  reroll: (seed?: number) => number
  /**
   * Run the wires to rest and redraw.
   *
   * Needed for stills more than for anything interactive: a screenshot taken
   * while the scene is still relaxing shows a shape it never actually holds, and
   * nothing about the image says so.
   */
  settle: () => void
  /** Draw the wires, anchors and canopy the piece otherwise never shows. */
  debug: (on: boolean) => void
  /** Open or close the settings panel; omit to toggle. Returns the new state. */
  panel: (open?: boolean) => boolean
  /** Pin idle on or off — hiding the cursor and chrome. Omit to resume auto. */
  idle: (force?: boolean | null) => void
  /** The shareable URL for the current scene. */
  url: () => string
  /** Enter or leave fullscreen; omit to toggle. Resolves to whether it is on. */
  fullscreen: (on?: boolean) => Promise<boolean>
  /** Whether the screen is currently being held awake. */
  awake: () => boolean
  /** What the scene costs to draw, how settled it is, and how fast it runs. */
  stats: () => DanglerStats
}

/**
 * Printed once on load rather than on devtools opening, which cannot be detected
 * reliably. The console keeps it, so it is waiting whenever it is looked for.
 */
export function announceApi(): void {
  const lines = [
    ["experiment.get()", "current settings"],
    ["experiment.set({ breeze: 0.3 })", "change one or more"],
    [`experiment.preset(${JSON.stringify(PRESETS[0]?.label ?? "")})`, "load a preset by name or number"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "a fresh arrangement (or press r)"],
    ["experiment.settle()", "run the wires to rest before looking"],
    ["experiment.debug(true)", "show the wires, anchors and canopy"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.awake()", "is the display being held awake"],
    ["experiment.stats()", "bulbs drawn, fill cost, settledness, fps"],
    ["experiment.url()", "a link that restores this exact scene"],
  ]
  const width = Math.max(...lines.map(([call]) => call.length))
  const body = lines.map(([call, note]) => `  ${call.padEnd(width)}   ${note}`).join("\n")

  console.log(`%cDangler%c is scriptable from here.\n\n${body}\n`, "font-weight:600", "font-weight:400")
}

export function createApi(controls: Controls, wakeLock: WakeLock, scene: Dangler): ExperimentApi {
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
      CONTROLS.map((control) => ({
        key: control.key,
        group: control.group,
        label: control.label,
        min: control.min,
        max: control.max,
        hint: control.hint,
      })),

    reroll: (seed) => controls.reroll(seed),

    settle: () => scene.settle(),

    debug: (on) => scene.setDebug(on),

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

    stats: () => scene.stats(),
  }
}
