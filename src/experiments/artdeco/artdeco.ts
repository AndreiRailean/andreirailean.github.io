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
 */

import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { needsRebuild, type Settings } from "@/experiments/artdeco/settings"

type Kind = "straight" | "branch" | "fork" | "turn" | "echo" | "stop"
const KINDS: Kind[] = ["straight", "branch", "fork", "turn", "echo", "stop"]

type Token = { kind: Kind; sign: 1 | -1 }

type Family = { rng: Rng; tokens: Token[]; first: boolean }

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
  echo: Echo | null
  budget: number
}

type Hit = { t: number; kind: "line" | "mirror" | "axis"; s: number }

type Tree = {
  cycle: number
  segs: Seg[]
  heads: Head[]
  cells: Map<number, number[]>
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
  meetings: { line: number; mirror: number; axis: number; edge: number; depth: number; cap: number }
  rebounds: number
  offshoots: number
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
  let meetings = { line: 0, mirror: 0, axis: 0, edge: 0, depth: 0, cap: 0 }
  let rebounds = 0
  let offshoots = 0
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

  function family(tree: Tree): Family {
    if (settings.unison === "all" && tree.families > 0) return tree.root
    const salt = settings.vary === "new" ? tree.cycle : 0
    tree.families += 1
    return { rng: makeRng(hashSeed(settings.seed, salt, tree.families)), tokens: [], first: tree.families === 1 }
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
      f.tokens.push({ kind, sign: f.rng() < 0.5 ? -1 : 1 })
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
    if (settings.meet === "cross") return null
    const seg = head.seg
    const cx = centre()
    let best: Hit | null = null
    const consider = (hit: Hit) => {
      if (!best || hit.t < best.t) best = hit
    }

    const test = (px0: number, py0: number, px1: number, py1: number, mirrored: boolean) => {
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
              if (id === seg.id) continue
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
              consider({ t, kind: mirrored ? "mirror" : "line", s: mirrored ? -other.d : other.d })
            }
          }
      }
    }

    test(ax, ay, bx, by, false)
    if (!seg.axis) {
      test(2 * cx - ax, ay, 2 * cx - bx, by, true)
      const a = ax - cx
      const b = bx - cx
      if (Math.abs(a) > ORIGIN && (a * b < 0 || b === 0)) consider({ t: a / (a - b), kind: "axis", s: 0 })
    }
    return best
  }

  function grow(tree: Tree, head: Head, distance: number) {
    const from = head.seg.len
    head.seg.len += distance
    register(tree, head.seg, from, head.seg.len)
    head.toDecision -= distance
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
    tree.heads.push({
      seg,
      family: f,
      n: 0,
      hand,
      depth: parent.depth,
      toDecision: stepPx(),
      echo: null,
      budget: parent.budget,
    })
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
    head.toDecision = stepPx()
    decisions[tk.kind] += 1
    const [x, y] = headPoint(head.seg)
    const d = head.seg.d
    const split = () => {
      const f = family(tree)
      if (head.seg.axis) spawn(tree, head, d + rightward(d), 1, f, x, y, at)
      else {
        spawn(tree, head, d + head.hand, head.hand, f, x, y, at)
        spawn(tree, head, d - head.hand, -head.hand as 1 | -1, f, x, y, at)
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

  function meet(tree: Tree, head: Head, hit: Hit, at: number): boolean {
    meetings[hit.kind] += 1
    if (settings.meet !== "rebound") return false
    if (head.depth >= settings.depth) {
      meetings.depth += 1
      return false
    }
    head.depth += 1
    rebounds += 1
    const reflected = 2 * hit.s - head.seg.d
    if (head.seg.axis) {
      // A line on the centre line cannot leave it alone; it rebounds as a pair.
      const [x, y] = headPoint(head.seg)
      const d = dx(reflected) > EPS ? reflected : 2 * -hit.s - head.seg.d
      if (dx(d) > EPS) spawn(tree, head, d, 1, family(tree), x, y, at)
      return false
    }
    return bend(tree, head, reflected, at)
  }

  function offscreen(x: number, y: number) {
    const m = 2
    return x < -m || x > width + m || y < -m || y > height + m
  }

  /** Grows one tip through its budget, handling every event inside it in order. */
  function advanceHead(tree: Tree, head: Head, frameStart: number, frameLength: number): boolean {
    let guard = 0
    while (head.budget > EPS) {
      if (++guard > 512) break
      const at = () => frameStart + (frameLength - head.budget)
      const echoAt = head.echo ? Math.max(0, head.echo.toNext) : Infinity
      const ev = Math.min(Math.max(0, head.toDecision), echoAt, head.budget)
      const [ax, ay] = headPoint(head.seg)
      const bx = ax + dx(head.seg.d) * ev
      const by = ay + dy(head.seg.d) * ev
      if (ev > EPS) {
        if (offscreen(bx, by)) {
          // Grow to the edge and stop there.
          const tx = dx(head.seg.d)
          const ty = dy(head.seg.d)
          let reach = ev
          if (tx > EPS) reach = Math.min(reach, (width + 2 - ax) / tx)
          if (tx < -EPS) reach = Math.min(reach, (-2 - ax) / tx)
          if (ty > EPS) reach = Math.min(reach, (height + 2 - ay) / ty)
          if (ty < -EPS) reach = Math.min(reach, (-2 - ay) / ty)
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
        echo.toNext = settings.pitch * stepPx()
        if (echo.left <= 0) head.echo = null
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
      const seg = newSeg(tree, x, height, 0, 0, 0, x === cx)
      if (!seg) continue
      tree.heads.push({
        seg,
        family: tree.root,
        n: 0,
        hand: 1,
        depth: 0,
        toDecision: stepPx(),
        echo: null,
        budget: 0,
      })
    }
    return tree
  }

  function restart() {
    trees = []
    cycle = 0
    restLeft = 0
    decisions = emptyDecisions()
    meetings = { line: 0, mirror: 0, axis: 0, edge: 0, depth: 0, cap: 0 }
    rebounds = 0
    offshoots = 0
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
    for (const [gen, list] of byGen) {
      ctx.lineWidth = Math.max(0.35, settings.width * (1 - settings.taper) ** gen)
      ctx.beginPath()
      for (const seg of list) {
        const x1 = seg.x0 + dx(seg.d) * seg.len
        const y1 = seg.y0 + dy(seg.d) * seg.len
        ctx.moveTo(seg.x0, seg.y0)
        ctx.lineTo(x1, y1)
        if (!seg.axis) {
          ctx.moveTo(2 * cx - seg.x0, seg.y0)
          ctx.lineTo(2 * cx - x1, y1)
        }
      }
      ctx.stroke()
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
        rebounds,
        offshoots,
        dropped,
        fps: Math.round(fps),
      }
    },
  }
}
