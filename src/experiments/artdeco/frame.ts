/**
 * The empty middle a frame leaves, as a polygon about the centre, and the
 * three questions growth and drawing ask of it: where a ray enters it, whether
 * a point is in it, and how far a point is from its edge.
 *
 * Every shape is built one side at a time, each side the same profile, so the
 * middle is mirrored left to right and top to bottom by construction: the
 * frame's symmetry never has to be checked against the drawing's.
 */

export type Corner = "square" | "chamfer" | "steps" | "round" | "notch"
export type InsetShape = "box" | "steps" | "chevron"

export type Shape = {
  /** Half the middle's width and height. */
  hx: number
  hy: number
  oval: boolean
  corner: Corner
  /** How far the corner ornament reaches along each side, in px. */
  cornerSize: number
  /** Steps in a stepped corner. */
  steps: number
  /** Insets per side: the band reaching into the middle. */
  insets: number
  /** How far an inset reaches into the middle, in px. */
  insetDepth: number
  insetShape: InsetShape
}

export type Point = [number, number]

const ARC = 12

/** The middle's outline, clockwise on screen from the top left, about (cx, cy). */
export function outline(s: Shape, cx: number, cy: number): Point[] {
  if (s.oval) {
    const n = 96
    return Array.from({ length: n }, (_, k) => {
      const a = (2 * Math.PI * k) / n
      return [cx + s.hx * Math.cos(a), cy + s.hy * Math.sin(a)] as Point
    })
  }
  const c = Math.max(0, Math.min(s.cornerSize, s.hx * 0.9, s.hy * 0.9))
  const pts: Point[] = []
  // Each side, walked from one corner to the next in a frame where u runs
  // along the side, v points into the middle, and (0, 0) is the corner.
  const sides: { o: Point; u: Point; v: Point; len: number }[] = [
    { o: [cx - s.hx, cy - s.hy], u: [1, 0], v: [0, 1], len: 2 * s.hx },
    { o: [cx + s.hx, cy - s.hy], u: [0, 1], v: [-1, 0], len: 2 * s.hy },
    { o: [cx + s.hx, cy + s.hy], u: [-1, 0], v: [0, -1], len: 2 * s.hx },
    { o: [cx - s.hx, cy + s.hy], u: [0, -1], v: [1, 0], len: 2 * s.hy },
  ]
  for (const { o, u, v, len } of sides) {
    const at = (a: number, b: number): Point => [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b]
    // The corner at the start of this side, from the previous side's end
    // (along -v from here, a distance c) to this side's start (along u, c).
    for (const [a, b] of cornerPath(s.corner, c, s.steps)) pts.push(at(a, b))
    // The insets on the straight between the corner ornaments.
    const free = len - 2 * c
    const n = Math.round(s.insets)
    if (n > 0 && s.insetDepth > 0 && free > 4) {
      const w = free / (2 * n + 1)
      // Short of the middle's own half-size, so insets from facing sides never meet.
      const d = Math.min(s.insetDepth, 0.8 * Math.min(s.hx, s.hy))
      for (let k = 0; k < n; k++) {
        const u0 = c + (2 * k + 1) * w
        for (const [a, b] of insetPath(s.insetShape, u0, w, d)) pts.push(at(a, b))
      }
    }
  }
  return dedupe(pts)
}

/**
 * The corner, in the side's own frame: the corner point is (0, 0), this side
 * leaves along +u, and the previous side arrives down u = 0. Points run from
 * (0, c) to (c, 0).
 */
function cornerPath(corner: Corner, c: number, steps: number): Point[] {
  if (c <= 0 || corner === "square") return [[0, 0]]
  switch (corner) {
    case "chamfer":
      return [
        [0, c],
        [c, 0],
      ]
    case "steps": {
      // A staircase cut into the middle's corner: the band's corner block
      // steps down towards the middle.
      const n = Math.max(1, Math.round(steps))
      const q = c / n
      const pts: Point[] = [[0, c]]
      for (let k = 1; k <= n; k++) {
        pts.push([k * q, c - (k - 1) * q])
        pts.push([k * q, c - k * q])
      }
      return pts
    }
    case "round": {
      // The middle's corner rounded: an arc about (c, c).
      const pts: Point[] = []
      for (let k = 0; k <= ARC; k++) {
        const a = Math.PI + (k / ARC) * (Math.PI / 2)
        pts.push([c + c * Math.cos(a), c + c * Math.sin(a)])
      }
      return pts
    }
    case "notch": {
      // The band's corner reaching in as a quarter disc: an arc about the corner itself.
      const pts: Point[] = []
      for (let k = 0; k <= ARC; k++) {
        const a = Math.PI / 2 - (k / ARC) * (Math.PI / 2)
        pts.push([c * Math.cos(a), c * Math.sin(a)])
      }
      return pts
    }
  }
}

/** One inset, the band reaching `d` into the middle over [u0, u0 + w]. */
function insetPath(shape: InsetShape, u0: number, w: number, d: number): Point[] {
  const u1 = u0 + w
  switch (shape) {
    case "box":
      return [
        [u0, 0],
        [u0, d],
        [u1, d],
        [u1, 0],
      ]
    case "chevron":
      return [
        [u0, 0],
        [u0 + w / 2, d],
        [u1, 0],
      ]
    case "steps": {
      // A ziggurat of three tiers.
      const s = w / 6
      return [
        [u0, 0],
        [u0, d / 3],
        [u0 + s, d / 3],
        [u0 + s, (2 * d) / 3],
        [u0 + 2 * s, (2 * d) / 3],
        [u0 + 2 * s, d],
        [u1 - 2 * s, d],
        [u1 - 2 * s, (2 * d) / 3],
        [u1 - s, (2 * d) / 3],
        [u1 - s, d / 3],
        [u1, d / 3],
        [u1, 0],
      ]
    }
  }
}

function dedupe(pts: Point[]): Point[] {
  const out: Point[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p)
  }
  const first = out[0]
  const last = out[out.length - 1]
  if (first && last && out.length > 1 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) out.pop()
  return out
}

/** Whether (x, y) is inside the polygon, by crossings. */
export function inside(poly: Point[], x: number, y: number): boolean {
  let odd = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd
  }
  return odd
}

/** Distance from (x, y) to the polygon's edge. */
export function distance(poly: Point[], x: number, y: number): number {
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j]!
    const [bx, by] = poly[i]!
    const ex = bx - ax
    const ey = by - ay
    const l2 = ex * ex + ey * ey
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0
    best = Math.min(best, Math.hypot(x - ax - ex * t, y - ay - ey * t))
  }
  return best
}

/**
 * How far along (tx, ty), a unit direction, from (ax, ay) a ray first meets
 * the polygon's edge, and that edge's direction; 0 if it starts inside, null
 * if it never meets it. A ray that starts on the edge, as a rebound does,
 * finds the next edge rather than the one it is on.
 */
export function enter(
  poly: Point[],
  ax: number,
  ay: number,
  tx: number,
  ty: number,
): { t: number; ux: number; uy: number } | null {
  if (inside(poly, ax, ay) && distance(poly, ax, ay) > 1e-3) return { t: 0, ux: 1, uy: 0 }
  const hits: { t: number; ux: number; uy: number }[] = []
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [px, py] = poly[j]!
    const [qx, qy] = poly[i]!
    const ex = qx - px
    const ey = qy - py
    const den = tx * ey - ty * ex
    if (Math.abs(den) < 1e-12) continue
    const t = ((px - ax) * ey - (py - ay) * ex) / den
    const s = ((px - ax) * ty - (py - ay) * tx) / den
    if (t > 1e-6 && s >= 0 && s <= 1) hits.push({ t, ux: ex, uy: ey })
  }
  // The first crossing just past which the ray is inside: a grazing touch at a
  // vertex, or leaving the edge it sits on, is not an entry.
  hits.sort((a, b) => a.t - b.t)
  return hits.find((h) => inside(poly, ax + tx * (h.t + 0.05), ay + ty * (h.t + 0.05))) ?? null
}
