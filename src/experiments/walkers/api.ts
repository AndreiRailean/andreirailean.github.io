import { createBaseApi, type BaseApi } from "@/experiments/kit/api"
import type { Controls } from "@/experiments/kit/controls"
import type { WakeLock } from "@/experiments/kit/wakelock"
import { CONTROLS, keysOf, normalizeSettings, PRESETS, type Settings } from "@/experiments/walkers/settings"
import type { Walkers, WalkersStats } from "@/experiments/walkers/walkers"
import { reroll } from "@/experiments/walkers/reroll"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser, and
 * a crowd is worse than most: nearly everything worth checking here is a claim
 * about numbers that no screenshot can settle. Whether people are walking
 * through each other, whether the population is holding, whether children come
 * out smaller than adults by the right factor — all of it is `stats()`, and none
 * of it is visible in a still.
 */
export type ExperimentApi = BaseApi<Settings> & {
  /** Every control the panel shows, in panel order, one entry per settings key. */
  controls: () => ControlReport[]
  /** What the crowd is doing right now, in numbers. */
  stats: () => WalkersStats
  /**
   * Run the park forward without drawing it, in seconds.
   *
   * The poster needs this and so does anything measuring a crowd that has
   * settled: people arrive over the first half-minute, groups take that long
   * again to reach the spots they are going to, and a frame taken at t=0 is a
   * picture of an empty field with a few people at the edges of it.
   */
  settle: (seconds: number) => WalkersStats
  /** A fresh crowd at the same settings. Returns the new seed. */
  reroll: (seed?: number) => number
  /** Goals, bodies and gaze rays over the top. */
  debug: (on?: boolean) => boolean
}

export type ControlReport =
  | { kind: "slider" | "range"; key: string; label: string; hint: string; group?: string; min: number; max: number }
  | { kind: "choice"; key: string; label: string; hint: string; group?: string; options: string[] }
  | { kind: "toggle"; key: string; label: string; hint: string; group?: string }

/**
 * Printed once on load rather than on devtools opening, which cannot be
 * detected reliably. The console keeps it, so it is waiting whenever anyone
 * comes looking.
 */
export function announceApi(): void {
  const lines = [
    ["experiment.get()", "current settings"],
    ["experiment.set({ density: 20 })", "change one or more"],
    ['experiment.preset("crossing")', "load a preset by name or number"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.settle(60)", "run a minute of park without drawing it"],
    ["experiment.reroll()", "a different crowd at the same settings"],
    ["experiment.debug(true)", "goals, bodies and gaze rays over the top"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the park where it is, or let it run on"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.awake()", "is the display being held awake"],
    ["experiment.stats()", "who is out there, how fast, and how far anyone has been pushed into anyone"],
    ["experiment.url()", "a link that restores this exact state"],
  ]
  const width = Math.max(...lines.map(([call]) => call.length))
  const body = lines.map(([call, note]) => `  ${call.padEnd(width)}   ${note}`).join("\n")

  console.log(`%cWalkers%c is scriptable from here.\n\n${body}\n`, "font-weight:600", "font-weight:400")
}

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, park: Walkers): ExperimentApi {
  let debugging = false

  return {
    // The chrome half — get, set, preset, presets, panel, pause, idle, url,
    // fullscreen, awake — comes from the kit. See src/experiments/kit/api.ts.
    ...createBaseApi({ controls, wakeLock, scene: park, presets: PRESETS, normalize: normalizeSettings }),

    /**
     * One entry per **settings key**, flattened over `keysOf`.
     *
     * A range control owns two keys and has `keys` rather than a `key`, so a
     * piece mapping `control.key` straight through reports `undefined` for it —
     * see #85, where generic code did exactly that, wrote its patch to a setting
     * no piece has, and passed because nothing had moved. `pace` is a range
     * here, so this piece would have hit it.
     */
    controls: () =>
      CONTROLS.flatMap((control): ControlReport[] =>
        keysOf(control).map((key): ControlReport => {
          const shared = { key: String(key), label: control.label, hint: control.hint, group: control.group }
          switch (control.kind) {
            case "choice":
              return { kind: "choice", ...shared, options: control.options.map(({ value }) => value) }
            case "toggle":
              return { kind: "toggle", ...shared }
            default:
              return { kind: control.kind, ...shared, min: control.min, max: control.max }
          }
        }),
      ),

    stats: () => park.stats(),

    settle(seconds) {
      park.settle(seconds)
      return park.stats()
    },

    reroll: (seed) => reroll(controls, seed),

    debug(on) {
      debugging = on ?? !debugging
      park.setDebug(debugging)
      return debugging
    },
  }
}
