import { decodeScene, encodeScene, type Slot } from "@/experiments/address"
import {
  gridAt,
  snapToGrid,
  type Control as KitControl,
  type SliderControl,
  type Track,
} from "@/experiments/kit/controls"
import type { Chrome } from "@/experiments/piece"

/** Re-exported so a consumer needs one import for a control and its keys. */
export { keysOf } from "@/experiments/kit/controls"

/**
 * A field of columns seen from straight above, bending in the wind.
 *
 * Each column is anchored on a lattice point and is all one height. Upright it
 * is a dot — its top. Wind leans it, a spring pulls it back, and a leaning one
 * shows its side as a curve from its root to its top. The wind is one smooth
 * field over the whole screen, so neighbours lean alike while the field as a
 * whole carries waves and swirls.
 */
export type Lattice = "square" | "triangle" | "hex" | "rows" | "diamond"

export type Settings = {
  lattice: Lattice
  /** Distance between neighbouring roots, css px. */
  spacing: number
  /** Column diameter, css px. */
  diameter: number
  /** Column height, css px: how far its top travels when laid flat. */
  height: number
  /** How much columns differ in height. 0 is all one height; 1 puts four times between shortest and tallest. */
  heights: number
  /** 0 looks straight down from infinitely far; toward the top of the range the camera comes down to the columns. */
  perspective: number
  /** 0 bends along the length like a stem; 1 stays straight and pivots at a springy base. */
  hinge: number
  /** Straight bands a column's side is drawn in. Few shows the joints; many is a smooth curve. */
  segments: number
  /** Degrees the breeze blows toward, 0 right and 90 down. */
  direction: number
  /** Steady lean the breeze gives, as a fraction of height. */
  breeze: number
  /** Degrees the prevailing wind wanders either side of `direction`. */
  veer: number
  /** How fast it wanders, roughly turns a minute. */
  veerRate: number
  /** How far the breeze drops in a lull, 0..1 of itself. */
  lulls: number
  /** Lean a gust gives at its peak, as a fraction of height. */
  gusts: number
  /** Gusts a minute, on average. */
  gustRate: number
  /** Degrees a gust's direction may stray from the prevailing wind. 180 is any direction. */
  gustSpread: number
  /** Width of a gust, css px. */
  gustSize: number
  /** Lean from the eddies, as a fraction of height. */
  swirl: number
  /** Width of an eddy, css px. */
  swirlSize: number
  /** How fast gusts, eddies and changes of wind travel downwind, css px per second. */
  drift: number
  /** How fast the eddies change shape as they travel, per minute. */
  churn: number
  /** A column's natural sway frequency, Hz. */
  sway: number
  /** Fraction of critical damping. Low rings on, high creeps back. */
  damping: number
  /** How much columns differ in sway frequency, ±fraction. */
  variety: number
  /** How a column's sway rate goes with its height: 0 all alike, 2 a real stem's 1/length². */
  heightSway: number
  hue: number
  /** Degrees the colour wanders either side of `hue` across the field. */
  hueRange: number
  /** Width of a colour patch, css px. */
  colourSize: number
  /** 0 is a smooth gradient; 1 sharpens it into islands. */
  islands: number
  saturation: number
  /** How far a column's top is lifted toward white. */
  cap: number
  seed: number
}

export type NumericKey = Exclude<keyof Settings, "lattice">

export type Control = KitControl<string & keyof Settings>
export type NumericControl = SliderControl<NumericKey>

export const LATTICES: Lattice[] = ["square", "triangle", "hex", "rows", "diamond"]

const SEED_BOUNDS = { min: 0, max: 999_999 }

export const GROUP_ORDER = ["field", "wind", "spring", "colour"] as const

const fixed = (digits: number) => (v: number) => v.toFixed(digits)
const px = (v: number) => `${Math.round(v)}px`

export const CONTROLS: Control[] = [
  {
    kind: "choice",
    key: "lattice",
    label: "grid",
    group: "field",
    options: [
      { value: "square", label: "square" },
      { value: "triangle", label: "triangle" },
      { value: "hex", label: "hex" },
      { value: "rows", label: "rows" },
      { value: "diamond", label: "diamond" },
    ],
    hint: "How the roots are laid out. Triangle gives every column six equal neighbours; hex puts them on the corners of hexagons with a gap in each cell; rows plants them close along rows set twice as far apart, like a crop; diamond is the square turned 45°.",
  },
  {
    kind: "slider",
    key: "spacing",
    label: "spacing",
    group: "field",
    min: 6,
    max: 120,
    step: 1,
    scale: "log",
    format: px,
    hint: "Distance between neighbouring roots.",
  },
  {
    kind: "slider",
    key: "diameter",
    label: "diameter",
    group: "field",
    min: 1,
    max: 60,
    step: 0.5,
    scale: "log",
    format: (v) => `${v.toFixed(1)}px`,
    hint: "Thickness of every column, and so the size of the dot it makes upright.",
  },
  {
    kind: "slider",
    key: "height",
    label: "height",
    group: "field",
    min: 4,
    max: 400,
    step: 1,
    scale: "log",
    format: px,
    hint: "How tall the columns are — how far a top travels when its column is laid flat. Against spacing, it decides how much neighbours overlap when they lean.",
  },
  {
    kind: "slider",
    key: "heights",
    label: "heights",
    group: "field",
    min: 0,
    max: 1,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "How much columns differ in height, column by column. 0 is one height; 1 puts four times between the shortest and the tallest. A taller column also sways slower, as a real stem does.",
  },
  {
    kind: "slider",
    key: "perspective",
    label: "perspective",
    group: "field",
    min: 0,
    max: 0.8,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "How close the eye is. 0 looks straight down from far away, so a standing column is only a dot. Higher brings the camera down over the middle of the field: tops grow, and columns away from the middle show their sides even standing.",
  },
  {
    kind: "slider",
    key: "hinge",
    label: "hinge",
    group: "field",
    min: 0,
    max: 1,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "Where a column gives. 0 bends along its whole length like a stem, curling as it leans. 1 stays straight and tips over on a springy base, like a slalom pole.",
  },
  {
    kind: "slider",
    key: "segments",
    label: "segments",
    group: "field",
    min: 1,
    max: 16,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "How many straight pieces a column's side is drawn in, each a shade lighter than the one below. Few shows the joints, like a jointed rod; many draws a smooth curve.",
  },
  {
    kind: "slider",
    key: "direction",
    label: "direction",
    group: "wind",
    min: 0,
    max: 359,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Which way the breeze blows. 0 is toward the right, 90 toward the bottom.",
  },
  {
    kind: "slider",
    key: "breeze",
    label: "breeze",
    group: "wind",
    min: 0,
    max: 1,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "The steady lean everything shares, as a fraction of height. 0 stands the field up between gusts.",
  },
  {
    kind: "slider",
    key: "veer",
    label: "veer",
    group: "wind",
    min: 0,
    max: 180,
    step: 1,
    format: (v) => `±${Math.round(v)}°`,
    hint: "How far the prevailing wind wanders from its direction. A change of direction travels downwind across the field rather than turning every column at once. 180 lets it come from anywhere.",
  },
  {
    kind: "slider",
    key: "veerRate",
    label: "veer rate",
    group: "wind",
    min: 0,
    max: 20,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}/min`,
    hint: "How quickly the wind wanders, and how quickly its lulls come and go.",
  },
  {
    kind: "slider",
    key: "lulls",
    label: "lulls",
    group: "wind",
    min: 0,
    max: 1,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "How far the breeze drops between its strong spells. 1 lets it die away entirely now and then.",
  },
  {
    kind: "slider",
    key: "gusts",
    label: "gusts",
    group: "wind",
    min: 0,
    max: 1.5,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "How hard a gust leans the columns at its peak. A gust is an event: a patch of wind that sweeps across the field from its own direction, rising fast and dying slowly behind its front.",
  },
  {
    kind: "slider",
    key: "gustSize",
    label: "gust size",
    group: "wind",
    min: 40,
    max: 3000,
    step: 1,
    scale: "log",
    format: px,
    hint: "How wide a gust is across its path. Small is a narrow streak; large leans a whole region at once.",
  },
  {
    kind: "slider",
    key: "gustRate",
    label: "gust rate",
    group: "wind",
    min: 0,
    max: 60,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}/min`,
    hint: "How many gusts a minute, on average. They are spaced at random, never on a beat.",
  },
  {
    kind: "slider",
    key: "gustSpread",
    label: "gust spread",
    group: "wind",
    min: 0,
    max: 180,
    step: 1,
    format: (v) => `±${Math.round(v)}°`,
    hint: "How far a gust's direction may stray from the prevailing wind. 0 makes every gust more of the same wind; 180 lets one come from anywhere, against the breeze included.",
  },
  {
    kind: "slider",
    key: "swirl",
    label: "swirl",
    group: "wind",
    min: 0,
    max: 1,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "Lean from eddies — wind that turns across the breeze rather than along it. Above the breeze, the field breaks into swirls.",
  },
  {
    kind: "slider",
    key: "swirlSize",
    label: "swirl size",
    group: "wind",
    min: 40,
    max: 3000,
    step: 1,
    scale: "log",
    format: px,
    hint: "How wide an eddy is.",
  },
  {
    kind: "slider",
    key: "drift",
    label: "drift",
    group: "wind",
    min: 0,
    max: 800,
    step: 1,
    format: (v) => `${Math.round(v)}px/s`,
    hint: "How fast gusts, eddies and changes of wind travel across the screen.",
  },
  {
    kind: "slider",
    key: "churn",
    label: "churn",
    group: "wind",
    min: 0,
    max: 60,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}/min`,
    hint: "How fast the eddies change shape as they travel. 0 carries a frozen pattern of them over the field.",
  },
  {
    kind: "slider",
    key: "sway",
    label: "sway",
    group: "spring",
    min: 0.05,
    max: 4,
    step: 0.01,
    scale: "log",
    format: (v) => `${v.toFixed(2)}Hz`,
    hint: "How fast a column swings back and forth on its own. Low is a tall soft stem; high is a stiff short one that follows the wind closely.",
  },
  {
    kind: "slider",
    key: "damping",
    label: "damping",
    group: "spring",
    min: 0.02,
    max: 2,
    step: 0.01,
    scale: "log",
    format: /* @__PURE__ */ fixed(2),
    hint: "How quickly a swing dies away. Below 1 a column overshoots and rings; 1 returns it without overshoot; above, it creeps back.",
  },
  {
    kind: "slider",
    key: "variety",
    label: "variety",
    group: "spring",
    min: 0,
    max: 0.5,
    step: 0.01,
    format: (v) => `±${Math.round(v * 100)}%`,
    hint: "How much columns differ in sway from each other. 0 makes neighbours swing in lockstep; more lets them fall out of step after a gust.",
  },
  {
    kind: "slider",
    key: "heightSway",
    label: "height sway",
    group: "spring",
    min: 0,
    max: 2,
    step: 0.05,
    format: /* @__PURE__ */ fixed(2),
    hint: "How much slower a taller column sways, when heights differ. 0 gives every column the same rate, so the field moves together; 2 is a real stem, a quarter the rate at twice the height, and neighbours fall out of step.",
  },
  {
    kind: "slider",
    key: "hue",
    label: "hue",
    group: "colour",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "The colour the field is centred on, and the colour of these controls.",
  },
  {
    kind: "slider",
    key: "hueRange",
    label: "hue range",
    group: "colour",
    min: 0,
    max: 180,
    step: 1,
    format: (v) => `±${Math.round(v)}°`,
    hint: "How far the colour wanders across the field. 0 is one colour; 180 reaches every colour somewhere.",
  },
  {
    kind: "slider",
    key: "colourSize",
    label: "patch size",
    group: "colour",
    min: 40,
    max: 4000,
    step: 1,
    scale: "log",
    format: px,
    hint: "How wide a patch of one colour is. Large stretches one gradient across the screen; small breaks it into many.",
  },
  {
    kind: "slider",
    key: "islands",
    label: "islands",
    group: "colour",
    min: 0,
    max: 1,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "0 is a smooth gradient. Higher sharpens it, so colour pools into islands with quick borders between them.",
  },
  {
    kind: "slider",
    key: "saturation",
    label: "saturation",
    group: "colour",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}%`,
    hint: "How vivid the stalks are.",
  },
  {
    kind: "slider",
    key: "cap",
    label: "tops",
    group: "colour",
    min: 0,
    max: 1,
    step: 0.01,
    format: /* @__PURE__ */ fixed(2),
    hint: "How far the top of each column is lifted toward white. 0 gives it the stalk's colour, 1 makes every dot white.",
  },
]

export const DEFAULT_SETTINGS: Settings = {
  lattice: "triangle",
  spacing: 22,
  diameter: 7,
  height: 40,
  heights: 0,
  perspective: 0,
  hinge: 0,
  segments: 4,
  direction: 20,
  breeze: 0.3,
  veer: 60,
  veerRate: 1.5,
  lulls: 0.4,
  gusts: 0.5,
  gustRate: 8,
  gustSpread: 60,
  gustSize: 600,
  swirl: 0.25,
  swirlSize: 900,
  drift: 140,
  churn: 6,
  sway: 0.6,
  damping: 0.25,
  variety: 0.1,
  heightSway: 0,
  hue: 280,
  hueRange: 80,
  colourSize: 1400,
  islands: 0.2,
  saturation: 70,
  cap: 0.35,
  seed: 1,
}

/** Written out rather than derived from `CONTROLS`; see `src/experiments/AGENTS.md` under Presets. */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  spacing: { min: 6, max: 120, step: 1, scale: "log" },
  diameter: { min: 1, max: 60, step: 0.5, scale: "log" },
  height: { min: 4, max: 400, step: 1, scale: "log" },
  heights: { min: 0, max: 1, step: 0.01 },
  perspective: { min: 0, max: 0.8, step: 0.01 },
  hinge: { min: 0, max: 1, step: 0.01 },
  segments: { min: 1, max: 16, step: 1 },
  direction: { min: 0, max: 359, step: 1 },
  breeze: { min: 0, max: 1, step: 0.01 },
  veer: { min: 0, max: 180, step: 1 },
  veerRate: { min: 0, max: 20, step: 0.1 },
  lulls: { min: 0, max: 1, step: 0.01 },
  gustRate: { min: 0, max: 60, step: 0.5 },
  gustSpread: { min: 0, max: 180, step: 1 },
  heightSway: { min: 0, max: 2, step: 0.05 },
  gusts: { min: 0, max: 1.5, step: 0.01 },
  gustSize: { min: 40, max: 3000, step: 1, scale: "log" },
  swirl: { min: 0, max: 1, step: 0.01 },
  swirlSize: { min: 40, max: 3000, step: 1, scale: "log" },
  drift: { min: 0, max: 800, step: 1 },
  churn: { min: 0, max: 60, step: 0.1 },
  sway: { min: 0.05, max: 4, step: 0.01, scale: "log" },
  damping: { min: 0.02, max: 2, step: 0.01, scale: "log" },
  variety: { min: 0, max: 0.5, step: 0.01 },
  hue: { min: 0, max: 360, step: 1 },
  hueRange: { min: 0, max: 180, step: 1 },
  colourSize: { min: 40, max: 4000, step: 1, scale: "log" },
  islands: { min: 0, max: 1, step: 0.01 },
  saturation: { min: 0, max: 100, step: 1 },
  cap: { min: 0, max: 1, step: 0.01 },
}

export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    Object.entries(TRACKS).map(([key, track]) => [key, { min: track!.min, max: track!.max }]),
  ) as Record<Exclude<NumericKey, "seed">, { min: number; max: number }>),
  seed: SEED_BOUNDS,
}

/** The spacing one setting is stored on, or 0 for a key with no track. */
export function gridFor(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? gridAt(track, value) : 0
}

function snap(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? snapToGrid(track, value) : Math.round(value)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback

export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = { ...merged, lattice: oneOf(LATTICES, merged.lattice, base.lattice) }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }
  return settings
}

/** Settings that move roots or recolour them, so a change rebuilds the field. The rest is read per frame. */
const GEOMETRY_KEYS = [
  "lattice",
  "spacing",
  "variety",
  "heights",
  "segments",
  "hue",
  "hueRange",
  "colourSize",
  "islands",
  "saturation",
  "cap",
  "seed",
] as const satisfies readonly (keyof Settings)[]

export function needsRebuild(before: Settings, after: Settings): boolean {
  return GEOMETRY_KEYS.some((key) => before[key] !== after[key])
}

/** Append-only. Read `@/experiments/address` before touching this. */
export const REGISTRY: readonly Slot[] = [
  // Retired 2026-10-10: "offset" read the same as "triangle". Appended below with "rows".
  { key: "lattice", kind: "enum", options: ["square", "triangle", "hex", "offset", "diamond"], retired: true },
  { key: "spacing", kind: "num", grid: 1, origin: 6, bits: 7 },
  { key: "diameter", kind: "num", grid: 0.5, origin: 1, bits: 7 },
  { key: "height", kind: "num", grid: 1, origin: 4, bits: 9 },
  { key: "direction", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "breeze", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "gusts", kind: "num", grid: 0.01, origin: 0, bits: 8, retired: true },
  { key: "gustSize", kind: "num", grid: 1, origin: 40, bits: 12, retired: true },
  { key: "swirl", kind: "num", grid: 0.01, origin: 0, bits: 7, retired: true },
  { key: "swirlSize", kind: "num", grid: 1, origin: 40, bits: 12, retired: true },
  { key: "drift", kind: "num", grid: 1, origin: 0, bits: 10 },
  { key: "churn", kind: "num", grid: 0.1, origin: 0, bits: 10, retired: true },
  { key: "sway", kind: "num", grid: 0.01, origin: 0.05, bits: 9 },
  { key: "damping", kind: "num", grid: 0.01, origin: 0.02, bits: 8 },
  { key: "variety", kind: "num", grid: 0.01, origin: 0, bits: 6 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "hueRange", kind: "num", grid: 1, origin: 0, bits: 8 },
  { key: "colourSize", kind: "num", grid: 1, origin: 40, bits: 12 },
  { key: "islands", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "saturation", kind: "num", grid: 1, origin: 0, bits: 7 },
  { key: "cap", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 20 },
  { key: "heights", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "perspective", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  // 2026-10-10: the wind stopped being plane waves. Gusts became events and
  // eddies the curl of noise, so these five mean something new and were
  // retired above rather than edited.
  { key: "lattice", kind: "enum", options: ["square", "triangle", "hex", "rows", "diamond"] },
  { key: "gusts", kind: "num", grid: 0.01, origin: 0, bits: 8 },
  { key: "gustSize", kind: "num", grid: 1, origin: 40, bits: 12 },
  { key: "swirl", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "swirlSize", kind: "num", grid: 1, origin: 40, bits: 12 },
  { key: "churn", kind: "num", grid: 0.1, origin: 0, bits: 10 },
  { key: "veer", kind: "num", grid: 1, origin: 0, bits: 8 },
  { key: "veerRate", kind: "num", grid: 0.1, origin: 0, bits: 8 },
  { key: "lulls", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "gustRate", kind: "num", grid: 0.5, origin: 0, bits: 7 },
  { key: "gustSpread", kind: "num", grid: 1, origin: 0, bits: 8 },
  { key: "heightSway", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "hinge", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "segments", kind: "num", grid: 1, origin: 1, bits: 4 },
]

export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  params.set("s", encodeScene(REGISTRY, settings))
  return params
}

export function urlForSettings(settings: Settings, pathname: string): string {
  return `${pathname}?${settingsToQuery(settings).toString()}`
}

/** The packed form only: this piece was born after the named form stopped being written. */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const packed = params.get("s")
  if (packed) {
    const scene = decodeScene(REGISTRY, packed)
    if (scene) return normalizeSettings(scene as Partial<Settings>)
  }
  return normalizeSettings({})
}

export function namesASetting(params: URLSearchParams): boolean {
  const packed = params.get("s")
  return Boolean(packed && decodeScene(REGISTRY, packed))
}

export function reroll(settings: Settings, seed?: number): Settings {
  return normalizeSettings({ ...settings, seed: seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1)) })
}

export const CHROME: Chrome<Settings> = {
  slug: "dotfield",
  title: "Dotfield",
  canvas: "field",
  boxes: true,
  groups: GROUP_ORDER,
  theme: (settings) => ({ style: { "--hue": String(settings.hue) } }),
  actions: [
    {
      label: "reroll",
      hint: "A fresh wind and fresh colours at the same settings. The seed travels in the address bar.",
      shortcut: "r",
      verb: "reroll",
    },
  ],
  hatches: { settle: "seconds", debug: "flag" },
  banner: [
    ["experiment.get()", "current settings"],
    ["experiment.set({ gusts: 1 })", "change one or more"],
    ["experiment.preset(1)", "load a preset by number or name"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "fresh wind and colours (or press r)"],
    ["experiment.settle(10)", "run the field forward ten seconds"],
    ["experiment.debug(true)", "mark every root"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the field where it is"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.stats()", "columns, lean, neighbour alignment, colour spread, fps"],
    ["experiment.url()", "a link that restores this exact scene"],
  ],
}
