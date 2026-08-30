import { gaussian, hashSeed, makeRng, type Rng } from "@/experiments/random"
import { GLYPH_COUNT, nextGlyph } from "@/experiments/psyxels/glyphs"
// The arrival ease's own length. This file decides when a psyx was born and
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
 * reading of "psyxels of different sizes packed into the frame" is a bin-packing
 * problem — place a 40, then a 20, then fill the gaps — and it is the wrong one
 * twice over. It leaves slivers no square fits, and it has no cheap answer to
 * "this psyx should now be smaller" other than repacking everything around it.
 * Quartering has neither problem: a square either is one psyx or is four,
 * recursively, so the cover is exact by construction and a size change is one
 * local event that disturbs nothing outside its own square.
 *
 * A psyx's size is decided by two things, and keeping them separate is what
 * makes the piece legible:
 *
 * - **Detail forces a split.** A square straddling an edge has high variance, so
 *   it quarters, and its children quarter again if they still straddle. Contours
 *   therefore get small psyxels and flat interiors keep large ones, without
 *   anything here knowing what the picture is. This is what keeps an A an A.
 * - **Variety splits for no reason.** Detail alone gives the tidy fine-at-the-
 *   edges look of a compression artefact. A square that had no need to split and
 *   does anyway is what makes the field read as populated rather than computed.
 *
 * Churn is those two decisions being taken again, per square, on the square's
 * own clock. Nothing else moves a psyx.
 */

/** No psyx narrower than this many screen pixels. Below it a mark is a smudge and the count explodes. */
const MIN_PX = 3

/**
 * One psyx: a square of the picture, and a small mind of its own.
 *
 * The first block is what the packing decided and the second is what the psyx
 * decided. Only the packing can change the first, and it does so by replacing
 * the psyx rather than by editing it — which is why a psyx's `born` is the
 * moment its square came into existence and not the moment the field started.
 */
export type Psyx = {
  x: number
  y: number
  size: number
  depth: number
  /** Mean coverage of the subject under this square, 0 to 1. */
  ink: number
  /**
   * How much of an edge of the subject runs under it, 0 to 1.
   *
   * The same unevenness the packing subdivides on, normalised — so it is high
   * along a contour and zero in a flat interior, and the colour can say so.
   */
  edge: number
  /**
   * Its own draw, held for as long as it exists.
   *
   * What makes a soft boundary *dithered* rather than merely dim: a psyx half
   * inside the subject is either there or not, decided once, and the band of
   * them along an edge is what reads as fuzz. Re-rolled only when the square is
   * repacked, so the fringe shimmers on the churn's clock rather than every
   * frame.
   */
  luck: number
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
  /** How long this psyx's current hold is, so a transition can be a share of it. */
  gap: number
  /** Its own speed, as a multiplier on flicker and tempo. Some psyxels think faster. */
  rate: number
  /** Where its colour sits relative to the field's, in units of the spread. */
  hue: number
  /** Where it was before its last change of frame; colour slides between the two. */
  hueFrom: number
  /** Where it is in its own breath, 0 to 1. */
  phase: number
  /** How deeply it breathes, as a multiplier on the pulse depth. */
  swing: number
  /** Where its mark sits inside its own square, as a fraction of the square, −1 to 1. */
  offsetX: number
  offsetY: number
}

type Node = Psyx & {
  /** Unevenness under the square: 0 flat, 0.5 a hard edge through the middle. */
  dev: number
  split: boolean
  kids: Node[] | null
  /**
   * The children it had when it last merged, kept rather than discarded.
   *
   * **A big psyx coming and going must not restir the grain underneath it.**
   * Rebuilding the subtree on every split gave a square's fine psyxels a life no
   * longer than its coarse one — every ancestor that changed its mind wiped
   * them — so the finest grain turned over several times faster than anything
   * else and the large marks were the only stable thing on screen. Kept, they
   * resume: same marks, same colours, same places, arriving again rather than
   * being replaced.
   */
  spare: Node[] | null
  /** Column and row at this depth, so a square's identity survives a repack. */
  ix: number
  iy: number
  /** Its own generator, for every decision it will ever take. */
  rng: Rng
  /**
   * How many times running it has decided to stay whole.
   *
   * Each one makes the next decision likelier to go the other way, which bounds
   * the tail. Without it the odds are memoryless and a coarse psyx that keeps
   * winning the toss sits there for twenty seconds — reported as "a large psyx
   * staying on screen for a very long time", and it is the mean that looked fine
   * rather than the distribution.
   */
  patience: number
  /** When it last reconsidered its size, and the draw deciding when it next will. */
  changed: number
  changeRoll: number
  /** The draw deciding when it next changes frame. */
  flickRoll: number
}

/** A psyx that has been replaced, kept only long enough to fade. */
export type Ghost = Psyx & { died: number }

/**
 * Longest a ghost is kept, in seconds of the piece's clock.
 *
 * The renderer decides how fast each one actually goes — a coarse psyx leaves
 * faster than fine grain — so this is only the bound at which one can be
 * forgotten.
 */
const MOURNING = 1.2

export type Field = {
  /** Every leaf, including ones currently below the ink threshold. */
  psyxels: () => Psyx[]
  /**
   * The squares that divided, each still holding a mark of its own.
   *
   * What `layers` draws. A leaf covers its square exactly, but its *mark* does
   * not — ink is a fraction of a square, and the larger the square the more of
   * it is ground. Drawing the divided squares as well puts the coarse marks back
   * over the grain that replaced them, so what shows through the unfilled parts
   * of a big mark is the finer psyxels underneath rather than the ground.
   */
  branches: () => Psyx[]
  /**
   * Psyxels that have just been replaced, still fading.
   *
   * **A psyx that vanishes leaves a hole until whatever replaced it has
   * arrived.** The arrival is eased over a good fraction of a second and the
   * departure was instantaneous, so a coarse psyx dividing showed bare ground
   * where it had been — worse the slower the piece is watched, since the ease
   * follows the clock and the eye does not. Keeping the departing mark for as
   * long as its replacement takes to arrive closes it.
   */
  ghosts: () => Ghost[]
  /** Advance to `time`: frame changes, and squares reconsidering their size. */
  update: (time: number, settings: Settings) => void
  /** How many squares have changed size since the field was packed. */
  changes: () => number
  /** How many frame changes the psyxels have made since the field was packed. */
  flicks: () => number
  /** Leaves by depth, coarsest first. */
  byDepth: () => number[]
}

/** A psyx's own draws, in a fixed order so adding one does not restir the field. */
function breatheLife(node: Node, time: number, vocabulary: number): void {
  const rng = node.rng
  node.glyph = Math.floor(rng() * Math.max(1, Math.min(GLYPH_COUNT, vocabulary)))
  // A newborn is not mid-transition: it arrives showing the frame it holds.
  node.from = node.glyph
  node.rate = 0.35 + 1.9 * rng() ** 1.6
  // Divided by the clamp so the spread is a bound rather than a suggestion: at
  // ±2.5σ a psyx sits exactly `spread` degrees from the field's hue, and the
  // bulk of the population sits within 40% of it.
  node.hue = gaussian(rng) * 0.4
  node.hueFrom = node.hue
  node.phase = rng()
  node.swing = 0.55 + 0.9 * rng()
  node.luck = rng()
  node.offsetX = rng() * 2 - 1
  node.offsetY = rng() * 2 - 1
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
    edge: Math.min(1, stats.dev / 0.36),
    luck: 0,
    offsetX: 0,
    offsetY: 0,
    rate: 1,
    hue: 0,
    hueFrom: 0,
    phase: 0,
    swing: 1,
    split: false,
    kids: null,
    spare: null,
    ix,
    iy,
    // Salted by depth and position rather than by a running index: a square's
    // identity is where it is, so raising the subdivision or repacking one
    // corner leaves every other square drawing the same numbers.
    rng: makeRng(hashSeed(settings.seed, depth, ix, iy)),
    changed: time,
    changeRoll: 0,
    patience: 0,
    flicked: time,
    flickRoll: 0,
  }

  node.changeRoll = node.rng()
  // **Every node is given a life, not only the leaves.** A square that divides
  // still has a mark of its own, and `layers` draws it: the coarse mark stays
  // and the grain shows through the parts of it that are not ink. A node that
  // was born divided had no mark at all before this, so raising the control lit
  // up half the tree with whatever glyph zero happened to be.
  breatheLife(node, time, settings.vocabulary)
  if (decideSplit(node, settings)) grow(context, node)

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

  if (node.dev > threshold) {
    /**
     * **Fuzz lets an edge square decline to subdivide.**
     *
     * Detail alone makes the boundary the finest thing in the picture, so the
     * artwork ends in a hairline however soft the psyxels either side of it are
     * — the field looks clipped to a shape rather than packed into one. A square
     * that declines stays coarse and *hangs over* the edge, which is the only
     * way a large mark ever sits outside the subject.
     *
     * Kept deliberately low, because declining is not free: a square that stays
     * whole is one psyx where there would have been four, so this thins the
     * whole field and not just its edge. At 0.5 the landing scene lost a third
     * of its psyxels and the letter went patchy; at 0.3 it loses a tenth and the
     * boundary still breaks up. The rest of the softness is `levelOf`'s, which
     * only ever *adds* psyxels outside the subject.
     */
    if (node.rng() > settings.fuzz * 0.3) return true
  }

  // A deadline rather than a lean, so the *tail* is cut and the mean is left
  // alone: leaning the odds instead halved every coarse psyx's life, which is a
  // different change from the one that was asked for.
  if (node.patience >= PATIENCE_LIMIT && settings.variety > 0) return true
  return node.rng() < splitChance(settings.variety)
}

/**
 * How likely a square with no reason to divide is to divide anyway.
 *
 * **Deliberately capped short of certain, and that is the whole control.** Read
 * as a raw probability it reached 1 and every square divided — so the setting
 * called *variety* produced, at its maximum, a field of one size with no variety
 * in it at all. The complaint came from the piece's author and it is exactly
 * right: a control whose extreme is uniform is not describing what it does.
 *
 * At this cap the sizes are as mixed as a single probability can make them —
 * roughly a quarter of the picture's area at the coarsest size and a third at
 * the finest, with the rest spread between. A field of nothing but fine psyxels
 * is still reachable, and it is `coarse` and `levels` that reach it, because
 * that is a statement about what sizes exist rather than about how mixed they
 * are.
 */
export const splitChance = (variety: number) => variety * 0.78

/** A departing psyx, kept as plain data: no generator, no children, no clocks. */
function mourn(node: Node, time: number, into: Ghost[]): void {
  if (node.split && node.kids) {
    for (const kid of node.kids) mourn(kid, time, into)
    return
  }
  into.push({
    x: node.x,
    y: node.y,
    size: node.size,
    depth: node.depth,
    ink: node.ink,
    edge: node.edge,
    luck: node.luck,
    r: node.r,
    g: node.g,
    b: node.b,
    born: node.born,
    glyph: node.glyph,
    from: node.from,
    flicked: node.flicked,
    gap: node.gap,
    rate: node.rate,
    hue: node.hue,
    hueFrom: node.hueFrom,
    phase: node.phase,
    swing: node.swing,
    offsetX: node.offsetX,
    offsetY: node.offsetY,
    died: time,
  })
}

/**
 * Quarters a square, discarding children with nothing under them.
 *
 * A subtree kept from a previous split is resumed rather than rebuilt: the same
 * psyxels come back, showing what they were showing, and only their arrival is
 * played again. See `spare`.
 */
function grow(context: Context, node: Node): void {
  if (node.spare) {
    node.split = true
    node.kids = node.spare
    node.spare = null
    // Their own clocks stopped while they were not there. Restarting both from
    // now keeps a returning subtree from firing a burst of held-up changes in
    // its first frame.
    for (const kid of node.kids) revive(kid, context.time)
    return
  }

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

/** Collapses a square back to one psyx, which arrives new. The grain underneath is kept. */
function collapse(node: Node, time: number, vocabulary: number): void {
  node.split = false
  node.spare = node.kids
  node.kids = null
  breatheLife(node, time, vocabulary)
}

/** Restarts a subtree's clocks, and plays its arrival again. */
function revive(node: Node, time: number): void {
  node.born = time
  node.changed = time
  node.flicked = time
  if (node.kids) for (const kid of node.kids) revive(kid, time)
}

/**
 * The gap before a square next reconsiders its size, in seconds.
 *
 * Read from a stored draw rather than scheduled ahead, so that dragging the
 * churn control retimes every square that has not yet fired instead of only
 * those packed after the change.
 */
/**
 * How much longer each level down waits between reconsidering itself.
 *
 * **A psyx's life is not its own square's clock; it is the first of its
 * ancestors to change its mind.** With every square asking at the same rate, a
 * psyx four levels down had five clocks that could end it and a coarse one had
 * one — so the fine grain turned over five times faster, and the large marks sat
 * still while everything around them boiled. That is exactly backwards for a
 * picture where the large marks are the ones the eye goes to.
 *
 * Measured over ninety seconds at the landing scene, mean age in seconds by
 * level, coarsest first:
 *
 * | patience | ages                            | flips | match |
 * | -------- | ------------------------------- | ----- | ----- |
 * | 1 (none) | 12.2, 10.3, 7.0, 7.0, 10.0      | 2894  | 0.888 |
 * | 2.2      | 7.7, 10.5, 11.3, 12.8, 14.6     | 764   | 0.934 |
 * | 3        | 7.5, 15.1, 18.2, 19.8, 20.8     | 402   | 0.821 |
 *
 * Left alone, the coarse marks are the longest-lived thing on screen, which is
 * backwards when they are also the marks the eye goes to. At 2.2 the order is
 * reversed and the ages run monotonically the other way. Further than that the
 * fine grain stops turning over at all, and the letterform starts to suffer —
 * every change is a whole coarse square's worth, and some of them merge across
 * a stroke.
 */
const DEPTH_PATIENCE = 2.2

/**
 * How many turns running a psyx may decide to stay whole before it must divide.
 *
 * Without it the odds are memoryless: a coarse psyx that keeps winning a fair
 * toss sits in one square for twenty seconds, which was reported as "a large
 * psyx staying on screen for a very long time" against a *mean* that looked
 * perfectly healthy. Three turns is reached by four scenes in a hundred, so the
 * distribution keeps its shape and loses its tail.
 */
const PATIENCE_LIMIT = 3

/**
 * What the slowing costs the field, given back.
 *
 * The control says how often a psyx is repacked, and it has to keep saying
 * that: slowing the deep squares without this took the whole field from a
 * thousand changes a minute to thirty, because almost every square *is* a deep
 * one. The series `1 + 1/3 + 1/9 + …` sums to this, so dividing the interval by
 * it leaves a deep psyx's total rate at the control's value and a coarse one's
 * within a third of it — where before they differed fivefold.
 */
const DEPTH_SPREAD = DEPTH_PATIENCE / (DEPTH_PATIENCE - 1)

const changeGap = (churn: number, roll: number, depth: number) =>
  churn <= 0 ? Infinity : ((60 / churn) * (0.4 + 1.5 * roll) * DEPTH_PATIENCE ** depth) / DEPTH_SPREAD

/** The gap before a psyx next picks a frame. Divided by its own rate: some psyxels are quick. */
const flickGap = (flicker: number, roll: number, rate: number) =>
  flicker <= 0 ? Infinity : (0.35 + 1.6 * roll) / flicker / rate

/**
 * Packs a subject into psyxels.
 *
 * The root grid is centred on the frame and overhangs it by a cell, so the
 * pattern does not lock to the top-left corner — which it visibly does when a
 * subject sits square with a grid that starts at the origin.
 */
export function packField(mask: Mask, settings: Settings, time: number): Field {
  /**
   * **The coarsest square is a share of the frame, not a number of screen
   * pixels.**
   *
   * In screen pixels the piece was a different picture in every window: the
   * subject scales with the frame and the squares did not, so a letter that was
   * fifty psyxels across on a wide monitor was twenty in a small window and came
   * apart — its match against the subject fell from 0.94 to 0.82 between 1920
   * and 1024. What the artwork is made *of* is the artistic quantity here; how
   * many screen pixels that happens to be is not.
   */
  const coarse = Math.max(MIN_PX * 2, settings.coarse * Math.min(mask.width, mask.height))
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

  let leaves: Psyx[] = []
  let divided: Psyx[] = []
  let depths: number[] = []
  let stale = true
  let changes = 0
  let flicks = 0
  let departed: Ghost[] = []

  function collect(node: Node, into: Psyx[], counts: number[], above: Psyx[]): void {
    if (node.split && node.kids) {
      above.push(node)
      for (const kid of node.kids) collect(kid, into, counts, above)
      return
    }
    into.push(node)
    counts[node.depth] = (counts[node.depth] ?? 0) + 1
  }

  function refresh(): void {
    if (!stale) return
    leaves = []
    depths = []
    divided = []
    for (const root of roots) collect(root, leaves, depths, divided)
    stale = false
  }

  /** One square's turn: reconsider its size, or, being a leaf, its frame. */
  function visit(node: Node, time: number, settings: Settings): void {
    if (time - node.changed >= changeGap(settings.churn, node.changeRoll, node.depth)) {
      node.changed = time
      node.changeRoll = node.rng()
      const wanted = decideSplit(node, settings)
      node.patience = wanted ? 0 : node.patience + 1
      if (wanted !== node.split) {
        // `context` still carries the settings the field was packed with, which
        // is correct: anything in `needsPacking` rebuilds the whole field, so the
        // two can only differ in ways that do not reach geometry.
        context.time = time
        // What is there now goes on fading while its replacement arrives.
        mourn(node, time, departed)
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
    // A shrinking vocabulary can leave a psyx showing a frame that no longer
    // exists, so that is a change due now rather than at the next tick.
    const due = node.glyph >= vocabulary || time - node.flicked >= flickGap(settings.flicker, node.flickRoll, node.rate)
    if (!due) return
    node.from = node.glyph
    node.glyph = nextGlyph(node.glyph, vocabulary, node.rng())
    // **Colour is redrawn with the frame, not on a clock of its own.** A psyx
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
    psyxels() {
      refresh()
      return leaves
    },

    branches() {
      refresh()
      return divided
    },

    update(time, settings) {
      for (const root of roots) visit(root, time, settings)
      // Kept in one pass rather than spliced: a ghost list is tens of entries.
      // The bound follows `ease`, or a stretched departure is forgotten halfway
      // through and a psyx vanishes mid-fade.
      const mourning = MOURNING * Math.max(1, settings.ease)
      if (departed.length > 0) departed = departed.filter((ghost) => time - ghost.died < mourning)
    },

    ghosts: () => departed,

    changes: () => changes,

    flicks: () => flicks,

    byDepth() {
      refresh()
      return Array.from({ length: Math.max(depths.length, 1) }, (_, depth) => depths[depth] ?? 0)
    },
  }
}
