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
 * **On a way they line it, and the inside of a bend gets more of them.** The
 * first version scattered them on the same lattice as open ground and only
 * refused the ones on the path, so nearly all of them stood far out in the
 * fields where the line never went: "i end up with boulders spread around in a
 * way that the path doesn't come near it". Now, wherever the way is a line
 * along `x` — a street, a trail — they are laid along both verges a metre or
 * two off the edge, and each one picks the inside of the bend it stands at
 * more often the tighter the bend is, in groves with clearings between. The inside is the only place a boulder
 * beside a path can hide the path, so that is where the line goes behind a rock
 * and comes out past it. On open ground and on a loop they are scattered as
 * before, and never on the way or where I start.
 *
 * ## The force
 *
 * The stalls' soft wall, off the sphere's footprint, plus a steer round it for
 * anybody walking into one: without the steer somebody heading at a boulder's
 * centre is pushed straight back along their own line and stands against it for
 * ever, which a round obstacle does to a straight-line walker every time.
 */

import type { GraphPath, Path } from "@/experiments/crowd/path"

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

/**
 * Metres of way a grove or a clearing runs for, along a verge. Long enough that
 * a clearing shows the line going on for a while; short enough that one comes
 * round every minute or two of walking.
 */
const STRETCH = 140

/** Share of stretches that are groves. The rest are clearings, with no boulder in them. */
const GROVES = 0.55

/** Cells cached before the cache is dropped and rebuilt as needed. A long walk visits a lot of ground. */
const CACHE_LIMIT = 20_000

/** `side` is which way round it a walker who meets it square on goes. */
export type Boulder = { x: number; y: number; r: number; side: number }

export type Boulders = {
  active: boolean
  /**
   * Adds the push off, and the steer round, any boulder near a walker. `(wx,
   * wy)` is the velocity they *want*, not the one they have — see the steer.
   */
  push: (x: number, y: number, wx: number, wy: number, force: { x: number; y: number }) => void
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

  // Along the verges when the way is a graph `y = c(x)` with sides to it. The
  // share of ground is then measured over a band two boulders wide on each side,
  // so `coverage` means the same thing it does in the open: 0.4 is a wall of
  // them nearly touching, 0.1 one every nine radii or so.
  const graph = !open && "centre" in path ? (path as GraphPath) : null
  const band = 2 * 4 * size
  // Closer together inside a grove, so that over groves and clearings together
  // the share of ground is still what `coverage` says.
  const step = ((Math.PI * meanSq) / (band * Math.min(0.6, coverage))) * GROVES
  const verge = (k: number): Boulder | null => {
    const key = cellKey(k, 40000)
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    if (cache.size > CACHE_LIMIT) cache.clear()
    const g = graph!
    const x0 = (k + 0.5 + (cellHash(k, 0, 1, seed) - 0.5) * 0.8) * step
    // **Groves and clearings**, because #224's reveal is two halves: the line
    // going behind something, and then "coming onto a clearing that shows how
    // far the line goes". Lined evenly all the way, a trail at 12% hid 71% of
    // its heads and hid something in every frame, so there was never a
    // clearing to come onto.
    const stretch = Math.floor(x0 / STRETCH)
    if (cellHash(stretch, 1, 6, seed) >= GROVES) {
      cache.set(key, null)
      return null
    }
    const slope = g.slope(x0)
    const norm = Math.sqrt(1 + slope * slope)
    const bendRate = (g.slope(x0 + 1) - g.slope(x0 - 1)) / 2 / (norm * norm * norm)
    const inside = bendRate >= 0 ? 1 : -1
    const pInside = 0.5 + 0.45 * Math.min(1, Math.abs(bendRate) * 80)
    const side = cellHash(k, 0, 2, seed) < pInside ? inside : -inside
    const gap = 0.4 + cellHash(k, 0, 3, seed) * 1.6
    let r = size * (SMALLEST + (LARGEST - SMALLEST) * cellHash(k, 0, 4, seed))
    let made: Boulder | null = null
    // On the inside of a tight bend a big one reaches back over the way further
    // along; it is made smaller until it fits rather than dropped, because the
    // inside of a bend is exactly where it is wanted.
    for (let tries = 0; tries < 4 && !made; tries++, r *= 0.7) {
      const off = halfWidth + gap + r
      const x = x0 - (slope * side * off) / norm
      const y = g.centre(x0) + (side * off) / norm
      const clearOfWay = Math.abs(path.lateral(x, y)) - r > halfWidth + 0.2
      const clearOfStart = Math.hypot(x - startX, y - startY) - r > START_CLEAR
      if (clearOfWay && clearOfStart) made = { x, y, r, side: cellHash(k, 0, 5, seed) < 0.5 ? 1 : -1 }
      if (!clearOfStart) break
    }
    cache.set(key, made)
    return made
  }

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
    if (graph) {
      // A verge boulder sits off its own `x` by at most its offset across the way.
      const reach = radius + 2 * largest + halfWidth + 2
      const k1 = Math.floor((x + reach) / step)
      for (let k = Math.floor((x - reach) / step) - 1; k <= k1; k++) {
        const b = verge(k)
        if (b) visit(b)
      }
      return
    }
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
    // Wanting to walk into it: bend round it, on whichever side the walk
    // already leans. **The wanted velocity, not the actual one** — steering on
    // the actual one was built first, and somebody pressed square against a
    // boulder has almost none, so they got no steer and stayed pressed: the
    // chaser spent 46% of a chase stuck behind one on seed 2222. Dead on the centre, the side is the boulder's own, so everybody
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
