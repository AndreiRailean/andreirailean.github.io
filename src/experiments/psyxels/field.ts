import { gaussian, hashSeed, makeRng, type Rng } from "@/experiments/kit/random"
import { GLYPH_COUNT, nextGlyph } from "@/experiments/psyxels/glyphs"
// The arrival ease's own length. This file decides when a pixel was born and
// `pulse.ts` decides what being newly born looks like, so the constant lives
// with the second of those and is read here.
import { BIRTH_S } from "@/experiments/psyxels/pulse"
import type { Mask } from "@/experiments/psyxels/mask"
import type { Settings } from "@/experiments/psyxels/settings"

/**
 * The packing: how squares of wildly different sizes cover a picture without
 * gaps, and how they change size while you watch.
 *
 * **It is a quadtree, and that choice does most of the work.** The obvious
 * reading of "pixels of different sizes packed into the frame" is a bin-packing
 * problem — place a 40, then a 20, then fill the gaps — and it is the wrong one
 * twice over. It leaves slivers no square fits, and it has no cheap answer to
 * "this pixel should now be smaller" other than repacking everything around it.
 * Quartering has neither problem: a square either is one pixel or is four,
 * recursively, so the cover is exact by construction and a size change is one
 * local event that disturbs nothing outside its own square.
 *
 * A pixel's size is decided by two things, and keeping them separate is what
 * makes the piece legible:
 *
 * - **Detail forces a split.** A square straddling an edge has high variance, so
 *   it quarters, and its children quarter again if they still straddle. Contours
 *   therefore get small pixels and flat interiors keep large ones, without
 *   anything here knowing what the picture is. This is what keeps an A an A.
 * - **Variety splits for no reason.** Detail alone gives the tidy fine-at-the-
 *   edges look of a compression artefact. A square that had no need to split and
 *   does anyway is what makes the field read as populated rather than computed.
 *
 * Churn is those two decisions being taken again, per square, on the square's
 * own clock. Nothing else moves a pixel.
 */

/** No pixel smaller than this. Below it a glyph is a smudge and the count explodes. */
const MIN_PX = 3

/**
 * One pixel: a square of the picture, and a small mind of its own.
 *
 * The first block is what the packing decided and the second is what the pixel
 * decided. Only the packing can change the first, and it does so by replacing
 * the pixel rather than by editing it — which is why a pixel's `born` is the
 * moment its square came into existence and not the moment the field started.
 */
export type Pixel = {
  x: number
  y: number
  size: number
  depth: number
  /** Mean coverage of the subject under this square, 0 to 1. */
  ink: number
  /** Ink-weighted colour of the subject under it, each channel 0 to 1. */
  r: number
  g: number
  b: number
  /** When this square came into existence, on the piece's clock. */
  born: number
  /** Which frame it is showing. */
  glyph: number
  /** The frame it is coming from, which it is still partly showing. */
  from: number
  /** When it last changed frame, which is when that transition started. */
  flicked: number
  /** How long this pixel's current hold is, so a transition can be a share of it. */
  gap: number
  /** Its own speed, as a multiplier on flicker and tempo. Some pixels think faster. */
  rate: number
  /** Where its colour sits relative to the field's, in units of the spread. */
  hue: number
  /** Where it was before its last change of frame; colour slides between the two. */
  hueFrom: number
  /** Where it is in its own breath, 0 to 1. */
  phase: number
  /** How deeply it breathes, as a multiplier on the pulse depth. */
  swing: number
}

type Node = Pixel & {
  /** Unevenness under the square: 0 flat, 0.5 a hard edge through the middle. */
  dev: number
  split: boolean
  kids: Node[] | null
  /** Column and row at this depth, so a square's identity survives a repack. */
  ix: number
  iy: number
  /** Its own generator, for every decision it will ever take. */
  rng: Rng
  /** When it last reconsidered its size, and the draw deciding when it next will. */
  changed: number
  changeRoll: number
  /** The draw deciding when it next changes frame. */
  flickRoll: number
}

export type Field = {
  /** Every leaf, including ones currently below the ink threshold. */
  pixels: () => Pixel[]
  /** Advance to `time`: frame changes, and squares reconsidering their size. */
  update: (time: number, settings: Settings) => void
  /** How many squares have changed size since the field was packed. */
  changes: () => number
  /** How many frame changes the pixels have made since the field was packed. */
  flicks: () => number
  /** Leaves by depth, coarsest first. */
  byDepth: () => number[]
}

/** A pixel's own draws, in a fixed order so adding one does not restir the field. */
function breatheLife(node: Node, time: number, vocabulary: number): void {
  const rng = node.rng
  node.glyph = Math.floor(rng() * Math.max(1, Math.min(GLYPH_COUNT, vocabulary)))
  // A newborn is not mid-transition: it arrives showing the frame it holds.
  node.from = node.glyph
  node.rate = 0.35 + 1.9 * rng() ** 1.6
  // Divided by the clamp so the spread is a bound rather than a suggestion: at
  // ±2.5σ a pixel sits exactly `spread` degrees from the field's hue, and the
  // bulk of the population sits within 40% of it.
  node.hue = gaussian(rng) * 0.4
  node.hueFrom = node.hue
  node.phase = rng()
  node.swing = 0.55 + 0.9 * rng()
  node.born = time
  node.flicked = time
  node.flickRoll = rng()
  node.gap = 1
}

type Context = { mask: Mask; settings: Settings; time: number; originX: number; originY: number }

/**
 * Builds one square and, if it wants to, its four children.
 *
 * Returns `null` for a square with nothing under it at all — no ink and no
 * variation. Pruning there rather than at draw time is what keeps the cost
 * proportional to the subject rather than to the frame: an empty corner of the
 * picture is one lookup, not a tree.
 */
function makeNode(
  context: Context,
  x: number,
  y: number,
  size: number,
  depth: number,
  ix: number,
  iy: number,
): Node | null {
  const { mask, settings, time } = context
  const stats = mask.stats(x, y, size)
  if (stats.ink <= 0 && stats.dev <= 0) return null

  const node: Node = {
    x,
    y,
    size,
    depth,
    ink: stats.ink,
    dev: stats.dev,
    r: stats.r,
    g: stats.g,
    b: stats.b,
    born: time,
    glyph: 0,
    from: 0,
    gap: 1,
    rate: 1,
    hue: 0,
    hueFrom: 0,
    phase: 0,
    swing: 1,
    split: false,
    kids: null,
    ix,
    iy,
    // Salted by depth and position rather than by a running index: a square's
    // identity is where it is, so raising the subdivision or repacking one
    // corner leaves every other square drawing the same numbers.
    rng: makeRng(hashSeed(settings.seed, depth, ix, iy)),
    changed: time,
    changeRoll: 0,
    flicked: time,
    flickRoll: 0,
  }

  node.changeRoll = node.rng()
  if (decideSplit(node, settings)) {
    grow(context, node)
  } else {
    breatheLife(node, time, settings.vocabulary)
  }

  return node
}

/**
 * Whether a square should be four squares.
 *
 * The threshold runs from half — the standard deviation of a hard edge cutting a
 * square in two, so nothing splits — down to a hair above zero, where any
 * variation at all is enough. Variety is consulted second and only matters where
 * detail did not already decide, which is why turning detail up does not make
 * variety redundant: they act in different places.
 */
function decideSplit(node: Node, settings: Settings): boolean {
  if (node.depth >= settings.levels) return false
  if (node.size / 2 < MIN_PX) return false
  const threshold = 0.5 * (1 - settings.detail) + 0.012
  if (node.dev > threshold) return true
  return node.rng() < settings.variety
}

/** Quarters a square, discarding children with nothing under them. */
function grow(context: Context, node: Node): void {
  const half = node.size / 2
  const kids: Node[] = []
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 2; column++) {
      const kid = makeNode(
        context,
        node.x + column * half,
        node.y + row * half,
        half,
        node.depth + 1,
        node.ix * 2 + column,
        node.iy * 2 + row,
      )
      if (kid) kids.push(kid)
    }
  }

  if (kids.length === 0) {
    // Only reachable when the picture has ink too faint for any child to see.
    node.split = false
    node.kids = null
    breatheLife(node, context.time, context.settings.vocabulary)
    return
  }

  node.split = true
  node.kids = kids
}

/** Collapses a square back to one pixel, which arrives new. */
function collapse(node: Node, time: number, vocabulary: number): void {
  node.split = false
  node.kids = null
  breatheLife(node, time, vocabulary)
}

/**
 * The gap before a square next reconsiders its size, in seconds.
 *
 * Read from a stored draw rather than scheduled ahead, so that dragging the
 * churn control retimes every square that has not yet fired instead of only
 * those packed after the change.
 */
const changeGap = (churn: number, roll: number) => (churn <= 0 ? Infinity : (60 / churn) * (0.4 + 1.5 * roll))

/** The gap before a pixel next picks a frame. Divided by its own rate: some pixels are quick. */
const flickGap = (flicker: number, roll: number, rate: number) =>
  flicker <= 0 ? Infinity : (0.35 + 1.6 * roll) / flicker / rate

/**
 * Packs a subject into pixels.
 *
 * The root grid is centred on the frame and overhangs it by a cell, so the
 * pattern does not lock to the top-left corner — which it visibly does when a
 * subject sits square with a grid that starts at the origin.
 */
export function packField(mask: Mask, settings: Settings, time: number): Field {
  const coarse = Math.max(MIN_PX * 2, settings.coarse)
  const columns = Math.ceil(mask.width / coarse) + 1
  const rows = Math.ceil(mask.height / coarse) + 1
  const context: Context = {
    mask,
    settings,
    // **The opening field is already here, not arriving.** Pixels born at the
    // current instant are at the start of their arrival ease, which is an alpha
    // of zero — so frame one is a blank canvas that fades up. Harmless while the
    // clock is running and fatal when it is not: under `prefers-reduced-motion`
    // the clock is frozen, and the piece was simply *gone*. Backdating the whole
    // initial build means only a change animates, which is what the ease is for.
    time: time - BIRTH_S,
    originX: (mask.width - columns * coarse) / 2,
    originY: (mask.height - rows * coarse) / 2,
  }

  const roots: Node[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const node = makeNode(
        context,
        context.originX + column * coarse,
        context.originY + row * coarse,
        coarse,
        0,
        column,
        row,
      )
      if (node) roots.push(node)
    }
  }

  let leaves: Pixel[] = []
  let depths: number[] = []
  let stale = true
  let changes = 0
  let flicks = 0

  function collect(node: Node, into: Pixel[], counts: number[]): void {
    if (node.split && node.kids) {
      for (const kid of node.kids) collect(kid, into, counts)
      return
    }
    into.push(node)
    counts[node.depth] = (counts[node.depth] ?? 0) + 1
  }

  function refresh(): void {
    if (!stale) return
    leaves = []
    depths = []
    for (const root of roots) collect(root, leaves, depths)
    stale = false
  }

  /** One square's turn: reconsider its size, or, being a leaf, its frame. */
  function visit(node: Node, time: number, settings: Settings): void {
    if (time - node.changed >= changeGap(settings.churn, node.changeRoll)) {
      node.changed = time
      node.changeRoll = node.rng()
      const wanted = decideSplit(node, settings)
      if (wanted !== node.split) {
        // `context` still carries the settings the field was packed with, which
        // is correct: anything in `needsPacking` rebuilds the whole field, so the
        // two can only differ in ways that do not reach geometry.
        context.time = time
        if (wanted) grow(context, node)
        else collapse(node, time, settings.vocabulary)
        changes++
        stale = true
      }
    }

    if (node.split && node.kids) {
      for (const kid of node.kids) visit(kid, time, settings)
      return
    }

    const vocabulary = Math.max(1, Math.min(GLYPH_COUNT, Math.round(settings.vocabulary)))
    // A shrinking vocabulary can leave a pixel showing a frame that no longer
    // exists, so that is a change due now rather than at the next tick.
    const due = node.glyph >= vocabulary || time - node.flicked >= flickGap(settings.flicker, node.flickRoll, node.rate)
    if (!due) return
    node.from = node.glyph
    node.glyph = nextGlyph(node.glyph, vocabulary, node.rng())
    // **Colour is redrawn with the frame, not on a clock of its own.** A pixel
    // changing what it shows and what colour it is in the same instant is what
    // makes a frame change read as one event; drifting the hue separately gives
    // two overlapping animations and the field loses its beat. It also means
    // `flicker: 0` really is held — frame, colour and all.
    node.hueFrom = node.hue
    node.hue = gaussian(node.rng) * 0.4
    node.flicked = time
    node.flickRoll = node.rng()
    // The interval just entered, kept so a transition can be a share of it
    // rather than a fixed duration: at five changes a second a quarter-second
    // ease would never finish, and the field would never settle on a frame.
    node.gap = flickGap(settings.flicker, node.flickRoll, node.rate)
    flicks++
  }

  return {
    pixels() {
      refresh()
      return leaves
    },

    update(time, settings) {
      for (const root of roots) visit(root, time, settings)
    },

    changes: () => changes,

    flicks: () => flicks,

    byDepth() {
      refresh()
      return Array.from({ length: Math.max(depths.length, 1) }, (_, depth) => depths[depth] ?? 0)
    },
  }
}
