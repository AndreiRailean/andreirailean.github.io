/**
 * The speed control, which the kit provides to every piece — #312.
 *
 * Andrei, 2026-10-18: "playback is a control for the kit to provide. we don't
 * have a single experiment yet that is not pausable." And on what 1× means:
 * "on pieces where the presets are mostly at the lowest end of the range, it's
 * an indication that there's nothing interesting at the high end for the
 * experiment and the scale can be adjusted for finer adjustments within the
 * interesting range rather than having a generic multiplier. for flotsam, the
 * 0.2 is probably the 100% speed that we're interested."
 *
 * So **1× is the piece's own natural speed**, not the wall clock: each piece
 * states the clock rate its 1× stands for (`clockRate`), and the slider runs
 * evenly either side of it on a log track, a tenth to ten times. There is no 0
 * — holding the scene is pause's job, the corner button and Space, and pausing
 * moves no setting.
 *
 * It replaced six hand-written `playback` controls that disagreed on their
 * label, their range, whether 0 was allowed and whether the track was log. The
 * setting's key is `timescale` rather than `playback`, because what the number
 * means changed and an address cannot tell two meanings of one key apart; an
 * old `playback` is read once, through `fromPlayback`, and converted.
 */

import type { Slot } from "@/experiments/address"
import type { SliderControl, Track } from "@/experiments/kit/controls"

export const TIMESCALE_KEY = "timescale"

/** A tenth to ten times the piece's natural speed. Three significant figures anywhere on it. */
export const TIMESCALE_TRACK = { min: 0.1, max: 10, step: 0.001, scale: "log" } as const satisfies Track

/**
 * The address slot, the same in every piece. Fine enough for the log track's
 * finest grid, 0.001 below 1×, so whatever the slider can land on survives the
 * address.
 */
export const TIMESCALE_SLOT: Slot = { key: TIMESCALE_KEY, kind: "num", grid: 0.001, origin: 0.1, bits: 14 }

const HINT =
  "How fast you are watching, the way a video player means it. 1× is this piece at its own natural speed; everything time-dependent slows or quickens by the same factor, so a half is the same scene taken slowly rather than a different one. Pause holds it still."

/**
 * The control, for a piece's `CONTROLS`.
 *
 * `min` and `max` narrow the kit's track for a piece whose stepping cannot use
 * all of it — crowd and walkers step in whole 1/120 s ticks and stutter below
 * half speed, and cap their catch-up near 2×. Narrowing is the only change a
 * piece may make; the label, the scale and the meaning are the kit's.
 */
/**
 * **Call it as `/* @__PURE__ *\/ timescaleControl(...)`.** `CONTROLS` calls this
 * at module scope, and a call the bundler cannot prove pure pins the whole
 * control list — every hint in the panel — into every showcase runner (#243).
 * esbuild 0.28 ignores `@__NO_SIDE_EFFECTS__` on the declaration across
 * modules, and a spread of a shared object pins it the same way; measured
 * 2026-10-18. `tests/unit/runner-bundle.test.ts` fails a piece that forgets.
 */
export function timescaleControl<G extends string>(options: {
  group?: G
  min?: number
  max?: number
}): SliderControl<typeof TIMESCALE_KEY> & { group: G } {
  return {
    kind: "slider",
    key: TIMESCALE_KEY,
    label: "speed",
    ...(options.group === undefined ? {} : { group: options.group }),
    min: options.min ?? TIMESCALE_TRACK.min,
    max: options.max ?? TIMESCALE_TRACK.max,
    step: TIMESCALE_TRACK.step,
    scale: TIMESCALE_TRACK.scale,
    format: (value) => `${Number(value.toPrecision(2))}×`,
    hint: HINT,
  } as SliderControl<typeof TIMESCALE_KEY> & { group: G }
}

/** The track a piece's `TRACKS` holds for it — the kit's, narrowed the same way as the control. */
export function timescaleTrack(options: { min?: number; max?: number } = {}): Track {
  return { ...TIMESCALE_TRACK, min: options.min ?? TIMESCALE_TRACK.min, max: options.max ?? TIMESCALE_TRACK.max }
}

/**
 * An older scene's `playback`, as a `timescale`.
 *
 * `playback` was a multiplier on the wall clock; `timescale` is one on the
 * piece's natural rate, so the conversion is a division by `clockRate`. A
 * `playback` of 0 meant held, which is pause's now, so it becomes the slowest
 * the piece allows rather than a held scene. Removes `playback` from the scene
 * either way, so it cannot ride along into the settings.
 */
export function fromPlayback<S extends object>(scene: S, clockRate: number): S {
  if (!("playback" in scene)) return scene
  const { playback, ...rest } = scene as S & { playback: unknown }
  if (TIMESCALE_KEY in rest) return rest as S
  const value = Number(playback)
  return { ...rest, [TIMESCALE_KEY]: Number.isFinite(value) ? value / clockRate : 1 } as S
}
