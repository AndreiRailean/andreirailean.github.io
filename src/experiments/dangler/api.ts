import type { Dangler, DanglerStats } from "@/experiments/dangler/dangler"
import { reroll } from "@/experiments/dangler/reroll"
import { createBaseApi, type BaseApi } from "@/experiments/kit/api"
import { keysOf, type Controls } from "@/experiments/kit/controls"
import { CONTROLS, normalizeSettings, PRESETS, type Settings } from "@/experiments/dangler/settings"
import type { WakeLock } from "@/experiments/kit/wakelock"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser, so
 * every control is reachable from here too. Values pass through the same
 * clamping the query string uses, so the API cannot reach a state a URL could
 * not.
 */
export type ExperimentApi = BaseApi<Settings> & {
  /** Every control with its group, bounds and blurb. */
  controls: () => { key: string; group: string; label: string; min: number; max: number; hint: string }[]
  /** A fresh arrangement. Omit for a random seed; returns the seed used. */
  reroll: (seed?: number) => number
  /**
   * Run the strands to rest and redraw.
   *
   * Needed for stills more than for anything interactive: a screenshot taken
   * while the scene is still relaxing shows a shape it never actually holds, and
   * nothing about the image says so.
   */
  settle: () => void
  /** Draw the strands, anchors and canopy the piece otherwise never shows. */
  debug: (on: boolean) => void
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
    ["experiment.settle()", "run the strands to rest before looking"],
    ["experiment.debug(true)", "show the strands, anchors and canopy"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the strands where it is, or let it run on"],
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

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, scene: Dangler): ExperimentApi {
  return {
    // The chrome half — get, set, preset, presets, panel, pause, idle, url,
    // fullscreen, awake — comes from the kit. It was written out here, and
    // identically in three other pieces, until the fourth copy; see
    // src/experiments/kit/api.ts.
    ...createBaseApi({ controls, wakeLock, scene, presets: PRESETS, normalize: normalizeSettings }),

    // Flattened over `keysOf`, so a bound pair reports both of its ends —
    // matching Flotsam and Psyxels, and one entry per settings key.
    //
    // This read `control.key` directly until #85. A range control carries
    // `keys` and no `key`, so it would have reported `undefined` the day
    // Dangler gained one; it was correct only because Dangler has none. A
    // caller reading `.key` off such an entry writes to a setting no piece has,
    // and the assertion after it passes because nothing moved.
    controls: () =>
      CONTROLS.flatMap((control) =>
        keysOf(control).map((key) => ({
          key,
          group: control.group,
          label: control.label,
          min: control.min,
          max: control.max,
          hint: control.hint,
        })),
      ),

    reroll: (seed) => reroll(controls, seed),

    settle: () => scene.settle(),

    debug: (on) => scene.setDebug(on),

    stats: () => scene.stats(),
  }
}
