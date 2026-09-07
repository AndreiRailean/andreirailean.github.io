/**
 * The frame, in metres.
 *
 * ## The fire is below the frame, and that is the whole framing decision
 *
 * We are looking at a fire from the side and cannot see it. So the world's
 * origin is the **bed** — the top of the coals, at `y = 0`, on the vertical axis
 * of the fire at `x = 0` — and the bottom edge of the picture sits `hearth`
 * metres *above* it. Every ember is therefore born off screen and arrives
 * already moving, which is what makes the bottom of the frame read as somewhere
 * embers come *from* rather than as a line they are drawn on.
 *
 * At `hearth = 0` the bed is exactly at the bottom edge and you watch them
 * appear. That is a legitimate scene and it is not the default, because a
 * particle appearing at rest at the lower edge of a frame reads as a particle
 * system.
 *
 * ## Span is metres across the shorter side
 *
 * Matching every piece before it: a portrait phone gets the framing a monitor
 * gets vertically, and a wide window sees more air to the sides rather than a
 * squashed version of the same column. **A frame is not a viewport** — see
 * `../docs/adr/20260906-a-frame-is-not-a-viewport.md`. Nothing here is tuned for
 * a window size; every length in the piece is in metres and the view converts.
 */

export type View = {
  /** CSS pixels. */
  width: number
  height: number
  /** Screen pixels per metre. */
  pxPerMetre: number
  /** Half the visible width in metres, measured from the fire's axis. */
  halfWidth: number
  /** World y at the bottom edge of the frame. The bed is at 0, so this is `hearth`. */
  floorY: number
  /** World y at the top edge. */
  ceilingY: number
  /**
   * How far above the top edge an ember is still simulated, in metres.
   *
   * Generous, and it has to be: an ember thrown above the frame very often comes
   * back down, so a tight ceiling turns a high arc into something that vanishes
   * and then reappears out of nowhere.
   */
  margin: number
  /**
   * And how far past the left and right edges, which is a different number.
   *
   * **Much smaller, because sideways is not symmetric with upward.** An ember
   * that has left through the side is essentially never coming back — the plume
   * is behind it and the wind that carried it out is still blowing — so all this
   * has to cover is the width of its own halo, plus enough that a gust reversing
   * within a fraction of a second does not strand one just off screen.
   *
   * It was the same number as `margin` and that was a real cost paid twice
   * over: at a frame of four and a half metres it simulated embers up to 1.8 m
   * outside the picture, and it made "left through the side" — one of the four
   * things this piece is meant to show — almost unreachable, because an ember
   * burns out in the four seconds it would take to cross that much dead air.
   */
  flank: number
}

export function makeView(span: number, hearth: number, width: number, height: number): View {
  const shortSide = Math.max(1, Math.min(width, height))
  const pxPerMetre = shortSide / Math.max(0.05, span)
  const halfWidth = width / 2 / pxPerMetre
  const frameHeight = height / pxPerMetre

  return {
    width,
    height,
    pxPerMetre,
    halfWidth,
    floorY: hearth,
    ceilingY: hearth + frameHeight,
    margin: Math.max(0.25, frameHeight * 0.4),
    flank: Math.max(0.12, frameHeight * 0.08),
  }
}

/** World metres to CSS pixels. Screen y is flipped, and the floor is the bottom edge. */
export const screenX = (view: View, x: number): number => view.width / 2 + x * view.pxPerMetre
export const screenY = (view: View, y: number): number => view.height - (y - view.floorY) * view.pxPerMetre

/** Whether a point is far enough outside the frame to stop simulating. */
export function beyond(view: View, x: number, y: number): boolean {
  return (
    Math.abs(x) > view.halfWidth + view.flank ||
    y > view.ceilingY + view.margin ||
    // Below the bed rather than below the frame: an ember falling back into the
    // fire has to fall all the way in, through the strip of picture under which
    // the coals are hidden.
    y < -0.35
  )
}
