import { TIMESCALE_SLOT, timescaleControl, timescaleTrack } from "@/experiments/kit/speed"
import type { Corner, InsetShape } from "@/experiments/artdeco/frame"
import { clamp, onTracks, oneOf, packedAddress, reroller } from "@/experiments/settings-plumbing"
import type { Slot } from "@/experiments/address"
import type { Control as KitControl, SliderControl, Track } from "@/experiments/kit/controls"
import type { Chrome } from "@/experiments/piece"

/**
 * The clock rate this piece's 1× stands for, as a multiple of real time. The
 * kit's speed control scales it — `kit/speed.ts`.
 */
export const CLOCK_RATE = 1

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
export type Fold = "1" | "2" | "3" | "4" | "6"
export type Reach = "centre" | "edges"
export type ThriceOf = "any" | "branch" | "turn" | "echo"
export type StrandsOn = "all" | "stems"
export type Sides = "copies" | "own"
export type Pen = "line" | "tips"
export type Unison = "family" | "all"
export type CornerAt = "turns" | "splits" | "both"
export type Mark = "ring" | "solid" | "cutout"
export type HaloMeets = "pass" | "meet"
export type Cycle = "hold" | "flow"
export type Vary = "new" | "same"
export type FrameShape = "box" | "oval"
export type AtFrame = "stop" | "rebound" | "both"
export type Backdrop = "dark" | "clear"
export type Outline = "none" | "line" | "double"
export type { Corner, InsetShape } from "@/experiments/artdeco/frame"

export type Settings = {
  /** Order of the symmetry: 1 mirrors left and right, 2 top and bottom too, 3 and up turn it round the centre. */
  fold: Fold
  /** Centre: the copies are turned about the centre, stems on a circle of the height. Edges: each slides out until its stem starts at the frame's edge. */
  reach: Reach
  /** At 4: whether the left and right are turned copies of the bottom, or grow from the side edges deciding for themselves. */
  sides: Sides
  /** Share of the stem gap a pair of stems may stray by, drawn afresh for each drawing. */
  wander: number
  /** A tendency upwards: upright stretches grow up to four times as long, and at these odds a turn leans back towards upright. */
  rise: number
  /** Odds a decision is made three times running. */
  thrice: number
  /** Which decisions can come in threes. */
  thriceOf: ThriceOf
  /** Distance between the three, as a share of the step. */
  beat: number
  /** How far the big circle's radius strays from `halo`, drawn afresh for each drawing. */
  haloVary: number
  /** Visible lines near a point, counting every drawing and image, at which it counts as fully crowded. */
  crowd: number
  /** Extra odds of stopping, at decisions and meetings, where it is fully crowded. */
  hush: number
  /** Odds, where it is fully crowded, that a line a tip crosses starts dissolving from the crossing. */
  infect: number
  /** Odds dissolving passes into the next line at each joint or turn it reaches. */
  contagion: number
  /** Odds each drawing has the big circle. */
  haloOdds: number
  /** How far the big circle's height wanders from drawing to drawing, up to a quarter of the frame at 1. */
  haloDrift: number
  /** How strongly each circle nearby discourages a new small one. */
  shy: number
  /** Line: stopping ends a line. Tips: stopping lifts the pen, and the tip flies on, deciding, until it lands. */
  pen: Pen
  /** Tips pen: odds a lifted tip puts the pen down at each decision. */
  land: number
  /** Tips pen: decisions a lifted tip may make without landing before it dies. */
  flight: number
  /** Decisions of life a split takes from each of the lines it makes, and of flight from a flying one's. */
  toll: number
  /** Tips pen: most tips that may fly lifted at once; a flying split beyond it makes nothing. */
  flock: number
  /** Generations from a stem whose tips are drawn as dots. */
  dotsTo: number
  /** Radius of a dot drawn on every tip, in css px; 0 for none. */
  tipSize: number
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
  /** Relative odds of what a tip does when it meets a line already drawn; the line decides each time. */
  onStop: number
  onCross: number
  onRebound: number
  /** Odds a corner gets a circle centred on it. */
  corner: number
  /** Which corners can: where a line turns or rebounds, where it splits, or both. */
  cornerAt: CornerAt
  /** Odds a stretch between decisions gets a circle somewhere along it. */
  along: number
  /** Radius of a small circle, in per cent of the frame's height. */
  radius: number
  /** How far a small circle's radius strays from `radius`, as a share of it. */
  jitter: number
  /** How a small circle is drawn. */
  mark: Mark
  /** Radius of one big circle on the centre line, in per cent of the height; 0 for none. */
  halo: number
  /** Height of the big circle's centre above the bottom, in per cent of the height. */
  haloAt: number
  /** Whether lines pass the big circle or meet it as they meet a line. */
  haloMeets: HaloMeets
  /** How the big circle is drawn. */
  haloMark: Mark
  /** Line width of a stem, in css px. */
  width: number
  /** Share of width lost per generation of branching. */
  taper: number
  /** Lines drawn side by side for each line grown. */
  strands: number
  /** Whether every line is drawn in strands, or only the stems. */
  strandsOn: StrandsOn
  /** Distance between strands, in css px. */
  spacing: number
  /** Step multiplier for each generation of lines. */
  shrink: number
  /** Angles apart a split's lines are from their parent. */
  spread: number
  /** Frame inset, in per cent of the height. */
  margin: number
  /** Width of the band the drawing keeps to, in per cent of the height; the middle inside it stays empty. 0: no frame. */
  frame: number
  /** The empty middle's shape: a box, or the oval inside it. */
  frameShape: FrameShape
  /** The middle's corners: square, cut, stepped, rounded, or the band's corner reaching in as a quarter disc. */
  frameCorner: Corner
  /** How far the corner ornament reaches along each side, in per cent of the height. */
  frameCornerSize: number
  /** Steps in a stepped corner. */
  frameSteps: number
  /** Insets on each side of the middle, where the band reaches in. */
  insets: number
  /** How far an inset reaches into the middle, in per cent of the height. */
  insetDepth: number
  /** An inset's profile. */
  insetShape: InsetShape
  /** Whether the middle's edge is drawn: not at all, as a rule, or as a double rule. */
  outline: Outline
  /** What a line does on reaching the empty middle. */
  atFrame: AtFrame
  /** Dark: the piece's own ground. Clear: nothing behind the lines, for an overlay. */
  backdrop: Backdrop
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
  /** The speed control's value: a multiple of `CLOCK_RATE`. The kit's — `kit/speed.ts`. */
  timescale: number
}

type EnumKey =
  | "pen"
  | "sides"
  | "strandsOn"
  | "fold"
  | "reach"
  | "thriceOf"
  | "angle"
  | "unison"
  | "cornerAt"
  | "mark"
  | "haloMeets"
  | "haloMark"
  | "cycle"
  | "vary"
  | "frameShape"
  | "atFrame"
  | "backdrop"
  | "frameCorner"
  | "insetShape"
  | "outline"
export type NumericKey = Exclude<keyof Settings, EnumKey>

export type Control = KitControl<string & keyof Settings>
export type NumericControl = SliderControl<NumericKey>

export const ANGLES: Angle[] = ["15", "30", "45", "60", "90"]
export const FOLDS: Fold[] = ["1", "2", "3", "4", "6"]
export const REACHES: Reach[] = ["centre", "edges"]
export const THRICE_OFS: ThriceOf[] = ["any", "branch", "turn", "echo"]
export const STRANDS_ONS: StrandsOn[] = ["all", "stems"]
export const SIDESES: Sides[] = ["copies", "own"]
export const PENS: Pen[] = ["line", "tips"]
export const UNISONS: Unison[] = ["family", "all"]
export const CORNER_ATS: CornerAt[] = ["turns", "splits", "both"]
export const MARKS: Mark[] = ["ring", "solid", "cutout"]
export const HALO_MEETS: HaloMeets[] = ["pass", "meet"]
export const CYCLES: Cycle[] = ["hold", "flow"]
export const VARIES: Vary[] = ["new", "same"]
export const FRAME_SHAPES: FrameShape[] = ["box", "oval"]
export const AT_FRAMES: AtFrame[] = ["stop", "rebound", "both"]
export const BACKDROPS: Backdrop[] = ["dark", "clear"]
export const CORNERS: Corner[] = ["square", "chamfer", "steps", "round", "notch"]
export const INSET_SHAPES: InsetShape[] = ["box", "steps", "chevron"]
export const OUTLINES: Outline[] = ["none", "line", "double"]

const SEED_BOUNDS = { min: 0, max: 999_999 }

export const GROUP_ORDER = ["growth", "decisions", "meeting", "busyness", "circles", "line", "cycle", "frame"] as const

const seconds = (v: number) => `${v.toFixed(1)}s`
const unit = (v: number) => v.toFixed(2)
const share = (v: number) => `${v.toFixed(1)}%`

const odds = (
  key: NumericKey,
  label: string,
  hint: string,
  group = "decisions",
  inert?: (settings: Settings) => boolean,
): Control => ({
  kind: "slider",
  key,
  label,
  group,
  min: 0,
  max: 1,
  step: 0.05,
  format: unit,
  hint,
  ...(inert ? { inert } : {}),
})

export const CONTROLS: Control[] = [
  {
    kind: "slider",
    key: "frame",
    label: "frame",
    group: "frame",
    min: 0,
    max: 45,
    step: 0.5,
    format: (v) => (v > 0 ? share(v) : "off"),
    hint: "The margin turned inside out: the drawing keeps to a band this wide round the edges, as a share of the height, and the middle stays empty. Every line, in every copy, meets the middle's edge as it meets the frame's, and a circle that would reach into it is left out. At 3, and at 4 with turned copies, a copy round the centre may start inside the middle and its stems die at once; copies to the edges keeps them out. 0: no frame, the whole screen.",
  },
  {
    kind: "choice",
    key: "frameShape",
    label: "shape",
    group: "frame",
    options: [
      { value: "box", label: "box" },
      { value: "oval", label: "oval" },
    ],
    hint: "The empty middle: a box, its corners square, or the oval that fits inside the box. At 3 and 6 an oval suits the turned copies better.",
    inert: (settings: Settings) => settings.frame <= 0,
  },
  {
    kind: "choice",
    key: "frameCorner",
    label: "corners",
    group: "frame",
    options: [
      { value: "square", label: "square" },
      { value: "chamfer", label: "cut" },
      { value: "steps", label: "stepped" },
      { value: "round", label: "rounded" },
      { value: "notch", label: "notched" },
    ],
    hint: "The middle's corners, which the band fills: square; cut across; stepped, a staircase of blocks; rounded; or notched, the band's corner reaching into the middle as a quarter disc. Box only.",
    inert: (settings: Settings) => settings.frame <= 0 || settings.frameShape === "oval",
  },
  {
    kind: "slider",
    key: "frameCornerSize",
    label: "corner size",
    group: "frame",
    min: 0,
    max: 30,
    step: 0.5,
    format: share,
    hint: "How far the corner ornament reaches along each side, as a share of the height.",
    inert: (settings: Settings) =>
      settings.frame <= 0 || settings.frameShape === "oval" || settings.frameCorner === "square",
  },
  {
    kind: "slider",
    key: "frameSteps",
    label: "steps",
    group: "frame",
    min: 1,
    max: 8,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "How many steps a stepped corner takes.",
    inert: (settings: Settings) =>
      settings.frame <= 0 || settings.frameShape === "oval" || settings.frameCorner !== "steps",
  },
  {
    kind: "slider",
    key: "insets",
    label: "insets",
    group: "frame",
    min: 0,
    max: 6,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "Places on each side where the band reaches into the middle, spaced evenly between the corners. Lines rebound off them like any other edge, so they grow round them. Box only.",
    inert: (settings: Settings) => settings.frame <= 0 || settings.frameShape === "oval",
  },
  {
    kind: "slider",
    key: "insetDepth",
    label: "inset depth",
    group: "frame",
    min: 0,
    max: 30,
    step: 0.5,
    format: share,
    hint: "How far each inset reaches into the middle, as a share of the height.",
    inert: (settings: Settings) => settings.frame <= 0 || settings.frameShape === "oval" || settings.insets < 1,
  },
  {
    kind: "choice",
    key: "insetShape",
    label: "inset shape",
    group: "frame",
    options: [
      { value: "box", label: "box" },
      { value: "steps", label: "stepped" },
      { value: "chevron", label: "chevron" },
    ],
    hint: "An inset's profile: a plain box, a ziggurat of three tiers, or a point.",
    inert: (settings: Settings) => settings.frame <= 0 || settings.frameShape === "oval" || settings.insets < 1,
  },
  {
    kind: "choice",
    key: "outline",
    label: "outline",
    group: "frame",
    options: [
      { value: "none", label: "none" },
      { value: "line", label: "rule" },
      { value: "double", label: "double rule" },
    ],
    hint: "Whether the middle's edge is drawn, so lines that end or rebound there meet a line rather than nothing. A double rule adds a second inside the first, the strand spacing twice inside it.",
    inert: (settings: Settings) => settings.frame <= 0,
  },
  {
    kind: "choice",
    key: "atFrame",
    label: "at the middle",
    group: "frame",
    options: [
      { value: "stop", label: "stop" },
      { value: "rebound", label: "rebound" },
      { value: "both", label: "rebound, edges too" },
    ],
    hint: "Stop: a line reaching the empty middle ends there, as at the frame's edge. Rebound: it bounces off, on the angle, so lines run along the band instead of dying at it. Edges too: it bounces off the screen's edge as well, so a line keeps zigzagging along the band until its depth runs out. Every rebound spends one of depth.",
    inert: (settings: Settings) => settings.frame <= 0,
  },
  {
    kind: "choice",
    key: "backdrop",
    label: "backdrop",
    group: "frame",
    options: [
      { value: "dark", label: "dark" },
      { value: "clear", label: "clear" },
    ],
    hint: "Dark: the piece's own ground. Clear: nothing but the lines, so whatever is behind the canvas shows through — a video, a page. Cutout circles cut through to it.",
  },
  {
    kind: "choice",
    key: "fold",
    label: "fold",
    group: "growth",
    options: [
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "6", label: "6" },
    ],
    hint: "The drawing's symmetry. 1: mirrored left and right. 2: top and bottom as well, so the stems come from both edges and meet in the middle. 3, 4, 6: that many copies turned round the centre, each mirrored, like a kaleidoscope. Lines meet every copy of every line. 3 sits best with 15°, 30° or 60°, whose lines stay on the angle when turned by a third.",
  },
  {
    kind: "choice",
    key: "reach",
    label: "copies",
    group: "growth",
    options: [
      { value: "centre", label: "round the centre" },
      { value: "edges", label: "to the edges" },
    ],
    hint: "Round the centre: every copy's stems start as far from the centre as the bottom ones, so at 4 the drawing is a square. To the edges: each copy slides out until its stems start at the edge of the frame, so it fills a wide screen. Only differs at 3 and up.",
    inert: (settings: Settings) =>
      settings.fold === "1" || settings.fold === "2" || (settings.fold === "4" && settings.sides === "own"),
  },
  {
    kind: "choice",
    key: "sides",
    label: "sides",
    group: "growth",
    options: [
      { value: "copies", label: "turned copies" },
      { value: "own", label: "their own" },
    ],
    hint: "At 4 only. Turned copies: the left and right are the bottom turned a quarter round. Their own: stems grow in from the side edges and make their own decisions, mirrored left to right and top to bottom, so the sides are a second drawing that meets the first.",
    inert: (settings: Settings) => settings.fold !== "4",
  },
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
    kind: "slider",
    key: "wander",
    label: "wander",
    group: "growth",
    min: 0,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "How far each pair of stems may stray from its place, as a share of the gap, drawn afresh for each drawing. 0 puts every drawing's stems in the same spots, so each new one grows into what the last left.",
    inert: (settings: Settings) => settings.stems === 1,
  },
  {
    kind: "slider",
    key: "rise",
    label: "rise",
    group: "growth",
    min: 0,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "A tendency to build upwards. Upright lines grow further between decisions, up to four times the step at 1, and at these odds a turn leans back: an upright line keeps going, and a slanting one turns towards upright.",
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
    label: "rate",
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
    kind: "choice",
    key: "pen",
    label: "pen",
    group: "decisions",
    options: [
      { value: "line", label: "line" },
      { value: "tips", label: "tips" },
    ],
    hint: "Line: a line that stops is finished. Tips: stopping only lifts the pen. The tip flies on, still turning, splitting and echoing but drawing nothing and meeting nothing, until it lands and draws again. Tips then end only at the edge or at depth.",
  },
  /* @__PURE__ */ odds(
    "land",
    "land",
    "Tips pen: odds a lifted tip puts the pen down at each decision, starting a new line there.",
    "decisions",
    (settings: Settings) => settings.pen !== "tips",
  ),
  {
    kind: "slider",
    key: "flight",
    label: "flight",
    group: "decisions",
    min: 1,
    max: 30,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "Tips pen: how many decisions a lifted tip may make without landing before it dies. Lifted tips meet nothing, so without this only the edge and depth end them, and splitting ones multiply fast.",
    inert: (settings: Settings) => settings.pen !== "tips",
  },
  {
    kind: "slider",
    key: "toll",
    label: "toll",
    group: "decisions",
    min: 0,
    max: 10,
    step: 1,
    format: (v) => String(Math.round(v)),
    hint: "What a split costs: each line it makes starts this many decisions further through its depth, and a flying tip this much further through its flight, so lines that split often die young.",
  },
  {
    kind: "slider",
    key: "flock",
    label: "flock",
    group: "decisions",
    min: 10,
    max: 1200,
    step: 10,
    format: (v) => (v >= 1200 ? "no limit" : String(Math.round(v))),
    hint: "Tips pen: the most tips that may fly lifted at once, across every drawing on screen. Past it, a flying tip that would split makes nothing and flies on alone, and a line that would lift its pen ends instead.",
    inert: (settings: Settings) => settings.pen !== "tips",
  },
  /* @__PURE__ */ odds(
    "thrice",
    "in threes",
    "Odds a decision is made three times running, a beat apart: an echo of one offshoot becomes three parallel lines, a turn a turn three times over, a branch three pairs. Straight on and stop never repeat.",
  ),
  {
    kind: "choice",
    key: "thriceOf",
    label: "threes of",
    group: "decisions",
    options: [
      { value: "any", label: "any" },
      { value: "branch", label: "branch" },
      { value: "turn", label: "turn" },
      { value: "echo", label: "echo" },
    ],
    hint: "Which decisions can come in threes.",
    inert: (settings: Settings) => settings.thrice === 0,
  },
  {
    kind: "slider",
    key: "beat",
    label: "beat",
    group: "decisions",
    min: 0.05,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "Distance between the three, as a share of the step.",
    inert: (settings: Settings) => settings.thrice === 0,
  },
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
  /* @__PURE__ */ odds(
    "onStop",
    "stops",
    "Odds a tip stops where it meets a line already drawn, its own mirror image included. The line decides at every meeting, and lines that decide together decide this together too.",
    "meeting",
  ),
  /* @__PURE__ */ odds("onCross", "crosses", "Odds a tip carries straight on through the line it meets.", "meeting"),
  /* @__PURE__ */ odds(
    "onRebound",
    "rebounds",
    "Odds a tip reflects off the line it meets, which keeps it on the angle. Off the big circle it reflects to the nearest angle.",
    "meeting",
  ),
  {
    kind: "slider",
    key: "crowd",
    label: "crowded at",
    group: "busyness",
    min: 2,
    max: 40,
    step: 1,
    format: (v) => `${Math.round(v)} lines`,
    hint: "How many visible lines within a short reach of a point, from every drawing still on screen and every copy, make it fully crowded. Fewer counts as partly crowded, in proportion. Lower makes everything count as busy sooner.",
    inert: (settings: Settings) => settings.hush === 0 && settings.infect === 0,
  },
  /* @__PURE__ */ odds(
    "hush",
    "hush",
    "Extra odds of stopping where it is crowded, scaled by how crowded: at a decision the line stops instead, and at a meeting it stops rather than crossing or rebounding.",
    "busyness",
  ),
  /* @__PURE__ */ odds(
    "infect",
    "infect",
    "Odds, scaled by how crowded it is where the tip is, that a line it crosses starts dissolving from the crossing — any visible line, older drawings' included. The gap widens both ways along the line at the speed lines grow.",
    "busyness",
  ),
  {
    kind: "slider",
    key: "contagion",
    label: "contagion",
    group: "busyness",
    min: 0,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "Odds that dissolving, reaching a turn, a split or a place where lines meet, carries on into the line there. Each joint decides once. At 1 a dissolving line takes everything joined to it.",
    inert: (settings: Settings) => settings.infect === 0,
  },
  /* @__PURE__ */ odds("corner", "at corners", "Odds a corner gets a circle centred on it.", "circles"),
  {
    kind: "choice",
    key: "cornerAt",
    label: "corners",
    group: "circles",
    options: [
      { value: "turns", label: "turns" },
      { value: "splits", label: "splits" },
      { value: "both", label: "both" },
    ],
    hint: "Which corners can get a circle: where a line turns or rebounds, where it splits, or both.",
    inert: (settings: Settings) => settings.corner === 0,
  },
  /* @__PURE__ */ odds(
    "along",
    "along lines",
    "Odds a stretch of line between two decisions gets a circle centred somewhere along it.",
    "circles",
  ),
  {
    kind: "slider",
    key: "shy",
    label: "shy",
    group: "circles",
    min: 0,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "How much circles keep their distance: each circle already near (closer than a radius, edge to edge, the big one and mirror images included) makes a new small one this much more likely to be left out. At 1 none ever crowd. A big circle is shy too: at these odds a drawing leaves its own out while an earlier one is still showing, so the old one can dissolve or fade rather than be drawn over.",
    inert: (settings: Settings) => settings.corner === 0 && settings.along === 0 && settings.halo === 0,
  },
  {
    kind: "slider",
    key: "radius",
    label: "radius",
    group: "circles",
    min: 0.5,
    max: 15,
    step: 0.5,
    format: share,
    hint: "Radius of a small circle, as a share of the frame's height.",
    inert: (settings: Settings) => settings.corner === 0 && settings.along === 0,
  },
  {
    kind: "slider",
    key: "jitter",
    label: "jitter",
    group: "circles",
    min: 0,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "How far each small circle's radius strays from the radius, as a share of it. Lines that decide together get circles of one size.",
    inert: (settings: Settings) => settings.corner === 0 && settings.along === 0,
  },
  {
    kind: "choice",
    key: "mark",
    label: "small",
    group: "circles",
    options: [
      { value: "ring", label: "ring" },
      { value: "solid", label: "solid" },
      { value: "cutout", label: "cutout" },
    ],
    hint: "Ring: an outline the lines show through. Solid: a filled disc. Cutout: an outline that hides the lines behind it.",
    inert: (settings: Settings) => settings.corner === 0 && settings.along === 0,
  },
  {
    kind: "slider",
    key: "halo",
    label: "big circle",
    group: "circles",
    min: 0,
    max: 45,
    step: 0.5,
    format: (v) => (v === 0 ? "none" : share(v)),
    hint: "Radius of one big circle on the centre line, as a share of the frame's height. It draws itself up from its lowest point at the speed the lines grow.",
  },
  {
    kind: "slider",
    key: "haloVary",
    label: "circle varies",
    group: "circles",
    min: 0,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "How far the big circle's radius strays from its size, as a share of it, drawn afresh for each drawing.",
    inert: (settings: Settings) => settings.halo === 0,
  },
  /* @__PURE__ */ odds(
    "haloOdds",
    "circle odds",
    "Odds each drawing has the big circle. In flow every drawing draws its own, in the same place, so at 1 it never seems to go; lower and some drawings leave it out, and the last one fades.",
    "circles",
  ),
  {
    kind: "slider",
    key: "haloDrift",
    label: "circle drift",
    group: "circles",
    min: 0,
    max: 1,
    step: 0.05,
    format: unit,
    hint: "How far the big circle's height wanders from drawing to drawing, up to a quarter of the frame either way at 1.",
    inert: (settings: Settings) => settings.halo === 0,
  },
  {
    kind: "slider",
    key: "haloAt",
    label: "big circle at",
    group: "circles",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}%`,
    hint: "Height of the big circle's centre above the bottom of the frame.",
    inert: (settings: Settings) => settings.halo === 0,
  },
  {
    kind: "choice",
    key: "haloMeets",
    label: "lines",
    group: "circles",
    options: [
      { value: "pass", label: "pass it" },
      { value: "meet", label: "meet it" },
    ],
    hint: "Pass it: lines ignore the big circle. Meet it: a line reaching the big circle stops, crosses or rebounds, by the same odds as meeting a line.",
    inert: (settings: Settings) => settings.halo === 0,
  },
  {
    kind: "choice",
    key: "haloMark",
    label: "big",
    group: "circles",
    options: [
      { value: "ring", label: "ring" },
      { value: "solid", label: "solid" },
      { value: "cutout", label: "cutout" },
    ],
    hint: "Ring: an outline the lines show through. Solid: a filled disc. Cutout: an outline that hides the lines behind it.",
    inert: (settings: Settings) => settings.halo === 0,
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
    key: "tipSize",
    label: "tips",
    group: "line",
    min: 0,
    max: 6,
    step: 0.5,
    format: (v) => (v === 0 ? "none" : `${v.toFixed(1)}px`),
    hint: "A dot on every tip while it grows or flies, so lifted tips can be seen.",
  },
  {
    kind: "slider",
    key: "dotsTo",
    label: "dots to",
    group: "line",
    min: 0,
    max: 12,
    step: 1,
    format: (v) => (v >= 12 ? "every tip" : `gen ${Math.round(v)}`),
    hint: "A hierarchy of tips: only those up to this many splits from a stem are drawn as dots, so the first few are seen and the swarm they make is not. 0 shows the stems' tips alone.",
    inert: (settings: Settings) => settings.tipSize === 0,
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
    kind: "choice",
    key: "strandsOn",
    label: "strands on",
    group: "line",
    options: [
      { value: "all", label: "every line" },
      { value: "stems", label: "stems only" },
    ],
    hint: "Every line: all of them are drawn in strands. Stems only: the stems are bands and everything that grows off them a single line.",
    inert: (settings: Settings) => settings.strands === 1,
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
  /* @__PURE__ */ timescaleControl(),
]

export const DEFAULT_SETTINGS: Settings = {
  fold: "1",
  reach: "centre",
  sides: "copies",
  wander: 0,
  rise: 0,
  thrice: 0,
  thriceOf: "echo",
  beat: 0.25,
  haloVary: 0,
  crowd: 12,
  hush: 0,
  infect: 0,
  contagion: 0.5,
  haloOdds: 1,
  haloDrift: 0,
  shy: 0,
  pen: "line",
  land: 0.3,
  flight: 6,
  toll: 0,
  flock: 1200,
  dotsTo: 12,
  tipSize: 0,
  strandsOn: "all",
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
  onStop: 1,
  onCross: 0,
  onRebound: 0,
  corner: 0,
  cornerAt: "turns",
  along: 0,
  radius: 3,
  jitter: 0,
  mark: "ring",
  halo: 0,
  haloAt: 50,
  haloMeets: "pass",
  haloMark: "ring",
  width: 1.5,
  taper: 0.1,
  strands: 1,
  spacing: 3,
  shrink: 1,
  spread: 1,
  margin: 0,
  frame: 0,
  frameShape: "box",
  frameCorner: "square",
  frameCornerSize: 8,
  frameSteps: 3,
  insets: 0,
  insetDepth: 5,
  insetShape: "box",
  outline: "none",
  atFrame: "stop",
  backdrop: "dark",
  cycle: "hold",
  life: 12,
  hold: 6,
  vary: "new",
  hue: 45,
  seed: 1,
  timescale: 1,
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
  onStop: { min: 0, max: 1, step: 0.05 },
  onCross: { min: 0, max: 1, step: 0.05 },
  onRebound: { min: 0, max: 1, step: 0.05 },
  corner: { min: 0, max: 1, step: 0.05 },
  along: { min: 0, max: 1, step: 0.05 },
  radius: { min: 0.5, max: 15, step: 0.5 },
  jitter: { min: 0, max: 1, step: 0.05 },
  halo: { min: 0, max: 45, step: 0.5 },
  wander: { min: 0, max: 1, step: 0.05 },
  rise: { min: 0, max: 1, step: 0.05 },
  thrice: { min: 0, max: 1, step: 0.05 },
  beat: { min: 0.05, max: 1, step: 0.05 },
  haloVary: { min: 0, max: 1, step: 0.05 },
  crowd: { min: 2, max: 40, step: 1 },
  hush: { min: 0, max: 1, step: 0.05 },
  infect: { min: 0, max: 1, step: 0.05 },
  contagion: { min: 0, max: 1, step: 0.05 },
  haloOdds: { min: 0, max: 1, step: 0.05 },
  haloDrift: { min: 0, max: 1, step: 0.05 },
  shy: { min: 0, max: 1, step: 0.05 },
  land: { min: 0, max: 1, step: 0.05 },
  flight: { min: 1, max: 30, step: 1 },
  toll: { min: 0, max: 10, step: 1 },
  flock: { min: 10, max: 1200, step: 10 },
  dotsTo: { min: 0, max: 12, step: 1 },
  tipSize: { min: 0, max: 6, step: 0.5 },
  haloAt: { min: 0, max: 100, step: 1 },
  width: { min: 0.5, max: 8, step: 0.25 },
  taper: { min: 0, max: 0.5, step: 0.05 },
  strands: { min: 1, max: 4, step: 1 },
  spacing: { min: 1, max: 16, step: 0.5 },
  shrink: { min: 0.5, max: 1, step: 0.05 },
  spread: { min: 1, max: 4, step: 1 },
  margin: { min: 0, max: 25, step: 0.5 },
  frame: { min: 0, max: 45, step: 0.5 },
  frameCornerSize: { min: 0, max: 30, step: 0.5 },
  frameSteps: { min: 1, max: 8, step: 1 },
  insets: { min: 0, max: 6, step: 1 },
  insetDepth: { min: 0, max: 30, step: 0.5 },
  life: { min: 1, max: 120, step: 0.5 },
  hold: { min: 0, max: 60, step: 0.5 },
  hue: { min: 0, max: 360, step: 1 },
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

/**
 * An address from before the line chose at each meeting carries one `meet`;
 * it becomes odds of 1 for that choice and 0 for the others.
 */
function fromMeet(patch: Partial<Settings> & { meet?: unknown }): Partial<Settings> {
  const { meet, ...rest } = patch
  if (meet !== "stop" && meet !== "cross" && meet !== "rebound") return rest
  return {
    onStop: meet === "stop" ? 1 : 0,
    onCross: meet === "cross" ? 1 : 0,
    onRebound: meet === "rebound" ? 1 : 0,
    ...rest,
  }
}

export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...fromMeet(patch) }
  const settings: Settings = {
    ...merged,
    angle: oneOf(ANGLES, String(merged.angle), base.angle),
    fold: oneOf(FOLDS, String(merged.fold), base.fold),
    reach: oneOf(REACHES, merged.reach, base.reach),
    sides: oneOf(SIDESES, merged.sides, base.sides),
    pen: oneOf(PENS, merged.pen, base.pen),
    thriceOf: oneOf(THRICE_OFS, merged.thriceOf, base.thriceOf),
    strandsOn: oneOf(STRANDS_ONS, merged.strandsOn, base.strandsOn),
    unison: oneOf(UNISONS, merged.unison, base.unison),
    cornerAt: oneOf(CORNER_ATS, merged.cornerAt, base.cornerAt),
    mark: oneOf(MARKS, merged.mark, base.mark),
    haloMeets: oneOf(HALO_MEETS, merged.haloMeets, base.haloMeets),
    haloMark: oneOf(MARKS, merged.haloMark, base.haloMark),
    cycle: oneOf(CYCLES, merged.cycle, base.cycle),
    vary: oneOf(VARIES, merged.vary, base.vary),
    frameShape: oneOf(FRAME_SHAPES, merged.frameShape, base.frameShape),
    atFrame: oneOf(AT_FRAMES, merged.atFrame, base.atFrame),
    backdrop: oneOf(BACKDROPS, merged.backdrop, base.backdrop),
    frameCorner: oneOf(CORNERS, merged.frameCorner, base.frameCorner),
    insetShape: oneOf(INSET_SHAPES, merged.insetShape, base.insetShape),
    outline: oneOf(OUTLINES, merged.outline, base.outline),
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
  "fold",
  "reach",
  "sides",
  "wander",
  "rise",
  "thrice",
  "thriceOf",
  "beat",
  "haloVary",
  "crowd",
  "hush",
  "infect",
  "contagion",
  "haloOdds",
  "haloDrift",
  "shy",
  "pen",
  "land",
  "flight",
  "toll",
  "flock",
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
  "onStop",
  "onCross",
  "onRebound",
  "corner",
  "cornerAt",
  "along",
  "halo",
  "haloAt",
  "haloMeets",
  "cycle",
  "vary",
  "shrink",
  "spread",
  "margin",
  "frame",
  "frameShape",
  "atFrame",
  "frameCorner",
  "frameCornerSize",
  "frameSteps",
  "insets",
  "insetDepth",
  "insetShape",
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
  { key: "meet", kind: "enum", options: ["stop", "cross", "rebound"], retired: true },
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
  { key: "onStop", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "onCross", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "onRebound", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "corner", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "cornerAt", kind: "enum", options: ["turns", "splits", "both"] },
  { key: "along", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "radius", kind: "num", grid: 0.5, origin: 0.5, bits: 5 },
  { key: "jitter", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "mark", kind: "enum", options: ["ring", "solid", "cutout"] },
  { key: "halo", kind: "num", grid: 0.5, origin: 0, bits: 7 },
  { key: "haloAt", kind: "num", grid: 1, origin: 0, bits: 7 },
  { key: "haloMeets", kind: "enum", options: ["pass", "meet"] },
  { key: "haloMark", kind: "enum", options: ["ring", "solid", "cutout"] },
  { key: "fold", kind: "enum", options: ["1", "2", "3", "4", "6"] },
  { key: "reach", kind: "enum", options: ["centre", "edges"] },
  { key: "wander", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "rise", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "thrice", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "thriceOf", kind: "enum", options: ["any", "branch", "turn", "echo"] },
  { key: "beat", kind: "num", grid: 0.05, origin: 0.05, bits: 5 },
  { key: "haloVary", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "strandsOn", kind: "enum", options: ["all", "stems"] },
  { key: "sides", kind: "enum", options: ["copies", "own"] },
  { key: "crowd", kind: "num", grid: 1, origin: 2, bits: 6 },
  { key: "hush", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "infect", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "contagion", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "haloOdds", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "haloDrift", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "shy", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "pen", kind: "enum", options: ["line", "tips"] },
  { key: "land", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "tipSize", kind: "num", grid: 0.5, origin: 0, bits: 4 },
  { key: "flight", kind: "num", grid: 1, origin: 1, bits: 5 },
  { key: "toll", kind: "num", grid: 1, origin: 0, bits: 4 },
  { key: "flock", kind: "num", grid: 10, origin: 10, bits: 7 },
  { key: "dotsTo", kind: "num", grid: 1, origin: 0, bits: 4 },
  { key: "frame", kind: "num", grid: 0.5, origin: 0, bits: 7 },
  { key: "frameShape", kind: "enum", options: ["box", "oval"] },
  { key: "atFrame", kind: "enum", options: ["stop", "rebound", "both"] },
  { key: "backdrop", kind: "enum", options: ["dark", "clear"] },
  { key: "frameCorner", kind: "enum", options: ["square", "chamfer", "steps", "round", "notch"] },
  { key: "frameCornerSize", kind: "num", grid: 0.5, origin: 0, bits: 6 },
  { key: "frameSteps", kind: "num", grid: 1, origin: 1, bits: 3 },
  { key: "insets", kind: "num", grid: 1, origin: 0, bits: 3 },
  { key: "insetDepth", kind: "num", grid: 0.5, origin: 0, bits: 6 },
  { key: "insetShape", kind: "enum", options: ["box", "steps", "chevron"] },
  { key: "outline", kind: "enum", options: ["none", "line", "double"] },
  // The kit's speed control, appended — `kit/speed.ts`.
  TIMESCALE_SLOT,
]

export const { settingsToQuery, urlForSettings, settingsFromQuery, namesASetting } = packedAddress<Settings>({
  registry: REGISTRY,
  normalize: normalizeSettings,
})

export const reroll = reroller(normalizeSettings, SEED_BOUNDS)

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
