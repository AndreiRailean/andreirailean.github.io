import type { Flotsam, FlotsamStats } from "@/experiments/flotsam/flotsam"
import { reroll } from "@/experiments/flotsam/reroll"
import { CONTROLS, normalizeSettings, PRESETS, type Settings } from "@/experiments/flotsam/settings"
import { createBaseApi, type BaseApi } from "@/experiments/kit/api"
import { keysOf, type Controls } from "@/experiments/kit/controls"
import type { WakeLock } from "@/experiments/kit/wakelock"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser, so
 * every control is reachable from here too. Values pass through the same
 * clamping the query string uses, so the API cannot reach a state a URL could
 * not.
 *
 * `run()` is the one addition to the section's minimum surface that is really
 * this piece's own, and it is the counterpart of Dangler's `settle()`. Almost
 * everything worth measuring here is slow: the flotsam takes a wave period or
 * two to gather into lines, and wave drift moves it at centimetres a second.
 * Neither a poster nor a test can wait for that in real time.
 */
export type ExperimentApi = BaseApi<Settings> & {
  /** Every control with its group, bounds and blurb. One entry per setting. */
  controls: () => { key: string; group: string; label: string; min: number; max: number; hint: string }[]
  /** A fresh sea and a fresh scattering. Omit for a random seed; returns the seed used. */
  reroll: (seed?: number) => number
  /**
   * Run the sea forward by this many seconds at once, then redraw.
   *
   * Stepped internally rather than jumped, so the current curves through the
   * eddies instead of cutting across them.
   */
  run: (seconds: number) => void
  /** Draw the wave crests and the current, which the piece never shows. */
  debug: (on: boolean) => void
  /** What the sea is doing, what it costs to draw, and how fast it runs. */
  stats: () => FlotsamStats
}

/**
 * Printed once on load rather than on devtools opening, which cannot be detected
 * reliably. The console keeps it, so it is waiting whenever it is looked for.
 */
export function announceApi(): void {
  const lines = [
    ["experiment.get()", "current settings"],
    ["experiment.set({ steepness: 0.9 })", "change one or more"],
    [`experiment.preset(${JSON.stringify(PRESETS[0]?.label ?? "")})`, "load a preset by name or number"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "a fresh sea and a fresh scattering (or press r)"],
    ["experiment.run(60)", "skip a minute of sea forward"],
    ["experiment.debug(true)", "show the crests and the current"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the sea where it is, or let it run on"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.awake()", "is the display being held awake"],
    ["experiment.stats()", "gathering, folding, orbit against transport, fps"],
    ["experiment.url()", "a link that restores this exact scene"],
  ]
  const width = Math.max(...lines.map(([call]) => call.length))
  const body = lines.map(([call, note]) => `  ${call.padEnd(width)}   ${note}`).join("\n")

  console.log(`%cFlotsam%c is scriptable from here.\n\n${body}\n`, "font-weight:600", "font-weight:400")
}

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, scene: Flotsam): ExperimentApi {
  return {
    // The chrome half — get, set, preset, presets, panel, pause, idle, url,
    // fullscreen, awake — comes from the kit. It was written out here, and
    // identically in three other pieces, until the fourth copy; see
    // src/experiments/kit/api.ts.
    ...createBaseApi({ controls, wakeLock, scene, presets: PRESETS, normalize: normalizeSettings }),

    // Flattened over `keysOf`, so a bound pair reports both of its ends. The
    // browser suite checks that every setting has a control this way, and a
    // range row that reported only its label would look like two missing ones.
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

    run: (seconds) => scene.run(seconds),

    debug: (on) => scene.setDebug(on),

    stats: () => scene.stats(),
  }
}
