import { keysOf, type Control as KitControl, type RangeControl, type SliderControl } from "@/experiments/kit/controls"

/** Re-exported so a consumer needs one import for a control and its keys. */
export { keysOf } from "@/experiments/kit/controls"

/**
 * Everything about the crowd that is tunable at runtime.
 *
 * The single source of truth shared by the simulation, the panel and the URL.
 * Anything not here — a head's proportions, a step's length, how fast a neck can
 * turn — is not a taste, it is anatomy, and it lives in `body.ts` as a constant
 * with a measurement behind it.
 *
 * The line between the two is the piece's one design rule. A slider exists where
 * a person could reasonably want a different world; a constant exists where the
 * world already decided. `paceLow`/`paceHigh` are settings because a park and a
 * railway concourse genuinely differ; cadence is not, because it follows from
 * leg length and speed and a person who set it by hand would only be making
 * their crowd walk wrong.
 */
export type Settings = {
  /** Where people are going: across, around, or to a spot they have in mind. */
  flow: Flow
  /** How colour is handed out — by person, by group, by team, or barely at all. */
  palette: PaletteName
  /** Evening light: a darker ground, a warmer low sun, longer shadows. */
  dusk: boolean
  /** Whether the heads are drawn at all. Off leaves only the shadows walking. */
  heads: boolean
  /** People per 100 m² of ground actually in frame. */
  density: number
  /** Fraction of arrivals that come as a pair, a family or a knot of friends. */
  grouping: number
  /** Fraction of the population under about twelve. */
  children: number
  /** Fraction who are running rather than walking. */
  runners: number
  /** Fraction who stop somewhere in frame rather than crossing it. */
  settling: number
  /** Slowest preferred walking speed among adults, m/s. */
  paceLow: number
  /** Fastest preferred walking speed among adults, m/s. */
  paceHigh: number
  /** How much of a child's attention goes on playing rather than following. */
  play: number
  /** How much heads turn — at companions, at passers-by, at whatever is around. */
  gaze: number
  /** Multiplier on the head's gait movement. 1 is life-size. */
  bob: number
  /** Metres of ground across the shorter side of the window. */
  span: number
  /** How high the camera is, in metres. Low is a strong perspective. */
  camera: number
  /** Sun elevation in degrees. 90 is directly overhead and casts nothing. */
  sun: number
  /** Sun bearing in degrees, clockwise from the top of the frame. */
  sunAzimuth: number
  /** How dark the shadows are. */
  shadow: number
  /** Seconds a footprint stays on the ground. 0 leaves none. */
  traces: number
  /** Hue of the ground, in degrees. */
  hue: number
  /** How much colour the ground has. */
  tint: number
  /** Spread of the crowd's own hues, in degrees of standard deviation. */
  spread: number
  /** How washed out the crowd's colours are. 1 is full pastel. */
  pastel: number
  /** Clock rate. Every time-dependent thing in the piece goes through it. */
  playback: number
  /** Decides who arrives, how tall they are and what colour they wear. */
  seed: number
}

/**
 * Where people are going.
 *
 * Not a decoration on the same crowd: the three give genuinely different
 * pictures because the goal is what everything else answers to. `through` sends
 * everyone from one edge to the far one, which is the condition lanes form
 * under — opposing streams sort themselves into files within a few metres, with
 * nothing in the code that knows what a lane is. `wander` gives each arrival an
 * unrelated entry and exit, so the crossings are all oblique and no structure
 * survives. `gather` sends most of them to a spot and keeps them there.
 */
export const FLOWS = ["through", "wander", "gather"] as const
export type Flow = (typeof FLOWS)[number]
export const isFlow = (value: unknown): value is Flow => FLOWS.includes(value as Flow)

/**
 * What decides a person's colour.
 *
 * The brief left this open — group affinity or individual taste — so it is a
 * control rather than a decision, and the four options are four answers to it.
 * `crowd` gives everyone their own hue. `kin` gives a hue to a group and varies
 * only lightness within it, so a family reads as a family from across the frame.
 * `teams` pushes everyone toward one of two hues a third of the circle apart,
 * which is a match day. `quiet` nearly gives up on hue and lets size and motion
 * carry the picture.
 */
export const PALETTES = ["crowd", "kin", "teams", "quiet"] as const
export type PaletteName = (typeof PALETTES)[number]
export const isPaletteName = (value: unknown): value is PaletteName => PALETTES.includes(value as PaletteName)

export type NumericKey = Exclude<keyof Settings, "flow" | "palette" | "dusk" | "heads">

export type Control = KitControl<string & keyof Settings>

/** Numeric rows only — the ones with bounds to report and a track to drag. */
export type NumericControl = SliderControl<NumericKey> | RangeControl<NumericKey>

export const isNumericControl = (control: Control): control is NumericControl =>
  control.kind === "slider" || control.kind === "range"

export const FLOW_LABELS: Record<Flow, string> = {
  through: "across",
  wander: "about",
  gather: "to a spot",
}

export const PALETTE_LABELS: Record<PaletteName, string> = {
  crowd: "each",
  kin: "kin",
  teams: "teams",
  quiet: "quiet",
}

/** Headings, in panel order. Twenty-three rows do not read undivided. */
export const GROUPS = ["crowd", "people", "look", "light", "colour"] as const

export const CONTROLS: Control[] = [
  {
    kind: "choice",
    key: "flow",
    label: "going",
    group: "crowd",
    options: FLOWS.map((flow) => ({ value: flow, label: FLOW_LABELS[flow] })),
    hint: "Where people are headed. Across sends everyone from one edge to the opposite one, so two streams meet head-on and sort themselves into files — nothing in the code knows what a lane is, it is what happens when people prefer to follow someone going their way. About gives each arrival an unrelated way in and way out, so every crossing is oblique. To a spot sends most of them somewhere in the middle to stand, sit or picnic.",
  },
  {
    kind: "slider",
    key: "density",
    label: "density",
    group: "crowd",
    min: 0.5,
    max: 150,
    step: 0.5,
    scale: "log",
    format: (v) => `${v.toFixed(1)}/100m²`,
    hint: "People per hundred square metres of ground in frame — so widening the window brings more of them, rather than spreading the same crowd thinner. A quiet park is about 3, a busy lawn 15, a pavement at rush hour 60, a festival crowd 150. Pedestrians walk at nearly their free speed up to about 40 and are noticeably slowed by 100; nothing in the piece tells them to, it is what happens when there are more people to get past.",
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
    hint: "How much of the crowd arrives with somebody else. Observed crowds run around 0.7. Pairs and threes walk abreast; four and more bend into a shallow arc with the middle lagging, which is the shape that lets everyone see everyone else's face. Both shapes flatten out when it gets crowded, because a wide group cannot get through a gap.",
  },
  {
    kind: "slider",
    key: "children",
    label: "children",
    group: "crowd",
    min: 0,
    max: 0.6,
    step: 0.02,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Fraction of the crowd under about twelve. A child is a smaller head with a shorter step, which means a quicker one — cadence comes out of leg length here, so children step faster than the adults they are with without anything saying so. Most of them arrive attached to an adult.",
  },
  {
    kind: "slider",
    key: "runners",
    label: "running",
    group: "crowd",
    min: 0,
    max: 0.6,
    step: 0.02,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Fraction who are running rather than walking. A runner's head rises and falls three times as far as a walker's and their gaze locks forward, so they read as runners from above before you have worked out that they are overtaking.",
  },
  {
    kind: "slider",
    key: "settling",
    label: "stopping",
    group: "crowd",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Fraction of the people you can see who have somewhere in frame to be rather than somewhere past it. They walk to a spot, stand or sit for a while — a group sitting arranges itself in a rough ring so it can talk — and eventually get up and leave. Of the crowd rather than of the arrivals, which is not the same thing: somebody who stops stays about six times as long as somebody crossing, so a third of the arrivals would be three quarters of the picture. At 0 the frame is all traffic.",
  },
  {
    kind: "range",
    keys: ["paceLow", "paceHigh"],
    label: "pace",
    group: "people",
    min: 0.3,
    max: 4.5,
    step: 0.05,
    format: (from, to) => `${from.toFixed(2)}–${to.toFixed(2)} m/s`,
    hint: "The band adults draw their preferred walking speed from. Free-flowing pedestrians average about 1.34 m/s with a spread of 0.26, which is roughly 0.9–1.8 here. Children are not drawn from this band: preferred speed goes as the square root of leg length, so a child's comes out of their height at whatever the adults are doing.",
  },
  {
    kind: "slider",
    key: "play",
    label: "play",
    group: "people",
    min: 0,
    max: 1.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much of a child's attention goes on playing rather than on keeping up. Play is darting off and being called back, chasing another child until they are caught and the roles swap, jumping, crouching over something on the ground, and falling over. A fallen child's head stops and their shadow closes right up under them.",
  },
  {
    kind: "slider",
    key: "gaze",
    label: "gaze",
    group: "people",
    min: 0,
    max: 1.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much heads turn. A head from above is an oval, longer front to back than across, so which way it points is legible even at a few pixels — and the face comes into view as the chin lifts. People look where they are going, at whoever is talking, at a child who has got too far away, and briefly at strangers passing close. At 0 every head faces its direction of travel.",
  },
  {
    kind: "slider",
    key: "bob",
    label: "bob",
    group: "people",
    min: 0,
    max: 2.5,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "Multiplier on what the gait does to the head. At 1 it is life-size: about 4 cm of rise and fall once per step, and 2 cm of sway from side to side once per stride, which is two steps. From directly above the rise reads as the head growing very slightly, and the sway reads as a weave. Turn it up to see the mechanism; turn it off and the crowd glides.",
  },
  {
    kind: "slider",
    key: "span",
    label: "span",
    group: "look",
    min: 5,
    max: 60,
    step: 0.5,
    scale: "log",
    format: (v) => `${v.toFixed(1)}m`,
    hint: "Metres of ground across the shorter side of the window, so a portrait phone and a wide monitor look at the same amount of park. Small values are close enough to read a face turning; large ones turn the crowd into a flow. Density is per unit ground, so zooming out brings more people rather than making these ones smaller.",
  },
  {
    kind: "slider",
    key: "camera",
    label: "height",
    group: "look",
    min: 6,
    max: 150,
    step: 1,
    scale: "log",
    format: (v) => `${Math.round(v)}m`,
    hint: "How far above the ground the camera is. It is a real pinhole, so a low camera leans the heads outward from their feet toward the edges of the frame and makes the taller people noticeably bigger than the shorter ones. High up it flattens to a plan and an adult is only a fifth larger than a child, which is what the head measurements alone give.",
  },
  {
    kind: "slider",
    key: "sun",
    label: "sun",
    group: "light",
    min: 15,
    max: 90,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "How high the sun is. The shadow is cast from the whole body even though only the head is drawn, which is what a person looks like from above on a bright day. At 90 the sun is straight overhead and there is nothing but a dark patch underfoot; at 20 the shadows are three times a person's height and the ground is mostly them.",
  },
  {
    kind: "slider",
    key: "sunAzimuth",
    label: "bearing",
    group: "light",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Which way the sun is, clockwise from the top of the frame. It moves the shadows and it moves the highlight on every head, which is the main thing telling you a head is a ball rather than a disc.",
  },
  {
    kind: "slider",
    key: "shadow",
    label: "shadow",
    group: "light",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How dark the shadows are — overcast at the bottom of the range, hard noon at the top. A jump is much easier to read with them on: the shadow slides away from the head and shrinks as the child leaves the ground.",
  },
  {
    kind: "slider",
    key: "traces",
    label: "traces",
    group: "light",
    min: 0,
    max: 90,
    step: 1,
    format: (v) => (v <= 0 ? "none" : `${Math.round(v)}s`),
    hint: "How long the ground remembers somebody walking over it. At 0 it does not. Turned up, the crowd etches itself: paths that keep being used stay dark because they keep being renewed, and paths that do not simply go. Nothing draws a desire line — it is what is left when everything else has faded. Worth pairing with a long span, where the frame fills with the shape of an hour rather than a moment.",
  },
  {
    kind: "toggle",
    key: "heads",
    label: "heads",
    group: "light",
    hint: "Whether the people themselves are drawn. Turned off, all that is left is the shadows — which is most of a person's information anyway, and worth seeing on its own at least once: a crowd of silhouettes walking about with nobody attached to them. Pair it with a bright sun, a pale ground and a strong shadow.",
    labels: ["shadows only", "heads"],
  },
  {
    kind: "toggle",
    key: "dusk",
    label: "dusk",
    group: "light",
    hint: "Evening. The ground darkens and cools, the light warms, and the shadows lengthen and soften. Everything else about the crowd is unchanged.",
    labels: ["day", "dusk"],
  },
  {
    kind: "choice",
    key: "palette",
    label: "colour by",
    group: "colour",
    options: PALETTES.map((name) => ({ value: name, label: PALETTE_LABELS[name] })),
    hint: "What decides what a person is wearing. Each gives everyone their own hue. Kin gives the hue to the group and varies only its lightness inside it, so a family reads as a family across the whole frame. Teams pushes everyone toward one of two hues a third of the circle apart, which is a match day or a concert. Quiet nearly gives up on hue and lets size and movement carry the picture.",
  },
  {
    kind: "slider",
    key: "hue",
    label: "ground",
    group: "colour",
    min: 0,
    max: 360,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Hue of the ground. Around 100 is grass, 40 is dry sand or gravel, 210 is wet paving. It is also the hue the controls and the written note are tinted from.",
  },
  {
    kind: "slider",
    key: "tint",
    label: "tint",
    group: "colour",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "What the ground is, on one axis: bleached paper at 0, full grass or clay at 1. Pale and colourless at one end, dark and stated at the other, because that is the pairing real ground comes in — there is no saturated near-white outdoors. Below about 0.45 the crowd is drawn darker than the ground rather than lighter, which is the difference between people on grass and people on sand.",
  },
  {
    kind: "slider",
    key: "spread",
    label: "variety",
    group: "colour",
    min: 0,
    max: 120,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "How far the crowd's hues scatter, as a standard deviation in degrees. At 0 everyone is the same colour and only lightness separates them; at 120 the frame holds every hue there is. Draws are clamped at two and a half deviations, so nobody comes out the one wrong colour in the picture.",
  },
  {
    kind: "slider",
    key: "pastel",
    label: "pastel",
    group: "colour",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How washed out the crowd is. At 1 everything is chalk — high lightness, low saturation. Turn it down and the colours state themselves, which is a different picture entirely and worth seeing at least once.",
  },
  {
    kind: "slider",
    key: "playback",
    label: "playback",
    group: "people",
    min: 0,
    max: 2,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "Clock rate. Everything time-dependent goes through it — steps, gaze, play, the rate people arrive — so half speed is the same crowd watched slowly rather than a slower crowd. 0 holds the frame.",
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
    hint: "Decides who turns up: their heights, their ages, their colours, and the order they arrive in. Same seed and same settings, same crowd. The button in the bar draws a new one.",
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
  flow: "wander",
  palette: "crowd",
  dusk: false,
  heads: true,
  density: 14,
  grouping: 0.65,
  children: 0.2,
  runners: 0.06,
  settling: 0.35,
  paceLow: 0.95,
  paceHigh: 1.75,
  play: 0.7,
  gaze: 1,
  bob: 1,
  span: 11,
  camera: 20,
  sun: 70,
  sunAzimuth: 150,
  shadow: 0.45,
  traces: 0,
  hue: 104,
  tint: 0.62,
  spread: 42,
  pastel: 0.78,
  playback: 1,
  seed: 4821,
}

/**
 * Scenes worth keeping, each stating every setting.
 *
 * **A preset inherits from nothing** — not from another preset and not from
 * `DEFAULT_SETTINGS`. Spreading over the defaults reads as tidy and is the trap
 * that cost Psyxels four of its six scenes; see
 * `../docs/adr/20260830-a-preset-inherits-from-nothing.md`.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "sunday",
    hint: "A park in the afternoon. Families, picnics, and a couple of joggers going through.",
    settings: {
      flow: "gather",
      palette: "kin",
      dusk: false,
      heads: true,
      density: 26,
      grouping: 0.8,
      children: 0.3,
      runners: 0.08,
      settling: 0.55,
      paceLow: 0.8,
      paceHigh: 1.5,
      play: 1,
      gaze: 1.1,
      bob: 1,
      span: 8.5,
      camera: 16,
      sun: 68,
      sunAzimuth: 145,
      shadow: 0.42,
      traces: 0,
      hue: 104,
      tint: 0.62,
      spread: 46,
      pastel: 0.82,
      playback: 1,
      seed: 4821,
    },
  },
  {
    label: "crossing",
    hint: "Two streams meeting head-on. Watch the files form and come apart.",
    settings: {
      flow: "through",
      palette: "crowd",
      dusk: false,
      heads: true,
      density: 55,
      grouping: 0.25,
      children: 0.06,
      runners: 0.04,
      settling: 0.02,
      paceLow: 1.1,
      paceHigh: 1.9,
      play: 0.2,
      gaze: 0.7,
      bob: 1,
      span: 15,
      camera: 30,
      sun: 78,
      sunAzimuth: 200,
      shadow: 0.3,
      traces: 0,
      hue: 212,
      tint: 0.55,
      spread: 32,
      pastel: 0.66,
      playback: 1,
      seed: 1307,
    },
  },
  {
    label: "match day",
    hint: "Everyone in one of two colours, all going the same way, most of them in knots.",
    settings: {
      flow: "through",
      palette: "teams",
      dusk: false,
      heads: true,
      density: 60,
      grouping: 0.9,
      children: 0.12,
      runners: 0.02,
      settling: 0.05,
      paceLow: 0.9,
      paceHigh: 1.45,
      play: 0.5,
      gaze: 1.2,
      bob: 1,
      span: 17,
      camera: 34,
      sun: 60,
      sunAzimuth: 120,
      shadow: 0.5,
      traces: 0,
      hue: 32,
      tint: 0.58,
      spread: 10,
      pastel: 0.5,
      playback: 1,
      seed: 8802,
    },
  },
  {
    label: "playground",
    hint: "Close in, mostly children, and almost nobody going anywhere.",
    settings: {
      flow: "gather",
      palette: "crowd",
      dusk: false,
      heads: true,
      density: 40,
      grouping: 0.85,
      children: 0.58,
      runners: 0.12,
      settling: 0.85,
      paceLow: 0.7,
      paceHigh: 1.35,
      play: 1.5,
      gaze: 1.35,
      bob: 1.2,
      span: 7,
      camera: 12,
      sun: 74,
      sunAzimuth: 165,
      shadow: 0.48,
      traces: 0,
      hue: 46,
      tint: 0.66,
      spread: 70,
      pastel: 0.85,
      playback: 1,
      seed: 271,
    },
  },
  {
    label: "silhouettes",
    hint: "The people turned off, so only their shadows are left walking about.",
    settings: {
      flow: "wander",
      palette: "quiet",
      dusk: false,
      heads: false,
      density: 30,
      grouping: 0.55,
      children: 0.2,
      runners: 0.08,
      settling: 0.25,
      paceLow: 0.9,
      paceHigh: 1.7,
      play: 0.8,
      gaze: 1,
      bob: 1,
      span: 18,
      camera: 34,
      sun: 42,
      sunAzimuth: 150,
      shadow: 1,
      traces: 0,
      hue: 40,
      tint: 0.05,
      spread: 20,
      pastel: 0.7,
      playback: 1,
      seed: 5150,
    },
  },
  {
    label: "desire lines",
    hint: "The ground remembers the last minute. Nobody draws the paths; they are what is left.",
    settings: {
      flow: "gather",
      palette: "crowd",
      dusk: false,
      heads: true,
      density: 30,
      grouping: 0.55,
      children: 0.25,
      runners: 0.1,
      settling: 0.5,
      paceLow: 0.9,
      paceHigh: 1.7,
      play: 0.9,
      gaze: 1,
      bob: 1,
      span: 26,
      camera: 60,
      sun: 70,
      sunAzimuth: 150,
      shadow: 0.22,
      traces: 75,
      hue: 104,
      tint: 0.62,
      spread: 60,
      pastel: 0.55,
      playback: 1,
      seed: 8123,
    },
  },
  {
    label: "bacteria",
    hint: "Far enough up that people are motile specks. Found by accident and kept.",
    settings: {
      flow: "wander",
      palette: "kin",
      dusk: true,
      heads: true,
      density: 34,
      grouping: 0.3,
      children: 0.46,
      runners: 0.6,
      settling: 0,
      paceLow: 1.05,
      paceHigh: 4.05,
      play: 1.1,
      gaze: 1.45,
      bob: 0.8,
      span: 30,
      camera: 150,
      sun: 15,
      sunAzimuth: 0,
      shadow: 0,
      traces: 0,
      hue: 230,
      tint: 0.74,
      spread: 108,
      pastel: 1,
      playback: 1,
      seed: 44232,
    },
  },
  {
    label: "long shadows",
    hint: "Late, thinning out, and the shadows longer than the people.",
    settings: {
      flow: "wander",
      palette: "crowd",
      dusk: true,
      heads: true,
      density: 9,
      grouping: 0.5,
      children: 0.14,
      runners: 0.22,
      settling: 0.3,
      paceLow: 1,
      paceHigh: 2.1,
      play: 0.6,
      gaze: 0.9,
      bob: 1,
      span: 10,
      camera: 19,
      sun: 26,
      sunAzimuth: 285,
      shadow: 0.62,
      traces: 0,
      hue: 96,
      tint: 0.2,
      spread: 44,
      pastel: 0.82,
      playback: 1,
      seed: 6644,
    },
  },
]

/**
 * Bounds for every numeric setting, flattened out of the control list so the
 * validator never has to know how a control is presented.
 */
export const BOUNDS = Object.fromEntries(
  CONTROLS.filter(isNumericControl).flatMap((control) =>
    keysOf(control).map((key) => [key, { min: control.min, max: control.max }] as const),
  ),
) as Record<NumericKey, { min: number; max: number }>

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API, the panel — passes through here, so the API cannot reach a crowd a URL
 * could not.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = {
    ...merged,
    flow: isFlow(merged.flow) ? merged.flow : base.flow,
    palette: isPaletteName(merged.palette) ? merged.palette : base.palette,
    dusk: Boolean(merged.dusk),
    heads: Boolean(merged.heads),
  }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
  }

  settings.seed = Math.round(settings.seed)

  // A pace band that has crossed over would have everyone drawing from an empty
  // interval, which comes out as a crowd all walking at exactly one speed.
  if (settings.paceLow > settings.paceHigh) settings.paceHigh = settings.paceLow

  return settings
}

/**
 * Keeps the pace pair in order, moving whichever end is not being dragged.
 *
 * `normalizeSettings` can only push the top up, which fights someone dragging
 * the top down. Here the moved key is known, so the other end gives way.
 */
export function reconcile(next: Settings, changed: keyof Settings): Settings {
  if (changed === "paceLow" && next.paceLow > next.paceHigh) return { ...next, paceHigh: next.paceLow }
  if (changed === "paceHigh" && next.paceHigh < next.paceLow) return { ...next, paceLow: next.paceHigh }
  return next
}

/**
 * Reads settings from a query string.
 *
 * An absent param is `null` and `Number(null)` is 0, which is a legal value for
 * most of these. Absent, blank and unparseable are all skipped so the default
 * survives.
 */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}

  const flow = params.get("flow")
  if (isFlow(flow)) patch.flow = flow

  const palette = params.get("palette")
  if (isPaletteName(palette)) patch.palette = palette

  const dusk = params.get("dusk")
  if (dusk !== null) patch.dusk = dusk !== "0" && dusk !== "false"

  const heads = params.get("heads")
  if (heads !== null) patch.heads = heads !== "0" && heads !== "false"

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
  if (settings.flow !== DEFAULT_SETTINGS.flow) params.set("flow", settings.flow)
  if (settings.palette !== DEFAULT_SETTINGS.palette) params.set("palette", settings.palette)
  if (settings.dusk !== DEFAULT_SETTINGS.dusk) params.set("dusk", settings.dusk ? "1" : "0")
  if (settings.heads !== DEFAULT_SETTINGS.heads) params.set("heads", settings.heads ? "1" : "0")
  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) params.set(key, String(settings[key]))
  }
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
  if (isFlow(params.get("flow")) || isPaletteName(params.get("palette"))) return true
  if (params.get("dusk") !== null || params.get("heads") !== null) return true
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * The scene a freshly-opened address should show.
 *
 * **A bare visit lands on the primary, not on `DEFAULT_SETTINGS`.** The two are
 * different things — see `../CONTEXT.md` — and the defaults are an arbitrary
 * place to start from rather than a scene anybody chose.
 *
 * `featured` says the caller should rewrite the address, so a landing visitor
 * leaves with a URL describing the park in front of them rather than one
 * standing for "whatever is featured this month". That indirection is the whole
 * point: the featured scene can move without invalidating a link anybody has
 * already copied.
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
 * Settings that decide who is in the crowd, so changing one rebuilds it.
 *
 * Everything else is read per frame. Dragging the sun used to be indexed here
 * by accident in an earlier draft and emptied the park on every step of the
 * slider, which is the failure this list exists to prevent: a rebuild is a new
 * cast of people, and no colour or light setting has any business causing one.
 */
const CAST_KEYS = ["seed"] as const satisfies readonly (keyof Settings)[]

export function needsRecast(before: Settings, after: Settings): boolean {
  return CAST_KEYS.some((key) => before[key] !== after[key])
}

/**
 * Settings that change how much ground is in frame, so the population target
 * and every walker's screen size move with them.
 *
 * Not a rebuild: the people already out there keep walking, and only how many
 * of them there ought to be changes.
 */
const VIEW_KEYS = ["span", "camera", "density"] as const satisfies readonly (keyof Settings)[]

export function needsRemeasure(before: Settings, after: Settings): boolean {
  return VIEW_KEYS.some((key) => before[key] !== after[key])
}
