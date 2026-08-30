import { keysOf, type ChoiceControl, type RangeControl, type SliderControl } from "@/experiments/kit/controls"
import {
  FACE_LABELS,
  FACES,
  isFace,
  isSubject,
  SUBJECT_LABELS,
  SUBJECTS,
  type Face,
  type SubjectKind,
} from "@/experiments/psyxels/subject"
import { GLYPH_COUNT } from "@/experiments/psyxels/glyphs"

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
  wander: number
  weight: number
  vocabulary: number
  morph: number
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

export type NumericKey = Exclude<keyof Settings, "subject" | "face">

export type ControlGroup = "subject" | "packing" | "colour" | "life"

/** The panel's row kinds. A bound pair has no use here; a choice does. */
export type Control = ((SliderControl<NumericKey> | RangeControl<NumericKey>) | ChoiceControl<"subject" | "face">) & {
  group: ControlGroup
}

export const GROUP_ORDER: ControlGroup[] = ["subject", "packing", "colour", "life"]

/** Widest legal seed. Kept small enough to stay readable in a shared URL. */
export const SEED_BOUNDS = { min: 0, max: 999_999 }

const percent = (value: number) => `${Math.round(value * 100)}%`
const degrees = (value: number) => `${Math.round(value)}°`

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
    label: "coarse",
    min: 0.015,
    max: 0.6,
    step: 0.001,
    scale: "log",
    format: (value) => `${(value * 100).toFixed(1)}% of frame`,
    hint: "The largest a psyx is allowed to be, as a share of the frame's shorter side — so what the artwork is made of stays the same in a small window and a large one. A big coarse with few levels gives a blocky sign; a big coarse with many levels gives the widest spread of sizes, which is what makes the field look packed rather than gridded.",
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
    key: "vocabulary",
    label: "vocabulary",
    min: 1,
    max: GLYPH_COUNT,
    step: 1,
    format: (value) => `${Math.round(value)} of ${GLYPH_COUNT}`,
    hint: "How many frames a psyx may show, taken from the front of the list: minus, plus, circled minus, circled plus, ring, dot, cross, circled cross, bar. Small is a field with a strong accent — everything is a plus or a minus and you read the changes. Large is richer and, past about six, closer to texture than to signs.",
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
 * The scene the piece opens on, and the base every partial change is filled in
 * from.
 *
 * A recorded scene rather than the simplest thing the machinery can draw:
 * anything rendering the piece without choosing — the note's backdrop, a test —
 * gets a picture worth looking at. The subject is the letter, the colour is
 * present but not yet shouting, and the packing is set where the A is
 * unmistakable at a glance.
 */
export const DEFAULT_SETTINGS: Settings = {
  seed: 8412,
  subject: "A",
  face: "grotesque",
  fill: 0.82,
  coarse: 0.125,
  levels: 4,
  detail: 0.5,
  variety: 0.71,
  threshold: 0.36,
  fuzz: 0.45,
  flatten: 0.88,
  inset: -0.08,
  bloom: 0.55,
  wander: 0.18,
  weight: 0.15,
  vocabulary: 4,
  morph: 0.55,
  churn: 9,
  flicker: 1.1,
  pulse: 0.5,
  tempo: 0.22,
  wave: 0.35,
  hue: 286,
  spread: 74,
  edge: 0.45,
  edgeHue: 96,
  wildness: 0.62,
  saturation: 0.8,
  playback: 1,
}

export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "letter",
    hint: "The piece as described: a white A, pixellated into signs, breathing in colour.",
    settings: DEFAULT_SETTINGS,
  },
  {
    label: "sober",
    hint: "The same letter with the colour taken out of it — the packing on its own.",
    settings: {
      ...DEFAULT_SETTINGS,
      coarse: 0.155,
      levels: 3,
      detail: 0.55,
      variety: 0.58,
      threshold: 0.38,
      wildness: 0.05,
      saturation: 0.2,
      spread: 20,
      // No accent either: this scene is what the packing looks like with the
      // colour taken out, and an edge in another hue is colour.
      edge: 0,
      pulse: 0.3,
      flicker: 0.5,
      churn: 5,
      vocabulary: 3,
      inset: 0.16,
    },
  },
  {
    label: "acid",
    hint: "Every hue at once, changing as fast as a psyx can think.",
    settings: {
      ...DEFAULT_SETTINGS,
      seed: 41103,
      coarse: 0.12,
      levels: 5,
      detail: 1,
      variety: 0.83,
      threshold: 0.43,
      inset: 0,
      wander: 0.47,
      weight: 0.06,
      vocabulary: 6,
      flicker: 7.15,
      morph: 0.83,
      churn: 58.5,
      pulse: 0.78,
      tempo: 0.12,
      hue: 318,
      spread: 168,
      edge: 0.12,
      edgeHue: 125,
      wildness: 1,
      saturation: 0.98,
      playback: 0.68,
    },
  },
  {
    label: "portrait",
    hint: "A face, packed fine where it has features and coarse where it has cheek.",
    settings: {
      ...DEFAULT_SETTINGS,
      seed: 2207,
      subject: "avatar",
      fill: 0.86,
      coarse: 0.048,
      levels: 5,
      detail: 0.75,
      variety: 0.76,
      threshold: 0.61,
      flatten: 0.43,
      inset: 0.1,
      weight: 0.065,
      vocabulary: 6,
      flicker: 5.05,
      churn: 35.5,
      pulse: 0.51,
      tempo: 0.03,
      wave: 0.5,
      hue: 29,
      spread: 119,
      saturation: 0.57,
      // The new controls, wound down from their defaults: a face has edges
      // everywhere, and a boundary as soft as the letter's takes the wall's
      // mid-tones with it.
      fuzz: 0.22,
      wander: 0.12,
      edge: 0.3,
      edgeHue: 58,
    },
  },
  {
    label: "signage",
    hint: "Few frames, big psyxels, slow repacking: the field as a sign rather than a texture.",
    settings: {
      ...DEFAULT_SETTINGS,
      seed: 771,
      subject: "&",
      fill: 0.8,
      coarse: 0.195,
      levels: 3,
      detail: 0.7,
      variety: 0.64,
      threshold: 0.32,
      inset: 0.12,
      weight: 0.15,
      vocabulary: 2,
      flicker: 0.35,
      churn: 16,
      pulse: 0.45,
      tempo: 0.1,
      wave: 0.9,
      hue: 156,
      spread: 96,
      wildness: 0.85,
      saturation: 0.8,
    },
  },
  {
    label: "swarm",
    hint: "Small psyxels, high variety: a letter made of grain rather than of blocks.",
    settings: {
      ...DEFAULT_SETTINGS,
      seed: 60313,
      coarse: 0.071,
      levels: 4,
      detail: 0.9,
      variety: 0.92,
      threshold: 0.36,
      inset: 0.05,
      weight: 0.2,
      vocabulary: 9,
      flicker: 2.2,
      churn: 46,
      pulse: 0.66,
      tempo: 0.44,
      wave: 0.18,
      hue: 208,
      spread: 130,
      wildness: 0.9,
      saturation: 0.9,
    },
  },
]

export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    CONTROLS.filter((control) => control.kind !== "choice").flatMap((control) =>
      keysOf(control).map((key) => [key, { min: control.min, max: control.max }]),
    ),
  ) as Record<NumericKey, { min: number; max: number }>),
  // Last, and deliberately: seed has no slider to derive bounds from.
  seed: SEED_BOUNDS,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Settings that must hold whole numbers. A psyx cannot be quartered 2.4 times. */
const INTEGER_KEYS: NumericKey[] = ["seed", "levels", "vocabulary"]

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

  return normalizeSettings(patch)
}

/** Only values that differ from the defaults, so shared URLs stay readable. */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) params.set(key, String(settings[key]))
  }
  if (settings.subject !== DEFAULT_SETTINGS.subject) params.set("subject", settings.subject)
  if (settings.face !== DEFAULT_SETTINGS.face) params.set("face", settings.face)
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
  if (isSubject(params.get("subject")) || isFace(params.get("face"))) return true
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
  return before.subject !== after.subject || before.face !== after.face || before.fill !== after.fill
}
