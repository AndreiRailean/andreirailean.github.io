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
 * **Circles keep the same clock.** One draws itself up both sides from its
 * lowest point, as far round as the clock has run since it was placed, so a
 * circle of radius r takes πr to close — the distance a tip covers in that
 * time — and the tail erases it in the same order.
 */

import { hashSeed, makeRng, type Rng } from "@/experiments/random"
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
type Token = { kind: Kind; sign: 1 | -1; meet: number; corner: number; along: number; at: number; size: number }

type Family = { rng: Rng; marks: Rng; tokens: Token[]; first: boolean }

type Choice = "stop" | "cross" | "rebound"

type Circle = { x: number; y: number; size: number; born: number; gen: number; axis: boolean }

type Halo = { x: number; y: number; r: number }

/** One image under the symmetry: a linear map about the frame's centre, `turn` its rotation in radians. */
type Xf = { xx: number; xy: number; yx: number; yy: number; flip: boolean; turn: number }

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
}

type Echo = { left: number; toNext: number; side: 1 | -1; family: Family }

type Head = {
  seg: Seg
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
type Hit = { t: number; kind: "line" | "mirror" | "axis" | "halo"; out: number | null; id: number }

type Tree = {
  cycle: number
  segs: Seg[]
  heads: Head[]
  cells: Map<number, number[]>
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
  meetings: { line: number; mirror: number; axis: number; halo: number; edge: number; depth: number; cap: number }
  /** What the lines chose at those meetings. */
  chose: Record<Choice, number>
  rebounds: number
  offshoots: number
  circles: { corner: number; along: number }
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

const emptyDecisions = (): Record<Kind, number> => ({ straight: 0, branch: 0, fork: 0, turn: 0, echo: 0, stop: 0 })
const emptyMeetings = () => ({ line: 0, mirror: 0, axis: 0, halo: 0, edge: 0, depth: 0, cap: 0 })
const emptyChoices = (): Record<Choice, number> => ({ stop: 0, cross: 0, rebound: 0 })

export function createArtdeco(canvas: HTMLCanvasElement, initial: Settings) {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("artdeco: no 2d context")
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
  let decisions = emptyDecisions()
  let meetings = emptyMeetings()
  let chose = emptyChoices()
  let rebounds = 0
  let offshoots = 0
  let circles = { corner: 0, along: 0 }
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

  let images: Xf[] = []
  let imagesFor = ""
  /** The dihedral group of order 2n; index 0 is the identity and index 1 the left-right mirror. */
  function group(): Xf[] {
    if (imagesFor === settings.fold) return images
    const n = Number(settings.fold)
    images = []
    for (let k = 0; k < n; k++) {
      const turn = (2 * Math.PI * k) / n
      const c = Math.cos(turn)
      const sn = Math.sin(turn)
      images.push({ xx: c, xy: -sn, yx: sn, yy: c, flip: false, turn })
      images.push({ xx: -c, xy: -sn, yx: -sn, yy: c, flip: true, turn })
    }
    imagesFor = settings.fold
    return images
  }

  function image(f: Xf, x: number, y: number): [number, number] {
    const ox = x - centre()
    const oy = y - middle()
    return [centre() + f.xx * ox + f.xy * oy, middle() + f.yx * ox + f.yy * oy]
  }

  /** The inverse image: every map here is orthonormal, so its inverse is its transpose. */
  function unimage(f: Xf, x: number, y: number): [number, number] {
    const ox = x - centre()
    const oy = y - middle()
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

  function family(tree: Tree): Family {
    if (settings.unison === "all" && tree.families > 0) return tree.root
    const salt = settings.vary === "new" ? tree.cycle : 0
    tree.families += 1
    return {
      rng: makeRng(hashSeed(settings.seed, salt, tree.families)),
      marks: makeRng(hashSeed(settings.seed, salt, tree.families, 7)),
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
      f.tokens.push({ kind, sign: f.rng() < 0.5 ? -1 : 1, meet: m(), corner: m(), along: m(), at: m(), size: m() })
    }
    return f.tokens[n]!
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

  function newSeg(tree: Tree, x0: number, y0: number, d: number, gen: number, born: number, axis: boolean): Seg | null {
    if (tree.segs.length >= MAX_SEGS) {
      dropped += 1
      return null
    }
    const seg: Seg = { id: tree.segs.length, x0, y0, d: wrap(d), len: 0, born, gen, axis }
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
              const hx = ax + (bx - ax) * t
              const hy = ay + (by - ay) * t
              if (Math.hypot(hx - seg.x0, hy - seg.y0) < ORIGIN) continue
              const ox = dx(other.d)
              const oy = dy(other.d)
              const out = reflectOff(seg.d, f.xx * ox + f.xy * oy, f.yx * ox + f.yy * oy)
              consider({ t, kind: which === 0 ? "line" : "mirror", out, id: tag })
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
          consider({ t: a / (a - b), kind: "axis", out: -seg.d, id: -1 })
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
      consider({ t, kind: "axis", out, id: -1 })
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
            consider({ t, kind: "halo", out: offCircle(seg.d, (hx - halo.x) / halo.r, (hy - halo.y) / halo.r), id: -1 })
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
  function halos(tree: Tree): (Halo & { turn: number })[] {
    const halo = tree.halo
    if (!halo) return []
    const out: (Halo & { turn: number })[] = []
    for (const f of group()) {
      if (f.flip) continue
      const [x, y] = image(f, halo.x, halo.y)
      if (out.some((h) => Math.hypot(h.x - x, h.y - y) < 0.5)) continue
      out.push({ x, y, r: halo.r, turn: f.turn })
    }
    return out
  }

  function grow(tree: Tree, head: Head, distance: number) {
    const from = head.seg.len
    head.seg.len += distance
    register(tree, head.seg, from, head.seg.len)
    head.toDecision -= distance
    head.bead -= distance
    if (head.echo) head.echo.toNext -= distance
    head.budget -= distance
  }

  function spawn(tree: Tree, parent: Head, d: number, hand: 1 | -1, f: Family, x: number, y: number, at: number) {
    if (tree.heads.length >= MAX_HEADS) {
      dropped += 1
      return
    }
    const seg = newSeg(tree, x, y, d, parent.seg.gen + 1, at, false)
    if (!seg) return
    const stepLen = Math.max(4, parent.stepLen * settings.shrink)
    const head: Head = {
      seg,
      family: f,
      n: 0,
      hand,
      depth: parent.depth,
      toDecision: stepLen,
      stepLen,
      echo: null,
      bead: Infinity,
      past: -1,
      budget: parent.budget,
    }
    arm(head)
    tree.heads.push(head)
  }

  /** Decides whether the stretch the tip is starting drops a circle, and where. */
  function arm(head: Head) {
    const tk = token(head.family, head.n)
    head.bead = tk.along < settings.along ? tk.at * head.stepLen : Infinity
  }

  /** A circle centred on the tip, if the token says this corner gets one. */
  function mark(tree: Tree, head: Head, tk: Token, where: "turns" | "splits", at: number) {
    if (tk.corner >= settings.corner) return
    if (settings.cornerAt !== "both" && settings.cornerAt !== where) return
    const [x, y] = headPoint(head.seg)
    tree.circles.push({ x, y, size: tk.size, born: at, gen: head.seg.gen, axis: head.seg.axis })
    circles.corner += 1
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
    const seg = newSeg(tree, x, y, d, head.seg.gen, at, false)
    if (!seg) return false
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
    head.toDecision = head.stepLen
    arm(head)
    decisions[tk.kind] += 1
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
        return false
      case "turn":
        if (head.seg.axis) {
          split()
          return false
        }
        mark(tree, head, tk, "turns", at)
        return bend(tree, head, d + tk.sign * head.hand, at)
      case "echo": {
        const side = head.seg.axis ? rightward(d) : ((tk.sign * head.hand) as 1 | -1)
        head.echo = { left: settings.echoes, toNext: 0, side, family: family(tree) }
        return true
      }
      case "stop":
        return false
    }
  }

  /** Returns false when the tip stops. */
  function meet(tree: Tree, head: Head, hit: Hit, at: number): boolean {
    meetings[hit.kind] += 1
    const choice = choose(head)
    chose[choice] += 1
    if (choice === "cross") {
      head.past = hit.id
      return true
    }
    if (choice === "stop" || hit.out === null) return false
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
      return false
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
        if (offscreen(bx, by)) {
          // Grow to the edge and stop there.
          const tx = dx(head.seg.d)
          const ty = dy(head.seg.d)
          let reach = ev
          if (tx > EPS) reach = Math.min(reach, (width - inset() + 2 - ax) / tx)
          if (tx < -EPS) reach = Math.min(reach, (inset() - 2 - ax) / tx)
          if (ty > EPS) reach = Math.min(reach, (height - inset() + 2 - ay) / ty)
          if (ty < -EPS) reach = Math.min(reach, (inset() - 2 - ay) / ty)
          const hit = firstHit(tree, head, ax, ay, ax + tx * reach, ay + ty * reach)
          if (hit) {
            grow(tree, head, hit.t * reach)
            if (!meet(tree, head, hit, at())) return false
            continue
          }
          grow(tree, head, Math.max(0, reach))
          meetings.edge += 1
          return false
        }
        const hit = firstHit(tree, head, ax, ay, bx, by)
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
      if (head.bead <= EPS) {
        const [x, y] = headPoint(head.seg)
        const tk = token(head.family, head.n)
        tree.circles.push({ x, y, size: tk.size, born: at(), gen: head.seg.gen, axis: head.seg.axis })
        circles.along += 1
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
      circles: [],
      halo: settings.halo > 0 ? { x: centre(), y: height - px(settings.haloAt), r: px(settings.halo) } : null,
      D: 0,
      delay: Infinity,
      grown: -1,
      holdLeft: settings.hold,
      families: 0,
      root: undefined as unknown as Family,
    }
    tree.root = family(tree)
    if (seen.length < MAX_SEGS + 1) seen = new Uint32Array(MAX_SEGS + 1)
    const cx = centre()
    const gap = px(settings.gap)
    const stems = Math.round(settings.stems)
    const xs: number[] = []
    if (stems % 2 === 1) xs.push(cx)
    for (let k = 1; k <= Math.floor(stems / 2); k++) xs.push(cx + (stems % 2 === 1 ? k : k - 0.5) * gap)
    for (const x of xs) {
      const seg = newSeg(tree, x, height - inset(), 0, 0, 0, x === cx)
      if (!seg) continue
      const head: Head = {
        seg,
        family: tree.root,
        n: 0,
        hand: 1,
        depth: 0,
        toDecision: stepPx(),
        stepLen: stepPx(),
        echo: null,
        bead: Infinity,
        past: -1,
        budget: 0,
      }
      arm(head)
      tree.heads.push(head)
    }
    return tree
  }

  function restart() {
    trees = []
    cycle = 0
    restLeft = 0
    decisions = emptyDecisions()
    meetings = emptyMeetings()
    chose = emptyChoices()
    rebounds = 0
    offshoots = 0
    circles = { corner: 0, along: 0 }
    dropped = 0
    trees.push(plant())
  }

  function stepTree(tree: Tree, dt: number) {
    const advance = speed() * dt
    const start = tree.D
    tree.D += advance
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
      }
      if (tree.heads.length === 0) tree.grown = tree.D
    } else if (settings.cycle === "hold" && tree.delay === Infinity) {
      tree.holdLeft -= dt
      if (tree.holdLeft <= 0) tree.delay = tree.D
    }
  }

  const finished = (tree: Tree) => tree.grown >= 0 && tree.D >= tree.delay + tree.grown

  function step(dt: number) {
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
    dpr = Math.min(2, window.devicePixelRatio || 1)
    width = canvas.clientWidth || window.innerWidth
    height = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }

  function draw() {
    const hue = settings.hue
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = `hsl(${hue} 22% 4%)`
    ctx.fillRect(0, 0, width, height)
    const cx = centre()
    ctx.lineCap = "square"
    ctx.strokeStyle = `hsl(${hue} 62% 64%)`
    const byGen = new Map<number, Seg[]>()
    for (const tree of trees)
      for (const seg of tree.segs) {
        const tail = Math.max(0, tree.D - tree.delay - seg.born)
        if (tail >= seg.len) continue
        let list = byGen.get(seg.gen)
        if (!list) byGen.set(seg.gen, (list = []))
        list.push({ ...seg, x0: seg.x0 + dx(seg.d) * tail, y0: seg.y0 + dy(seg.d) * tail, len: seg.len - tail })
      }
    const fs = group()
    for (const [gen, list] of byGen) {
      ctx.lineWidth = Math.max(0.35, settings.width * (1 - settings.taper) ** gen)
      ctx.beginPath()
      const strands = Math.round(settings.strands)
      for (const seg of list) {
        const ux = dx(seg.d)
        const uy = dy(seg.d)
        for (let k = 0; k < strands; k++) {
          // Strands sit side by side across the line, centred on it.
          const o = (k - (strands - 1) / 2) * settings.spacing
          const x0 = seg.x0 - uy * o
          const y0 = seg.y0 + ux * o
          const x1 = x0 + ux * seg.len
          const y1 = y0 + uy * seg.len
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
      ctx.stroke()
    }
    for (const tree of trees) {
      if (tree.halo) ring(tree, tree.halo.x, tree.halo.y, tree.halo.r, 0, 0, true, settings.haloMark)
      const base = px(settings.radius)
      for (const c of tree.circles) {
        const r = base * (1 + settings.jitter * (2 * c.size - 1))
        ring(tree, c.x, c.y, r, c.born, c.gen, c.axis, settings.mark)
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

  /**
   * One circle, and its reflection unless it sits on the centre line, drawn up
   * both sides from its lowest point as far as the clock has run since `born`
   * and erased from there by the tail. A solid one grows out from its centre
   * instead; a cutout fills with the background first, hiding what is behind.
   */
  function ring(tree: Tree, x: number, y: number, r: number, born: number, gen: number, axis: boolean, how: Mark) {
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
      const [ix, iy] = image(f, x, y)
      if (at.some(([ox, oy]) => Math.hypot(ox - ix, oy - iy) < 0.5)) continue
      at.push([ix, iy, Math.PI / 2 + f.turn])
    }
    const strands = Math.round(settings.strands)
    ctx.lineWidth = Math.max(0.35, settings.width * (1 - settings.taper) ** gen)
    if (how !== "ring") {
      // A disc is there whole or not at all, so it grows and shrinks with the outline instead.
      const share = Math.min(to, Math.PI - from) / Math.PI
      ctx.fillStyle = how === "solid" ? `hsl(${settings.hue} 62% 64%)` : `hsl(${settings.hue} 22% 4%)`
      ctx.beginPath()
      for (const [ox, oy] of at) {
        ctx.moveTo(ox + r * share, oy)
        ctx.arc(ox, oy, r * share, 0, 2 * Math.PI)
      }
      ctx.fill()
    }
    ctx.beginPath()
    for (const [ox, oy, bottom] of at)
      for (let k = 0; k < strands; k++) {
        const rr = r + (k - (strands - 1) / 2) * settings.spacing
        if (rr <= 0.25) continue
        ctx.moveTo(ox + rr * Math.cos(bottom - from), oy + rr * Math.sin(bottom - from))
        ctx.arc(ox, oy, rr, bottom - from, bottom - to, true)
        ctx.moveTo(ox + rr * Math.cos(bottom + from), oy + rr * Math.sin(bottom + from))
        ctx.arc(ox, oy, rr, bottom + from, bottom + to)
      }
    ctx.stroke()
  }

  function tick(now: number) {
    if (!running) return
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    if (dt > 0) fps = fps ? fps * 0.95 + 0.05 / dt : 1 / dt
    if (!held && dt > 0) step(dt)
    draw()
    frame = requestAnimationFrame(tick)
  }

  function onResize() {
    size()
    restart()
    draw()
  }

  function settle(seconds: number) {
    const dt = 1 / 60
    for (let t = 0; t < seconds; t += dt) step(dt)
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
        dropped,
        fps: Math.round(fps),
      }
    },
  }
}
