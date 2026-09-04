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
      // The three choices, which have options rather than a track.
      if ((["subject", "face", "polarity"] as string[]).includes(key)) continue
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

  it("keeps the base's subject, face and polarity when handed ones that do not exist", () => {
    expect(normalizeSettings({ subject: "portrait" as never }).subject).toBe(DEFAULT_SETTINGS.subject)
    expect(normalizeSettings({ subject: "avatar" }).subject).toBe("avatar")
    expect(normalizeSettings({ subject: "Alive" }).subject).toBe("Alive")
    expect(normalizeSettings({ face: "comic" as never }).face).toBe(DEFAULT_SETTINGS.face)
    expect(normalizeSettings({ face: "script" }).face).toBe("script")
    expect(normalizeSettings({ polarity: "inverse" as never }).polarity).toBe(DEFAULT_SETTINGS.polarity)
    expect(normalizeSettings({ polarity: "void" }).polarity).toBe("void")
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
      polarity: "void",
      hue: 41,
      levels: 2,
      churn: 22,
    })
    expect(settingsFromQuery(settingsToQuery(scene))).toEqual(scene)
  })

  /**
   * **A link that rests on a default is a link whose scene moves when the
   * default does** — the same trap the presets are written out in full to
   * avoid, one layer down. Shorter addresses are not worth a shared scene that
   * quietly becomes a different one.
   */
  it("names every setting, so no address rests on a default", () => {
    const keys = Object.keys(DEFAULT_SETTINGS).sort()
    expect([...settingsToQuery(DEFAULT_SETTINGS).keys()].sort()).toEqual(keys)
    expect([...settingsToQuery(PRESETS[2]!.settings).keys()].sort()).toEqual(keys)
    expect(urlForSettings(DEFAULT_SETTINGS, "/experiments/psyxels/")).toContain("?")
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
    expect(settingsForLanding(new URLSearchParams("polarity=void")).featured).toBe(false)
    // The same rule the parser applies: a URL made only of junk carries nothing.
    expect(settingsForLanding(new URLSearchParams("tempo=fast")).featured).toBe(true)
  })
})

describe("the presets", () => {
  /**
   * **No preset inherits from another, or from the defaults.**
   *
   * They were spread over `DEFAULT_SETTINGS` at first, which reads as tidy and
   * is a trap: the day the featured scene changed, every preset that had not
   * named a setting silently took the new one's value for it, and half of them
   * ended up watched at a quarter speed. A scene someone found by dragging
   * sliders should stay the scene they found.
   */
  it("each state every setting, so none can drift when another is retuned", () => {
    const keys = Object.keys(DEFAULT_SETTINGS)
    for (const { label, settings } of PRESETS) {
      expect(Object.keys(settings).sort(), label).toEqual([...keys].sort())
    }
  })

  it("does not privilege the first: it is what a bare address lands on and nothing else", () => {
    const landing = settingsForLanding(new URLSearchParams(""))
    expect(landing.featured).toBe(true)
    expect(landing.settings).toEqual(normalizeSettings(PRESETS[0]!.settings))
    // And the address it rewrites to carries that scene in full rather than
    // standing for "whatever is first".
    const query = settingsToQuery(PRESETS[0]!.settings)
    expect([...query.keys()].length).toBeGreaterThan(10)
  })
})

describe("what a change costs", () => {
  /**
   * The piece's whole shape is in these two functions: everything absent from
   * them is read live, and can therefore be wound anywhere at all without a
   * psyx moving.
   */
  it("repacks for the packing controls and for nothing else", () => {
    for (const key of [
      "seed",
      "subject",
      "face",
      "polarity",
      "fill",
      "coarse",
      "levels",
      "detail",
      "variety",
      "fuzz",
    ] as const) {
      const value =
        key === "subject"
          ? "&"
          : key === "face"
            ? "script"
            : key === "polarity"
              ? "void"
              : Number(DEFAULT_SETTINGS[key]) / 2
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

  it("rasterises the subject again only when the subject, its face, its polarity or its size changed", () => {
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, subject: "avatar" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, face: "script" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, polarity: "void" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, fill: 0.5 })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, coarse: 40 })).toBe(false)
  })
})
