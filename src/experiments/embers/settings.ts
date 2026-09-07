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
 * How an ember is drawn, which is deliberately separable from how it moves.
 *
 * The flow in `air.ts` knows nothing about embers — it is a plume, some
 * vortices and a wind — and the physics in `ember.ts` knows only about a thing
 * with a fall speed and a temperature. So the mark is a free choice, and this is
 * where the piece says so out loud: the same fire can be carrying sparks, soft
 * motes of light or wide slow flakes, and none of it is a different simulation.
 */
export const MARKS = ["ember", "spark", "mote", "flake"] as const
export type Mark = (typeof MARKS)[number]
export const isMark = (value: unknown): value is Mark => MARKS.includes(value as Mark)

/**
 * Everything about the fire that is tunable at runtime.
 *
 * The single source of truth shared by the simulation, the panel and the URL.
 * Anything not here — the density of char, the drag coefficient of a tumbling
 * chip, the second radiation constant — is a constant, and belongs to the module
 * that uses it rather than to a visitor.
 */
export type Settings = {
  /** Most embers alive at once. A ceiling, not a target: the fire decides. */
  count: number
  /** Steady lift-off rate from the bed, as a multiplier. */
  sputter: number
  /** Splinters a second: coal decrepitating and throwing a fan of fragments. */
  pops: number
  /** Bursts a minute: the fire surging and sending a slug up on a puff. */
  bursts: number
  /** Width of the fire, in metres. Sets the plume's scale and its puffing rate. */
  bed: number
  /** How far below the bottom edge the fire sits, in metres. */
  hearth: number
  /** Strength of the light the unseen fire throws into the bottom of the frame. */
  firelight: number
  /** Centreline updraft just above the coals, m/s. */
  updraft: number
  /** Entrainment coefficient: how fast the plume widens with height. */
  spread: number
  /** Circulation of the eddies the plume sheds, as a fraction of its own speed. */
  swirl: number
  /** How often it sheds them, against its own puffing frequency. */
  churn: number
  /** Fine-grained stirring between the eddies, as a fraction of the plume's speed. */
  mixing: number
  /** Mean crosswind at 1.5 m, m/s. */
  wind: number
  /** How much the wind wanders and gusts, m/s. */
  gust: number
  /** Smallest ember diameter, mm. */
  sizeMin: number
  /** Largest ember diameter, mm. */
  sizeMax: number
  /** How hard a tumbling ember flutters, and how much it twinkles doing it. */
  flutter: number
  /** Temperature an ember leaves the bed at, kelvin. */
  heat: number
  /** How fast an ember consumes itself. Its lifetime, from the other end. */
  burn: number
  /** How much airflow fans an ember: brighter, and shorter lived. */
  breath: number
  /** Metres across the shorter side of the frame. */
  span: number
  /** Hue the whole blackbody locus is rotated to, degrees. */
  hue: number
  /** Spread of hue across the population, degrees of standard deviation. */
  hueSpread: number
  /** Exposure, against a 1500 K ember. */
  exposure: number
  /** How much halo a bright ember throws. */
  flare: number
  /** Fraction of the previous frame kept, per 60th of a second. */
  trail: number
  mark: Mark
}

export type NumericKey = Exclude<keyof Settings, "mark">

/** The rows, in the kit's vocabulary. */
export type Control = KitControl<string & keyof Settings>

/** Numeric rows only — the ones with bounds to report and a handle to drag. */
export type NumericControl = SliderControl<NumericKey> | RangeControl<NumericKey>

export const isNumericControl = (control: Control): control is NumericControl =>
  control.kind === "slider" || control.kind === "range"

/** Panel headings, in order. */
export const GROUPS = ["fire", "air", "embers", "picture"] as const

export const CONTROLS: Control[] = [
  {
    kind: "slider",
    key: "count",
    group: "fire",
    label: "embers",
    min: 100,
    max: 6000,
    step: 10,
    scale: "log",
    format: (v) => String(Math.round(v)),
    hint: "Most embers alive at once. It is a ceiling rather than a target — how many are actually up is decided by how fast the bed is sputtering against how quickly they burn out and how soon they leave the frame. Raise it and a busy fire gets busier; a calm one does not notice.",
  },
  {
    kind: "slider",
    key: "sputter",
    group: "fire",
    label: "sputter",
    min: 0,
    max: 4,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "The steady background: char flakes lifting off the bed with almost no speed of their own and being handed straight to the air. Most of the population, and the least eventful single ember. At zero the only embers are the ones splinters and bursts throw.",
  },
  {
    kind: "slider",
    key: "pops",
    group: "fire",
    label: "splinters",
    min: 0,
    max: 8,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}/s`,
    hint: "Splinters a second. A pocket of gas trapped in a coal reaches pressure and bursts, throwing a tight fan of small hot fragments at several metres a second — the ones that shoot up and outrun the column before their own drag catches them. Turn it up for a fire that spits.",
  },
  {
    kind: "slider",
    key: "bursts",
    group: "fire",
    label: "bursts",
    min: 0,
    max: 30,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}/min`,
    hint: "Bursts a minute. The fire itself surges: the plume swells, the gas gets hotter, the firelight brightens and a slug of embers goes up together on a rising pair of vortices. The one event that changes the air rather than just adding to it.",
  },
  {
    kind: "slider",
    key: "bed",
    group: "fire",
    label: "fire width",
    min: 0.08,
    max: 4,
    step: 0.01,
    scale: "log",
    format: (v) => (v < 1 ? `${Math.round(v * 100)}cm` : `${v.toFixed(2)}m`),
    hint: "How wide the fire is, in metres. It sets the whole scale of the plume — a narrow fire makes a thin fast column, a wide one a broad slow bloom — and it sets how often the column pulses, because a fire puffs at about 1.5 over the square root of its width, in hertz. A wide fire therefore breathes slowly.",
  },
  {
    kind: "slider",
    key: "hearth",
    group: "fire",
    label: "hearth",
    min: 0,
    max: 2,
    step: 0.02,
    format: (v) => `${Math.round(v * 100)}cm`,
    hint: "How far below the bottom edge of the picture the fire sits. At zero you watch embers appear; further down they arrive already moving, out of a fire you cannot see, which is the point of the framing. Past about half a metre the bottom of the frame is above the fast part of the column.",
  },
  {
    kind: "slider",
    key: "firelight",
    group: "fire",
    label: "firelight",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "The light the unseen fire throws up into the bottom of the frame. It leans with the column when there is a wind, and it brightens when the fire surges, so it is the only thing in the picture that says a burst was the fire's doing. At zero the embers arrive out of nothing.",
  },
  {
    kind: "slider",
    key: "updraft",
    group: "air",
    label: "updraft",
    min: 0,
    max: 16,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}m/s`,
    hint: "How fast the hot air is rising just above the coals. Everything above that is decided for you: a buoyant plume slows as the cube root of height, so this number is also the height at which any given ember stops being able to keep up and starts to fall. An ember whose terminal speed is 2 m/s rides until the column is doing less than 2 m/s.",
  },
  {
    kind: "slider",
    key: "spread",
    group: "air",
    label: "plume spread",
    min: 0.01,
    max: 0.5,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How fast the column widens as it entrains the still air around it. Around an eighth is what a real plume does. Low values keep a tight jet that carries embers a long way up; high values fray it into a broad slow bloom close to the fire, because widening and slowing are the same conservation law.",
  },
  {
    kind: "slider",
    key: "swirl",
    group: "air",
    label: "swirl",
    min: 0,
    max: 2.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How strong the eddies are, as a fraction of the column's own speed. These are the shear layer rolling up at the plume's edges and the counter-rotating pairs the fire puffs out, and they are what give an ember its wandering, always-changing direction. At zero the air is a smooth plume and the embers rise in obedient arcs.",
  },
  {
    kind: "slider",
    key: "churn",
    group: "air",
    label: "churn",
    min: 0,
    max: 3,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How often eddies are shed, against the fire's own puffing frequency. Low values give a few large slow structures the embers ride for a long time; high values give a crowd of small ones and a much less legible flow. It changes the character far more than swirl does.",
  },
  {
    kind: "slider",
    key: "mixing",
    group: "air",
    label: "mixing",
    min: 0,
    max: 1.5,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "Fine-grained stirring underneath the eddies — the scales too small to see as a swirl, which show up instead as embers refusing to travel in a straight line. Sized off the fire rather than the frame, and paced so small structures turn over faster than large ones, which is what turbulence actually does.",
  },
  {
    kind: "slider",
    key: "wind",
    group: "air",
    label: "wind",
    min: -4,
    max: 4,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "Crosswind, quoted at head height. It follows a logarithmic profile over rough ground, so it is nearly still at the coals and stronger with height — which is why embers lean over as they climb rather than being pushed sideways as a block. It also bends the column itself, by exactly the distance it carries a parcel in the time that parcel takes to rise.",
  },
  {
    kind: "slider",
    key: "gust",
    group: "air",
    label: "gusts",
    min: 0,
    max: 5,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "How much the wind wanders and gusts around its mean. A slow multi-scale drift, plus discrete gusts that arrive over a second or two, lean the whole column, and pass. Because airflow both fans an ember and consumes it, a gust brightens the field and then thins it.",
  },
  {
    kind: "range",
    keys: ["sizeMin", "sizeMax"],
    group: "embers",
    label: "size",
    min: 0.4,
    max: 14,
    step: 0.1,
    format: (from, to) => `${from.toFixed(1)}–${to.toFixed(1)}mm`,
    hint: "Ember diameters, in millimetres. Size is not really about how big they look — at these framings almost every ember is about a pixel across, and what you see is its glow. It is about weight: terminal speed goes as the square root of diameter, so this is the range of things the column has to lift, and the large end is what falls back.",
  },
  {
    kind: "slider",
    key: "flutter",
    group: "embers",
    label: "flutter",
    min: 0,
    max: 2,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How hard a tumbling ember flutters. A flake presents a changing area as it turns, so it briefly hangs and briefly drops, and its lift reverses each half turn. The same tumble is what makes it twinkle, because an almost edge-on flake is showing you almost nothing — so this is a brightness control as much as a motion one.",
  },
  {
    kind: "slider",
    key: "heat",
    group: "embers",
    label: "heat",
    min: 900,
    max: 2200,
    step: 10,
    format: (v) => `${Math.round(v)}K`,
    hint: "How hot an ember is when it leaves the fire, in kelvin. Colour and brightness both come out of Planck's law, so this is the only thing that decides them — around 1200 K is a dull red, 1500 an orange spark, above 1900 it clips white in the middle. It does not last: an ember settles within a second to whatever its own burning and the air around it agree on.",
  },
  {
    kind: "slider",
    key: "burn",
    group: "embers",
    label: "burn",
    min: 0.1,
    max: 4,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How fast an ember consumes itself. Combustion is what holds it hot against radiative and convective losses, so this is its lifetime read from the other end: turn it down for embers that ride for a long time and fade slowly, up for a shower of brief bright ones that never reach the top of the frame.",
  },
  {
    kind: "slider",
    key: "breath",
    group: "embers",
    label: "breath",
    min: 0,
    max: 3,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much moving air fans an ember. Airflow is oxygen, so a fast ember burns brighter — and spends itself sooner. It is the reason a gust lights the whole field up and then empties it, and the reason a splinter thrown at eight metres a second is brilliant for a moment and then gone.",
  },
  {
    kind: "slider",
    key: "span",
    group: "picture",
    label: "frame",
    min: 0.6,
    max: 40,
    step: 0.01,
    scale: "log",
    format: (v) => (v < 1 ? `${Math.round(v * 100)}cm` : `${v.toFixed(1)}m`),
    hint: "How much air the frame holds, in metres across its shorter side. This is where you stand, and it is the only control that changes what an ember's shape is: at a metre or less they are several pixels across and you can see them tumble, and at twenty they are points of light in a column.",
  },
  {
    kind: "slider",
    key: "hue",
    group: "picture",
    label: "hue",
    min: 0,
    max: 359,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Where the fire's colour sits. Nothing here is a palette: the colours are a blackbody's, computed from its temperature, and this rotates the whole curve to a new hue while leaving its shape alone. So a blue fire still has white-hot sparks and deep dying cinders, and it needs no re-tuning. Around 25° is where real fire lands.",
  },
  {
    kind: "slider",
    key: "hueSpread",
    group: "picture",
    label: "hue spread",
    min: 0,
    max: 90,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "How much the population disagrees about its colour, as a standard deviation in degrees. A little is what a real fire has, since no two embers are burning quite the same thing. A lot lets several colours ride the same flow, which is a different piece using the same air.",
  },
  {
    kind: "slider",
    key: "exposure",
    group: "picture",
    label: "exposure",
    min: 0.05,
    max: 20,
    step: 0.01,
    scale: "log",
    format: (v) => `${v.toFixed(2)}x`,
    hint: "How much light the picture is gathering, against a 1500 K ember. The visible output of a cooling ember falls by orders of magnitude, not by a fraction, so this decides how far down that curve you can still see — a long exposure keeps dull red cinders visible all the way to the ground, a short one leaves only the hottest sparks.",
  },
  {
    kind: "slider",
    key: "flare",
    group: "picture",
    label: "flare",
    min: 0,
    max: 3,
    step: 0.05,
    format: (v) => v.toFixed(2),
    hint: "How much halo a bright ember throws. A point of light is spread by the lens and by the eye, and the spread grows with brightness, which is why a hot ember looks larger than a cool one of the same size. At zero you get bare marks and can see how small an ember really is.",
  },
  {
    kind: "slider",
    key: "trail",
    group: "picture",
    label: "trails",
    min: 0,
    max: 0.96,
    step: 0.02,
    format: (v) => v.toFixed(2),
    hint: "How much of the last frame is kept. At zero every frame stands alone and the embers are points. Turned up, the picture is built out of where they have been — long exposure rather than motion — and the flow itself becomes visible as the lines the embers leave in it.",
  },
  {
    kind: "choice",
    key: "mark",
    group: "picture",
    label: "mark",
    options: /* @__PURE__ */ MARKS.map((mark) => ({ value: mark, label: mark })),
    hint: "What each piece of light is drawn as. The air knows nothing about embers, so this is free: sparks are hard and streaked, motes are soft and round with no body at all, and flakes are wide, slow-turning and edge-on half the time. Nothing about the flow changes.",
  },
]

export const DEFAULT_SETTINGS: Settings = {
  count: 2200,
  sputter: 1.4,
  pops: 1.1,
  bursts: 6,
  bed: 0.55,
  hearth: 0.24,
  firelight: 0.5,
  updraft: 4.6,
  spread: 0.16,
  swirl: 1,
  churn: 1,
  mixing: 0.55,
  wind: 0.15,
  gust: 0.5,
  sizeMin: 0.6,
  sizeMax: 5.2,
  flutter: 0.7,
  heat: 1480,
  burn: 0.8,
  breath: 1,
  span: 4.5,
  hue: 25,
  hueSpread: 5,
  exposure: 2.2,
  flare: 1.5,
  trail: 0.32,
  mark: "ember",
}

/**
 * Starting points, not conclusions.
 *
 * Every one of them states every setting and **inherits from nothing** — not
 * from another preset and not from `DEFAULT_SETTINGS`. Spreading over the
 * defaults reads as tidy and quietly hands every scene's unnamed settings to
 * whatever the defaults become; Psyxels lost four of its six scenes that way.
 * See `../docs/adr/20260830-a-preset-inherits-from-nothing.md`.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "campfire",
    hint: "An ordinary fire on a still evening. The starting point.",
    settings: {
      count: 2200,
      sputter: 1.4,
      pops: 1.1,
      bursts: 6,
      bed: 0.55,
      hearth: 0.24,
      firelight: 0.5,
      updraft: 4.6,
      spread: 0.16,
      swirl: 1,
      churn: 1,
      mixing: 0.55,
      wind: 0.15,
      gust: 0.5,
      sizeMin: 0.6,
      sizeMax: 5.2,
      flutter: 0.7,
      heat: 1480,
      burn: 0.8,
      breath: 1,
      span: 4.5,
      hue: 25,
      hueSpread: 5,
      exposure: 2.2,
      flare: 1.5,
      trail: 0.32,
      mark: "ember",
    },
  },
  {
    label: "bonfire",
    hint: "A wide fire going hard, throwing plumes of embers a long way up.",
    settings: {
      count: 3200,
      sputter: 1.7,
      pops: 2.4,
      bursts: 14,
      bed: 1.6,
      hearth: 0.6,
      firelight: 0.62,
      updraft: 8.4,
      spread: 0.15,
      swirl: 1.25,
      churn: 1.2,
      mixing: 0.6,
      wind: -0.6,
      gust: 1.4,
      sizeMin: 0.5,
      sizeMax: 7.8,
      flutter: 0.75,
      heat: 1620,
      burn: 0.85,
      breath: 1.2,
      span: 11,
      hue: 22,
      hueSpread: 6,
      exposure: 1.5,
      flare: 0.8,
      trail: 0.42,
      mark: "ember",
    },
  },
  {
    label: "night wind",
    hint: "A small fire in a real wind. Nothing gets to go straight up.",
    settings: {
      count: 1900,
      sputter: 1.6,
      pops: 0.8,
      bursts: 4,
      bed: 0.34,
      hearth: 0.18,
      firelight: 0.28,
      updraft: 3.4,
      spread: 0.2,
      swirl: 1.4,
      churn: 1.5,
      mixing: 0.75,
      wind: 1.65,
      gust: 2.6,
      sizeMin: 0.6,
      sizeMax: 3.4,
      flutter: 1.05,
      heat: 1450,
      burn: 1.3,
      breath: 1.6,
      span: 4.4,
      hue: 28,
      hueSpread: 5,
      exposure: 2.2,
      flare: 1.3,
      trail: 0.56,
      mark: "ember",
    },
  },
  {
    label: "coals",
    hint: "Close in over the bed, where an ember is big enough to see turning.",
    settings: {
      count: 1100,
      sputter: 2.2,
      pops: 0.5,
      bursts: 2.5,
      bed: 0.24,
      hearth: 0.06,
      firelight: 0.6,
      updraft: 2.4,
      spread: 0.17,
      swirl: 0.8,
      churn: 0.65,
      mixing: 0.35,
      wind: 0.15,
      gust: 0.4,
      sizeMin: 2.4,
      sizeMax: 11,
      flutter: 1.35,
      heat: 1360,
      burn: 0.55,
      breath: 0.7,
      span: 0.95,
      hue: 20,
      hueSpread: 5,
      exposure: 3.2,
      flare: 0.9,
      trail: 0.22,
      mark: "flake",
    },
  },
  {
    label: "cinder rain",
    hint: "Heavy embers the column cannot hold, zig-zagging back down.",
    settings: {
      count: 2200,
      sputter: 1.5,
      pops: 3.2,
      bursts: 9,
      bed: 0.7,
      hearth: 0.34,
      firelight: 0.3,
      updraft: 2.8,
      spread: 0.26,
      swirl: 1.55,
      churn: 1.35,
      mixing: 0.85,
      wind: -0.8,
      gust: 1.1,
      sizeMin: 3.6,
      sizeMax: 13,
      flutter: 1.6,
      heat: 1560,
      burn: 0.65,
      breath: 0.85,
      span: 5.5,
      hue: 18,
      hueSpread: 4,
      exposure: 2.2,
      flare: 1.3,
      trail: 0.62,
      mark: "ember",
    },
  },
  {
    label: "foxfire",
    hint: "The same air, carrying something that is not fire at all.",
    settings: {
      count: 2600,
      sputter: 1.2,
      pops: 0.3,
      bursts: 7,
      bed: 0.8,
      hearth: 0.4,
      firelight: 0.16,
      updraft: 4.8,
      spread: 0.18,
      swirl: 1.15,
      churn: 0.75,
      mixing: 0.55,
      wind: 0.5,
      gust: 1.2,
      sizeMin: 0.4,
      sizeMax: 2.6,
      flutter: 0.4,
      heat: 1560,
      burn: 0.3,
      breath: 0.35,
      span: 5.5,
      hue: 176,
      hueSpread: 52,
      exposure: 2,
      flare: 2.1,
      trail: 0.5,
      mark: "mote",
    },
  },
]

/**
 * The numeric shape of every setting a handle owns: its bounds, its step, its scale.
 *
 * **Written out rather than derived from `CONTROLS`, and that is the point.**
 * Deriving it makes the whole control list reachable from `normalizeSettings` —
 * labels, hints, `format` closures, option lists — and therefore from anything
 * that validates settings without drawing a panel. It was 30% of starry-night's
 * runner. The cost is that this can disagree with the controls, and the answer
 * is `tests/unit/experiments-grid.test.ts`, which fails when it does.
 */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  count: { min: 100, max: 6000, step: 10, scale: "log" },
  sputter: { min: 0, max: 4, step: 0.05 },
  pops: { min: 0, max: 8, step: 0.1 },
  bursts: { min: 0, max: 30, step: 0.5 },
  bed: { min: 0.08, max: 4, step: 0.01, scale: "log" },
  hearth: { min: 0, max: 2, step: 0.02 },
  firelight: { min: 0, max: 1, step: 0.02 },
  updraft: { min: 0, max: 16, step: 0.1 },
  spread: { min: 0.01, max: 0.5, step: 0.01 },
  swirl: { min: 0, max: 2.5, step: 0.05 },
  churn: { min: 0, max: 3, step: 0.05 },
  mixing: { min: 0, max: 1.5, step: 0.05 },
  wind: { min: -4, max: 4, step: 0.05 },
  gust: { min: 0, max: 5, step: 0.05 },
  sizeMin: { min: 0.4, max: 14, step: 0.1 },
  sizeMax: { min: 0.4, max: 14, step: 0.1 },
  flutter: { min: 0, max: 2, step: 0.05 },
  heat: { min: 900, max: 2200, step: 10 },
  burn: { min: 0.1, max: 4, step: 0.05 },
  breath: { min: 0, max: 3, step: 0.05 },
  span: { min: 0.6, max: 40, step: 0.01, scale: "log" },
  hue: { min: 0, max: 359, step: 1 },
  hueSpread: { min: 0, max: 90, step: 1 },
  exposure: { min: 0.05, max: 20, step: 0.01, scale: "log" },
  flare: { min: 0, max: 3, step: 0.05 },
  trail: { min: 0, max: 0.96, step: 0.02 },
}

/** Bounds for every numeric setting, narrowed from `TRACKS` rather than declared twice. */
export const BOUNDS: Record<NumericKey, { min: number; max: number }> = Object.fromEntries(
  Object.entries(TRACKS).map(([key, track]) => [key, { min: track!.min, max: track!.max }]),
) as Record<NumericKey, { min: number; max: number }>

/**
 * The spacing one setting is stored on, or 0 for a key with no track.
 *
 * Exported because a check that a value is on its grid has to read the grid from
 * the piece rather than re-derive it. Nothing here needs a finer grid than its
 * slider offers: every scene below was recorded against the controls as they
 * stand, which is the one advantage of being the newest piece in the section.
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
 * API, a dragged handle — passes through here, so bounds live in exactly one
 * place and the panel cannot reach a state a URL could not.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = {
    ...merged,
    mark: isMark(merged.mark) ? merged.mark : base.mark,
  }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }

  // A dragged minimum must not overtake the maximum, or the size draw inverts
  // and every ember comes out the same weight.
  if (settings.sizeMin > settings.sizeMax) settings.sizeMax = settings.sizeMin

  return settings
}

/**
 * Keeps the size pair in order, moving whichever end is not being dragged.
 *
 * `normalizeSettings` can only push the maximum up, which fights somebody
 * dragging the maximum down. Here the changed key is known, so the other end
 * gives way.
 */
export function reconcile(next: Settings, changed: keyof Settings): Settings {
  if (changed === "sizeMin" && next.sizeMin > next.sizeMax) return { ...next, sizeMax: next.sizeMin }
  if (changed === "sizeMax" && next.sizeMax < next.sizeMin) return { ...next, sizeMin: next.sizeMax }
  return next
}

/** Whether a change means the drawing sheet has to be re-tinted. */
export const needsSheet = (before: Settings, after: Settings): boolean =>
  before.hue !== after.hue || before.hueSpread !== after.hueSpread

/**
 * **The address registry: append-only, and immutable slot by slot.**
 *
 * Read `@/experiments/address` before touching this. Adding a setting appends a
 * slot and nothing else; removing one marks the slot `retired: true` and leaves
 * it exactly where it is; changing a slot's `grid`, `origin`, `bits` or options
 * means retiring it and appending a replacement with the same key. The slot's
 * *position* is what an address refers to, so there is no version field and none
 * is needed. `tests/unit/experiments-address.test.ts` snapshots this and fails
 * any edit that is not an append.
 */
export const REGISTRY: readonly Slot[] = [
  { key: "count", kind: "num", grid: 10, origin: 100, bits: 10 },
  { key: "sputter", kind: "num", grid: 0.05, origin: 0, bits: 7 },
  { key: "pops", kind: "num", grid: 0.1, origin: 0, bits: 7 },
  { key: "bursts", kind: "num", grid: 0.5, origin: 0, bits: 6 },
  { key: "bed", kind: "num", grid: 0.01, origin: 0.08, bits: 9 },
  { key: "hearth", kind: "num", grid: 0.02, origin: 0, bits: 7 },
  { key: "firelight", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "updraft", kind: "num", grid: 0.1, origin: 0, bits: 8 },
  { key: "spread", kind: "num", grid: 0.01, origin: 0.01, bits: 6 },
  { key: "swirl", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "churn", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "mixing", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "wind", kind: "num", grid: 0.05, origin: -4, bits: 8 },
  { key: "gust", kind: "num", grid: 0.05, origin: 0, bits: 7 },
  { key: "sizeMin", kind: "num", grid: 0.1, origin: 0.4, bits: 8 },
  { key: "sizeMax", kind: "num", grid: 0.1, origin: 0.4, bits: 8 },
  { key: "flutter", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "heat", kind: "num", grid: 10, origin: 900, bits: 8 },
  { key: "burn", kind: "num", grid: 0.05, origin: 0.1, bits: 7 },
  { key: "breath", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "span", kind: "num", grid: 0.01, origin: 0.6, bits: 12 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "hueSpread", kind: "num", grid: 1, origin: 0, bits: 7 },
  { key: "exposure", kind: "num", grid: 0.01, origin: 0.05, bits: 11 },
  { key: "flare", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "trail", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "mark", kind: "enum", options: MARKS },
]

/**
 * The address that carries this scene, packed.
 *
 * Opaque on purpose — `../docs/adr/20260906-an-address-is-packed-not-readable.md`.
 * It states **every** setting, whatever its value: a link resting on a default
 * is a link whose scene changes the day that default does, in a bookmark
 * belonging to somebody who is not watching.
 */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  params.set("s", encodeScene(REGISTRY, settings))
  return params
}

/**
 * Reads settings from a query string.
 *
 * The packed parameter wins when it is there and readable; a corrupt one
 * degrades to the defaults rather than throwing in a page's first statement.
 * The named-parameter form is read too, so a link written by hand or by an
 * older piece still restores its scene.
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
 * An absent param is `null` and `Number(null)` is 0, which is a legal value for
 * most of these — so absent, blank and unparseable are all skipped and the
 * default survives.
 */
function settingsFromNamedQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}

  const mark = params.get("mark")
  if (isMark(mark)) patch.mark = mark

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }

  return normalizeSettings(patch)
}

/** The address that restores exactly these settings. */
export function urlForSettings(settings: Settings, pathname: string): string {
  const query = settingsToQuery(settings).toString()
  return `${pathname}${query ? `?${query}` : ""}`
}

/** Whether a query string names any setting at all. */
function namesASetting(params: URLSearchParams): boolean {
  const packed = params.get("s")
  if (packed !== null && packed !== "" && decodeScene(REGISTRY, packed)) return true
  if (isMark(params.get("mark"))) return true
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * The scene a freshly-opened URL should show.
 *
 * `featured` says the caller should rewrite the address, so a landing visitor
 * leaves with a URL describing the fire in front of them rather than one
 * standing for "whatever is featured".
 */
export function settingsForLanding(params: URLSearchParams): { settings: Settings; featured: boolean } {
  if (namesASetting(params)) return { settings: settingsFromQuery(params), featured: false }
  return { settings: normalizeSettings(PRESETS[0]!.settings), featured: true }
}
