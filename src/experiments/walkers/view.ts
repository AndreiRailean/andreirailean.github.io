/**
 * The camera, and the light.
 *
 * ## The camera is a real pinhole, and that is the whole trick
 *
 * Looking straight down at a crowd, an orthographic projection puts every head
 * exactly over its own feet and makes an adult's head only 1.11 times a child's
 * — head breadth barely scales with stature (see `body.ts`), a fact that fights
 * the brief's "adults are bigger, children are smaller" harder than anyone
 * expects.
 *
 * A pinhole at a stated height helps honestly. A head at height z sits closer to
 * the lens than the ground does, so it is magnified by `camera / (camera − z)`
 * and displaced radially outward from the centre of the frame by the same
 * factor. At 24 m over a 1.75 m adult that is 1.073, and over a 1.10 m child it
 * is 1.044 — so the adult comes out 1.14 times the child rather than 1.11, and
 * at 12 m it is 1.18. The difference *grows as the camera comes down*, which is
 * what makes camera height a real control, and the outward lean of the heads
 * near the frame edge is the same phenomenon rather than a separate effect
 * anyone had to write.
 *
 * It is still not a large difference, and that is worth knowing rather than
 * fighting: **very little of a person's size survives the trip up here.** A
 * seventh between an adult and a small child, once the perspective has had its
 * say. Whoever next wants children to read as smaller should reach for how they
 * move — a child's cadence comes out higher because their legs are shorter, and
 * that is visible at sizes where a diameter is not.
 *
 * The lean of the heads outward near the frame edge is the same geometry, and
 * so is the jump: a child leaving the ground is magnified. That magnification is
 * now the only cue for height there is. It used to be the smaller half of a
 * pair — a shadow sliding out from under its owner was the other, and the more
 * legible — and the light that cast it has been removed along with the sun,
 * because a piece of dots and the paths they wear has no use for a body lying
 * on the grass beside every one of them. See `AGENTS.md`.
 */

export type View = {
  /** CSS pixels. */
  width: number
  height: number
  /** Screen pixels per metre of ground. */
  pxPerMetre: number
  /** Camera height in metres. */
  camera: number
  /** Half the visible ground, in metres, from the centre of the frame. */
  halfWidth: number
  halfHeight: number
  /** Ground actually in frame, in square metres. What density is quoted against. */
  area: number
  /**
   * How far past the frame the world extends, in metres.
   *
   * People arrive from off screen and leave the same way, and both have to
   * happen where they cannot be seen to pop. It is also what the population
   * controller counts its pipeline over, so it is a real number rather than
   * slack: how long somebody spends walking in is set here.
   */
  margin: number
}

/**
 * `span` is metres across the **shorter** side of the window.
 *
 * Matching the two pieces before it: a portrait phone gets the framing a monitor
 * gets vertically, and a wide window sees more park to the sides rather than a
 * squashed version of the same view.
 */
export function makeView(span: number, camera: number, width: number, height: number, margin = 4): View {
  const shortSide = Math.max(1, Math.min(width, height))
  const pxPerMetre = shortSide / span
  const halfWidth = width / 2 / pxPerMetre
  const halfHeight = height / 2 / pxPerMetre

  return {
    width,
    height,
    pxPerMetre,
    camera: Math.max(camera, 3),
    halfWidth,
    halfHeight,
    area: 4 * halfWidth * halfHeight,
    margin,
  }
}

/**
 * How much larger something at height `z` is than the same thing on the ground.
 *
 * Also how far outward it is displaced: for a pinhole looking straight down,
 * magnification and radial displacement are the same number, which is why there
 * is only one function here.
 */
export const lift = (view: View, z: number): number => view.camera / Math.max(1, view.camera - z)

/** World metres to CSS pixels, on the ground plane. Screen y is flipped here. */
export const screenX = (view: View, x: number): number => view.width / 2 + x * view.pxPerMetre
export const screenY = (view: View, y: number): number => view.height / 2 - y * view.pxPerMetre

/** CSS pixels back to world metres, for anything that wants to place by frame. */
export const worldX = (view: View, sx: number): number => (sx - view.width / 2) / view.pxPerMetre
export const worldY = (view: View, sy: number): number => (view.height / 2 - sy) / view.pxPerMetre
