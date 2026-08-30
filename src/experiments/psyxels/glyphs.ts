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
 * Describing a frame by its features pays a second time, and it is the reason
 * this is not a set of pictures. **A change of frame is a change of features,
 * so it can be played rather than cut.** A stroke grows out of the middle, a
 * ring opens from the centre, a disc closes — and the pixel reads as one mark
 * rearranging itself instead of one mark being swapped for another. Cross-fading
 * two drawings would give the same information and none of that, at twice the
 * draw calls.
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

const TURN = Math.PI * 2
const QUARTER = Math.PI / 4

/**
 * The two stroke pairs a mark is made of: how far each reaches, and how far the
 * pair is turned.
 *
 * Split out from the drawing so the rotation can be asserted on: a cross must be
 * a plus turned rather than a shape of its own, or the two are quietly allowed
 * to drift apart in size and weight.
 */
export function armsOf(glyph: number): { along: boolean; across: boolean; spin: number } {
  const shape = GLYPHS[Math.max(0, Math.min(GLYPH_COUNT - 1, glyph))]!
  return {
    along: shape.h || shape.diagonal,
    across: shape.v || shape.diagonal,
    spin: shape.diagonal ? QUARTER : 0,
  }
}

/**
 * Paints a mark, centred, inside a box of half-width `extent`.
 *
 * Everything is a fraction of `extent`, so the same call draws a legible mark at
 * three pixels and at two hundred.
 *
 * **The diagonals are not a third pair of strokes; they are the first two
 * turned.** A cross is a plus rotated by an eighth turn, and saying so in the
 * geometry costs one sine and one cosine and deletes a branch.
 *
 * The strokes stop short of the ring rather than crossing it, which is what
 * makes a circled plus read as one sign instead of a plus with a circle drawn
 * over it — and they pull in as the ring arrives, so that transition is one
 * movement rather than a stroke that jumps shorter the instant a ring appears
 * around it.
 *
 * One path, one stroke, whatever is in transition: at several thousand pixels a
 * frame the cost here is canvas state changes rather than pixels touched, and a
 * transition drawn as two overlaid frames would double them. The disc is the one
 * exception — it is a fill — and only the frames that have one reach it.
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
  const full = extent * 0.82
  // The strokes stop short of a ring rather than crossing it, which is what
  // makes a circled plus read as one sign instead of a plus with a circle drawn
  // over it.
  const reach = shape.ring ? full * 0.58 : extent * 0.86

  if (shape.fill) {
    ctx.beginPath()
    ctx.arc(cx, cy, full, 0, TURN)
    ctx.fill()
    return
  }

  const { along, across, spin } = armsOf(glyph)
  const alongX = Math.cos(spin) * reach
  const alongY = Math.sin(spin) * reach

  ctx.lineWidth = lineWidth
  ctx.beginPath()

  if (shape.ring) {
    ctx.moveTo(cx + full, cy)
    ctx.arc(cx, cy, full, 0, TURN)
  }
  if (along) {
    ctx.moveTo(cx - alongX, cy - alongY)
    ctx.lineTo(cx + alongX, cy + alongY)
  }
  if (across) {
    ctx.moveTo(cx + alongY, cy - alongX)
    ctx.lineTo(cx - alongY, cy + alongX)
  }

  ctx.stroke()
}
