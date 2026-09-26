/**
 * Market stalls nobody can see: a grid of blocks with aisles between them.
 *
 * "our direction is more constrained by the invisible topology that is stopping
 * us from making shortcuts (we can't go through market stalls - we have to walk
 * around them)." Nothing here is drawn, which is the brief's own rule — only
 * people are — so the stalls exist only as the shape of where people are not:
 * the crowd fills the aisles and the blocks between them are the dark.
 *
 * ## The layout
 *
 * A square lattice of period `aisle + block`, laid on the world's axes with an
 * aisle crossing at the origin, so wherever I start I start in an aisle. Each
 * block is shrunk a little on each side by its own hash — so no two stalls
 * are the same size and the aisles are not ruled lines — and a few are missing
 * altogether, which is a little square. `coverage` is the share of ground under
 * stalls on a full grid; the block size follows from it and the aisle width.
 *
 * ## The force
 *
 * The same soft, linear, one-sided push as a corridor wall, off the nearest
 * point of the block the person is standing beside. The aisles are at least
 * `aisle` wide and the push reaches `SOFTEN` out, so only one block is ever
 * within reach and nothing has to search.
 */

/** How far out from a stall its push reaches, in metres. The corridor wall's value. */
const SOFTEN = 0.8

/** Per metre inside that band, per second squared. The corridor wall's value. */
const STIFFNESS = 7

/** Share of blocks left out, as open squares. */
const MISSING = 0.08

/** The most a block's side is shrunk, as a share of the block. */
const RAGGED = 0.22

export type Stalls = {
  active: boolean
  /** Lattice period, metres. */
  period: number
  aisle: number
  /** Adds the push off the nearest stall to `force`. */
  push: (x: number, y: number, force: { x: number; y: number }) => void
  /** Whether a point is inside a stall, or within `margin` of one. */
  blocked: (x: number, y: number, margin: number) => boolean
  /** Which aisle crossing a point is standing in, as an id, or −1 between crossings. */
  junction: (x: number, y: number) => number
  /**
   * Which way the aisle under a point runs: 1 along x, 2 along y, 3 at a
   * crossing where both do, 0 inside a stall or an open square's middle.
   */
  runs: (x: number, y: number) => number
}

const NONE: Stalls = {
  active: false,
  period: 0,
  aisle: 0,
  push: () => {},
  blocked: () => false,
  junction: () => -1,
  runs: () => 3,
}

/** A cheap integer hash to [0, 1), so each block has a fixed size of its own. */
function cellHash(i: number, j: number, k: number, seed: number): number {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647 + seed * 144269504) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

export function createStalls(coverage: number, aisle: number, seed: number): Stalls {
  if (coverage <= 0) return NONE
  const root = Math.sqrt(Math.min(0.9, coverage))
  const block = (aisle * root) / (1 - root)
  const period = aisle + block

  /** The block in cell `(i, j)`, in the cell's own coordinates, or null for an open square. */
  function rect(i: number, j: number): [number, number, number, number] | null {
    if (cellHash(i, j, 0, seed) < MISSING) return null
    const x0 = aisle / 2 + cellHash(i, j, 1, seed) * RAGGED * block
    const x1 = aisle / 2 + block - cellHash(i, j, 2, seed) * RAGGED * block
    const y0 = aisle / 2 + cellHash(i, j, 3, seed) * RAGGED * block
    const y1 = aisle / 2 + block - cellHash(i, j, 4, seed) * RAGGED * block
    return [x0, x1, y0, y1]
  }

  /**
   * Signed distance from a point to its own cell's block, and the outward
   * direction, written into `out`. Positive outside.
   */
  const scratch = { d: Infinity, nx: 0, ny: 0 }
  function nearest(x: number, y: number) {
    // A cell starts in the middle of an aisle and its block sits half an aisle
    // in, so the aisles are centred on multiples of the period — and on the
    // origin, where I start.
    const i = Math.floor(x / period)
    const j = Math.floor(y / period)
    const lx = x - i * period
    const ly = y - j * period
    const r = rect(i, j)
    if (!r) {
      scratch.d = Infinity
      return scratch
    }
    const [x0, x1, y0, y1] = r
    const dx = Math.max(x0 - lx, 0, lx - x1)
    const dy = Math.max(y0 - ly, 0, ly - y1)
    if (dx > 0 || dy > 0) {
      const d = Math.sqrt(dx * dx + dy * dy)
      scratch.d = d
      scratch.nx = (lx < x0 ? -dx : dx) / d
      scratch.ny = (ly < y0 ? -dy : dy) / d
      return scratch
    }
    // Inside: out through the nearest side.
    const left = lx - x0
    const right = x1 - lx
    const bottom = ly - y0
    const top = y1 - ly
    const least = Math.min(left, right, bottom, top)
    scratch.d = -least
    scratch.nx = least === left ? -1 : least === right ? 1 : 0
    scratch.ny = least === bottom ? -1 : least === top ? 1 : 0
    return scratch
  }

  return {
    active: true,
    period,
    aisle,
    push(x, y, force) {
      const n = nearest(x, y)
      if (n.d >= SOFTEN) return
      const magnitude = (SOFTEN - n.d) * STIFFNESS
      force.x += n.nx * magnitude
      force.y += n.ny * magnitude
    },
    blocked(x, y, margin) {
      return nearest(x, y).d < margin
    },
    runs(x, y) {
      const inX = Math.abs(y - Math.round(y / period) * period) <= aisle / 2
      const inY = Math.abs(x - Math.round(x / period) * period) <= aisle / 2
      return (inX ? 1 : 0) + (inY ? 2 : 0)
    },
    junction(x, y) {
      const i = Math.round(x / period)
      const j = Math.round(y / period)
      if (Math.abs(x - i * period) > aisle / 2 || Math.abs(y - j * period) > aisle / 2) return -1
      return (i + 4096) * 16384 + (j + 4096)
    },
  }
}
