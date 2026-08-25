/**
 * The canopy's own motion.
 *
 * The object overhead is not rigid in reality, but it is *coherent*: a tree in
 * wind moves a great deal while every branch keeps its relationship to every
 * other. That distinction turns out to matter more than the amount of movement.
 * `tremble` in `wind.ts` shakes each anchor independently, and however gently it
 * is tuned it reads as the observer being jostled rather than the scene moving —
 * lights bolted to a lorry on a bad road, with nothing stable to hold on to.
 *
 * So this moves the whole canopy as one body: it leans about the trunk, twists
 * a little, and rises and falls, all driven by the wind and all returning to
 * exactly where they started when the air goes still. Two of the three are rigid
 * rotations, so anchors keep their distances from one another *exactly*, which
 * is the property the whole thing exists to preserve.
 */

/** Furthest the canopy leans from upright at `sway` 1, in radians. */
const LEAN_MAX = 0.1
/** Furthest it turns about the trunk at `sway` 1, in radians. */
const TWIST_MAX = 0.15
/** Furthest it rises or falls at `sway` 1, in world units. */
const BOB_MAX = 0.08

/**
 * Wind acceleration at which leaning is most of the way to its limit.
 *
 * Saturating rather than proportional: a gust peaks well above this, and without
 * a limit the canopy would be laid flat by weather the wires merely swing in.
 */
const WIND_REFERENCE = 6

/** Radians per second of the lean's natural swing — a slow, heavy period. */
const LEAN_RATE = 2.5
/**
 * Underdamped on purpose. A tree hit by a gust does not glide back to upright,
 * it overshoots and rocks a couple of times, and that recovery is most of what
 * makes the movement read as something heavy rather than something animated.
 */
const LEAN_DAMPING = 0.22

/** Below this the canopy is upright enough to stop drawing frames for. */
const REST = 1e-4

export type Sway = {
  /** Advance the canopy's response to the wind. Call once per frame. */
  update: (windX: number, windY: number, clock: number, dt: number, amount: number) => void
  /** Where the anchor resting at `(x, y, z)` has been carried to. */
  displace: (x: number, y: number, z: number, out: { x: number; y: number; z: number }) => void
  /** Whether the canopy has returned to its rest position and stopped. */
  atRest: () => boolean
}

export function createSway(): Sway {
  // The lean is a 2D angle vector rather than an angle and a direction, so the
  // wind changing direction turns the canopy through the middle instead of
  // spinning it the long way round.
  let leanX = 0
  let leanY = 0
  let velX = 0
  let velY = 0
  let twist = 0
  let bob = 0

  return {
    update(windX, windY, clock, dt, amount) {
      if (amount <= 0) {
        leanX = leanY = velX = velY = twist = bob = 0
        return
      }

      // Long frames must not make the spring explode.
      const step = Math.min(dt, 1 / 30)
      const speed = Math.hypot(windX, windY)
      const load = Math.tanh(speed / WIND_REFERENCE)
      const targetX = speed > 0 ? (windX / speed) * LEAN_MAX * amount * load : 0
      const targetY = speed > 0 ? (windY / speed) * LEAN_MAX * amount * load : 0

      const stiffness = LEAN_RATE * LEAN_RATE
      const drag = 2 * LEAN_DAMPING * LEAN_RATE
      velX += (stiffness * (targetX - leanX) - drag * velX) * step
      velY += (stiffness * (targetY - leanY) - drag * velY) * step
      leanX += velX * step
      leanY += velY * step

      // Turning and breathing follow the wind directly; only the lean is worth
      // the overshoot, and springing all three reads as wobble rather than mass.
      twist = TWIST_MAX * amount * load * Math.sin(0.31 * clock + 1.1)
      bob = BOB_MAX * amount * load * Math.sin(0.47 * clock)
    },

    displace(x, y, z, out) {
      const angle = Math.hypot(leanX, leanY)

      if (angle < 1e-9 && twist === 0 && bob === 0) {
        out.x = 0
        out.y = 0
        out.z = 0
        return
      }

      let px = x
      let py = y
      let pz = z

      if (angle >= 1e-9) {
        // Rotate about a horizontal axis through the trunk, which stands at the
        // origin. A rigid rotation, so every anchor keeps its exact distance
        // from every other — the property this module exists for.
        const axisX = -leanY / angle
        const axisY = leanX / angle
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const dot = axisX * px + axisY * py
        const crossX = axisY * pz
        const crossY = -axisX * pz
        const crossZ = axisX * py - axisY * px
        const rx = px * cos + crossX * sin + axisX * dot * (1 - cos)
        const ry = py * cos + crossY * sin + axisY * dot * (1 - cos)
        const rz = pz * cos + crossZ * sin
        px = rx
        py = ry
        pz = rz
      }

      if (twist !== 0) {
        const cos = Math.cos(twist)
        const sin = Math.sin(twist)
        const tx = px * cos - py * sin
        py = px * sin + py * cos
        px = tx
      }

      out.x = px - x
      out.y = py - y
      out.z = pz + bob - z
    },

    atRest: () =>
      Math.hypot(leanX, leanY) < REST &&
      Math.hypot(velX, velY) < REST &&
      Math.abs(twist) < REST &&
      Math.abs(bob) < REST,
  }
}
