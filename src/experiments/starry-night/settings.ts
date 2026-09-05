import { keysOf, type Control as KitControl, type RangeControl, type SliderControl } from "@/experiments/kit/controls"
import { isMode, MODES, type Mode } from "@/experiments/starry-night/character"

/** Re-exported so a consumer needs one import for a control and its keys. */
export { keysOf } from "@/experiments/kit/controls"

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
  /** Gamma on the fade shape. 1 leaves the eased ramp as it is. */
  curve: number
  /** 1 spreads sizes evenly; lower values make each larger size rarer. */
  sizeMix: number
  /** How far a large star's outline departs from a circle. 0 keeps circles. */
  wobble: number
  /** Strength of the soft mottling behind the stars. 0 turns it off. */
  clouds: number
  /** Strength of the drifting haze drawn over the stars, dimming what it covers. */
  haze: number
  /** Hue, in degrees, of the mottling and of the controls themselves. */
  hue: number
  minLifetimeMs: number
  maxLifetimeMs: number
}

export type NumericKey = Exclude<keyof Settings, "mode" | "invert">

/**
 * The rows, described in the kit's vocabulary.
 *
 * Four kinds are in play here where Dangler needs only one: the sky's depth is a
 * `choice`, its scheme a `toggle`, its lifespan a bound `range`, and the rest
 * plain sliders. The kit renders all four; what they are is this piece's
 * business.
 */
export type Control = KitControl<string & keyof Settings>

/**
 * Numeric rows only — the ones with bounds to report and a slider to drag.
 *
 * Keyed by `NumericKey` rather than by every key, which is what lets `BOUNDS`
 * and anything else reading a control's bounds index by the key it gets back
 * without a cast. Depth and invert are neither.
 */
export type NumericControl = SliderControl<NumericKey> | RangeControl<NumericKey>

export const isNumericControl = (control: Control): control is NumericControl =>
  control.kind === "slider" || control.kind === "range"

/**
 * Bounds live here rather than in the markup so the sliders and the query-string
 * parser cannot disagree about what a legal value is.
 */
export const MODE_LABELS: Record<Mode, string> = {
  depth: "tiers",
  random: "random",
  identical: "same",
}

export const DEPTH_HINT =
  "Every layer is given a depth from far to near, and that depth sets three things: how many stars the layer holds, how large they may get, and how bright they are. This chooses how the depths are handed out. Tiers spreads them evenly from far to near. Random gives a layer a fresh depth each time it respawns, so its character keeps changing. Same puts every layer in the middle, leaving them to differ only by chance."

export const CONTROLS: Control[] = [
  {
    kind: "choice",
    key: "mode",
    label: "depth",
    hint: DEPTH_HINT,
    options: MODES.map((mode) => ({ value: mode, label: MODE_LABELS[mode] })),
  },
  {
    kind: "toggle",
    key: "invert",
    label: "invert",
    hint: "Swap between light stars on a dark ground and dark stars on a light one.",
    labels: ["dark sky", "light sky"],
  },
  {
    kind: "slider",
    key: "layerCount",
    label: "layers",
    min: 1,
    max: 28,
    step: 1,
    format: (v) => String(v),
    hint: "How many independent fade layers build the sky. Each runs on its own clock, so more layers means any single one is harder to notice.",
  },
  {
    kind: "slider",
    key: "densityScale",
    label: "density",
    min: 0.1,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "Multiplies how many stars every layer holds. Star count already scales with the size of the window; this scales it further.",
  },
  {
    kind: "slider",
    key: "nearRadius",
    label: "max size",
    min: 1.5,
    max: 16,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}px`,
    hint: "Largest a star may get, in the nearest layers. Every layer's stars start from the same small floor, so this raises the ceiling only — size mix decides how often that ceiling is actually reached.",
  },
  {
    kind: "slider",
    key: "sizeMix",
    label: "size mix",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How sizes are shared out between the floor and each layer's ceiling. At 1 every size in the range is equally likely. Turn it down and each larger size becomes rarer than the one below, so a high max size gives fine grain with the occasional big star rather than a sky full of them.",
  },
  {
    kind: "slider",
    key: "wobble",
    label: "wobble",
    min: 0,
    max: 0.45,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How far a large star's outline strays from a circle. Small stars stay circular whatever this says, since the irregularity would be invisible.",
  },
  {
    kind: "slider",
    key: "clouds",
    label: "clouds",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "Strength of the soft mottling behind the stars, which keeps the ground from being one flat colour. It fades in and out on its own clocks like the stars do. 0 removes it; use hue to change its colour.",
  },
  {
    kind: "slider",
    key: "haze",
    label: "haze",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "Drifting cloud drawn over the stars rather than behind them, in the background colour, so it dims whatever it passes across. Thicker haze hides more. It drifts as it fades, so the sky is briefly clearer in some places than others.",
  },
  {
    kind: "slider",
    key: "hue",
    label: "hue",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Colour of the mottling and of these controls. Stars stay neutral, so this is the only hue in the piece. Around 225 is cool blue, 30 is warm clay.",
  },
  {
    kind: "slider",
    key: "fade",
    label: "fade",
    min: 0.02,
    max: 0.5,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much of a life is spent fading, at each end. 0.5 fades the whole way in and straight back out. Lower values hold full brightness longer and cross in and out more quickly, which makes a big star's arrival less of a performance.",
  },
  {
    kind: "slider",
    key: "curve",
    label: "curve",
    min: 0.4,
    max: 3,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "Shape of the fade, as distinct from its length. The ramp is already eased rather than linear; this bends it further. Above 1 a star stays faint for longer and then comes up quickly, which reads more like a light being turned up than a value being interpolated. Below 1 it brightens early and holds.",
  },
  {
    kind: "slider",
    key: "glimmersPerSecond",
    label: "glimmer",
    min: 0,
    max: 6,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}/s`,
    hint: "Average single-star flares per second across the whole sky. A flare is a fast brightness spike on one star, unrelated to the layer fades.",
  },
  {
    kind: "range",
    keys: ["minLifetimeMs", "maxLifetimeMs"],
    label: "lifespan",
    min: 1_000,
    max: 60_000,
    step: 500,
    format: (from, to) => `${(from / 1000).toFixed(1)}–${(to / 1000).toFixed(1)}s`,
    hint: "How long a layer takes to fade in and back out. Every layer draws its own lifespan from between these two, which is what keeps them out of step — a wider gap makes them scatter faster. Dragging one handle past the other carries it along.",
  },
]

/** Button text for the depth policies. The URL keeps the underlying names. */
export const DEFAULT_SETTINGS: Settings = {
  mode: "depth",
  invert: false,
  layerCount: 14,
  fade: 0.1,
  curve: 1,
  glimmersPerSecond: 0.5,
  densityScale: 1,
  nearRadius: 3,
  sizeMix: 1,
  wobble: 0.22,
  clouds: 0.15,
  haze: 0.2,
  hue: 247,
  minLifetimeMs: 6_000,
  maxLifetimeMs: 26_000,
}

/**
 * Starting points, not conclusions. Keys 1-3 load these; the intent is that you
 * explore with the sliders, then a URL worth keeping gets baked in here.
 *
 * Every one of them states every setting and inherits from nothing — not from
 * another preset and not from `DEFAULT_SETTINGS`. `deep field` was a spread over
 * the defaults until #128, which is the shape that cost Psyxels four of its six
 * scenes; see `../docs/adr/20260830-a-preset-inherits-from-nothing.md`. The
 * values below are the ones that spread produced, written out unchanged.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "deep field",
    hint: "Many faint layers on a dark sky. The starting point.",
    settings: {
      mode: "depth",
      invert: false,
      layerCount: 14,
      fade: 0.1,
      curve: 1,
      glimmersPerSecond: 0.5,
      densityScale: 1,
      nearRadius: 3,
      sizeMix: 1,
      wobble: 0.22,
      clouds: 0.15,
      haze: 0.2,
      hue: 247,
      minLifetimeMs: 6_000,
      maxLifetimeMs: 26_000,
    },
  },
  {
    label: "clay",
    hint: "Dark stars pressed into a warm light ground.",
    settings: {
      mode: "depth",
      invert: true,
      layerCount: 13,
      fade: 0.13,
      curve: 1,
      glimmersPerSecond: 1.45,
      densityScale: 3,
      nearRadius: 16,
      sizeMix: 0.65,
      wobble: 0.22,
      clouds: 0.25,
      haze: 0,
      hue: 30,
      minLifetimeMs: 2500,
      maxLifetimeMs: 9500,
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
      curve: 1,
      glimmersPerSecond: 1.75,
      densityScale: 0.6,
      nearRadius: 2.6,
      sizeMix: 1,
      wobble: 0.22,
      clouds: 0.22,
      haze: 0,
      hue: 225,
      minLifetimeMs: 3500,
      maxLifetimeMs: 10500,
    },
  },
]

/**
 * Bounds for every numeric setting, flattened out of the control list so the
 * validator never has to know how a control is presented.
 */
export const BOUNDS = Object.fromEntries(
  CONTROLS.filter(isNumericControl).flatMap((control) =>
    keysOf(control).map((key) => [key, { min: control.min, max: control.max }] as const),
  ),
) as Record<NumericKey, { min: number; max: number }>

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

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
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

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }

  return normalizeSettings(patch)
}

/**
 * Keeps the lifespan pair in order, moving whichever end is not being dragged.
 *
 * normalizeSettings can only push the maximum up, which fights someone dragging
 * the maximum down. Here the changed key is known, so the other end gives way.
 */
export function reconcile(next: Settings, changed: keyof Settings): Settings {
  if (changed === "minLifetimeMs" && next.minLifetimeMs > next.maxLifetimeMs) {
    return { ...next, maxLifetimeMs: next.minLifetimeMs }
  }
  if (changed === "maxLifetimeMs" && next.maxLifetimeMs < next.minLifetimeMs) {
    return { ...next, minLifetimeMs: next.maxLifetimeMs }
  }
  return next
}

/** Settings that decide where stars are, so changing one must rebuild them. */
const GEOMETRY_KEYS = [
  "mode",
  "layerCount",
  "densityScale",
  "nearRadius",
  "sizeMix",
  "wobble",
] as const satisfies readonly (keyof Settings)[]

/**
 * Whether a change needs the stars rebuilt.
 *
 * Most settings are read per frame and have no baked state, so rebuilding for
 * them just teleports every star for no reason — dragging hue used to reshuffle
 * the whole sky.
 */
export function needsRebuild(before: Settings, after: Settings): boolean {
  return GEOMETRY_KEYS.some((key) => before[key] !== after[key])
}

/** Cloud buffers bake their tint, so only these force them to be re-rendered. */
export function needsCloudRebuild(before: Settings, after: Settings): boolean {
  return (
    before.hue !== after.hue ||
    before.invert !== after.invert ||
    before.clouds <= 0 !== after.clouds <= 0 ||
    before.haze <= 0 !== after.haze <= 0
  )
}

/** Only values that differ from the defaults, so shared URLs stay readable. */
/**
 * The address that restores exactly these settings.
 *
 * One definition with two callers — the chrome, which rewrites the URL on every
 * change, and anything else that needs to name a scene.
 */
export function urlForSettings(settings: Settings, pathname: string): string {
  const query = settingsToQuery(settings).toString()
  return `${pathname}${query ? `?${query}` : ""}`
}

export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  if (settings.mode !== DEFAULT_SETTINGS.mode) params.set("mode", settings.mode)
  if (settings.invert !== DEFAULT_SETTINGS.invert) params.set("invert", settings.invert ? "1" : "0")
  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) params.set(key, String(settings[key]))
  }
  return params
}

/**
 * Whether a query string names any setting at all.
 *
 * The same rule `settingsFromQuery` applies, and it has to stay the same rule:
 * absent, blank and unparseable are all "not a setting" there, so a URL made
 * only of those is one the piece would read as carrying nothing. `invert` is
 * the odd one — the parser accepts any non-null value, blank included, because
 * anything that is not `0` or `false` is true — so it counts here on exactly
 * that test rather than on being readable.
 */
function namesASetting(params: URLSearchParams): boolean {
  if (isMode(params.get("mode"))) return true
  if (params.get("invert") !== null) return true
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * The scene a freshly-opened URL should show.
 *
 * `featured` says the caller should rewrite the address, so a landing visitor
 * has a URL describing the sky in front of them rather than one standing for
 * "whatever is featured". The piece read `settingsFromQuery` here until #128,
 * which landed a bare address on `DEFAULT_SETTINGS` — the baseline rather than
 * the chosen scene, and correct only for as long as the two coincide.
 *
 * They do coincide today, so the rewrite this enables is still a no-op: the
 * address `urlForSettings` writes for the primary is empty, because every value
 * in it equals the default it is diffed against. That half of #128 is a scene
 * choice rather than a mechanism, and is left open there.
 */
export function settingsForLanding(params: URLSearchParams): { settings: Settings; featured: boolean } {
  if (namesASetting(params)) return { settings: settingsFromQuery(params), featured: false }
  return { settings: normalizeSettings(PRESETS[0]!.settings), featured: true }
}
