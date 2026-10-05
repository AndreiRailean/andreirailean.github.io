import { decodeScene, encodeScene, type Slot } from "@/experiments/address"
import {
  gridAt,
  snapToGrid,
  type Control as KitControl,
  type RangeControl,
  type SliderControl,
  type Track,
} from "@/experiments/kit/controls"
import type { Chrome } from "@/experiments/piece"

/** Re-exported so a consumer needs one import for a control and its keys. */
export { keysOf } from "@/experiments/kit/controls"

/**
 * Lines of dots streaming out of emitters.
 *
 * An emitter is a point, usually off screen, with a heading and a speed of its
 * own. It lets go of a dot at random intervals, and every dot it has let go of
 * travels along its line at that one speed. The line is never drawn: it is only
 * ever implied by the dots on it, which is the "live line" the seed asks for.
 */
export type Layout = "edge" | "ring"
export type Placement = "even" | "random"
export type Aim = "centre" | "parallel"
export type GapBy = "distance" | "time"

export type Settings = {
  /** Where the emitters stand: along one off-screen edge, or on a circle round the middle. */
  layout: Layout
  emitters: number
  /** Degrees, 0 travelling right and 90 travelling down — screen y grows downward. */
  heading: number
  /** How the emitters share out their edge or their circle. */
  placement: Placement
  /** On a ring: whether lines head for the middle or all share the heading. */
  aim: Aim
  /** On a ring aimed at the middle: degrees every line turns off it, alike. */
  twist: number
  /** Degrees each line's own heading may stray, at random, from what it was aimed at. */
  spread: number
  /** On a ring: its radius, in half-diagonals of the frame. 1 just clears the corners. */
  ring: number
  /** Speed of the slowest and fastest lines, in per cent of the frame's diagonal per second. */
  slowest: number
  fastest: number
  /** Mean distance between neighbouring dots on a line, in css px. */
  gap: number
  /** Whether `gap` is held in distance on every line, or in time so fast lines thin out. */
  gapBy: GapBy
  /** 0 lets dots out as a Poisson stream, clumped and gappy; 1 nearly a metronome. */
  evenness: number
  /** Dot radius, in css px. */
  size: number
  /** How much lines differ in dot size from each other. 0 is one size everywhere. */
  lineSizes: number
  /** How much dots on one line differ in size from each other. */
  dotSizes: number
  /** Hue of the controls, and of the dots once `tint` is above 0. */
  hue: number
  /** How strongly the dots take the hue. 0 is white. */
  tint: number
  /** Degrees each line's hue may stray from `hue`, at random, line by line. */
  hues: number
  seed: number
}

export type NumericKey = Exclude<keyof Settings, "layout" | "placement" | "aim" | "gapBy">

export type Control = KitControl<string & keyof Settings>
export type NumericControl = SliderControl<NumericKey> | RangeControl<NumericKey>

export const LAYOUTS: Layout[] = ["edge", "ring"]
export const PLACEMENTS: Placement[] = ["even", "random"]
export const AIMS: Aim[] = ["centre", "parallel"]
export const GAP_BYS: GapBy[] = ["distance", "time"]

const SEED_BOUNDS = { min: 0, max: 999_999 }

const onRing = (settings: Settings) => settings.layout !== "ring"

export const GROUP_ORDER = ["emitters", "lines", "dots"] as const

export const CONTROLS: Control[] = [
  {
    kind: "choice",
    key: "layout",
    label: "origin",
    group: "emitters",
    options: [
      { value: "edge", label: "edge" },
      { value: "ring", label: "ring" },
    ],
    hint: "Where the emitters stand. Edge lines them up just off screen, across from wherever the heading points, so every line enters from a side — one side when the heading is square to the screen, two when it is diagonal. Ring stands them on a circle round the middle of the screen.",
  },
  {
    kind: "slider",
    key: "emitters",
    label: "emitters",
    group: "emitters",
    min: 1,
    max: 800,
    step: 1,
    scale: "log",
    format: (v) => String(Math.round(v)),
    hint: "How many lines. Each emitter makes one, so this is also how full the screen is.",
  },
  {
    kind: "choice",
    key: "placement",
    label: "spacing",
    group: "emitters",
    options: [
      { value: "random", label: "random" },
      { value: "even", label: "even" },
    ],
    hint: "How the emitters share out their edge or their circle. Random scatters them, so some lines bunch and some leave gaps. Even spaces them exactly, which on a ring is what makes a clean star.",
  },
  {
    kind: "slider",
    key: "heading",
    label: "heading",
    group: "emitters",
    min: 0,
    max: 359,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Which way the lines travel. 0 is left to right, 90 top to bottom, 45 a diagonal from the top-left corner. On a ring it is used only when the lines are aimed parallel.",
    inert: (settings: Settings) => settings.layout === "ring" && settings.aim === "centre",
  },
  {
    kind: "choice",
    key: "aim",
    label: "aim",
    group: "emitters",
    options: [
      { value: "centre", label: "middle" },
      { value: "parallel", label: "parallel" },
    ],
    hint: "On a ring: whether every line heads for the middle of the circle, which makes a star, or all follow the heading, which makes one stream fed from all round.",
    inert: onRing,
  },
  {
    kind: "slider",
    key: "ring",
    label: "ring size",
    group: "emitters",
    min: 0.1,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}×`,
    hint: "Radius of the ring, in half-diagonals of the screen. Above 1 every emitter is off screen; below it they stand inside the picture and the lines visibly start from points.",
    inert: onRing,
  },
  {
    kind: "slider",
    key: "twist",
    label: "twist",
    group: "lines",
    min: -90,
    max: 90,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "On a ring aimed at the middle: how far every line turns off the middle, all by the same amount. 0 passes every line through the centre. A few degrees opens a hole there, and the lines' crossings draw a circle round it.",
    inert: (settings: Settings) => settings.layout !== "ring" || settings.aim !== "centre",
  },
  {
    kind: "slider",
    key: "spread",
    label: "scatter",
    group: "lines",
    min: 0,
    max: 90,
    step: 1,
    format: (v) => `±${Math.round(v)}°`,
    hint: "How far each line's own direction strays, at random, from where it was aimed. 0 keeps every line exact — parallel, or through the middle. 90 is random angles.",
  },
  {
    kind: "range",
    keys: ["slowest", "fastest"],
    label: "speed",
    group: "lines",
    min: 0.5,
    max: 100,
    step: 0.1,
    scale: "log",
    format: (from, to) => `${(100 / to).toFixed(1)}–${(100 / from).toFixed(1)}s`,
    hint: "How fast lines travel, shown as how long the fastest and slowest take to cross the screen corner to corner. Every line picks its own speed from between these, and all the dots on a line move at it.",
  },
  {
    kind: "slider",
    key: "gap",
    label: "gap",
    group: "dots",
    min: 2,
    max: 600,
    step: 1,
    scale: "log",
    format: (v) => `${Math.round(v)}px`,
    hint: "Average distance between neighbouring dots on a line. Smaller reads as a solid line, larger as a dotted one.",
  },
  {
    kind: "choice",
    key: "gapBy",
    label: "gap held in",
    group: "dots",
    options: [
      { value: "distance", label: "distance" },
      { value: "time", label: "time" },
    ],
    hint: "Distance keeps the gap the same on every line, so a slow line and a fast one look equally dotted. Time has every emitter let go at the same rate, so fast lines come out sparse and slow ones crowded.",
  },
  {
    kind: "slider",
    key: "evenness",
    label: "evenness",
    group: "dots",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How regular the intervals are. 0 is fully random — dots clump and leave long gaps. Towards 1 they settle into a steady beat and the line looks more like a fixed dotted rule.",
  },
  {
    kind: "slider",
    key: "size",
    label: "size",
    group: "dots",
    min: 0.3,
    max: 16,
    step: 0.1,
    scale: "log",
    format: (v) => `${v.toFixed(1)}px`,
    hint: "Radius of a dot.",
  },
  {
    kind: "slider",
    key: "lineSizes",
    label: "line sizes",
    group: "dots",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much lines differ from each other in dot size. 0 gives every line the same dots; 1 puts sixteen times the radius between the smallest line and the largest.",
  },
  {
    kind: "slider",
    key: "dotSizes",
    label: "dot sizes",
    group: "dots",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much dots on one line differ from each other in size. 0 keeps a line's dots identical; 1 puts sixteen times the radius between a line's smallest dot and its largest.",
  },
  {
    kind: "slider",
    key: "hue",
    label: "hue",
    group: "dots",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Colour of these controls, and of the dots as far as tint lets it.",
  },
  {
    kind: "slider",
    key: "tint",
    label: "tint",
    group: "dots",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How strongly the dots take the hue. 0 leaves them white; 1 is the hue at full strength.",
  },
  {
    kind: "slider",
    key: "hues",
    label: "hue spread",
    group: "dots",
    min: 0,
    max: 180,
    step: 1,
    format: (v) => `±${Math.round(v)}°`,
    hint: "How far each line's colour may stray from the hue, line by line. Needs some tint to show.",
    inert: (settings: Settings) => settings.tint === 0,
  },
]

export const DEFAULT_SETTINGS: Settings = {
  layout: "edge",
  emitters: 10,
  heading: 0,
  placement: "random",
  aim: "centre",
  twist: 0,
  spread: 0,
  ring: 1.2,
  slowest: 4,
  fastest: 20,
  gap: 40,
  gapBy: "distance",
  evenness: 0,
  size: 2.5,
  lineSizes: 0,
  dotSizes: 0,
  hue: 200,
  tint: 0,
  hues: 0,
  seed: 1,
}

/** Written out rather than derived from `CONTROLS`; see `src/experiments/AGENTS.md` under Presets. */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  emitters: { min: 1, max: 800, step: 1, scale: "log" },
  heading: { min: 0, max: 359, step: 1 },
  ring: { min: 0.1, max: 3, step: 0.05 },
  twist: { min: -90, max: 90, step: 1 },
  spread: { min: 0, max: 90, step: 1 },
  slowest: { min: 0.5, max: 100, step: 0.1, scale: "log" },
  fastest: { min: 0.5, max: 100, step: 0.1, scale: "log" },
  gap: { min: 2, max: 600, step: 1, scale: "log" },
  evenness: { min: 0, max: 1, step: 0.05 },
  size: { min: 0.3, max: 16, step: 0.1, scale: "log" },
  lineSizes: { min: 0, max: 1, step: 0.05 },
  dotSizes: { min: 0, max: 1, step: 0.05 },
  hue: { min: 0, max: 360, step: 1 },
  tint: { min: 0, max: 1, step: 0.05 },
  hues: { min: 0, max: 180, step: 1 },
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
    placement: oneOf(PLACEMENTS, merged.placement, base.placement),
    aim: oneOf(AIMS, merged.aim, base.aim),
    gapBy: oneOf(GAP_BYS, merged.gapBy, base.gapBy),
  }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }

  if (settings.slowest > settings.fastest) settings.fastest = settings.slowest
  return settings
}

/** Keeps the speed pair in order, moving whichever end is not being dragged. */
export function reconcile(next: Settings, changed: keyof Settings): Settings {
  if (changed === "slowest" && next.slowest > next.fastest) return { ...next, fastest: next.slowest }
  if (changed === "fastest" && next.fastest < next.slowest) return { ...next, slowest: next.fastest }
  return next
}

/**
 * Settings that decide where the lines are and what is already on them, so a
 * change rebuilds the scene. Everything else is read per frame.
 */
const GEOMETRY_KEYS = [
  "layout",
  "emitters",
  "heading",
  "placement",
  "aim",
  "twist",
  "spread",
  "ring",
  "slowest",
  "fastest",
  "gap",
  "gapBy",
  "evenness",
  "lineSizes",
  "dotSizes",
  "hues",
  "seed",
] as const satisfies readonly (keyof Settings)[]

export function needsRebuild(before: Settings, after: Settings): boolean {
  return GEOMETRY_KEYS.some((key) => before[key] !== after[key])
}

/** Append-only. Read `@/experiments/address` before touching this. */
export const REGISTRY: readonly Slot[] = [
  { key: "layout", kind: "enum", options: ["edge", "ring"] },
  { key: "emitters", kind: "num", grid: 1, origin: 1, bits: 10 },
  { key: "heading", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "placement", kind: "enum", options: ["even", "random"] },
  { key: "aim", kind: "enum", options: ["centre", "parallel"] },
  { key: "twist", kind: "num", grid: 1, origin: -90, bits: 8 },
  { key: "spread", kind: "num", grid: 1, origin: 0, bits: 7 },
  { key: "ring", kind: "num", grid: 0.05, origin: 0.1, bits: 6 },
  { key: "slowest", kind: "num", grid: 0.1, origin: 0.5, bits: 10 },
  { key: "fastest", kind: "num", grid: 0.1, origin: 0.5, bits: 10 },
  { key: "gap", kind: "num", grid: 1, origin: 2, bits: 10 },
  { key: "gapBy", kind: "enum", options: ["distance", "time"] },
  { key: "evenness", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "size", kind: "num", grid: 0.1, origin: 0.3, bits: 8 },
  // Retired 2026-10-06: 1 meant a lognormal of sigma 0.6, too weak to see on
  // small dots. The same keys are appended below at 1 meaning a 16x ratio.
  { key: "lineSizes", kind: "num", grid: 0.05, origin: 0, bits: 5, retired: true },
  { key: "dotSizes", kind: "num", grid: 0.05, origin: 0, bits: 5, retired: true },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 20 },
  { key: "lineSizes", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "dotSizes", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "tint", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "hues", kind: "num", grid: 1, origin: 0, bits: 8 },
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
  slug: "streakers",
  title: "Streakers",
  canvas: "field",
  boxes: true,
  groups: GROUP_ORDER,
  theme: (settings) => ({ style: { "--hue": String(settings.hue) } }),
  actions: [
    {
      label: "reroll",
      hint: "Fresh emitters at the same settings. The seed travels in the address bar.",
      shortcut: "r",
      verb: "reroll",
    },
  ],
  hatches: { debug: "flag" },
  banner: [
    ["experiment.get()", "current settings"],
    ["experiment.set({ emitters: 200 })", "change one or more"],
    ["experiment.preset(1)", "load a preset by number or name"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "fresh emitters (or press r)"],
    ["experiment.clear()", "empty every line and watch them fill"],
    ["experiment.debug(true)", "draw the emitters and their lines"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the dots where they are, or let them run on"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.stats()", "lines, dots, measured gaps and speeds, fps"],
    ["experiment.url()", "a link that restores this exact scene"],
  ],
}
