import { isMode, type Mode } from "@/experiments/starry-night/character"

/**
 * Everything about the sky that is tunable at runtime.
 *
 * This is the single source of truth shared by the engine, the control panel and
 * the URL. Anything not here (background, star colour) is a constant.
 */
export type Settings = {
  mode: Mode
  layerCount: number
  hold: number
  glimmersPerSecond: number
  densityScale: number
  minLifetimeMs: number
  maxLifetimeMs: number
}

export type NumericKey = Exclude<keyof Settings, "mode">

export type Control = {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  format: (value: number) => string
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
  },
  {
    key: "densityScale",
    label: "density",
    min: 0.1,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
  },
  {
    key: "hold",
    label: "hold",
    min: 0,
    max: 0.9,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: "glimmersPerSecond",
    label: "glimmer",
    min: 0,
    max: 6,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}/s`,
  },
  {
    key: "minLifetimeMs",
    label: "life min",
    min: 1_000,
    max: 40_000,
    step: 500,
    format: (v) => `${(v / 1000).toFixed(1)}s`,
  },
  {
    key: "maxLifetimeMs",
    label: "life max",
    min: 1_000,
    max: 60_000,
    step: 500,
    format: (v) => `${(v / 1000).toFixed(1)}s`,
  },
]

export const DEFAULT_SETTINGS: Settings = {
  mode: "depth",
  layerCount: 14,
  hold: 0,
  glimmersPerSecond: 0.5,
  densityScale: 1,
  minLifetimeMs: 6_000,
  maxLifetimeMs: 26_000,
}

/**
 * Starting points, not conclusions. Keys 1-3 load these; the intent is that you
 * explore with the sliders, then a URL worth keeping gets baked in here.
 */
export const PRESETS: { label: string; settings: Settings }[] = [
  { label: "deep field", settings: { ...DEFAULT_SETTINGS } },
  {
    label: "sparse",
    settings: {
      mode: "depth",
      layerCount: 5,
      hold: 0.3,
      glimmersPerSecond: 0.3,
      densityScale: 1.6,
      minLifetimeMs: 10_000,
      maxLifetimeMs: 30_000,
    },
  },
  {
    label: "alive",
    settings: {
      mode: "depth",
      layerCount: 18,
      hold: 0.1,
      glimmersPerSecond: 1.75,
      densityScale: 0.6,
      minLifetimeMs: 3500,
      maxLifetimeMs: 10500,
    },
  },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Reads one number from a query string.
 *
 * An absent param is `null` and `Number(null)` is 0, so a naive numeric read
 * silently substitutes zero for "not specified" — which is how glimmers once got
 * switched off by default. Absent, blank and unparseable all fall back.
 */
function readNumber(params: URLSearchParams, control: Control, fallback: number): number {
  const raw = params.get(control.key)
  if (raw === null || raw.trim() === "") return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return clamp(value, control.min, control.max)
}

export function settingsFromQuery(params: URLSearchParams): Settings {
  const settings = { ...DEFAULT_SETTINGS }

  const mode = params.get("mode")
  if (isMode(mode)) settings.mode = mode

  for (const control of CONTROLS) {
    settings[control.key] = readNumber(params, control, DEFAULT_SETTINGS[control.key])
  }

  // A dragged "min" slider must not overtake "max", or lifetimes come out
  // reversed and every layer respawns instantly.
  if (settings.minLifetimeMs > settings.maxLifetimeMs) {
    settings.maxLifetimeMs = settings.minLifetimeMs
  }

  return settings
}

/** Only values that differ from the defaults, so shared URLs stay readable. */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  if (settings.mode !== DEFAULT_SETTINGS.mode) params.set("mode", settings.mode)
  for (const control of CONTROLS) {
    if (settings[control.key] !== DEFAULT_SETTINGS[control.key]) {
      params.set(control.key, String(settings[control.key]))
    }
  }
  return params
}
