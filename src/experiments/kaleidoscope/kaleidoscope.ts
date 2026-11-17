/**
 * The scene: lines grown in one segment, drawn once per image of a symmetry group.
 *
 * **Only one segment is grown.** Segment 0 has its middle along +x in the
 * scene's own coordinates, which are fractions of the frame's half-diagonal
 * about its centre. The group is the N rotations by a whole segment, plus, for
 * `mirror`, the N reflections about the segment middles and edges — the
 * dihedral group, which is what a kaleidoscope's two mirrors make. Every line
 * is stored once and drawn once per group element, so a frame strokes the
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
/** A meeting this close to the start of a tip's step is the joint it grew from, not a meeting. */
const JOINT = 1e-4
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
/** Thinnest a tapered line gets, css px. */
const MIN_WIDTH = 0.2
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
  state: "wait" | "grow" | "hold" | "undraw"
  /** How far this family has grown since its birth. */
  clock: number
  /** Seconds left to wait, or seconds held. */
  timer: number
  undrawn: number
  tips: number
}

type Line = {
  x: number
  y: number
  dx: number
  dy: number
  /** The direction the family's turns count from, radians off the segment's middle. */
  base: number
  /** Direction as a whole number of angles off `base`. */
  k: number
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
  alive: boolean
  /** Undrawn whole, waiting for the next compaction to drop it. */
  gone: boolean
  /** Index of a reflection that maps the line onto itself, or -1. */
  axis: number
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
  let drawMs = 0
  let strokes = 0

  const unit = () => Number(settings.angle) * DEG
  const stepLen = () => settings.step / 100

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

  function addLine(x: number, y: number, base: number, k: number, family: Family, depth: number): number {
    const angle = base + k * unit()
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const index = lines.length
    lines.push({
      x,
      y,
      dx,
      dy,
      base,
      k,
      len: 0,
      next: stepLen(),
      born: family.clock,
      t: now,
      family,
      depth,
      alive: true,
      gone: false,
      axis: axisOf(x, y, dx, dy),
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

  /** The largest whole number of angles a line may run off the middle and still grow outward. */
  const outward = () => Math.max(0, Math.floor((89.9 * DEG) / unit()))

  /** Plants a family's root: at or near the centre, or on a side of the segment. */
  function birth(family: Family) {
    family.births++
    family.id = nextId++
    family.rng = makeRng(hashSeed(settings.seed, family.slot, family.births))
    family.state = "grow"
    family.clock = 0
    family.undrawn = 0
    family.timer = 0
    family.tips = 0
    births++
    const rng = family.rng
    const half = Math.PI / settings.segments
    const mirror = settings.symmetry === "mirror"

    if (settings.from === "sides") {
      // Mirror grows half a segment, whose outer side is the edge at +half;
      // the other side is the middle, where the reflection takes over.
      const side = mirror || rng() < 0.5 ? 1 : -1
      const r = 0.02 + 0.98 * rng()
      const wall = side * half
      // Square off the side, pointing into the segment, leaned as asked.
      const base = wall - side * (Math.PI / 2) + side * settings.lean * DEG
      addLine(r * Math.cos(wall), r * Math.sin(wall), base, 0, family, 0)
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
    }
    addLine(x, y, settings.lean * DEG, k, family, 0)
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
    births = undrawns = compactions = 0
    for (const key of Object.keys(ended) as Ending[]) ended[key] = 0
    decided.split = decided.turn = decided.straight = decided.capped = 0
    const each = settings.cycle === "each"
    const stagger = makeRng(hashSeed(settings.seed, 0x57a6))
    families = Array.from({ length: settings.roots }, (_, slot) => ({
      id: -1,
      slot,
      births: 0,
      rng: stagger,
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
  function firstMeeting(index: number, d: number): { t: number; why: Ending } {
    const line = lines[index]!
    const px = line.x + line.dx * line.len
    const py = line.y + line.dy * line.len
    const rx = line.dx * d
    const ry = line.dy * d
    const joint = JOINT / d
    let best = Infinity
    let why: Ending = "line"
    const G = group.length
    const stops = settings.stops

    const consider = (t: number, kind: Ending) => {
      if (t < joint || t >= best) return
      best = t
      why = kind
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
        consider(meet(px, py, rx, ry, ax, ay, sx, sy), "image")
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
            consider(meet(px, py, rx, ry, ax, ay, sx, sy), own ? "family" : "line")
          }
        }
    }

    if (settings.confine === "wedge") {
      const half = Math.PI / settings.segments
      for (const side of [-1, 1]) {
        const wx = Math.cos(side * half) * 2
        const wy = Math.sin(side * half) * 2
        consider(meet(px, py, rx, ry, 0, 0, wx, wy), "wall")
      }
    }

    return { t: best, why }
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
      addLine(tipX, tipY, line.base, line.k + 1, line.family, line.depth)
      // On a mirror, the other offshoot is the first one's reflection.
      if (line.axis < 0) addLine(tipX, tipY, line.base, line.k - 1, line.family, line.depth)
      if (carry) line.next += stepLen()
      else end(line, "split")
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
      addLine(tipX, tipY, line.base, line.k + sign, line.family, line.depth)
      if (line.axis >= 0) line.next += stepLen()
      else end(line, "turn")
      return
    }
    decided.straight++
    line.next += stepLen()
  }

  function grow(d0: number) {
    const growing = tips
    tips = []
    for (const index of growing) {
      const line = lines[index]!
      if (!line.alive) continue
      const d = Math.min(d0, line.next - line.len)
      if (d > 0) {
        const fromX = line.x + line.dx * line.len
        const fromY = line.y + line.dy * line.len
        const { t, why } = firstMeeting(index, d)
        const grown = Number.isFinite(t) ? t * d : d
        line.len += grown
        file(index, fromX, fromY, line.x + line.dx * line.len, line.y + line.dy * line.len)
        if (Number.isFinite(t)) {
          end(line, why)
          continue
        }
        const tx = line.x + line.dx * line.len
        const ty = line.y + line.dy * line.len
        if (tx * tx + ty * ty > EDGE * EDGE) {
          end(line, "edge")
          continue
        }
        // A line that set off outside its segment from a point on an edge —
        // a root at the centre, aimed wider than the segment — crosses no
        // wall the meeting test can see, because it starts on both.
        if (settings.confine === "wedge" && Math.abs(Math.atan2(ty, tx)) > Math.PI / settings.segments + 1e-9) {
          end(line, "wall")
          continue
        }
      }
      if (line.len >= line.next - 1e-12) decide(index)
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
    // One path per look: lines sharing a colour and a width share a stroke,
    // so a frame costs (looks × copies) strokes, not (lines × copies).
    const looks = new Map<number, Path2D>()
    const { colourBy, taper, life, roots } = settings
    const tinted = settings.tint > 0 && colourBy !== "copy"
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
      const key = shade * 256 + (taper > 0 ? Math.min(255, line.depth) : 0)
      let path = looks.get(key)
      if (!path) looks.set(key, (path = new Path2D()))
      path.moveTo(line.x + line.dx * from, line.y + line.dy * from)
      path.lineTo(line.x + line.dx * line.len, line.y + line.dy * line.len)
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
    ctx.lineCap = "round"
    const entries = [...looks]
    const styles = entries.map(([key]) => ({
      colour: colour(shadeOf(Math.floor(key / 256))),
      width: Math.max(MIN_WIDTH, settings.width * (1 - taper) ** (key % 256)) / R,
    }))
    for (let g = 0; g < group.length; g++) {
      const m = group[g]!
      // rotate(turn) · scale(R) · m, as a canvas matrix.
      ctx.setTransform(cs * m.a - sn * m.c, sn * m.a + cs * m.c, cs * m.b - sn * m.d, sn * m.b + cs * m.d, ox, oy)
      const copy = colourBy === "copy" ? colour(g / group.length) : ""
      for (let i = 0; i < entries.length; i++) {
        ctx.strokeStyle = copy || styles[i]!.colour
        ctx.lineWidth = styles[i]!.width
        ctx.stroke(entries[i]![1])
      }
    }
    strokes = entries.length * group.length

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
    for (const line of lines) {
      if (line.gone) continue
      standing++
      length += line.len - visibleFrom(line)
      deepest = Math.max(deepest, line.depth)
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
      images: group.length,
      /** Strokes the last frame made: looks × copies. */
      strokes,
      decided: { ...decided },
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
