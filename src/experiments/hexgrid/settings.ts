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
 * A hexagonal grid that blooms out from a few dark centres and fades, on a loop.
 *
 * Every hex belongs to its nearest dark centre and sits some number of rings
 * out from it. Colour arrives ring by ring, holds, and then leaves everywhere
 * at once. The colours share one OKLCH lightness and chroma and differ only in
 * hue, which is the "same feel, not the same colour" the seed asks for.
 */
export type Layout = "tiled" | "scattered" | "random"
export type Pattern = "random" | "triad"
export type Gamut = "lightness" | "chroma"
export type FadeBy = "wave" | "together"

export type Settings = {
  /** Tiled: a dark centre in every seven, each ringed by six petals. Scattered: a few centres, spaced. */
  layout: Layout
  /** Scattered only: the least number of hexes between two dark centres. */
  spacing: number
  /** Random only: the share of hexes that are dark centres, in per cent. */
  density: number
  /** Hex radius, centre to corner, in css px — gap included. */
  size: number
  /** Dark gap between neighbouring hexes, in css px. */
  gap: number
  /** Base hue, and the hue of the controls. */
  hue: number
  /** Degrees a hex's hue may differ from its flower's. */
  hues: number
  /** Degrees a flower's own hue may stray from `hue`. */
  drift: number
  /** Degrees each new pattern's hue may stray from `hue`, pattern by pattern. */
  wander: number
  /** How neighbours share out `hues`: at random, or three hues no two neighbours share. */
  pattern: Pattern
  /** OKLCH lightness of a hex at its bright edge. */
  lightness: number
  /** OKLCH chroma of every coloured hex, as far as the screen can show it. */
  chroma: number
  /** How dark a hex's middle is against its edge. 0 is flat, 1 black. */
  core: number
  /** OKLCH lightness of the dark centres. */
  centre: number
  /** What gives way when the screen cannot show a hue at this lightness and chroma. */
  gamut: Gamut
  /** Seconds each centre may start late, at random, centre by centre. */
  stagger: number
  /** How far a lit hex's brightness wanders, slowly, hex by hex. */
  shimmer: number
  /** Opacity of the faint white outline round every hex. */
  edge: number
  /** Seconds of outlines only, before the colour comes. */
  rest: number
  /** Seconds the colour takes to travel one ring out from a centre. */
  travel: number
  /** Seconds one hex takes to come up to full colour. */
  rise: number
  /** Seconds a hex holds its colour (wave), or the grid holds once every hex has it (together). */
  hold: number
  /** Seconds one hex takes to lose its colour. */
  fade: number
  /** Whether hexes lose their colour in the order they got it, or all at once. */
  fadeBy: FadeBy
  seed: number
}

export type NumericKey = Exclude<keyof Settings, "layout" | "pattern" | "gamut" | "fadeBy">

export type Control = KitControl<string & keyof Settings>
export type NumericControl = SliderControl<NumericKey>

export const LAYOUTS: Layout[] = ["tiled", "scattered", "random"]
export const PATTERNS: Pattern[] = ["random", "triad"]
export const GAMUTS: Gamut[] = ["lightness", "chroma"]
export const FADE_BYS: FadeBy[] = ["wave", "together"]

const SEED_BOUNDS = { min: 0, max: 999_999 }

export const GROUP_ORDER = ["grid", "colour", "pulse"] as const

const seconds = (v: number) => `${v.toFixed(1)}s`
const unit = (v: number) => v.toFixed(2)

export const CONTROLS: Control[] = [
  {
    kind: "choice",
    key: "layout",
    label: "centres",
    group: "grid",
    options: [
      { value: "random", label: "random" },
      { value: "scattered", label: "spaced" },
      { value: "tiled", label: "tiled" },
    ],
    hint: "Random drops dark centres anywhere, as many as density asks for: they clump, leave wide gaps, and sometimes touch. Spaced keeps every two centres at least spacing apart, which at small spacing reads as a grid of its own. Tiled makes every seventh hex a centre, so the whole grid is flowers of seven that fit together exactly.",
  },
  {
    kind: "slider",
    key: "spacing",
    label: "spacing",
    group: "grid",
    min: 2,
    max: 30,
    step: 1,
    format: (v) => `${Math.round(v)} hex`,
    hint: "Spaced only: the least distance between two dark centres, in hexes. Larger means fewer centres and further for the colour to travel.",
    inert: (settings: Settings) => settings.layout !== "scattered",
  },
  {
    kind: "slider",
    key: "density",
    label: "density",
    group: "grid",
    min: 0.1,
    max: 20,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}%`,
    hint: "Random only: what share of the hexes are dark centres. Lower means fewer centres and further for the colour to travel.",
    inert: (settings: Settings) => settings.layout !== "random",
  },
  {
    kind: "slider",
    key: "size",
    label: "size",
    group: "grid",
    min: 6,
    max: 120,
    step: 1,
    format: (v) => `${Math.round(v)}px`,
    hint: "Hex radius, centre to corner.",
  },
  {
    kind: "slider",
    key: "gap",
    label: "gap",
    group: "grid",
    min: 0,
    max: 24,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}px`,
    hint: "The dark between neighbouring hexes.",
  },
  {
    kind: "slider",
    key: "edge",
    label: "outline",
    group: "grid",
    min: 0,
    max: 0.6,
    step: 0.01,
    format: unit,
    hint: "Opacity of a thin white line round every hex. It is all there is between pulses.",
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
    hint: "The hue the flowers are spread about, and the colour of these controls.",
  },
  {
    kind: "slider",
    key: "hues",
    label: "neighbours",
    group: "colour",
    min: 0,
    max: 180,
    step: 1,
    format: (v) => `±${Math.round(v)}°`,
    hint: "How far a hex's hue may differ from its flower's. 0 makes each flower one colour; larger keeps neighbours apart in hue while lightness and saturation stay the same.",
  },
  {
    kind: "slider",
    key: "drift",
    label: "flowers",
    group: "colour",
    min: 0,
    max: 180,
    step: 1,
    format: (v) => `±${Math.round(v)}°`,
    hint: "How far each flower's own hue may stray from the hue, flower by flower.",
  },
  {
    kind: "slider",
    key: "wander",
    label: "wander",
    group: "colour",
    min: 0,
    max: 180,
    step: 1,
    format: (v) => `±${Math.round(v)}°`,
    hint: "Every fade brings a new pattern with new centres and new hues. This is how far each new pattern's hue may stray from the hue. The first pattern is always at the hue.",
  },
  {
    kind: "choice",
    key: "pattern",
    label: "pattern",
    group: "colour",
    options: [
      { value: "random", label: "random" },
      { value: "triad", label: "triad" },
    ],
    hint: "Random gives each hex its own hue from the neighbours range. Triad gives the grid three hues at the ends and middle of that range, laid so no two neighbours share one.",
  },
  {
    kind: "slider",
    key: "lightness",
    label: "lightness",
    group: "colour",
    min: 0.2,
    max: 0.95,
    step: 0.01,
    format: unit,
    hint: "How light a hex is at its edge, in OKLCH. Every coloured hex shares it.",
  },
  {
    kind: "slider",
    key: "chroma",
    label: "chroma",
    group: "colour",
    min: 0,
    max: 0.37,
    step: 0.005,
    format: (v) => v.toFixed(3),
    hint: "How saturated every coloured hex is, in OKLCH. A hue the screen cannot show that saturated is pulled in until it can, keeping its lightness.",
  },
  {
    kind: "choice",
    key: "gamut",
    label: "out of gamut",
    group: "colour",
    options: [
      { value: "lightness", label: "keep light" },
      { value: "chroma", label: "keep vivid" },
    ],
    hint: "No screen shows every hue equally saturated at one lightness. Keep light holds every hex at the same lightness and lets the hard hues go greyer. Keep vivid holds the saturation and moves those hues lighter or darker until the screen can show them.",
  },
  {
    kind: "slider",
    key: "core",
    label: "core",
    group: "colour",
    min: 0,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "How dark a hex's middle is against its edge. 0 is a flat hex; 1 goes to black at the middle.",
  },
  {
    kind: "slider",
    key: "centre",
    label: "centres",
    group: "colour",
    min: 0,
    max: 0.5,
    step: 0.01,
    format: unit,
    hint: "Lightness of the dark centres, in OKLCH. 0 is black.",
  },
  {
    kind: "slider",
    key: "rest",
    label: "rest",
    group: "pulse",
    min: 0,
    max: 20,
    step: 0.1,
    format: seconds,
    hint: "How long only the outlines show before the colour comes.",
  },
  {
    kind: "slider",
    key: "travel",
    label: "travel",
    group: "pulse",
    min: 0,
    max: 4,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}s`,
    hint: "Seconds for the colour to move one ring out from a centre. 0 lights everything at once.",
  },
  {
    kind: "slider",
    key: "rise",
    label: "rise",
    group: "pulse",
    min: 0.1,
    max: 10,
    step: 0.1,
    format: seconds,
    hint: "How long one hex takes to come up to full colour once the colour reaches it.",
  },
  {
    kind: "slider",
    key: "stagger",
    label: "stagger",
    group: "pulse",
    min: 0,
    max: 6,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}s`,
    hint: "How late each centre may start its bloom, at random. 0 fires every centre together. The fade still happens everywhere at once.",
  },
  {
    kind: "slider",
    key: "shimmer",
    label: "shimmer",
    group: "pulse",
    min: 0,
    max: 0.6,
    step: 0.01,
    format: unit,
    hint: "How much a lit hex's brightness wanders, slowly and out of step with its neighbours, so a settled grid still breathes. 0 holds it still.",
  },
  {
    kind: "slider",
    key: "hold",
    label: "hold",
    group: "pulse",
    min: 0,
    max: 30,
    step: 0.1,
    format: seconds,
    hint: "How long a hex keeps its full colour before it starts to fade. With fade together, how long the whole grid keeps it once every hex is lit.",
  },
  {
    kind: "slider",
    key: "fade",
    label: "fade",
    group: "pulse",
    min: 0.1,
    max: 20,
    step: 0.1,
    format: seconds,
    hint: "How long one hex takes to lose its colour, and its outline with it.",
  },
  {
    kind: "choice",
    key: "fadeBy",
    label: "fade",
    group: "pulse",
    options: [
      { value: "wave", label: "wave" },
      { value: "together", label: "together" },
    ],
    hint: "Wave takes the colour out the way it came in, centre first and ring by ring at the same pace, so every hex is lit for the same time and a quick bloom fades quickly. Together takes it out of every hex at once, once the last hex is lit.",
  },
]

export const DEFAULT_SETTINGS: Settings = {
  layout: "random",
  spacing: 6,
  density: 1,
  size: 34,
  gap: 4,
  hue: 280,
  hues: 50,
  drift: 60,
  wander: 60,
  pattern: "random",
  lightness: 0.62,
  chroma: 0.2,
  core: 0.7,
  centre: 0.08,
  edge: 0.1,
  gamut: "lightness",
  stagger: 0,
  shimmer: 0,
  rest: 2,
  travel: 0.5,
  rise: 1.5,
  hold: 4,
  fade: 3,
  fadeBy: "wave",
  seed: 1,
}

/** Written out rather than derived from `CONTROLS`; see `src/experiments/AGENTS.md` under Presets. */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  spacing: { min: 2, max: 30, step: 1 },
  density: { min: 0.1, max: 20, step: 0.1 },
  wander: { min: 0, max: 180, step: 1 },
  size: { min: 6, max: 120, step: 1 },
  gap: { min: 0, max: 24, step: 0.5 },
  edge: { min: 0, max: 0.6, step: 0.01 },
  hue: { min: 0, max: 360, step: 1 },
  hues: { min: 0, max: 180, step: 1 },
  drift: { min: 0, max: 180, step: 1 },
  lightness: { min: 0.2, max: 0.95, step: 0.01 },
  chroma: { min: 0, max: 0.37, step: 0.005 },
  core: { min: 0, max: 1, step: 0.05 },
  centre: { min: 0, max: 0.5, step: 0.01 },
  stagger: { min: 0, max: 6, step: 0.05 },
  shimmer: { min: 0, max: 0.6, step: 0.01 },
  rest: { min: 0, max: 20, step: 0.1 },
  travel: { min: 0, max: 4, step: 0.05 },
  rise: { min: 0.1, max: 10, step: 0.1 },
  hold: { min: 0, max: 30, step: 0.1 },
  fade: { min: 0.1, max: 20, step: 0.1 },
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
  const settings: Settings = {
    ...merged,
    layout: oneOf(LAYOUTS, merged.layout, base.layout),
    pattern: oneOf(PATTERNS, merged.pattern, base.pattern),
    gamut: oneOf(GAMUTS, merged.gamut, base.gamut),
    fadeBy: oneOf(FADE_BYS, merged.fadeBy, base.fadeBy),
  }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }

  return settings
}

/** Settings that decide which hex is where and what colour it is. Everything else is read per frame. */
const GRID_KEYS = [
  "layout",
  "spacing",
  "density",
  "size",
  "gap",
  "hue",
  "hues",
  "drift",
  "pattern",
  "gamut",
  "lightness",
  "chroma",
  "centre",
  "core",
  "seed",
] as const satisfies readonly (keyof Settings)[]

export function needsRebuild(before: Settings, after: Settings): boolean {
  return GRID_KEYS.some((key) => before[key] !== after[key])
}

/** Append-only. Read `@/experiments/address` before touching this. */
export const REGISTRY: readonly Slot[] = [
  // Retired 2026-10-11: random joined the options. Appended below with three.
  { key: "layout", kind: "enum", options: ["tiled", "scattered"], retired: true },
  { key: "spacing", kind: "num", grid: 1, origin: 2, bits: 5 },
  { key: "size", kind: "num", grid: 1, origin: 6, bits: 7 },
  { key: "gap", kind: "num", grid: 0.5, origin: 0, bits: 6 },
  { key: "edge", kind: "num", grid: 0.01, origin: 0, bits: 6 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "hues", kind: "num", grid: 1, origin: 0, bits: 8 },
  { key: "drift", kind: "num", grid: 1, origin: 0, bits: 8 },
  { key: "pattern", kind: "enum", options: ["random", "triad"] },
  { key: "lightness", kind: "num", grid: 0.01, origin: 0.2, bits: 7 },
  { key: "chroma", kind: "num", grid: 0.005, origin: 0, bits: 7 },
  { key: "core", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "centre", kind: "num", grid: 0.01, origin: 0, bits: 6 },
  { key: "rest", kind: "num", grid: 0.1, origin: 0, bits: 8 },
  { key: "travel", kind: "num", grid: 0.05, origin: 0, bits: 7 },
  { key: "rise", kind: "num", grid: 0.1, origin: 0.1, bits: 7 },
  { key: "hold", kind: "num", grid: 0.1, origin: 0, bits: 9 },
  { key: "fade", kind: "num", grid: 0.1, origin: 0.1, bits: 8 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 20 },
  { key: "gamut", kind: "enum", options: ["lightness", "chroma"] },
  { key: "stagger", kind: "num", grid: 0.05, origin: 0, bits: 7 },
  { key: "shimmer", kind: "num", grid: 0.01, origin: 0, bits: 6 },
  { key: "layout", kind: "enum", options: ["tiled", "scattered", "random"] },
  { key: "density", kind: "num", grid: 0.1, origin: 0.1, bits: 8 },
  { key: "wander", kind: "num", grid: 1, origin: 0, bits: 8 },
  { key: "fadeBy", kind: "enum", options: ["wave", "together"] },
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
  slug: "hexgrid",
  title: "Hexgrid",
  canvas: "field",
  boxes: true,
  groups: GROUP_ORDER,
  theme: (settings) => ({ style: { "--hue": String(settings.hue) } }),
  actions: [
    {
      label: "reroll",
      hint: "Fresh centres and hues at the same settings. The seed travels in the address bar.",
      shortcut: "r",
      verb: "reroll",
    },
  ],
  hatches: { settle: "seconds", debug: "flag" },
  banner: [
    ["experiment.get()", "current settings"],
    ["experiment.set({ spacing: 9 })", "change one or more"],
    ["experiment.preset(1)", "load a preset by number or name"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "fresh centres and hues (or press r)"],
    ["experiment.settle(5)", "jump the loop forward by seconds"],
    ["experiment.clear()", "start the loop again from outlines"],
    ["experiment.debug(true)", "print each hex's ring number"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the loop where it is"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.stats()", "hexes, centres, rings, loop phase, colour measured"],
    ["experiment.url()", "a link that restores this exact scene"],
  ],
}
