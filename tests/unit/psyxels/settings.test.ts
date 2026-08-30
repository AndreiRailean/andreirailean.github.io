import { describe, expect, it } from "vitest"
import { keysOf } from "@/experiments/kit/controls"
import {
  BOUNDS,
  CONTROLS,
  DEFAULT_SETTINGS,
  GROUP_ORDER,
  needsPacking,
  needsSubject,
  normalizeSettings,
  PRESETS,
  settingsForLanding,
  settingsFromQuery,
  settingsToQuery,
  urlForSettings,
  type NumericKey,
} from "@/experiments/psyxels/settings"

describe("bounds", () => {
  it("has a bound for every numeric setting, so nothing arrives unclamped", () => {
    for (const key of Object.keys(DEFAULT_SETTINGS) as NumericKey[]) {
      if (key === ("subject" as NumericKey) || key === ("face" as NumericKey)) continue
      expect(BOUNDS[key], key).toBeDefined()
    }
  })

  it("has a control for every setting except the seed", () => {
    const controlled = new Set<string>(CONTROLS.flatMap((control) => keysOf(control) as string[]))
    const missing = Object.keys(DEFAULT_SETTINGS).filter((key) => !controlled.has(key))
    expect(missing).toEqual(["seed"])
  })

  it("files every control under a heading the panel will render", () => {
    for (const control of CONTROLS) expect(GROUP_ORDER, control.label).toContain(control.group)
  })

  it("gives every logarithmic control a positive minimum, which the mapping requires", () => {
    for (const control of CONTROLS) {
      if (control.kind !== "choice" && control.scale === "log") expect(control.min, control.label).toBeGreaterThan(0)
    }
  })

  it("keeps every default and every preset inside its own bounds", () => {
    for (const { label, settings } of [{ label: "defaults", settings: DEFAULT_SETTINGS }, ...PRESETS]) {
      expect(normalizeSettings(settings), label).toEqual(settings)
    }
  })
})

describe("normalising", () => {
  it("clamps out of range and rounds what must be whole", () => {
    const settings = normalizeSettings({ wildness: 4, levels: 2.6, coarse: -30, vocabulary: 400 })
    expect(settings.wildness).toBe(BOUNDS.wildness.max)
    expect(settings.levels).toBe(3)
    expect(settings.coarse).toBe(BOUNDS.coarse.min)
    expect(settings.vocabulary).toBe(BOUNDS.vocabulary.max)
  })

  it("keeps the base's subject and face when handed ones that do not exist", () => {
    expect(normalizeSettings({ subject: "portrait" as never }).subject).toBe(DEFAULT_SETTINGS.subject)
    expect(normalizeSettings({ subject: "avatar" }).subject).toBe("avatar")
    expect(normalizeSettings({ face: "comic" as never }).face).toBe(DEFAULT_SETTINGS.face)
    expect(normalizeSettings({ face: "script" }).face).toBe("script")
  })

  it("fills gaps from the base rather than from the defaults when given one", () => {
    const base = normalizeSettings({ ...DEFAULT_SETTINGS, hue: 12, subject: "&" })
    const next = normalizeSettings({ wildness: 0.2 }, base)
    expect(next.hue).toBe(12)
    expect(next.subject).toBe("&")
  })
})

describe("the query string", () => {
  it("round-trips a scene", () => {
    const scene = normalizeSettings({
      ...DEFAULT_SETTINGS,
      subject: "avatar",
      face: "roman",
      hue: 41,
      levels: 2,
      churn: 22,
    })
    expect(settingsFromQuery(settingsToQuery(scene))).toEqual(scene)
  })

  it("carries only what differs from the defaults, so a link stays readable", () => {
    expect(settingsToQuery(DEFAULT_SETTINGS).toString()).toBe("")
    expect(urlForSettings(DEFAULT_SETTINGS, "/experiments/psyxels/")).toBe("/experiments/psyxels/")
    const query = settingsToQuery({ ...DEFAULT_SETTINGS, spread: 12 })
    expect([...query.keys()]).toEqual(["spread"])
  })

  /**
   * `Number(null)` is 0 and 0 is a legal value for most of these, so a bare
   * `Number()` on an absent parameter would silently still the field, empty the
   * colour and stop the clock.
   */
  it("ignores absent, blank and unparseable values rather than reading them as zero", () => {
    const settings = settingsFromQuery(new URLSearchParams("pulse=&tempo=fast&subject=flower"))
    expect(settings.pulse).toBe(DEFAULT_SETTINGS.pulse)
    expect(settings.tempo).toBe(DEFAULT_SETTINGS.tempo)
    expect(settings.subject).toBe(DEFAULT_SETTINGS.subject)
  })

  it("lands on the featured scene only when the address names nothing", () => {
    const bare = settingsForLanding(new URLSearchParams(""))
    expect(bare.featured).toBe(true)
    expect(bare.settings).toEqual(normalizeSettings(PRESETS[0]!.settings))

    expect(settingsForLanding(new URLSearchParams("hue=200")).featured).toBe(false)
    expect(settingsForLanding(new URLSearchParams("subject=avatar")).featured).toBe(false)
    expect(settingsForLanding(new URLSearchParams("face=script")).featured).toBe(false)
    // The same rule the parser applies: a URL made only of junk carries nothing.
    expect(settingsForLanding(new URLSearchParams("tempo=fast")).featured).toBe(true)
  })
})

describe("what a change costs", () => {
  /**
   * The piece's whole shape is in these two functions: everything absent from
   * them is read live, and can therefore be wound anywhere at all without a
   * psyx moving.
   */
  it("repacks for the packing controls and for nothing else", () => {
    for (const key of ["seed", "subject", "face", "fill", "coarse", "levels", "detail", "variety", "fuzz"] as const) {
      const value = key === "subject" ? "&" : key === "face" ? "grotesque" : Number(DEFAULT_SETTINGS[key]) / 2
      const next = normalizeSettings({ [key]: value })
      expect(needsPacking(DEFAULT_SETTINGS, next), key).toBe(true)
    }

    for (const key of [
      "hue",
      "spread",
      "wildness",
      "saturation",
      "pulse",
      "tempo",
      "wave",
      "flicker",
      "churn",
      "vocabulary",
      "weight",
      "inset",
      "threshold",
      "flatten",
      "playback",
    ] as const) {
      const next = normalizeSettings({ ...DEFAULT_SETTINGS, [key]: DEFAULT_SETTINGS[key] / 2 })
      expect(needsPacking(DEFAULT_SETTINGS, next), key).toBe(false)
    }
  })

  it("rasterises the subject again only when the subject, its face or its size changed", () => {
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, subject: "avatar" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, face: "script" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, fill: 0.5 })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, coarse: 40 })).toBe(false)
  })
})
