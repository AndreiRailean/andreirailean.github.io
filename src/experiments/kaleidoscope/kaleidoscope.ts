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
 * A meeting this close to the start of a tip's step is the joint it grew
 * from, not a meeting. Only rounding error away: a tick's step is about
 * 0.001 long, and at 1e-4 one meeting in a dozen fell inside it and was
 * passed through — 3% of `concentric`'s bars crossed their own reflection.
 */
const JOINT = 1e-9
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
 * Most a curved line bends from one straight link to the next. An arc is a
 * chain of straight links mitred end to end, so meetings, cuts and undrawing
 * stay the straight-line code: 3° a link is a smooth curve at any width.
 */
const ARC = 3 * (Math.PI / 180)
/** Shortest link, in half-diagonals, so a tight curl is a few links per tick, not hundreds. */
const MIN_LINK = 0.002
/** Most links a tip runs through in one tick. */
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
  /** Length at which this link gives way to the next one along a curve; Infinity for straight. */
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
  return t
}

/** Where a line's drawn stretch starts: past whatever its family has undrawn. */
const visibleFrom = (line: Line) => (line.family.state === "undraw" ? Math.max(0, line.family.undrawn - line.born) : 0)

/**
 * Where a side of a line, `side` off its middle, crosses a cut, as a length
 * along the line; or null where the cut is too flat to meet it cleanly.
 * `body` is which way the line runs from the cut: +1 from a start, −1 from
 * an end, so a near edge is the edge on the line's own side.
 */
function crossing(line: Line, side: number, cut: Cut, body: 1 | -1, half: (line: Line) => number): number | null {
  const denom = cross(line.dx, line.dy, cut.ux, cut.uy)
  if (Math.abs(denom) < FLATTEST_CUT) return null
  let px = cut.px
  let py = cut.py
  if (cut.on) {
    // Its near edge: moved off its middle toward this line's body.
    const nx = -cut.uy
    const ny = cut.ux
    const toward = Math.sign((nx * line.dx + ny * line.dy) * body) || 1
    const offset = half(cut.on) * toward
    px += nx * offset
    py += ny * offset
  }
  // The side runs from (line.x, line.y) + side · normal, along (dx, dy).
  const sx = line.x - line.dy * side - px
  const sy = line.y + line.dx * side - py
  return -cross(sx, sy, cut.ux, cut.uy) / denom
}

/**
 * Adds a line's outline, from `from` along it to its tip, `w` either side
 * of its middle, each end square or cut as the line records.
 */
function outline(path: Path2D, line: Line, from: number, w: number, half: (line: Line) => number) {
  const { x, y, dx, dy, len } = line
  // Left is +normal, (-dy, dx); right is −normal.
  const at = (t: number, side: number) => [x + dx * t - dy * side, y + dy * t + dx * side] as const
  const limit = 4 * w
  const near = (t: number | null, square: number) => (t === null || Math.abs(t - square) > limit ? square : t)

  // The start, cut only while none of it has been undrawn. A slanted cut puts
  // one corner behind the start point, at a negative length, and it must
  // stay there: squaring it off is the notch the cut exists to close.
  let tailL = from
  let tailR = from
  if (line.tail && from === 0) {
    tailL = near(crossing(line, w, line.tail, 1, half), 0)
    tailR = near(crossing(line, -w, line.tail, 1, half), 0)
  }

  const head = line.alive ? null : line.head
  let headL = len
  let headR = len
  if (head) {
    headL = near(crossing(line, w, head[0]!, -1, half), len)
    headR = near(crossing(line, -w, head[head.length - 1]!, -1, half), len)
  }
  // Neither side ends before it starts.
  headL = Math.max(headL, tailL)
  headR = Math.max(headR, tailR)

  path.moveTo(...at(tailR, -w))
  path.lineTo(...at(tailL, w))
  path.lineTo(...at(headL, w))
  // A split's two cuts meet on its middle at the tip.
  if (head && head.length > 1 && Math.min(headL, headR) < len) path.lineTo(...at(len, 0))
  path.lineTo(...at(headR, -w))
  path.closePath()
}

export function createKaleidoscope(canvas: HTMLCanvasElement, initial: Settings) {
  const ctx = context2d(canvas, "kaleidoscope")

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1

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
  let spin = 0
  let debug = false

  const ended: Record<Ending, number> = { line: 0, family: 0, image: 0, wall: 0, edge: 0, life: 0, split: 0, turn: 0 }
  const decided = { split: 0, turn: 0, straight: 0, capped: 0 }
  let births = 0
  let undrawns = 0
  let compactions = 0
  /** Links curved lines have carried on through. */
  let links = 0
  let drawMs = 0
  let strokes = 0
  /** Distinct widths the last frame stroked, css px. */
  let widths: number[] = []

  const unit = () => Number(settings.angle) * DEG
  const stepLen = () => settings.step / 100

  /** How long a link along a curve runs: `ARC` of bend, or to the end of the corner it is rounding. */
  function linkLength(bend: number, curve: number, aim: number | null) {
    const arc = Math.max(MIN_LINK, ARC / Math.abs(curve))
    return aim === null ? arc : Math.min(arc, (aim - bend) / curve)
  }

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

  function size() {
    ;({ width, height, dpr } = fitCanvas(canvas))
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
      const a = (line.len * i) / steps
      const b = (line.len * (i + 1)) / steps
      file(index, line.x + line.dx * a, line.y + line.dy * a, line.x + line.dx * b, line.y + line.dy * b)
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
      stop: curve === 0 ? Infinity : linkLength(bend, curve, aim),
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
  }

  /**
   * Ends a link where its curve gives way to the next and starts that one at
   * its tip, mitred to it: the same line carrying on, so it keeps its width
   * and its depth, and its next decision falls where it would have. With a
   * new `drift`, the line has decided to bend another way from here.
   */
  function carryOn(index: number, drift?: number): number {
    const line = lines[index]!
    line.alive = false
    line.family.tips--
    links++
    const tipX = line.x + line.dx * line.len
    const tipY = line.y + line.dy * line.len
    const shape = shapeFrom(line, 0, drift ?? line.drift)
    const next = addLine(
      tipX,
      tipY,
      line.base,
      line.k,
      line.family,
      line.depth,
      (dx, dy) => mitre(tipX, tipY, line.dx, line.dy, dx, dy),
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
    births = undrawns = compactions = links = 0
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

  /** The first thing the step from `line`'s tip of length `d` meets, as a fraction of it. */
  function firstMeeting(index: number, d: number): { t: number; why: Ending; other: Line | null; g: number } {
    const line = lines[index]!
    const px = line.x + line.dx * line.len
    const py = line.y + line.dy * line.len
    const rx = line.dx * d
    const ry = line.dy * d
    const joint = JOINT / d
    let best = Infinity
    let why: Ending = "line"
    // What was met: a line and the group element of its copy, or for a wall
    // no line and the wall's side.
    let met: Line | null = null
    let metG = 0
    const G = group.length
    const stops = settings.stops

    const consider = (t: number, kind: Ending, other: Line | null, g: number) => {
      if (t < joint || t >= best) return
      best = t
      why = kind
      met = other
      metG = g
    }

    if (stops !== "none") {
      // Its own copies, grown to where this step takes it.
      const reach = line.len + d
      for (let g = 1; g < G; g++) {
        const m = group[g]!
        const ax = m.a * line.x + m.b * line.y
        const ay = m.c * line.x + m.d * line.y
        const sx = (m.a * line.dx + m.b * line.dy) * reach
        const sy = (m.c * line.dx + m.d * line.dy) * reach
        consider(meet(px, py, rx, ry, ax, ay, sx, sy), "image", line, g)
      }

      query++
      const x0 = Math.floor((Math.min(px, px + rx) + SPAN) / CELL)
      const x1 = Math.floor((Math.max(px, px + rx) + SPAN) / CELL)
      const y0 = Math.floor((Math.min(py, py + ry) + SPAN) / CELL)
      const y1 = Math.floor((Math.max(py, py + ry) + SPAN) / CELL)
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
            const m = group[code - other * G]!
            const sx0 = them.x + them.dx * from
            const sy0 = them.y + them.dy * from
            const ax = m.a * sx0 + m.b * sy0
            const ay = m.c * sx0 + m.d * sy0
            const span = them.len - from
            const sx = (m.a * them.dx + m.b * them.dy) * span
            const sy = (m.c * them.dx + m.d * them.dy) * span
            consider(meet(px, py, rx, ry, ax, ay, sx, sy), own ? "family" : "line", them, code - other * G)
          }
        }
    }

    if (settings.confine === "wedge") {
      const half = Math.PI / settings.segments
      for (const side of [-1, 1]) {
        const wx = Math.cos(side * half) * 2
        const wy = Math.sin(side * half) * 2
        consider(meet(px, py, rx, ry, 0, 0, wx, wy), "wall", null, side)
      }
    }

    return { t: best, why, other: met, g: metG }
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
    const tipX = line.x + line.dx * line.len
    const tipY = line.y + line.dy * line.len

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
        carry ? cutAlong(tipX, tipY, line.dx, line.dy, line) : mitre(tipX, tipY, line.dx, line.dy, dx, dy)
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
        if (settings.curl > 0 && line.axis < 0) carryOn(index, curlFor(line.family))
      } else {
        end(line, "split")
        // Its left half is mitred to the left offshoot, its right to the right.
        const l = lines[left]!
        const r = lines[right]!
        const cuts = [mitre(tipX, tipY, line.dx, line.dy, l.dx, l.dy), mitre(tipX, tipY, line.dx, line.dy, r.dx, r.dy)]
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
        (dx, dy) =>
          spine ? cutAlong(tipX, tipY, line.dx, line.dy, line) : mitre(tipX, tipY, line.dx, line.dy, dx, dy),
        shapeFrom(line, sign, curlFor(line.family)),
      )
      if (spine) line.next += stepLen()
      else {
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
  function headAt(line: Line, tx: number, ty: number, other: Line | null, g: number): Cut[] | null {
    if (!other) {
      const half = Math.PI / settings.segments
      return [cutAlong(0, 0, Math.cos(g * half), Math.sin(g * half))]
    }
    const m = group[g]!
    const ux = m.a * other.dx + m.b * other.dy
    const uy = m.c * other.dx + m.d * other.dy
    if (other === line) {
      // Its own copy: tip to tip when the copy's tip is here too.
      const cx = m.a * tx + m.b * ty
      const cy = m.c * tx + m.d * ty
      if (Math.hypot(cx - tx, cy - ty) < 1e-6) {
        const cut = mitre(tx, ty, line.dx, line.dy, -ux, -uy)
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
      // What is left of this tick's growth, carried from one link of a curve to the next.
      let budget = d0
      for (let hops = 0; ; hops++) {
        const d = Math.min(budget, line.next - line.len, line.stop - line.len)
        if (d > 0) {
          budget -= d
          const fromX = line.x + line.dx * line.len
          const fromY = line.y + line.dy * line.len
          const { t, why, other, g } = firstMeeting(index, d)
          const grown = Number.isFinite(t) ? t * d : d
          line.len += grown
          file(index, fromX, fromY, line.x + line.dx * line.len, line.y + line.dy * line.len)
          const tx = line.x + line.dx * line.len
          const ty = line.y + line.dy * line.len
          if (Number.isFinite(t)) {
            end(line, why)
            line.head = headAt(line, tx, ty, other, g)
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
            line.head = headAt(line, tx, ty, null, Math.sign(ty))
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

  function step(dt: number) {
    const scene = dt * settings.timescale * CLOCK_RATE
    spin += settings.spin * DEG * scene
    advance(scene)
  }

  function draw() {
    const began = performance.now()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)

    const R = Math.hypot(width, height) / 2
    // One path per colour: every line is a filled outline, its width in its
    // shape, so a frame costs (colours × copies) fills, not (lines × copies).
    const looks = new Map<number, Path2D>()
    const { colourBy, taper, life, roots } = settings
    const tinted = settings.tint > 0 && colourBy !== "copy"
    // A line's width is spaced evenly in ratio, not in pixels, between the ends.
    const ratio = settings.widest / settings.width
    const half = (line: Line) =>
      Math.max(MIN_WIDTH, settings.width * ratio ** (line.thick / (WIDTHS - 1)) * (1 - taper) ** line.depth) / R / 2
    const seen = new Set<number>()
    for (const line of lines) {
      if (line.gone) continue
      const from = visibleFrom(line)
      if (from >= line.len) continue
      const shade = !tinted
        ? 0
        : colourBy === "depth"
          ? line.depth
          : colourBy === "family"
            ? line.family.slot
            : Math.min(SHADES - 1, Math.floor(((now - line.t) / AGE_SPAN) * SHADES))
      let path = looks.get(shade)
      if (!path) looks.set(shade, (path = new Path2D()))
      const w = half(line)
      seen.add(Math.round(w * 2 * R * 100) / 100)
      outline(path, line, from, w, half)
    }

    const shadeOf = (shade: number) =>
      colourBy === "depth"
        ? shade / Math.max(1, life - 1)
        : colourBy === "family"
          ? shade / Math.max(1, roots)
          : shade / SHADES
    const colour = (at: number) =>
      settings.tint > 0
        ? `hsl(${settings.hue + settings.hues * at} ${Math.round(settings.tint * 92)}% ${Math.round(100 - settings.tint * 42)}%)`
        : "#fff"

    // The segment's middle points up; spin turns the whole figure.
    const turn = spin - Math.PI / 2
    const cs = Math.cos(turn) * R * dpr
    const sn = Math.sin(turn) * R * dpr
    const ox = (width / 2) * dpr
    const oy = (height / 2) * dpr
    const entries = [...looks]
    const colours = entries.map(([shade]) => colour(shadeOf(shade)))
    for (let g = 0; g < group.length; g++) {
      const m = group[g]!
      // rotate(turn) · scale(R) · m, as a canvas matrix.
      ctx.setTransform(cs * m.a - sn * m.c, sn * m.a + cs * m.c, cs * m.b - sn * m.d, sn * m.b + cs * m.d, ox, oy)
      const copy = colourBy === "copy" ? colour(g / group.length) : ""
      for (let i = 0; i < entries.length; i++) {
        ctx.fillStyle = copy || colours[i]!
        ctx.fill(entries[i]![1])
      }
    }
    strokes = entries.length * group.length
    widths = [...seen].sort((a, b) => a - b)

    if (debug) {
      ctx.setTransform(cs, sn, -sn, cs, ox, oy)
      const half = Math.PI / settings.segments
      ctx.strokeStyle = `hsl(${settings.hue} 80% 60% / 60%)`
      ctx.lineWidth = 1 / R
      ctx.beginPath()
      for (const side of [-1, 1]) {
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(side * half), Math.sin(side * half))
      }
      ctx.stroke()
      ctx.fillStyle = `hsl(${settings.hue} 90% 65%)`
      for (const index of tips) {
        const line = lines[index]!
        ctx.beginPath()
        ctx.arc(line.x + line.dx * line.len, line.y + line.dy * line.len, 3 / R, 0, Math.PI * 2)
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

  /** What the growth actually did, counted off the lines rather than read off settings. */
  function stats() {
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
      if ((line.x + line.dx * mid) * line.dx + (line.y + line.dy * mid) * line.dy < 0) inward += drawn
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
      /** Fills the last frame made: colours × copies. */
      strokes,
      widths,
      decided: { ...decided },
      /** Links curved lines have carried on through since the drawing began. */
      links,
      ended: { ...ended },
      drawMs: round(drawMs, 2),
      frame: { width, height },
      fps: Math.round(loop.fps()),
      running: loop.running(),
      held: loop.held(),
    }
  }

  size()
  regrow()

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
      if (needsRegrow(before, next)) regrow()
      loop.repaint()
    },
    setPaused(on: boolean) {
      loop.setHeld(on)
    },
    /** Grows `seconds` of scene at once, at 1×. */
    settle(seconds: number) {
      advance(seconds)
      draw()
    },
    clear() {
      regrow()
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
