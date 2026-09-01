/**
 * Reading a swipe.
 *
 * The arithmetic of the interactive view, kept apart from the DOM that listens
 * for it so the thresholds are checkable by the unit runner in milliseconds. The
 * section's rule applies here as much as to a piece: what goes wrong in a
 * gesture is a number, and a number is invisible in a screenshot.
 *
 * Two axes, one at a time. Horizontal moves through a piece's presets and
 * vertical moves through the wall, and a diagonal must resolve to one of them
 * rather than doing a little of both — a swipe that changed the scene *and* left
 * the piece would be unrecoverable, since neither half is undoable.
 */

/** How far a finger travels before the axis is decided, in px. */
export const AXIS_LOCK = 12

/** Travel that commits a slow, deliberate drag, in px. */
export const COMMIT_TRAVEL = 56

/** Speed that commits a short flick, in px/ms. */
export const COMMIT_SPEED = 0.4

export type Axis = "x" | "y"

/**
 * Which axis a movement belongs to, or `null` while it is still too small to
 * say.
 *
 * Locked once and for the rest of the gesture by the caller: re-deciding
 * mid-drag is how a curved swipe ends up firing both axes.
 */
export function axisOf(dx: number, dy: number): Axis | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return null
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y"
}

/**
 * Whether a released gesture should take effect.
 *
 * Either far enough or fast enough — a flick that covers twenty pixels in forty
 * milliseconds is unmistakably a swipe, and requiring the full travel from it
 * makes the view feel stuck. The speed path still needs the axis lock's worth of
 * travel behind it, or a fast tap-and-twitch registers as a swipe.
 */
export function commits(travel: number, elapsed: number): boolean {
  const distance = Math.abs(travel)
  if (distance >= COMMIT_TRAVEL) return true
  if (distance < AXIS_LOCK) return false
  return distance / Math.max(elapsed, 1) >= COMMIT_SPEED
}
