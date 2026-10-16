/**
 * A synthetic piece, for testing the kit the way a library is tested: once,
 * against a caller written to exercise it, and never through somebody's
 * experiment.
 *
 * Andrei, 2026-10-16: "most of the kit needs to be tested independently of the
 * experiments. if a slider doesn't work, it's all we need to know. we don't want
 * to make sure that a slider works in every experiment. that's not a good kit,
 * if it works like that." See
 * `src/experiments/docs/adr/20261016-the-kit-is-tested-as-a-library.md`.
 *
 * **It holds one of everything the kit offers** — a linear and a log slider, a
 * bound pair, a choice in a row and one stacked, a toggle, a set with a floor,
 * a line of text, a governed group, an action with a shortcut, a reroll, an
 * escape hatch and a theme — and twelve presets, so that both sides of the
 * nine-key limit exist. Every value here is chosen for what it makes testable
 * rather than for what it draws, which is a filled rectangle.
 *
 * **It is never published.** Nothing under `src/pages/` renders it and the site
 * build does not import it. `tests/support/kit-fixture.ts` bundles it with
 * esbuild when a spec asks, and serves it from an address that does not exist
 * (`http://kit.test/`), so a broken fixture cannot reach a visitor and the site
 * cannot reach the fixture. It boots through the gallery's own `boot()`, so the
 * one wiring every piece shares is exercised exactly as a piece exercises it.
 *
 * Served at two paths, which are two configurations of the same piece:
 * `/boxed/` gives each group a box of its own; `/column/` is the single
 * scrolling column a piece gets without `boxes`.
 */
import { decodeScene, encodeScene, withinBytes, type Slot } from "@/experiments/address"
import { snapToGrid, type Control, type Track } from "@/experiments/kit/controls"
import type { Preset } from "@/experiments/piece"

export const MODES = ["one", "two", "three"] as const
export const ROUTES = ["near", "far", "around", "through"] as const
export const MARKS = ["dot", "ring", "bar", "cross"] as const

export type Settings = {
  seed: number
  amount: number
  span: number
  low: number
  high: number
  verbose: number
  mode: (typeof MODES)[number]
  route: (typeof ROUTES)[number]
  flag: boolean
  marks: string[]
  words: string
  layer: boolean
  depth: number
  tint: number
}

type NumericKey = "seed" | "amount" | "span" | "low" | "high" | "verbose" | "depth" | "tint"

const TRACKS: Record<NumericKey, Track> = {
  seed: { min: 0, max: 999_999, step: 1 },
  amount: { min: 0, max: 10, step: 0.5 },
  // A log track spanning three orders of magnitude, where an arrow key's step
  // is finer than the grid and the kit has to take a grid step for it.
  span: { min: 0.1, max: 100, step: 0.001, scale: "log" },
  low: { min: 0, max: 100, step: 1 },
  high: { min: 0, max: 100, step: 1 },
  verbose: { min: 0, max: 100, step: 1 },
  depth: { min: 0, max: 1, step: 0.01 },
  tint: { min: 0, max: 1, step: 0.01 },
}

const TEXT_BYTES = 16

export const CONTROLS: Control<string & keyof Settings>[] = [
  {
    kind: "slider",
    key: "amount",
    label: "amount",
    group: "basic",
    ...TRACKS.amount,
    format: (value) => value.toFixed(1),
    hint: "A linear track.",
  },
  {
    kind: "slider",
    key: "span",
    label: "span",
    group: "basic",
    ...TRACKS.span,
    format: (value) => String(value),
    hint: "A log track.",
  },
  {
    kind: "range",
    keys: ["low", "high"],
    label: "between",
    group: "basic",
    ...TRACKS.low,
    format: (from, to) => `${from}–${to}`,
    hint: "A bound pair: two handles on one track.",
  },
  {
    kind: "slider",
    key: "verbose",
    label: "verbose",
    group: "basic",
    ...TRACKS.verbose,
    // Far wider than the value column, on purpose: the kit promises one line.
    format: (value) => `${value} units of something described at very great length`,
    hint: "A value too long for its column.",
  },
  {
    kind: "choice",
    key: "mode",
    label: "mode",
    group: "shape",
    options: MODES.map((value) => ({ value, label: value })),
    hint: "A choice in a row.",
  },
  {
    kind: "choice",
    key: "route",
    label: "route",
    group: "shape",
    stacked: true,
    options: [
      { value: "near", label: "close to the middle" },
      { value: "far", label: "out at the edge" },
      { value: "around", label: "round the outside" },
      { value: "through", label: "straight through" },
    ],
    hint: "A choice of phrases, stacked.",
  },
  {
    kind: "toggle",
    key: "flag",
    label: "flag",
    group: "shape",
    labels: ["off", "on"],
    hint: "A toggle.",
  },
  {
    kind: "set",
    key: "marks",
    label: "marks",
    group: "shape",
    options: MARKS.map((value) => ({ value, label: value })),
    least: 1,
    columns: 4,
    hint: "A set that may not empty.",
  },
  {
    kind: "text",
    key: "words",
    label: "words",
    group: "shape",
    maxLength: TEXT_BYTES,
    placeholder: "type here",
    hint: "A line of text.",
  },
  {
    kind: "toggle",
    key: "layer",
    label: "layer",
    group: "layer",
    labels: ["off", "on"],
    hint: "Governs the rest of its group.",
  },
  {
    kind: "slider",
    key: "depth",
    label: "depth",
    group: "layer",
    ...TRACKS.depth,
    format: (value) => value.toFixed(2),
    hint: "Governed.",
  },
  {
    kind: "slider",
    key: "tint",
    label: "tint",
    group: "layer",
    ...TRACKS.tint,
    format: (value) => value.toFixed(2),
    hint: "Governed.",
  },
]

export const DEFAULT_SETTINGS: Settings = {
  seed: 1,
  amount: 0,
  span: 1,
  low: 20,
  high: 80,
  verbose: 50,
  mode: "one",
  route: "near",
  flag: false,
  marks: ["dot", "ring"],
  words: "",
  layer: false,
  depth: 0.5,
  tint: 0.5,
}

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback

export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = {
    ...merged,
    mode: oneOf(MODES, merged.mode, base.mode),
    route: oneOf(ROUTES, merged.route, base.route),
    flag: typeof merged.flag === "boolean" ? merged.flag : base.flag,
    layer: typeof merged.layer === "boolean" ? merged.layer : base.layer,
    words: typeof merged.words === "string" ? withinBytes(merged.words, TEXT_BYTES) : base.words,
  }
  const marks = Array.isArray(merged.marks) ? MARKS.filter((mark) => merged.marks.includes(mark)) : []
  settings.marks = marks.length > 0 ? marks : [...base.marks]
  for (const [key, track] of Object.entries(TRACKS) as [NumericKey, Track][]) {
    const value = Number(settings[key])
    const clamped = Number.isFinite(value) ? Math.min(track.max, Math.max(track.min, value)) : base[key]
    settings[key] = snapToGrid(track, clamped)
  }
  if (settings.low > settings.high) settings.high = settings.low
  return settings
}

/** The handle being dragged wins, so a bound pair keeps its order either way. */
export function reconcile(next: Settings, changed: keyof Settings): Settings {
  if (next.low <= next.high) return next
  return changed === "high" ? { ...next, low: next.high } : { ...next, high: next.low }
}

export const REGISTRY: readonly Slot[] = [
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 20 },
  { key: "amount", kind: "num", grid: 0.5, origin: 0, bits: 5 },
  { key: "span", kind: "num", grid: 0.001, origin: 0, bits: 17 },
  { key: "low", kind: "num", grid: 1, origin: 0, bits: 7 },
  { key: "high", kind: "num", grid: 1, origin: 0, bits: 7 },
  { key: "verbose", kind: "num", grid: 1, origin: 0, bits: 7 },
  { key: "mode", kind: "enum", options: MODES },
  { key: "route", kind: "enum", options: ROUTES },
  { key: "flag", kind: "bool" },
  { key: "marks", kind: "set", options: MARKS },
  { key: "words", kind: "text", bytes: TEXT_BYTES },
  { key: "layer", kind: "bool" },
  { key: "depth", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "tint", kind: "num", grid: 0.01, origin: 0, bits: 7 },
]

export function settingsFromQuery(params: URLSearchParams): Settings {
  const packed = params.get("s")
  const scene = packed ? decodeScene(REGISTRY, packed) : null
  return normalizeSettings((scene ?? {}) as Partial<Settings>)
}

export function namesASetting(params: URLSearchParams): boolean {
  const packed = params.get("s")
  return Boolean(packed && decodeScene(REGISTRY, packed))
}

export function urlForSettings(settings: Settings, pathname: string): string {
  return `${pathname}?s=${encodeScene(REGISTRY, settings)}`
}

export function reroll(settings: Settings, seed?: number): Settings {
  return { ...settings, seed: seed ?? (settings.seed % 999_999) + 1 }
}

/**
 * Twelve, so the tenth to twelfth have no digit and the titles must say so.
 * Each differs from its neighbours in `amount`, every one of them on the grid,
 * and the layer is on in every third so a governed group has a scene that uses
 * it. **No preset holds `amount: 9`**, which is how a test reaches a scene that
 * is nobody's preset without searching for one.
 */
export const PRESETS: Preset<Settings>[] = Array.from({ length: 12 }, (_, index) => ({
  label: `scene ${index + 1}`,
  hint: `Synthetic scene ${index + 1}.`,
  settings: normalizeSettings({
    amount: index * 0.5,
    mode: MODES[index % MODES.length],
    route: ROUTES[index % ROUTES.length],
    flag: index % 2 === 1,
    layer: index % 3 === 2,
    span: [1, 0.5, 20][index % 3],
  }),
}))
