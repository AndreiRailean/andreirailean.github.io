/**
 * Looking straight down, and the wrapped patch of water underneath.
 *
 * No projection: every speck floats on the same plane at the same distance, so
 * there is nothing to divide by depth and the camera is a scale. What this file
 * is really about is the *patch* — the piece of sea the specks live on, and how
 * it stays seamless.
 *
 * ## The patch is a torus, and that is why nothing ever runs out
 *
 * A speck's home is a pair of numbers in [0, 1), wrapped. Carried off one edge
 * by the current it reappears at the other, and because the sea it is dropped
 * back into is statistically identical to the one it left, nothing about the
 * water gives it away. The two things that could give it away are handled here:
 *
 * - **The wrap happens off screen.** The patch is the frame plus a margin of the
 *   sea's own `reach` — the furthest any wave can displace a float — so a speck
 *   crosses the edge outside the picture and is already back in the field before
 *   it could be seen to jump.
 * - **The waves are not wrapped and do not need to be.** They are evaluated at
 *   the speck's position in metres, not tiled, so the field is continuous
 *   everywhere and there is no seam to align. Only the *specks* wrap.
 *
 * The alternative — an unbounded plane with specks culled and respawned at the
 * upstream edge — needs the count, the spawn edge and the density all kept
 * consistent as the current turns, and gets a visible advancing front whenever
 * it is wrong. A torus has none of those parts.
 *
 * ## Homes are fractions of the patch, not metres
 *
 * So `span` is a zoom rather than a rearrangement: change it and every speck
 * stays where it was on screen while the water under it grows or shrinks. The
 * cost is stated plainly in the `dots` hint — the count is how many are *in
 * frame*, not how many there are per square metre. The honest alternative empties
 * the frame at one end of the span slider and melts the machine at the other.
 */

import type { Sea } from "@/experiments/flotsam/waves"

/** Extra margin beyond the wave reach, in css px, so a wrap is never marginal. */
const PAD_PX = 8

export type View = {
  width: number
  height: number
  /** World scale. Multiply a length in css px by this for metres. */
  metresPerPx: number
  /** The patch, in metres. Wider than the frame by twice the margin. */
  patchWidth: number
  patchHeight: number
  /** How far the patch overhangs the frame, in css px. */
  marginPx: number
}

/**
 * `span` is metres across the **shorter** side of the window, matching Dangler's
 * field of view.
 *
 * So a phone in portrait gets the framing a monitor gets vertically, and a wide
 * window sees more sea to the sides rather than a squashed version of the same
 * view. It also means the poster and the browser suite, at different aspect
 * ratios, are looking at water of the same size.
 */
export function makeView(span: number, width: number, height: number, sea: Sea): View {
  const shortSide = Math.max(1, Math.min(width, height))
  const metresPerPx = span / shortSide
  const marginPx = sea.reach / metresPerPx + PAD_PX

  return {
    width,
    height,
    metresPerPx,
    patchWidth: (width + 2 * marginPx) * metresPerPx,
    patchHeight: (height + 2 * marginPx) * metresPerPx,
    marginPx,
  }
}

/** Patch fraction to world metres, x. The origin is the centre of the frame. */
export const worldX = (view: View, u: number): number => (u - 0.5) * view.patchWidth

/** Patch fraction to world metres, y — which runs *up*, as Dangler's does. */
export const worldY = (view: View, v: number): number => (v - 0.5) * view.patchHeight

/** World metres to css px. Screen y is flipped here and nowhere else. */
export const screenX = (view: View, x: number): number => view.width / 2 + x / view.metresPerPx
export const screenY = (view: View, y: number): number => view.height / 2 - y / view.metresPerPx

/** Wraps a patch fraction back into [0, 1). */
export const wrap = (value: number): number => value - Math.floor(value)
