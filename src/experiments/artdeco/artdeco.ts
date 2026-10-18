/**
 * Lines that grow up from the bottom and decide as they go, mirrored about the
 * centre line.
 *
 * **Only the right half is grown.** A line on the centre line is grown once and
 * drawn once; every other line is grown on the right and drawn twice, the
 * second time reflected. So the picture is symmetric by construction, and a
 * line meeting its own mirror image is a line crossing the centre line.
 *
 * **Directions are whole multiples of one angle off vertical**, held as an
 * integer index rather than a float, so two lines that turned the same number
 * of times are exactly parallel however far apart they are — which is where
 * the parallels the seed asks for come from.
 *
 * **Decisions belong to families, not to lines.** A family is a lazily drawn
 * sequence of decisions, and every line in it takes its n-th decision from
 * entry n. The stems are one family, and the offshoots of one echo are one, so
 * they turn as one and stay parallel. The two lines a split makes are one
 * family with opposite `hand`, so they are mirror images about their parent as
 * well as about the frame.
 *
 * **Time is kept in distance.** Every tip grows at the same speed, so a tree's
 * clock `D` is how far a tip has grown, and a segment's `born` is the `D` at
 * which its first pixel appeared. A tail erasing the drawing is then just a
 * second clock running `delay` behind the first, and changing the speed
 * mid-drawing moves both together.
 *
 * **Symmetry is a group, not a mirror.** `fold` n gives the 2n rotations and
 * reflections of the dihedral group about the frame's centre: 1 is the left
 * and right mirror, 2 adds top and bottom, 3 is a kaleidoscope of threes. Only
 * the stems from the bottom are grown; every segment and every circle is drawn
 * once per image, and a tip meets the images of every line, its own included.
 *
 * **Busyness dissolves lines.** A crossing in a crowded place can start the
 * line it crosses dissolving from that point, both ways along it at the speed
 * lines grow, and where the dissolving reaches a joint (a turn, a split, a
 * meeting) it decides by `contagion` whether to carry on into the line there.
 *
 * **Two pens.** With the line pen, stopping ends a line. With the tips pen,
 * stopping only lifts the pen: the tip flies on, turning and splitting over a
 * segment that is never stored (id -1, a "ghost"), until a `land` puts the pen
 * down again. A lifted tip meets nothing and marks nothing.
 *
 * **Circles keep the same clock.** One draws itself up both sides from its
 * lowest point, as far round as the clock has run since it was placed, so a
 * circle of radius r takes πr to close — the distance a tip covers in that
 * time — and the tail erases it in the same order.
 */

import { context2d, fitCanvas } from "@/experiments/simulation/canvas"
import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { distance, enter, inside, outline, type Point, type Shape } from "@/experiments/artdeco/frame"
import { needsRebuild, type Mark, type Settings } from "@/experiments/artdeco/settings"

type Kind = "straight" | "branch" | "fork" | "turn" | "echo" | "stop"
const KINDS: Kind[] = ["straight", "branch", "fork", "turn", "echo", "stop"]

/**
 * One decision, and the uniforms everything else about that stretch is read
 * from. `meet` chooses what the line does at a meeting before the decision,
 * `corner` whether the decision's corner gets a circle, `along` and `at`
 * whether and where a circle lands on the stretch, `size` its radius. They come
 * from their own stream, so adding them moved no drawing an older seed made.
 */
type Token = {
  kind: Kind
  sign: 1 | -1
  meet: number
  corner: number
  along: number
  at: number
  size: number
  /** The next decision repeats this one, `beat` rather than a step later. */
  again: boolean
  /** This one is the second or third of three. */
  copy: boolean
  /** Below `rise`, a turn leans back towards upright. */
  lean: number
  /** Below `hush` times how crowded it is, the line stops here instead. */
  quiet: number
  /** Below `land`, a lifted tip puts the pen down here. */
  land: number
}

/** `threes` decides which decisions repeat; its own stream, so at `thrice` 0 nothing moved. */
type Family = {
  rng: Rng
  marks: Rng
  threes: Rng
  leans: Rng
  quiets: Rng
  lands: Rng
  tokens: Token[]
  first: boolean
}

type Choice = "stop" | "cross" | "rebound"

type Circle = { x: number; y: number; size: number; born: number; gen: number; axis: boolean }

/** `rot` and `rotAt` as on a segment, in arc length from its lowest point; the gap opens on every image alike. */
type Halo = { x: number; y: number; r: number; rot: number; rotAt: number }

/** One image under the symmetry: a linear map about the frame's centre, `turn` its rotation in radians. */
type Xf = { xx: number; xy: number; yx: number; yy: number; flip: boolean; turn: number; ox: number; oy: number }

type Seg = {
  id: number
  x0: number
  y0: number
  d: number
  len: number
  born: number
  gen: number
  /** On the centre line: drawn once, never mirrored. */
  axis: boolean
  /** The segment this one carries on from at a turn or rebound, and the one carrying on from it; -1 for none. */
  prev: number
  next: number
  /** Where on it dissolving began, and the tree's `D` then; NaN while whole. */
  rot: number
  rotAt: number
  /** Where other segments join it, for dissolving to pass along. */
  joints: Joint[]
  /** Dissolving has passed its start, or its end, on to `prev` or `next`. */
  passed: number
}

/** A place where segment `other`, at `ou` along it, touches this one at `u` along. */
type Joint = { u: number; other: number; ou: number; done: boolean }

type Echo = { left: number; toNext: number; side: 1 | -1; family: Family }

type Head = {
  seg: Seg
  /** The tips pen is up: `seg` is a ghost, drawn and met by nothing. */
  lifted: boolean
  /** Decisions made since the pen last lifted; past `flight` the tip dies. */
  flown: number
  family: Family
  n: number
  hand: 1 | -1
  depth: number
  toDecision: number
  /** Distance between this line's decisions; shrinks a generation at a time. */
  stepLen: number
  echo: Echo | null
  /** Distance to the circle this stretch drops, or Infinity. */
  bead: number
  /** The segment last crossed, so it is not met again from the point of crossing; mirrored ones as `-(id + 1)`. */
  past: number
  budget: number
}

/** `out` is the direction a rebound leaves in, or null when there is none on the angle. */
type Hit = {
  t: number
  kind: "line" | "mirror" | "axis" | "halo"
  out: number | null
  id: number
  /** The segment met and how far along it, or -1 for the axis and the big circle. */
  seg: number
  ou: number
}

type Tree = {
  cycle: number
  segs: Seg[]
  heads: Head[]
  cells: Map<number, number[]>
  /** Segments dissolving, until the gap has passed everything joined to them. */
  rotting: Seg[]
  /**
   * Tips alive, counting those born this step: `heads` is emptied while a step
   * runs, so its length cannot cap them, and once did not, at 4911 tips.
   */
  live: number
  circles: Circle[]
  halo: Halo | null
  D: number
  /** `D` the tail runs behind by; Infinity until something starts erasing. */
  delay: number
  /** `D` when the last tip stopped, or -1 while growing. */
  grown: number
  holdLeft: number
  families: number
  root: Family
}

export type Stats = {
  frame: { width: number; height: number }
  cycle: number
  trees: number
  phase: "growing" | "holding" | "undrawing" | "resting"
  tips: number
  segments: number
  families: number
  decisions: Record<Kind, number>
  meetings: {
    line: number
    mirror: number
    axis: number
    halo: number
    edge: number
    frame: number
    depth: number
    cap: number
  }
  /** What the lines chose at those meetings. */
  chose: Record<Choice, number>
  rebounds: number
  offshoots: number
  /** Circles placed at corners and along lines, and those left out for shyness. */
  circles: { corner: number; along: number; shied: number; framed: number }
  /** Decisions taken as the second or third of three. */
  repeated: number
  /** Tips pen: times a pen lifted and landed, and tips flying lifted now. */
  pen: { lifts: number; lands: number; grounded: number; flocked: number; flying: number }
  /** Lines stopped by crowding, lines set dissolving, and dissolving passed on at a joint or turn. */
  busy: { hushed: number; dissolved: number; passedOn: number }
  /** Drawings with a big circle still showing, and how many of those are dissolving. */
  halos: { drawn: number; dissolving: number }
  /** Turns that `rise` held upright or turned back towards upright. */
  leaned: number
  dropped: number
  fps: number
}

const CELL = 24
const MAX_SEGS = 6000
const MAX_HEADS = 1200
const EPS = 1e-6
/** A hit this close to the start of the tip's own segment is where it was born, not a meeting. */
const ORIGIN = 0.75
const REST = 1
const FLOCK_OFF = 1200
/** The one step growth is ever taken in, in seconds; see `tick`. */
const TICK = 1 / 60

const emptyDecisions = (): Record<Kind, number> => ({ straight: 0, branch: 0, fork: 0, turn: 0, echo: 0, stop: 0 })
const emptyMeetings = () => ({ line: 0, mirror: 0, axis: 0, halo: 0, edge: 0, frame: 0, depth: 0, cap: 0 })
const emptyChoices = (): Record<Choice, number> => ({ stop: 0, cross: 0, rebound: 0 })

export function createArtdeco(canvas: HTMLCanvasElement, initial: Settings) {
  const context = context2d(canvas, "artdeco")
  const ctx = context

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1
  let trees: Tree[] = []
  let cycle = 0
  let restLeft = 0
  let held = false
  let running = false
  let frame = 0
  let last = 0
  let debug = false
  let fps = 0
  /** Seconds of growth the frames have run up and the ticks not yet taken. */
  let owed = 0
  let decisions = emptyDecisions()
  let meetings = emptyMeetings()
  let chose = emptyChoices()
  let rebounds = 0
  let offshoots = 0
  let circles = { corner: 0, along: 0, shied: 0, framed: 0 }
  let repeated = 0
  let lifts = 0
  let flocked = 0
  /** Lifted tips born this step, which `heads` does not hold until the step ends. */
  let flyingBorn = 0
  let flyingAtStart = 0
  let grounded = 0
  let lands = 0
  let hushed = 0
  let dissolved = 0
  let passedOn = 0
  let leaned = 0
  let dropped = 0
  let stamp = 0
  let seen = new Uint32Array(MAX_SEGS + 1)

  const unit = () => Number(settings.angle)
  const turns = () => Math.round(360 / unit())
  const wrap = (d: number) => ((d % turns()) + turns()) % turns()
  const dx = (d: number) => Math.sin((d * unit() * Math.PI) / 180)
  const dy = (d: number) => -Math.cos((d * unit() * Math.PI) / 180)
  const px = (share: number) => (share * height) / 100
  const speed = () => px(settings.speed)
  const stepPx = () => px(settings.step)
  const centre = () => width / 2
  const middle = () => height / 2

  const ownSides = () => settings.fold === "4" && settings.sides === "own"

  let images: Xf[] = []
  let imagesFor = ""
  /** The dihedral group of order 2n; index 0 is the identity and index 1 the left-right mirror. */
  function group(): Xf[] {
    const key = `${settings.fold} ${settings.reach} ${settings.sides} ${width} ${height}`
    if (imagesFor === key) return images
    // Sides of their own: four is two folds, top and bottom and left and right,
    // and the side stems are grown rather than turned copies of the bottom ones.
    const n = ownSides() ? 2 : Number(settings.fold)
    images = []
    for (let k = 0; k < n; k++) {
      const turn = (2 * Math.PI * k) / n
      const c = Math.cos(turn)
      const sn = Math.sin(turn)
      // Edges: each copy slides out along its stem until the stem starts at the
      // frame's edge, as the bottom one does, rather than on a circle of the height.
      const ux = -sn
      const uy = c
      const edge = Math.min(
        Math.abs(ux) > EPS ? width / 2 / Math.abs(ux) : Infinity,
        Math.abs(uy) > EPS ? height / 2 / Math.abs(uy) : Infinity,
      )
      const push = settings.reach === "edges" && !ownSides() ? edge - height / 2 : 0
      const ox = ux * push
      const oy = uy * push
      images.push({ xx: c, xy: -sn, yx: sn, yy: c, flip: false, turn, ox, oy })
      images.push({ xx: -c, xy: -sn, yx: -sn, yy: c, flip: true, turn, ox, oy })
    }
    imagesFor = key
    return images
  }

  /** `slide` false leaves out the shift `reach: "edges"` gives a copy, for the big circle. */
  function image(f: Xf, x: number, y: number, slide = true): [number, number] {
    const ox = x - centre()
    const oy = y - middle()
    const sx = slide ? f.ox : 0
    const sy = slide ? f.oy : 0
    return [centre() + f.xx * ox + f.xy * oy + sx, middle() + f.yx * ox + f.yy * oy + sy]
  }

  /** The inverse image: every map here is orthonormal, so its inverse is its transpose. */
  function unimage(f: Xf, x: number, y: number): [number, number] {
    const ox = x - centre() - f.ox
    const oy = y - middle() - f.oy
    return [centre() + f.xx * ox + f.yx * oy, middle() + f.xy * ox + f.yy * oy]
  }

  /**
   * The direction on the angle nearest to direction `d` reflected off a line
   * running along (ux, uy), or null if none of the nearest three leaves on the
   * far side of where it came from. Exact when the line is on the angle.
   */
  function reflectOff(d: number, ux: number, uy: number): number | null {
    const l = Math.hypot(ux, uy)
    if (l < EPS) return null
    ux /= l
    uy /= l
    const vx = dx(d)
    const vy = dy(d)
    const dot = vx * ux + vy * uy
    const nx = -uy
    const ny = ux
    return snap(2 * dot * ux - vx, 2 * dot * uy - vy, nx, ny, vx * nx + vy * ny < 0 ? 1 : -1)
  }

  /** The direction on the angle nearest (rx, ry) whose component along (nx, ny) has the sign `side`. */
  function snap(rx: number, ry: number, nx: number, ny: number, side: number): number | null {
    const k = Math.round(Math.atan2(rx, -ry) / ((unit() * Math.PI) / 180))
    for (const c of [k, k + 1, k - 1]) if ((dx(c) * nx + dy(c) * ny) * side > 0.05) return c
    return null
  }
  const inset = () => px(settings.margin)

  let holeKey = ""
  let holePoly: Point[] | null = null
  /** The empty middle a frame leaves, as an outline about the centre, or null with no frame. See `frame.ts`. */
  function hole(): Point[] | null {
    const key = [
      settings.frame,
      settings.frameShape,
      settings.frameCorner,
      settings.frameCornerSize,
      settings.frameSteps,
      settings.insets,
      settings.insetDepth,
      settings.insetShape,
      width,
      height,
    ].join(" ")
    if (key === holeKey) return holePoly
    holeKey = key
    const band = px(settings.frame)
    holePoly =
      settings.frame > 0 && width / 2 - band > 1 && height / 2 - band > 1
        ? outline(shapeAt(band), centre(), middle())
        : null
    return holePoly
  }

  /** The middle's shape, as the settings describe it, for a band `band` px wide. */
  function shapeAt(band: number): Shape {
    return {
      hx: width / 2 - band,
      hy: height / 2 - band,
      oval: settings.frameShape === "oval",
      corner: settings.frameCorner,
      cornerSize: px(settings.frameCornerSize),
      steps: settings.frameSteps,
      insets: settings.insets,
      insetDepth: px(settings.insetDepth),
      insetShape: settings.insetShape,
    }
  }

  /**
   * How far a tip at (ax, ay) heading along (tx, ty) goes before any image of
   * it enters the empty middle, and the direction of the edge it meets there,
   * turned back into the grown copy; null if none does. The middle is mirrored
   * both ways but a turned copy does not map it onto itself, so each image is
   * tested rather than the grown copy alone.
   */
  function toHole(ax: number, ay: number, tx: number, ty: number): { t: number; ux: number; uy: number } | null {
    const poly = hole()
    if (!poly) return null
    let best: { t: number; ux: number; uy: number } | null = null
    for (const f of group()) {
      const [ix, iy] = image(f, ax, ay)
      const hit = enter(poly, ix, iy, f.xx * tx + f.xy * ty, f.yx * tx + f.yy * ty)
      if (hit && (!best || hit.t < best.t))
        best = { t: hit.t, ux: f.xx * hit.ux + f.yx * hit.uy, uy: f.xy * hit.ux + f.yy * hit.uy }
    }
    return best
  }

  /** Whether a circle, or any image of it, reaches into the empty middle. */
  function inHole(x: number, y: number, r: number, axis: boolean, slide = true): boolean {
    const poly = hole()
    if (!poly) return false
    // As drawn: the outermost strand, and the stroke's width.
    r += ((Math.round(settings.strands) - 1) / 2) * settings.spacing + settings.width
    for (const f of group()) {
      if (axis && f.flip) continue
      const [ix, iy] = image(f, x, y, slide)
      if (inside(poly, ix, iy) || distance(poly, ix, iy) < r) return true
    }
    return false
  }

  /** A tip at the empty middle's edge: it stops, or rebounds off it. Returns false when the tip stops. */
  function atHole(tree: Tree, head: Head, ux: number, uy: number, at: number): boolean {
    meetings.frame += 1
    // A flying tip has nothing to stop; it rebounds, so it never lands in the middle.
    if (settings.atFrame === "stop" && !head.lifted) return lift(head, at)
    return atWall(tree, head, ux, uy, at)
  }

  /** Rebounds off a wall running along (ux, uy): the middle's edge, or the screen's. False when the tip stops. */
  function atWall(tree: Tree, head: Head, ux: number, uy: number, at: number): boolean {
    const out = reflectOff(head.seg.d, ux, uy)
    if (out === null) return lift(head, at)
    if (head.depth >= settings.depth) {
      meetings.depth += 1
      return false
    }
    head.depth += 1
    rebounds += 1
    if (head.seg.axis) {
      // Alone on the centre line it cannot turn; it rebounds as a pair, as off a line.
      const [x, y] = headPoint(head.seg)
      const d = dx(out) > EPS ? out : dx(out) < -EPS ? -out : out + rightward(out)
      spawn(tree, head, d, 1, family(tree), x, y, at)
      return lift(head, at)
    }
    return bend(tree, head, out, at)
  }

  function family(tree: Tree): Family {
    if (settings.unison === "all" && tree.families > 0) return tree.root
    const salt = settings.vary === "new" ? tree.cycle : 0
    tree.families += 1
    return {
      rng: makeRng(hashSeed(settings.seed, salt, tree.families)),
      marks: makeRng(hashSeed(settings.seed, salt, tree.families, 7)),
      threes: makeRng(hashSeed(settings.seed, salt, tree.families, 11)),
      leans: makeRng(hashSeed(settings.seed, salt, tree.families, 17)),
      quiets: makeRng(hashSeed(settings.seed, salt, tree.families, 19)),
      lands: makeRng(hashSeed(settings.seed, salt, tree.families, 41)),
      tokens: [],
      first: tree.families === 1,
    }
  }

  function token(f: Family, n: number): Token {
    const weights = KINDS.map((k) => settings[k])
    const total = weights.reduce((a, b) => a + b, 0)
    while (f.tokens.length <= n) {
      let kind: Kind = "straight"
      if (total > 0) {
        // The root's first decision is never a stop, or a drawing can be empty.
        const avoidStop = f.first && f.tokens.length === 0 && total > settings.stop
        const pool = avoidStop ? total - settings.stop : total
        let r = f.rng() * pool
        for (let i = 0; i < KINDS.length; i++) {
          if (avoidStop && KINDS[i] === "stop") continue
          r -= weights[i]!
          if (r < 0) {
            kind = KINDS[i]!
            break
          }
        }
      } else f.rng()
      const m = f.marks
      const tk: Token = {
        kind,
        sign: f.rng() < 0.5 ? -1 : 1,
        meet: m(),
        corner: m(),
        along: m(),
        at: m(),
        size: m(),
        again: false,
        copy: false,
        lean: f.leans(),
        quiet: f.quiets(),
        land: f.lands(),
      }
      f.tokens.push(tk)
      // The rule of threes: some decisions are made three times running, a beat apart.
      if (settings.thrice > 0 && repeats(kind) && f.threes() < settings.thrice) {
        tk.again = true
        f.tokens.push({ ...tk, meet: m(), corner: m(), along: m(), at: m(), size: m(), again: true, copy: true })
        f.tokens.push({ ...tk, meet: m(), corner: m(), along: m(), at: m(), size: m(), again: false, copy: true })
      }
    }
    return f.tokens[n]!
  }

  function repeats(kind: Kind): boolean {
    if (kind === "straight" || kind === "stop") return false
    return settings.thriceOf === "any" || settings.thriceOf === kind
  }

  /** How far a line in direction `d` grows before deciding: longer upright, by `rise`. */
  function stretch(d: number, stepLen: number): number {
    return stepLen * (1 + 3 * settings.rise * Math.abs(dy(d)) ** 4)
  }

  function headPoint(seg: Seg): [number, number] {
    return [seg.x0 + dx(seg.d) * seg.len, seg.y0 + dy(seg.d) * seg.len]
  }

  const key = (cx: number, cy: number) => (cx + 1024) * 4096 + (cy + 1024)

  function register(tree: Tree, seg: Seg, from: number, to: number) {
    const ux = dx(seg.d)
    const uy = dy(seg.d)
    for (let l = from; ; l = Math.min(to, l + CELL / 2)) {
      const k = key(Math.floor((seg.x0 + ux * l) / CELL), Math.floor((seg.y0 + uy * l) / CELL))
      let list = tree.cells.get(k)
      if (!list) tree.cells.set(k, (list = []))
      if (list[list.length - 1] !== seg.id) list.push(seg.id)
      if (l >= to) break
    }
  }

  /** A segment a lifted tip flies along: never stored, registered, drawn or met. */
  function ghost(x0: number, y0: number, d: number, gen: number, born: number, axis: boolean): Seg {
    return {
      id: -1,
      x0,
      y0,
      d: wrap(d),
      len: 0,
      born,
      gen,
      axis,
      prev: -1,
      next: -1,
      rot: NaN,
      rotAt: 0,
      joints: [],
      passed: 0,
    }
  }

  /**
   * Stopping: the line pen ends the tip (false); the tips pen lifts it and it
   * flies on (true).
   */
  function lift(head: Head, at: number): boolean {
    if (settings.pen !== "tips") return false
    if (!head.lifted) {
      // The flock is full: this one ends instead of joining it.
      if (flockFull()) {
        flocked += 1
        return false
      }
      lifts += 1
      flyingBorn += 1
      head.flown = 0
    }
    const [x, y] = headPoint(head.seg)
    head.seg = ghost(x, y, head.seg.d, head.seg.gen, at, head.seg.axis)
    head.lifted = true
    head.past = -1
    return true
  }

  function newSeg(tree: Tree, x0: number, y0: number, d: number, gen: number, born: number, axis: boolean): Seg | null {
    if (tree.segs.length >= MAX_SEGS) {
      dropped += 1
      return null
    }
    const seg: Seg = {
      id: tree.segs.length,
      x0,
      y0,
      d: wrap(d),
      len: 0,
      born,
      gen,
      axis,
      prev: -1,
      next: -1,
      rot: NaN,
      rotAt: 0,
      joints: [],
      passed: 0,
    }
    tree.segs.push(seg)
    register(tree, seg, 0, 0)
    return seg
  }

  function cross(ax: number, ay: number, bx: number, by: number) {
    return ax * by - ay * bx
  }

  /** Earliest meeting along A→B, as a share of it, or null. */
  function firstHit(tree: Tree, head: Head, ax: number, ay: number, bx: number, by: number): Hit | null {
    const seg = head.seg
    let best: Hit | null = null
    const consider = (hit: Hit) => {
      if (!best || hit.t < best.t) best = hit
    }

    const test = (px0: number, py0: number, px1: number, py1: number, which: number, f: Xf) => {
      stamp += 1
      if (stamp === 0xffffffff) {
        seen.fill(0)
        stamp = 1
      }
      const rx = px1 - px0
      const ry = py1 - py0
      const length = Math.hypot(rx, ry)
      const samples = Math.max(1, Math.ceil(length / (CELL / 2)))
      for (let i = 0; i <= samples; i++) {
        const sx = Math.floor((px0 + (rx * i) / samples) / CELL)
        const sy = Math.floor((py0 + (ry * i) / samples) / CELL)
        for (let ox = -1; ox <= 1; ox++)
          for (let oy = -1; oy <= 1; oy++) {
            const list = tree.cells.get(key(sx + ox, sy + oy))
            if (!list) continue
            for (const id of list) {
              if (seen[id] === stamp) continue
              seen[id] = stamp
              const tag = which === 0 ? id : -(which * (MAX_SEGS + 1) + id + 1)
              if ((which === 0 && id === seg.id) || head.past === tag) continue
              const other = tree.segs[id]!
              if (other.len <= EPS) continue
              const sxv = dx(other.d) * other.len
              const syv = dy(other.d) * other.len
              const denom = cross(rx, ry, sxv, syv)
              if (Math.abs(denom) < 1e-9) continue
              const qx = other.x0 - px0
              const qy = other.y0 - py0
              const t = cross(qx, qy, sxv, syv) / denom
              const u = cross(qx, qy, rx, ry) / denom
              if (t <= EPS || t > 1 || u < -EPS || u > 1 + EPS) continue
              // Erased already: the tail has passed the point.
              if (u * other.len < tree.D - tree.delay - other.born) continue
              if (gone(tree, other, u * other.len)) continue
              const hx = ax + (bx - ax) * t
              const hy = ay + (by - ay) * t
              if (Math.hypot(hx - seg.x0, hy - seg.y0) < ORIGIN) continue
              const ox = dx(other.d)
              const oy = dy(other.d)
              const out = reflectOff(seg.d, f.xx * ox + f.xy * oy, f.yx * ox + f.yy * oy)
              consider({ t, kind: which === 0 ? "line" : "mirror", out, id: tag, seg: id, ou: u * other.len })
            }
          }
      }
    }

    const fs = group()
    const vx = bx - ax
    const vy = by - ay
    for (let which = 0; which < fs.length; which++) {
      const f = fs[which]!
      // On the centre line a flip is the line itself, drawn once; it is never met.
      if (seg.axis && f.flip && Math.abs(f.turn) < EPS) continue
      const [qx0, qy0] = unimage(f, ax, ay)
      const [qx1, qy1] = unimage(f, bx, by)
      test(qx0, qy0, qx1, qy1, which, f)
      if (which === 0) continue
      if (which === 1) {
        // The plain mirror, kept exactly as it was before the other images, so
        // every seed drawn at fold 1 still draws what it drew.
        const a = ax - centre()
        const b = bx - centre()
        if (!seg.axis && Math.abs(a) > ORIGIN && (a * b < 0 || b === 0))
          consider({ t: a / (a - b), kind: "axis", out: -seg.d, id: -1, seg: -1, ou: 0 })
        continue
      }
      // The tip meeting its own image, which the stored segments cannot show:
      // the image of where it is going is not stored anywhere yet.
      const [ix0, iy0] = image(f, ax, ay)
      const [ix1, iy1] = image(f, bx, by)
      const wx = ix1 - ix0
      const wy = iy1 - iy0
      const denom = cross(vx, vy, wx, wy)
      let t = -1
      if (Math.abs(denom) > 1e-9) {
        const t1 = cross(ix0 - ax, iy0 - ay, wx, wy) / denom
        const u1 = cross(ix0 - ax, iy0 - ay, vx, vy) / denom
        if (u1 >= -EPS && u1 <= 1 + EPS) t = t1
      } else if (
        Math.hypot(ix0 - ax, iy0 - ay) > ORIGIN &&
        Math.abs(cross(ix0 - ax, iy0 - ay, vx, vy)) < 1e-6 * (1 + Math.hypot(vx, vy))
      ) {
        // Head on, along one line: the two tips grow at one speed, so they meet halfway.
        const l2 = vx * vx + vy * vy
        if (l2 > 0) t = (((ix0 - ax) / 2) * vx + ((iy0 - ay) / 2) * vy) / l2
      }
      if (t <= EPS || t > 1) continue
      const hx = ax + vx * t
      const hy = ay + vy * t
      if (Math.hypot(hx - ax, hy - ay) < 0.01 || Math.hypot(hx - seg.x0, hy - seg.y0) < ORIGIN) continue
      // A reflection's image meets it on the reflection's own line, and it rebounds off that.
      const mx = f.flip ? vx + wx : wx
      const my = f.flip ? vy + wy : wy
      const out = Math.hypot(mx, my) > EPS ? reflectOff(seg.d, mx, my) : seg.d + turns() / 2
      consider({ t, kind: "axis", out, id: -1, seg: -1, ou: 0 })
    }
    if (settings.haloMeets === "meet")
      for (const halo of halos(tree)) {
        const rx = bx - ax
        const ry = by - ay
        const fx = ax - halo.x
        const fy = ay - halo.y
        const a = rx * rx + ry * ry
        const b = 2 * (fx * rx + fy * ry)
        const disc = b * b - 4 * a * (fx * fx + fy * fy - halo.r * halo.r)
        if (a > 0 && disc >= 0) {
          for (const sign of [-1, 1]) {
            const t = (-b + sign * Math.sqrt(disc)) / (2 * a)
            if (t <= EPS || t > 1) continue
            const hx = ax + rx * t
            const hy = ay + ry * t
            if (Math.hypot(rx * t, ry * t) < 0.01 || Math.hypot(hx - seg.x0, hy - seg.y0) < ORIGIN) continue
            // Only where the circle has been drawn and not yet erased, measured
            // round from its lowest point, which turns with its image.
            const down = ((hx - halo.x) * -Math.sin(halo.turn) + (hy - halo.y) * Math.cos(halo.turn)) / halo.r
            const arc = halo.r * Math.acos(Math.max(-1, Math.min(1, down)))
            if (arc > tree.D || arc < tree.D - tree.delay) continue
            if (haloGone(tree, arc)) continue
            consider({
              t,
              kind: "halo",
              out: offCircle(seg.d, (hx - halo.x) / halo.r, (hy - halo.y) / halo.r),
              id: -1,
              seg: -1,
              ou: 0,
            })
          }
        }
      }
    return best
  }

  /**
   * The direction on the angle nearest to a reflection off a circle whose
   * outward normal at the meeting is (nx, ny), or null if none of the nearest
   * three leaves on the side the reflection does.
   */
  function offCircle(d: number, nx: number, ny: number): number | null {
    const vx = dx(d)
    const vy = dy(d)
    const dot = vx * nx + vy * ny
    return snap(vx - 2 * dot * nx, vy - 2 * dot * ny, nx, ny, dot < 0 ? 1 : -1)
  }

  /** The big circle under every rotation, once each: on the centre point they are all one. */
  function halos(tree: Tree): { x: number; y: number; r: number; turn: number }[] {
    const halo = tree.halo
    if (!halo) return []
    const out: { x: number; y: number; r: number; turn: number }[] = []
    for (const f of group()) {
      if (f.flip) continue
      // Turned with the copies but never slid with them, so a big circle on the
      // centre stays one circle whatever `reach` does to the lines.
      const [x, y] = image(f, halo.x, halo.y, false)
      if (out.some((h) => Math.hypot(h.x - x, h.y - y) < 0.5)) continue
      out.push({ x, y, r: halo.r, turn: f.turn })
    }
    return out
  }

  /** Two segments of one tree touch here: dissolving can pass between them. */
  function join(a: Seg, au: number, b: Seg, bu: number) {
    a.joints.push({ u: au, other: b.id, ou: bu, done: false })
    b.joints.push({ u: bu, other: a.id, ou: au, done: false })
  }

  /** Whether any of the tree's big circle is still on screen: not faded by the tail, not wholly dissolved. */
  function haloShowing(t: Tree): boolean {
    const h = t.halo
    if (!h || t.D - t.delay >= Math.PI * h.r) return false
    return Number.isNaN(h.rot) || t.D - h.rotAt < Math.max(h.rot, Math.PI * h.r - h.rot)
  }

  /** Whether the big circle has dissolved at arc length `s` from its lowest point. */
  function haloGone(tree: Tree, s: number): boolean {
    const h = tree.halo
    return !!h && !Number.isNaN(h.rot) && Math.abs(s - h.rot) <= tree.D - h.rotAt
  }

  /** Whether the point `l` along `seg` has dissolved already. */
  function gone(tree: Tree, seg: Seg, l: number): boolean {
    return !Number.isNaN(seg.rot) && Math.abs(l - seg.rot) <= tree.D - seg.rotAt
  }

  /** A uniform for a pair of segments, so a choice about them is the same every replay. */
  function pairOdds(tree: Tree, a: number, b: number, salt: number): number {
    return hashSeed(settings.seed, tree.cycle, a, b, salt) / 4294967296
  }

  /**
   * How crowded it is round (x, y), from 0 to 1: the visible lines of every
   * drawing within a cell or so, their images included, over `crowd`.
   */
  function busyAt(x: number, y: number): number {
    const counted = new Set<number>()
    const fs = group()
    trees.forEach((tree, ti) => {
      fs.forEach((f, which) => {
        const [qx, qy] = unimage(f, x, y)
        const cx = Math.floor(qx / CELL)
        const cy = Math.floor(qy / CELL)
        for (let ox = -1; ox <= 1; ox++)
          for (let oy = -1; oy <= 1; oy++) {
            const list = tree.cells.get(key(cx + ox, cy + oy))
            if (!list) continue
            for (const id of list) {
              const seg = tree.segs[id]!
              if (seg.axis && f.flip) continue
              const tail = tree.D - tree.delay - seg.born
              if (seg.len <= EPS || tail >= seg.len) continue
              if (!Number.isNaN(seg.rot) && tree.D - seg.rotAt >= Math.max(seg.rot, seg.len - seg.rot)) continue
              counted.add(((ti % 64) * 16 + which) * (MAX_SEGS + 1) + id)
            }
          }
      })
    })
    return Math.min(1, counted.size / settings.crowd)
  }

  /**
   * The tip grew `distance` from (ax, ay): every visible line of any drawing it
   * crossed on the way may start dissolving there, the more likely the more
   * crowded it is where the tip now stands.
   */
  function infectAlong(tree: Tree, tip: Seg, ax: number, ay: number, distance: number) {
    const bx = ax + dx(tip.d) * distance
    const by = ay + dy(tip.d) * distance
    const odds = settings.infect * busyAt(bx, by)
    if (odds <= 0) return
    for (const other of trees) {
      // The big circle dissolves too, from where a line crosses it.
      const halo = other.halo
      if (halo && Number.isNaN(halo.rot))
        for (const h of halos(other)) {
          const rx = bx - ax
          const ry = by - ay
          const fx = ax - h.x
          const fy = ay - h.y
          const a = rx * rx + ry * ry
          const b = 2 * (fx * rx + fy * ry)
          const disc = b * b - 4 * a * (fx * fx + fy * fy - h.r * h.r)
          if (a <= 0 || disc < 0) continue
          for (const sign of [-1, 1]) {
            const t = (-b + sign * Math.sqrt(disc)) / (2 * a)
            if (t <= EPS || t > 1 + EPS) continue
            const hx = ax + rx * t
            const hy = ay + ry * t
            const down = ((hx - h.x) * -Math.sin(h.turn) + (hy - h.y) * Math.cos(h.turn)) / h.r
            const arc = h.r * Math.acos(Math.max(-1, Math.min(1, down)))
            if (arc > other.D || arc < other.D - other.delay) continue
            if (pairOdds(other, tip.id, 1 << 21, 13) >= odds) continue
            halo.rot = arc
            halo.rotAt = other.D
            dissolved += 1
          }
          if (!Number.isNaN(halo.rot)) break
        }
      for (const f of group()) {
        const [px0, py0] = unimage(f, ax, ay)
        const [px1, py1] = unimage(f, bx, by)
        const rx = px1 - px0
        const ry = py1 - py0
        const samples = Math.max(1, Math.ceil(Math.hypot(rx, ry) / (CELL / 2)))
        const looked = new Set<number>()
        for (let i = 0; i <= samples; i++) {
          const sx = Math.floor((px0 + (rx * i) / samples) / CELL)
          const sy = Math.floor((py0 + (ry * i) / samples) / CELL)
          for (let ox = -1; ox <= 1; ox++)
            for (let oy = -1; oy <= 1; oy++) {
              const list = other.cells.get(key(sx + ox, sy + oy))
              if (!list) continue
              for (const id of list) {
                if (looked.has(id)) continue
                looked.add(id)
                if (other === tree && id === tip.id) continue
                const seg = other.segs[id]!
                if (seg.len <= EPS || !Number.isNaN(seg.rot)) continue
                const sxv = dx(seg.d) * seg.len
                const syv = dy(seg.d) * seg.len
                const denom = cross(rx, ry, sxv, syv)
                if (Math.abs(denom) < 1e-9) continue
                const qx = seg.x0 - px0
                const qy = seg.y0 - py0
                const t = cross(qx, qy, sxv, syv) / denom
                const u = cross(qx, qy, rx, ry) / denom
                if (t <= EPS || t > 1 + EPS || u < 0 || u > 1) continue
                if (u * seg.len < other.D - other.delay - seg.born) continue
                if (pairOdds(other, id, tip.id + (other === tree ? 0 : 1 << 20), 3) >= odds) continue
                infect(other, seg, u * seg.len, other.D)
              }
            }
        }
      }
    }
  }

  function infect(tree: Tree, seg: Seg, at: number, when: number) {
    if (!Number.isNaN(seg.rot)) return
    seg.rot = Math.max(0, Math.min(seg.len, at))
    seg.rotAt = when
    tree.rotting.push(seg)
    dissolved += 1
  }

  /**
   * Carries dissolving on: wherever a widening gap reaches a joint, or the
   * turn at either end, it passes into the segment there by `contagion`.
   * Segments infected on the way join the end of the list and are walked in
   * the same pass.
   */
  function rot(tree: Tree) {
    const still: Seg[] = []
    for (let i = 0; i < tree.rotting.length; i++) {
      const seg = tree.rotting[i]!
      const r = tree.D - seg.rotAt
      const lo = seg.rot - r
      const hi = seg.rot + r
      let open = false
      const reach = (u: number) => tree.D - (r - Math.abs(u - seg.rot))
      for (const j of seg.joints) {
        if (j.done) continue
        if (j.u < lo - EPS || j.u > hi + EPS) {
          open = true
          continue
        }
        j.done = true
        if (pairOdds(tree, seg.id, j.other, 5) < settings.contagion) {
          infect(tree, tree.segs[j.other]!, j.ou, reach(j.u))
          passedOn += 1
        }
      }
      if (seg.prev >= 0 && !(seg.passed & 1)) {
        if (lo <= 0) {
          seg.passed |= 1
          const prev = tree.segs[seg.prev]!
          if (pairOdds(tree, seg.id, prev.id, 7) < settings.contagion) {
            infect(tree, prev, prev.len, reach(0))
            passedOn += 1
          }
        } else open = true
      }
      if (seg.next >= 0 && !(seg.passed & 2)) {
        if (hi >= seg.len) {
          seg.passed |= 2
          const next = tree.segs[seg.next]!
          if (pairOdds(tree, seg.id, next.id, 7) < settings.contagion) {
            infect(tree, next, 0, reach(seg.len))
            passedOn += 1
          }
        } else open = true
      }
      // A segment whose tip may still be growing keeps its place until it has dissolved past its end.
      if (open || lo > 0 || hi < seg.len) still.push(seg)
    }
    tree.rotting = still
  }

  function grow(tree: Tree, head: Head, distance: number) {
    const from = head.seg.len
    if (settings.infect > 0 && distance > EPS && !head.lifted) {
      const seg = head.seg
      infectAlong(tree, seg, seg.x0 + dx(seg.d) * from, seg.y0 + dy(seg.d) * from, distance)
    }
    head.seg.len += distance
    if (!head.lifted) register(tree, head.seg, from, head.seg.len)
    head.toDecision -= distance
    head.bead -= distance
    if (head.echo) head.echo.toNext -= distance
    head.budget -= distance
  }

  /**
   * Tips flying lifted, in every drawing: counted when the step began, since
   * a stepping tree's `heads` is empty, plus those born since. Deaths this
   * step are not taken off, so the flock errs small.
   */
  function flying(): number {
    return flyingAtStart + flyingBorn
  }

  /** At the top of its range the flock is off, so a scene from before it existed is unchanged. */
  const flockFull = () => settings.flock < FLOCK_OFF && flying() >= settings.flock

  function spawn(tree: Tree, parent: Head, d: number, hand: 1 | -1, f: Family, x: number, y: number, at: number) {
    if (tree.live >= MAX_HEADS) {
      dropped += 1
      return
    }
    // A flock: no more tips may fly lifted at once than `flock`.
    if (parent.lifted && flockFull()) {
      flocked += 1
      return
    }
    // A lifted tip's children fly lifted too.
    const seg = parent.lifted
      ? ghost(x, y, d, parent.seg.gen + 1, at, false)
      : newSeg(tree, x, y, d, parent.seg.gen + 1, at, false)
    if (!seg) return
    if (!parent.lifted) join(parent.seg, parent.seg.len, seg, 0)
    const stepLen = Math.max(4, parent.stepLen * settings.shrink)
    // Splitting costs: each child starts `toll` decisions further through its
    // life, and a flying one that much further through its flight.
    const head: Head = {
      seg,
      lifted: parent.lifted,
      flown: parent.flown + (parent.lifted ? settings.toll : 0),
      family: f,
      n: 0,
      hand,
      depth: parent.depth + settings.toll,
      toDecision: stretch(d, stepLen),
      stepLen,
      echo: null,
      bead: Infinity,
      past: -1,
      budget: parent.budget,
    }
    arm(head)
    tree.heads.push(head)
    tree.live += 1
    if (head.lifted) flyingBorn += 1
  }

  /** Decides whether the stretch the tip is starting drops a circle, and where. */
  function arm(head: Head) {
    const tk = token(head.family, head.n)
    head.bead = tk.along < settings.along ? tk.at * head.stepLen : Infinity
  }

  /** A circle centred on the tip, if the token says this corner gets one. */
  function mark(tree: Tree, head: Head, tk: Token, where: "turns" | "splits", at: number) {
    if (head.lifted || tk.corner >= settings.corner) return
    if (settings.cornerAt !== "both" && settings.cornerAt !== where) return
    const [x, y] = headPoint(head.seg)
    if (place(tree, { x, y, size: tk.size, born: at, gen: head.seg.gen, axis: head.seg.axis })) circles.corner += 1
  }

  const radiusOf = (c: Circle) => px(settings.radius) * (1 + settings.jitter * (2 * c.size - 1))

  /** Every visible circle's images, big ones included, as centre and radius. */
  function visibleCircles(): [number, number, number][] {
    const out: [number, number, number][] = []
    for (const tree of trees) {
      for (const h of halos(tree)) out.push([h.x, h.y, h.r])
      for (const c of tree.circles) {
        const r = radiusOf(c)
        if (tree.D - tree.delay - c.born >= Math.PI * r) continue
        for (const f of group()) {
          if (c.axis && f.flip) continue
          const [ix, iy] = image(f, c.x, c.y)
          out.push([ix, iy, r])
        }
      }
    }
    return out
  }

  /**
   * Adds a small circle unless shyness says otherwise: each circle already
   * near it, its own images included, makes it `shy` more likely to be left
   * out. Near means closer than a radius apart, edge to edge.
   */
  function place(tree: Tree, c: Circle): boolean {
    if (inHole(c.x, c.y, radiusOf(c), c.axis)) {
      circles.framed += 1
      return false
    }
    if (settings.shy > 0) {
      const r = radiusOf(c)
      const near = (x: number, y: number, rr: number) => Math.hypot(x - c.x, y - c.y) < r + rr + Math.max(r, rr)
      let n = 0
      for (const [x, y, rr] of visibleCircles()) if (near(x, y, rr)) n += 1
      for (const f of group().slice(1)) {
        if (c.axis && f.flip) continue
        const [ix, iy] = image(f, c.x, c.y)
        if (Math.hypot(ix - c.x, iy - c.y) > 0.5 && near(ix, iy, r)) n += 1
      }
      const u = hashSeed(settings.seed, tree.cycle, Math.round(c.x * 8), Math.round(c.y * 8), 31) / 4294967296
      if (u < 1 - (1 - settings.shy) ** n) {
        circles.shied += 1
        return false
      }
    }
    tree.circles.push(c)
    return true
  }

  /** What the line does at a meeting, by the odds, read off the stretch's token. */
  function choose(head: Head): Choice {
    const total = settings.onStop + settings.onCross + settings.onRebound
    if (total <= 0) return "stop"
    const r = token(head.family, head.n).meet * total
    if (r < settings.onStop) return "stop"
    if (r < settings.onStop + settings.onCross) return "cross"
    return "rebound"
  }

  /** On the centre line the right-hand one of a pair is grown, and the left is its reflection. */
  function rightward(d: number): 1 | -1 {
    return dx(d + 1) > EPS ? 1 : -1
  }

  /** Ends the tip's segment here and carries on from the same point in direction `d`. */
  function bend(tree: Tree, head: Head, d: number, at: number): boolean {
    const [x, y] = headPoint(head.seg)
    if (head.lifted) {
      head.seg = ghost(x, y, d, head.seg.gen, at, false)
      head.echo = null
      return true
    }
    const seg = newSeg(tree, x, y, d, head.seg.gen, at, false)
    if (!seg) return false
    seg.prev = head.seg.id
    head.seg.next = seg.id
    head.seg = seg
    head.echo = null
    head.past = -1
    return true
  }

  /** Returns false when the tip stops. */
  function decide(tree: Tree, head: Head, at: number): boolean {
    if (head.depth >= settings.depth) {
      meetings.depth += 1
      return false
    }
    const tk = token(head.family, head.n)
    head.n += 1
    head.depth += 1
    if (head.lifted && ++head.flown > settings.flight) {
      // Flown as far as it may without drawing.
      grounded += 1
      return false
    }
    if (head.lifted && tk.land < settings.land) {
      // Pen down: a new line starts here, and this decision applies to it.
      const [x, y] = headPoint(head.seg)
      const seg = newSeg(tree, x, y, head.seg.d, head.seg.gen, at, head.seg.axis)
      if (!seg) return false
      head.seg = seg
      head.lifted = false
      lands += 1
    }
    if (!head.lifted && settings.hush > 0 && tk.quiet < settings.hush * busyAt(...headPoint(head.seg))) {
      hushed += 1
      return lift(head, at)
    }
    arm(head)
    decisions[tk.kind] += 1
    if (tk.copy) repeated += 1
    const alive = act(tree, head, tk, at)
    head.toDecision = tk.again ? Math.max(1, settings.beat * head.stepLen) : stretch(head.seg.d, head.stepLen)
    return alive
  }

  function act(tree: Tree, head: Head, tk: Token, at: number): boolean {
    const [x, y] = headPoint(head.seg)
    const d = head.seg.d
    const split = () => {
      mark(tree, head, tk, "splits", at)
      const f = family(tree)
      const k = Math.round(settings.spread)
      if (head.seg.axis) spawn(tree, head, d + k * rightward(d), 1, f, x, y, at)
      else {
        spawn(tree, head, d + k * head.hand, head.hand, f, x, y, at)
        spawn(tree, head, d - k * head.hand, -head.hand as 1 | -1, f, x, y, at)
      }
    }
    switch (tk.kind) {
      case "straight":
        return true
      case "branch":
        split()
        return true
      case "fork":
        split()
        return lift(head, at)
      case "turn":
        if (head.seg.axis) {
          split()
          return lift(head, at)
        }
        if (tk.lean < settings.rise) {
          // Rising: an upright line keeps going, and a slanting one turns back towards upright.
          const half = turns() / 2
          const off = ((d % half) + half) % half
          if (off === 0) {
            leaned += 1
            return true
          }
          leaned += 1
          mark(tree, head, tk, "turns", at)
          return bend(tree, head, d + (off <= half / 2 ? -1 : 1), at)
        }
        mark(tree, head, tk, "turns", at)
        return bend(tree, head, d + tk.sign * head.hand, at)
      case "echo": {
        const side = head.seg.axis ? rightward(d) : ((tk.sign * head.hand) as 1 | -1)
        head.echo = { left: settings.echoes, toNext: 0, side, family: family(tree) }
        return true
      }
      case "stop":
        return head.lifted || lift(head, at)
    }
  }

  /** Returns false when the tip stops. */
  function meet(tree: Tree, head: Head, hit: Hit, at: number): boolean {
    meetings[hit.kind] += 1
    if (hit.seg >= 0) join(head.seg, head.seg.len, tree.segs[hit.seg]!, hit.ou)
    // Crowded: more likely to stop here, as at a decision.
    if (settings.hush > 0 && token(head.family, head.n).quiet < settings.hush * busyAt(...headPoint(head.seg))) {
      hushed += 1
      return lift(head, at)
    }
    const choice = choose(head)
    chose[choice] += 1
    if (choice === "cross") {
      head.past = hit.id
      return true
    }
    if (choice === "stop" || hit.out === null) return lift(head, at)
    if (head.depth >= settings.depth) {
      meetings.depth += 1
      return false
    }
    head.depth += 1
    rebounds += 1
    mark(tree, head, token(head.family, head.n), "turns", at)
    if (head.seg.axis) {
      // A line on the centre line cannot leave it alone; it rebounds as a pair,
      // grown on the right. Straight back along the axis, it leaves at one angle.
      const [x, y] = headPoint(head.seg)
      const out = hit.out
      const d = dx(out) > EPS ? out : dx(out) < -EPS ? -out : out + rightward(out)
      spawn(tree, head, d, 1, family(tree), x, y, at)
      return lift(head, at)
    }
    return bend(tree, head, hit.out, at)
  }

  function offscreen(x: number, y: number) {
    const m = inset()
    return x < m - 2 || x > width - m + 2 || y < m - 2 || y > height - m + 2
  }

  /** Grows one tip through its budget, handling every event inside it in order. */
  function advanceHead(tree: Tree, head: Head, frameStart: number, frameLength: number): boolean {
    let guard = 0
    while (head.budget > EPS) {
      if (++guard > 512) break
      const at = () => frameStart + (frameLength - head.budget)
      const echoAt = head.echo ? Math.max(0, head.echo.toNext) : Infinity
      const ev = Math.min(Math.max(0, head.toDecision), echoAt, Math.max(0, head.bead), head.budget)
      const [ax, ay] = headPoint(head.seg)
      const bx = ax + dx(head.seg.d) * ev
      const by = ay + dy(head.seg.d) * ev
      if (ev > EPS) {
        const wall = toHole(ax, ay, dx(head.seg.d), dy(head.seg.d))
        if (wall && wall.t <= 0) {
          // A copy starting inside the middle has no edge to bounce off: it ends.
          meetings.frame += 1
          return false
        }
        if (wall && wall.t <= ev) {
          // Grow to the empty middle, short of it by a hair so the next search starts outside.
          const reach = Math.max(0, wall.t - 0.01)
          const tx = dx(head.seg.d)
          const ty = dy(head.seg.d)
          const hit = head.lifted ? null : firstHit(tree, head, ax, ay, ax + tx * reach, ay + ty * reach)
          if (hit) {
            grow(tree, head, hit.t * reach)
            if (!meet(tree, head, hit, at())) return false
            continue
          }
          grow(tree, head, reach)
          if (!atHole(tree, head, wall.ux, wall.uy, at())) return false
          continue
        }
        if (offscreen(bx, by)) {
          // Grow to the edge and stop there.
          const tx = dx(head.seg.d)
          const ty = dy(head.seg.d)
          const toSide = tx > EPS ? (width - inset() + 2 - ax) / tx : tx < -EPS ? (inset() - 2 - ax) / tx : Infinity
          const toEnd = ty > EPS ? (height - inset() + 2 - ay) / ty : ty < -EPS ? (inset() - 2 - ay) / ty : Infinity
          const reach = Math.min(ev, toSide, toEnd)
          // Which edge it reaches, for a rebound off it: a side one runs up and down.
          const vertical = toSide <= toEnd
          const hit = head.lifted ? null : firstHit(tree, head, ax, ay, ax + tx * reach, ay + ty * reach)
          if (hit) {
            grow(tree, head, hit.t * reach)
            if (!meet(tree, head, hit, at())) return false
            continue
          }
          grow(tree, head, Math.max(0, reach))
          meetings.edge += 1
          if (settings.atFrame === "both" && hole()) {
            if (!atWall(tree, head, vertical ? 0 : 1, vertical ? 1 : 0, at())) return false
            continue
          }
          return false
        }
        const hit = head.lifted ? null : firstHit(tree, head, ax, ay, bx, by)
        if (hit) {
          grow(tree, head, hit.t * ev)
          if (!meet(tree, head, hit, at())) return false
          continue
        }
        grow(tree, head, ev)
      }
      if (head.echo && head.echo.toNext <= EPS) {
        const echo = head.echo
        const [x, y] = headPoint(head.seg)
        spawn(tree, head, head.seg.d + echo.side, head.hand, echo.family, x, y, at())
        offshoots += 1
        echo.left -= 1
        echo.toNext = settings.pitch * head.stepLen
        if (echo.left <= 0) head.echo = null
      }
      if (head.bead <= EPS && head.lifted) head.bead = Infinity
      if (head.bead <= EPS) {
        const [x, y] = headPoint(head.seg)
        const tk = token(head.family, head.n)
        if (place(tree, { x, y, size: tk.size, born: at(), gen: head.seg.gen, axis: head.seg.axis })) circles.along += 1
        head.bead = Infinity
      }
      if (head.toDecision <= EPS && !decide(tree, head, at())) return false
    }
    return true
  }

  function plant(): Tree {
    const tree: Tree = {
      cycle,
      segs: [],
      heads: [],
      cells: new Map(),
      rotting: [],
      live: 0,
      circles: [],
      halo: null,
      D: 0,
      delay: Infinity,
      grown: -1,
      holdLeft: settings.hold,
      families: 0,
      root: undefined as unknown as Family,
    }
    tree.root = family(tree)
    // Where this drawing is born, and how big its circle is: the same every
    // drawing at 0, otherwise drawn from the seed and the drawing's number.
    const birth = makeRng(hashSeed(settings.seed, settings.vary === "new" ? tree.cycle : 0, 13))
    const grown = 1 + settings.haloVary * (2 * birth() - 1)
    // Whether this drawing has a big circle and where, from their own hash so
    // neither moves the stems' wander.
    const salt = settings.vary === "new" ? tree.cycle : 0
    const has = hashSeed(settings.seed, salt, 23) / 4294967296 < settings.haloOdds
    const drift = (2 * (hashSeed(settings.seed, salt, 29) / 4294967296) - 1) * settings.haloDrift * 25
    if (settings.halo > 0 && has) {
      const r = px(settings.halo) * grown
      const y = height - px(settings.haloAt + drift)
      // Shy: one still showing from an earlier drawing may keep this one away,
      // so an old circle can dissolve or fade instead of being drawn over.
      const showing = trees.some(
        (t) => haloShowing(t) && Math.hypot(t.halo!.x - centre(), t.halo!.y - y) < t.halo!.r + r,
      )
      if (showing && hashSeed(settings.seed, salt, 37) / 4294967296 < settings.shy) circles.shied += 1
      else if (inHole(centre(), y, r, true, false)) circles.framed += 1
      else tree.halo = { x: centre(), y, r, rot: NaN, rotAt: 0 }
    }
    if (seen.length < MAX_SEGS + 1) seen = new Uint32Array(MAX_SEGS + 1)
    const cx = centre()
    const gap = px(settings.gap)
    const stems = Math.round(settings.stems)
    const xs: number[] = []
    if (stems % 2 === 1) xs.push(cx)
    for (let k = 1; k <= Math.floor(stems / 2); k++)
      xs.push(cx + Math.max(0.25, (stems % 2 === 1 ? k : k - 0.5) + settings.wander * (2 * birth() - 1)) * gap)
    const stem = (x: number, y: number, d: number, f: Family, axis: boolean) => {
      const seg = newSeg(tree, x, y, d, 0, 0, axis)
      if (!seg) return
      const head: Head = {
        seg,
        lifted: false,
        flown: 0,
        family: f,
        n: 0,
        hand: 1,
        depth: 0,
        toDecision: stretch(d, stepPx()),
        stepLen: stepPx(),
        echo: null,
        bead: Infinity,
        past: -1,
        budget: 0,
      }
      arm(head)
      tree.heads.push(head)
      tree.live += 1
    }
    for (const x of xs) stem(x, height - inset(), 0, tree.root, x === cx)
    if (ownSides()) {
      // From the right edge, pointing left, deciding for themselves; their
      // images give the left edge, and the pair above and below the middle.
      const side = family(tree)
      const cy = middle()
      const ys: number[] = []
      if (stems % 2 === 1) ys.push(cy)
      for (let k = 1; k <= Math.floor(stems / 2); k++)
        ys.push(cy + Math.max(0.25, (stems % 2 === 1 ? k : k - 0.5) + settings.wander * (2 * birth() - 1)) * gap)
      for (const y of ys) stem(width - inset(), y, -turns() / 4, side, false)
    }
    return tree
  }

  function restart() {
    trees = []
    cycle = 0
    restLeft = 0
    owed = 0
    decisions = emptyDecisions()
    meetings = emptyMeetings()
    chose = emptyChoices()
    rebounds = 0
    offshoots = 0
    circles = { corner: 0, along: 0, shied: 0, framed: 0 }
    repeated = 0
    lifts = 0
    flocked = 0
    grounded = 0
    lands = 0
    hushed = 0
    dissolved = 0
    passedOn = 0
    leaned = 0
    dropped = 0
    trees.push(plant())
  }

  function stepTree(tree: Tree, dt: number) {
    const advance = speed() * dt
    const start = tree.D
    tree.D += advance
    if (tree.rotting.length) rot(tree)
    if (settings.cycle === "flow") tree.delay = settings.life * speed()
    if (tree.grown < 0) {
      const queue = tree.heads
      tree.heads = []
      for (const head of queue) head.budget = advance
      // Children spawned mid-frame join `tree.heads` with their parent's leftover budget.
      let i = 0
      const pending = queue
      const alive: Head[] = []
      const run = (head: Head) => {
        if (advanceHead(tree, head, start, advance)) alive.push(head)
        else tree.live -= 1
      }
      while (i < pending.length) run(pending[i++]!)
      while (tree.heads.length) {
        const born = tree.heads
        tree.heads = []
        for (const head of born) run(head)
      }
      tree.heads = alive
      if (tree.segs.length >= MAX_SEGS) {
        meetings.cap += tree.heads.length
        tree.heads = []
        tree.live = 0
      }
      if (tree.heads.length === 0) tree.grown = tree.D
    } else if (settings.cycle === "hold" && tree.delay === Infinity) {
      tree.holdLeft -= dt
      if (tree.holdLeft <= 0) tree.delay = tree.D
    }
  }

  const finished = (tree: Tree) => tree.grown >= 0 && tree.D >= tree.delay + tree.grown

  function step(dt: number) {
    flyingBorn = 0
    flyingAtStart = 0
    for (const tree of trees) for (const head of tree.heads) if (head.lifted) flyingAtStart += 1
    for (const tree of trees) stepTree(tree, dt)
    const newest = trees[trees.length - 1]
    trees = trees.filter((t) => !finished(t) || t === newest)
    if (!newest) return
    const ready = settings.cycle === "flow" ? newest.grown >= 0 : finished(newest)
    if (ready) {
      restLeft += dt
      if (restLeft >= REST * (settings.cycle === "flow" ? 0.5 : 1)) {
        restLeft = 0
        cycle += 1
        if (finished(newest)) trees = trees.filter((t) => t !== newest)
        trees.push(plant())
      }
    }
  }

  function size() {
    ;({ width, height, dpr } = fitCanvas(canvas))
  }

  function draw() {
    const hue = settings.hue
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (settings.backdrop === "clear") ctx.clearRect(0, 0, width, height)
    else {
      ctx.fillStyle = `hsl(${hue} 22% 4%)`
      ctx.fillRect(0, 0, width, height)
    }
    // Nothing is drawn in the empty middle: a turned copy or a circle can carry
    // a line into it that the grown copy stopped short of.
    const poly = hole()
    ctx.save()
    // A safety net only: no line or circle should reach the middle, and with
    // debug on it is left off so one that does shows.
    if (poly && !debug) {
      ctx.beginPath()
      ctx.rect(0, 0, width, height)
      trace(poly)
      ctx.clip("evenodd")
    }
    const cx = centre()
    ctx.lineCap = "square"
    ctx.strokeStyle = `hsl(${hue} 62% 64%)`
    const byGen = new Map<number, { seg: Seg; tree: Tree; tail: number }[]>()
    for (const tree of trees)
      for (const seg of tree.segs) {
        const tail = Math.max(0, tree.D - tree.delay - seg.born)
        if (tail >= seg.len) continue
        let list = byGen.get(seg.gen)
        if (!list) byGen.set(seg.gen, (list = []))
        list.push({ seg, tree, tail })
      }
    const fs = group()
    for (const [gen, list] of byGen) {
      ctx.lineWidth = Math.max(0.35, settings.width * (1 - settings.taper) ** gen)
      ctx.beginPath()
      const strands = strandsAt(gen)
      for (const { seg, tree, tail } of list) {
        const ux = dx(seg.d)
        const uy = dy(seg.d)
        // A strand meets the next one at a turn where their offset lines cross, as a mitre does.
        const before = tail <= 0 && seg.prev >= 0 ? tree.segs[seg.prev]! : null
        const after = seg.next >= 0 && tree.segs[seg.next]!.len > 0 ? tree.segs[seg.next]! : null
        for (let k = 0; k < strands; k++) {
          // Strands sit side by side across the line, centred on it.
          const o = (k - (strands - 1) / 2) * settings.spacing
          const start = tail + (before ? mitre(before.d, seg.d, o)[1] : 0)
          const end = seg.len + (after ? mitre(seg.d, after.d, o)[0] : 0)
          // Dissolving cuts a gap out of the middle, widening both ways.
          const r = Number.isNaN(seg.rot) ? -1 : tree.D - seg.rotAt
          const pieces: [number, number][] =
            r < 0
              ? [[start, end]]
              : [
                  [start, Math.min(end, seg.rot - r)],
                  [Math.max(start, seg.rot + r), end],
                ]
          for (const [from, to] of pieces) {
            if (to <= from) continue
            const x0 = seg.x0 - uy * o + ux * from
            const y0 = seg.y0 + ux * o + uy * from
            const x1 = seg.x0 - uy * o + ux * to
            const y1 = seg.y0 + ux * o + uy * to
            for (const f of fs) {
              // On the centre line a flip's image is a rotation's, already drawn.
              if (seg.axis && f.flip) continue
              const [ix0, iy0] = image(f, x0, y0)
              const [ix1, iy1] = image(f, x1, y1)
              ctx.moveTo(ix0, iy0)
              ctx.lineTo(ix1, iy1)
            }
          }
        }
      }
      ctx.stroke()
    }
    for (const tree of trees) {
      const h = tree.halo
      if (h) {
        const g = Number.isNaN(h.rot)
          ? null
          : ([h.rot - (tree.D - h.rotAt), h.rot + (tree.D - h.rotAt)] as [number, number])
        ring(tree, h.x, h.y, h.r, 0, 0, true, settings.haloMark, false, g)
      }
      const base = px(settings.radius)
      for (const c of tree.circles) {
        const r = base * (1 + settings.jitter * (2 * c.size - 1))
        ring(tree, c.x, c.y, r, c.born, c.gen, c.axis, settings.mark)
      }
    }
    if (settings.tipSize > 0) {
      // The tips themselves, lifted or drawing, as dots on every image.
      ctx.fillStyle = `hsl(${hue} 62% 64%)`
      ctx.beginPath()
      for (const tree of trees)
        for (const head of tree.heads) {
          // A hierarchy: only tips up to `dotsTo` generations from a stem are seen.
          if (head.seg.gen > settings.dotsTo) continue
          const [x, y] = headPoint(head.seg)
          for (const f of fs) {
            if (head.seg.axis && f.flip) continue
            const [ix, iy] = image(f, x, y)
            ctx.moveTo(ix + settings.tipSize, iy)
            ctx.arc(ix, iy, settings.tipSize, 0, 2 * Math.PI)
          }
        }
      ctx.fill()
    }
    ctx.restore()
    if (poly && settings.outline !== "none") {
      // The middle's edge as a rule, and a second inside it for a double one;
      // lines that rebound off it then read as meeting it.
      ctx.lineWidth = settings.width
      ctx.lineJoin = "miter"
      ctx.strokeStyle = `hsl(${hue} 62% 64%)`
      ctx.beginPath()
      trace(poly)
      ctx.stroke()
      if (settings.outline === "double") {
        const inner = outline(shapeAt(px(settings.frame) + settings.spacing * 2), centre(), middle())
        ctx.beginPath()
        trace(inner)
        ctx.stroke()
      }
    }
    if (debug) {
      ctx.setLineDash([4, 6])
      ctx.lineWidth = 1
      ctx.strokeStyle = `hsl(${hue} 30% 40% / 50%)`
      ctx.beginPath()
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx, height)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = `hsl(${(hue + 180) % 360} 80% 65%)`
      for (const tree of trees)
        for (const head of tree.heads) {
          const [x, y] = headPoint(head.seg)
          ctx.fillRect(x - 2, y - 2, 4, 4)
        }
    }
  }

  /** Adds a closed polygon to the current path. */
  function trace(poly: Point[]) {
    poly.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.closePath()
  }

  /** Strands drawn for a line of generation `gen`: bands on the stems only, if so set. */
  function strandsAt(gen: number): number {
    return settings.strandsOn === "stems" && gen > 0 ? 1 : Math.round(settings.strands)
  }

  /**
   * Where the strand at offset `o` of a line turning from direction `a` to `b`
   * should end on the first and start on the second, as distances along each
   * from the corner: their offset lines' crossing. Nothing at a turn so sharp
   * the mitre would spike, or none at all.
   */
  function mitre(a: number, b: number, o: number): [number, number] {
    if (o === 0) return [0, 0]
    const ax = dx(a)
    const ay = dy(a)
    const bx = dx(b)
    const by = dy(b)
    const denom = cross(ax, ay, bx, by)
    if (Math.abs(denom) < 1e-6) return [0, 0]
    // The offset moves the strand along (-uy, ux) for each line.
    const wx = o * (-by + ay)
    const wy = o * (bx - ax)
    const s = cross(wx, wy, bx, by) / denom
    const r = cross(wx, wy, ax, ay) / denom
    const limit = 4 * Math.abs(o)
    return Math.abs(s) > limit || Math.abs(r) > limit ? [0, 0] : [s, r]
  }

  /**
   * One circle, and its reflection unless it sits on the centre line, drawn up
   * both sides from its lowest point as far as the clock has run since `born`
   * and erased from there by the tail. A solid one grows out from its centre
   * instead; a cutout fills with the background first, hiding what is behind.
   */
  function ring(
    tree: Tree,
    x: number,
    y: number,
    r: number,
    born: number,
    gen: number,
    axis: boolean,
    how: Mark,
    slide = true,
    gap: [number, number] | null = null,
  ) {
    if (r <= 0.25) return
    const drawn = tree.D - born
    const tail = tree.D - tree.delay - born
    const to = Math.min(Math.PI, drawn / r)
    const from = Math.max(0, tail / r)
    if (to <= from) return
    // Every image, once: its lowest point turns with it, and on the centre point they are all one.
    const at: [number, number, number][] = []
    for (const f of group()) {
      if (axis && f.flip) continue
      const [ix, iy] = image(f, x, y, slide)
      if (at.some(([ox, oy]) => Math.hypot(ox - ix, oy - iy) < 0.5)) continue
      at.push([ix, iy, Math.PI / 2 + f.turn])
    }
    const strands = strandsAt(gen)
    ctx.lineWidth = Math.max(0.35, settings.width * (1 - settings.taper) ** gen)
    if (how !== "ring") {
      // A disc is there whole or not at all, so it grows and shrinks with the outline instead.
      const share = Math.min(to, Math.PI - from) / Math.PI
      ctx.fillStyle = how === "solid" ? `hsl(${settings.hue} 62% 64%)` : `hsl(${settings.hue} 22% 4%)`
      // On a clear backdrop a cutout cuts through to whatever is behind.
      if (how === "cutout" && settings.backdrop === "clear") ctx.globalCompositeOperation = "destination-out"
      ctx.beginPath()
      for (const [ox, oy] of at) {
        ctx.moveTo(ox + r * share, oy)
        ctx.arc(ox, oy, r * share, 0, 2 * Math.PI)
      }
      ctx.fill()
      ctx.globalCompositeOperation = "source-over"
    }
    // A dissolving gap, in angle from the lowest point, cuts each side in two.
    const spans: [number, number][] = gap
      ? [
          [from, Math.min(to, gap[0] / r)],
          [Math.max(from, gap[1] / r), to],
        ]
      : [[from, to]]
    ctx.beginPath()
    for (const [ox, oy, bottom] of at)
      for (let k = 0; k < strands; k++) {
        const rr = r + (k - (strands - 1) / 2) * settings.spacing
        if (rr <= 0.25) continue
        for (const [a0, a1] of spans) {
          if (a1 <= a0) continue
          ctx.moveTo(ox + rr * Math.cos(bottom - a0), oy + rr * Math.sin(bottom - a0))
          ctx.arc(ox, oy, rr, bottom - a0, bottom - a1, true)
          ctx.moveTo(ox + rr * Math.cos(bottom + a0), oy + rr * Math.sin(bottom + a0))
          ctx.arc(ox, oy, rr, bottom + a0, bottom + a1)
        }
      }
    ctx.stroke()
  }

  function tick(now: number) {
    if (!running) return
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    if (dt > 0) fps = fps ? fps * 0.95 + 0.05 / dt : 1 / dt
    if (!held && dt > 0) {
      // Growth runs in fixed ticks whatever the frame rate, so a drawing does
      // not depend on how long each frame took: live, settled and replayed
      // runs of one address grow the same drawing.
      owed += dt * settings.timescale
      while (owed >= TICK) {
        step(TICK)
        owed -= TICK
      }
    }
    draw()
    frame = requestAnimationFrame(tick)
  }

  function onResize() {
    size()
    restart()
    draw()
  }

  function settle(seconds: number) {
    for (let t = 0; t < seconds; t += TICK) step(TICK)
    draw()
  }

  function phase(): Stats["phase"] {
    const newest = trees[trees.length - 1]
    if (!newest) return "resting"
    if (newest.grown < 0) return "growing"
    if (newest.delay === Infinity) return "holding"
    return finished(newest) ? "resting" : "undrawing"
  }

  return {
    start() {
      size()
      restart()
      running = true
      last = 0
      window.addEventListener("resize", onResize)
      frame = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", onResize)
    },
    setSettings(next: Settings) {
      const rebuild = needsRebuild(settings, next)
      settings = next
      if (rebuild) restart()
      draw()
    },
    setPaused(next: boolean) {
      held = next
    },
    settle,
    clear() {
      restart()
      draw()
    },
    debug(on?: boolean) {
      debug = on ?? !debug
      draw()
      return debug
    },
    stats(): Stats {
      return {
        frame: { width, height },
        cycle,
        trees: trees.length,
        phase: phase(),
        tips: trees.reduce((n, t) => n + t.heads.length, 0),
        segments: trees.reduce((n, t) => n + t.segs.length, 0),
        families: trees.reduce((n, t) => n + t.families, 0),
        decisions: { ...decisions },
        meetings: { ...meetings },
        chose: { ...chose },
        rebounds,
        offshoots,
        circles: { ...circles },
        repeated,
        pen: {
          lifts,
          lands,
          grounded,
          flocked,
          flying: trees.reduce((n, t) => n + t.heads.filter((h) => h.lifted).length, 0),
        },
        busy: { hushed, dissolved, passedOn },
        halos: {
          drawn: trees.filter(haloShowing).length,
          dissolving: trees.filter((t) => haloShowing(t) && !Number.isNaN(t.halo!.rot)).length,
        },
        leaned,
        dropped,
        fps: Math.round(fps),
      }
    },
  }
}
