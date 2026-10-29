import { TIMESCALE_SLOT, timescaleControl, timescaleTrack } from "@/experiments/kit/speed"
import { clamp, onTracks, oneOf, packedAddress, reroller } from "@/experiments/settings-plumbing"
import type { Slot } from "@/experiments/address"
import type { Control as KitControl, SliderControl, Track } from "@/experiments/kit/controls"
import type { Chrome } from "@/experiments/piece"

/**
 * The clock rate this piece's 1× stands for, as a multiple of real time. At 1×
 * the scene keeps pace with the wall clock it started from — `kit/speed.ts`.
 */
export const CLOCK_RATE = 1

/** Re-exported so a consumer needs one import for a control and its keys. */
export { keysOf } from "@/experiments/kit/controls"

/**
 * Melting: a lava lamp, some of whose blobs are the shadows of a hidden solid.
 *
 * The solid turns in three dimensions and is flattened straight down, so its
 * depth is hidden: no blob is fainter for being far, and the turning need not
 * read as turning at all. A blob only swells a little as its corner rises.
 * Where two corners pass over each other their blobs merge and split again,
 * which nothing has to arrange.
 *
 * That one solid keeps time, and it is the only shape in the lamp. Everything
 * else is wax: a pool along the bottom that lumps swell out of, rise, gather at
 * the top, split and join, and sink back into — never more of it and never
 * less. The solid's corners bud satellites of their own, which take their
 * matter with them. A stream of beats, one every `beat` seconds, decides when
 * each satellite comes out, where it goes, which way every axis tips, and what
 * every lump does in each of its cycles. The piece does not know what the
 * stream is; today it is a hash of the seed and the beat's number.
 */
export type Shape = "tetra" | "cube" | "octa" | "icosa" | "dodeca"
export type Motion = "spin" | "tumble"
export type Clock = "wall" | "zero"

export type Settings = {
  /** Which solid the timekeeping blobs are the corners of. */
  shape: Shape
  /** One axis that drifts at each beat, or two turning at once. */
  motion: Motion
  /** Whether the scene's time starts from the wall clock or from nothing. */
  clock: Clock
  /** Seconds a solid takes to turn a quarter. */
  turn: number
  /** Seconds between beats. */
  beat: number
  /** Degrees each beat tips an axis by. */
  nudge: number
  /** Radius of the hidden solid, in halves of the frame's short side. */
  scale: number
  /** Radius of a corner's blob, as a fraction of the solid's radius. */
  size: number
  /** How much a blob swells as its corner rises towards the viewer, and shrinks as it sinks. */
  swell: number
  /** Satellites each corner can bud. */
  satellites: number
  /** The share of the time a satellite is out rather than inside its blob. */
  presence: number
  /** The chance a satellite is swallowed by a neighbour rather than by the blob it came from. */
  roam: number
  /** How far a moving blob stretches out behind itself, and how much more often a stretched one buds. */
  stretch: number
  /** The share of the time a corner holds its place, rather than being swallowed and budded anew. */
  integrity: number
  /** The chance the timekeeping solid is there in any one of its cycles. 1 always, 0 never. */
  keeper: number
  /** Quarter turns in one cycle of the timekeeper's comings and goings. */
  cycle: number
  /** How far each corner of the solid sits off its regular place, as a share of the solid's radius, fixed by the seed. */
  irregular: number
  /** The chance a cycle of the timekeeper draws its solid afresh from the stream, rather than keeping `shape`. */
  change: number
  /** Slower hands: extra tilts of the solid, each changing eight times more slowly than the one before. */
  hands: number
  /** Degrees each slow hand tilts the solid by. */
  sway: number
  /** How far the pool keeps its level while lumps are out of it: 0 conserves the wax, 1 is a pool too big to notice. */
  reservoir: number
  /** How far the stream raises and lowers the pool's surface, region by region. */
  ripple: number
  /** A layer of wax hanging from the top edge: 0 is none; each unit lets it swell 3 % of the height deeper than its least, 1.5 %. */
  ceiling: number
  /** How far the stream steers where lumps rise and rest, column by column. */
  steer: number
  /** How much wax the lamp holds, as the share of the screen it would cover lying flat. */
  wax: number
  /** How many lumps of wax can be out of the pool at once. */
  lumps: number
  /** The chance a lump leaves the pool in any one of its cycles. */
  heat: number
  /** About how many seconds a lump takes to rise from the pool to the top. */
  rise: number
  /** The chance a rising lump splits in two on its way up. */
  splitting: number
  /** How far the lumps at the top drift together into one, and the parts of a split back into theirs. */
  joining: number
  /** Colour of the blobs, and of these controls. */
  hue: number
  /** How strongly the blobs take the hue. 0 is white. */
  tint: number
  /** How many colours the blobs are drawn in, each blob in one the stream picks. 1 is the hue alone. */
  colours: number
  seed: number
  /** The speed control's value: a multiple of `CLOCK_RATE`. The kit's — `kit/speed.ts`. */
  timescale: number
}

export type NumericKey = Exclude<keyof Settings, "shape" | "motion" | "clock">

export type Control = KitControl<string & keyof Settings>
export type NumericControl = SliderControl<NumericKey>

export const SHAPES: Shape[] = ["tetra", "cube", "octa", "icosa", "dodeca"]
export const MOTIONS: Motion[] = ["spin", "tumble"]
export const CLOCKS: Clock[] = ["wall", "zero"]

const SEED_BOUNDS = { min: 0, max: 999_999 }

export const GROUP_ORDER = ["shape", "time", "wax", "colour"] as const

const noSatellites = (settings: Settings) => settings.satellites === 0
const noWax = (settings: Settings) => settings.wax === 0 || settings.lumps === 0

/** How many beats apart the slow hands' values are: each hand eight times slower than the one before. */
export const HAND_RATIO = 8

export const CONTROLS: Control[] = [
  {
    kind: "choice",
    key: "shape",
    label: "shape",
    group: "shape",
    options: [
      { value: "tetra", label: "4" },
      { value: "octa", label: "6" },
      { value: "cube", label: "8" },
      { value: "icosa", label: "12" },
      { value: "dodeca", label: "20" },
    ],
    hint: "The hidden solid that keeps time, by how many blobs it casts: tetrahedron, octahedron, cube, icosahedron, dodecahedron.",
  },
  {
    kind: "slider",
    key: "scale",
    label: "spread",
    group: "shape",
    min: 0.2,
    max: 1.2,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}×`,
    hint: "How big the hidden solid is, in halves of the screen's short side — so how far apart its blobs lie. Small, and they crowd and merge.",
  },
  {
    kind: "choice",
    key: "motion",
    label: "motion",
    group: "time",
    options: [
      { value: "spin", label: "spin" },
      { value: "tumble", label: "tumble" },
    ],
    hint: "Spin turns each solid about one axis, which each beat tips a little. Tumble turns it about two at once.",
  },
  {
    kind: "slider",
    key: "turn",
    label: "quarter turn",
    group: "time",
    min: 5,
    max: 120,
    step: 1,
    format: (v) => `${Math.round(v)}s`,
    hint: "Seconds a solid takes to turn a quarter. The turning is the clock: it never speeds up or stops between beats.",
  },
  {
    kind: "slider",
    key: "beat",
    label: "beat",
    group: "time",
    min: 0.5,
    max: 30,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}s`,
    hint: "Seconds between beats. Every beat draws fresh values from the stream: which way each axis tips, and when satellites bud and where they go.",
  },
  {
    kind: "slider",
    key: "nudge",
    label: "nudge",
    group: "time",
    min: 0,
    max: 45,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "How far each beat tips an axis, eased in over the beat so nothing jumps. 0 turns about a fixed axis for ever.",
  },
  {
    kind: "choice",
    key: "clock",
    label: "clock",
    group: "time",
    options: [
      { value: "wall", label: "wall" },
      { value: "zero", label: "zero" },
    ],
    hint: "Wall starts the scene from the time of day, so two screens opened at once show the same moment. Zero starts it from nothing, the same every time it loads.",
  },
  {
    kind: "slider",
    key: "size",
    label: "blob size",
    group: "shape",
    min: 0.02,
    max: 0.4,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How big a corner's blob is, against the spread of the solid.",
  },
  {
    kind: "slider",
    key: "swell",
    label: "swell",
    group: "shape",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much a blob grows as its corner rises and shrinks as it sinks. 0 keeps every blob one size, and the depth is hidden entirely.",
  },
  {
    kind: "slider",
    key: "satellites",
    label: "satellites",
    group: "shape",
    min: 0,
    max: 6,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "Small blobs each corner can bud. A satellite necks off its corner taking some of its matter, roams, and is swallowed again — by the corner it left or by a neighbour, which gains what it carried.",
  },
  {
    kind: "slider",
    key: "presence",
    label: "presence",
    group: "shape",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much of the time a satellite is out. Low, and they are rare events; at 1 every one is always out, budding again the moment it is swallowed.",
    inert: noSatellites,
  },
  {
    kind: "slider",
    key: "roam",
    label: "roam",
    group: "shape",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "The chance a satellite crosses to a neighbouring corner before it is swallowed, rather than returning to the one it came out of.",
    inert: noSatellites,
  },
  {
    kind: "slider",
    key: "stretch",
    label: "stretch",
    group: "wax",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How far a moving blob draws out behind itself, the faster the further. A stretched corner is also likelier to bud, and buds from its trailing end — so a rapid tumble throws satellites off.",
  },
  {
    kind: "slider",
    key: "keeper",
    label: "timekeeper",
    group: "shape",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => (v === 1 ? "always" : v === 0 ? "never" : v.toFixed(2)),
    hint: "The chance the timekeeping solid is there, cycle by cycle. Going, its corners draw together into one blob that sinks into the pool; coming, one rises out of it and spreads into corners. 1 keeps it for ever; 0 leaves only the wax, an art piece and no clock.",
  },
  {
    kind: "slider",
    key: "cycle",
    label: "cycle",
    group: "shape",
    min: 2,
    max: 16,
    step: 1,
    format: (v) => `${v} quarter turns`,
    hint: "How long one cycle of the timekeeper's comings and goings lasts, in quarter turns. A quarter of a cycle goes in arriving, and a quarter in leaving.",
    inert: (settings: Settings) => settings.keeper >= 1 || settings.keeper <= 0,
  },
  {
    kind: "slider",
    key: "irregular",
    label: "irregular",
    group: "shape",
    min: 0,
    max: 0.3,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How far each corner of the timekeeping solid sits off its regular place, as a share of its radius — the same for the life of the seed. A regular solid keeps coming back to a pose that looks like one it held a minute ago; a lopsided one does not.",
  },
  {
    kind: "slider",
    key: "change",
    label: "change",
    group: "shape",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => (v === 0 ? "never" : v.toFixed(2)),
    hint: "The chance each cycle of the timekeeper draws its solid afresh from the stream. When the next cycle's solid differs, the corners gather into one blob in the middle and burst out again as the new one. 0 keeps the shape above for ever.",
  },
  {
    kind: "slider",
    key: "hands",
    label: "slow hands",
    group: "time",
    min: 0,
    max: 5,
    step: 1,
    format: (v) => (v === 0 ? "none" : String(Math.round(v))),
    hint: "Extra tilts of the solid drawn from the stream, each changing eight times more slowly than the last: the first every eight beats, the next every sixty-four, and so on. Like a clock's minute and hour hands, they keep the solid from ever settling into a pose it held before.",
  },
  {
    kind: "slider",
    key: "sway",
    label: "sway",
    group: "time",
    min: 0,
    max: 90,
    step: 5,
    format: (v) => `${Math.round(v)}°`,
    hint: "How far each slow hand tilts the solid, eased in over its whole period.",
    inert: (settings: Settings) => settings.hands === 0,
  },
  {
    kind: "slider",
    key: "integrity",
    label: "integrity",
    group: "shape",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much of the time a corner of the timekeeping solid holds its place. Below 1 a corner now and then runs into a neighbouring one, is swallowed with its matter, and is budded out of it again to find its way back.",
  },
  {
    kind: "slider",
    key: "wax",
    label: "wax",
    group: "wax",
    min: 0,
    max: 0.4,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "How much wax the lamp holds: the share of the screen it would cover lying flat. None is ever made or lost — what is not out in lumps lies in the pool along the bottom.",
  },
  {
    kind: "slider",
    key: "lumps",
    label: "lumps",
    group: "wax",
    min: 0,
    max: 16,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "How many lumps can be out of the pool at once. Few, and each is big; many, and they are small and the pool runs low.",
    inert: (settings: Settings) => settings.wax === 0,
  },
  {
    kind: "slider",
    key: "heat",
    label: "heat",
    group: "wax",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "The chance a lump leaves the pool in any one of its cycles. Low, and the lamp is mostly pool with now and then a lump rising; at 1 every lump is always on its way.",
    inert: noWax,
  },
  {
    kind: "slider",
    key: "rise",
    label: "rise",
    group: "wax",
    min: 4,
    max: 120,
    step: 1,
    format: (v) => `${Math.round(v)}s`,
    hint: "About how long a lump takes to rise from the pool to the top; bigger ones rise a little faster. It rests there, then sinks more slowly than it rose.",
    inert: noWax,
  },
  {
    kind: "slider",
    key: "splitting",
    label: "splitting",
    group: "wax",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "The chance a rising lump splits in two on its way up. The part necks off taking its share of the wax, lags behind and sidles away.",
    inert: noWax,
  },
  {
    kind: "slider",
    key: "joining",
    label: "joining",
    group: "wax",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How far the lumps resting at the top drift together, so they run into one big lump that comes apart again as they sink — and how far a split lump's parts rejoin there.",
    inert: noWax,
  },
  {
    kind: "slider",
    key: "reservoir",
    label: "reservoir",
    group: "wax",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => (v === 0 ? "conserved" : v === 1 ? "bottomless" : v.toFixed(2)),
    hint: "How far the pool keeps its level while lumps are out. 0 conserves the wax, so the pool sinks as lumps leave it; 1 treats the pool as bottomless, so no lump can change it.",
    inert: noWax,
  },
  {
    kind: "slider",
    key: "ripple",
    label: "ripple",
    group: "wax",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How far the stream heaps and hollows the pool's surface, region by region, each region easing to a new height every few beats.",
    inert: (settings: Settings) => settings.wax === 0,
  },
  {
    kind: "slider",
    key: "ceiling",
    label: "ceiling",
    group: "wax",
    min: 0,
    max: 3,
    step: 0.05,
    format: (v) => (v === 0 ? "none" : v.toFixed(2)),
    hint: "A layer of wax hanging from the top edge, a counterweight to the pool, swelling and thinning slowly along its length. Lumps that rise into it merge and part again as they sink. Turn the lamp on its side and the two layers face each other.",
  },
  {
    kind: "slider",
    key: "steer",
    label: "steer",
    group: "wax",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How far the stream decides where lumps rise and rest. The lamp is four columns, and every so often the stream lights some of them; steered lumps keep to the lit ones, so the wax gathers there.",
    inert: noWax,
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
    hint: "Colour of the blobs, as far as tint lets it, and of these controls.",
  },
  {
    kind: "slider",
    key: "tint",
    label: "tint",
    group: "colour",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How strongly the blobs take the hue. 0 leaves them white.",
  },
  {
    kind: "slider",
    key: "colours",
    label: "colours",
    group: "colour",
    min: 1,
    max: 6,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "How many colours the lamp is drawn in. Above 1, every blob takes one of them, spaced round the wheel from the hue, and the stream picks which: a corner's every beat, a lump's every time it leaves the pool. A blob changes colour all at once, over a moment, never in a gradient.",
  },
  /* @__PURE__ */ timescaleControl(),
]

export const DEFAULT_SETTINGS: Settings = {
  shape: "cube",
  motion: "spin",
  clock: "wall",
  turn: 30,
  beat: 3,
  nudge: 8,
  scale: 0.6,
  size: 0.14,
  swell: 0.25,
  satellites: 2,
  presence: 0.5,
  roam: 0.3,
  stretch: 0.5,
  integrity: 1,
  keeper: 1,
  cycle: 8,
  irregular: 0,
  change: 0,
  hands: 0,
  sway: 30,
  reservoir: 0,
  ripple: 0,
  ceiling: 0,
  steer: 0,
  wax: 0.12,
  lumps: 6,
  heat: 0.7,
  rise: 20,
  splitting: 0.4,
  joining: 0.5,
  hue: 73,
  tint: 0.6,
  colours: 1,
  seed: 1,
  timescale: 1,
}

/** Written out rather than derived from `CONTROLS`; see `src/experiments/AGENTS.md` under Presets. */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  turn: { min: 5, max: 120, step: 1 },
  beat: { min: 0.5, max: 30, step: 0.5 },
  nudge: { min: 0, max: 45, step: 1 },
  scale: { min: 0.2, max: 1.2, step: 0.05 },
  size: { min: 0.02, max: 0.4, step: 0.01 },
  swell: { min: 0, max: 1, step: 0.05 },
  satellites: { min: 0, max: 6, step: 1 },
  presence: { min: 0, max: 1, step: 0.05 },
  roam: { min: 0, max: 1, step: 0.05 },
  stretch: { min: 0, max: 1, step: 0.05 },
  integrity: { min: 0, max: 1, step: 0.05 },
  keeper: { min: 0, max: 1, step: 0.05 },
  cycle: { min: 2, max: 16, step: 1 },
  irregular: { min: 0, max: 0.3, step: 0.05 },
  change: { min: 0, max: 1, step: 0.05 },
  hands: { min: 0, max: 5, step: 1 },
  sway: { min: 0, max: 90, step: 5 },
  reservoir: { min: 0, max: 1, step: 0.05 },
  ripple: { min: 0, max: 1, step: 0.05 },
  ceiling: { min: 0, max: 3, step: 0.05 },
  steer: { min: 0, max: 1, step: 0.05 },
  wax: { min: 0, max: 0.4, step: 0.01 },
  lumps: { min: 0, max: 16, step: 1 },
  heat: { min: 0, max: 1, step: 0.05 },
  rise: { min: 4, max: 120, step: 1 },
  splitting: { min: 0, max: 1, step: 0.05 },
  joining: { min: 0, max: 1, step: 0.05 },
  hue: { min: 0, max: 360, step: 1 },
  tint: { min: 0, max: 1, step: 0.05 },
  colours: { min: 1, max: 6, step: 1 },
  timescale: timescaleTrack(),
}

export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    Object.entries(TRACKS).map(([key, track]) => [key, { min: track!.min, max: track!.max }]),
  ) as Record<Exclude<NumericKey, "seed">, { min: number; max: number }>),
  seed: SEED_BOUNDS,
}

/** The spacing one setting is stored on, or 0 for a key with no track. */
const tracks = onTracks(TRACKS, { untracked: "round" })
export const gridFor = tracks.gridFor

const snap = tracks.snap

export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = {
    ...merged,
    shape: oneOf(SHAPES, merged.shape, base.shape),
    motion: oneOf(MOTIONS, merged.motion, base.motion),
    clock: oneOf(CLOCKS, merged.clock, base.clock),
  }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }
  return settings
}

/**
 * Append-only from here on. Read `@/experiments/address` before touching this.
 *
 * Begun on 2026-10-24, when the piece was renamed from `islands` and its other
 * solids and decoys gave way to the wax. Nothing had been published under
 * either name, so `islands`' slots were dropped rather than retired; its links
 * are dead with its slug.
 */
export const REGISTRY: readonly Slot[] = [
  { key: "shape", kind: "enum", options: ["tetra", "cube", "octa", "icosa", "dodeca"] },
  { key: "motion", kind: "enum", options: ["spin", "tumble"] },
  { key: "clock", kind: "enum", options: ["wall", "zero"] },
  { key: "turn", kind: "num", grid: 1, origin: 5, bits: 7 },
  { key: "beat", kind: "num", grid: 0.5, origin: 0.5, bits: 6 },
  { key: "nudge", kind: "num", grid: 1, origin: 0, bits: 6 },
  { key: "scale", kind: "num", grid: 0.05, origin: 0.2, bits: 5 },
  { key: "size", kind: "num", grid: 0.01, origin: 0.02, bits: 6 },
  { key: "swell", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "satellites", kind: "num", grid: 1, origin: 0, bits: 3 },
  { key: "presence", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "roam", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "stretch", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "integrity", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "wax", kind: "num", grid: 0.01, origin: 0, bits: 6 },
  { key: "lumps", kind: "num", grid: 1, origin: 0, bits: 5 },
  { key: "heat", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "rise", kind: "num", grid: 1, origin: 4, bits: 7 },
  { key: "splitting", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "joining", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "tint", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 20 },
  // The kit's speed control — `kit/speed.ts`.
  TIMESCALE_SLOT,
  { key: "keeper", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "cycle", kind: "num", grid: 1, origin: 2, bits: 4 },
  { key: "irregular", kind: "num", grid: 0.05, origin: 0, bits: 3 },
  { key: "change", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "hands", kind: "num", grid: 1, origin: 0, bits: 3 },
  { key: "sway", kind: "num", grid: 5, origin: 0, bits: 5 },
  { key: "reservoir", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "ripple", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "steer", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "colours", kind: "num", grid: 1, origin: 1, bits: 3 },
  { key: "ceiling", kind: "num", grid: 0.05, origin: 0, bits: 6 },
]

export const { settingsToQuery, urlForSettings, settingsFromQuery, namesASetting } = packedAddress<Settings>({
  registry: REGISTRY,
  normalize: normalizeSettings,
})

export const reroll = reroller(normalizeSettings, SEED_BOUNDS)

export const CHROME: Chrome<Settings> = {
  slug: "melting",
  title: "Melting",
  canvas: "field",
  boxes: true,
  groups: GROUP_ORDER,
  theme: (settings) => ({ style: { "--hue": String(settings.hue) } }),
  actions: [
    {
      label: "reroll",
      hint: "A fresh stream of beats at the same settings. The seed travels in the address bar.",
      shortcut: "r",
      verb: "reroll",
    },
  ],
  hatches: { debug: "flag" },
  banner: [
    ["experiment.get()", "current settings"],
    ["experiment.set({ shape: 'icosa' })", "change one or more"],
    ["experiment.preset(1)", "load a preset by number or name"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "a fresh stream of beats (or press r)"],
    ["experiment.debug(true)", "outline the solid that keeps time, and show the beat"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the lamp, or let it run on"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.stats()", "beats, lumps out, satellites out, frame cost"],
    ["experiment.blobs()", "every blob drawn now, by id"],
    ["experiment.goto(t)", "put the lamp at moment t, in seconds since 1970 on the wall clock"],
    ["experiment.url()", "a link that restores this exact scene"],
  ],
}
