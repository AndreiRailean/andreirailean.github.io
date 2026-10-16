import type { Rng } from "@/experiments/random"
import type { Settings } from "@/experiments/psyxels/settings"

/**
 * One square's change of mind, and nothing else.
 *
 * **The squares over any one point of the picture are a stack**, coarsest on
 * top: the root, the quarter of it the point falls in, the quarter of that, and
 * so on down to the finest level. The psyx drawn there is the shallowest square
 * in the stack that is whole, and it lasts until the first square at or above it
 * changes its mind. Every claim about how long a psyx lives is therefore a claim
 * about this file — when each level of the stack asks, and what it answers —
 * and none of it needs a picture, a mask or a field to be true.
 *
 * `field.ts` owns the tree: which squares exist, what they show, and what
 * happens to the grain under a square that merges. It asks this file when a
 * square is due and what it wants, and does what it is told.
 */

/** No psyx narrower than this many screen pixels. Below it a mark is a smudge and the count explodes. */
export const MIN_PX = 3

/** Most halvings between the biggest psyx and the smallest. */
export const MAX_LEVELS = 5

/** How many times the biggest size halves to reach the smallest, whole and in range. */
export function levelsBetween(finest: number, coarse: number): number {
  const halvings = Math.round(Math.log2(coarse / finest))
  return Number.isFinite(halvings) ? Math.max(0, Math.min(MAX_LEVELS, halvings)) : 0
}

/** How many times a square may be quartered in this scene — what the packing reads. */
export const levelsOf = (settings: Pick<Settings, "finest" | "coarse">): number =>
  levelsBetween(settings.finest, settings.coarse)

/** What a square's decision reads: where it sits in the stack, and its own memory. */
export type Square = {
  depth: number
  /** In screen pixels. */
  size: number
  /** Unevenness under the square: 0 flat, 0.5 a hard edge through the middle. */
  dev: number
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
  /** Its own generator, for every decision it will ever take. */
  rng: Rng
}

/** The settings a decision reads. Nothing about the picture or the life. */
export type Temper = Pick<Settings, "churn" | "detail" | "fuzz" | "variety" | "finest" | "coarse">

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
export const DEPTH_PATIENCE = 2.2

/**
 * How many turns running a psyx may decide to stay whole before it must divide.
 *
 * Without it the odds are memoryless: a coarse psyx that keeps winning a fair
 * toss sits in one square for twenty seconds, which was reported as "a large
 * psyx staying on screen for a very long time" against a *mean* that looked
 * perfectly healthy. Three turns is reached by four scenes in a hundred, so the
 * distribution keeps its shape and loses its tail.
 */
export const PATIENCE_LIMIT = 3

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
export const DEPTH_SPREAD = DEPTH_PATIENCE / (DEPTH_PATIENCE - 1)

/**
 * The gap before a square next reconsiders its size, in seconds.
 *
 * Read from a stored draw rather than scheduled ahead, so that dragging the
 * churn control retimes every square that has not yet fired instead of only
 * those packed after the change.
 */
export const changeGap = (churn: number, roll: number, depth: number) =>
  churn <= 0 ? Infinity : ((60 / churn) * (0.4 + 1.5 * roll) * DEPTH_PATIENCE ** depth) / DEPTH_SPREAD

/**
 * The longest a square can stay whole once it is, in seconds.
 *
 * What the deadline buys, stated as a number: a square that keeps deciding to
 * stay whole is made to divide on the turn after `PATIENCE_LIMIT`, and no turn
 * is longer than the longest gap. So a coarse psyx is gone within this however
 * its draws fall — and sooner if a square above it changes its mind. Only a
 * square that is able to divide is bound by it; the finest level cannot, and is
 * ended by the stack above it instead.
 */
export const longestWhole = (churn: number, depth: number) => (PATIENCE_LIMIT + 1) * changeGap(churn, 1, depth)

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

/**
 * Whether a square should be four squares.
 *
 * The threshold runs from half — the standard deviation of a hard edge cutting a
 * square in two, so nothing splits — down to a hair above zero, where any
 * variation at all is enough. Variety is consulted second and only matters where
 * detail did not already decide, which is why turning detail up does not make
 * variety redundant: they act in different places.
 */
export function decideSplit(square: Square, settings: Temper): boolean {
  if (square.depth >= levelsOf(settings)) return false
  if (square.size / 2 < MIN_PX) return false
  const threshold = 0.5 * (1 - settings.detail) + 0.012

  if (square.dev > threshold) {
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
    if (square.rng() > settings.fuzz * 0.3) return true
  }

  // A deadline rather than a lean, so the *tail* is cut and the mean is left
  // alone: leaning the odds instead halved every coarse psyx's life, which is a
  // different change from the one that was asked for.
  if (square.patience >= PATIENCE_LIMIT && settings.variety > 0) return true
  return square.rng() < splitChance(settings.variety)
}

/**
 * A square's turn, if one is due by `time`.
 *
 * Returns whether it now wants to be four squares, or `null` when it was not
 * asked. Either answer may be the one it already had; whether anything changes
 * is the caller's comparison, because only the caller knows what the square is.
 */
export function reconsider(square: Square, time: number, settings: Temper): boolean | null {
  if (time - square.changed < changeGap(settings.churn, square.changeRoll, square.depth)) return null
  square.changed = time
  square.changeRoll = square.rng()
  const wanted = decideSplit(square, settings)
  square.patience = wanted ? 0 : square.patience + 1
  return wanted
}
