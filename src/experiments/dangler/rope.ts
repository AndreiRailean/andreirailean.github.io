/**
 * The wires, as Verlet chains with bending resistance.
 *
 * A wire fixed at one end with a free end is **not** a catenary — a catenary
 * needs both ends fixed. What hangs here is an elastic rod, and its shape comes
 * from bending stiffness fighting gravity. A bend constraint reproduces that
 * directly; an analytic curve has to fake it.
 *
 * Every particle in the scene lives in one set of flat arrays with per-wire
 * index ranges, rather than in an array of per-wire objects. At three wires that
 * is a wash. At a hundred it is the difference between a number changing and a
 * rewrite, and the scene is expected to grow.
 *
 * ## What is live and what is not
 *
 * `length`, `stiffness` and `set` are read at solve time from three per-wire
 * scalars, so dragging them relaxes the existing chain into its new shape
 * instead of teleporting it. Only a change in particle *layout* — the segment
 * count — needs the arrays rebuilt. Growing the wire count appends, preserving
 * the wires already on screen along with whatever state they were in.
 */

export type WireSpec = {
  anchor: { x: number; y: number; z: number }
  /** Links per wire. Particle count is this plus one. */
  segments: number
  /** Hang length in world units. */
  length: number
  /** How hard the bend constraint is enforced. 0 is a limp chain. */
  stiffness: number
  /** Total turn baked into the wire, in radians — its memory of being coiled. */
  set: number
  /** Where around the wire's axis the coil starts. */
  coilAzimuth: number
  /** Turns the coil's azimuth makes over the wire's length. */
  coilTwist: number
}

/** Force per unit mass applied to a whole wire, in world units per second². */
export type Wind = (wireIndex: number) => { x: number; y: number; z: number }

export type Ropes = {
  readonly wireCount: number
  readonly particleCount: number
  /** First particle index of wire w; `offset[wireCount]` is the total. */
  readonly offset: Int32Array
  /**
   * Per-wire displacement of the anchor from where the canopy pins it, as
   * `[x, y, z]` triples. Written by the engine, read on the next step.
   *
   * Deliberately a *position* and not a force. A force integrates, so a wire
   * under one keeps accelerating and sweeps a long way out; moving the anchor
   * drags the wire by roughly the anchor's own travel and no further, because
   * the anchor still holds it. Measured on a 0.65m wire: 7mm of anchor step
   * settles at 26mm of tip travel, where a held 14 m/s² was still climbing
   * through 914mm. That bounded quality is the whole point of it.
   */
  readonly anchorOffsets: Float32Array
  readonly px: Float32Array
  readonly py: Float32Array
  readonly pz: Float32Array
  /** Applies live parameter changes without disturbing any position. */
  update: (specs: WireSpec[]) => void
  /** One fixed simulation step. */
  step: (wind: Wind | null) => void
  /**
   * Runs to rest with heavy damping, then zeroes every velocity.
   *
   * `only` restricts it to some wires. A rebuild that appends wires settles just
   * the new ones: settling everything would zero the velocity of the wires
   * already on screen, so adding one to a scene in a breeze would visibly calm
   * all the rest.
   */
  settle: (only?: readonly number[]) => void
  /** Largest violation of a link's rest length, in world units. */
  maxError: () => number
  /** Whether the scene is still visibly moving. */
  atRest: () => boolean
  /** Wires laid out fresh by this build, rather than carried from the last. */
  readonly freshWires: readonly number[]
}

/**
 * Fixed simulation step, decoupled from the frame rate.
 *
 * 480Hz is not caution, it is the cheapest place to buy accuracy. A positional
 * solver's effective stiffness is limited by how many passes it gets, so a
 * hanging chain reaches a *steady state* where gravity's injection each step
 * balances what the passes remove — more settling never improves it. Measured on
 * one wire at equal total work: 120Hz with 18 passes left links 0.92% stretched;
 * 240Hz with 9 left 0.45%; 480Hz with 5 left 0.20%. Shorter steps beat more
 * iterations roughly four to one.
 */
export const FIXED_DT = 1 / 480

const GRAVITY = 9.81

/**
 * Velocity retained per *second*, converted to a per-step factor below.
 *
 * Written per second so the step rate above can change without quietly
 * retuning how a swing decays — the two were coupled once and the breeze got
 * springier every time the solver was made more accurate.
 */
const DAMPING_PER_SECOND = 0.79
/** Heavier, for settling: convergence matters and the transient is never seen. */
const SETTLE_DAMPING_PER_SECOND = 1e-8

const DAMPING = Math.pow(DAMPING_PER_SECOND, FIXED_DT)
const SETTLE_DAMPING = Math.pow(SETTLE_DAMPING_PER_SECOND, FIXED_DT)

const SOLVER_ITERATIONS = 5
/**
 * Passes at the end that enforce the links alone.
 *
 * A single Gauss-Seidel sweep does not make a chain exact — correcting one link
 * disturbs the one before it — so a pass that ends in bending leaves the wire
 * measurably stretched. Letting the last one run links-only gives it somewhere
 * to converge to.
 */
const LINK_ONLY_PASSES = 1

/**
 * Hard stop on settling, in steps.
 *
 * Only a backstop: settling normally exits as soon as the scene falls still.
 * At 480Hz this is a little over eight seconds of simulated time, which no
 * reachable configuration needs.
 */
const SETTLE_STEP_CAP = 4000

/** Below this speed, in world units per second, nothing is worth redrawing for. */
const REST_SPEED = 0.0008

/** Rotates `v` about a unit `k` by `angle`, in place in `out`. */
function rotateAxis(
  kx: number,
  ky: number,
  kz: number,
  vx: number,
  vy: number,
  vz: number,
  cos: number,
  sin: number,
  out: Float64Array,
  at: number,
): void {
  const dot = (kx * vx + ky * vy + kz * vz) * (1 - cos)
  out[at] = vx * cos + (ky * vz - kz * vy) * sin + kx * dot
  out[at + 1] = vy * cos + (kz * vx - kx * vz) * sin + ky * dot
  out[at + 2] = vz * cos + (kx * vy - ky * vx) * sin + kz * dot
}

/**
 * Rotates `v` by the shortest rotation taking unit `a` onto unit `b`.
 *
 * This is what carries a wire's rest shape onto its current one. `k = a × b` is
 * left unnormalised on purpose: the identity below is exact for unit `a` and `b`
 * without it, and skipping the square root matters when this runs once per joint
 * per solver pass.
 */
function rotateArc(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  vx: number,
  vy: number,
  vz: number,
  out: Float64Array,
): void {
  const c = ax * bx + ay * by + az * bz

  // Already aligned, or opposed — where the rotation axis is undefined. Both are
  // rare enough between adjacent links that leaving `v` alone is the honest
  // answer; guessing an axis would add noise where the wire is already straight.
  if (c > 0.999999 || c < -0.999999) {
    out[0] = vx
    out[1] = vy
    out[2] = vz
    return
  }

  const kx = ay * bz - az * by
  const ky = az * bx - ax * bz
  const kz = ax * by - ay * bx
  const scale = (kx * vx + ky * vy + kz * vz) / (1 + c)

  out[0] = vx * c + (ky * vz - kz * vy) + kx * scale
  out[1] = vy * c + (kz * vx - kx * vz) + ky * scale
  out[2] = vz * c + (kx * vy - ky * vx) + kz * scale
}

export function createRopes(specs: WireSpec[], previous?: Ropes): Ropes {
  const wireCount = specs.length
  const offset = new Int32Array(wireCount + 1)
  for (let w = 0; w < wireCount; w++) offset[w + 1] = offset[w] + specs[w].segments + 1
  const particleCount = offset[wireCount]

  const px = new Float32Array(particleCount)
  const py = new Float32Array(particleCount)
  const pz = new Float32Array(particleCount)
  const ox = new Float32Array(particleCount)
  const oy = new Float32Array(particleCount)
  const oz = new Float32Array(particleCount)

  const anchorOffsets = new Float32Array(wireCount * 3)
  const anchorX = new Float32Array(wireCount)
  const anchorY = new Float32Array(wireCount)
  const anchorZ = new Float32Array(wireCount)
  const segLength = new Float32Array(wireCount)
  const hasBend = new Uint8Array(wireCount)

  // The rest shape, as the unit direction of the link leaving each particle.
  // Held separately from the positions so `set`, `twist` and `length` can change
  // the shape a wire is trying to hold without disturbing where it currently is.
  const rdx = new Float32Array(particleCount)
  const rdy = new Float32Array(particleCount)
  const rdz = new Float32Array(particleCount)
  const rotated = new Float64Array(3)
  const turned = new Float64Array(9)

  let error = 0
  let moving = true

  /**
   * Walks a wire's rest shape, writing the direction of each link.
   *
   * The shape is a slow helix: a constant turn per joint, whose direction
   * advances with `twist`. That is the wire's memory of having been coiled, and
   * it is what the bend constraint holds the wire to.
   */
  function restDirections(w: number): void {
    const spec = specs[w]
    const start = offset[w]
    const count = spec.segments + 1
    // Stiffness scales the curvature the wire is asked to hold, rather than how
    // hard it is asked to hold it. See the bend constraint in `solve`.
    const turn = (spec.set * spec.stiffness) / Math.max(1, spec.segments - 1)
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)

    // The wire starts pointing straight down, with a frame carried alongside it.
    //
    // The frame has to be *transported*, not recomputed from the direction each
    // joint. Deriving two perpendiculars from a direction means choosing a
    // reference axis, and any such choice flips somewhere on the sphere — so as
    // the wire curls past that point the coil's bending plane jumps, putting a
    // fold in the rest shape the solver then faithfully reproduces. It showed up
    // as wires crumpling only when finely segmented and strongly coiled, which
    // is exactly when a curl is most likely to cross the boundary.
    let dx = 0
    let dy = 0
    let dz = -1
    let e1x = 1
    let e1y = 0
    let e1z = 0
    let e2x = 0
    let e2y = -1
    let e2z = 0

    for (let j = 0; j < count - 1; j++) {
      rdx[start + j] = dx
      rdy[start + j] = dy
      rdz[start + j] = dz

      const azimuth = spec.coilAzimuth + 2 * Math.PI * spec.coilTwist * (j / Math.max(1, count - 2))
      const ca = Math.cos(azimuth)
      const sa = Math.sin(azimuth)
      const kx = e1x * ca + e2x * sa
      const ky = e1y * ca + e2y * sa
      const kz = e1z * ca + e2z * sa

      // Direction and frame all turn together, which is what keeps the frame
      // orthonormal and continuous down the whole wire.
      rotateAxis(kx, ky, kz, dx, dy, dz, cos, sin, turned, 0)
      rotateAxis(kx, ky, kz, e1x, e1y, e1z, cos, sin, turned, 3)
      rotateAxis(kx, ky, kz, e2x, e2y, e2z, cos, sin, turned, 6)

      const len = Math.hypot(turned[0], turned[1], turned[2]) || 1
      dx = turned[0] / len
      dy = turned[1] / len
      dz = turned[2] / len
      const l1 = Math.hypot(turned[3], turned[4], turned[5]) || 1
      e1x = turned[3] / l1
      e1y = turned[4] / l1
      e1z = turned[5] / l1
      const l2 = Math.hypot(turned[6], turned[7], turned[8]) || 1
      e2x = turned[6] / l2
      e2y = turned[7] / l2
      e2z = turned[8] / l2
    }
  }

  /** Places a wire's particles along its rest shape, hanging from the anchor. */
  function layOut(w: number): void {
    const spec = specs[w]
    const start = offset[w]
    const count = spec.segments + 1
    const seg = spec.length / spec.segments

    let x = spec.anchor.x
    let y = spec.anchor.y
    let z = spec.anchor.z
    px[start] = x
    py[start] = y
    pz[start] = z

    for (let j = 1; j < count; j++) {
      x += seg * rdx[start + j - 1]
      y += seg * rdy[start + j - 1]
      z += seg * rdz[start + j - 1]
      px[start + j] = x
      py[start + j] = y
      pz[start + j] = z
    }

    ox.set(px.subarray(start, start + count), start)
    oy.set(py.subarray(start, start + count), start)
    oz.set(pz.subarray(start, start + count), start)
  }

  function readSpecs(): void {
    for (let w = 0; w < wireCount; w++) {
      const spec = specs[w]
      anchorX[w] = spec.anchor.x
      anchorY[w] = spec.anchor.y
      anchorZ[w] = spec.anchor.z
      segLength[w] = spec.length / spec.segments
      hasBend[w] = spec.set * spec.stiffness > 0 ? 1 : 0
      restDirections(w)
    }
  }

  function integrate(damping: number, wind: Wind | null, only: readonly number[]): void {
    const dt2 = FIXED_DT * FIXED_DT
    let fastest = 0

    for (const w of only) {
      // Sampled once per wire, not once per particle. A breeze varies over
      // metres; the along-wire lag comes from the chain, not from the field.
      const gust = wind ? wind(w) : null
      const start = offset[w]
      const end = offset[w + 1]
      const span = end - start - 1

      // The anchor is pinned to the canopy: written, never integrated. Its
      // previous position is written too, so it carries no velocity of its own
      // — it teleports, and the wire below is dragged after it.
      const ax = anchorX[w] + anchorOffsets[w * 3]
      const ay = anchorY[w] + anchorOffsets[w * 3 + 1]
      const az = anchorZ[w] + anchorOffsets[w * 3 + 2]
      px[start] = ax
      py[start] = ay
      pz[start] = az
      ox[start] = ax
      oy[start] = ay
      oz[start] = az

      for (let i = start + 1; i < end; i++) {
        // Lower down is more exposed, and the top of a wire is shielded by
        // whatever it hangs from.
        const exposure = gust ? (i - start) / span : 0
        const ax = gust ? gust.x * exposure : 0
        const ay = gust ? gust.y * exposure : 0
        const az = (gust ? gust.z * exposure : 0) - GRAVITY

        const vx = (px[i] - ox[i]) * damping
        const vy = (py[i] - oy[i]) * damping
        const vz = (pz[i] - oz[i]) * damping

        ox[i] = px[i]
        oy[i] = py[i]
        oz[i] = pz[i]

        px[i] += vx + ax * dt2
        py[i] += vy + ay * dt2
        pz[i] += vz + az * dt2

        const speed = vx * vx + vy * vy + vz * vz
        if (speed > fastest) fastest = speed
      }
    }

    moving = Math.sqrt(fastest) / FIXED_DT > REST_SPEED
  }

  /**
   * One solve: bending first, then the links, alternating direction each pass.
   *
   * Both orderings matter and both were got wrong first.
   *
   * *Direction*: a hanging chain is badly conditioned for a one-way Gauss-Seidel
   * sweep. The anchor's constraint reaches the free end in a single pass, but the
   * tension from the weight below travels back up one link per iteration, which
   * left links 2% adrift — noise enough to drown the bend entirely.
   *
   * *Sequence*: with the bend applied last, every pass ends by disturbing the
   * links it just fixed, and the wire settles visibly stretched. Bending first
   * and letting the links have the final word costs nothing and converges some
   * hundredfold better.
   */
  function solve(only: readonly number[]): void {
    for (let pass = 0; pass < SOLVER_ITERATIONS; pass++) {
      const downward = pass % 2 === 0

      for (const w of only) {
        const start = offset[w]
        const end = offset[w + 1]
        const rest = segLength[w]
        const bend = hasBend[w] && pass < SOLVER_ITERATIONS - LINK_ONLY_PASSES

        // Bending. This is the wire's rigidity, and how much of it survives
        // gravity is the whole look.
        //
        // Stiffness scales the rest *curvature* and the projection below is
        // always exact. Both halves of that were arrived at the hard way.
        // Scaling the constraint's strength instead cannot hold an arc against
        // gravity at all — the entire usable range fell between 0.85 and 1.0 —
        // and worse, partial projections on a long chain are unstable in a band
        // of middling strengths: an 80-segment wire crumpled into 90°-per-joint
        // folds while the same wire held its shape at both weaker and full
        // strength. An exact projection cannot overshoot, so it cannot pump
        // energy in, and it is stable at every segment count and curvature
        // tested. What it costs is compliance: a wire holds its shape rather
        // than rippling, and swings from its anchor as one piece.
        //
        // The constraint is *directional*: each link is pulled toward the rest
        // direction it should have relative to the link above it, carried onto
        // the wire's current orientation by the shortest rotation. Constraining
        // only how far a joint bends is not enough, and it was built that way
        // first — leaving each joint free to choose a side, gravity duly picks
        // alternating ones, so the wire zigzags imperceptibly and hangs dead
        // plumb. Holding a shape means holding which way it bends.
        //
        // The first link is deliberately left unconstrained, so a wire holds its
        // shape while still being free to swing bodily from its anchor. That
        // freedom is what the breeze acts on.
        if (bend) {
          const joints = end - 2 - start
          for (let n = 0; n < joints; n++) {
            const i = downward ? start + 1 + n : end - 2 - n
            const dx = px[i] - px[i - 1]
            const dy = py[i] - py[i - 1]
            const dz = pz[i] - pz[i - 1]
            const len = Math.hypot(dx, dy, dz)
            if (len < 1e-9) continue

            rotateArc(rdx[i - 1], rdy[i - 1], rdz[i - 1], dx / len, dy / len, dz / len, rdx[i], rdy[i], rdz[i], rotated)

            // Equal and opposite, the way a bending rod really pushes. Moving
            // only the child is the textbook follow-the-leader step, and it
            // injects momentum on every pass: the lower half of a wire wound
            // itself into a 60°-per-joint coil inside a second. Splitting the
            // correction conserves it.
            const cx = (px[i] + rest * rotated[0] - px[i + 1]) * 0.5
            const cy = (py[i] + rest * rotated[1] - py[i + 1]) * 0.5
            const cz = (pz[i] + rest * rotated[2] - pz[i + 1]) * 0.5

            px[i + 1] += cx
            py[i + 1] += cy
            pz[i + 1] += cz
            px[i] -= cx
            py[i] -= cy
            pz[i] -= cz
          }
        }

        // Links, enforced hard: a wire does not stretch. The anchor has no
        // inverse mass, so its neighbour takes the whole correction.
        const links = end - 1 - start
        for (let n = 0; n < links; n++) {
          const a = downward ? start + n : end - 2 - n
          const b = a + 1
          const dx = px[b] - px[a]
          const dy = py[b] - py[a]
          const dz = pz[b] - pz[a]
          const d = Math.hypot(dx, dy, dz)
          if (d < 1e-9) continue

          const pinned = a === start
          const off = (d - rest) / d
          const shareA = pinned ? 0 : 0.5
          const shareB = pinned ? 1 : 0.5

          px[a] += dx * off * shareA
          py[a] += dy * off * shareA
          pz[a] += dz * off * shareA
          px[b] -= dx * off * shareB
          py[b] -= dy * off * shareB
          pz[b] -= dz * off * shareB
        }
      }
    }

    error = residual(only)
  }

  /**
   * Largest link-length violation left, in world units.
   *
   * Its own pass, after the solver has finished, rather than read
   * opportunistically inside the last one. The two constraints pull against each
   * other, so a number taken between them describes a state the wire is never
   * actually in.
   */
  function residual(only: readonly number[]): number {
    let worst = 0
    for (const w of only) {
      const rest = segLength[w]
      for (let i = offset[w]; i < offset[w + 1] - 1; i++) {
        const gap = Math.abs(Math.hypot(px[i + 1] - px[i], py[i + 1] - py[i], pz[i + 1] - pz[i]) - rest)
        if (gap > worst) worst = gap
      }
    }
    return worst
  }

  const everyWire = Array.from({ length: wireCount }, (_, w) => w)

  readSpecs()

  /** Wires laid out fresh by this build, rather than carried from the last. */
  const fresh: number[] = []

  for (let w = 0; w < wireCount; w++) {
    const count = offset[w + 1] - offset[w]
    const carried = previous && w < previous.wireCount && previous.offset[w + 1] - previous.offset[w] === count

    if (!carried) {
      layOut(w)
      fresh.push(w)
      continue
    }

    const from = previous.offset[w]
    const to = offset[w]
    px.set(previous.px.subarray(from, from + count), to)
    py.set(previous.py.subarray(from, from + count), to)
    pz.set(previous.pz.subarray(from, from + count), to)
    ox.set(px.subarray(to, to + count), to)
    oy.set(py.subarray(to, to + count), to)
    oz.set(pz.subarray(to, to + count), to)
  }

  return {
    wireCount,
    particleCount,
    offset,
    anchorOffsets,
    px,
    py,
    pz,

    update(next) {
      specs = next
      readSpecs()
      moving = true
    },

    step(wind) {
      integrate(DAMPING, wind, everyWire)
      solve(everyWire)
    },

    settle(only = everyWire) {
      if (only.length === 0) return
      // Settle to where the canopy actually pins the wires, not to wherever a
      // tremble happened to have the anchors when this was called.
      anchorOffsets.fill(0)

      // Runs to rest rather than for a fixed count, because how long a scene
      // takes to fall still depends on how long and how limp its wires are.
      for (let i = 0; i < SETTLE_STEP_CAP; i++) {
        integrate(SETTLE_DAMPING, null, only)
        solve(only)
        if (!moving && i > 8) break
      }

      for (const w of only) {
        const from = offset[w]
        const to = offset[w + 1]
        ox.set(px.subarray(from, to), from)
        oy.set(py.subarray(from, to), from)
        oz.set(pz.subarray(from, to), from)
      }
      moving = only.length < wireCount
    },

    maxError: () => error,
    atRest: () => !moving,
    freshWires: fresh,
  }
}
