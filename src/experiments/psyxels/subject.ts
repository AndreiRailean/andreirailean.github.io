/**
 * The still picture underneath, drawn once into an offscreen canvas.
 *
 * Everything else in this piece is about *how* a picture is pixellated; this is
 * the only place that knows what the picture is. It hands back nothing but a
 * canvas of ink on transparency, which is what keeps a letterform and a
 * photograph interchangeable further down: `mask.ts` reads coverage and colour
 * off whatever was drawn here and never asks which it was.
 */

/** What can be pixellated. Every one of them is a still image by the time the field sees it. */
export const SUBJECTS = ["A", "L", "&", "avatar"] as const

export type SubjectKind = (typeof SUBJECTS)[number]

export const SUBJECT_LABELS: Record<SubjectKind, string> = {
  A: "A",
  L: "L",
  "&": "&",
  avatar: "portrait",
}

export const isSubject = (value: unknown): value is SubjectKind =>
  typeof value === "string" && (SUBJECTS as readonly string[]).includes(value)

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
  return { ok: true }
}
