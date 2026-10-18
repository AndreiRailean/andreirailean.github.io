import { describe, expect, it } from "vitest"
import { encodeScene, type Slot } from "@/experiments/address"
import type { Control, SliderControl, Track } from "@/experiments/kit/controls"
import {
  fromPlayback,
  PLAYBACK_GROUP,
  TIMESCALE_KEY,
  TIMESCALE_SLOT,
  TIMESCALE_TRACK,
  timescaleControl,
} from "@/experiments/kit/speed"
import { pieces } from "../support/pieces.ts"

/**
 * Every piece offers the kit's speed control, and offers it unchanged — #312.
 *
 * Andrei, 2026-10-18: "playback is a control for the kit to provide [...] it
 * should be moved up to kit level if possible so we don't make mistakes when
 * reimplementing." Six hand-written `playback` controls had already drifted
 * apart on label, range, scale and the meaning of 0 by the time this was
 * written. So this holds the property rather than the list: a piece may narrow
 * the track, and nothing else.
 */

type SettingsModule = {
  CONTROLS: Control<string>[]
  TRACKS: Record<string, Track | undefined>
  REGISTRY: readonly Slot[]
  DEFAULT_SETTINGS: Record<string, unknown>
  CLOCK_RATE: number
  normalizeSettings: (patch: Record<string, unknown>) => Record<string, unknown>
  settingsFromQuery: (params: URLSearchParams) => Record<string, unknown>
}

const load = async (slug: string) =>
  (await import(`../../src/experiments/${slug}/settings.ts`)) as unknown as SettingsModule
const presetsOf = async (slug: string) =>
  ((await import(`../../src/experiments/${slug}/presets.ts`)) as { PRESETS: { settings: Record<string, unknown> }[] })
    .PRESETS

it("finds the pieces, so an empty run cannot pass for a clean one", () => {
  expect(pieces.length).toBeGreaterThan(1)
})

describe.each(pieces)("%s", (slug) => {
  it("offers the kit's speed control, narrowed at most", async () => {
    const { CONTROLS, TRACKS } = await load(slug)
    const speed = CONTROLS.filter((control) => "key" in control && control.key === TIMESCALE_KEY)
    expect(speed, `${slug} has no speed control — add timescaleControl() from kit/speed`).toHaveLength(1)
    const control = speed[0] as SliderControl<string>
    const kit = timescaleControl()
    for (const field of ["kind", "label", "group", "step", "scale", "hint"] as const)
      expect(control[field], `${slug}'s speed control changed its ${field}`).toEqual(kit[field])
    expect(control.format(2.5)).toBe(kit.format(2.5))
    expect(control.min).toBeGreaterThanOrEqual(TIMESCALE_TRACK.min)
    expect(control.max).toBeLessThanOrEqual(TIMESCALE_TRACK.max)
    expect(control.min, "a speed that reaches 0 is a pause, and pause is the kit's").toBeGreaterThan(0)
    expect(TRACKS[TIMESCALE_KEY], `${slug}'s track and control disagree`).toEqual({
      ...TIMESCALE_TRACK,
      min: control.min,
      max: control.max,
    })
  })

  it("puts speed last, in the playback group", async () => {
    const { CONTROLS } = await load(slug)
    const last = CONTROLS[CONTROLS.length - 1]!
    expect("key" in last && last.key, `${slug}'s last control is not speed`).toBe(TIMESCALE_KEY)
    expect(last.group).toBe(PLAYBACK_GROUP)
  })

  it("has no speed of its own beside it", async () => {
    const { CONTROLS, REGISTRY } = await load(slug)
    const labels = CONTROLS.filter((control) => control.label === "playback" || control.label === "speed")
    expect(labels.map((control) => ("key" in control ? control.key : control.keys.join()))).toEqual([TIMESCALE_KEY])
    const live = REGISTRY.filter((slot) => slot.key === "playback" && !slot.retired)
    expect(live, `${slug} still writes playback`).toEqual([])
  })

  it("carries the kit's slot in its address, and states its clock rate", async () => {
    const { REGISTRY, CLOCK_RATE } = await load(slug)
    expect(REGISTRY.filter((slot) => slot.key === TIMESCALE_KEY)).toEqual([TIMESCALE_SLOT])
    expect(CLOCK_RATE).toBeGreaterThan(0)
  })

  it("puts its default and every preset inside the range it offers", async () => {
    const { CONTROLS, DEFAULT_SETTINGS } = await load(slug)
    const control = CONTROLS.find((c) => "key" in c && c.key === TIMESCALE_KEY) as SliderControl<string>
    const values = [DEFAULT_SETTINGS[TIMESCALE_KEY], ...(await presetsOf(slug)).map((p) => p.settings[TIMESCALE_KEY])]
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(control.min)
      expect(value).toBeLessThanOrEqual(control.max)
    }
  })
})

/**
 * **An address written before the speed control still plays at its old rate.**
 * The registry as it stood then is this one with `playback` live and no
 * `timescale`, so each piece's presets are encoded against that and read back
 * through the piece's own reader.
 */
describe.each(pieces)("%s, read from an address written with playback", (slug) => {
  it("comes back at the same rate", async () => {
    const { REGISTRY, CLOCK_RATE, settingsFromQuery } = await load(slug)
    const playback = REGISTRY.findIndex((slot) => slot.key === "playback")
    if (playback < 0) return // never had one
    const before = REGISTRY.filter((slot) => slot.key !== TIMESCALE_KEY).map((slot, index) => {
      if (index !== playback) return slot
      const live: Slot = { ...slot }
      delete (live as { retired?: true }).retired
      return live
    })
    for (const preset of await presetsOf(slug)) {
      const timescale = preset.settings[TIMESCALE_KEY] as number
      const rest = { ...preset.settings }
      delete rest[TIMESCALE_KEY]
      const old = encodeScene(before, { ...rest, playback: timescale * CLOCK_RATE })
      const read = settingsFromQuery(new URLSearchParams({ s: old }))
      expect(read[TIMESCALE_KEY]).toBeCloseTo(timescale, 2)
      expect(read, "playback rode along into the settings").not.toHaveProperty("playback")
    }
  })
})

describe("fromPlayback", () => {
  it("divides an old playback by the piece's clock rate and drops it", () => {
    expect(fromPlayback({ playback: 0.3, seed: 1 }, 0.2)).toEqual({ timescale: 0.3 / 0.2, seed: 1 })
  })

  it("leaves a scene with no playback, or one already carrying a timescale, alone", () => {
    expect(fromPlayback({ seed: 1 }, 0.5)).toEqual({ seed: 1 })
    expect(fromPlayback({ playback: 2, timescale: 3 }, 0.5)).toEqual({ timescale: 3 })
  })
})
