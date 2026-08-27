/**
 * A frame carried along each strand, so beads can sit off the centreline.
 *
 * The beads are LEDs protruding from the sides of the strand, not points on it.
 * Placing one needs a direction "sideways" at its position, and the obvious
 * choice — a Frenet frame from the curve's own derivatives — is wrong here: it
 * is undefined where the strand is momentarily straight and it *flips* through an
 * inflection. Either would make beads jump, and a strand with a coil in it has
 * inflections by construction.
 *
 * The double-reflection method carries a frame along instead of recomputing it,
 * so it stays continuous through both cases. It is also two reflections per
 * particle, which is cheaper than the thing that does not work.
 */

import type { Ropes } from "@/experiments/dangler/rope"

export type Frames = {
  /** Unit tangent per particle, pointing down the strand. */
  tx: Float32Array
  ty: Float32Array
  tz: Float32Array
  /** Unit normal per particle: the carried "sideways". */
  nx: Float32Array
  ny: Float32Array
  nz: Float32Array
}

export function createFrames(particleCount: number): Frames {
  return {
    tx: new Float32Array(particleCount),
    ty: new Float32Array(particleCount),
    tz: new Float32Array(particleCount),
    nx: new Float32Array(particleCount),
    ny: new Float32Array(particleCount),
    nz: new Float32Array(particleCount),
  }
}

/** Recomputes every frame in place. Called once per drawn frame, not per step. */
export function updateFrames(ropes: Ropes, frames: Frames): void {
  const { px, py, pz, offset, strandCount } = ropes
  const { tx, ty, tz, nx, ny, nz } = frames

  for (let w = 0; w < strandCount; w++) {
    const start = offset[w]
    const end = offset[w + 1]

    for (let i = start; i < end - 1; i++) {
      const dx = px[i + 1] - px[i]
      const dy = py[i + 1] - py[i]
      const dz = pz[i + 1] - pz[i]
      const len = Math.hypot(dx, dy, dz) || 1
      tx[i] = dx / len
      ty[i] = dy / len
      tz[i] = dz / len
    }
    // The free end has no link beyond it; it inherits the last tangent.
    tx[end - 1] = tx[end - 2]
    ty[end - 1] = ty[end - 2]
    tz[end - 1] = tz[end - 2]

    // Carry each particle's own normal through *time*.
    //
    // A rotation-minimising frame is minimal along the curve, not along the
    // clock. Re-propagating it from the strand's start every rendered frame is
    // continuous in space and says nothing whatever about continuity in time:
    // any change of shape accumulates down the strand, so the frame at the free
    // end swings even when nothing is kinked. Measured on eighty strands in wind,
    // sixteen of them turned their end frames more than half a revolution, the
    // worst at three and a half turns in twenty seconds — which is precisely
    // "the bulbs are spinning on their strings", since the tip bulbs are the
    // near, large, most visible ones.
    //
    // Projecting each stored normal back onto its own tangent is continuous per
    // particle by construction, and neighbours stay coherent because they began
    // coherent and their tangents move together. The along-strand propagation
    // below is then only ever needed to *start* a strand off.
    let carried = true
    for (let i = start; i < end; i++) {
      const along = nx[i] * tx[i] + ny[i] * ty[i] + nz[i] * tz[i]
      const ux = nx[i] - along * tx[i]
      const uy = ny[i] - along * ty[i]
      const uz = nz[i] - along * tz[i]
      const len = Math.hypot(ux, uy, uz)

      // Nothing stored yet, or the tangent has swung so far that the stored
      // normal now lies along it and no longer says which way round the strand
      // is. Seed the whole strand afresh below.
      //
      // Repairing just this particle from its neighbour was tried and measures
      // exactly the same, so the simpler branch wins. It only happens on strands
      // that have folded, which is a rope problem rather than a frame one.
      if (len < 1e-3) {
        carried = false
        break
      }

      nx[i] = ux / len
      ny[i] = uy / len
      nz[i] = uz / len
    }

    if (carried) continue

    // Seed with any unit vector perpendicular to the first tangent. Which one
    // is arbitrary — it only fixes where "bead angle zero" points.
    const seed = Math.abs(tz[start]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    let ux = seed[1] * tz[start] - seed[2] * ty[start]
    let uy = seed[2] * tx[start] - seed[0] * tz[start]
    let uz = seed[0] * ty[start] - seed[1] * tx[start]
    let ulen = Math.hypot(ux, uy, uz) || 1
    ux /= ulen
    uy /= ulen
    uz /= ulen
    nx[start] = ux
    ny[start] = uy
    nz[start] = uz

    // Then carry it down the strand by double reflection, which stays
    // continuous through an inflection where a Frenet frame would flip.
    for (let i = start; i < end - 1; i++) {
      // Reflect across the plane bisecting the two points.
      const v1x = px[i + 1] - px[i]
      const v1y = py[i + 1] - py[i]
      const v1z = pz[i + 1] - pz[i]
      const c1 = v1x * v1x + v1y * v1y + v1z * v1z
      if (c1 < 1e-18) {
        nx[i + 1] = ux
        ny[i + 1] = uy
        nz[i + 1] = uz
        continue
      }

      const du = (2 / c1) * (v1x * ux + v1y * uy + v1z * uz)
      const ulx = ux - du * v1x
      const uly = uy - du * v1y
      const ulz = uz - du * v1z

      const dt = (2 / c1) * (v1x * tx[i] + v1y * ty[i] + v1z * tz[i])
      const tlx = tx[i] - dt * v1x
      const tly = ty[i] - dt * v1y
      const tlz = tz[i] - dt * v1z

      // Reflect again, onto the next tangent.
      const v2x = tx[i + 1] - tlx
      const v2y = ty[i + 1] - tly
      const v2z = tz[i + 1] - tlz
      const c2 = v2x * v2x + v2y * v2y + v2z * v2z

      if (c2 < 1e-18) {
        ux = ulx
        uy = uly
        uz = ulz
      } else {
        const d2 = (2 / c2) * (v2x * ulx + v2y * uly + v2z * ulz)
        ux = ulx - d2 * v2x
        uy = uly - d2 * v2y
        uz = ulz - d2 * v2z
      }

      ulen = Math.hypot(ux, uy, uz) || 1
      ux /= ulen
      uy /= ulen
      uz /= ulen
      nx[i + 1] = ux
      ny[i + 1] = uy
      nz[i + 1] = uz
    }
  }
}
