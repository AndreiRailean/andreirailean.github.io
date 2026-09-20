import { decodeScene, encodeScene, type Slot } from "@/experiments/address"
import {
  gridAt,
  snapToGrid,
  type Control as KitControl,
  type RangeControl,
  type SliderControl,
  type Track,
} from "@/experiments/kit/controls"

/** Re-exported so a consumer needs one import for a control and its keys. */
export { keysOf } from "@/experiments/kit/controls"

/** How the jets are arranged on the surface. */
export const LAYOUTS = ["ring", "row", "scatter"] as const
export type Layout = (typeof LAYOUTS)[number]
export const isLayout = (value: unknown): value is Layout => LAYOUTS.includes(value as Layout)

/** How a bubble is drawn. */
export const LOOKS = ["disc", "ring", "mixed"] as const
export type Look = (typeof LOOKS)[number]
export const isLook = (value: unknown): value is Look => LOOKS.includes(value as Look)

/** Which way each jet twists the water under it. */
export const SPINS = ["alternate", "same", "loose"] as const
export type Spin = (typeof SPINS)[number]
export const isSpin = (value: unknown): value is Spin => SPINS.includes(value as Spin)

/**
 * Everything about the water that is tunable at runtime.
 *
 * Lengths are in **metres of water** and speeds in metres per second; `span`
 * says how much of it the shorter side of the window holds. Nothing here is in
 * pixels, so the same address describes the same tub on a phone and on a
 * monitor — see `view.ts` in embers for the section's record on that.
 */
export type Settings = {
  /** How many jets are running. */
  jets: number
  layout: Layout
  spin: Spin
  look: Look
  /** How far the jets sit from the middle of the tub, in metres. */
  spread: number
  /** Radius of a jet's mouth, in metres. The outflow peaks here. */
  core: number
  /** Peak surface speed of a jet's upwelling, in m/s. */
  outflow: number
  /** Peak tangential speed of the twist a jet puts on the water, in m/s. */
  swirl: number
  /** Bubbles a jet releases per second. */
  rate: number
  /** How hard each jet surges on its own slow clock. 0 runs them steady. */
  pulse: number
  /** Smallest radius a bubble is born at, in metres. */
  birthMin: number
  /** Largest radius a bubble is born at, in metres. */
  birthMax: number
  /** Strength of the swirling background flow, in m/s. */
  churn: number
  /** Size of that flow's features, in metres. */
  scale: number
  /** How fast the background flow rearranges itself. */
  drift: number
  /** A slow basin-wide return toward the middle, in 1/s. */
  ebb: number
  /** How far a bubble sidesteps as it travels, in m/s. */
  wave: number
  /** How often that sidestep reverses, in Hz. */
  waveHz: number
  /** How sluggishly a bubble answers the water. 0 pins it to the flow. */
  lag: number
  /** How far apart two bubbles count as touching, as a fraction of their radii. */
  pack: number
  /** How readily two touching bubbles become one. */
  merge: number
  /** How hard two touching bubbles that did not merge push apart. */
  bounce: number
  /** Radius a bubble's film loses per second as it drains, in metres. */
  dissolve: number
  /** Radius past which a bubble is living on borrowed time, in metres. */
  popSize: number
  /** How quickly an oversized bubble bursts. */
  popRate: number
  /** Droplets thrown out by a burst. */
  spray: number
  /** Most bubbles alive at once. */
  count: number
  /** Wall thickness of a ring, as a fraction of its radius. Unused by `disc`. */
  rim: number
  /** How much of the last frame is left behind, as a wake. */
  trail: number
  /** Metres of water across the shorter side of the window. */
  span: number
  /** Hue of the controls and of the written note. The water has no colour. */
  hue: number
  seed: number
}

export type NumericKey = Exclude<keyof Settings, "layout" | "spin" | "look">

export type Control = KitControl<string & keyof Settings>

export type NumericControl = SliderControl<NumericKey> | RangeControl<NumericKey>

export const isNumericControl = (control: Control): control is NumericControl =>
  control.kind === "slider" || control.kind === "range"

/** Headings, in the order the panel files its rows under. */
export const GROUPS = ["jets", "water", "foam", "picture"] as const

export const CONTROLS: Control[] = [
  {
    kind: "slider",
    key: "jets",
    label: "jets",
    group: "jets",
    min: 1,
    max: 8,
    step: 1,
    format: (v) => String(v),
    hint: "How many jets are running. One gives you a clean radiating boil; the interesting things — collisions, jams, a line of foam where two outflows meet — need at least two.",
  },
  {
    kind: "choice",
    key: "layout",
    label: "arrangement",
    group: "jets",
    options: [
      { value: "ring", label: "ring" },
      { value: "row", label: "row" },
      { value: "scatter", label: "scatter" },
    ],
    hint: "Where the jets sit. Ring spaces them evenly around the middle, row lays them along a line across the tub, and scatter drops them at random inside the same circle — seed picks which random.",
  },
  {
    kind: "slider",
    key: "spread",
    label: "spacing",
    group: "jets",
    min: 0,
    max: 0.9,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}cm`,
    hint: "How far the jets sit from the middle of the tub, in centimetres of real water. At 0 they are stacked on one spot and behave as a single stronger jet. Wide enough and each one owns its own corner. It is a length rather than a fraction of the frame, so stepping back with frame shows more water around the same tub instead of moving the jets apart.",
  },
  {
    kind: "slider",
    key: "core",
    label: "mouth",
    group: "jets",
    min: 0.02,
    max: 0.5,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}cm`,
    hint: "Radius of the boil directly over a jet. The outflow is fastest exactly here and falls away like 1/r outside it, which is what a source in shallow water does. A wide mouth makes a lazy dome; a narrow one makes a hard spot bubbles are flung out of.",
  },
  {
    kind: "slider",
    key: "outflow",
    label: "push",
    group: "jets",
    min: 0,
    max: 3,
    step: 0.02,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "How fast the water leaves the mouth of a jet. At 0 the jets still make bubbles but nothing carries them away, so they pile up and merge where they were born.",
  },
  {
    kind: "slider",
    key: "swirl",
    label: "twist",
    group: "jets",
    min: 0,
    max: 1.5,
    step: 0.02,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "How much a jet turns the water as well as pushing it out, so the paths leaving it are spirals rather than spokes. Which way each jet turns is the spin setting.",
  },
  {
    kind: "choice",
    key: "spin",
    label: "spin",
    group: "jets",
    options: [
      { value: "alternate", label: "opposed" },
      { value: "same", label: "alike" },
      { value: "loose", label: "loose" },
    ],
    hint: "Which way neighbouring jets turn. Opposed sets them against each other, so the water between two of them shears and tears; alike lets the whole tub rotate together; loose lets the seed decide each one.",
  },
  {
    kind: "slider",
    key: "rate",
    label: "gas",
    group: "jets",
    min: 2,
    max: 1500,
    step: 1,
    scale: "log",
    format: (v) => `${Math.round(v)}/s`,
    hint: "Bubbles a single jet releases each second. The cap on how many can be alive at once is under picture, and when the two fight the cap wins — a jet with nowhere to put a bubble simply does not release it. The top of this range is well past what the cap will allow at any normal setting, deliberately: it is how you get a tub that is more foam than water.",
  },
  {
    kind: "slider",
    key: "pulse",
    label: "surge",
    group: "jets",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How hard each jet surges, on its own slow clock a few seconds long. Real jets do this — a pump and an air intake do not deliver evenly — and it is what stops a tub reaching a steady state and staying there. At 0 every jet runs flat.",
  },
  {
    kind: "range",
    keys: ["birthMin", "birthMax"],
    label: "born at",
    group: "jets",
    min: 0.002,
    max: 0.04,
    step: 0.001,
    scale: "log",
    format: (from, to) => `${(from * 1000).toFixed(0)}–${(to * 1000).toFixed(0)}mm`,
    hint: "The range of radii a bubble arrives at. Every bubble bigger than this got that way by swallowing others, which is the only way anything grows here.",
  },
  {
    kind: "slider",
    key: "churn",
    label: "churn",
    group: "water",
    min: 0,
    max: 2,
    step: 0.02,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "Strength of the swirling background the jets sit in. It is built to have no sources or sinks of its own — it can only move water around, never make or lose any — which is why it reads as water rather than as drift.",
  },
  {
    kind: "slider",
    key: "scale",
    label: "eddies",
    group: "water",
    min: 0.05,
    max: 1.2,
    step: 0.01,
    scale: "log",
    format: (v) => `${(v * 100).toFixed(0)}cm`,
    hint: "How big the background's swirls are. Small values make a fine crawl the bubbles shiver in; large ones make slow gyres that carry whole rafts of foam across the tub together.",
  },
  {
    kind: "slider",
    key: "drift",
    label: "unsettled",
    group: "water",
    min: 0,
    max: 1.5,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How fast the background rearranges itself. At 0 the swirls are fixed in place and the water is a standing pattern bubbles run through. Turn it up and no eddy lasts long enough to be recognised.",
  },
  {
    kind: "slider",
    key: "ebb",
    label: "return",
    group: "water",
    min: 0,
    max: 1.5,
    step: 0.02,
    format: (v) => `${v.toFixed(2)}/s`,
    hint: "The slow flow back toward the middle that a closed tub must have — everything the jets push out has to come from somewhere. Where it balances a jet's push there is a standing ring of foam, which is the thing in a real tub that never quite goes away.",
  },
  {
    kind: "slider",
    key: "wave",
    label: "waver",
    group: "water",
    min: 0,
    max: 1.5,
    step: 0.02,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "How far each bubble sidesteps across its own path, on its own clock. This is the wave riding under the surface rather than anything the bubble is doing — so it is what makes a track wavy instead of straight.",
  },
  {
    kind: "slider",
    key: "waveHz",
    label: "waver rate",
    group: "water",
    min: 0.1,
    max: 4,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}Hz`,
    hint: "How often that sidestep reverses. Slow makes long lazy S-curves out of every path; fast makes each bubble shiver in place as it goes.",
  },
  {
    kind: "slider",
    key: "lag",
    label: "lag",
    group: "water",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How sluggishly a bubble answers a change in the water. At 0 it is pinned to the flow and the picture is the flow exactly. Above that, a big bubble takes longer to turn than a small one, so the sizes separate as they travel and a crowd stops moving as one.",
  },
  {
    kind: "slider",
    key: "pack",
    label: "contact",
    group: "foam",
    min: 0.5,
    max: 1.3,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How close two bubbles have to be before they count as touching, measured against the sum of their radii. Below 1 they must genuinely overlap, which makes a loose foam of separate circles. Above 1 their films reach for each other before they meet, which is what a real surface does, and packs the foam tight.",
  },
  {
    kind: "slider",
    key: "merge",
    label: "coalesce",
    group: "foam",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How readily two touching bubbles become one. The new one keeps the area of both, so radius grows as the square root and it takes four bubbles to double one. At 0 nothing ever grows and nothing ever pops.",
  },
  {
    kind: "slider",
    key: "bounce",
    label: "jostle",
    group: "foam",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How hard two touching bubbles that did not merge push each other apart. This is what turns a crowd into a raft with structure in it rather than a heap of overlapping circles.",
  },
  {
    kind: "slider",
    key: "dissolve",
    label: "drain",
    group: "foam",
    min: 0,
    max: 0.02,
    step: 0.0005,
    format: (v) => `${(v * 1000).toFixed(1)}mm/s`,
    hint: "How fast a bubble's film thins away. It is the only thing that removes a small bubble that never meets another, and without some of it the quiet corners of the tub silt up with foam that has nowhere to go.",
  },
  {
    kind: "slider",
    key: "popSize",
    label: "pop at",
    group: "foam",
    min: 0.01,
    max: 0.14,
    step: 0.002,
    format: (v) => `${(v * 100).toFixed(1)}cm`,
    hint: "The radius past which a bubble is living on borrowed time. It is not a hard ceiling: the chance of bursting climbs from here, so one that keeps feeding goes quickly and one that stops just over the line can last.",
  },
  {
    kind: "slider",
    key: "popRate",
    label: "pop rate",
    group: "foam",
    min: 0,
    max: 5,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How impatient that clock is. At 0 nothing bursts whatever its size, so the tub fills with a handful of enormous circles — which is a legitimate thing to look at and not a mistake.",
  },
  {
    kind: "slider",
    key: "spray",
    label: "spray",
    group: "foam",
    min: 0,
    max: 8,
    step: 1,
    format: (v) => String(v),
    hint: "Droplets thrown out when a bubble bursts, which is what a real film does when it lets go. They are born tiny and moving outward, so a pop leaves a brief ring rather than a hole.",
  },
  {
    kind: "slider",
    key: "count",
    label: "at once",
    group: "picture",
    min: 200,
    max: 6000,
    step: 50,
    scale: "log",
    format: (v) => String(Math.round(v)),
    hint: "Most bubbles alive at one time. A ceiling on the work per frame rather than a setting about the picture, but the two are hard to separate: a jet that cannot get a slot releases nothing, so the cap shows up as a thinner boil.",
  },
  {
    kind: "choice",
    key: "look",
    label: "drawn as",
    group: "picture",
    options: [
      { value: "disc", label: "discs" },
      { value: "ring", label: "rings" },
      { value: "mixed", label: "mixed" },
    ],
    hint: "What a bubble is. Discs are solid white circles. Rings are outlines, which is closer to what a bubble on a real surface looks like from above — a bright meniscus with the water showing through the middle. Mixed draws a bubble as a ring once it is big enough for the ring to read, and as a dot while it is not, which is what an eye actually sees.",
  },
  {
    kind: "slider",
    key: "rim",
    label: "wall",
    group: "picture",
    min: 0.08,
    max: 0.6,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How thick a ring's wall is, as a fraction of its radius. At 0.5 a ring is a filled disc with a pinhole. Does nothing while bubbles are drawn as discs.",
  },
  {
    kind: "slider",
    key: "trail",
    label: "wake",
    group: "picture",
    min: 0,
    max: 0.95,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much of the last frame survives into this one. At 0 you see where the bubbles are; turn it up and you see where they have been, which is the flow drawn out as streaks.",
  },
  {
    kind: "slider",
    key: "span",
    label: "frame",
    group: "picture",
    min: 0.3,
    max: 4,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}m`,
    hint: "Metres of water across the shorter side of the window, so the same address frames the same tub on a phone and on a monitor. Everything else is measured in metres, so this is a step back rather than a zoom.",
  },
  {
    kind: "slider",
    key: "hue",
    label: "hue",
    group: "picture",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Colour of these controls and of the written note. The water is black and the bubbles are white, and nothing in the picture uses this — an observer is meant to see white circles and nothing else.",
  },
  {
    kind: "slider",
    key: "seed",
    label: "seed",
    group: "picture",
    min: 1,
    max: 9999,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "Which arrangement of jets you get, and which way each one turns when spin is loose. Nothing about the water itself is seeded — the background flow runs on its own clock and never repeats.",
  },
]

/**
 * The baseline, which is what an address naming nothing fills its gaps from.
 *
 * Not a scene: a bare visit lands on the primary preset, not here. See
 * `settingsForLanding`.
 */
export const DEFAULT_SETTINGS: Settings = {
  jets: 5,
  layout: "ring",
  spin: "alternate",
  look: "disc",
  spread: 0.34,
  core: 0.05,
  outflow: 0.46,
  swirl: 0.2,
  rate: 260,
  pulse: 0.3,
  birthMin: 0.003,
  birthMax: 0.009,
  churn: 0.6,
  scale: 0.25,
  drift: 0.46,
  ebb: 0.56,
  wave: 0.3,
  waveHz: 1.4,
  lag: 0.36,
  pack: 0.9,
  merge: 0.6,
  bounce: 0.5,
  dissolve: 0.0005,
  popSize: 0.036,
  popRate: 1.6,
  spray: 3,
  count: 3000,
  rim: 0.24,
  trail: 0,
  span: 0.9,
  hue: 190,
  seed: 1729,
}

/**
 * Starting points, not conclusions.
 *
 * **Every one states every setting and inherits from nothing** — not from
 * another preset and not from `DEFAULT_SETTINGS`. Spreading over the defaults
 * reads as tidy and cost Psyxels four of its six scenes the day its featured
 * scene changed; see `../docs/adr/20260830-a-preset-inherits-from-nothing.md`.
 *
 * Position one is the primary: a bare address lands on it, the poster is
 * captured from it, and the note reads its backdrop and its hue off it.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "jacuzzi",
    hint: "Five jets in a ring, turning against each other, filling the frame. The starting point.",
    settings: {
      jets: 5,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.34,
      core: 0.05,
      outflow: 0.46,
      swirl: 0.2,
      rate: 260,
      pulse: 0.3,
      birthMin: 0.003,
      birthMax: 0.009,
      churn: 0.6,
      scale: 0.25,
      drift: 0.46,
      ebb: 0.56,
      wave: 0.3,
      waveHz: 1.4,
      lag: 0.36,
      pack: 0.9,
      merge: 0.6,
      bounce: 0.5,
      dissolve: 0.0005,
      popSize: 0.036,
      popRate: 1.6,
      spray: 3,
      count: 3000,
      rim: 0.24,
      trail: 0,
      span: 0.9,
      hue: 190,
      seed: 1729,
    },
  },
  {
    label: "one jet",
    hint: "A single boil with quiet water around it, so the radiating is the whole picture.",
    settings: {
      jets: 1,
      layout: "ring",
      spin: "same",
      look: "disc",
      spread: 0,
      core: 0.06,
      outflow: 0.5,
      swirl: 0.16,
      rate: 300,
      pulse: 0.24,
      birthMin: 0.002,
      birthMax: 0.008,
      churn: 0.3,
      scale: 0.2,
      drift: 0.3,
      ebb: 0.76,
      wave: 0.4,
      waveHz: 1.1,
      lag: 0.3,
      pack: 0.9,
      merge: 0.56,
      bounce: 0.46,
      dissolve: 0.0005,
      popSize: 0.03,
      popRate: 1.4,
      spray: 3,
      count: 2600,
      rim: 0.24,
      trail: 0,
      span: 0.7,
      hue: 190,
      seed: 1729,
    },
  },
  {
    label: "rolling boil",
    hint: "Eight jets going hard in broken water. Nothing gets far before something hits it.",
    settings: {
      jets: 8,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.42,
      core: 0.04,
      outflow: 0.76,
      swirl: 0.5,
      rate: 700,
      pulse: 0.18,
      birthMin: 0.002,
      birthMax: 0.007,
      churn: 1.1,
      scale: 0.14,
      drift: 0.9,
      ebb: 0.46,
      wave: 0.6,
      waveHz: 2.2,
      lag: 0.22,
      pack: 0.86,
      merge: 0.4,
      bounce: 0.62,
      dissolve: 0.001,
      popSize: 0.028,
      popRate: 2.6,
      spray: 4,
      count: 6000,
      rim: 0.2,
      trail: 0,
      span: 1,
      hue: 198,
      seed: 4021,
    },
  },
  {
    label: "slick",
    hint: "Little gas and almost certain coalescing, so a few big circles drift and burst.",
    settings: {
      jets: 3,
      layout: "scatter",
      spin: "loose",
      look: "mixed",
      spread: 0.3,
      core: 0.1,
      outflow: 0.22,
      swirl: 0.16,
      rate: 40,
      pulse: 0.4,
      birthMin: 0.006,
      birthMax: 0.018,
      churn: 0.3,
      scale: 0.4,
      drift: 0.2,
      ebb: 0.5,
      wave: 0.16,
      waveHz: 0.55,
      lag: 0.62,
      pack: 1.1,
      merge: 0.96,
      bounce: 0.3,
      dissolve: 0.0005,
      popSize: 0.09,
      popRate: 0.7,
      spray: 6,
      count: 800,
      rim: 0.22,
      trail: 0,
      span: 0.9,
      hue: 184,
      seed: 3301,
    },
  },
  {
    label: "shear",
    hint: "Two jets turning the same way, with the water between them torn along one line.",
    settings: {
      jets: 2,
      layout: "row",
      spin: "same",
      look: "disc",
      spread: 0.22,
      core: 0.05,
      outflow: 0.4,
      swirl: 0.86,
      rate: 320,
      pulse: 0.16,
      birthMin: 0.003,
      birthMax: 0.008,
      churn: 0.28,
      scale: 0.3,
      drift: 0.18,
      ebb: 0.7,
      wave: 0.24,
      waveHz: 1.6,
      lag: 0.4,
      pack: 0.9,
      merge: 0.62,
      bounce: 0.58,
      dissolve: 0.0005,
      popSize: 0.04,
      popRate: 1.5,
      spray: 3,
      count: 3400,
      rim: 0.24,
      trail: 0,
      span: 0.8,
      hue: 206,
      seed: 911,
    },
  },
  {
    label: "standing still",
    hint: "The background flow frozen and the jets turned down, so the eddies are a fixed pattern the foam runs through.",
    settings: {
      jets: 5,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.36,
      core: 0.07,
      outflow: 0.3,
      swirl: 0.1,
      rate: 240,
      pulse: 0,
      birthMin: 0.003,
      birthMax: 0.009,
      churn: 1.3,
      scale: 0.16,
      drift: 0,
      ebb: 0.5,
      wave: 0.14,
      waveHz: 0.75,
      lag: 0.26,
      pack: 0.94,
      merge: 0.5,
      bounce: 0.52,
      dissolve: 0.001,
      popSize: 0.036,
      popRate: 1.8,
      spray: 2,
      count: 4000,
      rim: 0.24,
      trail: 0,
      span: 0.9,
      hue: 172,
      seed: 6180,
    },
  },
  {
    label: "meniscus",
    hint: "Drawn as rings rather than discs, with few enough large bubbles for a ring to read. This is closer to what foam on a real surface looks like from above.",
    settings: {
      jets: 3,
      layout: "ring",
      spin: "alternate",
      look: "ring",
      spread: 0.22,
      core: 0.08,
      outflow: 0.3,
      swirl: 0.2,
      rate: 60,
      pulse: 0.24,
      birthMin: 0.008,
      birthMax: 0.022,
      churn: 0.34,
      scale: 0.3,
      drift: 0.24,
      ebb: 0.4,
      wave: 0.2,
      waveHz: 0.8,
      lag: 0.5,
      pack: 1.06,
      merge: 0.86,
      bounce: 0.42,
      dissolve: 0.0005,
      popSize: 0.08,
      popRate: 0.6,
      spray: 5,
      count: 900,
      rim: 0.2,
      trail: 0,
      span: 0.7,
      hue: 196,
      seed: 2718,
    },
  },
  {
    label: "surging",
    hint: "The jets surging hard on their own clocks, so the tub never reaches a steady state and stays there.",
    settings: {
      jets: 4,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.3,
      core: 0.06,
      outflow: 0.6,
      swirl: 0.28,
      rate: 520,
      pulse: 0.9,
      birthMin: 0.003,
      birthMax: 0.01,
      churn: 0.5,
      scale: 0.28,
      drift: 0.5,
      ebb: 0.6,
      wave: 0.36,
      waveHz: 1.6,
      lag: 0.34,
      pack: 0.92,
      merge: 0.58,
      bounce: 0.54,
      dissolve: 0.001,
      popSize: 0.036,
      popRate: 1.8,
      spray: 3,
      count: 5000,
      rim: 0.24,
      trail: 0,
      span: 0.9,
      hue: 186,
      seed: 1597,
    },
  },
]

/**
 * The numeric shape of every setting a slider owns: its bounds and its grid.
 *
 * **Written out rather than derived from `CONTROLS`, and that is the point.**
 * A computation over `CONTROLS` at module scope makes the whole control list —
 * labels, hints, `format` closures — reachable from `normalizeSettings`, and
 * therefore from a runner, which draws none of it. That was 28% of
 * starry-night's bundle. `tests/unit/experiments-grid.test.ts` fails if any
 * track here differs from the control it describes.
 */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  jets: { min: 1, max: 8, step: 1 },
  spread: { min: 0, max: 0.9, step: 0.01 },
  core: { min: 0.02, max: 0.5, step: 0.01 },
  outflow: { min: 0, max: 3, step: 0.02 },
  swirl: { min: 0, max: 1.5, step: 0.02 },
  rate: { min: 2, max: 1500, step: 1, scale: "log" },
  pulse: { min: 0, max: 1, step: 0.02 },
  birthMin: { min: 0.002, max: 0.04, step: 0.001, scale: "log" },
  birthMax: { min: 0.002, max: 0.04, step: 0.001, scale: "log" },
  churn: { min: 0, max: 2, step: 0.02 },
  scale: { min: 0.05, max: 1.2, step: 0.01, scale: "log" },
  drift: { min: 0, max: 1.5, step: 0.02 },
  ebb: { min: 0, max: 1.5, step: 0.02 },
  wave: { min: 0, max: 1.5, step: 0.02 },
  waveHz: { min: 0.1, max: 4, step: 0.05 },
  lag: { min: 0, max: 1, step: 0.02 },
  pack: { min: 0.5, max: 1.3, step: 0.02 },
  merge: { min: 0, max: 1, step: 0.02 },
  bounce: { min: 0, max: 1, step: 0.02 },
  dissolve: { min: 0, max: 0.02, step: 0.0005 },
  popSize: { min: 0.01, max: 0.14, step: 0.002 },
  popRate: { min: 0, max: 5, step: 0.05 },
  spray: { min: 0, max: 8, step: 1 },
  count: { min: 200, max: 6000, step: 50, scale: "log" },
  rim: { min: 0.08, max: 0.6, step: 0.02 },
  trail: { min: 0, max: 0.95, step: 0.05 },
  span: { min: 0.3, max: 4, step: 0.05 },
  hue: { min: 0, max: 360, step: 1 },
  seed: { min: 1, max: 9999, step: 1 },
}

/** Bounds for every numeric setting, narrowed from `TRACKS` rather than declared twice. */
export const BOUNDS: Record<NumericKey, { min: number; max: number }> = Object.fromEntries(
  Object.entries(TRACKS).map(([key, track]) => [key, { min: track!.min, max: track!.max }]),
) as Record<NumericKey, { min: number; max: number }>

/**
 * Settings stored finer than their control's step.
 *
 * Nothing needs it yet. The hook is here because the three pieces that do need
 * it all discovered so after recording a scene, and adding the table later
 * means re-recording the scene instead.
 */
const FINER_GRID: Partial<Record<NumericKey, number>> = {}

/** The spacing one setting is stored on, or 0 for a key with no track. */
export function gridFor(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? gridAt(track, value, FINER_GRID[key]) : 0
}

/** Snaps one setting, leaving alone any key with no track. */
function snap(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? snapToGrid(track, value, FINER_GRID[key]) : value
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API, a dragged handle — passes through here, so bounds and the grid live in
 * one place and no two routes can disagree about what is valid.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = {
    ...merged,
    layout: isLayout(merged.layout) ? merged.layout : base.layout,
    spin: isSpin(merged.spin) ? merged.spin : base.spin,
    look: isLook(merged.look) ? merged.look : base.look,
  }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }

  // A birth size band that came in reversed would have every bubble born at a
  // negative width of radius, which is a silent nothing rather than a visible
  // fault. `reconcile` is what handles it when a handle is being dragged.
  if (settings.birthMin > settings.birthMax) {
    settings.birthMax = settings.birthMin
  }

  return settings
}

/**
 * Keeps the birth band in order, moving whichever end is not being dragged.
 *
 * `normalizeSettings` can only push the top up, which fights someone dragging
 * the top down. Here the changed key is known, so the other end gives way.
 */
export function reconcile(next: Settings, changed: keyof Settings): Settings {
  if (changed === "birthMin" && next.birthMin > next.birthMax) {
    return { ...next, birthMax: next.birthMin }
  }
  if (changed === "birthMax" && next.birthMax < next.birthMin) {
    return { ...next, birthMin: next.birthMax }
  }
  return next
}

/**
 * **The address registry: append-only, and immutable slot by slot.**
 *
 * Read `@/experiments/address` before touching this. Adding a setting is an
 * append and nothing else. Changing a slot's `grid`, `origin`, `bits` or
 * options — or changing what a value *means* while its numbers stay put — means
 * retiring the slot where it stands and appending a new one with the same key.
 * `tests/unit/experiments-address.test.ts` snapshots this, so an edit that is
 * not an append fails rather than being noticed later by nobody.
 *
 * The grids below are each track's `step`. Every log track here has a `step`
 * coarser than three significant figures across its whole range, so `gridAt`
 * never returns anything finer and the fixed grid is exact.
 */
export const REGISTRY: readonly Slot[] = [
  { key: "jets", kind: "num", grid: 1, origin: 1, bits: 3 },
  { key: "layout", kind: "enum", options: ["ring", "row", "scatter"] },
  { key: "spin", kind: "enum", options: ["alternate", "same", "loose"] },
  { key: "spread", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "core", kind: "num", grid: 0.01, origin: 0.02, bits: 6 },
  { key: "outflow", kind: "num", grid: 0.02, origin: 0, bits: 8 },
  { key: "swirl", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "rate", kind: "num", grid: 1, origin: 2, bits: 9, retired: true },
  { key: "birthMin", kind: "num", grid: 0.001, origin: 0.002, bits: 6 },
  { key: "birthMax", kind: "num", grid: 0.001, origin: 0.002, bits: 6 },
  { key: "churn", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "scale", kind: "num", grid: 0.01, origin: 0.05, bits: 7 },
  { key: "drift", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "ebb", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "wave", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "waveHz", kind: "num", grid: 0.05, origin: 0.1, bits: 7 },
  { key: "lag", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "merge", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "bounce", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "dissolve", kind: "num", grid: 0.0005, origin: 0, bits: 6 },
  { key: "popSize", kind: "num", grid: 0.002, origin: 0.01, bits: 7 },
  { key: "popRate", kind: "num", grid: 0.05, origin: 0, bits: 7 },
  { key: "spray", kind: "num", grid: 1, origin: 0, bits: 4 },
  { key: "count", kind: "num", grid: 50, origin: 200, bits: 7 },
  { key: "trail", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "span", kind: "num", grid: 0.05, origin: 0.3, bits: 7 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "seed", kind: "num", grid: 1, origin: 1, bits: 14 },
  // Appended after the first build. The slot above with the same key is retired
  // rather than widened: its `bits` are what an address already written means by
  // those bits, and 9 of them cannot reach past 513 bubbles a second. Later
  // slots win, so an address carrying both ends up with this one's value.
  { key: "rate", kind: "num", grid: 1, origin: 2, bits: 11 },
  { key: "pulse", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "pack", kind: "num", grid: 0.02, origin: 0.5, bits: 6 },
  { key: "look", kind: "enum", options: ["disc", "ring", "mixed"] },
  { key: "rim", kind: "num", grid: 0.02, origin: 0.08, bits: 5 },
]

/**
 * The address that carries this scene, packed.
 *
 * Opaque on purpose — `../docs/adr/20260906-an-address-is-packed-not-readable.md`.
 * It states every setting rather than the differences from a baseline, because a
 * link resting on a default is a link whose scene changes the day the default
 * does.
 */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  params.set("s", encodeScene(REGISTRY, settings))
  return params
}

/**
 * Reads settings from a query string, in either form.
 *
 * The packed parameter wins when it is there and readable; a corrupt one
 * degrades to the named-parameter reader and then to the defaults rather than
 * throwing in a page's first statement. The named form is read forever and is
 * never written again.
 */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const packed = params.get("s")
  if (packed !== null && packed !== "") {
    const scene = decodeScene(REGISTRY, packed)
    if (scene) return normalizeSettings(scene as Partial<Settings>)
  }
  return settingsFromNamedQuery(params)
}

/**
 * Reads settings from named parameters.
 *
 * Absent, blank and unparseable are all skipped so the default survives —
 * `Number(null)` is 0 and 0 is a legal value for most of these, which is how a
 * missing parameter once turned a setting off across a whole piece.
 */
function settingsFromNamedQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}

  const layout = params.get("layout")
  if (isLayout(layout)) patch.layout = layout

  const spin = params.get("spin")
  if (isSpin(spin)) patch.spin = spin

  const look = params.get("look")
  if (isLook(look)) patch.look = look

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }

  return normalizeSettings(patch)
}

/** Whether a query string names any setting at all. */
function namesASetting(params: URLSearchParams): boolean {
  const packed = params.get("s")
  if (packed !== null && packed !== "" && decodeScene(REGISTRY, packed)) return true
  if (isLayout(params.get("layout"))) return true
  if (isSpin(params.get("spin"))) return true
  if (isLook(params.get("look"))) return true
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * The scene a freshly-opened URL should show.
 *
 * `featured` says the caller should rewrite the address, so a landing visitor
 * leaves with a link to *this* water rather than one standing for "whatever is
 * featured next month".
 */
export function settingsForLanding(params: URLSearchParams): { settings: Settings; featured: boolean } {
  if (namesASetting(params)) return { settings: settingsFromQuery(params), featured: false }
  return { settings: normalizeSettings(PRESETS[0]!.settings), featured: true }
}

/** The address that restores exactly these settings. */
export function urlForSettings(settings: Settings, pathname: string): string {
  const query = settingsToQuery(settings).toString()
  return `${pathname}${query ? `?${query}` : ""}`
}

/** Settings that change how many bubbles the pool must hold. */
export function needsPool(before: Settings, after: Settings): boolean {
  return before.count !== after.count
}
