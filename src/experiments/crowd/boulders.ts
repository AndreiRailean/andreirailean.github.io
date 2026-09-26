/**
 * Boulders: large black spheres sitting on the ground, centre at ground level.
 *
 * "perhaps first type of occlusion could be just another type of circles, but
 * much larger and of black colour so the blend in with the background. these
 * would naturally block everything behind them." They are the one thing in the
 * world besides the people, and they are drawn in the ground's own colour, so
 * **a boulder is never seen — only the heads it hides are missed.** That is what
 * keeps it from being a landmark, which the piece's `AGENTS.md` records as the
 * thing not to add: there is nothing to navigate by, only a hole in the crowd
 * that moves as you walk past it.
 *
 * ## The layout
 *
 * A square lattice, one candidate per cell, placed anywhere in its cell by the
 * cell's own hash — so neighbours can land together and overlap, which is where
 * the islands come from — and some cells left empty. `coverage` is the share of
 * ground under boulders on average and `size` their mean radius; the period
 * follows from the two. Radii vary by a factor of about three, so a field of
 * them is not a field of one shape at a few distances.
 *
 * **Nothing is placed on the way.** In a street or on a trail a boulder keeps
 * clear of the corridor, so it stands beside the path — which is what hides a
 * line of people round a bend — and never across it. On open ground there is no
 * way, and boulders are anywhere except where I start.
 *
 * ## The force
 *
 * The stalls' soft wall, off the sphere's footprint, plus a steer round it for
 * anybody walking into one: without the steer somebody heading at a boulder's
 * centre is pushed straight back along their own line and stands against it for
 * ever, which a round obstacle does to a straight-line walker every time.
 */

import type { Path } from "@/experiments/crowd/path"

/** How far out from a footprint the push reaches, in metres. The corridor wall's value. */
const SOFTEN = 0.8

/** Per metre inside that band, per second squared. The corridor wall's value. */
const STIFFNESS = 7

/** How far ahead somebody starts to bend round a boulder they are walking at, in metres. */
const LOOKAHEAD = 3

/** Per metre per second of speed into the boulder, per second squared, at contact. */
const STEER = 2.2

/** Share of cells with no boulder in them. */
const MISSING = 0.25

/** Radii run from this share of `size`... */
const SMALLEST = 0.45
/** ...to this. The mean of a uniform draw between them is 1, so `size` is the mean. */
const LARGEST = 1.55

/** How far clear of where I start the nearest boulder's surface is, in metres. */
const START_CLEAR = 2.5

/** Cells cached before the cache is dropped and rebuilt as needed. A long walk visits a lot of ground. */
const CACHE_LIMIT = 20_000

/** `side` is which way round it a walker who meets it square on goes. */
export type Boulder = { x: number; y: number; r: number; side: number }

export type Boulders = {
  active: boolean
  /** Adds the push off, and the steer round, any boulder near a walker. */
  push: (x: number, y: number, vx: number, vy: number, force: { x: number; y: number }) => void
  /** Whether a point is inside a boulder's footprint, or within `margin` of one. */
  blocked: (x: number, y: number, margin: number) => boolean
  /**
   * Every boulder whose footprint comes within `radius` of a point, written into
   * `out`, which is truncated first and returned. Reused by the caller, because
   * it is asked once a frame.
   */
  within: (x: number, y: number, radius: number, out: Boulder[]) => Boulder[]
  /** Depth into the deepest boulder a point is, in metres; 0 when outside all of them. */
  inside: (x: number, y: number) => number
}

const NONE: Boulders = {
  active: false,
  push: () => {},
  blocked: () => false,
  within: (_x, _y, _r, out) => {
    out.length = 0
    return out
  },
  inside: () => 0,
}

/** The same integer hash the stalls use, to [0, 1). */
function cellHash(i: number, j: number, k: number, seed: number): number {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647 + seed * 144269504) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

/**
 * @param coverage share of the ground under boulders, on average.
 * @param size mean radius, metres.
 * @param path the way, so nothing is put on it.
 * @param halfWidth half the corridor; infinite on open ground.
 * @param startX where I am standing, which nothing is put on.
 */
export function createBoulders(
  coverage: number,
  size: number,
  seed: number,
  path: Path,
  halfWidth: number,
  startX: number,
  startY: number,
): Boulders {
  if (coverage <= 0 || size <= 0) return NONE

  // Mean area per boulder over mean area per cell. The mean of r² for a uniform
  // draw on [a, b]·size is (a² + ab + b²)/3 · size², and a share of cells is empty.
  const meanSq = ((SMALLEST * SMALLEST + SMALLEST * LARGEST + LARGEST * LARGEST) / 3) * size * size
  const period = Math.sqrt((Math.PI * meanSq * (1 - MISSING)) / Math.min(0.6, coverage))
  const largest = LARGEST * size
  const open = !Number.isFinite(halfWidth)

  const cache = new Map<number, Boulder | null>()
  const cellKey = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768)

  function cell(i: number, j: number): Boulder | null {
    const k = cellKey(i, j)
    const cached = cache.get(k)
    if (cached !== undefined) return cached
    if (cache.size > CACHE_LIMIT) cache.clear()

    let made: Boulder | null = null
    if (cellHash(i, j, 0, seed) >= MISSING) {
      const r = size * (SMALLEST + (LARGEST - SMALLEST) * cellHash(i, j, 3, seed))
      const x = (i + cellHash(i, j, 1, seed)) * period
      const y = (j + cellHash(i, j, 2, seed)) * period
      const clearOfStart = Math.hypot(x - startX, y - startY) - r > START_CLEAR
      const clearOfWay = open || Math.abs(path.lateral(x, y)) - r > halfWidth + 0.3
      if (clearOfStart && clearOfWay) made = { x, y, r, side: cellHash(i, j, 4, seed) < 0.5 ? 1 : -1 }
    }
    cache.set(k, made)
    return made
  }

  /** Visits every boulder whose footprint could come within `radius` of a point. */
  function each(x: number, y: number, radius: number, visit: (b: Boulder) => void): void {
    const reach = radius + largest
    const i0 = Math.floor((x - reach) / period)
    const i1 = Math.floor((x + reach) / period)
    const j0 = Math.floor((y - reach) / period)
    const j1 = Math.floor((y + reach) / period)
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const b = cell(i, j)
        if (b) visit(b)
      }
    }
  }

  // Closures hoisted out of the hot path: `push` runs for every person every step.
  let px = 0
  let py = 0
  let pvx = 0
  let pvy = 0
  let pforce = { x: 0, y: 0 }
  const pushOne = (b: Boulder) => {
    const dx = px - b.x
    const dy = py - b.y
    const centre = Math.sqrt(dx * dx + dy * dy)
    const d = centre - b.r
    if (d >= LOOKAHEAD || centre < 1e-6) return
    const nx = dx / centre
    const ny = dy / centre
    if (d < SOFTEN) {
      const magnitude = (SOFTEN - d) * STIFFNESS
      pforce.x += nx * magnitude
      pforce.y += ny * magnitude
    }
    // Walking into it: bend round it, on whichever side the walk already
    // leans. Dead on the centre, the side is the boulder's own, so everybody
    // meeting one boulder square on goes the same way round it.
    const into = -(pvx * nx + pvy * ny)
    if (into <= 0) return
    const tangential = pvx * -ny + pvy * nx
    const side = Math.abs(tangential) > 1e-3 ? Math.sign(tangential) : b.side
    const magnitude = into * STEER * (1 - Math.max(0, d) / LOOKAHEAD)
    pforce.x += -ny * side * magnitude
    pforce.y += nx * side * magnitude
  }

  return {
    active: true,
    push(x, y, vx, vy, force) {
      px = x
      py = y
      pvx = vx
      pvy = vy
      pforce = force
      each(x, y, LOOKAHEAD, pushOne)
    },
    blocked(x, y, margin) {
      let hit = false
      each(x, y, margin, (b) => {
        if (!hit && Math.hypot(x - b.x, y - b.y) < b.r + margin) hit = true
      })
      return hit
    },
    within(x, y, radius, out) {
      out.length = 0
      each(x, y, radius, (b) => {
        if (Math.hypot(x - b.x, y - b.y) < b.r + radius) out.push(b)
      })
      return out
    },
    inside(x, y) {
      let deepest = 0
      each(x, y, 0, (b) => {
        const depth = b.r - Math.hypot(x - b.x, y - b.y)
        if (depth > deepest) deepest = depth
      })
      return deepest
    },
  }
}
