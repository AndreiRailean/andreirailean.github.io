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
  /** How far under the surface the jets are, in metres. */
  depth: number
  /** How far the rising gas fans out, per metre of depth. */
  plume: number
  /** Radius of a jet's mouth, in metres. The outflow peaks here. */
  core: number
  /** Peak surface speed of a jet's upwelling, in m/s. */
  outflow: number
  /** Peak tangential speed of the twist a jet puts on the water, in m/s. */
  swirl: number
  /** Gas a jet releases per second, as square centimetres of surface. */
  gas: number
  /** How hard each jet surges on its own slow clock. 0 runs them steady. */
  pulse: number
  /** Smallest radius a bubble is born at, in metres. */
  birthMin: number
  /** Largest radius a bubble is born at, in metres. */
  birthMax: number
  /** Largest a bubble stays whole in still water, in metres. */
  stable: number
  /** How much a worked patch of water shrinks that limit. */
  shatter: number
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
  /** How strongly touching bubbles hold onto each other and travel as one. */
  cling: number
  /** How readily two touching bubbles become one. */
  merge: number
  /** How hard two touching bubbles that did not merge push apart. */
  bounce: number
  /** How long a small bubble's film lasts, in seconds. */
  life: number
  /** How much shorter a large bubble's film life is than a small one's. */
  fragile: number
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
  /** How fast the water runs, against real time. */
  playback: number
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
    key: "depth",
    label: "depth",
    group: "jets",
    min: 0.1,
    max: 4,
    step: 0.05,
    scale: "log",
    format: (v) => `${v.toFixed(2)}m`,
    hint: "How far under the surface the jets are. This is the control that decides how violent the surface is, and it does two things at once, both of them consequences of the jets being at the bottom rather than on top. Gas rising through deeper water fans out further, so bubbles arrive spread over a wider circle. And the upwelling spreads its push over that whole depth before it reaches the surface, so the surface current from a jet falls away roughly as one over the depth. Deep water and a jet that is not industrial gives you bubbles appearing gently and almost all of the motion coming from the swirl and the waver.",
  },
  {
    kind: "slider",
    key: "plume",
    label: "fan",
    group: "jets",
    min: 0.02,
    max: 0.7,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How wide the rising gas fans out, per metre of depth. A bubble plume entrains water as it climbs and spreads roughly in proportion to how far it has come, so this and depth together decide the circle bubbles appear in. It has nothing to do with how they move afterwards.",
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
    label: "jet power",
    group: "jets",
    min: 0,
    max: 3,
    step: 0.02,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "How hard a jet drives the water, measured at its mouth on the bottom. What reaches the surface is much less than this — the upwelling spreads out over the whole depth on the way up — so raising depth quietly turns this down, which is the point of it. At 0 the jets still deliver gas and nothing carries it away, so the foam piles up over each jet and coarsens where it arrived.",
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
    key: "gas",
    label: "gas",
    group: "jets",
    min: 2,
    max: 4000,
    step: 1,
    scale: "log",
    format: (v) => `${Math.round(v)}cm²/s`,
    hint: "How much gas a jet delivers each second, measured as the surface a second's worth of bubbles covers. It is a quantity of gas rather than a count of bubbles, which is what a jet actually delivers — so making the bubbles smaller gives you proportionally more of them and the foam stays as thick. That matters: when this was a count, halving the born size quartered the coverage and coalescence stopped, so small bubbles could never grow into big ones. The cap on how many can be alive at once is under picture, and when the two fight the cap wins.",
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
    label: "born size",
    group: "jets",
    min: 0.0005,
    max: 0.014,
    step: 0.0005,
    scale: "log",
    format: (from, to) => `${(from * 1000).toFixed(1)}–${(to * 1000).toFixed(1)}mm`,
    hint: "How big a bubble is when it reaches the surface, from the smallest to the largest. The top of this band is low on purpose: a big pocket of air rising through water does not arrive as one bubble, it is torn apart on the way, so a bubble has a natural ceiling at birth however much gas is behind it. Everything larger you see was assembled at the surface out of smaller ones. Gas is a quantity rather than a count, so narrowing this band does not thin the foam out; it gives you more, smaller bubbles covering the same water.",
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
    key: "stable",
    label: "holds at",
    group: "foam",
    min: 0.002,
    max: 0.06,
    step: 0.001,
    format: (v) => `${(v * 1000).toFixed(0)}mm`,
    hint: "The largest a bubble stays whole in still water. Past it the film cannot hold its own shape and the bubble tears into two, which is not the same as bursting — the gas stays, it is just carried by more bubbles. Soapy water holds a much bigger bubble together than clean water does, so this is roughly a measure of how soapy the tub is.",
  },
  {
    kind: "slider",
    key: "shatter",
    label: "torn by",
    group: "foam",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How much a worked patch of water lowers that limit. This is why big bubbles do not live over a jet: the boil is the most violent water in the tub, so the size a bubble can hold together there is a fraction of what it is out in the calm. Turn it up and the emergence area produces nothing but fine foam, which then drifts out and assembles into the big ones somewhere quieter. At 0 a bubble can be any size anywhere, and the biggest ones end up exactly where they were born.",
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
    key: "cling",
    label: "cling",
    group: "foam",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How strongly bubbles that are touching hold onto each other. Foam is bound by shared walls, so a raft of it travels as a unit and neighbours keep their places in it — this is what makes a crowd behave that way rather than as a set of separate circles that happen to be near each other. It also draws two bubbles together when they are close but not yet touching, which is the same surface effect that makes cereal clump in a bowl. At 0 they only ever join or shove, and slide freely through each other in between.",
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
    hint: "How rigidly two bubbles that have not merged refuse to occupy the same water. Near 1 they rest against each other the way bubbles on a surface do; turn it down and they pass through one another, which a solid disc hides and an outline does not. It works with cling rather than against it: this one keeps them out of each other, cling keeps them together.",
  },
  {
    kind: "slider",
    key: "life",
    label: "lasts",
    group: "foam",
    min: 2,
    max: 300,
    step: 1,
    scale: "log",
    format: (v) => (v >= 60 ? `${(v / 60).toFixed(1)}min` : `${Math.round(v)}s`),
    hint: "How long a small bubble's film holds before it has drained away. It is a time rather than a rate, which matters: a bubble loses a share of itself per second rather than a fixed thickness, so a small one shrinks slowly and lingers while a big one is going quickly. It used to be a rate in millimetres a second, and that had it backwards — a big bubble simply had more radius to lose, so it outlasted the small ones it was supposed to outlive.",
  },
  {
    kind: "slider",
    key: "fragile",
    label: "fragile",
    group: "foam",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How much shorter a large bubble's film life is than a small one's. A wide film held up against gravity thins quicker, so at any value above 0 growth has a cost and the foam settles at a size where coalescing and draining balance instead of running away. At 0 every bubble gets the same film life whatever its size, so the small ones still linger longest in absolute terms — they just have less to lose.",
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
    max: 20000,
    step: 100,
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
    min: 0.02,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How thick a ring's wall is, as a fraction of its radius. Down at 0.03 it is a hairline and the foam reads as outlines; at 0.5 a ring is a filled disc with a pinhole. Does nothing while bubbles are drawn as discs.",
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
    key: "playback",
    label: "speed",
    group: "picture",
    min: 0.05,
    max: 2,
    step: 0.01,
    scale: "log",
    format: (v) => `${v.toFixed(2)}x`,
    hint: "How fast the water runs against real time. Depth is the honest way to calm the surface, because it changes what the jets actually do; this changes nothing about the water and only watches it more slowly. Both are worth having — one is the tub, the other is the camera.",
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
    hint: "Which arrangement of jets you get, which way each one turns when spin is loose, and which set of eddies the background flow is made of. It does not freeze anything: the eddies still move on their own clock whatever this says, and unsettled is what decides how fast. Reroll gives you a new one.",
  },
]

/**
 * The baseline, which is what an address naming nothing fills its gaps from.
 *
 * Not a scene: a bare visit lands on the primary preset, not here. See
 * `settingsForLanding`.
 */
export const DEFAULT_SETTINGS: Settings = {
  jets: 3,
  layout: "ring",
  spin: "alternate",
  look: "disc",
  spread: 0.26,
  depth: 1.4,
  plume: 0.1,
  core: 0.05,
  outflow: 0.24,
  swirl: 0.26,
  gas: 60,
  pulse: 0.24,
  birthMin: 0.002,
  birthMax: 0.006,
  stable: 0.04,
  shatter: 0.86,
  churn: 0.08,
  scale: 0.35,
  drift: 0.3,
  ebb: 0.2,
  wave: 0.06,
  waveHz: 0.35,
  lag: 0.5,
  pack: 1.12,
  cling: 0.6,
  merge: 0.98,
  bounce: 0.8,
  life: 35,
  fragile: 1,
  popSize: 0.05,
  popRate: 1.2,
  spray: 4,
  count: 8000,
  rim: 0.06,
  playback: 1,
  trail: 0,
  span: 0.85,
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
    label: "deep water",
    hint: "Jets a metre and a half down. Gas arrives as fine foam, is torn apart again over each boil, and only assembles into big circles out in the calm. The starting point.",
    settings: {
      jets: 3,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.26,
      depth: 1.4,
      plume: 0.1,
      core: 0.05,
      outflow: 0.24,
      swirl: 0.26,
      gas: 60,
      pulse: 0.24,
      birthMin: 0.002,
      birthMax: 0.006,
      stable: 0.04,
      shatter: 0.86,
      churn: 0.08,
      scale: 0.35,
      drift: 0.3,
      ebb: 0.2,
      wave: 0.06,
      waveHz: 0.35,
      lag: 0.5,
      pack: 1.12,
      cling: 0.6,
      merge: 0.98,
      bounce: 0.8,
      life: 35,
      fragile: 1,
      popSize: 0.05,
      popRate: 1.2,
      spray: 4,
      count: 8000,
      rim: 0.06,
      playback: 1,
      trail: 0,
      span: 0.85,
      hue: 190,
      seed: 1729,
    },
  },
  {
    label: "shallow",
    hint: "The same tub with the jets just under the surface. Depth is the only setting that differs, so what it does can be moved rather than described.",
    settings: {
      jets: 3,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.26,
      depth: 0.15,
      plume: 0.1,
      core: 0.05,
      outflow: 0.24,
      swirl: 0.26,
      gas: 60,
      pulse: 0.24,
      birthMin: 0.002,
      birthMax: 0.006,
      stable: 0.04,
      shatter: 0.86,
      churn: 0.08,
      scale: 0.35,
      drift: 0.3,
      ebb: 0.2,
      wave: 0.06,
      waveHz: 0.35,
      lag: 0.5,
      pack: 1.12,
      cling: 0.6,
      merge: 0.98,
      bounce: 0.8,
      life: 35,
      fragile: 1,
      popSize: 0.05,
      popRate: 1.2,
      spray: 4,
      count: 8000,
      rim: 0.06,
      playback: 1,
      trail: 0,
      span: 0.85,
      hue: 190,
      seed: 1729,
    },
  },
  {
    label: "slow water",
    hint: "Deeper still and watched at a third speed, so one bubble can be followed from where it arrives to where it goes.",
    settings: {
      jets: 3,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.26,
      depth: 2.2,
      plume: 0.1,
      core: 0.05,
      outflow: 0.24,
      swirl: 0.26,
      gas: 45,
      pulse: 0.24,
      birthMin: 0.002,
      birthMax: 0.006,
      stable: 0.04,
      shatter: 0.86,
      churn: 0.06,
      scale: 0.35,
      drift: 0.3,
      ebb: 0.2,
      wave: 0.04,
      waveHz: 0.35,
      lag: 0.5,
      pack: 1.12,
      cling: 0.66,
      merge: 0.98,
      bounce: 0.8,
      life: 35,
      fragile: 1,
      popSize: 0.05,
      popRate: 1.2,
      spray: 4,
      count: 8000,
      rim: 0.06,
      playback: 0.3,
      trail: 0,
      span: 0.85,
      hue: 190,
      seed: 2027,
    },
  },
  {
    label: "one jet",
    hint: "A single plume with quiet water around it, so where the gas arrives and where it then goes are plainly two different things.",
    settings: {
      jets: 1,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0,
      depth: 1.2,
      plume: 0.12,
      core: 0.06,
      outflow: 0.3,
      swirl: 0.26,
      gas: 110,
      pulse: 0.24,
      birthMin: 0.002,
      birthMax: 0.006,
      stable: 0.04,
      shatter: 0.86,
      churn: 0.1,
      scale: 0.4,
      drift: 0.26,
      ebb: 0.24,
      wave: 0.06,
      waveHz: 0.35,
      lag: 0.5,
      pack: 1.12,
      cling: 0.6,
      merge: 0.98,
      bounce: 0.8,
      life: 35,
      fragile: 1,
      popSize: 0.05,
      popRate: 1.2,
      spray: 4,
      count: 8000,
      rim: 0.06,
      playback: 1,
      trail: 0,
      span: 0.7,
      hue: 190,
      seed: 1729,
    },
  },
  {
    label: "rolling boil",
    hint: "Shallow water and jets that are frankly industrial. Nothing holds together over a boil this hard, so the whole surface is fine foam.",
    settings: {
      jets: 6,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.3,
      depth: 0.2,
      plume: 0.08,
      core: 0.04,
      outflow: 1.4,
      swirl: 0.6,
      gas: 70,
      pulse: 0.18,
      birthMin: 0.002,
      birthMax: 0.005,
      stable: 0.03,
      shatter: 0.4,
      churn: 0.5,
      scale: 0.18,
      drift: 0.8,
      ebb: 0.4,
      wave: 0.4,
      waveHz: 1.8,
      lag: 0.24,
      pack: 0.94,
      cling: 0.4,
      merge: 0.9,
      bounce: 0.7,
      life: 25,
      fragile: 1,
      popSize: 0.03,
      popRate: 2.4,
      spray: 4,
      count: 9000,
      rim: 0.06,
      playback: 1,
      trail: 0,
      span: 1,
      hue: 198,
      seed: 4021,
    },
  },
  {
    label: "slick",
    hint: "Soapy water: little gas, films that hold a big bubble together, and almost certain coalescing. A few large circles drift and burst.",
    settings: {
      jets: 3,
      layout: "scatter",
      spin: "loose",
      look: "mixed",
      spread: 0.24,
      depth: 1.8,
      plume: 0.14,
      core: 0.08,
      outflow: 0.3,
      swirl: 0.16,
      gas: 44,
      pulse: 0.4,
      birthMin: 0.003,
      birthMax: 0.008,
      stable: 0.06,
      shatter: 0.26,
      churn: 0.06,
      scale: 0.46,
      drift: 0.18,
      ebb: 0.24,
      wave: 0.04,
      waveHz: 0.25,
      lag: 0.66,
      pack: 1.16,
      cling: 0.8,
      merge: 0.98,
      bounce: 0.86,
      life: 220,
      fragile: 0.9,
      popSize: 0.07,
      popRate: 0.9,
      spray: 6,
      count: 3000,
      rim: 0.04,
      playback: 1,
      trail: 0,
      span: 0.8,
      hue: 184,
      seed: 3301,
    },
  },
  {
    label: "meniscus",
    hint: "Drawn as hairline rings rather than discs, in soapy water with few enough large bubbles for a ring to read.",
    settings: {
      jets: 3,
      layout: "ring",
      spin: "alternate",
      look: "ring",
      spread: 0.22,
      depth: 1.6,
      plume: 0.14,
      core: 0.07,
      outflow: 0.28,
      swirl: 0.2,
      gas: 60,
      pulse: 0.24,
      birthMin: 0.003,
      birthMax: 0.009,
      stable: 0.06,
      shatter: 0.3,
      churn: 0.06,
      scale: 0.4,
      drift: 0.2,
      ebb: 0.22,
      wave: 0.04,
      waveHz: 0.3,
      lag: 0.56,
      pack: 1.14,
      cling: 0.82,
      merge: 0.98,
      bounce: 0.86,
      life: 240,
      fragile: 0.9,
      popSize: 0.07,
      popRate: 0.8,
      spray: 5,
      count: 3000,
      rim: 0.03,
      playback: 1,
      trail: 0,
      span: 0.75,
      hue: 196,
      seed: 2718,
    },
  },
  {
    label: "shear",
    hint: "Two jets turning the same way in shallow water, with the surface between them torn along one line.",
    settings: {
      jets: 2,
      layout: "row",
      spin: "same",
      look: "disc",
      spread: 0.18,
      depth: 0.3,
      plume: 0.1,
      core: 0.05,
      outflow: 0.8,
      swirl: 1.2,
      gas: 40,
      pulse: 0.16,
      birthMin: 0.002,
      birthMax: 0.005,
      stable: 0.03,
      shatter: 0.46,
      churn: 0.12,
      scale: 0.32,
      drift: 0.18,
      ebb: 0.5,
      wave: 0.14,
      waveHz: 1.2,
      lag: 0.4,
      pack: 1.02,
      cling: 0.44,
      merge: 0.94,
      bounce: 0.7,
      life: 32,
      fragile: 1,
      popSize: 0.04,
      popRate: 1.5,
      spray: 3,
      count: 6000,
      rim: 0.06,
      playback: 1,
      trail: 0,
      span: 0.8,
      hue: 206,
      seed: 911,
    },
  },
  {
    label: "standing still",
    hint: "The background flow frozen and the jets deep, so the eddies are a fixed pattern the foam runs through.",
    settings: {
      jets: 4,
      layout: "ring",
      spin: "alternate",
      look: "disc",
      spread: 0.26,
      depth: 1.8,
      plume: 0.12,
      core: 0.07,
      outflow: 0.26,
      swirl: 0.1,
      gas: 55,
      pulse: 0,
      birthMin: 0.002,
      birthMax: 0.006,
      stable: 0.04,
      shatter: 0.8,
      churn: 0.2,
      scale: 0.22,
      drift: 0,
      ebb: 0.16,
      wave: 0.04,
      waveHz: 0.3,
      lag: 0.3,
      pack: 1.1,
      cling: 0.62,
      merge: 0.96,
      bounce: 0.8,
      life: 45,
      fragile: 1,
      popSize: 0.046,
      popRate: 1.6,
      spray: 2,
      count: 9000,
      rim: 0.06,
      playback: 1,
      trail: 0,
      span: 0.9,
      hue: 172,
      seed: 6180,
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
      spread: 0.24,
      depth: 0.8,
      plume: 0.1,
      core: 0.06,
      outflow: 0.5,
      swirl: 0.3,
      gas: 32,
      pulse: 0.9,
      birthMin: 0.002,
      birthMax: 0.005,
      stable: 0.03,
      shatter: 0.9,
      churn: 0.16,
      scale: 0.3,
      drift: 0.46,
      ebb: 0.3,
      wave: 0.16,
      waveHz: 0.9,
      lag: 0.34,
      pack: 1.04,
      cling: 0.5,
      merge: 0.94,
      bounce: 0.74,
      life: 32,
      fragile: 1,
      popSize: 0.04,
      popRate: 1.8,
      spray: 3,
      count: 6000,
      rim: 0.06,
      playback: 1,
      trail: 0,
      span: 0.8,
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
  depth: { min: 0.1, max: 4, step: 0.05, scale: "log" },
  plume: { min: 0.02, max: 0.7, step: 0.01 },
  core: { min: 0.02, max: 0.5, step: 0.01 },
  outflow: { min: 0, max: 3, step: 0.02 },
  swirl: { min: 0, max: 1.5, step: 0.02 },
  gas: { min: 2, max: 4000, step: 1, scale: "log" },
  pulse: { min: 0, max: 1, step: 0.02 },
  birthMin: { min: 0.0005, max: 0.014, step: 0.0005, scale: "log" },
  birthMax: { min: 0.0005, max: 0.014, step: 0.0005, scale: "log" },
  churn: { min: 0, max: 2, step: 0.02 },
  scale: { min: 0.05, max: 1.2, step: 0.01, scale: "log" },
  drift: { min: 0, max: 1.5, step: 0.02 },
  ebb: { min: 0, max: 1.5, step: 0.02 },
  wave: { min: 0, max: 1.5, step: 0.02 },
  waveHz: { min: 0.1, max: 4, step: 0.05 },
  lag: { min: 0, max: 1, step: 0.02 },
  stable: { min: 0.002, max: 0.06, step: 0.001 },
  shatter: { min: 0, max: 1, step: 0.02 },
  pack: { min: 0.5, max: 1.3, step: 0.02 },
  cling: { min: 0, max: 1, step: 0.02 },
  merge: { min: 0, max: 1, step: 0.02 },
  bounce: { min: 0, max: 1, step: 0.02 },
  life: { min: 2, max: 300, step: 1, scale: "log" },
  fragile: { min: 0, max: 1, step: 0.02 },
  popSize: { min: 0.01, max: 0.14, step: 0.002 },
  popRate: { min: 0, max: 5, step: 0.05 },
  spray: { min: 0, max: 8, step: 1 },
  count: { min: 200, max: 20000, step: 100, scale: "log" },
  rim: { min: 0.02, max: 0.6, step: 0.01 },
  playback: { min: 0.05, max: 2, step: 0.01, scale: "log" },
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
  { key: "birthMin", kind: "num", grid: 0.001, origin: 0.002, bits: 6, retired: true },
  { key: "birthMax", kind: "num", grid: 0.001, origin: 0.002, bits: 6, retired: true },
  { key: "churn", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "scale", kind: "num", grid: 0.01, origin: 0.05, bits: 7 },
  { key: "drift", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "ebb", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "wave", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "waveHz", kind: "num", grid: 0.05, origin: 0.1, bits: 7 },
  { key: "lag", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "merge", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "bounce", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "dissolve", kind: "num", grid: 0.0005, origin: 0, bits: 6, retired: true },
  { key: "popSize", kind: "num", grid: 0.002, origin: 0.01, bits: 7 },
  { key: "popRate", kind: "num", grid: 0.05, origin: 0, bits: 7 },
  { key: "spray", kind: "num", grid: 1, origin: 0, bits: 4 },
  { key: "count", kind: "num", grid: 50, origin: 200, bits: 7, retired: true },
  { key: "trail", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "span", kind: "num", grid: 0.05, origin: 0.3, bits: 7 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "seed", kind: "num", grid: 1, origin: 1, bits: 14 },
  // Appended after the first build. The slot above with the same key is retired
  // rather than widened: its `bits` are what an address already written means by
  // those bits, and 9 of them cannot reach past 513 bubbles a second. Later
  // slots win, so an address carrying both ends up with this one's value.
  { key: "rate", kind: "num", grid: 1, origin: 2, bits: 11, retired: true },
  { key: "pulse", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "pack", kind: "num", grid: 0.02, origin: 0.5, bits: 6 },
  { key: "look", kind: "enum", options: ["disc", "ring", "mixed"] },
  { key: "rim", kind: "num", grid: 0.02, origin: 0.08, bits: 5, retired: true },
  // Appended after the first round of Andrei's feedback, which was a mechanism
  // correction rather than a tuning one: the jets are at the *bottom*, so their
  // gas decides where a bubble arrives and the surface current decides where it
  // then goes. Those were one field doing two jobs.
  //
  // `rate` is retired twice over — once for its width and now for its meaning.
  // It counted bubbles; `gas` measures gas, which is what a jet delivers, and
  // the numbers are not comparable. The rules say to retire on a meaning change
  // even when the numbers would survive, and this is the case they are for.
  { key: "depth", kind: "num", grid: 0.05, origin: 0.1, bits: 7 },
  { key: "plume", kind: "num", grid: 0.01, origin: 0.02, bits: 7 },
  { key: "gas", kind: "num", grid: 1, origin: 2, bits: 12 },
  { key: "fragile", kind: "num", grid: 0.02, origin: 0, bits: 6, retired: true },
  { key: "playback", kind: "num", grid: 0.01, origin: 0.05, bits: 8 },
  { key: "rim", kind: "num", grid: 0.01, origin: 0.02, bits: 6 },
  // Appended after the second round. The birth band's floor came down from 2mm
  // to half a millimetre and its ceiling from 40mm to 14mm, which the old slots
  // cannot express: their origin *is* 2mm. Retired where they stand and
  // reappended at the finer grid.
  //
  // The ceiling moved because a big pocket of air rising through water does not
  // arrive as one bubble. `stable` and `shatter` are the mechanism that makes
  // that true rather than declared, and they are why the biggest bubbles now
  // assemble out in the calm instead of over the jet that made them.
  { key: "birthMin", kind: "num", grid: 0.0005, origin: 0.0005, bits: 6 },
  { key: "birthMax", kind: "num", grid: 0.0005, origin: 0.0005, bits: 6 },
  { key: "stable", kind: "num", grid: 0.001, origin: 0.002, bits: 6 },
  { key: "shatter", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  // The pool's ceiling went from 6,000 to 20,000, which 7 bits at a 50 grid
  // cannot reach. It had to move because the birth band's ceiling came down:
  // finer bubbles cover the same water only if there are far more of them, and
  // a saturated pool stops coalescence dead — every slot is taken by a speck
  // that cannot be replaced by the bigger thing two of them would have made.
  { key: "count", kind: "num", grid: 100, origin: 200, bits: 8 },
  // `dissolve` was a radius loss in metres a second, and the scaling was
  // wrong in a way that inverted the control above it: a flat rate means a
  // big bubble has more to lose, so it outlasted the small ones `fragile`
  // was meant to outlive. Reported as "drain is scaled incorrectly — the
  // only interesting values are very close to zero".
  //
  // It is a film lifetime now, and a bubble loses a share of itself per
  // second rather than a thickness. `fragile` keeps its numbers and changes
  // what they mean — it divides a lifetime where it used to multiply a rate
  // — so it is retired too, which is the case the rules are explicit about.
  { key: "life", kind: "num", grid: 1, origin: 2, bits: 9 },
  { key: "cling", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "fragile", kind: "num", grid: 0.02, origin: 0, bits: 6 },
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
