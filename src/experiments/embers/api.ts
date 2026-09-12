import { createBaseApi, reportControls, type BaseApi, type ControlReport } from "@/experiments/kit/api"
import type { Controls } from "@/experiments/kit/controls"
import type { WakeLock } from "@/experiments/kit/wakelock"
import type { Embers, EmbersStats } from "@/experiments/embers/embers"
import { CONTROLS, normalizeSettings, PRESETS, settingsFromQuery, type Settings } from "@/experiments/embers/settings"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser and
 * hard to poke at by hand, so every control is also reachable from here. Values
 * pass through the same validator the query string does, so the API cannot put
 * the fire into a state a URL could not.
 */
export type ExperimentApi = BaseApi<Settings> & {
  /**
   * Every control the panel shows, in panel order, **one entry per settings
   * key** rather than per control — a range owns two.
   */
  controls: () => ControlReport[]
  /** What the fire is doing, and what it costs to draw. */
  stats: () => EmbersStats
  /**
   * Run the fire forward without waiting for it, in seconds.
   *
   * The piece needs it more than the others do. An ember takes a couple of
   * seconds to cross the frame and the picture is built up over frames wherever
   * `shutter` is above zero, so "the scene" does not exist at t=0 in either
   * sense.
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

    // The kit's, since #162. Every piece wrote this switch out and three of
    // them invented `min: 0, max: 0` for a control that has no track.
    controls: () => reportControls(CONTROLS),

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
