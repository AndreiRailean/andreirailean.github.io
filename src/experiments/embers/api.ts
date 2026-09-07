import { createBaseApi, type BaseApi } from "@/experiments/kit/api"
import type { Controls } from "@/experiments/kit/controls"
import type { WakeLock } from "@/experiments/kit/wakelock"
import type { Embers, EmbersStats } from "@/experiments/embers/embers"
import {
  CONTROLS,
  keysOf,
  normalizeSettings,
  PRESETS,
  settingsFromQuery,
  type Settings,
} from "@/experiments/embers/settings"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser and
 * hard to poke at by hand, so every control is also reachable from here. Values
 * pass through the same validator the query string does, so the API cannot put
 * the fire into a state a URL could not.
 */
export type ExperimentApi = BaseApi<Settings> & {
  /** Every control the panel shows, in panel order, one entry per settings key. */
  controls: () => ControlReport[]
  /** What the fire is doing, and what it costs to draw. */
  stats: () => EmbersStats
  /**
   * Run the fire forward without waiting for it, in seconds.
   *
   * The piece needs it more than the others do. An ember takes a couple of
   * seconds to cross the frame and the picture is built up over frames wherever
   * `trail` is above zero, so "the scene" does not exist at t=0 in either sense.
   * The poster recipe, the note's backdrop and the reduced-motion still all go
   * through this.
   */
  settle: (seconds: number) => void
  /** Make the fire surge now, whatever the burst rate says. Also the `b` key. */
  burst: () => void
  /** Draw the air itself: the plume's envelope and every live vortex. */
  debug: (on?: boolean) => boolean
}

/**
 * Printed once on load rather than on devtools opening, which cannot be detected
 * reliably. The console keeps it, so it is waiting whenever the panel is opened.
 */
export function announceApi(): void {
  const lines = [
    ["experiment.get()", "current settings"],
    ["experiment.set({ hue: 200 })", "change one or more"],
    ['experiment.preset("foxfire")', "load a preset by name or number"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.burst()", "make the fire surge (or press b)"],
    ["experiment.settle(20)", "run the fire forward twenty seconds"],
    ["experiment.debug(true)", "draw the plume and its vortices"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the fire where it is, or let it run on"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.stats()", "embers alive and drawn, vortices, vigour, fps"],
    ["experiment.decode(url)", "what scene an address describes"],
    ["experiment.url()", "a link that restores this exact state"],
  ]
  const width = Math.max(...lines.map(([call]) => call!.length))
  const body = lines.map(([call, note]) => `  ${call!.padEnd(width)}   ${note}`).join("\n")

  console.log(`%cEmbers%c is scriptable from here.\n\n${body}\n`, "font-weight:600", "font-weight:400")
}

/**
 * One entry per **settings key**, not per control.
 *
 * A range owns two keys, so a piece that maps `control.key` straight through
 * reports `undefined` for it — and a sweep that then writes to that key writes
 * to a setting no piece has and passes because nothing moved. See #85 and
 * `tests/kit.spec.ts`, which holds every piece to this shape.
 *
 * **This is the sixth copy and it is not meant to survive.** #162 hoists a
 * `ControlReport` and a `reportControls(CONTROLS)` into `kit/api.ts`, which is
 * the right home — it is one shape every piece has to agree on and three of the
 * existing copies got it wrong in the same way, reporting `min: 0, max: 0` for a
 * control that has no track. It had not landed when this piece was written, so
 * what is here is the discriminated-union form rather than the flat one, which
 * at least cannot invent bounds. **When #162 lands, delete this type and the
 * body below and write `controls: () => reportControls(CONTROLS)`.**
 */
export type ControlReport =
  | { kind: "slider" | "range"; key: string; label: string; hint: string; min: number; max: number }
  | { kind: "choice" | "set"; key: string; label: string; hint: string; options: string[] }
  | { kind: "toggle"; key: string; label: string; hint: string }

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, fire: Embers): ExperimentApi {
  let debugging = false

  return {
    // The chrome half — get, set, preset, presets, panel, pause, decode, idle,
    // url, fullscreen, awake — comes from the kit. See
    // `@/experiments/kit/api`. `fire` is this piece's scene, and all the base
    // handle asks of it is `setPaused`.
    ...createBaseApi({
      controls,
      wakeLock,
      scene: fire,
      presets: PRESETS,
      normalize: normalizeSettings,
      fromQuery: settingsFromQuery,
    }),

    controls: () =>
      CONTROLS.flatMap((control): ControlReport[] =>
        keysOf(control).map((key): ControlReport => {
          const shared = { key: String(key), label: control.label, hint: control.hint }
          switch (control.kind) {
            case "choice":
              return { kind: "choice", ...shared, options: control.options.map(({ value }) => value) }
            case "toggle":
              return { kind: "toggle", ...shared }
            case "set":
              return { kind: "set", ...shared, options: control.options.map(({ value }) => value) }
            default:
              return { kind: control.kind, ...shared, min: control.min, max: control.max }
          }
        }),
      ),

    stats: () => fire.stats(),

    settle(seconds) {
      fire.settle(Math.max(0, Math.min(600, Number(seconds) || 0)))
    },

    burst() {
      fire.burst()
    },

    debug(on) {
      debugging = on === undefined ? !debugging : Boolean(on)
      fire.setDebug(debugging)
      return debugging
    },
  }
}
