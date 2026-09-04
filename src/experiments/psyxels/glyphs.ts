/**
 * What one psyx can be showing: a small, finite set of frames, and the rule for
 * which frame comes next.
 *
 * A psyx here is not a colour, it is a *mini-animation* — it holds one frame
 * for a while, then picks another. So the set has to be small enough that a
 * viewer recognises a repeat and reads the field as a vocabulary rather than as
 * noise, and related enough that consecutive frames look like the same object
 * moving rather than two unrelated marks swapped.
 *
 * Both fall out of describing a frame by its *features* — {horizontal stroke,
 * vertical stroke, diagonal pair, ring, fill} — and taking the distance between
 * two frames to be how many features differ. A plus is one feature from a minus
 * and one from a circled plus, so a psyx wandering by nearest neighbours grows a
 * stroke, then a ring, then loses the stroke — which reads as one thing changing
 * its mind.
 *
 * **What the features buy is that walk, and nothing else any more.** They were
 * once the transition as well: a stroke grew out of the middle, a ring opened
 * from the centre. That was tried and taken out, because a large plus spends its
 * transition as a pair of stubs and a ring has no legible fraction of itself —
 * `paintPsyxel` cross-fades two whole marks instead. So the rule that a frame
 * must be decomposable was paying for something the piece no longer does, and a
 * mark that cannot be decomposed is free to join as long as it can say who its
 * neighbours are. The last six are those: drawn, each with a feature vector that
 * is a claim about kinship rather than a description of its shape.
 *
 * They are drawn rather than typeset, in units of their own cell, because a
 * psyx here is anywhere between three and two hundred psyxels across and a font
 * would have to be loaded, measured and hinted at every one of those sizes.
 */

/**
 * A frame's features, and for a few of them a drawing.
 *
 * Order matters: `vocabulary` takes the first N.
 *
 * The features do two jobs for a decomposed mark — they *are* its geometry, and
 * they say who its neighbours are. A mark that cannot be decomposed brings its
 * own `paint` and the features then do only the second job: they are a claim
 * about kinship rather than a description of the shape. A moon is given a ring
 * and an upright because a bare ring is what it should follow and be followed
 * by, not because there is an upright stroke anywhere in it.
 *
 * That claim has to be *unique*, or two marks sit at distance zero and the walk
 * between them stops meaning anything. Every vector below is one no other mark
 * uses.
 */
type Feature = {
  h: boolean
  v: boolean
  diagonal: boolean
  ring: boolean
  fill: boolean
  /** Drawn rather than decomposed, in units of the mark's own radius. */
  paint?: (ctx: CanvasRenderingContext2D, r: number, lineWidth: number) => void
}

const frame = (h: boolean, v: boolean, diagonal: boolean, ring: boolean, fill = false): Feature => ({
  h,
  v,
  diagonal,
  ring,
  fill,
})

/** A mark with its own geometry, whose features stand only for its kinship. */
const figure = (
  paint: NonNullable<Feature["paint"]>,
  h: boolean,
  v: boolean,
  diagonal: boolean,
  ring: boolean,
  fill = false,
): Feature => ({ h, v, diagonal, ring, fill, paint })

/**
 * The vocabulary, in the order a growing `vocabulary` setting admits them.
 *
 * The four named ones come first — minus, plus, and each in a circle — because
 * they are the set the piece was described from, and a field made of only those
 * is already the thing. What follows adds ways to be quiet (a bare ring, a dot)
 * and ways to be loud (the diagonals) without changing the family.
 *
 * **The drawn marks come last, and new ones are appended rather than slotted
 * in.** A scene names the marks it wants, so its meaning does not depend on the
 * order — but `vocabulary=N` in an old link does, and that is read as the first
 * N. Inserting a mark would quietly rewrite every address ever shared.
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
  // A ring and an upright: one step from a bare ring, which is what a crescent
  // should sit beside, and from a bar and a circled plus.
  figure(moon, false, true, false, true), // moon
  // A plus and the diagonals at once: one step from a plus, which is what it is
  // — the same four points with the waist pulled in.
  figure(starFour, true, true, true, false), // star
  // A stroke and the diagonals: one step from a cross, from a minus and from a
  // star, which is where a square stood on its point belongs.
  figure(diamond, true, false, true, false), // diamond
  // A circled stroke that has grown a pupil: one step from a circled minus and
  // one from a dot.
  figure(eye, true, false, false, true, true), // eye
  // Round and solid like a dot, bitten like a moon, and one step from each.
  figure(heart, false, true, false, true, true), // heart
  // A moon's curve on the diagonal: one step from the moon and from a circled
  // cross.
  figure(leaf, false, true, true, true), // leaf
]

export const GLYPH_COUNT = GLYPHS.length

/**
 * What each mark is called, in the same order.
 *
 * Names rather than a count, because a scene names its marks in the URL and an
 * address is the piece's honest state — `glyphs=ring,dot,moon` says what it
 * will show, where a bitmask or an index list says nothing a reader can check.
 * They cost more characters than they save, which is the trade this piece keeps
 * making on purpose.
 */
export const GLYPH_NAMES = [
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
] as const

export type GlyphName = (typeof GLYPH_NAMES)[number]

export const isGlyphName = (value: unknown): value is GlyphName =>
  typeof value === "string" && (GLYPH_NAMES as readonly string[]).includes(value)

export const indexOfGlyph = (name: GlyphName): number => GLYPH_NAMES.indexOf(name)

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
 * How strongly a psyx prefers a frame near the one it is showing.
 *
 * Each extra feature of difference is this much less likely. At 0.35 a
 * one-feature step is three times a two-feature step and nine times a three —
 * enough that the field reads as psyxels *changing* rather than as psyxels being
 * replaced, and not so much that the far half of the vocabulary never appears.
 * A psyx never repeats its current frame: a change that changes nothing is a
 * pause, and pauses are what the hold time is for.
 */
const KINSHIP = 0.35

/** Precomputed transition weights: the whole vocabulary against itself. */
const WEIGHTS: number[][] = GLYPHS.map((from, i) =>
  GLYPHS.map((to, j) => (i === j ? 0 : KINSHIP ** (distance(from, to) - 1))),
)

/**
 * The frame after this one, drawn from the marks a scene has chosen.
 *
 * `allowed` is an arbitrary subset rather than a prefix, because a scene picks
 * its marks by name. Nothing here assumes they are contiguous or in order, and
 * a `current` the set no longer contains is fine — every weight then counts,
 * which is exactly the walk a psyx should take on its way back in.
 *
 * `roll` is a number in [0, 1) from the psyx's own generator, so the choice is
 * reproducible from the seed and the psyx's identity.
 */
export function nextGlyph(current: number, allowed: readonly number[], roll: number): number {
  if (allowed.length === 0) return 0
  if (allowed.length === 1) return allowed[0]!

  // `WEIGHTS` is zero on the diagonal, so a psyx cannot draw the frame it is
  // already showing without the fallback below.
  const row = WEIGHTS[Math.max(0, Math.min(GLYPH_COUNT - 1, current))]!
  let total = 0
  for (const glyph of allowed) total += row[glyph]!
  if (total <= 0) return allowed[0]!

  let target = roll * total
  for (const glyph of allowed) {
    target -= row[glyph]!
    if (target <= 0) return glyph
  }
  return allowed[allowed.length - 1]!
}

const TURN = Math.PI * 2
const QUARTER = Math.PI / 4

/**
 * A crescent, traced rather than bent.
 *
 * The centreline of a crescent is not a circle, so a moon drawn as one bent
 * stroke comes out a broken ring. What reads is the *silhouette*: the far side
 * of one circle and the near side of another that bites into it, closed into a
 * single path. Equal radii keep the two horns the same.
 *
 * **The bite opens as the stroke thickens.** Held at a fraction of the radius
 * it is right at a hairline and wrong at weight — the ink closes the gap from
 * both sides at once and a heavy moon comes out a bean. The offset is what sets
 * the horn width, so it has to answer to the ink and not to the box alone.
 */
function moon(ctx: CanvasRenderingContext2D, r: number, lineWidth: number): void {
  // Capped short of 2r, where the two circles stop meeting at all and there is
  // no crescent left to describe.
  const bite = Math.min(r * 1.02 + lineWidth * 0.55, r * 1.9)
  // Where the circles cross, as an angle off the line joining their centres.
  const phi = Math.acos(bite / (2 * r))
  const tilt = -Math.PI * 0.32
  const bx = Math.cos(tilt) * bite
  const by = Math.sin(tilt) * bite

  ctx.moveTo(Math.cos(tilt + phi) * r, Math.sin(tilt + phi) * r)
  ctx.arc(0, 0, r, tilt + phi, tilt - phi + TURN)
  ctx.arc(bx, by, r, tilt + Math.PI + phi, tilt + Math.PI - phi, true)
  ctx.closePath()
}

/**
 * Four points with the waist pulled in — a plus that has been given curves.
 *
 * The control point is the whole of it: at zero the curves are straight and the
 * mark is a rhombus, and past about a fifth the points thin into needles that
 * are gone at the sizes this piece works at.
 */
function starFour(ctx: CanvasRenderingContext2D, r: number): void {
  const waist = r * 0.17
  ctx.moveTo(r, 0)
  ctx.quadraticCurveTo(waist, waist, 0, r)
  ctx.quadraticCurveTo(-waist, waist, -r, 0)
  ctx.quadraticCurveTo(-waist, -waist, 0, -r)
  ctx.quadraticCurveTo(waist, -waist, r, 0)
  ctx.closePath()
}

/** The star's four points joined straight: a square stood on its corner. */
function diamond(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.moveTo(0, -r)
  ctx.lineTo(r, 0)
  ctx.lineTo(0, r)
  ctx.lineTo(-r, 0)
  ctx.closePath()
}

/**
 * A lens and a pupil.
 *
 * The control points sit at twice the lid's height because a quadratic reaches
 * only halfway to its control: asking for the apex directly gives a shape half
 * as open as it reads on the page, and the eye comes out a slit.
 */
function eye(ctx: CanvasRenderingContext2D, r: number): void {
  const lid = r * 0.64
  ctx.moveTo(-r, 0)
  ctx.quadraticCurveTo(0, -lid * 2, r, 0)
  ctx.quadraticCurveTo(0, lid * 2, -r, 0)
  ctx.closePath()

  const pupil = r * 0.3
  ctx.moveTo(pupil, 0)
  ctx.arc(0, 0, pupil, 0, TURN)
}

/** Two lobes and a point, drawn as one closed curve from the point and back. */
function heart(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.moveTo(0, r * 0.78)
  ctx.bezierCurveTo(-r * 1.15, -r * 0.05, -r * 0.6, -r * 0.95, 0, -r * 0.3)
  ctx.bezierCurveTo(r * 0.6, -r * 0.95, r * 1.15, -r * 0.05, 0, r * 0.78)
  ctx.closePath()
}

/**
 * A pointed oval on the diagonal, with the midrib running out past it as a stem.
 *
 * **The vein is not decoration.** Without it the outline is a lens, which is an
 * eye that has lost its pupil — and the two would be a pair of marks the field
 * cannot tell apart at the sizes this piece mostly works at.
 */
function leaf(ctx: CanvasRenderingContext2D, r: number): void {
  const tip = r * 0.76
  ctx.moveTo(-tip, tip)
  ctx.quadraticCurveTo(-tip, -tip, tip, -tip)
  ctx.quadraticCurveTo(tip, tip, -tip, tip)
  ctx.closePath()

  ctx.moveTo(-r * 0.95, r * 0.95)
  ctx.lineTo(tip * 0.45, -tip * 0.45)
}

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
 * three psyxels and at two hundred.
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
 * One path, one stroke, whatever is in transition: at several thousand psyxels a
 * frame the cost here is canvas state changes rather than psyxels touched, and a
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

  // A drawn mark is still one path and one stroke, and still sized off `full`,
  // so a moon and a circled plus are the same mark across in the same field.
  if (shape.paint) {
    ctx.lineWidth = lineWidth
    ctx.save()
    ctx.translate(cx, cy)
    ctx.beginPath()
    shape.paint(ctx, full, lineWidth)
    ctx.stroke()
    ctx.restore()
    return
  }
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
