import { describe, expect, it } from "vitest"
import {
  BOUNDS,
  CONTROLS,
  DEFAULT_SETTINGS,
  PRESETS,
  keysOf,
  needsRebuild,
  normalizeSettings,
  reconcile,
  settingsFromQuery,
  settingsToQuery,
} from "@/experiments/starry-night/settings"

/**
 * Settings round-trip through the query string, which makes a URL the unit of
 * sharing. Anything added to `Settings` needs handling in both directions and a
 * `Control`, or the panel and a shared link quietly disagree about the sky.
 */

describe("the query string", () => {
  it("round-trips a custom sky unchanged", () => {
    const custom = normalizeSettings({
      mode: "random",
      invert: true,
      layerCount: 6,
      hue: 30,
      fade: 0.4,
      clouds: 0.6,
      minLifetimeMs: 8_000,
      maxLifetimeMs: 12_000,
    })
    expect(settingsFromQuery(settingsToQuery(custom))).toEqual(custom)
  })

  it("writes nothing for a default sky", () => {
    expect(settingsToQuery(DEFAULT_SETTINGS).toString()).toBe("")
  })

  // Reading query numbers with a bare `Number()` silently disabled glimmers by
  // default once: an absent param is `null`, and `Number(null)` is 0, which is a
  // legal value for most settings here.
  it("keeps defaults for absent, blank and unparseable params, rather than zeroing them", () => {
    expect(settingsFromQuery(new URLSearchParams(""))).toEqual(DEFAULT_SETTINGS)
    for (const query of ["glimmersPerSecond=", "glimmersPerSecond=%20", "glimmersPerSecond=abc"]) {
      expect(settingsFromQuery(new URLSearchParams(query)).glimmersPerSecond).toBe(DEFAULT_SETTINGS.glimmersPerSecond)
    }
  })

  it("reads an explicit zero as zero", () => {
    // The flip side: the guard above must not swallow a value someone meant.
    expect(settingsFromQuery(new URLSearchParams("glimmersPerSecond=0")).glimmersPerSecond).toBe(0)
  })

  it("treats only 0 and false as an unset invert", () => {
    expect(settingsFromQuery(new URLSearchParams("invert=0")).invert).toBe(false)
    expect(settingsFromQuery(new URLSearchParams("invert=false")).invert).toBe(false)
    expect(settingsFromQuery(new URLSearchParams("invert=1")).invert).toBe(true)
  })

  it("ignores a mode it does not have", () => {
    expect(settingsFromQuery(new URLSearchParams("mode=sideways")).mode).toBe(DEFAULT_SETTINGS.mode)
    expect(settingsFromQuery(new URLSearchParams("mode=identical")).mode).toBe("identical")
  })
})

describe("normalizeSettings", () => {
  it("clamps every numeric key to its bounds", () => {
    // The lifetime pair is excluded because clamping is not the last word on it:
    // the guard below re-orders the two, which is covered by its own test.
    const independent = Object.entries(BOUNDS).filter(([key]) => !key.endsWith("LifetimeMs"))
    for (const [key, bound] of independent) {
      expect(normalizeSettings({ [key]: -1e9 })[key as keyof typeof BOUNDS], key).toBe(bound.min)
      expect(normalizeSettings({ [key]: 1e9 })[key as keyof typeof BOUNDS], key).toBe(bound.max)
    }
  })

  it("clamps the lifetime pair too, subject to staying in order", () => {
    expect(normalizeSettings({ minLifetimeMs: -1e9 }).minLifetimeMs).toBe(BOUNDS.minLifetimeMs.min)
    expect(normalizeSettings({ maxLifetimeMs: 1e9 }).maxLifetimeMs).toBe(BOUNDS.maxLifetimeMs.max)
  })

  it("keeps a lifetime range the right way round", () => {
    // Reversed lifetimes make every layer respawn instantly.
    const settings = normalizeSettings({ minLifetimeMs: 20_000, maxLifetimeMs: 8_000 })
    expect(settings.maxLifetimeMs).toBeGreaterThanOrEqual(settings.minLifetimeMs)
  })

  it("merges onto a given base rather than the defaults", () => {
    const base = normalizeSettings({ hue: 90, layerCount: 4 })
    expect(normalizeSettings({ hue: 120 }, base).layerCount).toBe(4)
  })
})

describe("reconcile", () => {
  it("pushes max up when min is dragged past it", () => {
    const dragged = { ...DEFAULT_SETTINGS, minLifetimeMs: 30_000 }
    expect(reconcile(dragged, "minLifetimeMs").maxLifetimeMs).toBe(30_000)
  })

  it("pulls min down when max is dragged below it", () => {
    const dragged = { ...DEFAULT_SETTINGS, maxLifetimeMs: 2_000 }
    expect(reconcile(dragged, "maxLifetimeMs").minLifetimeMs).toBe(2_000)
  })

  it("leaves a range that is already in order alone", () => {
    expect(reconcile(DEFAULT_SETTINGS, "minLifetimeMs")).toEqual(DEFAULT_SETTINGS)
  })
})

/**
 * Rebuilding layers must carry `phase` and `lifetimeMs` across, or every layer
 * restarts together and fades in as one — the exact artifact the piece exists to
 * avoid. The cheapest defence is not rebuilding for settings that do not move a
 * star in the first place.
 */
describe("needsRebuild", () => {
  it("rebuilds when a setting decides where stars are", () => {
    for (const key of ["mode", "layerCount", "densityScale", "nearRadius", "sizeMix", "wobble"] as const) {
      if (key === "mode") {
        expect(needsRebuild(DEFAULT_SETTINGS, normalizeSettings({ mode: "identical" }))).toBe(true)
        continue
      }
      // Toward whichever bound the default is not already sitting on: `sizeMix`
      // defaults to its maximum, so nudging up would clamp straight back.
      const bound = BOUNDS[key]
      const away = DEFAULT_SETTINGS[key] === bound.max ? bound.min : bound.max
      expect(needsRebuild(DEFAULT_SETTINGS, normalizeSettings({ [key]: away })), key).toBe(true)
    }
  })

  it("does not rebuild for anything read live", () => {
    for (const key of ["hue", "fade", "curve", "clouds", "haze", "glimmersPerSecond"] as const) {
      const changed = normalizeSettings({ [key]: key === "hue" ? 10 : 0.5 })
      expect(needsRebuild(DEFAULT_SETTINGS, changed), key).toBe(false)
    }
  })
})

describe("controls", () => {
  it("has one for every numeric setting, so the panel and a URL cannot disagree", () => {
    const controlled = new Set<string>(CONTROLS.flatMap(keysOf))
    expect(Object.keys(BOUNDS).filter((key) => !controlled.has(key))).toEqual([])
  })

  it("gives every control a hint, since the panel shows one", () => {
    for (const control of CONTROLS) expect(control.hint.length, control.label).toBeGreaterThan(0)
  })

  it("keeps every control's bounds the ones settings are clamped to", () => {
    for (const control of CONTROLS) {
      for (const key of keysOf(control)) {
        expect(BOUNDS[key], key).toEqual({ min: control.min, max: control.max })
      }
    }
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
