import { createBaseApi, reportControls, type BaseApi, type ControlReport } from "@/experiments/kit/api"
import type { Controls } from "@/experiments/kit/controls"
import type { WakeLock } from "@/experiments/kit/wakelock"
import { CONTROLS, normalizeSettings, PRESETS, type Settings, settingsFromQuery } from "@/experiments/crowd/settings"
import type { Crowd, CrowdStats } from "@/experiments/crowd/crowd"
import { reroll } from "@/experiments/crowd/reroll"

/**
 * A console handle on the piece, at `window.experiment`.
 *
 * Anything reachable only by pointer is untestable from a headless browser, and
 * this piece is worse than most: what it claims is almost entirely about
 * numbers no screenshot can settle. Whether anybody is walking through anybody,
 * whether the population is holding as the observer moves, whether the crowd at
 * the edge of the world is faint enough that the edge cannot be seen — every one
 * of those is `stats()`, and every one of them looks like a perfectly ordinary
 * field of white dots in a still.
 */
export type ExperimentApi = BaseApi<Settings> & {
  /** Every control the panel shows, in panel order, one entry per settings key. */
  controls: () => ControlReport[]
  /** What the crowd and the walk are doing right now, in numbers. */
  stats: () => CrowdStats
  /**
   * Walk forward without drawing, in seconds.
   *
   * The poster needs this and so does anything measuring a crowd that has sorted
   * itself out. At `t = 0` nobody has negotiated anything: the files have not
   * formed, no group has been squeezed, and half the frame is people on exactly
   * their preferred heading at exactly their preferred speed. That state lasts
   * about twenty seconds and is not what the piece looks like.
   */
  settle: (seconds: number) => CrowdStats
  /** A different set of strangers at the same settings. Returns the new seed. */
  reroll: (seed?: number) => number
}

/**
 * Printed once on load rather than on devtools opening, which cannot be detected
 * reliably. The console keeps it, so it is waiting whenever anyone comes looking.
 */
export function announceApi(): void {
  const lines = [
    ["experiment.get()", "current settings"],
    ["experiment.set({ density: 40 })", "change one or more"],
    ['experiment.preset("concourse")', "load a preset by name or number"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.settle(60)", "walk a minute without drawing it"],
    ["experiment.reroll()", "different strangers at the same settings"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the walk where it is, or let it run on"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.awake()", "is the display being held awake"],
    ["experiment.stats()", "who is out there, how close they got, and how far the world reaches"],
    ["experiment.url()", "a link that restores this exact state"],
  ]
  const width = Math.max(...lines.map(([call]) => call.length))
  const body = lines.map(([call, note]) => `  ${call.padEnd(width)}   ${note}`).join("\n")

  console.log(`%cCrowd%c is scriptable from here.\n\n${body}\n`, "font-weight:600", "font-weight:400")
}

export function createApi(controls: Controls<Settings>, wakeLock: WakeLock, crowd: Crowd): ExperimentApi {
  return {
    // The chrome half — get, set, preset, presets, panel, pause, idle, url,
    // decode, fullscreen, awake — comes from the kit. See kit/api.ts.
    ...createBaseApi({
      controls,
      wakeLock,
      scene: crowd,
      presets: PRESETS,
      normalize: normalizeSettings,
      fromQuery: settingsFromQuery,
    }),

    // The kit's, since #130. Every row here is a slider or a range, so a
    // hand-written flat shape would have been right — which is exactly how the
    // last three pieces got it wrong: the day a choice or a toggle is added, a
    // flat record has to invent a bound for it.
    controls: () => reportControls(CONTROLS),

    stats: () => crowd.stats(),

    settle(seconds) {
      crowd.settle(seconds)
      return crowd.stats()
    },

    reroll: (seed) => reroll(controls, seed),
  }
}
