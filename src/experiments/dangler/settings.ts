import type { SliderControl } from "@/experiments/kit/controls"
/**
 * Everything about the scene that is tunable at runtime.
 *
 * One source of truth shared by the engine, the panel and the URL. Bounds live
 * here rather than in the markup so a slider and the query-string parser cannot
 * disagree about what a legal value is.
 *
 * World units are metres, and the numbers are meant literally: a bulb really is
 * about a centimetre across and really does subtend a pixel or two from four
 * metres away. What you see of a bead at that size is almost entirely its glow,
 * which is why `bloom` is a multiple of the core rather than a size of its own.
 */

export type Settings = {
  seed: number
  strands: number
  beads: number
  segments: number
  extent: number
  ceiling: number
  relief: number
  branches: number
  length: number
  stiffness: number
  set: number
  twist: number
  irregularity: number
  fieldOfView: number
  pitch: number
  hue: number
  hueSpread: number
  variance: number
  size: number
  bloom: number
  facing: number
  falloff: number
  flicker: number
  breeze: number
  gust: number
  gustRate: number
  tremble: number
  sway: number
}

export type NumericKey = keyof Settings

export type ControlGroup = "arrangement" | "canopy" | "strand" | "camera" | "light" | "motion"

/**
 * Every row here is a plain slider; the kit also has range, choice and toggle
 * kinds that this piece has no use for. `group` is narrowed from the kit's
 * `string` to the six headings that exist, so a typo is a type error.
 */
export type Control = SliderControl<NumericKey> & {
  group: ControlGroup
}

export const GROUP_ORDER: ControlGroup[] = ["arrangement", "canopy", "strand", "camera", "light", "motion"]

/** Widest legal seed. Kept small enough to stay readable in a shared URL. */
export const SEED_BOUNDS = { min: 0, max: 999_999 }

const metres = (value: number) => `${value.toFixed(2)}m`

/**
 * The panel rows, in order.
 *
 * `seed` is deliberately absent: it is a setting and it round-trips through the
 * URL, but a slider over a million arbitrary integers is not a control anyone
 * can use. It gets a re-roll button instead.
 */
export const CONTROLS: Control[] = [
  {
    kind: "slider",
    group: "arrangement",
    key: "strands",
    label: "strands",
    min: 1,
    max: 80,
    step: 1,
    format: (v) => String(v),
    hint: "How many strings hang from the canopy. Anchor positions are fixed by the seed and by index, so raising this adds strands beside the ones already there rather than rearranging the scene.",
  },
  {
    kind: "slider",
    group: "arrangement",
    key: "beads",
    label: "beads",
    min: 2,
    max: 48,
    step: 1,
    format: (v) => String(v),
    hint: "Bulbs per strand, spaced evenly down its length. They alternate around the strand's axis as they descend, so a strand seen end-on still reads as a string rather than a line.",
  },
  {
    kind: "slider",
    group: "arrangement",
    key: "segments",
    label: "segments",
    min: 6,
    max: 80,
    step: 1,
    format: (v) => String(v),
    hint: "How many links each strand is simulated with. This is the quality knob: more links give a smoother curve and a finer sway, and cost solver time on every strand at once. Lower it before lowering anything else when the frame rate drops.",
  },
  {
    kind: "slider",
    group: "canopy",
    key: "extent",
    label: "spread",
    min: 0.2,
    max: 10,
    step: 0.05,
    format: metres,
    hint: "Radius of the invisible object the strands hang from. A strand hanging directly overhead collapses to a point from below, so this is what gives each string somewhere to lean away to.",
  },
  {
    kind: "slider",
    group: "canopy",
    key: "ceiling",
    label: "height",
    min: 1.5,
    max: 14,
    step: 0.1,
    format: metres,
    hint: "How far above you the canopy sits. Together with strand length this sets the whole composition: it is the ratio of the two that decides how hard the strings fan out, not either one alone.",
  },
  {
    kind: "slider",
    group: "canopy",
    key: "relief",
    label: "relief",
    min: 0,
    max: 4,
    step: 0.05,
    format: metres,
    hint: "How uneven the object above is. At 0 it is a flat ceiling and every strand starts at the same distance from you. Raise it and neighbouring anchors still stay close in height, because they are pinned to one lumpy surface rather than scattered independently.",
  },
  {
    kind: "slider",
    group: "canopy",
    key: "branches",
    label: "branches",
    min: 0,
    max: 14,
    step: 1,
    format: (v) => (v < 1 ? "off" : String(v)),
    hint: "Arms the anchors are strung along, the way lights get slung over a few branches rather than scattered evenly. Off spreads them across the whole canopy. Each arm starts away from the trunk and has its own reach, sweep and height, so a handful of them reads as several separate clumps rather than one mass — and a low count with many strands gives a few dense danglers instead of one.",
  },
  {
    kind: "slider",
    group: "strand",
    key: "length",
    label: "length",
    min: 0.1,
    max: 8,
    step: 0.05,
    format: metres,
    hint: "How far a strand hangs. Long strands bring their lowest bulbs close to you, which is where the size difference along a string becomes obvious.",
  },
  {
    kind: "slider",
    group: "strand",
    key: "stiffness",
    label: "stiffness",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much of its own shape a strand holds against gravity. At 0 it is a limp chain and hangs plumb, which from directly below means its bulbs stack into a point. Raise it and the strand keeps the bend it was coiled with.",
  },
  {
    kind: "slider",
    group: "strand",
    key: "set",
    label: "set",
    min: 0,
    max: 2.5,
    step: 0.01,
    format: (v) => `${((v * 180) / Math.PI).toFixed(0)}°`,
    hint: "The permanent bend a strand remembers from being coiled, as the total turn along its length. This is the strand's imperfection, and stiffness decides how much of it survives being hung up.",
  },
  {
    kind: "slider",
    group: "strand",
    key: "twist",
    label: "twist",
    min: -2,
    max: 2,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How far the bend's direction rotates on the way down, in turns. At 0 a strand bends in one plane; wind it up and the strand spirals and its bulbs sweep around instead of leaning one way.",
  },
  {
    kind: "slider",
    group: "strand",
    key: "irregularity",
    label: "irregularity",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much strands differ from one another in length, stiffness and set. At 0 they are identical objects hung at different heights; raise it and they read as things that have been handled.",
  },
  {
    kind: "slider",
    group: "camera",
    key: "fieldOfView",
    label: "lens",
    min: 30,
    max: 150,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Field of view across the shorter side of the window. Wide takes in the whole canopy and pushes the vanishing point into frame, so the strings visibly splay. Narrow crops in and the perspective becomes something you infer rather than see.",
  },
  {
    kind: "slider",
    group: "camera",
    key: "pitch",
    label: "tilt",
    min: 0,
    max: 60,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "How far off vertical you are looking. 0 is flat on your back, with the vanishing point dead centre. Tilt it and the point leaves the frame, so the strings stop radiating and start sweeping across it.",
  },
  {
    kind: "slider",
    group: "light",
    key: "hue",
    label: "hue",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "The base colour every bulb is drawn from. Around 38 is warm filament; 200 is cold blue.",
  },
  {
    kind: "slider",
    group: "light",
    key: "hueSpread",
    label: "colour spread",
    min: 0,
    max: 90,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}°`,
    hint: "How far bulbs stray from the base hue, as a standard deviation. A few degrees is a string of nominally identical bulbs that measurably are not. Sixty is a proper festive scatter. At every setting most bulbs sit near the base with the occasional outlier, which is what real variation looks like.",
  },
  {
    kind: "slider",
    group: "light",
    key: "variance",
    label: "variance",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Manufacturing imperfection: how much bulbs differ in brightness and in how pure their colour is. Deliberately not hue, which colour spread owns. It applies twice — once per strand, because a string is one batch, and again per bulb within it.",
  },
  {
    kind: "slider",
    group: "light",
    key: "size",
    label: "bulb",
    min: 0.002,
    max: 0.08,
    step: 0.001,
    format: (v) => `${(v * 1000).toFixed(0)}mm`,
    hint: "Physical size of a bulb. Taken literally: a centimetre of glass four metres up really is a pixel or two, so almost everything you see of a bead is its glow rather than the bead.",
  },
  {
    kind: "slider",
    group: "light",
    key: "bloom",
    label: "glow",
    min: 1,
    max: 24,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}x`,
    hint: "How far the halo reaches, as a multiple of the bulb. Halos are drawn additively, so where bulbs crowd together their glow accumulates and a dense strand reads as brighter than its bulbs individually are.",
  },
  {
    kind: "slider",
    group: "light",
    key: "facing",
    label: "facing",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much a bulb dims when it points away from you. An LED throws its light along its axis, which is why a real string shimmers as you walk under it — bulbs come round to face you and go again. At 0 orientation is ignored and every bulb is equally bright.",
  },
  {
    kind: "slider",
    group: "light",
    key: "falloff",
    label: "distance",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much the far bulbs dim relative to the near ones. Size already carries most of the depth; this decides whether distance also drains the light, which reads as air between you and the canopy.",
  },
  {
    kind: "slider",
    group: "light",
    key: "flicker",
    label: "flicker",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Each bulb wavering in brightness on its own clock, somewhere between a third of a second and three seconds a cycle, and never on a regular pulse. 0 leaves them perfectly steady, which is correct for LEDs and a little lifeless. It reads most clearly with the wind turned down, where it is the only thing moving.",
  },
  {
    kind: "slider",
    group: "motion",
    key: "gust",
    label: "gust",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Strength of the bursts that arrive on top of the breeze. A gust hits hard and leaves the strands to settle, which is what makes it an event rather than the wind briefly picking up — set the breeze to 0 and this alone gives long calms broken by a shove. The front crosses the canopy, so the strands are thrown very nearly together.",
  },
  {
    kind: "slider",
    group: "motion",
    key: "gustRate",
    label: "gust rate",
    min: 0.5,
    max: 30,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}/min`,
    hint: "How often a gust arrives, on average. Each one is jittered within its slot and varies in strength and direction, so this is a rate rather than a metronome. Slow and strong is a different piece from fast and weak.",
  },
  {
    kind: "slider",
    group: "motion",
    key: "sway",
    label: "sway",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "The whole canopy leaning, turning and rising under the wind, the way a tree does — and springing back past upright when a gust passes. It moves as one body, so every anchor keeps its position relative to every other; that coherence is what separates it from tremble, which moves each anchor on its own and reads as the observer being jostled rather than the scene moving. Needs breeze or gust to do anything, since a tree in still air does not move.",
  },
  {
    kind: "slider",
    group: "motion",
    key: "tremble",
    label: "tremble",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "The object overhead shivering, which shakes the strands by their anchors instead of pushing on them. Because it moves where a strand hangs from rather than blowing on it, the strand is dragged about by roughly the anchor's own travel and no further — so a crowd stays crowded and gets agitated, where a gust of any strength eventually sweeps it apart. Try it with the breeze and the gust at 0.",
  },
  {
    kind: "slider",
    group: "motion",
    key: "breeze",
    label: "breeze",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Strength of the wind pushing on the strands. The gust is sampled per strand and applied hardest at the free end, so a strand swings from its anchor with its tip lagging behind — the sway travels rather than the whole string moving at once.",
  },
]

/**
 * The base every scene is measured against.
 *
 * Two jobs, and neither is "the scene you land on" — that is `PRESETS[0]`, via
 * `settingsForLanding`. These are what `normalizeSettings` falls back to for a
 * value it cannot read, and what `settingsToQuery` diffs against so a shared URL
 * carries only what someone actually changed.
 *
 * They are also, unavoidably, the scene anything that renders the piece without
 * choosing settings gets — the note's background is the one that matters. So
 * these are a scene worth looking at rather than the simplest thing the
 * machinery can draw, which is what they used to be: three stiff strands hanging
 * still. Recorded from exploration like a preset, and replacing them changes how
 * long every shared URL is, which is a cost worth paying once and not often.
 */
export const DEFAULT_SETTINGS: Settings = {
  seed: 7,
  strands: 80,
  beads: 4,
  segments: 36,
  // A tight, low canopy: the anchors sit inside a metre and a half of each
  // other, barely above the viewer, so the strands crowd rather than fan.
  extent: 1.25,
  ceiling: 1.5,
  relief: 0.45,
  branches: 0,
  // Short against the ceiling, unlike every other scene here. The strings stop
  // well above the camera instead of falling past it, which is what keeps
  // eighty of them legible at once.
  length: 0.7,
  // Fully limp, with no rest curl at all: every strand hangs plumb and the whole
  // arrangement is the canopy's doing. `twist` and `irregularity` are then the
  // only things keeping them from reading as one column.
  stiffness: 0,
  set: 0,
  twist: -0.61,
  irregularity: 1,
  fieldOfView: 66,
  pitch: 0,
  hue: 236,
  hueSpread: 16.5,
  variance: 0.74,
  size: 0.01,
  bloom: 8.4,
  facing: 0.38,
  falloff: 0.34,
  flicker: 0.48,
  breeze: 0.51,
  gust: 0.06,
  gustRate: 6,
  tremble: 0,
  sway: 0.7,
}

/**
 * Recorded scenes.
 *
 * The section's convention is that presets are recorded from exploration rather
 * than designed up front, so each one is written out in full rather than spread
 * over `DEFAULT_SETTINGS`. A scene someone found by dragging sliders should stay
 * the scene they found; inheriting the defaults would let it drift silently the
 * next time one of those is retuned.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "dreamy",
    hint: "Six arms of long, all but limp strands in cold blue, falling past you, everything barely moving.",
    settings: {
      seed: 310555,
      strands: 52,
      beads: 9,
      segments: 34,
      extent: 3.5,
      ceiling: 4,
      relief: 1.35,
      branches: 6,
      // Longer than the canopy is high, so the nearest bulbs fall past the
      // viewer and out of frame rather than resolving into a string.
      length: 4.45,
      // All but limp. What little shape the strands hold comes to almost nothing,
      // so they hang plumb and the arrangement is the canopy's, not theirs.
      stiffness: 0.01,
      set: 0.19,
      twist: -0.93,
      irregularity: 0.62,
      fieldOfView: 65,
      pitch: 0,
      hue: 196,
      hueSpread: 10,
      variance: 0.62,
      size: 0.01,
      bloom: 14,
      // Orientation ignored: with strands this limp every bulb faces much the same
      // way, and dimming by it would only thin the scene out.
      facing: 0,
      falloff: 0.22,
      flicker: 0.23,
      breeze: 0.33,
      gust: 0.1,
      gustRate: 17,
      tremble: 0,
      sway: 0.5,
    },
  },
  {
    label: "together",
    hint: "A tight low cluster, strands plumb and plunging past you, all of it moving.",
    settings: {
      seed: 7,
      strands: 50,
      beads: 4,
      segments: 20,
      extent: 0.65,
      ceiling: 1.7,
      // Relief larger than the ceiling on purpose. The anchors themselves stay
      // in front of you — measured, 0.36m at the lowest — but hanging their own
      // length again from that puts the bottom of most strands behind the camera,
      // so roughly a fifth of the bulbs are culled at any moment and the rest
      // pass by very close.
      relief: 2,
      branches: 0,
      length: 1.7,
      // No bend at all. Every strand hangs plumb, and the arrangement comes
      // entirely from where the anchors are and how the breeze moves them.
      stiffness: 0,
      set: 0,
      twist: -0.61,
      irregularity: 1,
      fieldOfView: 56,
      pitch: 0,
      hue: 38,
      hueSpread: 7.5,
      variance: 0.74,
      size: 0.01,
      bloom: 8.4,
      facing: 0.38,
      falloff: 0.34,
      flicker: 0.48,
      breeze: 0.51,
      gust: 0,
      gustRate: 6,
      tremble: 0,
      sway: 0.7,
    },
  },
  {
    label: "frantic",
    hint: "Fifty-one short strands crammed almost overhead, hot pink through green, hit hard and often.",
    settings: {
      seed: 7,
      strands: 51,
      beads: 4,
      segments: 20,
      extent: 0.2,
      ceiling: 1.8,
      relief: 1,
      branches: 0,
      length: 0.65,
      stiffness: 0.63,
      set: 0.39,
      twist: -0.61,
      irregularity: 1,
      fieldOfView: 56,
      pitch: 0,
      hue: 323,
      hueSpread: 62.5,
      variance: 0.74,
      size: 0.01,
      bloom: 8.4,
      facing: 0.38,
      falloff: 0.49,
      flicker: 0,
      breeze: 0,
      gust: 1,
      gustRate: 9,
      tremble: 0,
      sway: 0,
    },
  },
]

/** Bounds for every numeric setting, including the ones with no slider. */
export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(CONTROLS.map((c) => [c.key, { min: c.min, max: c.max }])) as Record<
    NumericKey,
    { min: number; max: number }
  >),
  // Last, and deliberately: seed has no slider to derive bounds from.
  seed: SEED_BOUNDS,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Settings that must hold whole numbers; a fractional segment count is nonsense. */
const INTEGER_KEYS: NumericKey[] = ["seed", "strands", "beads", "segments"]

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API — comes through here, so the API cannot reach a state a URL could not.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const settings = { ...base, ...patch }

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const bound = BOUNDS[key]
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    if (INTEGER_KEYS.includes(key)) settings[key] = Math.round(settings[key])
  }

  return settings
}

/**
 * Reads settings from a query string.
 *
 * An absent param is `null` and `Number(null)` is 0, which is a legal value for
 * most of these — reading them with a bare `Number()` would silently zero the
 * breeze, the flicker and the tilt. Absent, blank and unparseable are all
 * skipped so the default survives.
 */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }

  return normalizeSettings(patch)
}

/** Only values that differ from the defaults, so shared URLs stay readable. */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) params.set(key, String(settings[key]))
  }
  return params
}

/**
 * The address that restores exactly this scene.
 *
 * One definition with two callers — the chrome, which rewrites the URL on every
 * change, and the page, which rewrites it once on landing. They disagreed about
 * nothing yet, and now cannot.
 */
export function urlForSettings(settings: Settings, pathname: string): string {
  const query = settingsToQuery(settings).toString()
  return `${pathname}${query ? `?${query}` : ""}`
}

/**
 * Whether a query string names any setting at all.
 *
 * The same rule `settingsFromQuery` applies, and it has to stay the same rule:
 * absent, blank and unparseable are all "not a setting" there, so a URL made
 * only of those is one the piece would read as carrying nothing.
 */
function namesASetting(params: URLSearchParams): boolean {
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * The scene a freshly-opened URL should show.
 *
 * A URL naming no settings gets the first preset, not `DEFAULT_SETTINGS`. The
 * defaults are three stiff strands hanging still — the simplest thing the
 * machinery can draw, and a fair picture of nothing anybody would stay for.
 * What the piece is actually *for* is the first preset.
 *
 * Deliberately not fixed by moving `DEFAULT_SETTINGS`. They are the base
 * `normalizeSettings` falls back to and the thing `settingsToQuery` diffs
 * against, so changing them would quietly change what every URL already shared
 * means, and shorten or lengthen every future one for unrelated reasons. The
 * defaults are the vocabulary; which scene is worth landing on is editorial.
 *
 * `featured` says the caller should rewrite the address. A landing visitor then
 * has a URL describing the scene in front of them rather than one standing for
 * "whatever is featured", which is the difference between a link that keeps
 * working and a link that silently becomes a different piece.
 */
export function settingsForLanding(params: URLSearchParams): { settings: Settings; featured: boolean } {
  if (namesASetting(params)) return { settings: settingsFromQuery(params), featured: false }
  return { settings: normalizeSettings(PRESETS[0]!.settings), featured: true }
}

/**
 * Whether a change needs the chains reallocated.
 *
 * Deliberately short. Everything else — length, stiffness, set, the canopy, the
 * camera, every colour — is read live, so dragging those relaxes the strands into
 * their new shape instead of teleporting them. Rebuilding for a hue change would
 * reset the whole scene for nothing.
 */
export function needsRebuild(before: Settings, after: Settings): boolean {
  return before.seed !== after.seed || before.strands !== after.strands || before.segments !== after.segments
}
