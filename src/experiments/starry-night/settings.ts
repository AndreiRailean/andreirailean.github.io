import { isMode, type Mode } from "@/experiments/starry-night/character"

/**
 * Everything about the sky that is tunable at runtime.
 *
 * This is the single source of truth shared by the engine, the control panel and
 * the URL. Anything not here (background, star colour) is a constant.
 */
export type Settings = {
  mode: Mode
  invert: boolean
  layerCount: number
  glimmersPerSecond: number
  densityScale: number
  /** Radius of the largest stars, in css px; the small end is unaffected. */
  nearRadius: number
  /** Fraction of a life spent fading, at each end. 0.5 is a pure bell. */
  fade: number
  /** 1 spreads sizes evenly; lower values make each larger size rarer. */
  sizeMix: number
  /** How far a large star's outline departs from a circle. 0 keeps circles. */
  wobble: number
  /** Strength of the soft mottling behind the stars. 0 turns it off. */
  clouds: number
  /** Hue, in degrees, of the mottling and of the controls themselves. */
  hue: number
  minLifetimeMs: number
  maxLifetimeMs: number
}

export type NumericKey = Exclude<keyof Settings, "mode" | "invert">

export type Control = {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  format: (value: number) => string
  /** Shown as a tooltip on the row. */
  hint: string
}

/**
 * Bounds live here rather than in the markup so the sliders and the query-string
 * parser cannot disagree about what a legal value is.
 */
export const CONTROLS: Control[] = [
  {
    key: "layerCount",
    label: "layers",
    min: 1,
    max: 28,
    step: 1,
    format: (v) => String(v),
    hint: "How many independent fade layers build the sky. Each runs on its own clock, so more layers means any single one is harder to notice.",
  },
  {
    key: "densityScale",
    label: "density",
    min: 0.1,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "Multiplies how many stars every layer holds. Star count already scales with the size of the window; this scales it further.",
  },
  {
    key: "nearRadius",
    label: "max size",
    min: 1.5,
    max: 16,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}px`,
    hint: "Largest a star may get, in the nearest layers. Every layer's stars start from the same small floor, so this raises the ceiling only — size mix decides how often that ceiling is actually reached.",
  },
  {
    key: "sizeMix",
    label: "size mix",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How sizes are shared out between the floor and each layer's ceiling. At 1 every size in the range is equally likely. Turn it down and each larger size becomes rarer than the one below, so a high max size gives fine grain with the occasional big star rather than a sky full of them.",
  },
  {
    key: "wobble",
    label: "wobble",
    min: 0,
    max: 0.45,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How far a large star's outline strays from a circle. Small stars stay circular whatever this says, since the irregularity would be invisible.",
  },
  {
    key: "clouds",
    label: "clouds",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "Strength of the soft mottling behind the stars, which keeps the ground from being one flat colour. It fades in and out on its own clocks like the stars do. 0 removes it; use hue to change its colour.",
  },
  {
    key: "hue",
    label: "hue",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Colour of the mottling and of these controls. Stars stay neutral, so this is the only hue in the piece. Around 225 is cool blue, 30 is warm clay.",
  },
  {
    key: "fade",
    label: "fade",
    min: 0.02,
    max: 0.5,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much of a life is spent fading, at each end. 0.5 fades the whole way in and straight back out. Lower values hold full brightness longer and cross in and out more quickly, which makes a big star's arrival less of a performance.",
  },
  {
    key: "glimmersPerSecond",
    label: "glimmer",
    min: 0,
    max: 6,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}/s`,
    hint: "Average single-star flares per second across the whole sky. A flare is a fast brightness spike on one star, unrelated to the layer fades.",
  },
  {
    key: "minLifetimeMs",
    label: "life min",
    min: 1_000,
    max: 40_000,
    step: 500,
    format: (v) => `${(v / 1000).toFixed(1)}s`,
    hint: "Shortest time a layer takes to fade in and out. Every layer draws its own lifespan from this range, which is what keeps them out of step.",
  },
  {
    key: "maxLifetimeMs",
    label: "life max",
    min: 1_000,
    max: 60_000,
    step: 500,
    format: (v) => `${(v / 1000).toFixed(1)}s`,
    hint: "Longest time a layer takes to fade in and out. A wider gap from the minimum makes the layers drift apart faster.",
  },
]

/** Button text for the depth policies. The URL keeps the underlying names. */
export const MODE_LABELS: Record<Mode, string> = {
  depth: "tiers",
  random: "random",
  identical: "same",
}

export const DEPTH_HINT =
  "Every layer is given a depth from far to near, and that depth sets three things: how many stars the layer holds, how large they may get, and how bright they are. This chooses how the depths are handed out. Tiers spreads them evenly from far to near. Random gives a layer a fresh depth each time it respawns, so its character keeps changing. Same puts every layer in the middle, leaving them to differ only by chance."

export const DEFAULT_SETTINGS: Settings = {
  mode: "depth",
  invert: false,
  layerCount: 14,
  fade: 0.1,
  glimmersPerSecond: 0.5,
  densityScale: 1,
  nearRadius: 3,
  sizeMix: 1,
  wobble: 0.22,
  clouds: 0.15,
  hue: 247,
  minLifetimeMs: 6_000,
  maxLifetimeMs: 26_000,
}

/**
 * Starting points, not conclusions. Keys 1-3 load these; the intent is that you
 * explore with the sliders, then a URL worth keeping gets baked in here.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "deep field",
    hint: "Many faint layers on a dark sky. The starting point.",
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    label: "clay",
    hint: "Dark stars pressed into a warm light ground.",
    settings: {
      mode: "depth",
      invert: true,
      layerCount: 18,
      fade: 0.475,
      glimmersPerSecond: 2.1,
      densityScale: 1.2,
      nearRadius: 5.7,
      sizeMix: 1,
      wobble: 0.22,
      clouds: 0.2,
      hue: 30,
      minLifetimeMs: 2500,
      maxLifetimeMs: 6000,
    },
  },
  {
    label: "alive",
    hint: "Short lifespans and frequent flares, so the sky never settles.",
    settings: {
      mode: "depth",
      invert: false,
      layerCount: 18,
      fade: 0.45,
      glimmersPerSecond: 1.75,
      densityScale: 0.6,
      nearRadius: 2.6,
      sizeMix: 1,
      wobble: 0.22,
      clouds: 0.22,
      hue: 225,
      minLifetimeMs: 3500,
      maxLifetimeMs: 10500,
    },
  },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API — passes through here, so bounds live in exactly one place and the two can
 * never disagree about what is valid.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = {
    ...merged,
    mode: isMode(merged.mode) ? merged.mode : base.mode,
    invert: Boolean(merged.invert),
  }

  for (const control of CONTROLS) {
    const value = Number(settings[control.key])
    settings[control.key] = Number.isFinite(value) ? clamp(value, control.min, control.max) : base[control.key]
  }

  // A dragged "min" must not overtake "max", or lifetimes come out reversed and
  // every layer respawns instantly.
  if (settings.minLifetimeMs > settings.maxLifetimeMs) {
    settings.maxLifetimeMs = settings.minLifetimeMs
  }

  return settings
}

/**
 * Reads settings from a query string.
 *
 * An absent param is `null` and `Number(null)` is 0, which is a legal value for
 * most of these — that once disabled glimmers by default. Absent, blank and
 * unparseable are all skipped so the default survives.
 */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}

  const mode = params.get("mode")
  if (isMode(mode)) patch.mode = mode

  const invert = params.get("invert")
  if (invert !== null) patch.invert = invert !== "0" && invert !== "false"

  for (const control of CONTROLS) {
    const raw = params.get(control.key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[control.key] = value
  }

  return normalizeSettings(patch)
}

/** Only values that differ from the defaults, so shared URLs stay readable. */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  if (settings.mode !== DEFAULT_SETTINGS.mode) params.set("mode", settings.mode)
  if (settings.invert !== DEFAULT_SETTINGS.invert) params.set("invert", settings.invert ? "1" : "0")
  for (const control of CONTROLS) {
    if (settings[control.key] !== DEFAULT_SETTINGS[control.key]) {
      params.set(control.key, String(settings[control.key]))
    }
  }
  return params
}
