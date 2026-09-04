import {
  keysOf,
  type ChoiceControl,
  type RangeControl,
  type SetControl,
  type SliderControl,
} from "@/experiments/kit/controls"
import {
  FACE_LABELS,
  FACES,
  isFace,
  isPolarity,
  isSubject,
  POLARITIES,
  POLARITY_LABELS,
  SUBJECT_LABELS,
  SUBJECTS,
  type Face,
  type Polarity,
  type SubjectKind,
} from "@/experiments/psyxels/subject"
import { GLYPH_NAMES, indexOfGlyph, isGlyphName, paintGlyph, type GlyphName } from "@/experiments/psyxels/glyphs"

/**
 * Everything tunable, in one place, shared by the engine, the panel and the URL.
 *
 * The piece has two halves and the settings divide along the same line. The
 * **packing** decides where the psyxels are and how big — a still question, asked
 * of a still picture, and the half that decides whether the subject is still
 * recognisable. The **life** decides what a psyx does once it exists — which
 * frame it shows, when it changes, what colour it takes. Nothing in the second
 * half can move a psyx or resize one, which is why a scene can be wound from
 * sober to hallucinating without the letter under it shifting at all.
 */

export type Settings = {
  seed: number
  subject: SubjectKind
  face: Face
  polarity: Polarity
  fill: number
  coarse: number
  levels: number
  detail: number
  variety: number
  threshold: number
  fuzz: number
  flatten: number
  inset: number
  bloom: number
  solid: number
  layers: number
  glow: number
  afterglow: number
  wander: number
  weight: number
  glyphs: GlyphName[]
  morph: number
  ease: number
  churn: number
  flicker: number
  pulse: number
  tempo: number
  wave: number
  hue: number
  spread: number
  edge: number
  edgeHue: number
  wildness: number
  saturation: number
  playback: number
}

export type NumericKey = Exclude<keyof Settings, "subject" | "face" | "polarity" | "glyphs">

export type ControlGroup = "subject" | "packing" | "colour" | "life"

/** The panel's row kinds. A bound pair has no use here; a choice and a set do. */
export type Control = (
  | SliderControl<NumericKey>
  | RangeControl<NumericKey>
  | ChoiceControl<"subject" | "face" | "polarity">
  | SetControl<"glyphs">
) & {
  group: ControlGroup
}

type TrackedControl = (SliderControl<NumericKey> | RangeControl<NumericKey>) & { group: ControlGroup }

/**
 * Whether a control has a track, and therefore bounds.
 *
 * A **positive** test, because the negative one — "anything that is not a
 * choice" — was quietly wrong the moment a third kind without a track arrived,
 * and it was wrong in the two places that matter most: the bounds the validator
 * clamps against, and the bounds the console API reports. Starry Night had
 * already written this predicate for the same reason.
 */
export const isTrackedControl = (control: Control): control is TrackedControl =>
  control.kind === "slider" || control.kind === "range"

export const GROUP_ORDER: ControlGroup[] = ["subject", "packing", "colour", "life"]

/** Widest legal seed. Kept small enough to stay readable in a shared URL. */
export const SEED_BOUNDS = { min: 0, max: 999_999 }

const percent = (value: number) => `${Math.round(value * 100)}%`
const degrees = (value: number) => `${Math.round(value)}°`

/**
 * Fewest marks a scene may be made of.
 *
 * **Two, because one is not a vocabulary.** A psyx is a mini-animation that
 * holds a frame and then picks another, and it never repeats the frame it is
 * showing — so a set of one leaves `nextGlyph` with nowhere to go and the whole
 * moving half of the piece silently stops. The old count could be dragged to 1
 * and did exactly that.
 */
export const LEAST_GLYPHS = 2

/**
 * A mark, drawn small, for its own button in the panel.
 *
 * Painted with `paintGlyph` rather than drawn again as an SVG or a font, so the
 * picker cannot come to disagree with the field about what a mark looks like.
 * White because the kit's chrome is white on dark and a button says which way
 * it is with its background, not with its ink.
 *
 * Only ever called from the panel, which is why a module the unit tests import
 * in Node may reach for a canvas at all.
 */
function glyphIcon(name: GlyphName): Node {
  const side = 18
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  const canvas = document.createElement("canvas")
  canvas.width = side * ratio
  canvas.height = side * ratio
  canvas.style.width = `${side}px`
  canvas.style.height = `${side}px`

  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#fff"
    ctx.fillStyle = "#fff"
    paintGlyph(ctx, indexOfGlyph(name), side / 2, side / 2, side * 0.36, 1.4)
  }
  return canvas
}

export const CONTROLS: Control[] = [
  {
    kind: "choice",
    group: "subject",
    key: "subject",
    label: "subject",
    options: SUBJECTS.map((value) => ({ value, label: SUBJECT_LABELS[value] })),
    hint: "What is underneath. A letterform and a photograph go through exactly the same machinery: the picture is read as coverage, and coverage is what the packing subdivides. Black is not a dark subject, it is no subject — which is why the portrait's shadows are bare ground rather than dark psyxels.",
  },
  {
    kind: "choice",
    group: "subject",
    key: "face",
    label: "face",
    options: FACES.map((value) => ({ value, label: FACE_LABELS[value] })),
    hint: "Which letterform the subject is drawn with. It is asked for as a kind of shape rather than a named font, so the machine supplies whatever it has of that kind — and the character is what survives being packed: a grotesque gives even strokes and a hard silhouette, a roman gives thick-and-thin and serifs that break into separate psyxels, a script gives a stroke that changes width as it turns. Ignored by the portrait, which is not typeset.",
  },
  {
    kind: "set",
    group: "subject",
    key: "glyphs",
    label: "glyphs",
    least: LEAST_GLYPHS,
    options: GLYPH_NAMES.map((value) => ({ value, label: value.replace("-", " "), icon: () => glyphIcon(value) })),
    hint: "Which marks a psyx may show. It was a count before — how many to take from the front of the list — so the only way to be rid of one mark was to be rid of everything after it as well. Two is the floor: at one there is nothing to change to, and a psyx that cannot change is not what this piece is made of. A small set is a field with a strong accent and you read the changes; a large one is closer to texture than to signs.",
  },
  {
    kind: "choice",
    group: "subject",
    key: "polarity",
    label: "polarity",
    options: POLARITIES.map((value) => ({ value, label: POLARITY_LABELS[value] })),
    hint: "Which side of the subject the psyxels are made of. On ink they fill the subject and the ground stays bare. On void the picture is turned inside out before the packing ever sees it: the whole frame is psyxels and the subject is the hole left in them, read the way a stencil is read. Nothing downstream knows — the packing still spends its small psyxels along the same contours, only now from the other side of them.",
  },
  {
    kind: "slider",
    group: "subject",
    key: "fill",
    label: "fill",
    min: 0.25,
    max: 1,
    step: 0.01,
    format: percent,
    hint: "How much of the frame's shorter side the subject takes. The psyxels do not scale with it, so winding this up is not a zoom: it hands the same subject more psyxels to be made of, and the same letter becomes coarse or fine as you drag.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "coarse",
    label: "biggest",
    min: 0.015,
    max: 0.6,
    step: 0.001,
    scale: "log",
    /**
     * Shown as a position on its own track rather than as what it is.
     *
     * It *is* a share of the frame's shorter side, and saying so — "12.0% of
     * frame" — was both too long for the value column and more than anyone
     * dragging it wants to know. It took the piece's author a while to find that
     * this was the control for how big the biggest psyx is, which is a labelling
     * failure and not a naming one: right is right, left is left, and the number
     * is only there to be returned to.
     */
    format: (value) => String(Math.round(100 * (Math.log(value / 0.015) / Math.log(0.6 / 0.015)))),
    hint: "How big the biggest psyx can be, and the size of the grid everything else is subdivided out of. Measured as a share of the frame's shorter side, so what the artwork is made of stays the same in a small window and a large one. Wide with few levels gives a blocky sign; wide with many levels gives the widest spread of sizes, which is what makes the field look packed rather than gridded.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "levels",
    label: "levels",
    min: 0,
    max: 5,
    step: 1,
    format: (value) => (value === 0 ? "none" : `${value} deep`),
    hint: "How many times a square may be quartered. The smallest psyx is the coarse size halved this many times, so levels and coarse together set the whole range of sizes in the picture. At zero every psyx is the coarse size and the piece is an ordinary low-resolution image.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "detail",
    label: "detail",
    min: 0,
    max: 1,
    step: 0.01,
    format: percent,
    hint: "How readily unevenness forces a square to split. This is the control that keeps the subject recognisable: a square straddling an edge is uneven, so detail spends small psyxels along contours and lets flat interiors stay huge. Wind it down and the letter dissolves into blocks that are honestly averaged and no longer legible.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "variety",
    label: "variety",
    min: 0,
    max: 1,
    step: 0.01,
    format: percent,
    hint: "How often a square divides for no reason at all. Detail alone gives an orderly picture — fine at the edges, coarse in the middle — and this is what breaks that up, subdividing squares that had no need of it: the difference between a compression artefact and a field with a mind of its own. At 100% the sizes are as mixed as they get, not as fine as they get. It stops short of dividing everything on purpose, because a field of one size has no variety in it whichever size that is — for nothing but fine psyxels, bring `coarse` down instead.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "threshold",
    label: "threshold",
    min: 0,
    max: 0.9,
    step: 0.01,
    format: percent,
    hint: "How much of a square has to be inside the subject before a psyx appears there at all. Low, the letter wears a fringe of psyxels hanging off its edges and grows fatter than it was drawn; high, its edges are eaten back and thin strokes break up. The frontier of the piece: a psyx is allowed outside the letter, but not so far that it stops being one.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "fuzz",
    label: "fuzz",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "hard" : `${Math.round(value * 100)}%`),
    hint: "How wide the band of doubt around the threshold is. At 0 a psyx is inside the artwork or it does not exist, and the field ends on a line as exact as the letter's own — the one place it stops looking packed and starts looking clipped. Wound up, a psyx near the boundary is there by its own luck, so the edge becomes a scatter thinning outward with psyxels hanging off the artwork entirely. Each one decides once and keeps its answer, so the fringe shimmers on the repacking's clock rather than every frame.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "flatten",
    label: "flatten",
    min: 0,
    max: 1,
    step: 0.01,
    format: percent,
    hint: "How much a psyx ignores how much subject is under it. At zero it is exactly as bright as its share of ink, which is what a photograph wants — the portrait keeps its tones. At one every surviving psyx burns at full strength, which is what a letter wants: flat white, hard edge, no grey fringe.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "inset",
    label: "spacing",
    min: -0.4,
    max: 0.45,
    step: 0.01,
    format: (value) =>
      value === 0 ? "flush" : value > 0 ? `${Math.round(value * 100)}% gap` : `${Math.round(-value * 100)}% over`,
    hint: "How much room a mark leaves inside its own square, or takes beyond it. Positive is a gap, and a little of it is what makes the field read as separate psyxels rather than as a drawing. Negative is an overlap: marks spill across their squares into their neighbours, which is the only thing that dissolves the lattice the subdivision leaves behind — and the fastest way to close the black ground a large mark otherwise sits in. The key is still `inset` in a shared link, which is what a negative gap was before it had a name.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "bloom",
    label: "bloom",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "none" : `${Math.round(value * 100)}%`),
    hint: "How much of a dim, far wider version of itself a large psyx lays down behind its mark. A mark's ink is a fixed share of its own square, so the same drawing reads as tone at seven screen pixels and as a thin sign in a black hole at a hundred — and the hole is what makes a large psyx demand attention out of all proportion to what it is standing in for. This fills it, in the shape of the mark rather than as a patch, and it is weighted by size so the fine grain is left alone.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "layers",
    label: "layers",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "leaves" : `${Math.round(value * 100)}%`),
    hint: "How strongly the squares that divided still show their own mark. A psyx covers its square exactly but its mark does not, and the larger the square the more of it is ground — so at zero a big mark is a sign in a hole. Wound up, the coarse marks come back over the grain that replaced them and what shows through the gaps in a big one is the finer psyxels underneath. Every level at once is the whole subdivision visible in one picture, which is a different piece and worth seeing.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "solid",
    label: "solid",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "drawn" : `${Math.round(value * 100)}%`),
    hint: "How much a psyx is a filled tile with its sign knocked out of it, rather than a sign drawn on the ground. At 0 it is ink on black and its square is mostly empty. At 1 the square is solid colour and the mark is a hole in it, which is the only setting that fills the picture completely — and it covers whatever a neighbour has spilled underneath, so a large psyx knocks out the grain it overlaps. The tile moves with the mark, not with the square, so a wandering psyx takes its ground with it.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "wander",
    label: "wander",
    min: 0,
    max: 0.6,
    step: 0.01,
    format: (value) => (value === 0 ? "centred" : `${Math.round(value * 100)}%`),
    hint: "How far a mark may sit from the centre of its own square. The packing is a subdivision, so the squares are a lattice and a coarse psyx can only ever appear in a handful of places, which the eye learns in seconds. This breaks that without touching the cover: every square still answers for its own patch of the picture, and what is drawn for it is simply not centred. Far enough and marks cross into each other, which is the piece's only overlap.",
  },
  {
    kind: "slider",
    group: "packing",
    key: "weight",
    label: "weight",
    min: 0.03,
    max: 0.34,
    step: 0.005,
    format: (value) => `${(value * 100).toFixed(1)}%`,
    hint: "Stroke thickness, as a fraction of a psyx's own size — so a three-psyx mark and a two-hundred-psyx one are the same drawing at different scales. Heavy, the small psyxels clot into solid blobs and the field reads as tone; light, everything reads as line work.",
  },
  {
    kind: "slider",
    group: "life",
    key: "flicker",
    label: "flicker",
    min: 0,
    max: 10,
    step: 0.05,
    format: (value) => (value === 0 ? "held" : `${value.toFixed(2)}/s`),
    hint: "How often a psyx picks a new frame, on average and per psyx — each one runs at its own rate around this, so the field never changes in step. A psyx never repeats its current frame and prefers one a single feature away, so it grows a stroke or a ring rather than being swapped for something unrelated.",
  },
  {
    kind: "slider",
    group: "life",
    key: "morph",
    label: "morph",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "cut" : `${Math.round(value * 100)}%`),
    hint: "How much of a psyx's hold is spent changing frame rather than showing one. A frame is a set of features — strokes, a ring, a fill — so a change can be played instead of cut: a stroke grows out of the middle, a ring opens from the centre, and the colour slides across at the same time. At 0 the frames snap, which is what the piece did first and is worth seeing once. Wound up, the field never quite settles and reads as continuous rearrangement.",
  },
  {
    kind: "slider",
    group: "life",
    key: "ease",
    label: "ease",
    min: 0.2,
    max: 6,
    step: 0.01,
    scale: "log",
    format: (value) => `${value.toFixed(2)}x`,
    hint: "How long every transition takes, without changing how often anything happens. A psyx arriving, a psyx going, a frame turning into the next one: all of them were a fixed length in the piece's own seconds, so the only way to lengthen one was to slow the whole clock — which slows the *events* too, and a faster flicker at a slower playback is not the same picture. Wound up, a busy field moves like treacle; wound down, it snaps.",
  },
  {
    kind: "slider",
    group: "life",
    key: "churn",
    label: "churn",
    min: 0,
    max: 90,
    step: 0.5,
    format: (value) => (value === 0 ? "fixed" : `${value.toFixed(0)}/min`),
    hint: "How often the packing is reconsidered: a square deciding to quarter itself, or four deciding to become one. This is the slow motion in the piece and the one that alters the picture rather than its surface — the letter is repacked out of different psyxels while you watch, and the newcomers arrive growing into place.",
  },
  {
    kind: "slider",
    group: "life",
    key: "pulse",
    label: "pulse",
    min: 0,
    max: 1,
    step: 0.01,
    format: percent,
    hint: "How deeply a psyx breathes between dim and full. Every psyx has its own phase and its own rate, so at any depth the field shimmers rather than blinking; this is only how far it swings.",
  },
  {
    kind: "slider",
    group: "life",
    key: "tempo",
    label: "tempo",
    min: 0.02,
    max: 3,
    step: 0.01,
    scale: "log",
    format: (value) => `${value.toFixed(2)}Hz`,
    hint: "How fast the breathing is. Slow is a field that seems to be thinking; fast is a field that seems to be transmitting. Around one cycle a second it stops reading as a pulse and starts reading as flicker, which is a different piece and worth visiting.",
  },
  {
    kind: "slider",
    group: "life",
    key: "wave",
    label: "wave",
    min: 0,
    max: 1,
    step: 0.01,
    format: percent,
    hint: "How much neighbouring psyxels breathe together. At zero every psyx is alone and the field simmers evenly; wound up, the phase becomes a slope across the picture and the pulse arrives as a wave crossing it. The subject does not move — only the light passing over it does.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "hue",
    label: "hue",
    min: 0,
    max: 360,
    step: 1,
    format: degrees,
    hint: "The colour the field is centred on. The chrome takes it too, so the controls belong to whatever scene is running.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "spread",
    label: "colour spread",
    min: 0,
    max: 180,
    step: 1,
    format: degrees,
    hint: "How far a psyx's own colour may wander from the centre, as a spread in degrees around the wheel. Narrow is a tinted monochrome; wide is the whole wheel present at once in one letter, which is the psychedelic end and the reason the piece exists.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "glow",
    label: "glow",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "none" : `${Math.round(value * 100)}%`),
    hint: "How much light the field spills into the space around it. Not a halo drawn per psyx — the whole picture is blurred into a buffer and added back over itself, so what glows is whatever happens to be bright, and two psyxels close together glow more than either would alone. Wound up past about half it is no longer light on a dark ground, it is a lit sign.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "afterglow",
    label: "afterglow",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "instant" : `${Math.round(value * 100)}%`),
    hint: "How long the light takes to leave after the psyx that made it has gone. The buffer the glow is gathered in is faded rather than cleared, so it holds what was there — and a psyx easing out leaves its light behind for a moment, the way a phosphor does. It fades on the piece's own clock, so watching slowly lengthens the trail rather than shortening it.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "edge",
    label: "edge",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "none" : `${Math.round(value * 100)}%`),
    hint: "How strongly a psyx on a boundary is coloured differently from one in the middle of a flat area. The packing already knows where the contours are — unevenness is what makes a square subdivide — so the same number can pick the outline out in another colour. Deliberately not brightness: a psyx half inside the subject is dim, and lighting it because it is also on the edge contradicts what the coverage just said.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "edgeHue",
    label: "edge hue",
    min: -180,
    max: 180,
    step: 1,
    format: (value) => `${value > 0 ? "+" : ""}${Math.round(value)}°`,
    hint: "Which way an edge is shifted around the wheel, at full edge strength. A right angle either way tints the outline without leaving the family; the far end is the complement, which reads as two colours of ink rather than one picture. Zero leaves the accent as saturation alone.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "wildness",
    label: "wildness",
    min: 0,
    max: 1,
    step: 0.01,
    format: percent,
    hint: "How far the psyxels depart from the colour of the subject underneath. At zero they wear it — a white letter is white and the portrait is a portrait. At one they have their own opinions entirely and the subject survives only as a shape. Everything between is the same picture being talked over.",
  },
  {
    kind: "slider",
    group: "colour",
    key: "saturation",
    label: "saturation",
    min: 0,
    max: 1,
    step: 0.01,
    format: percent,
    hint: "How strong those opinions are. Wildness decides how much of a psyx's colour is its own; this decides whether its own colour is a tint or a shout. At zero the field is greyscale however wild it is.",
  },
  {
    kind: "slider",
    group: "life",
    key: "playback",
    label: "playback",
    min: 0,
    max: 2,
    step: 0.01,
    format: (value) => (value === 0 ? "paused" : `${value.toFixed(2)}x`),
    hint: "How fast you are watching, the way a video player means it. It scales the clock in one place, so the breathing, the frame changes and the repacking all slow by the same factor and every relationship between them survives. At 0 it holds still, which is the only way to look properly at how one psyx was actually packed.",
  },
]

/**
 * The base every partial change is filled in from, and the one a shared link is
 * measured against.
 *
 * **Deliberately not a scene anyone is shown, and deliberately not a preset.**
 * It was both for a while: the featured scene *was* the defaults, and every
 * preset was written as a spread over them — so the day the featured scene
 * changed, every preset that had not named a setting quietly took the new one's
 * value for it. Half of them ended up watched at a quarter speed wearing a light
 * trail meant for something else. What is here now is a plain legible letter
 * with every effect at rest: it is the piece's zero, it is what a hand-written
 * URL naming one setting gets for the rest, and it moves only when the meaning
 * of a control moves.
 *
 * `settingsToQuery` diffs against it, so a scene's address says how far it is
 * from plain — which is why the presets' links are long. That is the right way
 * round: a link should carry the scene, not a reference to whatever is currently
 * first.
 */
export const DEFAULT_SETTINGS: Settings = {
  seed: 8412,
  subject: "A",
  face: "grotesque",
  polarity: "ink",
  fill: 0.82,
  coarse: 0.125,
  levels: 4,
  detail: 0.5,
  variety: 0.71,
  threshold: 0.36,
  fuzz: 0.45,
  flatten: 0.88,
  inset: 0,
  bloom: 0.4,
  solid: 0,
  layers: 0,
  glow: 0,
  afterglow: 0,
  wander: 0.15,
  weight: 0.15,
  glyphs: ["minus", "plus", "circled-minus", "circled-plus"],
  morph: 0.55,
  ease: 1,
  churn: 9,
  flicker: 1.1,
  pulse: 0.5,
  tempo: 0.22,
  wave: 0.35,
  hue: 286,
  spread: 74,
  edge: 0,
  edgeHue: 96,
  wildness: 0.62,
  saturation: 0.8,
  playback: 1,
}

/**
 * Recorded scenes, each written out in full.
 *
 * **No preset inherits from another, and none inherits from `DEFAULT_SETTINGS`.**
 * They were spread over the defaults at first, which reads as tidy and is a
 * trap: the day the featured scene changed, every preset that had not named a
 * setting silently took the new one's value for it, and half of them ended up
 * being watched at a quarter speed with a light trail meant for something else.
 * The section's convention — Flotsam states it in the same words — is that a
 * scene someone found by dragging sliders should stay the scene they found.
 *
 * Position one is only position one. It is what a bare URL lands on, and the
 * page rewrites the address to its full query so a visitor leaves with a link to
 * *that scene* rather than to whatever is featured next month. Nothing else
 * follows from being first.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "alive",
    hint: "Every hue at once, packed fine and overlapping, with the levels above showing through — and a word rather than a letter, so the field has to hold five shapes and the spaces between them.",
    settings: {
      seed: 639953,
      subject: "Alive",
      face: "roman",
      polarity: "ink",
      fill: 0.85,
      coarse: 0.03,
      levels: 4,
      detail: 0.84,
      variety: 0.66,
      threshold: 0.06,
      fuzz: 0.21,
      flatten: 0.65,
      inset: -0.34,
      bloom: 0.04,
      solid: 0.03,
      layers: 0.71,
      glow: 0.25,
      afterglow: 0.06,
      wander: 0.6,
      weight: 0.11,
      glyphs: ["minus", "plus", "circled-minus", "circled-plus", "ring"],
      morph: 0.34,
      ease: 0.37,
      churn: 55.5,
      flicker: 1.15,
      pulse: 0.97,
      tempo: 0.15,
      wave: 0.65,
      hue: 260,
      spread: 180,
      edge: 0.55,
      edgeHue: -138,
      wildness: 0.81,
      saturation: 0.69,
      playback: 1.15,
    },
  },
  {
    label: "neon",
    hint: "Fine grain at a high threshold, half-solid, spread across the whole wheel: tube light rather than ink.",
    settings: {
      seed: 639953,
      subject: "A",
      face: "roman",
      polarity: "ink",
      fill: 0.82,
      coarse: 0.027,
      levels: 2,
      detail: 0.49,
      variety: 0.45,
      threshold: 0.71,
      fuzz: 0.6,
      flatten: 0.31,
      inset: -0.12,
      bloom: 0.2,
      solid: 0.37,
      layers: 0.45,
      glow: 0.35,
      afterglow: 0.4,
      wander: 0.6,
      weight: 0.145,
      glyphs: ["minus", "plus", "circled-minus"],
      morph: 0.83,
      ease: 1,
      churn: 58.5,
      flicker: 10,
      pulse: 1,
      tempo: 1.94,
      wave: 0.35,
      hue: 355,
      spread: 180,
      edge: 0.12,
      edgeHue: 125,
      wildness: 0.61,
      saturation: 1,
      playback: 0.26,
    },
  },
  {
    label: "ampersand",
    hint: "A script ampersand, held still and lit from within: no frame changes at all, only breathing.",
    settings: {
      seed: 639953,
      subject: "&",
      face: "script",
      polarity: "ink",
      fill: 0.79,
      coarse: 0.027,
      levels: 2,
      detail: 0.49,
      variety: 0.45,
      threshold: 0.71,
      fuzz: 0.6,
      flatten: 0.63,
      inset: -0.12,
      bloom: 0.2,
      solid: 0,
      layers: 0.45,
      glow: 0.24,
      afterglow: 0.12,
      wander: 0.6,
      weight: 0.145,
      glyphs: ["minus", "plus", "circled-minus", "circled-plus", "ring", "dot"],
      morph: 0.5,
      ease: 1,
      churn: 59,
      flicker: 0,
      pulse: 0.45,
      tempo: 0.45,
      wave: 0.83,
      hue: 355,
      spread: 180,
      edge: 0.74,
      edgeHue: 125,
      wildness: 1,
      saturation: 0.35,
      playback: 1,
    },
  },
  {
    label: "mono",
    hint: "One hue and almost no colour: the packing and its light, and nothing else to look at.",
    settings: {
      seed: 639953,
      subject: "A",
      face: "typewriter",
      polarity: "ink",
      fill: 0.73,
      coarse: 0.037,
      levels: 3,
      detail: 0.55,
      variety: 0.58,
      threshold: 0.38,
      fuzz: 0.45,
      flatten: 0.88,
      inset: 0.16,
      bloom: 0.2,
      solid: 0,
      layers: 0.45,
      glow: 0.35,
      afterglow: 0.4,
      wander: 0.47,
      weight: 0.06,
      glyphs: ["minus", "plus", "circled-minus"],
      morph: 0.83,
      ease: 1,
      churn: 5,
      flicker: 0.5,
      pulse: 0.3,
      tempo: 1.94,
      wave: 0.35,
      hue: 318,
      spread: 20,
      edge: 0.61,
      edgeHue: -180,
      wildness: 0.03,
      saturation: 0.22,
      playback: 1.92,
    },
  },
  {
    label: "maker",
    hint: "A face at the finest grain the piece has, lit from within and picked out at every contour.",
    settings: {
      seed: 2207,
      subject: "avatar",
      face: "roman",
      polarity: "ink",
      fill: 0.89,
      coarse: 0.018,
      levels: 3,
      detail: 0.82,
      variety: 0.65,
      threshold: 0.72,
      fuzz: 0.38,
      flatten: 0.33,
      inset: 0.33,
      bloom: 0.62,
      solid: 0.14,
      layers: 0.8,
      glow: 0.61,
      afterglow: 0,
      wander: 0.6,
      weight: 0.08,
      glyphs: ["minus", "plus", "circled-minus", "circled-plus", "ring", "dot", "cross", "circled-cross", "bar"],
      morph: 0.5,
      ease: 1.25,
      churn: 13.5,
      flicker: 1,
      pulse: 0.91,
      tempo: 0.37,
      wave: 0.93,
      hue: 219,
      spread: 180,
      edge: 0.88,
      edgeHue: -180,
      wildness: 0.89,
      saturation: 0.26,
      playback: 0.89,
    },
  },
  {
    label: "maybe",
    hint: "Few frames, big psyxels, slow repacking: the field as a sign rather than a texture.",
    settings: {
      seed: 771,
      subject: "&",
      face: "roman",
      polarity: "ink",
      fill: 0.8,
      coarse: 0.195,
      levels: 3,
      detail: 0.7,
      variety: 0.64,
      threshold: 0.32,
      fuzz: 0.45,
      flatten: 0.88,
      inset: 0.12,
      bloom: 0.2,
      solid: 0,
      layers: 0.45,
      glow: 0.35,
      afterglow: 0.4,
      wander: 0.47,
      weight: 0.15,
      glyphs: ["minus", "plus"],
      morph: 0.83,
      ease: 1,
      churn: 16,
      flicker: 0.35,
      pulse: 0.45,
      tempo: 0.1,
      wave: 0.9,
      hue: 156,
      spread: 96,
      edge: 0.12,
      edgeHue: 125,
      wildness: 0.85,
      saturation: 0.8,
      playback: 1,
    },
  },
  {
    label: "luna",
    hint: "The word as a hole again, and everything around it held: one grain everywhere rather than a range of them, and every psyx keeping the mark and the colour it was dealt. Made of the four that are drawn rather than built — a moon, a star, a heart and a leaf — so the field reads as things rather than as signs, and nothing moves in it but the breath.",
    settings: {
      seed: 639953,
      subject: "Luna",
      face: "roman",
      polarity: "void",
      fill: 0.88,
      coarse: 0.018,
      levels: 0,
      detail: 0.25,
      variety: 0.01,
      threshold: 0.71,
      fuzz: 0.96,
      flatten: 0.31,
      inset: -0.12,
      bloom: 0,
      solid: 0.14,
      layers: 0.06,
      glow: 0.51,
      afterglow: 0.11,
      wander: 0.6,
      weight: 0.145,
      glyphs: ["moon", "star", "heart", "leaf"],
      morph: 0.36,
      ease: 1.12,
      churn: 0,
      flicker: 0,
      pulse: 1,
      tempo: 1.44,
      wave: 0.6,
      hue: 171,
      spread: 180,
      edge: 0,
      edgeHue: -109,
      wildness: 0.63,
      saturation: 0.75,
      playback: 0.14,
    },
  },
]

export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    CONTROLS.filter(isTrackedControl).flatMap((control) =>
      keysOf(control).map((key) => [key, { min: control.min, max: control.max }]),
    ),
  ) as Record<NumericKey, { min: number; max: number }>),
  // Last, and deliberately: seed has no slider to derive bounds from.
  seed: SEED_BOUNDS,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * The marks a scene may show: known, unrepeated, in the vocabulary's own order,
 * and never fewer than two.
 *
 * **Order is imposed rather than kept.** The set is a set — `ring,dot` and
 * `dot,ring` are the same scene — so sorting means one scene has one address,
 * and `settingsToQuery` cannot emit two spellings of it. Anything unreadable is
 * dropped rather than defaulted, so a URL naming eight marks and one typo is
 * still the eight.
 *
 * Falling back to the base when too few survive is the one place the floor is
 * enforced outside the control: the console API and a hand-written URL both
 * arrive here, and a field made of one mark cannot change frame at all.
 */
function normalizeGlyphs(value: unknown, base: GlyphName[]): GlyphName[] {
  const named = Array.isArray(value) ? value.filter(isGlyphName) : []
  const kept = GLYPH_NAMES.filter((name) => named.includes(name))
  return kept.length >= LEAST_GLYPHS ? [...kept] : [...base]
}

/** Settings that must hold whole numbers. A psyx cannot be quartered 2.4 times. */
const INTEGER_KEYS: NumericKey[] = ["seed", "levels"]

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API, the panel — comes through here, so the API cannot reach a state a URL
 * could not.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...patch }
  const settings: Settings = {
    ...merged,
    subject: isSubject(merged.subject) ? merged.subject : base.subject,
    face: isFace(merged.face) ? merged.face : base.face,
    polarity: isPolarity(merged.polarity) ? merged.polarity : base.polarity,
    glyphs: normalizeGlyphs(merged.glyphs, base.glyphs),
  }

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
 * most of these — reading them with a bare `Number()` would silently still the
 * field, empty the colour and stop the clock. Absent, blank and unparseable are
 * all skipped so the default survives.
 */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }

  const subject = params.get("subject")
  if (isSubject(subject)) patch.subject = subject

  const face = params.get("face")
  if (isFace(face)) patch.face = face

  const polarity = params.get("polarity")
  if (isPolarity(polarity)) patch.polarity = polarity

  const glyphs = glyphsFromQuery(params)
  if (glyphs) patch.glyphs = glyphs

  return normalizeSettings(patch)
}

/**
 * The marks an address names, or nothing if it names none legibly.
 *
 * **`vocabulary=N` is still read**, because links carrying it exist and a
 * shared address should keep meaning what it meant. It meant "the first N of
 * the list", so that is what it becomes. `glyphs` wins where both appear.
 */
function glyphsFromQuery(params: URLSearchParams): GlyphName[] | null {
  const named = params.get("glyphs")
  if (named !== null && named.trim() !== "") {
    const parts = named.split(",").map((part) => part.trim())
    const kept = parts.filter(isGlyphName)
    if (kept.length > 0) return kept
  }

  const count = Number(params.get("vocabulary"))
  if (Number.isFinite(count) && count >= 1) return [...GLYPH_NAMES.slice(0, Math.round(count))]

  return null
}

/**
 * The whole scene, every setting named.
 *
 * It carried only what differed from `DEFAULT_SETTINGS` at first, for a shorter
 * link — and that is the trap the presets above are written out in full to
 * avoid, one layer down. **A link resting on a default is a link whose scene
 * changes the day the default does**, silently, in somebody else's bookmark.
 *
 * Defaults still have a job, and it is the other direction: filling an address
 * that never named a setting at all. That address is an old bookmark, and an old
 * bookmark was never promised its picture back.
 */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of Object.keys(BOUNDS) as NumericKey[]) params.set(key, String(settings[key]))
  params.set("subject", settings.subject)
  params.set("face", settings.face)
  params.set("polarity", settings.polarity)
  params.set("glyphs", settings.glyphs.join(","))
  return params
}

/**
 * The address that restores exactly this scene.
 *
 * One definition with two callers — the chrome, which rewrites the URL on every
 * change, and the page, which rewrites it once on landing.
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
  if (isSubject(params.get("subject")) || isFace(params.get("face")) || isPolarity(params.get("polarity"))) return true
  if (glyphsFromQuery(params)) return true
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * The scene a freshly-opened URL should show.
 *
 * `featured` says the caller should rewrite the address, so a landing visitor
 * has a URL describing the scene in front of them rather than one standing for
 * "whatever is featured".
 */
export function settingsForLanding(params: URLSearchParams): { settings: Settings; featured: boolean } {
  if (namesASetting(params)) return { settings: settingsFromQuery(params), featured: false }
  return { settings: normalizeSettings(PRESETS[0]!.settings), featured: true }
}

/**
 * Whether a change needs the whole field packed again from scratch.
 *
 * Deliberately short. Everything absent from it — colour, pulse, vocabulary,
 * flicker, the two rates — is read live while the field keeps running, so
 * dragging any of those leaves every psyx exactly where it is. That separation
 * is the point of the piece: the packing is a still question and the life is a
 * moving one, and only the first list can move a psyx.
 */
export function needsPacking(before: Settings, after: Settings): boolean {
  return (
    before.seed !== after.seed ||
    before.subject !== after.subject ||
    before.face !== after.face ||
    before.polarity !== after.polarity ||
    before.fill !== after.fill ||
    before.coarse !== after.coarse ||
    before.levels !== after.levels ||
    before.detail !== after.detail ||
    before.variety !== after.variety ||
    // Fuzz is the one control on both sides of the line: it softens which
    // psyxels appear, which is read live, *and* lets an edge square decline to
    // subdivide, which is the packing's business.
    before.fuzz !== after.fuzz
  )
}

/** Whether a change needs the subject rasterised again. */
export function needsSubject(before: Settings, after: Settings): boolean {
  return (
    before.subject !== after.subject ||
    before.face !== after.face ||
    before.polarity !== after.polarity ||
    before.fill !== after.fill
  )
}
