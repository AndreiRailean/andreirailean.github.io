import { describe, expect, it } from "vitest"
import { keysOf } from "@/experiments/kit/controls"
import {
  BOUNDS,
  CONTROLS,
  DEFAULT_SETTINGS,
  GROUP_ORDER,
  needsPacking,
  needsSubject,
  isTrackedControl,
  levelsOf,
  COARSEST_MIN,
  normalizeSettings,
  REGISTRY,
  settingsFromQuery,
  settingsToQuery,
  urlForSettings,
  type NumericKey,
} from "@/experiments/psyxels/settings"
import { PRESETS } from "@/experiments/psyxels/presets"
import { LOCAL_PORTRAIT, TEXT_BYTES } from "@/experiments/psyxels/subject"
import { encodeScene, type Slot } from "@/experiments/address"
import type { GlyphName } from "@/experiments/psyxels/glyphs"
import * as module from "@/experiments/psyxels/settings"
import { settingsForLanding as landing } from "@/experiments/piece"

/** The landing rule as the gallery's boot applies it to this piece. */
const settingsForLanding = (params: URLSearchParams) => landing(module, PRESETS, params)

describe("bounds", () => {
  it("has a bound for every numeric setting, so nothing arrives unclamped", () => {
    for (const key of Object.keys(DEFAULT_SETTINGS) as NumericKey[]) {
      // The choices and the glyph set, which have options rather than a track.
      if ((["subject", "text", "picture", "face", "polarity", "glyphs", "dither"] as string[]).includes(key)) continue
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
      if (isTrackedControl(control) && control.scale === "log") expect(control.min, control.label).toBeGreaterThan(0)
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
    const settings = normalizeSettings({ wildness: 4, coarse: -30 })
    expect(settings.wildness).toBe(BOUNDS.wildness.max)
    // The sizes share one track, so the biggest has a floor of its own.
    expect(settings.coarse).toBe(COARSEST_MIN)
  })

  /**
   * The smallest psyx is the biggest halved a whole number of times, up to
   * five. The handle is kept between those ends and the field takes the nearest
   * halving — the handle itself is not snapped, or a keyboard step could never
   * leave it.
   */
  it("reads the nearest halving off the smallest handle, and keeps it in range", () => {
    expect(levelsOf(normalizeSettings({ coarse: 0.16, finest: 0.021 }))).toBe(3)
    expect(normalizeSettings({ coarse: 0.16, finest: 0.5 }).finest).toBe(0.16)
    expect(normalizeSettings({ coarse: 0.16, finest: 0.0001 }).finest).toBe(0.005)
    // A step too small to change the count still moves the handle.
    expect(normalizeSettings({ coarse: 0.16, finest: 0.159 }).finest).toBe(0.159)
    // Moving the biggest leaves the smallest where it was.
    const before = normalizeSettings({ coarse: 0.16, finest: 0.02 })
    expect(normalizeSettings({ coarse: 0.32 }, before).finest).toBe(0.02)
  })

  it("reads levels, from before the sizes were a range, as the smallest size", () => {
    const old = normalizeSettings({ coarse: 0.16, levels: 2 } as never)
    expect(old.finest).toBe(0.04)
    expect("levels" in old).toBe(false)
    expect(settingsFromQuery(new URLSearchParams("coarse=0.16&levels=3")).finest).toBe(0.02)
  })

  it("keeps the base's subject, face and polarity when handed ones that do not exist", () => {
    expect(normalizeSettings({ subject: "portrait" as never }).subject).toBe(DEFAULT_SETTINGS.subject)
    expect(normalizeSettings({ subject: "picture" }).subject).toBe("picture")
    expect(normalizeSettings({ subject: "text" }).subject).toBe("text")
    expect(normalizeSettings({ face: "comic" as never }).face).toBe(DEFAULT_SETTINGS.face)
    expect(normalizeSettings({ face: "script" }).face).toBe("script")
    expect(normalizeSettings({ polarity: "inverse" as never }).polarity).toBe(DEFAULT_SETTINGS.polarity)
    expect(normalizeSettings({ polarity: "void" }).polarity).toBe("void")
  })

  /**
   * Every address written before #263 names one of six fixed subjects, through
   * a slot that is retired and still read. Five were text with the string
   * fixed; the sixth was the portrait.
   */
  it("reads a subject named the old way as the scene it meant", () => {
    expect(normalizeSettings({ subject: "Luna" as never })).toMatchObject({ subject: "text", text: "Luna" })
    expect(normalizeSettings({ subject: "&" as never })).toMatchObject({ subject: "text", text: "&" })
    expect(normalizeSettings({ subject: "avatar" as never })).toMatchObject({
      subject: "picture",
      picture: LOCAL_PORTRAIT,
    })
    const named = settingsFromQuery(new URLSearchParams("subject=Alive&face=script"))
    expect(named).toMatchObject({ subject: "text", text: "Alive", face: "script" })
  })

  it("decodes an address written before #263 to the same subject", () => {
    // Packed with the registry as it stood: the retired subject slot, no text.
    const before = REGISTRY.slice(0, REGISTRY.findIndex((slot) => slot.key === "playback") + 1)
    expect(before.find((slot) => slot.key === "subject")?.retired).toBe(true)
    const old = encodeScene(
      before.map(({ retired: _, ...slot }) => slot as Slot),
      { ...DEFAULT_SETTINGS, subject: "Luna" },
    )
    expect(settingsFromQuery(new URLSearchParams({ s: old }))).toMatchObject({ subject: "text", text: "Luna" })
  })

  it("cuts typed text to what the address will keep", () => {
    const long = "x".repeat(TEXT_BYTES + 10)
    expect(normalizeSettings({ text: long }).text).toHaveLength(TEXT_BYTES)
    const scene = normalizeSettings({ ...DEFAULT_SETTINGS, text: long })
    expect(settingsFromQuery(settingsToQuery(scene))).toEqual(scene)
  })

  /**
   * The set is a set: `ring,dot` and `dot,ring` are one scene, so it is sorted
   * into the vocabulary's own order. One scene then has one address, and
   * `settingsToQuery` cannot emit two spellings of it.
   */
  it("puts the chosen marks in the vocabulary's order, once each", () => {
    const settings = normalizeSettings({ glyphs: ["star", "plus", "star", "ring"] as GlyphName[] })
    expect(settings.glyphs).toEqual(["plus", "ring", "star"])
  })

  it("drops a mark it does not know rather than defaulting the whole set", () => {
    const settings = normalizeSettings({ glyphs: ["ring", "sunburst", "moon"] as GlyphName[] })
    expect(settings.glyphs).toEqual(["ring", "moon"])
  })

  /**
   * A psyx never repeats the frame it is showing, so a set of one leaves the
   * walk nowhere to go and the moving half of the piece silently stops. The
   * control refuses it; so must every other way in.
   */
  it("keeps the base's marks when fewer than two survive", () => {
    const base = normalizeSettings({ glyphs: ["ring", "dot", "moon"] as GlyphName[] })
    expect(normalizeSettings({ glyphs: ["star"] as GlyphName[] }, base).glyphs).toEqual(base.glyphs)
    expect(normalizeSettings({ glyphs: [] }, base).glyphs).toEqual(base.glyphs)
    expect(normalizeSettings({ glyphs: "ring,moon" as never }, base).glyphs).toEqual(base.glyphs)
  })

  it("fills gaps from the base rather than from the defaults when given one", () => {
    const base = normalizeSettings({ ...DEFAULT_SETTINGS, hue: 12, text: "&" })
    const next = normalizeSettings({ wildness: 0.2 }, base)
    expect(next.hue).toBe(12)
    expect(next.text).toBe("&")
  })
})

describe("the query string", () => {
  it("round-trips a scene", () => {
    const scene = normalizeSettings({
      ...DEFAULT_SETTINGS,
      subject: "picture",
      text: "Ω — any text",
      picture: "https://avatars.githubusercontent.com/u/25991?v=4",
      face: "roman",
      polarity: "void",
      hue: 41,
      finest: DEFAULT_SETTINGS.coarse / 4,
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
  it("restores every setting, so no address rests on a default", () => {
    // **Restores, rather than spells.** The address was one named parameter per
    // setting until the packed form landed; the property was always that it
    // states the whole scene, and the packed form states it without spelling it.
    // See `../../src/experiments/docs/adr/20260906-an-address-is-packed-not-readable.md`.
    expect(settingsFromQuery(settingsToQuery(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS)
    const third = normalizeSettings(PRESETS[2]!.settings)
    expect(settingsFromQuery(settingsToQuery(third))).toEqual(third)
    expect(urlForSettings(DEFAULT_SETTINGS, "/experiments/psyxels/")).toContain("?")
  })

  it("carries the chosen marks by name", () => {
    const scene = normalizeSettings({ glyphs: ["ring", "moon", "star"] as GlyphName[] })
    // A set is a bitmask over the slot's frozen vocabulary now, so the address
    // carries membership rather than an order. `normalizeGlyphs` already put
    // these in the vocabulary's own order, which is what comes back.
    expect(settingsFromQuery(settingsToQuery(scene)).glyphs).toEqual(scene.glyphs)
    expect(settingsFromQuery(new URLSearchParams("glyphs=moon,ring")).glyphs).toEqual(["ring", "moon"])
    expect(settingsForLanding(new URLSearchParams("glyphs=ring,moon")).featured).toBe(false)
  })

  /**
   * **`vocabulary=N` is still read**, because links carrying it exist and a
   * shared address should keep meaning what it meant: the first N of the list.
   */
  it("still reads the count a link was written with, and prefers the names", () => {
    expect(settingsFromQuery(new URLSearchParams("vocabulary=3")).glyphs).toEqual(["minus", "plus", "circled-minus"])
    expect(settingsFromQuery(new URLSearchParams("vocabulary=9&glyphs=ring,moon")).glyphs).toEqual(["ring", "moon"])
    // Junk in `glyphs` falls through to the count rather than to the default.
    expect(settingsFromQuery(new URLSearchParams("vocabulary=2&glyphs=nonsense")).glyphs).toEqual(["minus", "plus"])
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
    expect(settingsForLanding(new URLSearchParams("subject=picture")).featured).toBe(false)
    expect(settingsForLanding(new URLSearchParams("text=hi")).featured).toBe(false)
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
    const primary = normalizeSettings(PRESETS[0]!.settings)
    expect(settingsFromQuery(settingsToQuery(primary))).toEqual(primary)
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
      "finest",
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
      "weight",
      "inset",
      "threshold",
      "flatten",
      "playback",
    ] as const) {
      const next = normalizeSettings({ ...DEFAULT_SETTINGS, [key]: DEFAULT_SETTINGS[key] / 2 })
      expect(needsPacking(DEFAULT_SETTINGS, next), key).toBe(false)
    }

    // The marks are read live like the rest of the life half, so choosing a
    // different set must leave every psyx exactly where it is.
    const swapped = normalizeSettings({ ...DEFAULT_SETTINGS, glyphs: ["ring", "dot", "moon"] })
    expect(swapped.glyphs).not.toEqual(DEFAULT_SETTINGS.glyphs)
    expect(needsPacking(DEFAULT_SETTINGS, swapped)).toBe(false)
  })

  it("rasterises the subject again only when the subject, its face, its polarity or its size changed", () => {
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, subject: "picture" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, text: "B" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, picture: "/x.png" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, face: "script" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, polarity: "void" })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, fill: 0.5 })).toBe(true)
    expect(needsSubject(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, coarse: 40 })).toBe(false)
  })
})
