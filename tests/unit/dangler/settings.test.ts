import { describe, expect, it } from "vitest"
import {
  DEFAULT_SETTINGS,
  PRESETS,
  normalizeSettings,
  settingsFromQuery,
  settingsToQuery,
} from "@/experiments/dangler/settings"

/**
 * Settings round-trip through the query string, which is what makes a URL the
 * unit of sharing. A key that serialises but does not parse back, or a preset
 * written outside its own bounds, means a shared link quietly shows a different
 * scene than the one that was sent.
 */

describe("the query string", () => {
  it("round-trips a custom scene unchanged", () => {
    const custom = normalizeSettings({ seed: 91, wires: 8, hue: 200, hueSpread: 62, breeze: 0.4, pitch: 12 })
    expect(settingsFromQuery(settingsToQuery(custom))).toEqual(custom)
  })

  it("writes nothing for a default scene", () => {
    expect(settingsToQuery(DEFAULT_SETTINGS).toString()).toBe("")
  })

  it("keeps defaults for absent and empty params, rather than zeroing them", () => {
    expect(settingsFromQuery(new URLSearchParams("")).breeze).toBe(DEFAULT_SETTINGS.breeze)
    expect(settingsFromQuery(new URLSearchParams("hue=")).hue).toBe(DEFAULT_SETTINGS.hue)
  })
})

describe("normalizeSettings", () => {
  it("clamps out-of-range values to the bounds", () => {
    expect(normalizeSettings({ hue: 9999 }).hue).toBe(360)
    expect(normalizeSettings({ wires: -5 }).wires).toBe(1)
  })

  it("forces counts to whole numbers", () => {
    expect(normalizeSettings({ wires: 4.7, segments: 12.2 }).wires).toBe(5)
  })
})

describe("presets", () => {
  it.each(PRESETS.map((preset) => [preset.label, preset] as const))(
    "%s survives the query string",
    (_label, preset) => {
      const settings = normalizeSettings(preset.settings)
      expect(settingsFromQuery(settingsToQuery(settings))).toEqual(settings)
    },
  )

  // A preset is a recorded scene. Written as a spread over the defaults it would
  // drift the next time one of those was retuned, so every value is stated — and
  // therefore every value has to already be legal.
  it.each(PRESETS.map((preset) => [preset.label, preset] as const))(
    "%s is within bounds as written",
    (_label, preset) => {
      expect(normalizeSettings(preset.settings)).toEqual(preset.settings)
    },
  )

  it("has unique labels, since a number key selects one", () => {
    expect(new Set(PRESETS.map((preset) => preset.label)).size).toBe(PRESETS.length)
  })
})
