/**
 * What one pixel can be showing: a small, finite set of frames, and the rule for
 * which frame comes next.
 *
 * A pixel here is not a colour, it is a *mini-animation* — it holds one frame
 * for a while, then picks another. So the set has to be small enough that a
 * viewer recognises a repeat and reads the field as a vocabulary rather than as
 * noise, and related enough that consecutive frames look like the same object
 * moving rather than two unrelated marks swapped.
 *
 * Both fall out of describing a frame by its *features* rather than as a
 * picture. Every glyph is a subset of {horizontal stroke, vertical stroke,
 * diagonal pair, ring, fill}, and the distance between two glyphs is how many
 * features differ. A plus is one feature from a minus and one from a circled
 * plus, so a pixel wandering by nearest neighbours grows a stroke, then a ring,
 * then loses the stroke — which reads as one thing changing its mind.
 *
 * They are drawn rather than typeset, in units of their own cell, because a
 * pixel here is anywhere between three and two hundred pixels across and a font
 * would have to be loaded, measured and hinted at every one of those sizes.
 */

/** A frame's features. Order matters: `vocabulary` takes the first N. */
type Feature = { h: boolean; v: boolean; diagonal: boolean; ring: boolean; fill: boolean }

const frame = (h: boolean, v: boolean, diagonal: boolean, ring: boolean, fill = false): Feature => ({
  h,
  v,
  diagonal,
  ring,
  fill,
})

/**
 * The vocabulary, in the order a growing `vocabulary` setting admits them.
 *
 * The four named ones come first — minus, plus, and each in a circle — because
 * they are the set the piece was described from, and a field made of only those
 * is already the thing. What follows adds ways to be quiet (a bare ring, a dot)
 * and ways to be loud (the diagonals) without changing the family.
 */
export const GLYPHS: Feature[] = [
  frame(true, false, false, false), // minus
  frame(true, true, false, false), // plus
  frame(true, false, false, true), // circled minus
  frame(true, true, false, true), // circled plus
  frame(false, false, false, true), // ring
  frame(false, false, false, true, true), // dot
  frame(false, false, true, false), // cross
  frame(false, false, true, true), // circled cross
  frame(false, true, false, false), // bar
]

export const GLYPH_COUNT = GLYPHS.length

/** How many features two frames disagree on. */
function distance(a: Feature, b: Feature): number {
  let d = 0
  if (a.h !== b.h) d++
  if (a.v !== b.v) d++
  if (a.diagonal !== b.diagonal) d++
  if (a.ring !== b.ring) d++
  if (a.fill !== b.fill) d++
  return d
}

/**
 * How strongly a pixel prefers a frame near the one it is showing.
 *
 * Each extra feature of difference is this much less likely. At 0.35 a
 * one-feature step is three times a two-feature step and nine times a three —
 * enough that the field reads as pixels *changing* rather than as pixels being
 * replaced, and not so much that the far half of the vocabulary never appears.
 * A pixel never repeats its current frame: a change that changes nothing is a
 * pause, and pauses are what the hold time is for.
 */
const KINSHIP = 0.35

/** Precomputed transition weights, since the vocabulary is fixed at nine. */
const WEIGHTS: number[][] = GLYPHS.map((from, i) =>
  GLYPHS.map((to, j) => (i === j ? 0 : KINSHIP ** (distance(from, to) - 1))),
)

/**
 * The frame after this one, drawn from the first `count` of the vocabulary.
 *
 * `roll` is a number in [0, 1) from the pixel's own generator, so the choice is
 * reproducible from the seed and the pixel's identity.
 */
export function nextGlyph(current: number, count: number, roll: number): number {
  const limit = Math.max(1, Math.min(GLYPH_COUNT, Math.round(count)))
  if (limit === 1) return 0

  const row = WEIGHTS[Math.min(current, GLYPH_COUNT - 1)]!
  let total = 0
  for (let i = 0; i < limit; i++) total += row[i]!
  if (total <= 0) return (current + 1) % limit

  let target = roll * total
  for (let i = 0; i < limit; i++) {
    target -= row[i]!
    if (target <= 0) return i
  }
  return limit - 1
}

/**
 * Paints one frame, centred, inside a box of half-width `extent`.
 *
 * Everything is a fraction of `extent`, so the same call draws a legible mark at
 * three pixels and at two hundred. The strokes stop short of the ring rather
 * than crossing it, which is what makes a circled plus read as one sign instead
 * of a plus with a circle drawn over it.
 *
 * One path, one stroke: at several thousand pixels a frame, the cost here is
 * canvas state changes rather than pixels touched.
 */
export function paintGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: number,
  cx: number,
  cy: number,
  extent: number,
  lineWidth: number,
): void {
  const shape = GLYPHS[Math.max(0, Math.min(GLYPH_COUNT - 1, glyph))]!
  const radius = extent * 0.82
  const reach = shape.ring ? radius * 0.58 : extent * 0.86
  const diagonal = reach * 0.74

  if (shape.fill) {
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  ctx.lineWidth = lineWidth
  ctx.beginPath()

  if (shape.ring) {
    ctx.moveTo(cx + radius, cy)
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  }
  if (shape.h) {
    ctx.moveTo(cx - reach, cy)
    ctx.lineTo(cx + reach, cy)
  }
  if (shape.v) {
    ctx.moveTo(cx, cy - reach)
    ctx.lineTo(cx, cy + reach)
  }
  if (shape.diagonal) {
    ctx.moveTo(cx - diagonal, cy - diagonal)
    ctx.lineTo(cx + diagonal, cy + diagonal)
    ctx.moveTo(cx + diagonal, cy - diagonal)
    ctx.lineTo(cx - diagonal, cy + diagonal)
  }

  ctx.stroke()
}
