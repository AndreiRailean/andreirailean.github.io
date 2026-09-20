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

/**
 * Everything about the walk that is tunable at runtime.
 *
 * The single source of truth shared by the simulation, the panel and the URL.
 *
 * **Anything not here is anatomy, and lives in `body.ts` with a measurement
 * behind it.** How wide a head is, how fast a leg swings, how far a head rises
 * on a step: a person who set those by hand would only be making their crowd
 * wrong. What is here is the shape of the crowd — how many, going where, and
 * what the person carrying the camera is doing about it.
 *
 * The one place the line is worth stating out loud is `eye`. It looks like
 * anatomy and it is not: it is *whose* walk this is, which is the piece's
 * subject, and the difference between 1.45 m and 1.90 m is a genuinely
 * different crowd to be in.
 */
export type Settings = {
  /** People per 100 m² of ground. */
  density: number
  /** How much the crowd follows one axis: 0 is a square, 1 is a corridor. */
  stream: number
  /** Of the people on that axis, the fraction walking toward me. */
  against: number
  /** Fraction of the crowd who arrived with somebody else. */
  grouping: number
  /** Fraction of the crowd under about twelve. */
  children: number
  /** Fraction who are not going anywhere — stopped at a stall, waiting, talking. */
  standing: number
  /** Slowest preferred walking speed among adults, m/s. */
  paceLow: number
  /** Fastest preferred walking speed among adults, m/s. */
  paceHigh: number
  /** Multiplier on how much room everybody keeps around themselves. */
  spacing: number
  /** How fast I walk, m/s. 0 is standing and watching. */
  walk: number
  /** How much of the time I stop to look around rather than walking on. */
  pausing: number
  /** How tall I am, in metres. What decides who is taller than me. */
  height: number
  /** How far above level I am looking, in degrees. Negative is down, which is where a walker looks. */
  pitch: number
  /** How many people are walking with me, talking. 0 is alone. */
  companions: number
  /** How much I turn my head, and how far. */
  looking: number
  /** Multiplier on what my own gait does to the frame. 1 is life-size. */
  bob: number
  /** Field of view across the shorter side of the window, in degrees. */
  fov: number
  /** Distance at which a head has faded to a third, in metres. */
  fade: number
  /** How far the crowd extends, in metres. Beyond it there is nobody. */
  reach: number
  /** How wide the corridor is, in metres. Wide enough, and it is open ground. */
  width: number
  /** Hue of the crowd, in degrees. */
  hue: number
  /** How much of that hue the heads actually carry. 0 is white. */
  tint: number
  /** Clock rate. Every time-dependent thing in the piece goes through it. */
  playback: number
  /** Decides who is out there, how tall they are and where they are going. */
  seed: number
}

export type NumericKey = keyof Settings

export type Control = KitControl<string & keyof Settings>

/** Numeric rows only — the ones with bounds to report and a track to drag. */
export type NumericControl = SliderControl<NumericKey> | RangeControl<NumericKey>

export const isNumericControl = (control: Control): control is NumericControl =>
  control.kind === "slider" || control.kind === "range"

/**
 * Headings, in panel order.
 *
 * **`me` is a group of its own and that is the piece's whole argument.** Every
 * other experiment in this section has settings about the work and settings
 * about the paint. This one has settings about the person the camera belongs
 * to — how tall they are, how fast they are going, whether they are looking
 * around — and filing those under `look` with the field of view would bury the
 * thing the piece is actually about.
 */
export const GROUPS = ["crowd", "people", "me", "look", "paint"] as const

export const CONTROLS: Control[] = [
  {
    kind: "slider",
    key: "density",
    label: "density",
    group: "crowd",
    min: 0.5,
    max: 100,
    step: 0.5,
    scale: "log",
    format: (v) => `${v.toFixed(1)}/100m²`,
    hint: "People per hundred square metres of ground. A quiet street is about 3, a market aisle 25, a busy square 50, a concourse at rush hour 70, a crush 100. Above about 40 people are visibly slowed by each other, and nothing in the piece tells them to be — it is what happens when there are more people to get past. Density is of the ground rather than of the frame, so widening the field of view brings more of them into shot rather than spreading these ones thinner. It is also what the frame costs: everything here is per person, and the top of this track is where a slow machine will say so.",
  },
  {
    kind: "slider",
    key: "stream",
    label: "stream",
    group: "crowd",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "How much of the crowd is following one axis rather than going its own way. At 0 this is a square: every heading is as likely as every other and nothing has a grain. At 1 it is a corridor and everyone is on the same line as me, one way or the other. The files form somewhere around 0.7 — opposing streams sort themselves into lanes within a few metres, and nothing in the code knows what a lane is.",
  },
  {
    kind: "slider",
    key: "against",
    label: "oncoming",
    group: "crowd",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Of the people on that axis, the fraction walking toward me rather than away. At 0 I am overtaking and being overtaken and never meeting anybody; at 1 the whole crowd is coming at me. Half is the interesting one, because it is the condition under which the two streams have to sort themselves out. It does nothing at all when stream is 0, which is correct rather than a gap: a crowd with no axis has no direction to be against.",
  },
  {
    kind: "slider",
    key: "grouping",
    label: "together",
    group: "crowd",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "How much of the crowd is with somebody. Observed crowds run around 0.7. Pairs and threes walk abreast, four and more bend into a shallow arc, and both flatten when it gets tight because a wide group cannot get through a gap. From in here a group is legible before you have counted it: the heads hold their spacing while everything around them changes.",
  },
  {
    kind: "slider",
    key: "children",
    label: "children",
    group: "crowd",
    min: 0,
    max: 0.5,
    step: 0.02,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Fraction of the crowd under about twelve. A child's head is only an eighth smaller than an adult's, which is why they are nearly invisible from overhead — and from in here it does not matter at all, because a child's head is sixty centimetres lower. Two circles almost the same size at obviously different heights is a parent and a child, with nothing else drawn.",
  },
  {
    kind: "slider",
    key: "standing",
    label: "standing",
    group: "crowd",
    min: 0,
    max: 0.6,
    step: 0.02,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Fraction who are not going anywhere: stopped at a stall, waiting for somebody, talking. They are what makes a market a market rather than a corridor with bad traffic, and they are also what everybody else has to get around. Their heads still move, because a person standing still is not a person holding still.",
  },
  {
    kind: "range",
    keys: ["paceLow", "paceHigh"],
    label: "pace",
    group: "people",
    min: 0.4,
    max: 3,
    step: 0.05,
    format: (from, to) => `${from.toFixed(2)}–${to.toFixed(2)} m/s`,
    hint: "The band adults draw their preferred walking speed from. Free-flowing pedestrians average about 1.34 m/s with a spread of 0.26, which is roughly 0.9–1.8 here. Children are not drawn from this band: preferred speed goes as the square root of leg length, so a child's comes out of their height at whatever the adults around them are doing. Where my own speed sits inside this band is what decides whether I spend the walk overtaking or being overtaken.",
  },
  {
    kind: "slider",
    key: "spacing",
    label: "room",
    group: "people",
    min: 0.3,
    max: 2.5,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "How much room everybody insists on. It scales the disc a person will not have entered and the strength of the anticipation that keeps it empty, together, because they are the same preference. Low is a crowd that tolerates being close and resolves everything late; high is a crowd that starts easing apart while it is still several metres off, and jams at a density a tighter crowd walks through.",
  },
  {
    kind: "slider",
    key: "walk",
    label: "my pace",
    group: "me",
    min: 0,
    max: 2.2,
    step: 0.05,
    format: (v) => (v <= 0 ? "standing" : `${v.toFixed(2)} m/s`),
    hint: "How fast I am going. Set against the crowd's pace band, this is the single control that decides what the walk feels like: below the band I am being overtaken constantly and every head in front of me is drifting closer, above it I am doing the overtaking and the crowd ahead opens up as I reach it. At 0 I stand where I am and the crowd comes past.",
  },
  {
    kind: "slider",
    key: "pausing",
    label: "stopping",
    group: "me",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "How much of the time I stop. Not a rate of stopping but a share of the walk spent stopped, so turning it up makes the stops longer as well as more frequent. A stop is where the looking happens — standing still and turning your head is a different observation from walking and glancing, and the piece is noticeably more legible during one.",
  },
  {
    kind: "slider",
    key: "height",
    label: "my height",
    group: "me",
    min: 1,
    max: 2.05,
    step: 0.01,
    format: (v) => `${v.toFixed(2)}m`,
    hint: "How tall I am, which decides who is taller than me and who is shorter. It is the control worth dragging slowly: at 1.95 I am looking over the crowd and every head is below the middle of the frame, at 1.60 the horizon runs straight through the tall ones' heads, and somewhere around 1.15 the picture changes completely because I am a child in it. My eye height, my stride and how far the frame bobs all follow from this one number.",
  },
  {
    kind: "slider",
    key: "pitch",
    label: "my gaze",
    group: "me",
    min: -25,
    max: 15,
    step: 0.5,
    format: (v) => (Math.abs(v) < 0.25 ? "level" : v < 0 ? `${(-v).toFixed(1)}° down` : `${v.toFixed(1)}° up`),
    hint: "Where my gaze rests, not where it is locked. A walking person does not look at the horizon — the resting line of sight is several degrees down, because the ground you are about to walk on and the faces of anybody close enough to matter are both below eye height. Glances wander up and down from here as well as side to side: at the ground ahead, at a face, at a child's head which is a long way below yours. It is also what decides where the crowd sits in the frame, since with heads and no bodies the picture is a band and this says where the band is.",
  },
  {
    kind: "slider",
    key: "companions",
    label: "with me",
    group: "me",
    min: 0,
    max: 3,
    step: 1,
    format: (v) => (v < 0.5 ? "alone" : v < 1.5 ? "one" : `${Math.round(v)}`),
    hint: "How many people are walking with me. They keep station beside me rather than being met and passed, they hold their place while the crowd goes round them, and I look at them — a conversation is most of where the head goes when there is one to be had. It changes the walk more than the number suggests: alone you are reading the crowd, and with somebody you are only half watching it.",
  },
  {
    kind: "slider",
    key: "looking",
    label: "looking",
    group: "me",
    min: 0,
    max: 1.5,
    step: 0.05,
    format: (v) => (v <= 0 ? "fixed ahead" : v.toFixed(2)),
    hint: "How much I turn my head, and how far. I look at people coming toward me, at whoever has just passed close, at a group, and sometimes at nothing in particular — and the neck has a speed limit, so a glance is a sweep rather than a cut. At 0 the head is welded facing the way I am walking, which is worth seeing once for how wrong it is.",
  },
  {
    kind: "slider",
    key: "bob",
    label: "bob",
    group: "me",
    min: 0,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "Multiplier on what my own gait does to the frame. At 1 it is life-size: the head rises and falls about 2.3 cm once per step and swings 2 cm from side to side once per stride, which is two steps because the weight goes over one foot and then the other. It is far too small to notice and completely obvious when it is missing — without it the camera is on rails. Turn it past two to see the mechanism you were not supposed to see.",
  },
  {
    kind: "slider",
    key: "fov",
    label: "field",
    group: "look",
    min: 35,
    max: 120,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Field of view across the shorter side of the window, so a portrait phone and a wide monitor see the same amount of crowd vertically and the wide one sees further to the sides. A human's attentive field is about 55°; wider than 90 is a lens rather than an eye, and the heads at the edges stretch the way they do in a photograph taken with one.",
  },
  {
    kind: "slider",
    key: "fade",
    label: "distance",
    group: "look",
    min: 2,
    max: 80,
    step: 0.1,
    scale: "log",
    format: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)}m`,
    hint: "How far the air lets me see, as the distance at which a head is down to a third of its brightness. Light is scattered out of the line of sight at a rate proportional to what is left, so the fall is exponential and the crowd has no edge — it thins until there is nothing, which is what makes it read as continuing past where it can be seen. How far the world actually extends is derived from this, so turning it up brings more crowd into being rather than revealing an empty plain. Logarithmic, because a two-metre fog and an eighty-metre one are both worth having and a linear track puts the first in the leftmost per cent.",
  },
  {
    kind: "slider",
    key: "reach",
    label: "reach",
    group: "look",
    min: 8,
    max: 250,
    step: 0.5,
    scale: "log",
    format: (v) => `${v < 100 ? v.toFixed(1) : Math.round(v)}m`,
    hint: "How far the crowd extends. Beyond it there is nobody — so this is the control that decides whether you are in the middle of something enormous or in a knot of twenty people with empty ground behind them. It is separate from **distance** on purpose: one is how far people exist, the other is how far you can see, and a scene where the first is shorter than the second shows you the crowd actually ending. Pull it in and the same density arrives as a press of people right around you.",
  },
  {
    kind: "slider",
    key: "width",
    label: "corridor",
    group: "look",
    min: 3,
    max: 250,
    step: 0.5,
    scale: "log",
    format: (v) => (v >= 250 ? "open ground" : `${v < 100 ? v.toFixed(1) : Math.round(v)}m`),
    hint: "How wide the ground is across the line I am walking. At the top it is open and this does nothing. Narrow it and the crowd has walls: everyone is in a street or a passage, nobody can go round, and the only way past somebody is to overtake them or wait. Worth pairing with **stream** at the top and **oncoming** near a half, which is the condition files form under — in a corridor they have nowhere else to form.",
  },
  {
    kind: "slider",
    key: "hue",
    label: "hue",
    group: "paint",
    min: 0,
    max: 359,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "The colour the heads carry, when they carry any. It does nothing on its own — tint is what lets it through — and it is also the hue the controls and the written note are tinted from, which is why it has a value even in the scenes that are pure white.",
  },
  {
    kind: "slider",
    key: "tint",
    label: "tint",
    group: "paint",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => (v <= 0 ? "white" : v.toFixed(2)),
    hint: "How much of the hue the heads actually carry. 0 is white circles on black, which is what this piece was asked for and what it is best at; turning it up is worth doing once to confirm that the colour adds nothing the distance was not already saying.",
  },
  {
    kind: "slider",
    key: "playback",
    label: "playback",
    group: "paint",
    min: 0,
    max: 2,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "Clock rate. Everything time-dependent goes through it — my stride, the crowd's, the looking, the stopping — so half speed is the same walk taken slowly rather than a slower walk. 0 holds the frame.",
  },
  {
    kind: "slider",
    key: "seed",
    label: "seed",
    group: "crowd",
    min: 0,
    max: 99_999,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "Decides who is out there: their heights, their ages, who is with whom, where they are going and the order I meet them. Same seed and same settings, same walk. The button in the bar draws a new one.",
  },
]

/** Bounds for the seed, so `reroll` and the panel cannot disagree about them. */
export const SEED_BOUNDS = { min: 0, max: 99_999 }

/**
 * The arbitrary place the piece starts from before anyone has touched it.
 *
 * **Not the primary**, which is `PRESETS[0]`. Nothing presentational may read
 * this — see `../CONTEXT.md`.
 */
export const DEFAULT_SETTINGS: Settings = {
  density: 40,
  stream: 0.45,
  against: 0.5,
  grouping: 0.6,
  children: 0.18,
  standing: 0.12,
  paceLow: 0.9,
  paceHigh: 1.8,
  spacing: 1,
  walk: 1.3,
  pausing: 0.15,
  height: 1.78,
  pitch: -4,
  companions: 1,
  looking: 0.8,
  bob: 1,
  fov: 62,
  fade: 40,
  reach: 65,
  width: 250,
  hue: 210,
  tint: 0,
  playback: 1,
  seed: 7351,
}

/**
 * Scenes worth keeping, each stating every setting.
 *
 * **A preset inherits from nothing** — not from another preset and not from
 * `DEFAULT_SETTINGS`. Spreading over the defaults reads as tidy and is the trap
 * that cost Psyxels four of its six scenes; see
 * `../docs/adr/20260830-a-preset-inherits-from-nothing.md`.
 *
 * Every one of them is `tint: 0`, which makes the `hue` here look inert. It is
 * not: the note, the chrome and the index placard all tint themselves from it,
 * and a scene that is white on black still has to say what colour it would be.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "market",
    hint: "A busy square with no grain to it, walked slowly, stopping to look. The scene the piece was asked for.",
    settings: {
      density: 48,
      stream: 0.22,
      against: 0.5,
      grouping: 0.7,
      children: 0.22,
      standing: 0.22,
      paceLow: 0.85,
      paceHigh: 1.65,
      spacing: 1.05,
      walk: 1.05,
      pausing: 0.3,
      height: 1.72,
      pitch: -4,
      companions: 2,
      looking: 1.0,
      bob: 1,
      fov: 62,
      fade: 30,
      reach: 90,
      width: 250,
      hue: 208,
      tint: 0,
      playback: 1,
      seed: 24196,
    },
  },
  {
    label: "concourse",
    hint: "One axis, half of it coming at me, and me walking faster than most of it. This is where the files form.",
    settings: {
      density: 60,
      stream: 0.92,
      against: 0.5,
      grouping: 0.35,
      children: 0.08,
      standing: 0.04,
      paceLow: 1.05,
      paceHigh: 1.95,
      spacing: 0.9,
      walk: 1.75,
      pausing: 0,
      height: 1.76,
      pitch: -3,
      companions: 0,
      looking: 0.7,
      bob: 1.1,
      fov: 55,
      fade: 34,
      reach: 120,
      width: 34,
      hue: 196,
      tint: 0,
      playback: 1,
      seed: 6640,
    },
  },
  {
    label: "standing still",
    hint: "I stop, and the crowd goes round me. Nothing moves the frame but my own breathing and my head.",
    settings: {
      density: 55,
      stream: 0.5,
      against: 0.5,
      grouping: 0.7,
      children: 0.28,
      standing: 0.16,
      paceLow: 0.8,
      paceHigh: 1.7,
      spacing: 1.15,
      walk: 0,
      pausing: 1,
      height: 1.66,
      pitch: -5,
      companions: 1,
      looking: 1.2,
      bob: 1,
      fov: 70,
      fade: 28,
      reach: 80,
      width: 250,
      hue: 222,
      tint: 0,
      playback: 1,
      seed: 51877,
    },
  },
  {
    label: "the street",
    hint: "A narrow street with two streams in it. Nobody can go round, so the only way past anybody is to overtake them or to wait — which is the whole negotiation, with the room to avoid it taken away.",
    settings: {
      density: 45,
      stream: 1,
      against: 0.5,
      grouping: 0.4,
      children: 0.14,
      standing: 0.04,
      paceLow: 0.9,
      paceHigh: 1.8,
      spacing: 1,
      walk: 1.45,
      pausing: 0.05,
      height: 1.74,
      pitch: -3,
      companions: 1,
      looking: 0.6,
      bob: 1,
      fov: 58,
      fade: 40,
      reach: 160,
      width: 7,
      hue: 200,
      tint: 0,
      playback: 1,
      seed: 13907,
    },
  },
  {
    label: "the far end",
    hint: "Far enough to see the crowd stop being people and become texture. It has no edge — it simply runs out.",
    settings: {
      density: 12,
      stream: 0.35,
      against: 0.45,
      grouping: 0.5,
      children: 0.2,
      standing: 0.1,
      paceLow: 0.9,
      paceHigh: 1.8,
      spacing: 0.85,
      walk: 0.8,
      pausing: 0.2,
      height: 1.94,
      pitch: -2,
      companions: 0,
      looking: 0.7,
      bob: 0.9,
      fov: 88,
      fade: 75,
      reach: 250,
      width: 250,
      hue: 202,
      tint: 0,
      playback: 1,
      seed: 30412,
    },
  },
  {
    label: "waist high",
    hint: "The same square from a child's eyes. Every adult is a ceiling and the other children are the only faces.",
    settings: {
      density: 50,
      stream: 0.25,
      against: 0.5,
      grouping: 0.75,
      children: 0.3,
      standing: 0.2,
      paceLow: 0.85,
      paceHigh: 1.6,
      spacing: 1,
      walk: 0.95,
      pausing: 0.35,
      height: 1.14,
      pitch: 2,
      companions: 1,
      looking: 1.2,
      bob: 1.15,
      fov: 68,
      fade: 26,
      reach: 70,
      width: 250,
      hue: 216,
      tint: 0,
      playback: 1,
      seed: 88104,
    },
  },
]

/**
 * The numeric shape of every setting a slider owns: its bounds and its grid.
 *
 * **Written out rather than derived from `CONTROLS`, and that is the point.**
 * Deriving it makes the whole control list reachable from `normalizeSettings`,
 * and therefore from a runner, which has no panel and draws none of it — labels,
 * hints and `format` closures all ride along. It was 30% of starry-night's
 * runner. `tests/unit/experiments-grid.test.ts` fails if any track here differs
 * from the control it describes, which is the check that replaces the
 * derivation.
 */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  density: { min: 0.5, max: 100, step: 0.5, scale: "log" },
  stream: { min: 0, max: 1, step: 0.01 },
  against: { min: 0, max: 1, step: 0.01 },
  grouping: { min: 0, max: 1, step: 0.05 },
  children: { min: 0, max: 0.5, step: 0.02 },
  standing: { min: 0, max: 0.6, step: 0.02 },
  paceLow: { min: 0.4, max: 3, step: 0.05 },
  paceHigh: { min: 0.4, max: 3, step: 0.05 },
  spacing: { min: 0.3, max: 2.5, step: 0.05 },
  walk: { min: 0, max: 2.2, step: 0.05 },
  pausing: { min: 0, max: 1, step: 0.05 },
  height: { min: 1, max: 2.05, step: 0.01 },
  pitch: { min: -25, max: 15, step: 0.5 },
  companions: { min: 0, max: 3, step: 1 },
  looking: { min: 0, max: 1.5, step: 0.05 },
  bob: { min: 0, max: 3, step: 0.05 },
  fov: { min: 35, max: 120, step: 1 },
  fade: { min: 2, max: 80, step: 0.1, scale: "log" },
  reach: { min: 8, max: 250, step: 0.5, scale: "log" },
  width: { min: 3, max: 250, step: 0.5, scale: "log" },
  hue: { min: 0, max: 359, step: 1 },
  tint: { min: 0, max: 1, step: 0.02 },
  playback: { min: 0, max: 2, step: 0.05 },
  seed: { min: 0, max: 99999, step: 1 },
}

/**
 * Bounds for every numeric setting, so the validator never has to know how a
 * control is presented. Narrowed from `TRACKS` rather than declared twice.
 */
export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    Object.entries(TRACKS).map(([key, track]) => [key, { min: track!.min, max: track!.max }]),
  ) as Record<NumericKey, { min: number; max: number }>),
  seed: SEED_BOUNDS,
}

/**
 * The spacing one setting is stored on.
 *
 * Exported because a check that a value is on its grid has to read the grid from
 * the piece rather than re-derive it — re-deriving is how a test ends up
 * asserting its own copy of the rule.
 */
export function gridFor(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? gridAt(track, value) : 0
}

function snap(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? snapToGrid(track, value) : value
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API, the panel — passes through here, so the API cannot reach a walk a URL
 * could not.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const settings: Settings = { ...base, ...patch }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }

  settings.seed = Math.round(settings.seed)

  // A pace band that has crossed over leaves everybody drawing from an empty
  // interval, which comes out as a crowd walking at exactly one speed.
  if (settings.paceLow > settings.paceHigh) settings.paceHigh = settings.paceLow

  return settings
}

/**
 * Keeps the pace pair in order, moving whichever end is not being dragged.
 *
 * `normalizeSettings` can only push the top up, which fights somebody dragging
 * the top down. Here the moved key is known, so the other end gives way.
 */
export function reconcile(next: Settings, changed: keyof Settings): Settings {
  if (changed === "paceLow" && next.paceLow > next.paceHigh) return { ...next, paceHigh: next.paceLow }
  if (changed === "paceHigh" && next.paceHigh < next.paceLow) return { ...next, paceLow: next.paceHigh }
  return next
}

/**
 * Reads settings from a query string, in either form.
 *
 * The packed parameter wins when it is there and readable. Anything else falls
 * through to the named-parameter reader, which is why a link written by hand
 * still restores its own scene — and why a corrupt `s` degrades to the defaults
 * rather than throwing in a page's first statement.
 */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const packed = params.get("s")
  if (packed !== null && packed !== "") {
    const scene = decodeScene(REGISTRY, packed)
    if (scene) return normalizeSettings(scene as Partial<Settings>)
  }
  return settingsFromNamedQuery(params)
}

function settingsFromNamedQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}
  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }
  return normalizeSettings(patch)
}

/**
 * **The address registry: append-only, and immutable slot by slot.**
 *
 * Read `@/experiments/address` before touching this. In short: append to add,
 * `retired: true` to remove, and retire-then-append for any change to a slot's
 * `grid`, `origin` or `bits` — including a change to what a value *means* while
 * its numbers stay the same, which nothing can detect automatically.
 *
 * `tests/unit/experiments-address.test.ts` holds a snapshot of every registry
 * and fails on any edit that is not an append.
 */
export const REGISTRY: readonly Slot[] = [
  { key: "density", kind: "num", grid: 0.5, origin: 0.5, bits: 8 },
  { key: "stream", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "against", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "grouping", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "children", kind: "num", grid: 0.02, origin: 0, bits: 5 },
  { key: "standing", kind: "num", grid: 0.02, origin: 0, bits: 5 },
  { key: "paceLow", kind: "num", grid: 0.05, origin: 0.4, bits: 6 },
  { key: "paceHigh", kind: "num", grid: 0.05, origin: 0.4, bits: 6 },
  { key: "spacing", kind: "num", grid: 0.05, origin: 0.3, bits: 6 },
  { key: "walk", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "pausing", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "height", kind: "num", grid: 0.01, origin: 1, bits: 7 },
  { key: "pitch", kind: "num", grid: 0.5, origin: -25, bits: 7 },
  { key: "looking", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "bob", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "fov", kind: "num", grid: 1, origin: 35, bits: 7 },
  // **`grid` is 0.1, which is this log track's `step` and not three significant
  // figures.** `gridAt` floors a log grid at `step`, and at every value on this
  // track — 2 through 80 — the three-significant-figure spacing is 0.01 or 0.1,
  // so the floor wins throughout and one number describes the whole track. A
  // track reaching below 1 would not have that property.
  { key: "fade", kind: "num", grid: 0.1, origin: 2, bits: 10 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "tint", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "playback", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 17 },
  // Appended, which is the only edit this list takes. `reach` splits the world's
  // size away from `fade`, which used to derive it — see `throng.ts`.
  { key: "reach", kind: "num", grid: 0.5, origin: 8, bits: 9 },
  { key: "width", kind: "num", grid: 0.5, origin: 3, bits: 9 },
  { key: "companions", kind: "num", grid: 1, origin: 0, bits: 2 },
]

/**
 * The address that carries this scene, packed.
 *
 * Opaque on purpose — `../docs/adr/20260906-an-address-is-packed-not-readable.md`.
 * `experiment.decode()` expands an address back to a plain object, which is
 * where readability went.
 */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  params.set("s", encodeScene(REGISTRY, settings))
  return params
}

/**
 * Whether a query string names any setting at all.
 *
 * The same rule `settingsFromQuery` applies, and it has to stay the same rule:
 * absent, blank and unparseable are all "not a setting" there, so an address
 * made only of those is one the piece would read as carrying nothing.
 */
function namesASetting(params: URLSearchParams): boolean {
  const packed = params.get("s")
  if (packed !== null && packed !== "" && decodeScene(REGISTRY, packed)) return true
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * The scene a freshly-opened address should show.
 *
 * **A bare visit lands on the primary, not on `DEFAULT_SETTINGS`.** `featured`
 * says the caller should rewrite the address, so a landing visitor leaves with a
 * URL describing the walk in front of them rather than one standing for
 * "whatever is featured this month".
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

/**
 * Settings that decide who is out there, so changing one starts the walk again.
 *
 * Deliberately short. Everything else is read per frame or applied to the people
 * already walking, because a rebuild is a new set of strangers and a colour has
 * no business producing one — dragging the hue used to empty the square on every
 * step of the slider in an earlier draft of exactly this list.
 */
const CAST_KEYS = ["seed", "companions"] as const satisfies readonly (keyof Settings)[]

export function needsRecast(before: Settings, after: Settings): boolean {
  return CAST_KEYS.some((key) => before[key] !== after[key])
}

/**
 * Settings that change how big the world is or how many people it holds.
 *
 * **`fade` is not one of them any more.** It used to size the world, which
 * coupled how far you can see to how many people exist and made a long view and
 * a dense crowd mutually exclusive. `reach` is that dimension now, and `fade` is
 * purely what the air does.
 *
 * Not a rebuild: the people already out there keep walking, and only how many of
 * them there ought to be, and how far out they are kept, moves.
 */
const WORLD_KEYS = ["density", "reach", "width", "fov"] as const satisfies readonly (keyof Settings)[]

export function needsRestock(before: Settings, after: Settings): boolean {
  return WORLD_KEYS.some((key) => before[key] !== after[key])
}
