import { describe, expect, it } from "vitest"
import {
  DEFAULT_SETTINGS,
  PRESETS,
  normalizeSettings,
  settingsForLanding,
  settingsFromQuery,
  settingsToQuery,
  urlForSettings,
} from "@/experiments/dangler/settings"

/**
 * Settings round-trip through the query string, which is what makes a URL the
 * unit of sharing. A key that serialises but does not parse back, or a preset
 * written outside its own bounds, means a shared link quietly shows a different
 * scene than the one that was sent.
 */

describe("the query string", () => {
  it("round-trips a custom scene unchanged", () => {
    const custom = normalizeSettings({ seed: 91, strands: 8, hue: 200, hueSpread: 62, breeze: 0.4, pitch: 12 })
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
    expect(normalizeSettings({ strands: -5 }).strands).toBe(1)
  })

  it("forces counts to whole numbers", () => {
    expect(normalizeSettings({ strands: 4.7, segments: 12.2 }).strands).toBe(5)
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

/**
 * What a bare URL means.
 *
 * Landing shows the first preset rather than `DEFAULT_SETTINGS`. The two are
 * separate jobs: the defaults are the base a URL is written as a diff against
 * and the scene anything rendering the piece without choosing gets, while the
 * landing scene is editorial and expected to change.
 */
describe("landing", () => {
  it("shows the first preset when the URL names no settings", () => {
    const { settings, featured } = settingsForLanding(new URLSearchParams(""))
    expect(settings).toEqual(normalizeSettings(PRESETS[0]!.settings))
    expect(featured).toBe(true)
  })

  it("still shows the first preset when the URL carries only escape hatches", () => {
    // `panel`, `idle`, `debug` and `settle` are not settings and never appear in
    // a shared scene, so a URL made only of them carries no scene.
    const { featured } = settingsForLanding(new URLSearchParams("panel=1&idle=0&settle=1"))
    expect(featured).toBe(true)
  })

  it("leaves a URL that names even one setting alone", () => {
    const { settings, featured } = settingsForLanding(new URLSearchParams("strands=9"))
    expect(featured).toBe(false)
    expect(settings.strands).toBe(9)
    // Everything unnamed stays at the defaults, not at the first preset's values.
    expect(settings.hue).toBe(DEFAULT_SETTINGS.hue)
  })

  it("treats blank and unparseable values as naming nothing, exactly as the parser does", () => {
    // Both of these are skipped by `settingsFromQuery`, so a URL made of them
    // would otherwise land on the defaults — the state this exists to avoid.
    expect(settingsForLanding(new URLSearchParams("hue=")).featured).toBe(true)
    expect(settingsForLanding(new URLSearchParams("hue=nonsense")).featured).toBe(true)
  })

  it("hands back an address that restores the scene it landed on", () => {
    const { settings } = settingsForLanding(new URLSearchParams(""))
    const url = urlForSettings(settings, "/experiments/dangler/")
    expect(settingsFromQuery(new URLSearchParams(url.split("?")[1]))).toEqual(settings)
  })

  it("writes no query for a scene that is the defaults", () => {
    expect(urlForSettings(DEFAULT_SETTINGS, "/experiments/dangler/")).toBe("/experiments/dangler/")
  })
})
