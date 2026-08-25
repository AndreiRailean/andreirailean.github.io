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
  wires: number
  beads: number
  segments: number
  extent: number
  ceiling: number
  relief: number
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

export type ControlGroup = "arrangement" | "canopy" | "wire" | "camera" | "light" | "motion"

export type Control = {
  group: ControlGroup
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  format: (value: number) => string
  /** Shown as a tooltip on the row. */
  hint: string
}

export const GROUP_ORDER: ControlGroup[] = ["arrangement", "canopy", "wire", "camera", "light", "motion"]

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
    group: "arrangement",
    key: "wires",
    label: "wires",
    min: 1,
    max: 80,
    step: 1,
    format: (v) => String(v),
    hint: "How many strings hang from the canopy. Anchor positions are fixed by the seed and by index, so raising this adds wires beside the ones already there rather than rearranging the scene.",
  },
  {
    group: "arrangement",
    key: "beads",
    label: "beads",
    min: 2,
    max: 48,
    step: 1,
    format: (v) => String(v),
    hint: "Bulbs per wire, spaced evenly down its length. They alternate around the wire's axis as they descend, so a wire seen end-on still reads as a string rather than a line.",
  },
  {
    group: "arrangement",
    key: "segments",
    label: "segments",
    min: 6,
    max: 80,
    step: 1,
    format: (v) => String(v),
    hint: "How many links each wire is simulated with. This is the quality knob: more links give a smoother curve and a finer sway, and cost solver time on every wire at once. Lower it before lowering anything else when the frame rate drops.",
  },
  {
    group: "canopy",
    key: "extent",
    label: "spread",
    min: 0.2,
    max: 10,
    step: 0.05,
    format: metres,
    hint: "Radius of the invisible object the wires hang from. A wire hanging directly overhead collapses to a point from below, so this is what gives each string somewhere to lean away to.",
  },
  {
    group: "canopy",
    key: "ceiling",
    label: "height",
    min: 1.5,
    max: 14,
    step: 0.1,
    format: metres,
    hint: "How far above you the canopy sits. Together with wire length this sets the whole composition: it is the ratio of the two that decides how hard the strings fan out, not either one alone.",
  },
  {
    group: "canopy",
    key: "relief",
    label: "relief",
    min: 0,
    max: 4,
    step: 0.05,
    format: metres,
    hint: "How uneven the object above is. At 0 it is a flat ceiling and every wire starts at the same distance from you. Raise it and neighbouring anchors still stay close in height, because they are pinned to one lumpy surface rather than scattered independently.",
  },
  {
    group: "wire",
    key: "length",
    label: "length",
    min: 0.1,
    max: 8,
    step: 0.05,
    format: metres,
    hint: "How far a wire hangs. Long wires bring their lowest bulbs close to you, which is where the size difference along a string becomes obvious.",
  },
  {
    group: "wire",
    key: "stiffness",
    label: "stiffness",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much of its own shape a wire holds against gravity. At 0 it is a limp chain and hangs plumb, which from directly below means its bulbs stack into a point. Raise it and the wire keeps the bend it was coiled with.",
  },
  {
    group: "wire",
    key: "set",
    label: "set",
    min: 0,
    max: 2.5,
    step: 0.01,
    format: (v) => `${((v * 180) / Math.PI).toFixed(0)}°`,
    hint: "The permanent bend a wire remembers from being coiled, as the total turn along its length. This is the wire's imperfection, and stiffness decides how much of it survives being hung up.",
  },
  {
    group: "wire",
    key: "twist",
    label: "twist",
    min: -2,
    max: 2,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How far the bend's direction rotates on the way down, in turns. At 0 a wire bends in one plane; wind it up and the wire spirals and its bulbs sweep around instead of leaning one way.",
  },
  {
    group: "wire",
    key: "irregularity",
    label: "irregularity",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much wires differ from one another in length, stiffness and set. At 0 they are identical objects hung at different heights; raise it and they read as things that have been handled.",
  },
  {
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
    group: "light",
    key: "variance",
    label: "variance",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Manufacturing imperfection: how much bulbs differ in brightness and in how pure their colour is. Deliberately not hue, which colour spread owns. It applies twice — once per wire, because a string is one batch, and again per bulb within it.",
  },
  {
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
    group: "light",
    key: "bloom",
    label: "glow",
    min: 1,
    max: 24,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}x`,
    hint: "How far the halo reaches, as a multiple of the bulb. Halos are drawn additively, so where bulbs crowd together their glow accumulates and a dense wire reads as brighter than its bulbs individually are.",
  },
  {
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
    group: "light",
    key: "flicker",
    label: "flicker",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "A slow, uneven drift in each bulb's brightness, each on its own clock. 0 leaves them perfectly steady, which is correct for LEDs and a little lifeless.",
  },
  {
    group: "motion",
    key: "gust",
    label: "gust",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Strength of the bursts that arrive on top of the breeze. A gust hits hard and leaves the wires to settle, which is what makes it an event rather than the wind briefly picking up — set the breeze to 0 and this alone gives long calms broken by a shove. The front crosses the canopy, so the wires are thrown very nearly together.",
  },
  {
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
    group: "motion",
    key: "tremble",
    label: "tremble",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "The object overhead shivering, which shakes the wires by their anchors instead of pushing on them. Because it moves where a wire hangs from rather than blowing on it, the wire is dragged about by roughly the anchor's own travel and no further — so a crowd stays crowded and gets agitated, where a gust of any strength eventually sweeps it apart. Try it with the breeze and the gust at 0.",
  },
  {
    group: "motion",
    key: "breeze",
    label: "breeze",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Strength of the wind pushing on the wires. The gust is sampled per wire and applied hardest at the free end, so a wire swings from its anchor with its tip lagging behind — the sway travels rather than the whole string moving at once.",
  },
]

export const DEFAULT_SETTINGS: Settings = {
  seed: 7,
  wires: 3,
  beads: 12,
  segments: 28,
  extent: 2.4,
  ceiling: 4.2,
  relief: 0.9,
  // Length against ceiling is the ratio that decides the whole composition: it
  // is what sets how hard the strings fan out, and neither number means much
  // alone. Around three-quarters of the height is where the splay reads clearly
  // without the nearest bulbs leaving the frame.
  length: 3,
  stiffness: 0.55,
  set: 1.2,
  twist: 0.35,
  irregularity: 0.5,
  fieldOfView: 100,
  pitch: 0,
  hue: 38,
  hueSpread: 7,
  variance: 0.3,
  size: 0.02,
  bloom: 8,
  facing: 0.55,
  falloff: 0.5,
  flicker: 0,
  breeze: 0,
  gust: 0,
  gustRate: 6,
  tremble: 0,
  sway: 0,
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
    hint: "A narrow lens on a crowded, low canopy of long limp wires, adrift.",
    settings: {
      seed: 7,
      wires: 37,
      beads: 5,
      segments: 23,
      extent: 3.2,
      ceiling: 3.8,
      relief: 1.2,
      // Longer than the canopy is high, so the nearest bulbs fall past the
      // viewer and out of frame rather than resolving into a string.
      length: 4.75,
      stiffness: 0.25,
      set: 1.21,
      twist: 1.03,
      irregularity: 0.66,
      fieldOfView: 52,
      pitch: 0,
      hue: 38,
      hueSpread: 7.5,
      variance: 0.74,
      size: 0.01,
      bloom: 8.4,
      facing: 0.38,
      falloff: 0.34,
      flicker: 0.48,
      breeze: 0.2,
      gust: 0,
      gustRate: 6,
      tremble: 0,
      sway: 0,
    },
  },
  {
    label: "together",
    hint: "A tight low cluster, wires plumb and plunging past you, all of it moving.",
    settings: {
      seed: 7,
      wires: 50,
      beads: 4,
      segments: 20,
      extent: 0.65,
      ceiling: 1.7,
      // Relief larger than the ceiling on purpose. The anchors themselves stay
      // in front of you — measured, 0.36m at the lowest — but hanging their own
      // length again from that puts the bottom of most wires behind the camera,
      // so roughly a fifth of the bulbs are culled at any moment and the rest
      // pass by very close.
      relief: 2,
      length: 1.7,
      // No bend at all. Every wire hangs plumb, and the arrangement comes
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
      sway: 0,
    },
  },
  {
    label: "frantic",
    hint: "Fifty-one short wires crammed almost overhead, hot pink through green, hit hard and often.",
    settings: {
      seed: 7,
      wires: 51,
      beads: 4,
      segments: 20,
      extent: 0.2,
      ceiling: 1.8,
      relief: 1,
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
const INTEGER_KEYS: NumericKey[] = ["seed", "wires", "beads", "segments"]

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
 * Whether a change needs the chains reallocated.
 *
 * Deliberately short. Everything else — length, stiffness, set, the canopy, the
 * camera, every colour — is read live, so dragging those relaxes the wires into
 * their new shape instead of teleporting them. Rebuilding for a hue change would
 * reset the whole scene for nothing.
 */
export function needsRebuild(before: Settings, after: Settings): boolean {
  return before.seed !== after.seed || before.wires !== after.wires || before.segments !== after.segments
}
