import { TIMESCALE_SLOT, timescaleControl, timescaleTrack } from "@/experiments/kit/speed"
import { clamp, onTracks, oneOf, packedAddress, reroller } from "@/experiments/settings-plumbing"
import type { Slot } from "@/experiments/address"
import type { Control as KitControl, SliderControl, Track } from "@/experiments/kit/controls"
import type { Chrome } from "@/experiments/piece"

/**
 * The clock rate this piece's 1× stands for, as a multiple of real time. The
 * kit's speed control scales it — `kit/speed.ts`.
 */
export const CLOCK_RATE = 1

/** Re-exported so a consumer needs one import for a control and its keys. */
export { keysOf } from "@/experiments/kit/controls"

/**
 * Lines that grow and split inside one segment of a circle, repeated round the
 * centre.
 *
 * Only one segment's lines are grown; every other segment is the same lines
 * drawn again through a rotation or a reflection, so the cost of a frame is
 * the lines of one segment times the number of segments, and nothing is
 * drawn off screen to be cut away. Distances are fractions of the frame's
 * half-diagonal, so a resize rescales the drawing rather than regrowing it.
 */
export type Symmetry = "mirror" | "turn"
export type Confine = "wedge" | "free"
export type Stops = "any" | "own" | "none"
export type Angle = "15" | "30" | "45" | "60" | "90"
export type ColourBy = "depth" | "family" | "age" | "copy"
export type Cycle = "each" | "together"
export type From = "centre" | "sides"

export type Settings = {
  /** How many times the segment repeats round the centre. */
  segments: number
  /** Mirror: every other segment is reflected, as in a real kaleidoscope. Turn: every segment is the same, rotated. */
  symmetry: Symmetry
  /** Wedge: a line ends at its segment's edges. Free: it crosses them and lives among the other segments' copies. */
  confine: Confine
  /** Which meetings end a line: any line, only its own family and that family's copies, or none. */
  stops: Stops
  /** Roots a segment holds: each a family of lines with a life of its own. */
  roots: number
  /** Centre: roots start at or near the middle. Sides: they start on the segment's edges, square to them. */
  from: From
  /** From the centre, how far out roots may start, as a fraction of the half-diagonal. 0 starts them all at the centre. */
  spread: number
  /** Degrees every root leans off its starting direction. */
  lean: number
  /** Each: every family grows, holds, undraws and is reborn on its own clock. Together: the whole drawing does, at once. */
  cycle: Cycle
  /** Every line runs at a whole number of these off its segment's middle. */
  angle: Angle
  /** Length of line between decisions, in per cent of the half-diagonal. */
  step: number
  /** Odds a decision splits the line into two at opposite angles. */
  split: number
  /** Odds a decision turns the line by the angle. */
  turn: number
  /** Odds a split line carries on between its two offshoots. */
  keep: number
  /** Decisions a line's family makes before it stops of its own accord. */
  life: number
  /** How fast every tip grows, in per cent of the half-diagonal per second. */
  speed: number
  /** Seconds a finished family (or drawing, together) holds before it undraws and is reborn. 120 holds it for good. */
  hold: number
  /** Degrees per second the whole figure turns. */
  spin: number
  /** Line width, css px. */
  width: number
  /** Each decision thins a line by this share of its width: the spine bold, the tips fine. */
  taper: number
  /** Hue of the controls, and the first colour of the lines once `tint` is above 0. */
  hue: number
  /** How strongly the lines take colour. 0 is white. */
  tint: number
  /** Degrees of hue the colouring sweeps through. */
  hues: number
  /** What the colour follows: a line's depth, its root, when it grew, or which copy of the segment it is in. */
  colourBy: ColourBy
  seed: number
  /** The speed control's value: a multiple of `CLOCK_RATE`. The kit's — `kit/speed.ts`. */
  timescale: number
}

type EnumKey = "symmetry" | "confine" | "stops" | "angle" | "colourBy" | "cycle" | "from"
export type NumericKey = Exclude<keyof Settings, EnumKey>

export type Control = KitControl<string & keyof Settings>
export type NumericControl = SliderControl<NumericKey>

export const SYMMETRIES: Symmetry[] = ["mirror", "turn"]
export const CONFINES: Confine[] = ["wedge", "free"]
export const STOPS: Stops[] = ["any", "own", "none"]
export const ANGLES: Angle[] = ["15", "30", "45", "60", "90"]
export const COLOUR_BYS: ColourBy[] = ["depth", "family", "age", "copy"]
export const CYCLES: Cycle[] = ["each", "together"]
export const FROMS: From[] = ["centre", "sides"]

/** The hold that means "for good". */
export const HOLD_FOREVER = 120

const SEED_BOUNDS = { min: 0, max: 999_999 }

export const GROUP_ORDER = ["kaleidoscope", "growth", "look"] as const

const pct = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`

export const CONTROLS: Control[] = [
  {
    kind: "slider",
    key: "segments",
    label: "segments",
    group: "kaleidoscope",
    min: 2,
    max: 32,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "How many times the segment repeats round the centre. Only one segment's lines are grown; the rest are copies.",
  },
  {
    kind: "choice",
    key: "symmetry",
    label: "symmetry",
    group: "kaleidoscope",
    options: [
      { value: "mirror", label: "mirror" },
      { value: "turn", label: "turn" },
    ],
    hint: "Mirror reflects every other segment, as the mirrors of a kaleidoscope do, so a line reaching a segment's edge meets its own reflection there. Turn rotates the segment without reflecting it: a pinwheel, with no edge a line has to meet itself at.",
  },
  {
    kind: "choice",
    key: "confine",
    label: "lines",
    group: "kaleidoscope",
    options: [
      { value: "wedge", label: "in segment" },
      { value: "free", label: "free" },
    ],
    hint: "In segment ends a line at its segment's edges, the plain kaleidoscope. Free lets it carry on across them, among the copies of everything else, until it meets something that stops it.",
  },
  {
    kind: "choice",
    key: "stops",
    label: "stops at",
    group: "kaleidoscope",
    options: [
      { value: "any", label: "any line" },
      { value: "own", label: "itself" },
      { value: "none", label: "nothing" },
    ],
    hint: "Which meetings end a growing line. Any line: the first it reaches. Itself: only lines from its own root, and their copies in the other segments, so it crosses everything else. Nothing: it ends only at the edge, or when its life runs out.",
  },
  {
    kind: "slider",
    key: "roots",
    label: "roots",
    group: "kaleidoscope",
    min: 1,
    max: 48,
    step: 1,
    scale: "log",
    format: (v) => String(Math.round(v)),
    hint: "How many roots a segment holds. Each grows a family of lines with a life of its own, so more roots is more of the figure changing at once.",
  },
  {
    kind: "choice",
    key: "from",
    label: "roots from",
    group: "kaleidoscope",
    options: [
      { value: "centre", label: "centre" },
      { value: "sides", label: "sides" },
    ],
    hint: "Centre starts roots at or near the middle, growing outward. Sides starts them anywhere along the segment's edges, square to the edge and so parallel to each other, growing in across the segment: bands.",
  },
  {
    kind: "slider",
    key: "spread",
    label: "scatter",
    group: "kaleidoscope",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => (v === 0 ? "centre" : `≤${Math.round(v * 100)}%`),
    hint: "From the centre: how far out the roots may start, as a share of the way to the corner. At 0 every root grows out from the middle; above it they start scattered through the segment.",
    inert: (settings: Settings) => settings.from !== "centre",
  },
  {
    kind: "slider",
    key: "lean",
    label: "lean",
    group: "kaleidoscope",
    min: -80,
    max: 80,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "How far every root leans off its starting direction — off square to the edge, from the sides; off the middle, from the centre. Every root leans alike, so roots from one side stay parallel.",
  },
  {
    kind: "choice",
    key: "cycle",
    label: "renewal",
    group: "kaleidoscope",
    options: [
      { value: "each", label: "each root" },
      { value: "together", label: "all at once" },
    ],
    hint: "Each root: every family grows, holds, undraws in the order it grew and is born again somewhere new, on its own clock, so the figure never stops changing. All at once: the whole drawing grows, holds and undraws together.",
  },
  {
    kind: "choice",
    key: "angle",
    label: "angle",
    group: "growth",
    options: /* @__PURE__ */ ANGLES.map((value) => ({ value, label: `${value}°` })),
    hint: "Every turn and split is made at this angle, and every line runs a whole number of them off its segment's middle, so lines far apart in a segment come out parallel.",
  },
  {
    kind: "slider",
    key: "step",
    label: "step",
    group: "growth",
    min: 1,
    max: 40,
    step: 0.5,
    scale: "log",
    format: pct,
    hint: "How far a line grows between decisions, as a share of the way from the centre to the corner.",
  },
  {
    kind: "slider",
    key: "split",
    label: "split",
    group: "growth",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "Odds a decision splits the line in two at opposite angles.",
  },
  {
    kind: "slider",
    key: "keep",
    label: "carry on",
    group: "growth",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "Odds a line that split carries on straight between its two offshoots, rather than ending at the split.",
  },
  {
    kind: "slider",
    key: "turn",
    label: "turn",
    group: "growth",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "Odds a decision turns the line by the angle, either way. Split is tried first; whatever is left of the odds goes straight on.",
  },
  {
    kind: "slider",
    key: "life",
    label: "life",
    group: "growth",
    min: 1,
    max: 80,
    step: 1,
    scale: "log",
    format: (v) => String(Math.round(v)),
    hint: "Decisions a line and its offshoots make before they stop of their own accord.",
  },
  {
    kind: "slider",
    key: "speed",
    label: "growth",
    group: "growth",
    min: 0.5,
    max: 50,
    step: 0.1,
    scale: "log",
    format: (v) => `${pct(v)}/s`,
    hint: "How fast every tip grows, as a share of the way from the centre to the corner each second.",
  },
  {
    kind: "slider",
    key: "hold",
    label: "hold",
    group: "growth",
    min: 0,
    max: HOLD_FOREVER,
    step: 1,
    format: (v) => (v >= HOLD_FOREVER ? "for good" : `${Math.round(v)}s`),
    hint: "How long a family that has stopped growing stays before it undraws in the order it grew and is born again. All at once, how long the whole finished drawing stays. At the top it stays for good.",
  },
  {
    kind: "slider",
    key: "spin",
    label: "spin",
    group: "look",
    min: -30,
    max: 30,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}°/s`,
    hint: "How fast the whole figure turns, and which way.",
  },
  {
    kind: "slider",
    key: "width",
    label: "width",
    group: "look",
    min: 0.25,
    max: 8,
    step: 0.05,
    scale: "log",
    format: (v) => `${v.toFixed(2)}px`,
    hint: "Line width, of the spine when there is a taper.",
  },
  {
    kind: "slider",
    key: "taper",
    label: "taper",
    group: "look",
    min: 0,
    max: 0.5,
    step: 0.01,
    format: (v) => (v === 0 ? "none" : `−${Math.round(v * 100)}%`),
    hint: "How much thinner a line is for every decision behind it, so the first lines are bold and the last are hairlines.",
  },
  {
    kind: "slider",
    key: "hue",
    label: "hue",
    group: "look",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Colour of these controls, and where the lines' colours start once they have some tint.",
  },
  {
    kind: "slider",
    key: "tint",
    label: "tint",
    group: "look",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How strongly the lines take colour. 0 leaves them white; 1 is the colour at full strength.",
  },
  {
    kind: "slider",
    key: "hues",
    label: "hue sweep",
    group: "look",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "How far round the colour wheel the colouring travels, from the hue onward. Needs some tint to show.",
    inert: (settings: Settings) => settings.tint === 0,
  },
  {
    kind: "choice",
    key: "colourBy",
    label: "colour by",
    group: "look",
    options: [
      { value: "depth", label: "depth" },
      { value: "family", label: "root" },
      { value: "age", label: "age" },
      { value: "copy", label: "copy" },
    ],
    hint: "What the colour follows. Depth: how many decisions are behind a line, so colour moves outward. Root: each root and its offshoots one colour. Age: when a line grew, so the colours keep spreading over the drawing as it grows. Copy: each copy of the segment its own colour, which shows the tiling.",
    inert: (settings: Settings) => settings.tint === 0,
  },
  /* @__PURE__ */ timescaleControl(),
]

export const DEFAULT_SETTINGS: Settings = {
  segments: 8,
  symmetry: "mirror",
  confine: "wedge",
  stops: "any",
  roots: 1,
  from: "centre",
  spread: 0,
  lean: 0,
  cycle: "each",
  angle: "45",
  step: 6,
  split: 0.35,
  turn: 0.3,
  keep: 0.5,
  life: 24,
  speed: 8,
  hold: 8,
  spin: 0,
  width: 1,
  taper: 0,
  hue: 200,
  tint: 0,
  hues: 120,
  colourBy: "depth",
  seed: 1,
  timescale: 1,
}

/** Written out rather than derived from `CONTROLS`; see `src/experiments/AGENTS.md` under Presets. */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  segments: { min: 2, max: 32, step: 1 },
  roots: { min: 1, max: 48, step: 1, scale: "log" },
  lean: { min: -80, max: 80, step: 1 },
  spread: { min: 0, max: 1, step: 0.02 },
  step: { min: 1, max: 40, step: 0.5, scale: "log" },
  split: { min: 0, max: 1, step: 0.05 },
  keep: { min: 0, max: 1, step: 0.05 },
  turn: { min: 0, max: 1, step: 0.05 },
  life: { min: 1, max: 80, step: 1, scale: "log" },
  speed: { min: 0.5, max: 50, step: 0.1, scale: "log" },
  hold: { min: 0, max: HOLD_FOREVER, step: 1 },
  spin: { min: -30, max: 30, step: 0.5 },
  width: { min: 0.25, max: 8, step: 0.05, scale: "log" },
  taper: { min: 0, max: 0.5, step: 0.01 },
  hue: { min: 0, max: 360, step: 1 },
  tint: { min: 0, max: 1, step: 0.05 },
  hues: { min: 0, max: 360, step: 1 },
  timescale: timescaleTrack(),
}

export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    Object.entries(TRACKS).map(([key, track]) => [key, { min: track!.min, max: track!.max }]),
  ) as Record<Exclude<NumericKey, "seed">, { min: number; max: number }>),
  seed: SEED_BOUNDS,
}

const tracks = onTracks(TRACKS, { untracked: "round" })
export const gridFor = tracks.gridFor

const snap = tracks.snap

export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = {
    ...merged,
    symmetry: oneOf(SYMMETRIES, merged.symmetry, base.symmetry),
    confine: oneOf(CONFINES, merged.confine, base.confine),
    stops: oneOf(STOPS, merged.stops, base.stops),
    angle: oneOf(ANGLES, String(merged.angle) as Angle, base.angle),
    colourBy: oneOf(COLOUR_BYS, merged.colourBy, base.colourBy),
    cycle: oneOf(CYCLES, merged.cycle, base.cycle),
    from: oneOf(FROMS, merged.from, base.from),
  }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }
  return settings
}

/**
 * Settings that decide what grows, so a change starts the drawing again.
 * Everything else — speed, spin, width, hold — is read as it goes.
 */
const GROWTH_KEYS = [
  "segments",
  "symmetry",
  "confine",
  "stops",
  "roots",
  "from",
  "spread",
  "lean",
  "cycle",
  "angle",
  "step",
  "split",
  "turn",
  "keep",
  "life",
  "seed",
] as const satisfies readonly (keyof Settings)[]

export function needsRegrow(before: Settings, after: Settings): boolean {
  return GROWTH_KEYS.some((key) => before[key] !== after[key])
}

/** Append-only. Read `@/experiments/address` before touching this. */
export const REGISTRY: readonly Slot[] = [
  { key: "segments", kind: "num", grid: 1, origin: 2, bits: 5 },
  { key: "symmetry", kind: "enum", options: ["mirror", "turn"] },
  { key: "confine", kind: "enum", options: ["wedge", "free"] },
  { key: "stops", kind: "enum", options: ["any", "own", "none"] },
  // Retired 2026-11-17: 4 bits held 1–16, and constant change wants up to 48.
  { key: "roots", kind: "num", grid: 1, origin: 1, bits: 4, retired: true },
  { key: "spread", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "angle", kind: "enum", options: ["15", "30", "45", "60", "90"] },
  { key: "step", kind: "num", grid: 0.5, origin: 1, bits: 7 },
  { key: "split", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "keep", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "turn", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "life", kind: "num", grid: 1, origin: 1, bits: 7 },
  { key: "speed", kind: "num", grid: 0.1, origin: 0.5, bits: 9 },
  { key: "hold", kind: "num", grid: 1, origin: 0, bits: 7 },
  { key: "spin", kind: "num", grid: 0.5, origin: -30, bits: 7 },
  { key: "width", kind: "num", grid: 0.05, origin: 0.25, bits: 8 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 20 },
  TIMESCALE_SLOT,
  { key: "taper", kind: "num", grid: 0.01, origin: 0, bits: 6 },
  { key: "tint", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "hues", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "colourBy", kind: "enum", options: ["depth", "family", "age", "copy"] },
  { key: "roots", kind: "num", grid: 1, origin: 1, bits: 6 },
  { key: "from", kind: "enum", options: ["centre", "sides"] },
  { key: "lean", kind: "num", grid: 1, origin: -80, bits: 8 },
  { key: "cycle", kind: "enum", options: ["each", "together"] },
]

export const { settingsToQuery, urlForSettings, settingsFromQuery, namesASetting } = packedAddress<Settings>({
  registry: REGISTRY,
  normalize: normalizeSettings,
})

export const reroll = reroller(normalizeSettings, SEED_BOUNDS)

export const CHROME: Chrome<Settings> = {
  slug: "kaleidoscope",
  title: "Kaleidoscope",
  canvas: "field",
  boxes: true,
  groups: GROUP_ORDER,
  theme: (settings) => ({ style: { "--hue": String(settings.hue) } }),
  actions: [
    {
      label: "reroll",
      hint: "A new drawing at the same settings. The seed travels in the address bar.",
      shortcut: "r",
      verb: "reroll",
    },
  ],
  hatches: { debug: "flag" },
  banner: [
    ["experiment.get()", "current settings"],
    ["experiment.set({ segments: 12 })", "change one or more"],
    ["experiment.preset(1)", "load a preset by number or name"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "a new drawing (or press r)"],
    ["experiment.settle(20)", "grow twenty seconds at once"],
    ["experiment.clear()", "start the drawing again"],
    ["experiment.debug(true)", "draw the grown segment's edges and its live tips"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the drawing where it is"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.stats()", "lines, tips, what ended them, fps"],
    ["experiment.url()", "a link that restores this exact scene"],
  ],
}
