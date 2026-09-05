import { describe, expect, it } from "vitest"
import {
  BOUNDS,
  CONTROLS,
  DEFAULT_SETTINGS,
  needsScatter,
  needsSea,
  normalizeSettings,
  PRESETS,
  reconcile,
  settingsForLanding,
  settingsFromQuery,
  settingsToQuery,
  urlForSettings,
  type NumericKey,
  type Settings,
} from "@/experiments/flotsam/settings"
import { keysOf, positionOf, valueAtPosition } from "@/experiments/kit/controls"

describe("bounds", () => {
  it("has a bound for every setting, so nothing arrives unclamped", () => {
    for (const key of Object.keys(DEFAULT_SETTINGS) as NumericKey[]) {
      expect(BOUNDS[key], key).toBeDefined()
    }
  })

  it("has a control for every setting except the seed", () => {
    const controlled = new Set(CONTROLS.flatMap((control) => keysOf(control)))
    const missing = (Object.keys(DEFAULT_SETTINGS) as NumericKey[]).filter((key) => !controlled.has(key))
    expect(missing).toEqual(["seed"])
  })

  it("gives every logarithmic control a positive minimum, which the mapping requires", () => {
    for (const control of CONTROLS) {
      if (control.scale === "log") expect(control.min, control.label).toBeGreaterThan(0)
    }
  })

  it("keeps every default and every preset inside its own bounds", () => {
    for (const { label, settings } of [{ label: "defaults", settings: DEFAULT_SETTINGS }, ...PRESETS]) {
      expect(normalizeSettings(settings), label).toEqual(settings)
    }
  })
})

describe("normalising", () => {
  it("clamps out of range, rounds what must be whole, and keeps the rest", () => {
    const settings = normalizeSettings({ steepness: 99, trains: 2.7, dots: -50, span: 3.5 })
    expect(settings.steepness).toBe(BOUNDS.steepness.max)
    expect(settings.trains).toBe(3)
    expect(settings.dots).toBe(BOUNDS.dots.min)
    expect(settings.span).toBe(3.5)
  })

  it("falls back to the base for anything unreadable rather than to zero", () => {
    // Zero is a legal value for most of these, so a bare Number() would silently
    // still the current, flatten the sea and put the light on the horizon.
    const settings = normalizeSettings({ drift: Number.NaN, glint: Number.NaN }, DEFAULT_SETTINGS)
    expect(settings.drift).toBe(DEFAULT_SETTINGS.drift)
    expect(settings.glint).toBe(DEFAULT_SETTINGS.glint)
  })

  it("puts a reversed pair back in order", () => {
    const settings = normalizeSettings({ shortest: 20, longest: 2 })
    expect(settings.longest).toBeGreaterThanOrEqual(settings.shortest)
  })
})

describe("reconciling a dragged pair", () => {
  it("moves the end that is not being dragged, either way round", () => {
    const base: Settings = { ...DEFAULT_SETTINGS, shortest: 2, longest: 10 }

    // Dragging the minimum up past the maximum takes the maximum with it.
    expect(reconcile({ ...base, shortest: 30 }, "shortest").longest).toBe(30)
    // And dragging the maximum down past the minimum takes the minimum with it,
    // which is the case a plain clamp cannot express — it can only push upward.
    expect(reconcile({ ...base, longest: 0.5 }, "longest").shortest).toBe(0.5)
    expect(reconcile({ ...base, smallest: 1.2 }, "smallest").largest).toBe(1.2)
    expect(reconcile({ ...base, largest: 0.001 }, "largest").smallest).toBe(0.001)
  })

  it("leaves a pair that is already in order alone", () => {
    const base: Settings = { ...DEFAULT_SETTINGS, shortest: 2, longest: 10 }
    expect(reconcile({ ...base, shortest: 3 }, "shortest")).toEqual({ ...base, shortest: 3 })
  })
})

describe("the query string", () => {
  it("round-trips every setting through a URL", () => {
    const scene: Settings = normalizeSettings({ ...PRESETS[3]!.settings, seed: 4242 })
    expect(settingsFromQuery(settingsToQuery(scene))).toEqual(scene)
  })

  it("carries the whole scene, so a shared link cannot drift when a default moves", () => {
    // It carried only the differences until #128, for a shorter link. That is
    // the trap the presets are written out in full to avoid, one layer down.
    expect([...settingsToQuery(DEFAULT_SETTINGS).keys()].sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
    expect(settingsToQuery({ ...DEFAULT_SETTINGS, glint: 0.11 }).get("glint")).toBe("0.11")
  })

  it("treats absent, blank and unparseable alike, and keeps the default for all three", () => {
    for (const query of ["", "drift=", "drift=nonsense"]) {
      expect(settingsFromQuery(new URLSearchParams(query)).drift).toBe(DEFAULT_SETTINGS.drift)
    }
  })

  it("builds an address that names the scene even when nothing has changed", () => {
    expect(urlForSettings(DEFAULT_SETTINGS, "/experiments/flotsam/")).toContain("?")
  })
})

describe("landing", () => {
  it("shows the first preset for a bare URL, and says the address should be rewritten", () => {
    const landing = settingsForLanding(new URLSearchParams(""))
    expect(landing.featured).toBe(true)
    expect(landing.settings).toEqual(normalizeSettings(PRESETS[0]!.settings))
  })

  it("leaves a URL that names a setting alone", () => {
    const landing = settingsForLanding(new URLSearchParams("span=90"))
    expect(landing.featured).toBe(false)
    expect(landing.settings.span).toBe(90)
  })

  it("treats a URL of only unreadable params as naming nothing, exactly as the parser does", () => {
    expect(settingsForLanding(new URLSearchParams("span=&glint=nope")).featured).toBe(true)
  })
})

describe("what a change costs", () => {
  it("rebuilds the flotsam only for what decides where the flotsam is or what it looks like", () => {
    const base = DEFAULT_SETTINGS
    expect(needsScatter(base, { ...base, dots: 900 })).toBe(true)
    expect(needsScatter(base, { ...base, seed: 2 })).toBe(true)
    expect(needsScatter(base, { ...base, hue: 90 })).toBe(true)
    // The sea, the current, the light and the view are all read live, so
    // dragging them moves the water instead of replacing it.
    expect(needsScatter(base, { ...base, steepness: 0.2 })).toBe(false)
    expect(needsScatter(base, { ...base, drift: 1 })).toBe(false)
    expect(needsScatter(base, { ...base, span: 100 })).toBe(false)
    expect(needsScatter(base, { ...base, glint: 0 })).toBe(false)
  })

  it("rebuilds the sea only for what shapes the sea", () => {
    const base = DEFAULT_SETTINGS
    expect(needsSea(base, { ...base, steepness: 0.2 })).toBe(true)
    expect(needsSea(base, { ...base, trains: 5 })).toBe(true)
    expect(needsSea(base, { ...base, longest: 40 })).toBe(true)
    expect(needsSea(base, { ...base, dots: 100 })).toBe(false)
    expect(needsSea(base, { ...base, gleam: 20 })).toBe(false)
  })
})

describe("the logarithmic tracks", () => {
  it("puts the small end of a three-decade range in the middle of the track, not in its first per cent", () => {
    const span = CONTROLS.find((control) => "key" in control && control.key === "span")!
    // Twenty-four metres is the landing scene. Linearly it sits at 7% of a track
    // that runs to 320; logarithmically it is where a hand can find it.
    expect(positionOf(span, 24)).toBeGreaterThan(0.4)
    expect(positionOf(span, 24)).toBeLessThan(0.7)
  })

  it("round-trips a value through its position", () => {
    const span = CONTROLS.find((control) => "key" in control && control.key === "span")!
    for (const value of [1.5, 4, 24, 100, 320]) {
      expect(valueAtPosition(span, positionOf(span, value))).toBeCloseTo(value, 1)
    }
  })

  it("never lands on a value a shared URL would have to spell out to sixteen digits", () => {
    const wavelength = CONTROLS.find((control) => control.kind === "range" && control.keys[0] === "shortest")!
    for (let i = 0; i <= 1000; i += 7) {
      const value = valueAtPosition(wavelength, i / 1000)
      expect(String(value).length).toBeLessThanOrEqual(6)
    }
  })
})
