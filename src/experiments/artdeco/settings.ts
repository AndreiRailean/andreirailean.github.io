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
 * Straight lines that grow up from the bottom of the frame and make decisions
 * as they go, mirrored about the frame's centre line.
 *
 * Only the right half is grown; everything drawn is drawn twice, once
 * reflected, so the symmetry is by construction rather than by coincidence.
 * Lines carry their decisions in **families**: every line in a family makes
 * its n-th decision the same way, so stems and the offshoots of one echo stay
 * parallel through every turn they take. See `artdeco.ts`.
 */
export type Angle = "15" | "30" | "45" | "60" | "90"
export type Unison = "family" | "all"
export type Meet = "stop" | "cross" | "rebound"
export type Cycle = "hold" | "flow"
export type Vary = "new" | "same"

export type Settings = {
  /** Lines starting from the bottom, mirrored: an odd count puts one on the centre line. */
  stems: number
  /** Distance between neighbouring stems, as a share of the frame's height in per cent. */
  gap: number
  /** The angle every turn and every split is made at; every line is a multiple of it off vertical. */
  angle: Angle
  /** How far a line grows between decisions, in per cent of the frame's height. */
  step: number
  /** How fast every tip grows, in per cent of the frame's height a second. */
  speed: number
  /** Decisions a line makes before it stops of its own accord. */
  depth: number
  /** Relative odds of each decision. */
  straight: number
  branch: number
  fork: number
  turn: number
  echo: number
  stop: number
  /** Offshoots an echo grows, all parallel. */
  echoes: number
  /** Distance between an echo's offshoots, as a share of `step`. */
  pitch: number
  /** Whether each family decides for itself, or the whole drawing decides as one. */
  unison: Unison
  /** What a tip does when it meets a line already drawn. */
  meet: Meet
  /** Line width of a stem, in css px. */
  width: number
  /** Share of width lost per generation of branching. */
  taper: number
  /** Lines drawn side by side for each line grown. */
  strands: number
  /** Distance between strands, in css px. */
  spacing: number
  /** Step multiplier for each generation of lines. */
  shrink: number
  /** Angles apart a split's lines are from their parent. */
  spread: number
  /** Frame inset, in per cent of the height. */
  margin: number
  /** Hold: draw, hold, undraw in the order it was drawn. Flow: a tail follows every tip `life` seconds behind. */
  cycle: Cycle
  /** Flow only: seconds a piece of line lasts before the tail that follows it erases it. */
  life: number
  /** Hold only: seconds the finished drawing holds before it undraws. */
  hold: number
  /** Whether each new drawing is a new one, or the same one again. */
  vary: Vary
  /** Hue of the lines, and of the controls. */
  hue: number
  seed: number
}

type EnumKey = "angle" | "unison" | "meet" | "cycle" | "vary"
export type NumericKey = Exclude<keyof Settings, EnumKey>

export type Control = KitControl<string & keyof Settings>
export type NumericControl = SliderControl<NumericKey>

export const ANGLES: Angle[] = ["15", "30", "45", "60", "90"]
export const UNISONS: Unison[] = ["family", "all"]
export const MEETS: Meet[] = ["stop", "cross", "rebound"]
export const CYCLES: Cycle[] = ["hold", "flow"]
export const VARIES: Vary[] = ["new", "same"]

const SEED_BOUNDS = { min: 0, max: 999_999 }

export const GROUP_ORDER = ["growth", "decisions", "line", "cycle"] as const

const seconds = (v: number) => `${v.toFixed(1)}s`
const unit = (v: number) => v.toFixed(2)
const share = (v: number) => `${v.toFixed(1)}%`

const odds = (key: NumericKey, label: string, hint: string): Control => ({
  kind: "slider",
  key,
  label,
  group: "decisions",
  min: 0,
  max: 1,
  step: 0.05,
  format: unit,
  hint,
})

export const CONTROLS: Control[] = [
  {
    kind: "slider",
    key: "stems",
    label: "stems",
    group: "growth",
    min: 1,
    max: 7,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "How many lines start from the bottom. An odd number puts one on the centre line; the rest come in mirrored pairs. Stems on one side are one family, so they turn together and stay parallel.",
  },
  {
    kind: "slider",
    key: "gap",
    label: "stem gap",
    group: "growth",
    min: 1,
    max: 40,
    step: 0.5,
    format: share,
    hint: "Distance between neighbouring stems, as a share of the frame's height.",
    inert: (settings: Settings) => settings.stems === 1,
  },
  {
    kind: "choice",
    key: "angle",
    label: "angle",
    group: "growth",
    options: [
      { value: "15", label: "15°" },
      { value: "30", label: "30°" },
      { value: "45", label: "45°" },
      { value: "60", label: "60°" },
      { value: "90", label: "90°" },
    ],
    hint: "The angle every turn and every split is made at. Every line is a whole number of these off vertical, so lines from far apart in the drawing still come out parallel.",
  },
  {
    kind: "slider",
    key: "step",
    label: "step",
    group: "growth",
    min: 2,
    max: 40,
    step: 0.5,
    format: share,
    hint: "How far a line grows between decisions, as a share of the frame's height.",
  },
  {
    kind: "slider",
    key: "shrink",
    label: "shrink",
    group: "growth",
    min: 0.5,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "What the step is multiplied by for the lines a split or an echo makes, so detail gets finer towards the tips. 1 keeps every step the same.",
  },
  {
    kind: "slider",
    key: "spread",
    label: "spread",
    group: "growth",
    min: 1,
    max: 4,
    step: 1,
    format: (v) => `×${Math.round(v)}`,
    hint: "How many angles apart a split's two lines are from their parent. Turns are always one angle.",
  },
  {
    kind: "slider",
    key: "margin",
    label: "margin",
    group: "growth",
    min: 0,
    max: 25,
    step: 0.5,
    format: share,
    hint: "A frame inset from the edges, as a share of the height. Lines stop at it, and the stems start from its bottom.",
  },
  {
    kind: "slider",
    key: "speed",
    label: "speed",
    group: "growth",
    min: 2,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}%/s`,
    hint: "How fast every tip grows, in shares of the frame's height a second.",
  },
  {
    kind: "slider",
    key: "depth",
    label: "depth",
    group: "growth",
    min: 1,
    max: 60,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "How many decisions a line makes, counting its parents', before it stops of its own accord.",
  },
  /* @__PURE__ */ odds("straight", "straight", "Odds of carrying straight on to the next decision."),
  /* @__PURE__ */ odds(
    "branch",
    "branch",
    "Odds of splitting into two lines at opposite angles while the line itself carries on.",
  ),
  /* @__PURE__ */ odds("fork", "fork", "Odds of splitting into two lines at opposite angles and stopping there."),
  /* @__PURE__ */ odds(
    "turn",
    "turn",
    "Odds of turning by the angle. Its mirror image turns the other way. A line on the centre line cannot turn alone, so it forks.",
  ),
  /* @__PURE__ */ odds(
    "echo",
    "echo",
    "Odds of carrying on while growing offshoots, one after another at the same angle — parallel lines that then make the same decisions as each other.",
  ),
  /* @__PURE__ */ odds("stop", "stop", "Odds of stopping."),
  {
    kind: "slider",
    key: "echoes",
    label: "offshoots",
    group: "decisions",
    min: 1,
    max: 12,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "How many parallel offshoots an echo grows. They stop coming if the line turns or splits first.",
    inert: (settings: Settings) => settings.echo === 0,
  },
  {
    kind: "slider",
    key: "pitch",
    label: "pitch",
    group: "decisions",
    min: 0.05,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "Distance between an echo's offshoots, as a share of the step.",
    inert: (settings: Settings) => settings.echo === 0,
  },
  {
    kind: "choice",
    key: "unison",
    label: "decide",
    group: "decisions",
    options: [
      { value: "family", label: "by family" },
      { value: "all", label: "all as one" },
    ],
    hint: "By family: the lines a split makes start deciding for themselves, together with their mirror image, while the offshoots of one echo decide together. All as one: every line's n-th decision is the same, everywhere in the drawing.",
  },
  {
    kind: "choice",
    key: "meet",
    label: "on meeting",
    group: "decisions",
    options: [
      { value: "stop", label: "stop" },
      { value: "cross", label: "cross" },
      { value: "rebound", label: "rebound" },
    ],
    hint: "What a tip does when it meets a line already drawn, its own mirror image included. Stop ends it there. Cross ignores the line. Rebound reflects it off the line, which keeps it on the angle.",
  },
  {
    kind: "slider",
    key: "width",
    label: "width",
    group: "line",
    min: 0.5,
    max: 8,
    step: 0.25,
    format: (v) => `${v.toFixed(2)}px`,
    hint: "Width of a stem.",
  },
  {
    kind: "slider",
    key: "taper",
    label: "taper",
    group: "line",
    min: 0,
    max: 0.5,
    step: 0.05,
    format: unit,
    hint: "Share of its width a line loses at every split, so the stems are heaviest and the last offshoots finest.",
  },
  {
    kind: "slider",
    key: "strands",
    label: "strands",
    group: "line",
    min: 1,
    max: 4,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "Lines drawn side by side for every line grown, like an inline letter: two makes every line a double rule, three a band.",
  },
  {
    kind: "slider",
    key: "spacing",
    label: "strand gap",
    group: "line",
    min: 1,
    max: 16,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}px`,
    hint: "Distance between neighbouring strands.",
    inert: (settings: Settings) => settings.strands === 1,
  },
  {
    kind: "slider",
    key: "hue",
    label: "hue",
    group: "line",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Hue of the lines and of these controls. Around 45 is gold.",
  },
  {
    kind: "choice",
    key: "cycle",
    label: "cycle",
    group: "cycle",
    options: [
      { value: "hold", label: "draw, hold, undraw" },
      { value: "flow", label: "flow" },
    ],
    hint: "Draw, hold, undraw: the drawing grows until every line has stopped, holds, then undraws in the order it was drawn, and the next one begins. Flow: a tail follows every tip at a fixed delay, so lines vanish as steadily as they appear and a new drawing starts as soon as the last tip stops.",
  },
  {
    kind: "slider",
    key: "life",
    label: "life",
    group: "cycle",
    min: 1,
    max: 120,
    step: 0.5,
    format: seconds,
    hint: "Flow only: how long a piece of line lasts before the tail following its tip erases it.",
    inert: (settings: Settings) => settings.cycle !== "flow",
  },
  {
    kind: "slider",
    key: "hold",
    label: "hold",
    group: "cycle",
    min: 0,
    max: 60,
    step: 0.5,
    format: seconds,
    hint: "Draw, hold, undraw only: how long the finished drawing holds before it undraws.",
    inert: (settings: Settings) => settings.cycle !== "hold",
  },
  {
    kind: "choice",
    key: "vary",
    label: "next drawing",
    group: "cycle",
    options: [
      { value: "new", label: "new" },
      { value: "same", label: "same again" },
    ],
    hint: "New: each drawing after the first makes different decisions, though every one follows from the seed, so the same address plays the same sequence. Same again: every drawing is the first one.",
  },
]

export const DEFAULT_SETTINGS: Settings = {
  stems: 1,
  gap: 8,
  angle: "45",
  step: 12,
  speed: 14,
  depth: 9,
  straight: 0.3,
  branch: 0.3,
  fork: 0.15,
  turn: 0.3,
  echo: 0.15,
  stop: 0.05,
  echoes: 4,
  pitch: 0.2,
  unison: "family",
  meet: "stop",
  width: 1.5,
  taper: 0.1,
  strands: 1,
  spacing: 3,
  shrink: 1,
  spread: 1,
  margin: 0,
  cycle: "hold",
  life: 12,
  hold: 6,
  vary: "new",
  hue: 45,
  seed: 1,
}

/** Written out rather than derived from `CONTROLS`; see `src/experiments/AGENTS.md` under Presets. */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  stems: { min: 1, max: 7, step: 1 },
  gap: { min: 1, max: 40, step: 0.5 },
  step: { min: 2, max: 40, step: 0.5 },
  speed: { min: 2, max: 100, step: 1 },
  depth: { min: 1, max: 60, step: 1 },
  straight: { min: 0, max: 1, step: 0.05 },
  branch: { min: 0, max: 1, step: 0.05 },
  fork: { min: 0, max: 1, step: 0.05 },
  turn: { min: 0, max: 1, step: 0.05 },
  echo: { min: 0, max: 1, step: 0.05 },
  stop: { min: 0, max: 1, step: 0.05 },
  echoes: { min: 1, max: 12, step: 1 },
  pitch: { min: 0.05, max: 1, step: 0.05 },
  width: { min: 0.5, max: 8, step: 0.25 },
  taper: { min: 0, max: 0.5, step: 0.05 },
  strands: { min: 1, max: 4, step: 1 },
  spacing: { min: 1, max: 16, step: 0.5 },
  shrink: { min: 0.5, max: 1, step: 0.05 },
  spread: { min: 1, max: 4, step: 1 },
  margin: { min: 0, max: 25, step: 0.5 },
  life: { min: 1, max: 120, step: 0.5 },
  hold: { min: 0, max: 60, step: 0.5 },
  hue: { min: 0, max: 360, step: 1 },
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
    angle: oneOf(ANGLES, String(merged.angle), base.angle),
    unison: oneOf(UNISONS, merged.unison, base.unison),
    meet: oneOf(MEETS, merged.meet, base.meet),
    cycle: oneOf(CYCLES, merged.cycle, base.cycle),
    vary: oneOf(VARIES, merged.vary, base.vary),
  }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }

  return settings
}

/** Settings that change what gets drawn; a change to any of them starts the drawing again. */
const GROWTH_KEYS = [
  "stems",
  "gap",
  "angle",
  "step",
  "depth",
  "straight",
  "branch",
  "fork",
  "turn",
  "echo",
  "stop",
  "echoes",
  "pitch",
  "unison",
  "meet",
  "cycle",
  "vary",
  "shrink",
  "spread",
  "margin",
  "seed",
] as const satisfies readonly (keyof Settings)[]

export function needsRebuild(before: Settings, after: Settings): boolean {
  return GROWTH_KEYS.some((key) => before[key] !== after[key])
}

/** Append-only. Read `@/experiments/address` before touching this. */
export const REGISTRY: readonly Slot[] = [
  { key: "stems", kind: "num", grid: 1, origin: 1, bits: 3 },
  { key: "gap", kind: "num", grid: 0.5, origin: 1, bits: 7 },
  { key: "angle", kind: "enum", options: ["15", "30", "45", "60", "90"] },
  { key: "step", kind: "num", grid: 0.5, origin: 2, bits: 7 },
  { key: "speed", kind: "num", grid: 1, origin: 2, bits: 7 },
  { key: "depth", kind: "num", grid: 1, origin: 1, bits: 6 },
  { key: "straight", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "branch", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "fork", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "turn", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "echo", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "stop", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "echoes", kind: "num", grid: 1, origin: 1, bits: 4 },
  { key: "pitch", kind: "num", grid: 0.05, origin: 0.05, bits: 5 },
  { key: "unison", kind: "enum", options: ["family", "all"] },
  { key: "meet", kind: "enum", options: ["stop", "cross", "rebound"] },
  { key: "width", kind: "num", grid: 0.25, origin: 0.5, bits: 5 },
  { key: "taper", kind: "num", grid: 0.05, origin: 0, bits: 4 },
  { key: "cycle", kind: "enum", options: ["hold", "flow"] },
  { key: "life", kind: "num", grid: 0.5, origin: 1, bits: 8 },
  { key: "hold", kind: "num", grid: 0.5, origin: 0, bits: 7 },
  { key: "vary", kind: "enum", options: ["new", "same"] },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 20 },
  { key: "strands", kind: "num", grid: 1, origin: 1, bits: 2 },
  { key: "spacing", kind: "num", grid: 0.5, origin: 1, bits: 5 },
  { key: "shrink", kind: "num", grid: 0.05, origin: 0.5, bits: 4 },
  { key: "spread", kind: "num", grid: 1, origin: 1, bits: 2 },
  { key: "margin", kind: "num", grid: 0.5, origin: 0, bits: 6 },
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
  slug: "artdeco",
  title: "Art Deco",
  canvas: "field",
  boxes: true,
  groups: GROUP_ORDER,
  theme: (settings) => ({ style: { "--hue": String(settings.hue) } }),
  actions: [
    {
      label: "reroll",
      hint: "A different drawing from the same rules. The seed travels in the address bar.",
      shortcut: "r",
      verb: "reroll",
    },
    {
      label: "again",
      hint: "Start the drawing again from the bottom.",
      shortcut: "a",
      verb: "clear",
    },
  ],
  hatches: { settle: "seconds", debug: "flag" },
  banner: [
    ["experiment.get()", "current settings"],
    ["experiment.set({ angle: '30' })", "change one or more"],
    ["experiment.preset(1)", "load a preset by number or name"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "a different drawing (or press r)"],
    ["experiment.settle(10)", "jump forward by seconds"],
    ["experiment.clear()", "start again from the bottom (or press a)"],
    ["experiment.debug(true)", "mark tips and the centre line"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold where it is"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.stats()", "tips, lines, every decision taken and every meeting"],
    ["experiment.url()", "a link that restores this exact scene"],
  ],
}
