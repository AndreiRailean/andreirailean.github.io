/**
 * The scene: lines grown in one segment, drawn once per image of a symmetry group.
 *
 * **Only one segment is grown.** Segment 0 has its middle along +x in the
 * scene's own coordinates, which are fractions of the frame's half-diagonal
 * about its centre. The group is the N rotations by a whole segment, plus, for
 * `mirror`, the N reflections about the segment middles and edges — the
 * dihedral group, which is what a kaleidoscope's two mirrors make. Every line
 * is stored once and drawn once per group element, so a frame draws the
 * segment's lines `2N` times and draws nothing that is not on screen.
 *
 * **Symmetry is by construction, never checked.** A line's copies are where
 * the group puts them, so they cannot drift apart.
 *
 * **A line meets every copy of every line**, its own included. That is the
 * only thing that makes `free` different from `wedge`: a free line crosses its
 * segment's edges and lives among the copies, and ends at the first one the
 * `stops` setting lets it meet.
 *
 * **A root and its offshoots are a family, and a family has a life.** It is
 * born, grows until every tip has stopped, holds, undraws in the order it
 * grew, and is born again somewhere new. Under `cycle: each` every family
 * keeps its own clock, staggered at the start, so the figure is always
 * changing somewhere; under `together` they are born at once and the drawing
 * undraws as a whole once every family has held.
 *
 * **Time is distance.** Every tip grows at one speed, so a family's clock is a
 * length, a line's `born` is that clock when it started, and a point `s` along
 * it was drawn at `born + s`. Undrawing replays the clock, so it takes lines
 * away in the order they grew — and an undrawn stretch is gone for meetings
 * too, so new growth can pass where an old family was.
 *
 * **Growth runs in fixed ticks**, so live, settled and replayed drawings are
 * the same drawing: a tip meets other lines as they stood when it moved, and
 * the order tips move in is fixed.
 */

import { context2d, fitCanvas } from "@/experiments/simulation/canvas"
import { steadyLoop } from "@/experiments/simulation/loop"
import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { CLOCK_RATE, HOLD_FOREVER, needsRegrow, type Settings } from "@/experiments/kaleidoscope/settings"

/** One growth step, in seconds of scene. */
export const TICK = 1 / 60
/**
 * A meeting this close to where a line started or last branched is the
 * lines it branched from, not a meeting. Measured from that point, not from
 * the start of every tick's step: skipping the first 1e-4 of every step
 * passed through one real meeting in a dozen, and 3% of `concentric`'s bars
 * crossed their own reflection. Wide enough for the rounding in meeting two
 * arcs that set off together along the same tangent (about 1e-8 of their
 * radius, and no arc is wider than 1/FLAT).
 */
const JOINT = 1e-5
/** Where a line runs off the frame: the half-diagonal, so a spinning figure still fills the corners. */
const EDGE = 1
/** Most tips growing at once; past it a split goes straight on instead. */
const MAX_TIPS = 900
/** Most lines standing at once; past it nothing splits or turns. */
const MAX_LINES = 30_000
/** Undrawing runs this many times faster than growing. */
const UNDRAW_RATE = 2
/** Under `each`, families are first born across this many seconds, so they never move in step. */
const STAGGER = 8
/** Under `each`, the most seconds a family waits between undrawing and being born again. */
const REBIRTH = 1.5
/** Seconds of age the age colouring sweeps through. */
const AGE_SPAN = 24
/** Bands the age colouring is cut into, so a drawing stays a handful of strokes per copy. */
const SHADES = 24
/**
 * The sharpest a cut end may meet its line at, as the sine of the angle. A
 * cut any flatter runs its corners far down the line; the end is left square.
 */
const FLATTEST_CUT = 0.2
/** Thinnest a tapered line gets, css px. */
const MIN_WIDTH = 0.2
/**
 * Widths a line can take between `width` and `widest`, so lines share
 * strokes: a frame is at most this many times more strokes than one width.
 */
const WIDTHS = 8
/**
 * Gentler than this, in radians per half-diagonal, a line runs straight:
 * under 1.2° of bend across the whole frame. It keeps every arc's centre
 * within 100 half-diagonals, where meeting two of them stays exact.
 */
const FLAT = 0.01
/** Most pieces a tip runs through in one tick: the end of a rounded corner, mostly. */
const MAX_HOPS = 16
/** Undrawn lines are dropped, and the grid rebuilt, once this many have piled up. */
const COMPACT_AT = 2000
const CELL = 0.025
const SPAN = 1.1
const COLS = Math.ceil((2 * SPAN) / CELL)
const DEG = Math.PI / 180

/** A 2×2 linear map about the centre: [a b; c d]. */
type Map2 = { a: number; b: number; c: number; d: number; flip: boolean }

export type Ending = "line" | "family" | "image" | "wall" | "edge" | "life" | "split" | "turn"

type Family = {
  /** Unique per birth, so a reborn family does not meet its former self as its own. */
  id: number
  slot: number
  births: number
  rng: Rng
  /** Draws each line's width, on its own stream so a width range moves no drawing. */
  widths: Rng
  /** Draws each line's curl, on its own stream so straight lines grow as they always did. */
  curls: Rng
  state: "wait" | "grow" | "hold" | "undraw"
  /** How far this family has grown since its birth. */
  clock: number
  /** Seconds left to wait, or seconds held. */
  timer: number
  undrawn: number
  tips: number
}

/**
 * The line a line's end is cut along, in segment coordinates: through
 * (px, py) in direction (ux, uy). With `on`, it is that line's near edge
 * rather than its middle, `on`'s half-width toward the cut line's body, so
 * a line ending at another touches it with no gap and no overlap whatever
 * the two widths are.
 */
type Cut = { px: number; py: number; ux: number; uy: number; on: Line | null }

/** How a new line bends: see `Line`. */
type Shape = { bend: number; curve: number; aim: number | null; drift: number }
const STRAIGHT: Shape = { bend: 0, curve: 0, aim: null, drift: 0 }
/** A line bending by its curl alone, from straight off where it starts. */
const curled = (drift: number): Shape => ({ bend: 0, curve: drift, aim: null, drift })

type Line = {
  x: number
  y: number
  dx: number
  dy: number
  /** The direction the family's turns count from, radians off the segment's middle. */
  base: number
  /** Direction as a whole number of angles off `base`. */
  k: number
  /** Radians the line runs off `base + k·angle`, where it is bending: 0 for a straight line. */
  bend: number
  /** Radians the line bends per half-diagonal of length, left positive; 0 runs straight. */
  curve: number
  /** The `bend` a rounded corner is bending toward, or null where it is not rounding one. */
  aim: number | null
  /** The curve the line settles into once any corner is rounded: its curl. */
  drift: number
  /** Length at which a rounded corner is done and the line runs on at its curl; Infinity otherwise. */
  stop: number
  len: number
  /** Length at which the next decision is taken. */
  next: number
  /** The family's clock when the line started. */
  born: number
  /** Scene seconds when the line started, for colouring by age. */
  t: number
  family: Family
  /** Decisions this line's ancestry has taken. */
  depth: number
  /** Which of `WIDTHS` widths it takes: 0 is `width`, the last `widest`. */
  thick: number
  alive: boolean
  /** Undrawn whole, waiting for the next compaction to drop it. */
  gone: boolean
  /** Index of a reflection that maps the line onto itself, or -1. */
  axis: number
  /** Where it started or last branched: meetings here are the joint, not meetings. */
  jx: number
  jy: number
  /** What its start is cut along; null for square. */
  tail: Cut | null
  /**
   * What its end is cut along, once it has ended: one cut, or two — its left
   * half and its right — where it split into two offshoots. Null for square.
   */
  head: Cut[] | null
}

/** A cut along a line through (px, py) running (ux, uy), not normalised. */
function cutAlong(px: number, py: number, ux: number, uy: number, on: Line | null = null): Cut {
  const n = Math.hypot(ux, uy)
  return { px, py, ux: ux / n, uy: uy / n, on }
}

/**
 * The mitre where a line running (ax, ay) gives way to one running (bx, by)
 * at (px, py): across the bisector, so the outer corners meet and nothing
 * overlaps. Null where they double back on each other.
 */
function mitre(px: number, py: number, ax: number, ay: number, bx: number, by: number): Cut | null {
  const sx = ax + bx
  const sy = ay + by
  if (Math.hypot(sx, sy) < 1e-9) return null
  return cutAlong(px, py, -sy, sx)
}

/** The group a segment is repeated by. Element 0 is the identity. */
export function groupFor(segments: number, mirror: boolean): Map2[] {
  const maps: Map2[] = []
  const wedge = (2 * Math.PI) / segments
  for (let k = 0; k < segments; k++) {
    const c = Math.cos(k * wedge)
    const s = Math.sin(k * wedge)
    maps.push({ a: c, b: -s, c: s, d: c, flip: false })
  }
  if (mirror) {
    // Reflections about the lines at j·π/N: the segment middles (j even) and edges (j odd).
    for (let j = 0; j < segments; j++) {
      const c = Math.cos((2 * j * Math.PI) / segments)
      const s = Math.sin((2 * j * Math.PI) / segments)
      maps.push({ a: c, b: s, c: s, d: -c, flip: true })
    }
  }
  return maps
}

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx

/** How far along the other segment `meet`'s last meeting was, as a fraction of it. */
let meetU = 0

/**
 * Where the step P→P+r first meets the segment A→A+s, as a fraction of the
 * step, or Infinity. Parallel segments never meet: a line lying along its own
 * reflection is that reflection, not a meeting.
 */
function meet(px: number, py: number, rx: number, ry: number, ax: number, ay: number, sx: number, sy: number) {
  const denom = cross(rx, ry, sx, sy)
  if (Math.abs(denom) < 1e-14) return Infinity
  const qx = ax - px
  const qy = ay - py
  const t = cross(qx, qy, sx, sy) / denom
  const u = cross(qx, qy, rx, ry) / denom
  if (t < 0 || t > 1 || u < -1e-9 || u > 1 + 1e-9) return Infinity
  meetU = u
  return t
}

/**
 * A line is one piece of constant curvature: from (x, y) heading (dx, dy),
 * bending `curve` radians per half-diagonal to the left (0 runs straight). So a
 * straight line and an arc are the same thing, and every question — where
 * it is, which way it heads, where it meets another — has one closed form
 * per pair of kinds.
 */
type Piece = { x: number; y: number; dx: number; dy: number; curve: number }

/** Where a piece is `s` along it. */
function pointAt(p: Piece, s: number): [number, number] {
  const k = p.curve
  if (k === 0) return [p.x + p.dx * s, p.y + p.dy * s]
  const sn = Math.sin(k * s)
  // 1 − cos, without the cancellation of subtracting it.
  const vers = 2 * Math.sin((k * s) / 2) ** 2
  return [p.x + (p.dx * sn - p.dy * vers) / k, p.y + (p.dx * vers + p.dy * sn) / k]
}

/** Which way a piece heads `s` along it, as a unit vector. */
function headingAt(p: Piece, s: number): [number, number] {
  const k = p.curve
  if (k === 0) return [p.dx, p.dy]
  const c = Math.cos(k * s)
  const sn = Math.sin(k * s)
  return [p.dx * c - p.dy * sn, p.dy * c + p.dx * sn]
}

/**
 * How far along an arc the point (zx, zy) on its circle is, from 0 up to
 * once round. Worked scaled by the curvature, so a wide arc's centre, far
 * off, never enters the sum.
 */
function arcLength(x: number, y: number, dx: number, dy: number, k: number, zx: number, zy: number) {
  // From the centre: to the start is (dy, −dx)/k, to the point this.
  const wx = (zx - x) * k + dy
  const wy = (zy - y) * k - dx
  const s = Math.atan2(cross(dy, -dx, wx, wy), dy * wx - dx * wy) / k
  return s < -1e-9 ? s + (2 * Math.PI) / Math.abs(k) : s
}

/** How far along the other piece `hit`'s last meeting was. */
let hitAlong = 0

/**
 * The first place the step — from (px, py) heading (ux, uy) with curvature
 * `k`, `len` long — meets piece B between `b0` and `b1` along it, as a length
 * along the step; Infinity if none. A meeting within `joint` of (jx, jy) is
 * the joint the step's line grew from and is passed over. Both pieces are
 * in the same frame.
 */
function hit(
  px: number,
  py: number,
  ux: number,
  uy: number,
  k: number,
  len: number,
  bx: number,
  by: number,
  bdx: number,
  bdy: number,
  bk: number,
  b0: number,
  b1: number,
  jx: number,
  jy: number,
  joint: number,
): number {
  let best = Infinity
  const take = (s: number, along: number, zx: number, zy: number) => {
    if (s < 0 || s > len || s >= best) return
    if (along < b0 - 1e-9 || along > b1 + 1e-9) return
    if (Math.hypot(zx - jx, zy - jy) < joint) return
    best = s
    hitAlong = along
  }
  if (k === 0 && bk === 0) {
    const t = meet(px, py, ux * len, uy * len, bx + bdx * b0, by + bdy * b0, bdx * (b1 - b0), bdy * (b1 - b0))
    if (Number.isFinite(t)) take(t * len, b0 + meetU * (b1 - b0), px + ux * t * len, py + uy * t * len)
    return best
  }
  if (k === 0) {
    // A line against B's circle, centre B + n/bk with n B's left normal.
    const qx = px - bx
    const qy = py - by
    const nq = -bdy * qx + bdx * qy
    const half = ux * qx + uy * qy - (-bdy * ux + bdx * uy) / bk
    const disc = half * half - (qx * qx + qy * qy - (2 * nq) / bk)
    if (disc < 0) return Infinity
    const root = Math.sqrt(disc)
    for (const t of [-half - root, -half + root]) {
      const zx = px + ux * t
      const zy = py + uy * t
      take(t, arcLength(bx, by, bdx, bdy, bk, zx, zy), zx, zy)
    }
    return best
  }
  if (bk === 0) {
    // B's line against the step's circle.
    const gx = bx - px
    const gy = by - py
    const ng = -uy * gx + ux * gy
    const half = bdx * gx + bdy * gy - (-uy * bdx + ux * bdy) / k
    const disc = half * half - (gx * gx + gy * gy - (2 * ng) / k)
    if (disc < 0) return Infinity
    const root = Math.sqrt(disc)
    for (const v of [-half - root, -half + root]) {
      const zx = bx + bdx * v
      const zy = by + bdy * v
      take(arcLength(px, py, ux, uy, k, zx, zy), v, zx, zy)
    }
    return best
  }
  // Two circles.
  const ax = px - uy / k
  const ay = py + ux / k
  const cx = bx - bdy / bk
  const cy = by + bdx / bk
  const ra = 1 / Math.abs(k)
  const rb = 1 / Math.abs(bk)
  const ddx = cx - ax
  const ddy = cy - ay
  const dist = Math.hypot(ddx, ddy)
  if (dist < 1e-12 || dist > ra + rb || dist < Math.abs(ra - rb)) return Infinity
  const a = (ra * ra - rb * rb + dist * dist) / (2 * dist)
  const h = Math.sqrt(Math.max(0, ra * ra - a * a))
  const mx = ax + (ddx * a) / dist
  const my = ay + (ddy * a) / dist
  for (const side of [-1, 1]) {
    const zx = mx - (ddy * h * side) / dist
    const zy = my + (ddx * h * side) / dist
    take(arcLength(px, py, ux, uy, k, zx, zy), arcLength(bx, by, bdx, bdy, bk, zx, zy), zx, zy)
  }
  return best
}

/** Where a line's drawn stretch starts: past whatever its family has undrawn. */
const visibleFrom = (line: Line) => (line.family.state === "undraw" ? Math.max(0, line.family.undrawn - line.born) : 0)

/** An angle brought within half a turn of 0. */
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI))

/**
 * Where a side of a line, `side` off its middle, crosses a cut, as a length
 * along the line near `expected` (0 at a start, the length at an end); or
 * null where the cut is too flat to meet it cleanly. `body` is which way
 * the line runs from the cut: +1 from a start, −1 from an end, so a near
 * edge is the edge on the line's own side.
 */
function crossing(
  line: Line,
  side: number,
  cut: Cut,
  body: 1 | -1,
  half: (line: Line) => number,
  expected: number,
): number | null {
  const [hx, hy] = headingAt(line, expected)
  let px = cut.px
  let py = cut.py
  if (cut.on) {
    // Its near edge: moved off its middle toward this line's body.
    const nx = -cut.uy
    const ny = cut.ux
    const toward = Math.sign((nx * hx + ny * hy) * body) || 1
    const offset = half(cut.on) * toward
    px += nx * offset
    py += ny * offset
  }
  const k = line.curve
  if (k === 0) {
    const denom = cross(line.dx, line.dy, cut.ux, cut.uy)
    if (Math.abs(denom) < FLATTEST_CUT) return null
    // The side runs from (line.x, line.y) + side · normal, along (dx, dy).
    const sx = line.x - line.dy * side - px
    const sy = line.y + line.dx * side - py
    return -cross(sx, sy, cut.ux, cut.uy) / denom
  }
  // On an arc the side is a circle about the arc's centre C, its point at s
  // being C + (side − 1/k)·n(s). It is on the cut where the heading there
  // makes cos(heading − cut) = cross(C − p, u) / (side − 1/k).
  const r = side - 1 / k
  const cx = line.x - line.dy / k
  const cy = line.y + line.dx / k
  const cosine = cross(cx - px, cy - py, cut.ux, cut.uy) / r
  if (Math.abs(cosine) > 1) return null
  // The sine is how square the side meets the cut.
  if (Math.sqrt(1 - cosine * cosine) < FLATTEST_CUT) return null
  const along = Math.atan2(cut.uy, cut.ux)
  const there = Math.atan2(hy, hx)
  let best: number | null = null
  for (const sign of [-1, 1]) {
    const s = expected + wrap(along + sign * Math.acos(cosine) - there) / k
    if (best === null || Math.abs(s - expected) < Math.abs(best - expected)) best = s
  }
  return best
}

/** A cut side's length, or `square` where the cut is missing or lies more than four half-widths off. */
/** Both cut ends of a line in full: as the lines draw them. */
const OPEN = [Infinity, Infinity] as const

const nearCut = (w: number) => (t: number | null, square: number) =>
  t === null || Math.abs(t - square) > 4 * w ? square : t

/** Where each side of a line starts, left then right, cut along what it started on; at 0 where it starts square. */
function tailEnds(line: Line, w: number, half: (line: Line) => number): [number, number] {
  if (!line.tail) return [0, 0]
  const near = nearCut(w)
  return [near(crossing(line, w, line.tail, 1, half, 0), 0), near(crossing(line, -w, line.tail, 1, half, 0), 0)]
}

/** Where each side of a stopped line ends, left then right, cut along what it met; both at its tip while it grows. */
function headEnds(line: Line, w: number, half: (line: Line) => number): [number, number] {
  const { len } = line
  const head = line.alive ? null : line.head
  if (!head) return [len, len]
  const near = nearCut(w)
  return [
    near(crossing(line, w, head[0]!, -1, half, len), len),
    near(crossing(line, -w, head[head.length - 1]!, -1, half, len), len),
  ]
}

/**
 * Adds a line's outline, from `from` along it to its tip, `w` either side
 * of its middle, each end square or cut as the line records. A curved line's
 * sides are arcs about its centre, so it is one shape however far it bends.
 * A cut end reaches at most `ahead` past the tip and a cut start at most
 * `behind` back from the start: how far the ground has let each open out.
 * Short of its tip, at `to`, it ends square.
 */
function outline(
  path: Path2D,
  line: Line,
  from: number,
  w: number,
  half: (line: Line) => number,
  [behind, ahead]: readonly [number, number] = OPEN,
  to = Infinity,
) {
  // Short of its tip, a line is drawn to a square end at `to`.
  const tip = to >= line.len
  const len = tip ? line.len : to
  const k = line.curve
  // Left is +normal, (-dy, dx); right is −normal.
  const at = (s: number, side: number) => {
    const [x, y] = pointAt(line, s)
    const [dx, dy] = headingAt(line, s)
    return [x - dy * side, y + dx * side] as const
  }
  // The start, cut only while none of it has been undrawn. A slanted cut puts
  // one corner behind the start point, at a negative length, and it must
  // stay there: squaring it off is the notch the cut exists to close.
  let tailL = from
  let tailR = from
  if (line.tail && from === 0) [tailL, tailR] = tailEnds(line, w, half)
  const head = tip && !line.alive ? line.head : null
  const [headL, headR] = tip ? headEnds(line, w, half) : [len, len]
  // How far across a cut is at length s: +w at its left corner, −w at its right.
  const across = (l: number, r: number) => (s: number) => (r === l ? 0 : w - (2 * w * (s - l)) / (r - l))
  const tailAt = across(tailL, tailR)
  const headAt = across(headL, headR)
  // The ground opens a cut end square across the line, `behind` back from
  // the start and `ahead` past the tip, so each frame adds a strip.
  const back = -behind
  const stop = head && head.length > 1 ? Infinity : len + ahead

  // A slanted start whose forward corner is still past the tip: only what has
  // grown beyond the cut is there, between the cut and a square end. Drawing
  // the whole start put that corner down ahead of the line.
  if (!head && Math.max(tailL, tailR) > len && Math.min(tailL, tailR) < len) {
    const corner = Math.min(tailL, tailR)
    const side = tailL < tailR ? w : -w
    const s0 = Math.max(corner, back)
    path.moveTo(...at(s0, side))
    path.lineTo(...at(len, side))
    path.lineTo(...at(len, tailAt(len)))
    if (s0 > corner) path.lineTo(...at(s0, tailAt(s0)))
    path.closePath()
    return
  }

  const startL = Math.max(tailL, back)
  const startR = Math.max(tailR, back)
  // Neither side ends before it starts.
  const endL = Math.max(Math.min(headL, stop), startL)
  const endR = Math.max(Math.min(headR, stop), startR)
  const clipL = headL > stop
  const clipR = headR > stop

  path.moveTo(...at(startR, -w))
  if (startR > tailR || startL > tailL) path.lineTo(...at(back, tailAt(back)))
  path.lineTo(...at(startL, w))
  const tipEnd = () => {
    if (clipL !== clipR) path.lineTo(...at(stop, headAt(stop)))
    // A split's two cuts meet on its middle at the tip.
    if (head && head.length > 1 && Math.min(headL, headR) < len) path.lineTo(...at(len, 0))
    path.lineTo(...at(endR, -w))
  }
  if (k === 0) {
    path.lineTo(...at(endL, w))
    tipEnd()
    path.closePath()
    return
  }
  // A side at `side` is a circle of radius |side − 1/k| about the centre;
  // the angle to its point at s turns with the heading, by k·s.
  const cx = line.x - line.dy / k
  const cy = line.y + line.dx / k
  const start = Math.atan2(line.dy, line.dx) + Math.PI / 2
  const edge = (side: number, s0: number, s1: number, back: boolean) => {
    const r = side - 1 / k
    const off = start + (r < 0 ? Math.PI : 0)
    path.arc(cx, cy, Math.abs(r), off + k * s0, off + k * s1, back ? k > 0 : k < 0)
  }
  edge(w, startL, endL, false)
  tipEnd()
  edge(-w, endR, startR, true)
  path.closePath()
}

/**
 * One growth: its lines, families and grid, and the clock that grows them. It
 * draws nothing; the scene draws two of them, the lines and the ground.
 */
function createGrowth(initial: Settings) {
  let settings = initial

  let group: Map2[] = []
  let lines: Line[] = []
  let tips: number[] = []
  let families: Family[] = []
  let nextId = 0
  /** Grid of `line * G + image` codes, for finding what a step might meet. */
  let cells: number[][] = []
  /** Per `line * G + image`, the cell its copy's tip was last filed in. */
  let lastCell: number[] = []
  let stamp = new Uint32Array(0)
  let query = 0
  let goneCount = 0

  /** Scene seconds since the drawing began. */
  let now = 0
  let owed = 0
  /** Under `together`: seconds every family has been holding. */
  let heldAll = 0

  const ended: Record<Ending, number> = { line: 0, family: 0, image: 0, wall: 0, edge: 0, life: 0, split: 0, turn: 0 }
  const decided = { split: 0, turn: 0, straight: 0, capped: 0 }
  let births = 0
  let undrawns = 0
  let compactions = 0
  /** Pieces lines have carried on into: the end of a rounded corner, or a new curl. */
  let pieces = 0
  /** Lines met by something within 0.001 of where they started: a joint taken for a meeting, mostly. */
  let stubs = 0

  const unit = () => Number(settings.angle) * DEG
  const stepLen = () => settings.step / 100

  /** A curl for a new line, drawn from its family's own stream: between `curl` either way per step. */
  function curlFor(family: Family) {
    if (settings.curl <= 0) return 0
    return ((family.curls() * 2 - 1) * settings.curl * DEG) / stepLen()
  }

  /** Where a line is heading at its tip, as a bend off `base + k·angle`. */
  const bendAt = (line: Line) => line.bend + line.curve * line.len

  /**
   * The shape of a line leaving `line`'s tip `dk` angles round from it,
   * with curl `drift`. With `round`, it leaves heading as `line` does at its
   * tip and bends round to its new direction on an arc of that radius;
   * without, it turns there, a sharp corner. Either way it ends up `dk`
   * angles off where `line` was heading, or bending toward.
   */
  function shapeFrom(line: Line, dk: number, drift: number): Shape {
    const heading = bendAt(line)
    const aim = line.aim ?? heading
    const radius = settings.round * stepLen()
    if (dk === 0) return { bend: heading, curve: line.aim === null ? drift : line.curve, aim: line.aim, drift }
    if (radius <= 0) return { bend: aim, curve: drift, aim: null, drift }
    const bend = heading - dk * unit()
    return { bend, curve: Math.sign(aim - bend) / radius, aim, drift }
  }

  function cellOf(x: number, y: number) {
    const cx = Math.min(COLS - 1, Math.max(0, Math.floor((x + SPAN) / CELL)))
    const cy = Math.min(COLS - 1, Math.max(0, Math.floor((y + SPAN) / CELL)))
    return cy * COLS + cx
  }

  /** Files every copy of a line's newest stretch in the cells it passes through. */
  function file(index: number, fromX: number, fromY: number, toX: number, toY: number) {
    const G = group.length
    for (let g = 0; g < G; g++) {
      const m = group[g]!
      const ax = m.a * fromX + m.b * fromY
      const ay = m.c * fromX + m.d * fromY
      const bx = m.a * toX + m.b * toY
      const by = m.c * toX + m.d * toY
      const code = index * G + g
      const to = cellOf(bx, by)
      if (lastCell[code] === to) continue
      const from = lastCell[code] ?? cellOf(ax, ay)
      const x0 = Math.min(from % COLS, to % COLS)
      const x1 = Math.max(from % COLS, to % COLS)
      const y0 = Math.min(Math.floor(from / COLS), Math.floor(to / COLS))
      const y1 = Math.max(Math.floor(from / COLS), Math.floor(to / COLS))
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          const cell = cells[cy * COLS + cx]!
          if (cell[cell.length - 1] !== code) cell.push(code)
        }
      lastCell[code] = to
    }
  }

  /** Files a whole line, in steps shorter than a cell, as `file` would have as it grew. */
  function fileWhole(index: number) {
    const line = lines[index]!
    file(index, line.x, line.y, line.x, line.y)
    const steps = Math.ceil(line.len / (CELL / 2))
    for (let i = 0; i < steps; i++) {
      const [ax, ay] = pointAt(line, (line.len * i) / steps)
      const [bx, by] = pointAt(line, (line.len * (i + 1)) / steps)
      file(index, ax, ay, bx, by)
    }
  }

  function ensureStamp() {
    const need = lines.length * group.length
    if (stamp.length < need) {
      const grown = new Uint32Array(Math.max(need, stamp.length * 2))
      grown.set(stamp)
      stamp = grown
    }
  }

  /** Drops undrawn lines and rebuilds the grid, renumbering what is left. */
  function compact() {
    const remap = new Map<number, number>()
    const kept: Line[] = []
    lines.forEach((line, index) => {
      if (line.gone) return
      remap.set(index, kept.length)
      kept.push(line)
    })
    lines = kept
    // A cut against a line now gone has nothing left to sit flush with.
    for (const line of lines) {
      if (line.tail?.on?.gone) line.tail.on = null
      for (const cut of line.head ?? []) if (cut.on?.gone) cut.on = null
    }
    tips = tips.flatMap((index) => (remap.has(index) ? [remap.get(index)!] : []))
    cells = Array.from({ length: COLS * COLS }, () => [])
    lastCell = []
    for (let index = 0; index < lines.length; index++) fileWhole(index)
    ensureStamp()
    goneCount = 0
    compactions++
  }

  /** The reflection that maps a line onto itself, if any: a line along a mirror. */
  function axisOf(x: number, y: number, dx: number, dy: number): number {
    for (let g = 0; g < group.length; g++) {
      const m = group[g]!
      if (!m.flip) continue
      const fx = m.a * x + m.b * y
      const fy = m.c * x + m.d * y
      const fdx = m.a * dx + m.b * dy
      const fdy = m.c * dx + m.d * dy
      if (Math.hypot(fx - x, fy - y) < 1e-9 && Math.hypot(fdx - dx, fdy - dy) < 1e-9) return g
    }
    return -1
  }

  function addLine(
    x: number,
    y: number,
    base: number,
    k: number,
    family: Family,
    depth: number,
    tail: (dx: number, dy: number) => Cut | null = () => null,
    shape: Shape = STRAIGHT,
  ): number {
    let { bend, curve, aim, drift } = shape
    if (Math.abs(drift) < FLAT) drift = 0
    if (aim === null && Math.abs(curve) < FLAT) curve = 0
    // A corner already rounded is not rounded again.
    if (aim !== null && (aim - bend) * curve <= 1e-12) {
      bend = aim
      aim = null
      curve = drift
    }
    const angle = base + k * unit() + bend
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    // A line on a mirror is the spine, and stays straight on it, curl or no
    // curl. A corner being rounded off it only sets out along it: it bends
    // away, its reflection the other way, so it is no spine. Taken for one,
    // it was kept straight on top of the spine, and every offshoot of it
    // too: 1664 lines on `rose` at round 0.5, against 21.
    const axis = aim === null ? axisOf(x, y, dx, dy) : -1
    if (axis >= 0) {
      curve = drift = 0
      aim = null
    }
    const index = lines.length
    lines.push({
      x,
      y,
      dx,
      dy,
      base,
      k,
      bend,
      curve,
      aim,
      drift,
      stop: aim === null ? Infinity : (aim - bend) / curve,
      len: 0,
      next: stepLen(),
      born: family.clock,
      t: now,
      family,
      depth,
      thick: Math.floor(family.widths() * WIDTHS),
      alive: true,
      gone: false,
      axis,
      jx: x,
      jy: y,
      tail: tail(dx, dy),
      head: null,
    })
    tips.push(index)
    family.tips++
    file(index, x, y, x, y)
    ensureStamp()
    return index
  }

  function end(line: Line, why: Ending) {
    line.alive = false
    line.family.tips--
    ended[why]++
    if (line.len < 1e-3 && why !== "split" && why !== "turn" && why !== "life") stubs++
  }

  /**
   * Ends a piece where its curve changes and starts the next at its tip,
   * heading on as it was: the same line carrying on, so it keeps its width
   * and its depth, and its next decision falls where it would have. With a
   * new `drift`, the line has decided to bend another way from here.
   */
  function carryOn(index: number, drift?: number): number {
    const line = lines[index]!
    line.alive = false
    line.family.tips--
    pieces++
    const [tipX, tipY] = pointAt(line, line.len)
    const [hx, hy] = headingAt(line, line.len)
    const shape = shapeFrom(line, 0, drift ?? line.drift)
    const next = addLine(
      tipX,
      tipY,
      line.base,
      line.k,
      line.family,
      line.depth,
      (dx, dy) => mitre(tipX, tipY, hx, hy, dx, dy),
      shape,
    )
    const link = lines[next]!
    link.thick = line.thick
    link.next = line.next - line.len
    link.born = line.born + line.len
    line.head = link.tail ? [link.tail] : null
    return next
  }

  /** The largest whole number of angles a line may run off the middle and still grow outward. */
  const outward = () => Math.max(0, Math.floor((89.9 * DEG) / unit()))

  /** Plants a family's root: at or near the centre, or on a side of the segment. */
  function birth(family: Family) {
    family.births++
    family.id = nextId++
    family.rng = makeRng(hashSeed(settings.seed, family.slot, family.births))
    family.widths = makeRng(hashSeed(settings.seed, family.slot, family.births, 0x71d7))
    family.curls = makeRng(hashSeed(settings.seed, family.slot, family.births, 0xc0be))
    family.state = "grow"
    family.clock = 0
    family.undrawn = 0
    family.timer = 0
    family.tips = 0
    births++
    const rng = family.rng
    const half = Math.PI / settings.segments
    const mirror = settings.symmetry === "mirror"
    // Its own stream, so the share going the other way moves no other draw.
    const other = makeRng(hashSeed(settings.seed, family.slot, family.births, 0xf119))() < settings.flip

    if (settings.from === "sides") {
      // Mirror grows half a segment, whose outer side is the edge at +half;
      // the other side is the middle, where the reflection takes over.
      const side = mirror || rng() < 0.5 ? 1 : -1
      const r = 0.02 + 0.98 * rng()
      const wall = side * half
      // Square off the side, pointing into the segment, leaned as asked: a
      // positive lean toward the rim on either side, a negative one toward
      // the centre. Square itself only ever grows away from the centre.
      const lean = other ? -settings.lean : settings.lean
      const base = wall - side * (Math.PI / 2) + side * lean * DEG
      // Cut along the side it starts on: under mirror that is the mirror,
      // so a root and its reflection close into a sharp chevron.
      addLine(
        r * Math.cos(wall),
        r * Math.sin(wall),
        base,
        0,
        family,
        0,
        () => cutAlong(0, 0, Math.cos(wall), Math.sin(wall)),
        curled(curlFor(family)),
      )
      return
    }

    let x = 0
    let y = 0
    if (settings.spread > 0) {
      const r = settings.spread * Math.sqrt(rng())
      const a = mirror ? rng() * half : (rng() * 2 - 1) * half
      x = r * Math.cos(a)
      y = r * Math.sin(a)
    }
    let k = 0
    // The first slot from the very centre runs up the middle: the spine.
    if (family.slot > 0 || settings.spread > 0) {
      k = Math.floor(rng() * (outward() + 1))
      if (!mirror && rng() < 0.5) k = -k
      // Turned round, to face the centre: half a turn is a whole number of
      // angles for every angle offered.
      if (other && settings.spread > 0) k += Math.round(Math.PI / unit())
    }
    addLine(x, y, settings.lean * DEG, k, family, 0, undefined, curled(curlFor(family)))
  }

  function regrow() {
    group = groupFor(settings.segments, settings.symmetry === "mirror")
    lines = []
    tips = []
    cells = Array.from({ length: COLS * COLS }, () => [])
    lastCell = []
    stamp = new Uint32Array(1024)
    goneCount = 0
    now = 0
    owed = 0
    heldAll = 0
    births = undrawns = compactions = pieces = stubs = 0
    for (const key of Object.keys(ended) as Ending[]) ended[key] = 0
    decided.split = decided.turn = decided.straight = decided.capped = 0
    const each = settings.cycle === "each"
    const stagger = makeRng(hashSeed(settings.seed, 0x57a6))
    families = Array.from({ length: settings.roots }, (_, slot) => ({
      id: -1,
      slot,
      births: 0,
      rng: stagger,
      widths: stagger,
      curls: stagger,
      state: "wait" as const,
      clock: 0,
      // The first family is born at once, so the screen is never empty for long.
      timer: each && slot > 0 ? stagger() * STAGGER : 0,
      undrawn: 0,
      tips: 0,
    }))
    for (const family of families) if (family.timer === 0) birth(family)
  }

  /**
   * The first thing the step from `line`'s tip of length `d` meets: how far
   * along the step, what it was, and how far along the line it met.
   */
  function firstMeeting(
    index: number,
    d: number,
  ): { s: number; why: Ending; other: Line | null; g: number; along: number } {
    const line = lines[index]!
    const k = line.curve
    const [px, py] = pointAt(line, line.len)
    const [ux, uy] = headingAt(line, line.len)
    const { jx, jy } = line
    let best = Infinity
    let why: Ending = "line"
    // What was met: a line and the group element of its copy, or for a wall
    // no line and the wall's side.
    let met: Line | null = null
    let metG = 0
    let metAlong = 0
    const G = group.length
    const stops = settings.stops

    const consider = (s: number, kind: Ending, other: Line | null, g: number) => {
      if (s >= best) return
      best = s
      why = kind
      met = other
      metG = g
      metAlong = hitAlong
    }
    /** The step against `them`'s copy under `m`, between `b0` and `b1` along it. */
    const against = (them: Line, m: Map2, b0: number, b1: number) =>
      hit(
        px,
        py,
        ux,
        uy,
        k,
        d,
        m.a * them.x + m.b * them.y,
        m.c * them.x + m.d * them.y,
        m.a * them.dx + m.b * them.dy,
        m.c * them.dx + m.d * them.dy,
        m.flip ? -them.curve : them.curve,
        b0,
        b1,
        jx,
        jy,
        JOINT,
      )

    if (stops !== "none") {
      // Its own copies, grown to where this step takes it.
      const reach = line.len + d
      for (let g = 1; g < G; g++) consider(against(line, group[g]!, 0, reach), "image", line, g)

      // Itself, come right round: only an arc held past a whole turn can.
      if (k !== 0 && visibleFrom(line) === 0) {
        const round = (2 * Math.PI) / Math.abs(k) - line.len
        if (round >= 0 && round <= d) {
          hitAlong = 0
          consider(round, "family", null, -1)
        }
      }

      query++
      // The step's box, widened by how far an arc bows out from its chord.
      const [qx, qy] = pointAt(line, line.len + d)
      const bow = (Math.abs(k) * d * d) / 8
      const x0 = Math.floor((Math.min(px, qx) - bow + SPAN) / CELL)
      const x1 = Math.floor((Math.max(px, qx) + bow + SPAN) / CELL)
      const y0 = Math.floor((Math.min(py, qy) - bow + SPAN) / CELL)
      const y1 = Math.floor((Math.max(py, qy) + bow + SPAN) / CELL)
      for (let cy = Math.max(0, y0); cy <= Math.min(COLS - 1, y1); cy++)
        for (let cx = Math.max(0, x0); cx <= Math.min(COLS - 1, x1); cx++) {
          for (const code of cells[cy * COLS + cx]!) {
            if (stamp[code] === query) continue
            stamp[code] = query
            const other = Math.floor(code / G)
            if (other === index) continue
            const them = lines[other]!
            if (them.gone) continue
            const own = them.family.id === line.family.id
            if (stops === "own" && !own) continue
            // Only the stretch still drawn can be met.
            const from = visibleFrom(them)
            if (them.len - from <= 0) continue
            const g = code - other * G
            consider(against(them, group[g]!, from, them.len), own ? "family" : "line", them, g)
          }
        }
    }

    if (settings.confine === "wedge") {
      const half = Math.PI / settings.segments
      for (const side of [-1, 1]) {
        const s = hit(px, py, ux, uy, k, d, 0, 0, Math.cos(side * half), Math.sin(side * half), 0, 0, 2, jx, jy, JOINT)
        consider(s, "wall", null, side)
      }
    }

    return { s: best, why, other: met, g: metG, along: metAlong }
  }

  function decide(index: number) {
    const line = lines[index]!
    line.depth++
    if (line.depth >= settings.life) {
      end(line, "life")
      return
    }
    const rng = line.family.rng
    const roll = rng()
    const sign = rng() < 0.5 ? -1 : 1
    const room = tips.length < MAX_TIPS && lines.length - goneCount < MAX_LINES
    const [tipX, tipY] = pointAt(line, line.len)
    const [hx, hy] = headingAt(line, line.len)

    if (roll < settings.split) {
      if (!room) {
        decided.capped++
        line.next += stepLen()
        return
      }
      decided.split++
      // A line on a mirror is the figure's spine, and always carries on: the
      // segment is narrow, so its offshoots soon meet their reflections, and
      // ending the spine at its first split emptied two drawings in three.
      const carry = rng() < settings.keep || line.axis >= 0
      // An offshoot of a line that carries on starts at its edge; of one that
      // ends here, it is mitred to it.
      const from = (dx: number, dy: number) =>
        carry ? cutAlong(tipX, tipY, hx, hy, line) : mitre(tipX, tipY, hx, hy, dx, dy)
      const left = addLine(
        tipX,
        tipY,
        line.base,
        line.k + 1,
        line.family,
        line.depth,
        from,
        shapeFrom(line, 1, curlFor(line.family)),
      )
      // On a mirror, the other offshoot is the first one's reflection.
      const right =
        line.axis < 0
          ? addLine(
              tipX,
              tipY,
              line.base,
              line.k - 1,
              line.family,
              line.depth,
              from,
              shapeFrom(line, -1, curlFor(line.family)),
            )
          : -1
      if (carry) {
        line.next += stepLen()
        // Its offshoots start here, on it.
        line.jx = tipX
        line.jy = tipY
        if (settings.curl > 0 && line.axis < 0) carryOn(index, curlFor(line.family))
      } else {
        end(line, "split")
        // Its left half is mitred to the left offshoot, its right to the right.
        const l = lines[left]!
        const r = lines[right]!
        const cuts = [mitre(tipX, tipY, hx, hy, l.dx, l.dy), mitre(tipX, tipY, hx, hy, r.dx, r.dy)]
        line.head = cuts[0] && cuts[1] ? [cuts[0], cuts[1]] : null
      }
      return
    }
    if (roll < settings.split + settings.turn) {
      if (!room) {
        decided.capped++
        line.next += stepLen()
        return
      }
      decided.turn++
      // On a mirror a turn is a fork, its reflection turning the other way,
      // and the spine carries on between them.
      const spine = line.axis >= 0
      const turned = addLine(
        tipX,
        tipY,
        line.base,
        line.k + sign,
        line.family,
        line.depth,
        (dx, dy) => (spine ? cutAlong(tipX, tipY, hx, hy, line) : mitre(tipX, tipY, hx, hy, dx, dy)),
        shapeFrom(line, sign, curlFor(line.family)),
      )
      if (spine) {
        line.next += stepLen()
        line.jx = tipX
        line.jy = tipY
      } else {
        end(line, "turn")
        // A bend: one line changing direction, so one width, mitred.
        const child = lines[turned]!
        child.thick = line.thick
        line.head = child.tail ? [child.tail] : null
      }
      return
    }
    decided.straight++
    line.next += stepLen()
    // Straight on, a curling line takes a new curl: it may wind the other way.
    if (settings.curl > 0 && line.axis < 0) carryOn(index, curlFor(line.family))
  }

  /**
   * How a line that has met something at (tx, ty) is cut: flush with the near
   * edge of the line it met; along the mirror where it met its own reflection
   * tip to tip, which is the point of a chevron; along the wall it reached.
   */
  function headAt(line: Line, tx: number, ty: number, other: Line | null, g: number, along: number): Cut[] | null {
    if (!other) {
      const half = Math.PI / settings.segments
      return [cutAlong(0, 0, Math.cos(g * half), Math.sin(g * half))]
    }
    const m = group[g]!
    // The copy's heading where it was met.
    const [ox, oy] = headingAt(other, along)
    const ux = m.a * ox + m.b * oy
    const uy = m.c * ox + m.d * oy
    if (other === line) {
      // Its own copy: tip to tip when the copy's tip is here too.
      const cx = m.a * tx + m.b * ty
      const cy = m.c * tx + m.d * ty
      if (Math.hypot(cx - tx, cy - ty) < 1e-6) {
        const [hx, hy] = headingAt(line, line.len)
        const cut = mitre(tx, ty, hx, hy, -ux, -uy)
        return cut ? [cut] : null
      }
    }
    return [cutAlong(tx, ty, ux, uy, other)]
  }

  function grow(d0: number) {
    const growing = tips
    tips = []
    for (const first of growing) {
      let index = first
      let line = lines[index]!
      if (!line.alive) continue
      // What is left of this tick's growth, carried from a rounded corner to the line beyond it.
      let budget = d0
      for (let hops = 0; ; hops++) {
        const d = Math.min(budget, line.next - line.len, line.stop - line.len)
        if (d > 0) {
          budget -= d
          const [fromX, fromY] = pointAt(line, line.len)
          const { s, why, other, g, along } = firstMeeting(index, d)
          const metHere = Number.isFinite(s)
          line.len += metHere ? s : d
          const [tx, ty] = pointAt(line, line.len)
          file(index, fromX, fromY, tx, ty)
          if (metHere) {
            end(line, why)
            line.head = g < 0 ? null : headAt(line, tx, ty, other, g, along)
            break
          }
          if (tx * tx + ty * ty > EDGE * EDGE) {
            end(line, "edge")
            break
          }
          // A line that set off outside its segment from a point on an edge —
          // a root at the centre, aimed wider than the segment — crosses no
          // wall the meeting test can see, because it starts on both.
          if (settings.confine === "wedge" && Math.abs(Math.atan2(ty, tx)) > Math.PI / settings.segments + 1e-9) {
            end(line, "wall")
            line.head = headAt(line, tx, ty, null, Math.sign(ty), 0)
            break
          }
        }
        if (line.len >= line.next - 1e-12) {
          decide(index)
          break
        }
        if (line.len < line.stop - 1e-12 || hops >= MAX_HOPS) break
        index = carryOn(index)
        // `addLine` filed it as a tip; it is this one, carried on below.
        tips.pop()
        line = lines[index]!
        if (budget <= 1e-12) break
      }
      if (line.alive) tips.push(index)
    }
  }

  /** Takes a family's lines off the screen for good, and sets it waiting to be born again. */
  function retire(family: Family) {
    for (const line of lines) {
      if (line.family !== family || line.gone) continue
      line.gone = true
      goneCount++
    }
    undrawns++
    family.state = "wait"
    family.timer = settings.cycle === "each" ? family.rng() * REBIRTH : 0
  }

  function tick() {
    const d0 = (settings.speed / 100) * TICK
    const forever = settings.hold >= HOLD_FOREVER
    const each = settings.cycle === "each"
    now += TICK

    for (const family of families)
      if (family.state === "wait") {
        family.timer -= TICK
        if (family.timer <= 0) birth(family)
      }

    grow(d0)

    for (const family of families) {
      if (family.state === "grow") {
        family.clock += d0
        if (family.tips <= 0) {
          family.state = "hold"
          family.timer = 0
        }
      } else if (family.state === "hold" && each && !forever) {
        family.timer += TICK
        if (family.timer >= settings.hold) family.state = "undraw"
      } else if (family.state === "undraw") {
        family.undrawn += d0 * UNDRAW_RATE
        if (family.undrawn >= family.clock) retire(family)
      }
    }

    // Together, the drawing undraws as one once every family has held.
    if (!each) {
      const allHeld = families.every((family) => family.state === "hold")
      heldAll = allHeld ? heldAll + TICK : 0
      if (allHeld && !forever && heldAll >= settings.hold) {
        for (const family of families) family.state = "undraw"
        heldAll = 0
      }
    }

    if (goneCount > COMPACT_AT || (goneCount > 200 && goneCount * 2 > lines.length)) compact()
  }

  function advance(seconds: number) {
    owed += seconds
    while (owed >= TICK) {
      owed -= TICK
      tick()
    }
  }

  /** Takes new settings; true when they start the growth again. */
  function set(next: Settings) {
    const before = settings
    settings = next
    if (!needsRegrow(before, next)) return false
    regrow()
    return true
  }

  /** What the growth actually did, counted off the lines rather than read off settings. */
  function counts() {
    const round = (v: number, d = 3) => Number(v.toFixed(d))
    let length = 0
    let deepest = 0
    let standing = 0
    let inward = 0
    for (const line of lines) {
      if (line.gone) continue
      standing++
      const from = visibleFrom(line)
      // Undrawn past its end, it is still standing until its family is retired, but none of it shows.
      const drawn = Math.max(0, line.len - from)
      length += drawn
      deepest = Math.max(deepest, line.depth)
      // Heading in, judged at the middle of what is drawn of it.
      const mid = (from + line.len) / 2
      const [mx, my] = pointAt(line, mid)
      const [hx, hy] = headingAt(line, mid)
      if (mx * hx + my * hy < 0) inward += drawn
    }
    const states = { wait: 0, grow: 0, hold: 0, undraw: 0 }
    for (const family of families) states[family.state]++
    return {
      seconds: round(now, 2),
      /** Families in each part of their life, now. */
      states,
      births,
      undrawns,
      compactions,
      lines: standing,
      tips: tips.length,
      deepest,
      /** Total drawn length of the grown segment's lines, in half-diagonals. */
      length: round(length),
      /** Share of that length heading toward the centre rather than away. */
      inward: round(length > 0 ? inward / length : 0),
      images: group.length,
      decided: { ...decided },
      /** Pieces lines have carried on into since the drawing began: a rounded corner's end, or a new curl. */
      pieces,
      /** Lines ended by a meeting within 0.001 of their start: should be few, or joints are being met. */
      stubs,
      ended: { ...ended },
    }
  }

  regrow()

  return {
    set,
    regrow,
    advance,
    counts,
    lines: () => lines,
    group: () => group,
    tips: () => tips,
    now: () => now,
  }
}

type Growth = ReturnType<typeof createGrowth>

/** The ground's own settings: the same rules on a seed of its own, growing at its own pace. */
function groundOf(settings: Settings): Settings {
  return { ...settings, seed: hashSeed(settings.seed, 0x6a0d) % 1_000_000, speed: settings.speed * settings.groundPace }
}

/**
 * The ground is painted at most this many device px from its centre to its
 * rim. Its chunks are wide, so it need not match a large screen pixel for
 * pixel; it is stretched to fit and turned with the figure.
 */
const GROUND_RES = 1600
/** The thinnest chunk is this share of the widest. */
const GROUND_RANGE = 1 / 3

export function createKaleidoscope(canvas: HTMLCanvasElement, initial: Settings) {
  const ctx = context2d(canvas, "kaleidoscope")

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1
  let spin = 0
  let debug = false
  let drawMs = 0
  let strokes = 0
  /** Distinct widths the last frame stroked, css px. */
  let widths: number[] = []

  const growth = createGrowth(initial)
  /**
   * The ground: a growth of its own, painted into `paint` and never wiped
   * while it lives, only painted over. A line is painted again while it
   * grows and left alone after, so what grew later lies on top; its family
   * undrawing frees the space for new growth but takes none of the paint.
   */
  const ground = createGrowth(groundOf(initial))
  const paint = document.createElement("canvas")
  const brush = context2d(paint, "kaleidoscope")
  /** The ground's half-diagonal in its own px; 0 until first painted. */
  let groundR = 0
  /**
   * How far each ground line has been painted: its length, and how far its
   * cut end has grown in past that since it stopped.
   */
  let painted = new WeakMap<Line, { len: number; ends: readonly [number, number] }>()
  /** The ground's clock when it was last painted. */
  let paintedAt = 0
  const groundOn = () => settings.ground > 0

  function size() {
    ;({ width, height, dpr } = fitCanvas(canvas))
  }

  function wipe() {
    brush.setTransform(1, 0, 0, 1, 0, 0)
    brush.fillStyle = "#000"
    brush.fillRect(0, 0, paint.width, paint.height)
    painted = new WeakMap()
    paintedAt = 0
  }

  /** Sizes the ground to the screen, keeping what is painted on it. */
  function fitGround(R: number) {
    const want = Math.min(GROUND_RES, Math.ceil(R * dpr))
    if (want === groundR) return
    const old =
      groundR > 0 ? Object.assign(document.createElement("canvas"), { width: paint.width, height: paint.height }) : null
    old?.getContext("2d")?.drawImage(paint, 0, 0)
    const kept = { painted, paintedAt }
    paint.width = paint.height = 2 * want
    wipe()
    if (old) {
      brush.drawImage(old, 0, 0, paint.width, paint.height)
      // What was painted is still there, rescaled: painting it again would lay old lines over newer paint.
      ;({ painted, paintedAt } = kept)
    }
    groundR = want
  }

  const shadeOf = (shade: number) =>
    settings.colourBy === "depth"
      ? shade / Math.max(1, settings.life - 1)
      : settings.colourBy === "family"
        ? shade / Math.max(1, settings.roots)
        : shade / SHADES
  /** The look of the ground's black paint, apart from every colour along the sweep. */
  const BLACK = -1
  /**
   * Whether a ground line's growth paints black: one draw per birth, on a
   * stream of its own, so the black share moves no line and the same births
   * stay black as it rises.
   */
  const paintsBlack = (line: Line) =>
    settings.groundBlack > 0 &&
    makeRng(hashSeed(groundOf(settings).seed, line.family.slot, line.family.births, 0xb1ac))() < settings.groundBlack
  /** A colour along the sweep, its lightness scaled by `tone`. */
  const colour = (at: number, tone: number) =>
    settings.tint > 0
      ? `hsl(${settings.hue + settings.hues * at} ${Math.round(settings.tint * 92)}% ${Math.round((100 - settings.tint * 42) * tone)}%)`
      : tone === 1
        ? "#fff"
        : `hsl(0 0% ${Math.round(100 * tone)}%)`

  /**
   * One path per colour: every line is a filled outline, its width in its
   * shape, so a frame costs (colours × copies) fills, not (lines × copies).
   */
  function looksOf(
    of: Growth,
    list: Iterable<Line>,
    /** What of a line to add to its look's path; null for nothing. */
    shape: (line: Line) => ((path: Path2D) => void) | null,
    painted = false,
  ) {
    const { colourBy } = settings
    const tinted = settings.tint > 0 && colourBy !== "copy"
    const now = of.now()
    const looks = new Map<number, Path2D>()
    for (const line of list) {
      if (line.gone) continue
      const draw = shape(line)
      if (!draw) continue
      const shade =
        painted && paintsBlack(line)
          ? BLACK
          : !tinted
            ? 0
            : colourBy === "depth"
              ? line.depth
              : colourBy === "family"
                ? line.family.slot
                : painted
                  ? // Paint is coloured once, young, so by age it takes the time it grew, round the sweep.
                    Math.floor((line.t / AGE_SPAN) * SHADES) % SHADES
                  : Math.min(SHADES - 1, Math.floor(((now - line.t) / AGE_SPAN) * SHADES))
      let path = looks.get(shade)
      if (!path) looks.set(shade, (path = new Path2D()))
      draw(path)
    }
    return looks
  }

  /** Fills each look once per copy of the segment, `place` setting each copy's matrix. Returns the fills made. */
  function fillCopies(
    target: CanvasRenderingContext2D,
    of: Growth,
    looks: Map<number, Path2D>,
    tone: number,
    place: (m: Map2) => void,
    rule: CanvasFillRule = "nonzero",
  ) {
    const entries = [...looks]
    const colours = entries.map(([shade]) => (shade === BLACK ? "#000" : colour(shadeOf(shade), tone)))
    const group = of.group()
    for (let g = 0; g < group.length; g++) {
      place(group[g]!)
      const copy = settings.colourBy === "copy" ? colour(g / group.length, tone) : ""
      for (let i = 0; i < entries.length; i++) {
        target.fillStyle = (entries[i]![0] !== BLACK && copy) || colours[i]!
        target.fill(entries[i]![1], rule)
      }
    }
    return entries.length * group.length
  }

  /**
   * Paints what the ground grew since the last frame, and only that, so
   * newer paint across a line's older stretch stays on top. A growing line
   * is painted from where it was last painted, a pixel back so no seam
   * shows. Its cut ends open out at its own speed rather than arriving whole,
   * as the lines' do: a meeting is found on a line's middle, so when a wide
   * chunk stops most of its end is still to come, and a chunk starting on a
   * wall at a slant has a corner far behind its start; taken at once, both
   * snapped a star's points into place. An end opening paints only the
   * sliver it gained, its shape now less its shape before by the even-odd
   * rule: painting it whole each frame flipped which of two crossing chunks
   * lay on top the frame one of them finished.
   */
  function paintGround(R: number) {
    fitGround(R)
    const half = (line: Line) => (settings.ground * GROUND_RANGE ** (1 - line.thick / (WIDTHS - 1))) / R / 2
    const now = ground.now()
    const grew = (Math.max(0, now - paintedAt) * groundOf(settings).speed) / 100
    paintedAt = now
    const seam = 1 / R
    const grown = new Map<Line, (path: Path2D) => void>()
    const opening: [Line, (path: Path2D) => void][] = []
    for (const line of ground.lines()) {
      if (line.gone) continue
      const was = painted.get(line)
      const w = half(line)
      const tail = tailEnds(line, w, half)
      const back = -Math.min(0, ...tail)
      const front = Math.max(0, Math.max(...headEnds(line, w, half)) - line.len)
      const [behind0, ahead0] = was?.ends ?? [0, 0]
      const behind = Math.min(back, behind0 + grew)
      // A tip opens from where it stopped: while it grew, its end was square.
      const ahead = line.alive ? 0 : Math.min(front, was?.len === line.len ? ahead0 + grew : grew)
      painted.set(line, { len: line.len, ends: [behind, ahead] })
      if (!was) {
        grown.set(line, (path) => outline(path, line, 0, w, half, [behind, ahead]))
        continue
      }
      // The start, out to just past its forward corner: where it grows across
      // the cut, the cut bounds it, so it is painted as a change of shape.
      const zone = Math.max(0, ...tail) + seam
      if (behind !== behind0 || (was.len < zone && was.len !== line.len)) {
        const before = Math.max(0, Math.min(zone, was.len - seam))
        opening.push([
          line,
          (path) => {
            outline(path, line, 0, w, half, [behind, ahead], zone)
            outline(path, line, 0, w, half, [Math.max(0, behind0 - seam), ahead], before)
          },
        ])
      }
      // Past it, what grew is a strip from where the line was last painted.
      const from = Math.max(was.len - seam, zone - seam)
      if (was.len !== line.len && from < line.len)
        grown.set(line, (path) => outline(path, line, from, w, half, [behind, ahead]))
      // A stopped tip opening, as the change of its end's shape.
      if (was.len === line.len && ahead !== ahead0) {
        // Within the start's reach, the cut there bounds it too.
        const end = line.len < zone ? 0 : line.len - seam
        opening.push([
          line,
          (path) => {
            outline(path, line, end, w, half, [behind, ahead])
            outline(path, line, end, w, half, [behind, Math.max(0, ahead0 - seam)])
          },
        ])
      }
    }
    const s = groundR
    const place = (m: Map2) => brush.setTransform(s * m.a, s * m.c, s * m.b, s * m.d, s, s)
    const tone = settings.groundTone
    if (grown.size > 0)
      fillCopies(
        brush,
        ground,
        looksOf(ground, grown.keys(), (line) => grown.get(line)!, true),
        tone,
        place,
      )
    for (const [line, draw] of opening)
      fillCopies(
        brush,
        ground,
        looksOf(ground, [line], () => draw, true),
        tone,
        place,
        "evenodd",
      )
  }

  function step(dt: number) {
    const scene = dt * settings.timescale * CLOCK_RATE
    spin += settings.spin * DEG * scene
    growth.advance(scene)
    if (groundOn()) ground.advance(scene)
  }

  function draw() {
    const began = performance.now()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)

    const R = Math.hypot(width, height) / 2
    // The segment's middle points up; spin turns the whole figure.
    const turn = spin - Math.PI / 2
    const ox = (width / 2) * dpr
    const oy = (height / 2) * dpr

    if (groundOn()) {
      paintGround(R)
      const k = (R * dpr) / groundR
      ctx.setTransform(Math.cos(turn) * k, Math.sin(turn) * k, -Math.sin(turn) * k, Math.cos(turn) * k, ox, oy)
      ctx.drawImage(paint, -groundR, -groundR)
    }

    // A line's width is spaced evenly in ratio, not in pixels, between the ends.
    const ratio = settings.widest / settings.width
    const half = (line: Line) =>
      Math.max(MIN_WIDTH, settings.width * ratio ** (line.thick / (WIDTHS - 1)) * (1 - settings.taper) ** line.depth) /
      R /
      2
    const lines = growth.lines()
    const looks = looksOf(growth, lines, (line) => {
      const from = visibleFrom(line)
      return from < line.len ? (path) => outline(path, line, from, half(line), half) : null
    })
    const seen = new Set<number>()
    for (const line of lines)
      if (!line.gone && visibleFrom(line) < line.len) seen.add(Math.round(half(line) * 2 * R * 100) / 100)

    const cs = Math.cos(turn) * R * dpr
    const sn = Math.sin(turn) * R * dpr
    // rotate(turn) · scale(R) · m, as a canvas matrix.
    strokes = fillCopies(ctx, growth, looks, 1, (m) =>
      ctx.setTransform(cs * m.a - sn * m.c, sn * m.a + cs * m.c, cs * m.b - sn * m.d, sn * m.b + cs * m.d, ox, oy),
    )
    widths = [...seen].sort((a, b) => a - b)

    if (debug) {
      ctx.setTransform(cs, sn, -sn, cs, ox, oy)
      const edge = Math.PI / settings.segments
      ctx.strokeStyle = `hsl(${settings.hue} 80% 60% / 60%)`
      ctx.lineWidth = 1 / R
      ctx.beginPath()
      for (const side of [-1, 1]) {
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(side * edge), Math.sin(side * edge))
      }
      ctx.stroke()
      ctx.fillStyle = `hsl(${settings.hue} 90% 65%)`
      for (const index of growth.tips()) {
        const line = lines[index]!
        ctx.beginPath()
        const [x, y] = pointAt(line, line.len)
        ctx.arc(x, y, 3 / R, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    drawMs = drawMs * 0.9 + (performance.now() - began) * 0.1
  }

  const loop = steadyLoop({ clamp: 0.1, step, draw })

  function onResize() {
    size()
    loop.repaint()
  }

  /** Share of the ground's disc painted, read off a small copy of it. */
  function cover() {
    if (groundR === 0) return 0
    const n = 64
    const probe = Object.assign(document.createElement("canvas"), { width: n, height: n })
    const pc = probe.getContext("2d", { willReadFrequently: true })
    if (!pc) return 0
    pc.drawImage(paint, 0, 0, n, n)
    const data = pc.getImageData(0, 0, n, n).data
    let inside = 0
    let lit = 0
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) > n / 2) continue
        inside++
        const i = (y * n + x) * 4
        if (data[i]! + data[i + 1]! + data[i + 2]! > 24) lit++
      }
    return inside > 0 ? lit / inside : 0
  }

  function stats() {
    const round = (v: number, d = 3) => Number(v.toFixed(d))
    const g = groundOn() ? ground.counts() : null
    return {
      ...growth.counts(),
      /** Fills the last frame made: colours × copies. */
      strokes,
      widths,
      drawMs: round(drawMs, 2),
      frame: { width, height },
      fps: Math.round(loop.fps()),
      running: loop.running(),
      held: loop.held(),
      /** The ground's own growth, and the share of its disc painted so far; null with the ground off. */
      ground: g && { births: g.births, lines: g.lines, length: g.length, side: 2 * groundR, cover: round(cover()) },
    }
  }

  size()

  return {
    start() {
      if (loop.running()) return
      window.addEventListener("resize", onResize)
      loop.start()
    },
    stop() {
      loop.stop()
      window.removeEventListener("resize", onResize)
    },
    setSettings(next: Settings) {
      const before = settings
      settings = next
      growth.set(next)
      // The ground starts again, on black, when what it grows changes or it is switched on.
      const regrew = ground.set(groundOf(next))
      if (groundOn() && (regrew || before.ground === 0)) {
        if (!regrew) ground.regrow()
        wipe()
      }
      loop.repaint()
    },
    setPaused(on: boolean) {
      loop.setHeld(on)
    },
    /** Grows `seconds` of scene at once, at 1×, painting the ground as it goes. */
    settle(seconds: number) {
      for (let left = seconds; left > 0; left -= 1) {
        const dt = Math.min(1, left)
        growth.advance(dt)
        if (groundOn()) {
          ground.advance(dt)
          paintGround(Math.hypot(width, height) / 2)
        }
      }
      draw()
    },
    clear() {
      growth.regrow()
      ground.regrow()
      wipe()
      loop.repaint()
    },
    debug(on?: boolean) {
      debug = on ?? !debug
      loop.repaint()
      return debug
    },
    stats,
  }
}
