import { describe, expect, it } from "vitest"
import {
  BOUNDS,
  CONTROLS,
  isNumericControl,
  DEFAULT_SETTINGS,
  PRESETS,
  keysOf,
  needsRebuild,
  normalizeSettings,
  reconcile,
  settingsForLanding,
  settingsFromQuery,
  settingsToQuery,
  urlForSettings,
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

  it("names every setting, even the ones sitting on their default", () => {
    // Including `mode` and `invert`, which are not in BOUNDS and so are written
    // out by hand. A link resting on a default is a link whose scene changes the
    // day the default does — #128.
    expect([...settingsToQuery(DEFAULT_SETTINGS).keys()].sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
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
    // Numeric rows only: depth is a choice and invert a toggle, and neither has
    // bounds to keep — they are clamped by their own parsers instead.
    for (const control of CONTROLS.filter(isNumericControl)) {
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

  /**
   * `deep field` was `{ ...DEFAULT_SETTINGS }` until #128, so retuning a default
   * silently retuned the scene a visitor lands on. Stating every key is the rule
   * — `../docs/adr/20260830-a-preset-inherits-from-nothing.md` — and this is the
   * mechanical half of it, which reads the object rather than the source.
   */
  it.each(PRESETS.map((preset) => [preset.label, preset] as const))(
    "%s states every setting, so no default can move it",
    (_label, preset) => {
      expect(Object.keys(preset.settings).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
    },
  )
})

/**
 * Where a bare address lands, and what it should leave the visitor holding.
 *
 * The indirection is the point: the address a visitor copies has to describe the
 * sky in front of them rather than stand for "whatever is featured", or promoting
 * a preset changes what an already-shared link shows. See `CONTEXT.md` on
 * *primary*.
 */
describe("landing", () => {
  /**
   * **This one still cannot fail, and it is worth knowing which one it is.**
   * Swapping the body of `settingsForLanding` back to `settingsFromQuery` — the
   * bug #128 was about — leaves it green, because a bare query parses to
   * `DEFAULT_SETTINGS` and the primary holds those same values. Writing the
   * whole scene into the address fixed the *link*, not this coincidence; the
   * assertion is written against the property, so it starts biting if the two
   * are ever separated. The falsifiable claims in this block are the ones below.
   */
  it("shows the first preset for a bare URL, and says the address should be rewritten", () => {
    const landing = settingsForLanding(new URLSearchParams(""))
    expect(landing.featured).toBe(true)
    expect(landing.settings).toEqual(normalizeSettings(PRESETS[0]!.settings))
  })

  it("leaves a URL that names a setting alone", () => {
    const landing = settingsForLanding(new URLSearchParams("hue=90"))
    expect(landing.featured).toBe(false)
    expect(landing.settings.hue).toBe(90)
  })

  it("treats a URL of only unreadable params as naming nothing, exactly as the parser does", () => {
    expect(settingsForLanding(new URLSearchParams("hue=&clouds=nope")).featured).toBe(true)
  })

  /**
   * The two non-numeric keys, which the numeric sweep cannot see. `mode` counts
   * only when it is one the piece has, and `invert` counts whenever it is
   * present at all — both because that is when `settingsFromQuery` reads them,
   * and the two have to agree about what a URL carries.
   */
  it("counts a mode it has, and ignores one it does not", () => {
    expect(settingsForLanding(new URLSearchParams("mode=random")).featured).toBe(false)
    expect(settingsForLanding(new URLSearchParams("mode=sideways")).featured).toBe(true)
  })

  it("counts an invert on the same test the parser applies, blank included", () => {
    expect(settingsForLanding(new URLSearchParams("invert=1")).featured).toBe(false)
    expect(settingsForLanding(new URLSearchParams("invert=0")).featured).toBe(false)
    expect(settingsForLanding(new URLSearchParams("invert=")).featured).toBe(false)
    expect(settingsFromQuery(new URLSearchParams("invert=")).invert).toBe(true)
  })

  /**
   * The half of #128 that was open, now closed from the other end.
   *
   * `deep field` still holds the same values as `DEFAULT_SETTINGS`, and it no
   * longer matters: the fix was not to move a scene apart from the baseline but
   * to stop the address being written as a difference from it. So the landing
   * rewrite pins this sky whether or not the two ever diverge, and a default
   * moving underneath cannot change what an already-shared link shows.
   *
   * This is the assertion that was inverted to get here. It read "still cannot
   * pin its own landing scene" and passed.
   */
  it("pins its own landing scene even though the primary is the baseline", () => {
    const { settings } = settingsForLanding(new URLSearchParams(""))
    expect(settings).toEqual(DEFAULT_SETTINGS)

    const address = urlForSettings(settings, "/experiments/starry-night/")
    expect(address).not.toBe("/experiments/starry-night/")
    expect(settingsFromQuery(new URLSearchParams(address.split("?")[1]))).toEqual(settings)
  })
})
