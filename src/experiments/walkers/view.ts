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
 * fighting: **the size of a person is carried by their shadow, not their head.**
 * Shadow length and width both go straight with stature, so a 1.75 m adult's
 * shadow is 1.6 times a 1.1 m child's in both directions where their heads
 * differ by a seventh. Whoever next wants children to read as smaller should
 * reach for the light before reaching for the head.
 *
 * It also gives the jump and the fall somewhere to go: a child leaving the
 * ground gets larger, and the shadow underneath them slides away, which is two
 * independent cues from one line of geometry.
 *
 * ## The light
 *
 * A walker is a **circle**, and its shadow is the shadow of a circle: a soft
 * ellipse, stretched along the light and thrown further the lower the sun is.
 *
 * It was the shadow of a whole *person* — three tapered strokes, head and torso
 * and legs — on the reasoning that a bright day from above really does look like
 * a scattering of heads each with a body lying next to it on the grass. That is
 * true and it was the wrong thing to build. The brief here is dots with human
 * motion, not people: the realism belongs in how they move, and drawing the body
 * we had agreed was invisible put it back in the picture through the floor. See
 * `AGENTS.md`.
 *
 * What the light is still for, and why it survived the deletion: a shadow that
 * separates from its dot is the only cue for **height**. A child leaving the
 * ground is magnified and their shadow slides out from under them, and neither
 * of those needs a figure to read.
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
   * happen where they cannot be seen to pop. It also has to be wider than the
   * longest shadow, or a person still outside the frame would throw one into it
   * with nobody attached.
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

/** Whether a ground position is inside the frame, with a margin in metres. */
export const inFrame = (view: View, x: number, y: number, pad = 0): boolean =>
  Math.abs(x) <= view.halfWidth + pad && Math.abs(y) <= view.halfHeight + pad

export type Sun = {
  /** Unit vector in world coordinates pointing *toward* the sun, ground plane. */
  x: number
  y: number
  /** Metres of shadow per metre of height. `1/tan(elevation)`. */
  reach: number
  /** How diffuse the light is. A low sun is a softer, longer, weaker shadow. */
  softness: number
  /**
   * How far a shadow is stretched along the light.
   *
   * The shadow of a sphere on the ground is an ellipse with its short axis the
   * sphere's radius and its long axis `r / sin(elevation)`. Overhead it is a
   * disc; near the horizon it is a streak.
   */
  stretch: number
}

/**
 * Where the light is coming from.
 *
 * Azimuth is clockwise from the top of the frame, which is how a person reads a
 * picture rather than how a compass works — the sun at 180° is at the bottom of
 * the screen and the shadows point up.
 *
 * The reach is clamped well below what `1/tan` gives near the horizon: at 5° a
 * shadow is eleven times a person's height and the frame becomes a picture of
 * shadows with some heads in it. 15° is the bottom of the slider and gives 3.7,
 * which is already long.
 */
export function makeSun(azimuthDegrees: number, elevationDegrees: number): Sun {
  const azimuth = (azimuthDegrees * Math.PI) / 180
  const elevation = Math.max(0.12, (elevationDegrees * Math.PI) / 180)

  return {
    x: Math.sin(azimuth),
    y: Math.cos(azimuth),
    reach: Math.min(4, 1 / Math.tan(elevation)),
    stretch: Math.min(4, 1 / Math.sin(elevation)),
    // The sun is the same size in the sky whatever its elevation, but its light
    // travels through more atmosphere low down, so the shadow edge is softer and
    // the shadow itself weaker. One number for both.
    softness: 0.35 + 0.65 * (1 - Math.sin(elevation)),
  }
}

/** Where the shadow of a point at height `z` above (x, y) lands, in world metres. */
export function shadowOf(sun: Sun, x: number, y: number, z: number): { x: number; y: number } {
  return { x: x - sun.x * sun.reach * z, y: y - sun.y * sun.reach * z }
}
