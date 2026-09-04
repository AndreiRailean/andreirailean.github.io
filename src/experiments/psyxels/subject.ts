/**
 * The still picture underneath, drawn once into an offscreen canvas.
 *
 * Everything else in this piece is about *how* a picture is pixellated; this is
 * the only place that knows what the picture is. It hands back nothing but a
 * canvas of ink on transparency, which is what keeps a letterform and a
 * photograph interchangeable further down: `mask.ts` reads coverage and colour
 * off whatever was drawn here and never asks which it was.
 */

/**
 * What can be pixellated. Every one of them is a still image by the time the
 * field sees it.
 *
 * **A word is not a bigger letter.** A single glyph is fitted to the frame's
 * shorter side and arrives at the packing as one thick shape with a handful of
 * joins; a word is fitted to the frame's *width*, so the same fill spends that
 * width on four or five shapes and on the counters and sidebearings between
 * them. Measured on a 1280×800 frame, the median horizontal run of ink is 143
 * CSS pixels for a roman A at fill 0.74 and 70 for the word *Alive* at 0.85 —
 * about half the stroke to pack, from a subject that looks larger.
 *
 * So a word wants a finer grid than a letter does to stay readable, which is why
 * it is a different subject rather than a different setting.
 */
export const SUBJECTS = ["A", "Alive", "L", "Luna", "&", "avatar"] as const

export type SubjectKind = (typeof SUBJECTS)[number]

export const SUBJECT_LABELS: Record<SubjectKind, string> = {
  A: "A",
  Alive: "Alive",
  L: "L",
  Luna: "Luna",
  "&": "&",
  avatar: "portrait",
}

export const isSubject = (value: unknown): value is SubjectKind =>
  typeof value === "string" && (SUBJECTS as readonly string[]).includes(value)

/**
 * Which side of the subject the psyxels are made of.
 *
 * `"ink"` is the piece as it was: psyxels where the subject is, bare ground
 * everywhere else. `"void"` swaps the two, so the whole frame is packed and the
 * subject is the hole left in it — the word is read the way a stencil is read,
 * off the shape of what is missing.
 *
 * It belongs here and not in the packing because it is a fact about the
 * *picture*: everything downstream asks the mask how much ink is under a square
 * and is told, and neither the mask nor the field ever learns that the answer
 * was turned inside out.
 */
export const POLARITIES = ["ink", "void"] as const

export type Polarity = (typeof POLARITIES)[number]

export const POLARITY_LABELS: Record<Polarity, string> = {
  ink: "ink",
  void: "void",
}

export const isPolarity = (value: unknown): value is Polarity =>
  typeof value === "string" && (POLARITIES as readonly string[]).includes(value)

/**
 * The letterforms on offer, as generic families rather than named faces.
 *
 * **Which face the machine picks is deliberately not this piece's business.**
 * The subject is rasterised to coverage immediately and survives only as a field
 * of psyxels, so what matters is the *character* of the shape — whether its
 * strokes are even or modulated, whether it has serifs to break up, whether it
 * is drawn with a pen. A generic family asks the machine for that character and
 * takes whatever it has, which is the same bargain the piece makes with a
 * viewer's monitor.
 *
 * The consequence is worth stating: two machines show different letters. A
 * capture from this repo's headless Chromium is whatever fonts the box has, and
 * a laptop will differ. That is fine for a piece whose subject is a shape, and
 * it is why the poster's recipe does not name a face.
 */
export const FACES = ["grotesque", "roman", "script", "typewriter"] as const

export type Face = (typeof FACES)[number]

export const FACE_LABELS: Record<Face, string> = {
  grotesque: "grotesque",
  roman: "roman",
  script: "script",
  typewriter: "typed",
}

export const isFace = (value: unknown): value is Face =>
  typeof value === "string" && (FACES as readonly string[]).includes(value)

/**
 * Weight is the one thing a face cannot be left to decide.
 *
 * A light letter at this scale gives strokes a few psyxels wide, and a letter
 * three psyxels wide is not a letter, it is a scribble. The grotesque is asked
 * for the heaviest weight it has; the others are asked for a middleweight,
 * because a bold script is a blot.
 */
const STACKS: Record<Face, string> = {
  grotesque: '800 {size}px "Helvetica Neue", Helvetica, Arial, sans-serif',
  roman: '700 {size}px Georgia, "Times New Roman", serif',
  script: '600 {size}px "Snell Roundhand", "Apple Chancery", "Segoe Script", cursive',
  typewriter: '700 {size}px "Courier New", ui-monospace, monospace',
}

/**
 * Fits a glyph to a box by measuring it rather than trusting the font size.
 *
 * A capital A at `120px` is nothing like 120 psyxels tall, and the gap differs by
 * face — so a fixed size would make the subject's height depend on which font
 * the machine happened to have. Measured, then scaled by the ratio, it does not.
 */
function fitText(ctx: CanvasRenderingContext2D, text: string, face: Face, boxWidth: number, boxHeight: number): void {
  const probe = 100
  const stack = STACKS[face]
  ctx.font = stack.replace("{size}", String(probe))
  const metrics = ctx.measureText(text)
  const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
  const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
  if (width <= 0 || height <= 0) return

  const size = probe * Math.min(boxWidth / width, boxHeight / height)
  ctx.font = stack.replace("{size}", String(size))

  // Centred on the ink rather than on the baseline, which is what "fill the
  // height of the screen" means to anyone looking at it. Only vertically:
  // `textAlign: center` has the other axis, and correcting it here as well
  // would shift an asymmetric glyph by half its own overhang.
  const after = ctx.measureText(text)
  ctx.translate(0, (after.actualBoundingBoxAscent - after.actualBoundingBoxDescent) / 2)
}

export type Drawn = { ok: boolean }

/**
 * Paints the subject, centred, filling `fill` of the frame's shorter side.
 *
 * White on transparent for text, because ink is read as alpha × luminance
 * downstream: a white letter comes back as coverage 1 inside and the
 * antialiased fraction at its edge, which is exactly the quantity the packing
 * wants. A photograph comes back as its own tones, and the dark half of a
 * portrait is *absence of subject* rather than a dark subject — which is what
 * makes the same threshold control sculpt both.
 */
export function paintSubject(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: SubjectKind,
  face: Face,
  fill: number,
  polarity: Polarity,
  avatar: HTMLImageElement | null,
): Drawn {
  ctx.clearRect(0, 0, width, height)
  const box = Math.min(width, height) * fill

  if (kind === "avatar") {
    if (!avatar || !avatar.complete || avatar.naturalWidth === 0) return { ok: false }
    const scale = box / Math.max(avatar.naturalWidth, avatar.naturalHeight)
    const w = avatar.naturalWidth * scale
    const h = avatar.naturalHeight * scale
    ctx.drawImage(avatar, (width - w) / 2, (height - h) / 2, w, h)
    invert(ctx, width, height, polarity)
    return { ok: true }
  }

  ctx.save()
  ctx.fillStyle = "#fff"
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.translate(width / 2, height / 2)
  fitText(ctx, kind, face, width * fill, box)
  ctx.fillText(kind, 0, 0)
  ctx.restore()
  invert(ctx, width, height, polarity)
  return { ok: true }
}

/**
 * Turns the painted picture inside out, in one composite over the whole frame.
 *
 * `difference` against white leaves `1 - alpha × colour` at every psyxel with
 * the frame fully opaque, which is exactly the quantity `mask.ts` reads as ink —
 * so a white letter comes back as a black hole in a white field, its antialiased
 * edge inverted along with it, and a photograph comes back as its own negative.
 *
 * Doing it as a composite rather than by cutting the glyph out of a filled
 * rectangle is what makes it work for the portrait too: `destination-out` would
 * punch the photograph's opaque bounding box out and leave a rectangle, because
 * a photograph's *shape* is a rectangle and only its tones say where the subject
 * is.
 */
function invert(ctx: CanvasRenderingContext2D, width: number, height: number, polarity: Polarity): void {
  if (polarity !== "void") return
  ctx.save()
  ctx.globalCompositeOperation = "difference"
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
