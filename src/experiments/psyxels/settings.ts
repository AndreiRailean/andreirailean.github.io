import { decodeScene, encodeScene, withinBytes, type Slot } from "@/experiments/address"
import {
  gridAt,
  snapToGrid,
  type ChoiceControl,
  type RangeControl,
  type SetControl,
  type SliderControl,
  type TextControl,
  type ToggleControl,
  type Track,
} from "@/experiments/kit/controls"
import {
  FACE_LABELS,
  FACES,
  isFace,
  isPolarity,
  isSubject,
  LEGACY_SUBJECTS,
  LOCAL_PORTRAIT,
  PICTURE_BYTES,
  POLARITIES,
  POLARITY_LABELS,
  SUBJECT_LABELS,
  SUBJECTS,
  TEXT_BYTES,
  type Face,
  type Polarity,
  type SubjectKind,
} from "@/experiments/psyxels/subject"
import {
  GLYPH_COLUMNS,
  GLYPH_NAMES,
  indexOfGlyph,
  isGlyphName,
  paintGlyph,
  type GlyphName,
} from "@/experiments/psyxels/glyphs"
import type { Chrome } from "@/experiments/piece"
import { levelsBetween, levelsOf, MAX_LEVELS, MIN_PX } from "@/experiments/psyxels/field"

export { levelsOf }

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
  /** What is typed, when the subject is text. */
  text: string
  /** Where the picture is, when the subject is a picture. */
  picture: string
  face: Face
  polarity: Polarity
  fill: number
  coarse: number
  /**
   * The smallest psyx, as a share of the frame like `coarse`. A square is one
   * psyx or four, so the field's smallest is `coarse` halved a whole number of
   * times — the nearest such to this, which `levelsOf` reads back.
   */
  finest: number
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
  /** How the afterglow forgets: a flat fade, or the same fade dithered (#117). */
  dither: boolean
  wander: number
  spin: number
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

export type NumericKey = Exclude<
  keyof Settings,
  "subject" | "text" | "picture" | "face" | "polarity" | "glyphs" | "dither"
>

/**
 * The panel's boxes. `glyphs` was part of `subject` until #263: "glyphs
 * deserve their own box … glyphs and polarity fit together" — the marks and
 * which side of the picture they are made of, against what the picture is.
 */
export type ControlGroup = "subject" | "glyphs" | "packing" | "colour" | "life"

/** The panel's row kinds. A bound pair has no use here; a choice and a set do. */
export type Control = (
  | SliderControl<NumericKey>
  | RangeControl<NumericKey>
  | ChoiceControl<"subject" | "face" | "polarity">
  | SetControl<"glyphs">
  | TextControl<"text" | "picture">
  | ToggleControl<"dither">
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

export const GROUP_ORDER: ControlGroup[] = ["subject", "glyphs", "packing", "colour", "life"]

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
    options: /* @__PURE__ */ SUBJECTS.map((value) => ({ value, label: SUBJECT_LABELS[value] })),
    hint: "What is underneath: something typed, or a picture at an address. Both go through exactly the same machinery: the picture is read as coverage, and coverage is what the packing subdivides. Black is not a dark subject, it is no subject — which is why the portrait's shadows are bare ground rather than dark psyxels.",
  },
  {
    kind: "text",
    group: "subject",
    key: "text",
    label: "text",
    maxLength: TEXT_BYTES,
    placeholder: "type something",
    inert: (settings: Settings) => settings.subject !== "text",
    hint: "What is typed is what is pixellated. One letter is fitted to the height and arrives as one thick shape; a word is fitted to the width and spends it on several shapes and the gaps between them, so a word wants a finer grid to stay legible.",
  },
  {
    kind: "choice",
    group: "subject",
    key: "face",
    label: "face",
    options: /* @__PURE__ */ FACES.map((value) => ({ value, label: FACE_LABELS[value] })),
    inert: (settings: Settings) => settings.subject !== "text",
    hint: "Which letterform the text is drawn with. It is asked for as a kind of shape rather than a named font, so the machine supplies whatever it has of that kind — and the character is what survives being packed: a grotesque gives even strokes and a hard silhouette, a roman gives thick-and-thin and serifs that break into separate psyxels, a script gives a stroke that changes width as it turns.",
  },
  {
    kind: "text",
    group: "subject",
    key: "picture",
    label: "picture",
    maxLength: PICTURE_BYTES,
    placeholder: LOCAL_PORTRAIT,
    inert: (settings: Settings) => settings.subject !== "picture",
    // Written out rather than interpolated from LOCAL_PORTRAIT: an
    // interpolation is a call the bundler cannot prove pure, and it pinned the
    // whole control list into the runner — `runner-bundle.test.ts`, #243.
    hint: "The address of the picture to pixellate. /experiments/psyxels/avatar.jpg is the portrait kept with this piece; any image whose host allows it to be read across origins works too — GitHub's avatars do. A host that does not allow it leaves the frame empty, because its pixels cannot be read.",
  },
  {
    kind: "set",
    group: "glyphs",
    key: "glyphs",
    label: "glyphs",
    least: LEAST_GLYPHS,
    // Two rows; see GLYPH_COLUMNS for why it is not worked out here.
    columns: GLYPH_COLUMNS,
    options: /* @__PURE__ */ GLYPH_NAMES.map((value) => ({
      value,
      label: /* @__PURE__ */ value.replace("-", " "),
      icon: () => glyphIcon(value),
    })),
    hint: "Which marks a psyx may show. It was a count before — how many to take from the front of the list — so the only way to be rid of one mark was to be rid of everything after it as well. Two is the floor: at one there is nothing to change to, and a psyx that cannot change is not what this piece is made of. A small set is a field with a strong accent and you read the changes; a large one is closer to texture than to signs.",
  },
  {
    kind: "choice",
    group: "glyphs",
    key: "polarity",
    label: "polarity",
    options: /* @__PURE__ */ POLARITIES.map((value) => ({ value, label: POLARITY_LABELS[value] })),
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
    kind: "range",
    group: "packing",
    keys: ["finest", "coarse"],
    label: "sizes",
    min: 0.0004,
    max: 0.6,
    step: 0.00001,
    scale: "log",
    /**
     * **One control for the spread, because two said less than they claimed.**
     * This was `biggest` and `levels`, and with levels at zero every psyx was the
     * biggest size, so `biggest` only made them all big — "biggest doesn't seem
     * to work as it claims". Smallest and biggest on one track say what the
     * field is made of: together, one size; apart, as many sizes as there are
     * halvings between them.
     */
    /**
     * **The sizes this window draws, not the sizes asked for.** A square never
     * splits below `MIN_PX`, so a fine smallest on a small window is a size the
     * field does not have — and counting it would be the fault this control
     * was built to remove, a label claiming what the picture does not show.
     */
    format: (finest, coarse) => {
      const side = Math.min(window.innerWidth, window.innerHeight)
      const fit = Math.max(0, Math.floor(Math.log2(Math.max(MIN_PX * 2, coarse * side) / MIN_PX)))
      const sizes = Math.min(levelsBetween(finest, coarse), fit) + 1
      return sizes === 1 ? "one size" : `${sizes} sizes`
    },
    hint: "The smallest and the biggest psyx, as shares of the frame's shorter side, so what the artwork is made of stays the same in a small window and a large one. A square is one psyx or four, so the sizes in between are the biggest halved, and halved again: the smallest handle steps in those halvings, up to five. Both handles together is one size and an ordinary low-resolution image; far apart is the widest spread, which is what makes the field look packed rather than gridded.",
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
    key: "spin",
    label: "spin",
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => (value === 0 ? "upright" : value >= 1 ? "any" : `±${Math.round(value * 180)}°`),
    hint: "How far a mark may be turned from upright. Its own bearing, drawn once and held for its life, so the field is scattered rather than spinning — and both halves of a change of frame read it, so a psyx keeps its bearing while it changes what it is showing. Only the drawn marks turn. The nine built from strokes and a ring use their orientation as meaning: a minus turned a quarter is a bar, a plus turned an eighth is a cross, and both of those are already somewhere else in the vocabulary.",
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
    kind: "toggle",
    group: "colour",
    key: "dither",
    label: "fade",
    labels: ["flat", "dither"],
    inert: (settings: Settings) => settings.glow === 0 || settings.afterglow === 0,
    hint: "How the afterglow forgets. Flat fades the whole buffer a little each frame, and on a long afterglow that little is too small for an 8-bit pixel to act on: every light below half stops fading and stays, so the ground washes out. Dither fades the same amount in total but spends it on a sparse, shifting share of the pixels, each by enough to move. Same trail, same speed — only the floor differs. Flip it on a long afterglow to compare.",
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
  subject: "text",
  text: "A",
  picture: LOCAL_PORTRAIT,
  face: "grotesque",
  polarity: "ink",
  fill: 0.82,
  coarse: 0.125,
  finest: 0.00781,
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
  dither: false,
  wander: 0.15,
  spin: 0,
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
 * The grid every numeric setting is stored on, keyed the way `BOUNDS` is.
 *
 * `normalizeSettings` snaps to this, so a value arriving from the query string
 * or the console API lands where a dragged handle would have put it. Before
 * this, only the slider quantised — see `snapToGrid` in `kit/controls.ts` for
 * what that cost.
 */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  fill: { min: 0.25, max: 1, step: 0.01 },
  // One track for both ends of the sizes range, which is what lets them share
  // a control. The biggest still stops at `COARSEST_MIN`, in the validator.
  coarse: { min: 0.0004, max: 0.6, step: 0.00001, scale: "log" },
  finest: { min: 0.0004, max: 0.6, step: 0.00001, scale: "log" },
  detail: { min: 0, max: 1, step: 0.01 },
  variety: { min: 0, max: 1, step: 0.01 },
  threshold: { min: 0, max: 0.9, step: 0.01 },
  fuzz: { min: 0, max: 1, step: 0.01 },
  flatten: { min: 0, max: 1, step: 0.01 },
  inset: { min: -0.4, max: 0.45, step: 0.01 },
  bloom: { min: 0, max: 1, step: 0.01 },
  layers: { min: 0, max: 1, step: 0.01 },
  solid: { min: 0, max: 1, step: 0.01 },
  wander: { min: 0, max: 0.6, step: 0.01 },
  spin: { min: 0, max: 1, step: 0.01 },
  weight: { min: 0.03, max: 0.34, step: 0.005 },
  flicker: { min: 0, max: 10, step: 0.05 },
  morph: { min: 0, max: 1, step: 0.01 },
  ease: { min: 0.2, max: 6, step: 0.01, scale: "log" },
  churn: { min: 0, max: 90, step: 0.5 },
  pulse: { min: 0, max: 1, step: 0.01 },
  tempo: { min: 0.02, max: 3, step: 0.01, scale: "log" },
  wave: { min: 0, max: 1, step: 0.01 },
  hue: { min: 0, max: 360, step: 1 },
  spread: { min: 0, max: 180, step: 1 },
  glow: { min: 0, max: 1, step: 0.01 },
  afterglow: { min: 0, max: 1, step: 0.01 },
  edge: { min: 0, max: 1, step: 0.01 },
  edgeHue: { min: -180, max: 180, step: 1 },
  wildness: { min: 0, max: 1, step: 0.01 },
  saturation: { min: 0, max: 1, step: 0.01 },
  playback: { min: 0, max: 2, step: 0.01 },
}

export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    Object.entries(TRACKS).map(([key, track]) => [key, { min: track!.min, max: track!.max }]),
  ) as Record<NumericKey, { min: number; max: number }>),
  // Last, and deliberately: seed has no slider to derive bounds from.
  seed: SEED_BOUNDS,
}

/**
 * The spacing one setting is stored on, or 0 for a key with no track.
 *
 * Exported because a check that a value is on its grid has to read the grid
 * from the piece rather than re-derive it — re-deriving is how a test ends up
 * asserting its own copy of the rule. It is also the column a slot registry
 * would need if the address ever stops being readable.
 */
export function gridFor(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? gridAt(track, value) : 0
}

/** Snaps one setting, leaving alone any key with no track — `seed` has none. */
function snap(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? snapToGrid(track, value) : value
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

/**
 * A subject as it was named before #263, read as the scene it meant.
 *
 * Every address written until then names one of six subjects through a slot
 * that is retired now and still read. Five were text with the string fixed —
 * `Luna` means text reading "Luna" — and `avatar` was the portrait, which is
 * the picture at `LOCAL_PORTRAIT`. The console API and a hand-written URL take
 * the same route, so `set({ subject: "Luna" })` still does what it did.
 */
function fromLegacy(patch: Partial<Settings>): Partial<Settings> {
  const named = (patch as { subject?: unknown }).subject
  if (typeof named !== "string" || !(LEGACY_SUBJECTS as readonly string[]).includes(named)) return patch
  if (named === "avatar") return { ...patch, subject: "picture", picture: patch.picture ?? LOCAL_PORTRAIT }
  return { ...patch, subject: "text", text: named }
}

/** Settings that must hold whole numbers. A psyx cannot be quartered 2.4 times. */
const INTEGER_KEYS: NumericKey[] = ["seed"]

/**
 * The least the biggest psyx may be. It was the bottom of its own slider before
 * the sizes shared one track; below it the coarse grid is finer than the
 * packing can resolve into separate sizes at all.
 */
export const COARSEST_MIN = 0.015

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API, the panel — comes through here, so the API cannot reach a state a URL
 * could not.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const merged = { ...base, ...fromLegacy(patch) }
  // `levels` was a setting until the sizes became a range, and every address,
  // preset link and console call written before then names it. It means the
  // smallest size, counted in halvings of whichever biggest it arrives with.
  const levels = Number((patch as { levels?: unknown }).levels)
  if (!("finest" in patch) && Number.isFinite(levels)) merged.finest = Number(merged.coarse) / 2 ** Math.round(levels)
  const settings: Settings = {
    ...merged,
    subject: isSubject(merged.subject) ? merged.subject : base.subject,
    text: typeof merged.text === "string" ? withinBytes(merged.text, TEXT_BYTES) : base.text,
    picture: typeof merged.picture === "string" ? withinBytes(merged.picture.trim(), PICTURE_BYTES) : base.picture,
    face: isFace(merged.face) ? merged.face : base.face,
    polarity: isPolarity(merged.polarity) ? merged.polarity : base.polarity,
    glyphs: normalizeGlyphs(merged.glyphs, base.glyphs),
    dither: typeof merged.dither === "boolean" ? merged.dither : base.dither,
  }

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const bound = BOUNDS[key]
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    if (INTEGER_KEYS.includes(key)) settings[key] = Math.round(settings[key])
    settings[key] = snap(key, settings[key])
  }

  // The smallest handle stays where it is put, between the biggest and five
  // halvings below it, and `levelsOf` reads the nearest whole halving off it.
  // **It is not snapped to that halving**, though the field is: snapped, an
  // arrow key's step on a log track lands back where it started every time,
  // and the handle cannot be moved from the keyboard at all.
  settings.coarse = Math.max(COARSEST_MIN, settings.coarse)
  settings.finest = snap("finest", clamp(settings.finest, settings.coarse / 2 ** MAX_LEVELS, settings.coarse))
  // And the setting it replaced does not ride along in the scene.
  delete (settings as { levels?: unknown }).levels

  return settings
}

/**
 * Reads settings from a query string, in either form.
 *
 * The packed parameter wins when it is there and readable. Anything else falls
 * through to the named-parameter reader below, which is why every link written
 * before the packed form still restores its own scene — and why a corrupt `s`
 * degrades to the defaults rather than throwing in a page's first statement.
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
 * Reads settings from a query string.
 *
 * An absent param is `null` and `Number(null)` is 0, which is a legal value for
 * most of these — reading them with a bare `Number()` would silently still the
 * field, empty the colour and stop the clock. Absent, blank and unparseable are
 * all skipped so the default survives.
 */
function settingsFromNamedQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }

  const subject = params.get("subject")
  if (isSubject(subject) || isLegacySubject(subject)) patch.subject = subject as SubjectKind

  const text = params.get("text")
  if (text !== null) patch.text = text

  const levels = params.get("levels")
  if (levels !== null && levels.trim() !== "" && Number.isFinite(Number(levels)))
    (patch as { levels?: number }).levels = Number(levels)

  const picture = params.get("picture")
  if (picture !== null && picture.trim() !== "") patch.picture = picture

  const face = params.get("face")
  if (isFace(face)) patch.face = face

  const polarity = params.get("polarity")
  if (isPolarity(polarity)) patch.polarity = polarity

  const glyphs = glyphsFromQuery(params)
  if (glyphs) patch.glyphs = glyphs

  return normalizeSettings(patch)
}

const isLegacySubject = (value: unknown): boolean =>
  typeof value === "string" && (LEGACY_SUBJECTS as readonly string[]).includes(value)

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
 * **The address registry: append-only, and immutable slot by slot.**
 *
 * Read `@/experiments/address` before touching this. The rules, in short:
 *
 * - **Adding a setting?** Append a slot at the end. Nothing else changes, no
 *   version is bumped, and every address already written keeps working — it
 *   simply has a shorter bitmap and is silent about the new slot, which falls
 *   back to `DEFAULT_SETTINGS`.
 * - **Changing a slot's `grid`, `origin`, `bits`, or its `options` list?**
 *   You may not. Mark the existing slot `retired: true`, leave it exactly where
 *   it is, and append a new one with the same `key`. Later slots win, so an
 *   address carrying both ends up with the new value. Deleting or reordering a
 *   slot silently changes what every older address means.
 * - **Removing a setting?** Mark its slot `retired: true` and leave it. A
 *   retired slot costs one bit.
 * - **Changing what a value *means*, while its numbers stay the same?** Retire
 *   the slot anyway. Nothing can detect that automatically — the encoding
 *   guarantees the number survives, not its meaning — and a seventh of a
 *   character is a cheap price for the rule being obeyable.
 *
 * `tests/unit/experiments-address.test.ts` holds a snapshot of every registry
 * and fails on any edit that is not an append, so none of the above depends on
 * being remembered.
 */
export const REGISTRY: readonly Slot[] = [
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 20 },
  { key: "subject", kind: "enum", options: ["A", "Alive", "L", "Luna", "&", "avatar"], retired: true },
  { key: "face", kind: "enum", options: ["grotesque", "roman", "script", "typewriter"] },
  { key: "polarity", kind: "enum", options: ["ink", "void"] },
  { key: "fill", kind: "num", grid: 0.01, origin: 0.25, bits: 7 },
  { key: "coarse", kind: "num", grid: 0.001, origin: 0.015, bits: 10, retired: true },
  { key: "levels", kind: "num", grid: 1, origin: 0, bits: 3, retired: true },
  { key: "detail", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "variety", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "threshold", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "fuzz", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "flatten", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "inset", kind: "num", grid: 0.01, origin: -0.4, bits: 7 },
  { key: "bloom", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "solid", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "layers", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "glow", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "afterglow", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "wander", kind: "num", grid: 0.01, origin: 0, bits: 6 },
  { key: "spin", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "weight", kind: "num", grid: 0.005, origin: 0.03, bits: 6 },
  {
    key: "glyphs",
    kind: "set",
    retired: true,
    options: [
      "minus",
      "plus",
      "circled-minus",
      "circled-plus",
      "ring",
      "dot",
      "cross",
      "circled-cross",
      "bar",
      "moon",
      "star",
      "diamond",
      "eye",
      "heart",
      "leaf",
    ],
  },
  { key: "morph", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "ease", kind: "num", grid: 0.01, origin: 0.2, bits: 10 },
  { key: "churn", kind: "num", grid: 0.5, origin: 0, bits: 8 },
  { key: "flicker", kind: "num", grid: 0.05, origin: 0, bits: 8 },
  { key: "pulse", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "tempo", kind: "num", grid: 0.01, origin: 0.02, bits: 9 },
  { key: "wave", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "spread", kind: "num", grid: 1, origin: 0, bits: 8 },
  { key: "edge", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "edgeHue", kind: "num", grid: 1, origin: -180, bits: 9 },
  { key: "wildness", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "saturation", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "playback", kind: "num", grid: 0.01, origin: 0, bits: 8 },
  // #263: the subject became a mode, and what it shows became two settings.
  // The retired slot above is still read, and `fromLegacy` turns what it says
  // into these.
  { key: "subject", kind: "enum", options: ["text", "picture"] },
  { key: "text", kind: "text", bytes: TEXT_BYTES },
  { key: "picture", kind: "text", bytes: PICTURE_BYTES },
  { key: "dither", kind: "bool" },
  // #135 appended two marks. A set slot's options are its identity, so the
  // fifteen-mark slot above is retired and still read.
  {
    key: "glyphs",
    kind: "set",
    options: [
      "minus",
      "plus",
      "circled-minus",
      "circled-plus",
      "ring",
      "dot",
      "cross",
      "circled-cross",
      "bar",
      "moon",
      "star",
      "diamond",
      "eye",
      "heart",
      "leaf",
      "sprout",
      "spiral",
    ],
  },
  // The sizes became a range: the smallest is stored and the levels between it
  // and the biggest are read back from the two. The retired `levels` slot above
  // is still read, and `normalizeSettings` turns it into this.
  { key: "finest", kind: "num", grid: 0.00001, origin: 0, bits: 17 },
  // On the sizes range's finer grid; the first `coarse` slot is retired and still read.
  { key: "coarse", kind: "num", grid: 0.00001, origin: 0, bits: 17 },
]

/**
 * The address that carries this scene, packed.
 *
 * Opaque on purpose — `../docs/adr/20260906-an-address-is-packed-not-readable.md`.
 * The named-parameter form this replaced is still *read*, forever; it is only no
 * longer written. `experiment.decode()` expands an address back to a plain
 * object, which is where readability went.
 */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  params.set("s", encodeScene(REGISTRY, settings))
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
export function namesASetting(params: URLSearchParams): boolean {
  // The packed form names the whole scene by definition, so it settles this
  // before any per-key test runs.
  const packed = params.get("s")
  if (packed !== null && packed !== "" && decodeScene(REGISTRY, packed)) return true
  const subject = params.get("subject")
  if (
    isSubject(subject) ||
    isLegacySubject(subject) ||
    isFace(params.get("face")) ||
    isPolarity(params.get("polarity"))
  )
    return true
  if (params.get("text") !== null || (params.get("picture") ?? "").trim() !== "") return true
  if (glyphsFromQuery(params)) return true
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
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
    before.text !== after.text ||
    before.picture !== after.picture ||
    before.face !== after.face ||
    before.polarity !== after.polarity ||
    before.fill !== after.fill ||
    before.coarse !== after.coarse ||
    before.finest !== after.finest ||
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
    before.text !== after.text ||
    before.picture !== after.picture ||
    before.face !== after.face ||
    before.polarity !== after.polarity ||
    before.fill !== after.fill
  )
}

/**
 * What the frame needs from this piece beyond its settings tables, as data —
 * see `Chrome` in `../piece.ts`. Here rather than in `runner.ts`, because every
 * export of that file ships in a frozen runner, which draws none of this.
 */
export const CHROME: Chrome<Settings> = {
  slug: "psyxels",
  title: "Psyxels",
  canvas: "stage",
  // A box per group, stacked down the right edge, as crowd has — #257.
  boxes: true,
  groups: GROUP_ORDER,
  theme: (settings) => ({
    style: {
      "--accent": `hsl(${settings.hue}, 70%, 66%)`,
      "--ui-on-bg": `hsl(${settings.hue}, 42%, 40%)`,
      "--ui-on-text": `hsl(${settings.hue}, 70%, 96%)`,
    },
  }),
  actions: [
    {
      label: "reroll",
      hint: "A fresh packing of the same picture. The seed travels in the address bar.",
      shortcut: "r",
      verb: "reroll",
    },
  ],
  hatches: { debug: "flag", run: "seconds" },
  banner: [
    ["experiment.get()", "current settings"],
    ["experiment.set({ wildness: 1 })", "change one or more"],
    ["experiment.preset(1)", "load a preset by number or name"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.reroll()", "a fresh packing of the same picture (or press r)"],
    ["experiment.run(60)", "skip a minute of repacking forward"],
    ["experiment.debug(true)", "show the squares the packing chose"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the field where it is, or let it run on"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.awake()", "is the display being held awake"],
    ["experiment.stats()", "psyxels, sizes, how well the subject survives, fps"],
    ["experiment.url()", "a link that restores this exact scene"],
  ],
}

/**
 * A fresh arrangement at the same settings: the bar's reroll button and
 * `experiment.reroll()` both call this, through `gallery/boot.ts`, so the two
 * cannot come to mean different things.
 *
 * Pure, and the piece's rather than the frame's, because which values a seed
 * may take is this piece's to say. The frame knows only that a rerollable piece
 * has a `seed`.
 */
export function reroll(settings: Settings, seed?: number): Settings {
  return normalizeSettings({ ...settings, seed: seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1)) })
}
