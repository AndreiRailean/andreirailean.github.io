/**
 * A pinhole camera at the world origin, looking up.
 *
 * World +Z is up, so an anchor sits at a large Z and its beads descend toward
 * the viewer as Z shrinks. Under projection a descending bead grows *and* slides
 * outward from the vanishing point, because both come from the same division by
 * depth. That single fact is the piece: it is what makes the arrangement read as
 * depth rather than as things being scaled.
 *
 * The corollary is that a wire hanging dead overhead collapses to a point. The
 * scatter of the anchors is therefore load-bearing, not decoration.
 */

export type Camera = {
  /** Focal length in css px. */
  focal: number
  /** Tilt off vertical, in radians. 0 looks straight up. */
  pitch: number
  centerX: number
  centerY: number
}

export type Projected = {
  x: number
  y: number
  /** Distance along the view axis, in world units. Always positive. */
  depth: number
  /** Multiply a world length by this for its size on screen, in css px. */
  scale: number
}

/**
 * Nothing may project from closer than this, in world units.
 *
 * Not a taste decision: projected size goes as 1/depth, so a bead drifting
 * toward zero depth grows without bound and swallows the screen. Beads inside
 * the clip are dropped, and `nearFade` softens the edge so one does not pop.
 */
export const NEAR_CLIP = 0.12

/** Beads fade out over this distance above the near clip, rather than popping. */
const NEAR_FADE = 0.5

/**
 * The field of view applies to the shorter side of the viewport, so the framing
 * a phone gets in portrait is the framing a monitor gets vertically, and a wide
 * window sees more to the sides rather than a squashed version of the same view.
 */
export function makeCamera(fovDegrees: number, pitchDegrees: number, width: number, height: number): Camera {
  const fov = (fovDegrees * Math.PI) / 180
  return {
    focal: (0.5 * Math.min(width, height)) / Math.tan(fov / 2),
    pitch: (pitchDegrees * Math.PI) / 180,
    centerX: width / 2,
    centerY: height / 2,
  }
}

/**
 * Projects a world point, or returns null if it is behind the near clip.
 *
 * Screen y is flipped, so world +Y is up on screen.
 */
export function project(camera: Camera, x: number, y: number, z: number): Projected | null {
  const cos = Math.cos(camera.pitch)
  const sin = Math.sin(camera.pitch)

  // Camera basis: forward (0, sin, cos), right (1, 0, 0), up (0, cos, -sin).
  const viewY = y * cos - z * sin
  const depth = y * sin + z * cos

  if (depth <= NEAR_CLIP) return null

  const scale = camera.focal / depth
  return {
    x: camera.centerX + x * scale,
    y: camera.centerY - viewY * scale,
    depth,
    scale,
  }
}

/** 0 at the near clip, 1 once comfortably past it. */
export function nearFade(depth: number): number {
  return Math.min(1, Math.max(0, (depth - NEAR_CLIP) / NEAR_FADE))
}
