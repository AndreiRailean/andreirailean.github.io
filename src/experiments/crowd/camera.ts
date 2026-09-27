/**
 * The eye: where it is, which way it is pointing, and what that does to a head.
 *
 * ## It is a pinhole at a person's height, not a camera on a tripod
 *
 * Everything else in this section looks *at* a scene. This one looks *from*
 * inside it, which changes what the projection has to be honest about. A plan
 * view can get away with a scale factor; here the same head has to land in a
 * different place when the observer's head rises four centimetres on the next
 * step, and it has to, because that motion is most of what says a person is
 * carrying the camera.
 *
 * ## Focal length comes off the shorter side, matching the section
 *
 * `span` in the other pieces is metres across the **shorter** side of the
 * window, so a portrait phone and a wide monitor frame the same amount of world
 * and a wide window sees further to the sides rather than a squashed copy. The
 * same convention here means `fov` is the field of view across the shorter side,
 * whichever that is. A wide monitor therefore sees more crowd to left and right,
 * which is what standing in a crowd is actually like.
 *
 * ## Distance fades, and it fades exponentially because that is what light does
 *
 * Light from a head is scattered out of the line of sight at a rate proportional
 * to how much is left, so what survives over distance `d` is `exp(-d/fade)`.
 * Against a black ground there is nothing scattered *in*, so the whole of
 * atmospheric perspective here is that one multiplication — no second term, no
 * tuning. `fade` is the distance at which a head is down to a bit over a third,
 * and the crowd is culled where the exponential has put it under half a percent
 * rather than at a distance anybody chose.
 */

export type Camera = {
  /** Where the eye is, in world metres. */
  x: number
  y: number
  /** Height of the eye above the ground, in metres. Bobs with the stride. */
  z: number
  /** Which way the eye is pointing, in radians. 0 is +x. */
  yaw: number
  /**
   * How far above level the eye is pointing, in radians. Negative is downward.
   *
   * **A walking person does not look at the horizon.** The resting line of sight
   * is several degrees below level — you look at the ground you are about to
   * walk on and at the faces of people close enough to matter, and both are
   * below eye height. A level camera is a survey instrument.
   *
   * It is also what decides the composition, and there is no way to have one
   * without the other: with heads and nothing else in the world, every head is
   * within a metre of eye height and the picture is a band. Where that band sits
   * in the frame is this number and nothing else.
   */
  pitch: number
  /** Screen pixels per radian at the centre of the frame. */
  focal: number
  /** CSS pixels. */
  width: number
  height: number
  /** Distance at which a head is faded to 1/e, in metres. */
  fade: number
}

/** Nothing closer than this is drawn. Inside it a head fills the frame and the projection is meaningless. */
export const NEAR = 0.32

/**
 * Where the fog has taken a head below anything a screen can show.
 *
 * Half a percent of full brightness, which on an 8-bit white is a value of 1.
 * Derived rather than declared: the world's radius is whatever this comes out
 * as, so turning `fade` up genuinely brings more crowd into being instead of
 * revealing a wall of nothing at a fixed distance.
 */
export const CULL_ALPHA = 0.005
export const horizonFor = (fade: number): number => fade * Math.log(1 / CULL_ALPHA)

export function makeCamera(
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  fovDegrees: number,
  fade: number,
  width: number,
  height: number,
): Camera {
  const shortSide = Math.max(1, Math.min(width, height))
  const fov = (Math.max(20, Math.min(140, fovDegrees)) * Math.PI) / 180
  return { x, y, z, yaw, pitch, focal: shortSide / 2 / Math.tan(fov / 2), width, height, fade }
}

/** Where a world point lands, in the eye's own frame: how far ahead, how far right, how far up. */
export type Sighting = {
  /** Metres along the line of sight. Negative is behind the eye. */
  depth: number
  /** CSS pixels from the centre of the frame. */
  sx: number
  sy: number
  /** Pixels per metre at that depth, which is what a radius is scaled by. */
  scale: number
  /** What survives the air between here and there, in [0, 1]. */
  alpha: number
}

/**
 * Project a world point.
 *
 * Returns `null` for anything at or behind the near plane rather than a
 * plausible-looking number — a point behind the eye has a negative depth and
 * divides to a *mirrored* position in front of it, which draws the crowd behind
 * you across the frame ahead of you and looks, from a still, like a perfectly
 * ordinary crowd.
 */
export function project(camera: Camera, x: number, y: number, z: number): Sighting | null {
  const dx = x - camera.x
  const dy = y - camera.y
  const cos = Math.cos(camera.yaw)
  const sin = Math.sin(camera.yaw)

  const along = dx * cos + dy * sin
  // Right-hand side of the frame. Screen x grows rightward, so this is the
  // world's left-handed cross product with the view direction.
  const right = dx * sin - dy * cos
  const rise = z - camera.z

  // The pitch is a rotation of the whole camera frame about the right axis, so
  // it moves what counts as *depth* as well as what counts as up. Treating it as
  // a screen offset instead — the tempting shortcut — is right at the centre of
  // the frame and wrong everywhere else, and looks like a lens fault rather than
  // like a mistake about geometry.
  const cp = Math.cos(camera.pitch)
  const sp = Math.sin(camera.pitch)
  const depth = along * cp + rise * sp
  if (depth <= NEAR) return null
  const up = rise * cp - along * sp

  const scale = camera.focal / depth
  return {
    depth,
    sx: camera.width / 2 + right * scale,
    sy: camera.height / 2 - up * scale,
    scale,
    // **Measured along the line of sight, not along the ground**, which for a
    // head a metre off the eye line at two metres is a 12% difference and for
    // everything further away is nothing at all.
    alpha: Math.exp(-depth / Math.max(0.5, camera.fade)),
  }
}

/**
 * Half the horizontal field of view, in radians, for the frame as it actually is.
 *
 * Wider than `fov` on a landscape window, because `fov` is measured across the
 * shorter side. The spawner uses this to know which part of the world is worth
 * populating densely, so it has to be the real number rather than the setting.
 */
export const halfFovH = (camera: Camera): number => Math.atan(camera.width / 2 / camera.focal)

/**
 * A sphere as the eye sees it: its silhouette on the glass, and what a line of
 * sight needs to know about it.
 *
 * **The silhouette is the tangent circle, projected — not a disc of radius
 * `focal · r / depth`.** That shortcut is what a head uses and is fine for a
 * head, which is 10 cm across. A boulder five metres across at six metres is
 * off by a third of its size, and wrong in the direction that matters: a head
 * hidden by the exact test would vanish in the gap between the drawn disc and
 * the true edge, in plain view. So the ring where the sight lines graze the
 * sphere is built in 3D, clipped to the near plane — which is what keeps a
 * boulder right beside me, centre behind the eye, a correct wall at the side of
 * the frame rather than a mirrored blob — and projected point by point.
 */
export type SphereSight = {
  /** Unit vector from the eye to the centre, in the eye's frame (right, up, ahead). */
  wx: number
  wy: number
  wz: number
  /** Distance from the eye to the centre. */
  distance: number
  /** Sine and cosine of the sphere's angular radius. */
  sin: number
  cos: number
  /** Screen outline, as x, y pairs, closed. Empty when nothing of it is in front of the eye. */
  outline: number[]
}

/** Most points round a silhouette. At 500 px across, 64 leaves a facet under a pixel deep. */
const OUTLINE_POINTS = 64

/** Fewest: a distant boulder a few pixels across is a circle at eight. */
const OUTLINE_FEWEST = 8

/** A world point in the eye's own frame. Written into `out`: right, up, ahead. */
export function toEye(camera: Camera, x: number, y: number, z: number, out: number[]): number[] {
  const dx = x - camera.x
  const dy = y - camera.y
  const cos = Math.cos(camera.yaw)
  const sin = Math.sin(camera.yaw)
  const along = dx * cos + dy * sin
  const right = dx * sin - dy * cos
  const rise = z - camera.z
  const cp = Math.cos(camera.pitch)
  const sp = Math.sin(camera.pitch)
  out[0] = right
  out[1] = rise * cp - along * sp
  out[2] = along * cp + rise * sp
  return out
}

const eyeScratch: number[] = [0, 0, 0]

/**
 * Where a sphere is and what outline it throws, written into `out`. Returns
 * false when it cannot hide anything: the eye inside it, or all of it behind.
 */
export function sightSphere(camera: Camera, x: number, y: number, z: number, r: number, out: SphereSight): boolean {
  const [cx, cy, cz] = toEye(camera, x, y, z, eyeScratch) as [number, number, number]
  const distance = Math.sqrt(cx * cx + cy * cy + cz * cz)
  // Inside it, or near enough that every direction is it. The walls keep
  // everybody out; this is the guard for the instant they have not yet.
  if (distance <= r * 1.001) return false
  const wx = cx / distance
  const wy = cy / distance
  const wz = cz / distance
  const sin = r / distance
  const cos = Math.sqrt(1 - sin * sin)
  // The whole cone of it behind the eye.
  if (wz < -sin) return false

  out.wx = wx
  out.wy = wy
  out.wz = wz
  out.distance = distance
  out.sin = sin
  out.cos = cos
  const outline = out.outline
  outline.length = 0

  // The ring the sight lines graze: centred on the axis at `d cos²α` from the
  // eye, of radius `r cos α`.
  const along = distance * cos * cos
  const ringR = r * cos
  const ox = wx * along
  const oy = wy * along
  const oz = wz * along
  // Two axes across the axis. `up × w`, unless the sphere is straight above or below.
  let ax = wz
  let ay = 0
  let az = -wx
  let an = Math.sqrt(ax * ax + az * az)
  if (an < 1e-6) {
    ax = 1
    ay = 0
    az = 0
    an = 1
  }
  ax /= an
  ay /= an
  az /= an
  const bx = wy * az - wz * ay
  const by = wz * ax - wx * az
  const bz = wx * ay - wy * ax

  const half = camera.width / 2
  const middle = camera.height / 2
  const f = camera.focal
  // As many points as the outline is big: a grid of boulders is hundreds of
  // them in view, most a few pixels across.
  const across = (f * ringR) / Math.max(NEAR, along)
  const points = Math.max(OUTLINE_FEWEST, Math.min(OUTLINE_POINTS, Math.ceil(Math.sqrt(across) * 4)))
  // Sutherland–Hodgman against the one plane `ahead = NEAR`.
  let prevX = 0
  let prevY = 0
  let prevZ = 0
  let prevIn = false
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let k = 0; k <= points; k++) {
    const t = (k / points) * Math.PI * 2
    const c = Math.cos(t) * ringR
    const s = Math.sin(t) * ringR
    const px = ox + ax * c + bx * s
    const py = oy + ay * c + by * s
    const pz = oz + az * c + bz * s
    const isIn = pz >= NEAR
    if (k > 0 && isIn !== prevIn) {
      const u = (NEAR - prevZ) / (pz - prevZ)
      const qx = prevX + (px - prevX) * u
      const qy = prevY + (py - prevY) * u
      outline.push(half + (qx * f) / NEAR, middle - (qy * f) / NEAR)
    }
    if (isIn && k > 0) outline.push(half + (px * f) / pz, middle - (py * f) / pz)
    prevX = px
    prevY = py
    prevZ = pz
    prevIn = isIn
  }
  for (let p = 0; p < outline.length; p += 2) {
    const ox2 = outline[p]!
    const oy2 = outline[p + 1]!
    if (ox2 < minX) minX = ox2
    if (ox2 > maxX) maxX = ox2
    if (oy2 < minY) minY = oy2
    if (oy2 > maxY) maxY = oy2
  }
  // Off the frame altogether: nothing on screen is behind it.
  if (maxX < 0 || minX > camera.width || maxY < 0 || minY > camera.height) return false
  return true
}
