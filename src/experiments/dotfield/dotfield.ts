/**
 * The scene: roots on a lattice, a column on each, and one wind over them all.
 *
 * **A column is a damped spring for its top.** Its root never moves; its top
 * is a 2D offset `x` pulled toward `height * lean(root, t)` by a spring of the
 * column's own sway frequency, and the wind's lean is all that drives it. So a
 * column at rest under a steady breeze leans by exactly the breeze, a gust
 * overshoots and rings back as damping allows, and neighbours agree because
 * the wind they sample is smooth — the "proximal alignment" is the wind's
 * smoothness, not a coupling between columns.
 *
 * **The wind is `wind.ts`'s**, sampled once per column per frame.
 *
 * **Seen from straight above, orthographic.** An upright column is its top, a
 * dot. A leaning one is drawn as its side in `segments` bands from root to top,
 * each band a stroke one diameter wide, every column's band k drawn before any
 * column's band k+1 — so a higher part of one column covers a lower part of its
 * neighbour, which is the only occlusion that matters from above. Bands darken
 * toward the ground.
 */

import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { needsRebuild, type Lattice, type Settings } from "@/experiments/dotfield/settings"
import { createWind } from "@/experiments/dotfield/wind"

const TAU = Math.PI * 2

/** Hue buckets are this many degrees wide, so a field of near-alike columns shares a few fills. */
const HUE_BUCKET = 2
/** Tallest to shortest at `heights` 1. */
const HEIGHT_RATIO = 4
/** Physics never steps further than this, so a stiff column cannot go unstable on a slow frame. */
const MAX_STEP = 1 / 120

/** Basis vectors per lattice, at a nearest-neighbour distance of 1. For hex, the lattice of its cells. */
function basis(lattice: Lattice): { e1: [number, number]; e2: [number, number] } {
  const h = Math.sqrt(3) / 2
  const r = Math.SQRT1_2
  switch (lattice) {
    case "square":
      return { e1: [1, 0], e2: [0, 1] }
    case "triangle":
      return { e1: [1, 0], e2: [0.5, h] }
    // Pointy-top hexagons of circumradius 1 tile on a triangular lattice of
    // centres √3 apart; `roots` places two corners per cell.
    case "hex":
      return { e1: [2 * h, 0], e2: [h, 1.5] }
    // Close along a row, rows twice as far apart: a crop.
    case "rows":
      return { e1: [1, 0], e2: [0, 2] }
    case "diamond":
      return { e1: [r, r], e2: [-r, r] }
  }
}

/** Every root of `lattice` at `spacing` covering the rectangle, centred on the frame's middle. */
function roots(lattice: Lattice, spacing: number, x0: number, y0: number, x1: number, y1: number): number[] {
  const out: number[] = []
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  if (lattice === "hex") {
    // A hexagon's six corners are each shared by three cells, so two per cell
    // place every one exactly once — its top and its bottom, which belong to
    // the honeycomb's two alternating sublattices.
    const { e1, e2 } = basis("hex")
    span(e1, e2, spacing, cx, cy, x0, y0, x1, y1, 1, (x, y) => {
      for (const oy of [-spacing, spacing]) {
        if (x >= x0 && x <= x1 && y + oy >= y0 && y + oy <= y1) out.push(x, y + oy)
      }
    })
    return out
  }
  const { e1, e2 } = basis(lattice)
  span(e1, e2, spacing, cx, cy, x0, y0, x1, y1, 0, (x, y) => {
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) out.push(x, y)
  })
  return out
}

/** Calls `visit` for every lattice point whose neighbourhood can reach the rectangle. */
function span(
  e1: [number, number],
  e2: [number, number],
  spacing: number,
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  margin: number,
  visit: (x: number, y: number) => void,
) {
  const a = e1[0] * spacing
  const b = e2[0] * spacing
  const c = e1[1] * spacing
  const d = e2[1] * spacing
  const det = a * d - b * c
  let iMin = Infinity
  let iMax = -Infinity
  let jMin = Infinity
  let jMax = -Infinity
  for (const [x, y] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ] as const) {
    const dx = x - cx
    const dy = y - cy
    const i = (d * dx - b * dy) / det
    const j = (-c * dx + a * dy) / det
    iMin = Math.min(iMin, i)
    iMax = Math.max(iMax, i)
    jMin = Math.min(jMin, j)
    jMax = Math.max(jMax, j)
  }
  for (let j = Math.floor(jMin) - margin; j <= Math.ceil(jMax) + margin; j++) {
    for (let i = Math.floor(iMin) - margin; i <= Math.ceil(iMax) + margin; i++) {
      visit(cx + a * i + b * j, cy + c * i + d * j)
    }
  }
}

/** Seeded 2D gradient noise, roughly in [-1, 1]. */
function makeNoise(rng: Rng) {
  const perm = new Uint8Array(512)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[p[i], p[j]] = [p[j]!, p[i]!]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!
  const gx = new Float32Array(256)
  const gy = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const a = rng() * TAU
    gx[i] = Math.cos(a)
    gy[i] = Math.sin(a)
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const dot = (ix: number, iy: number, x: number, y: number) => {
    const g = perm[(perm[ix & 255]! + iy) & 511]!
    return gx[g]! * (x - ix) + gy[g]! * (y - iy)
  }
  return (x: number, y: number) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const u = fade(x - ix)
    const v = fade(y - iy)
    const n00 = dot(ix, iy, x, y)
    const n10 = dot(ix + 1, iy, x, y)
    const n01 = dot(ix, iy + 1, x, y)
    const n11 = dot(ix + 1, iy + 1, x, y)
    const nx0 = n00 + (n10 - n00) * u
    const nx1 = n01 + (n11 - n01) * u
    return (nx0 + (nx1 - nx0) * v) * 1.414
  }
}

/** The colour field's value at a point: three octaves of noise, about [-1, 1], spread fairly evenly. */
function colourAt(noise: (x: number, y: number) => number, x: number, y: number, size: number): number {
  const s = 1 / size
  const v =
    noise(x * s, y * s) * 0.62 +
    noise(x * s * 2.1 + 17.3, y * s * 2.1 - 4.1) * 0.28 +
    noise(x * s * 4.3 - 9.7, y * s * 4.3 + 31.1) * 0.1
  return Math.max(-1, Math.min(1, v * 1.6))
}

/** 0 passes `v` through; toward 1 it is pushed out to ±1, so a gradient becomes islands with quick borders. */
function sharpen(v: number, islands: number): number {
  if (islands <= 0) return v
  const k = 1 + islands * islands * 14
  return Math.tanh(k * v) / Math.tanh(k)
}

export function createDotfield(canvas: HTMLCanvasElement, initial: Settings) {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("dotfield: no 2d context")
  const ctx = context

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1
  let held = false
  let running = false
  let frame = 0
  let last = 0
  let fps = 0
  let debug = false
  let now = 0

  // Columns, structure of arrays.
  let count = 0
  /** Bands a side is drawn in, root to top: `segments`, read at rebuild. */
  let layers = initial.segments
  let rx = new Float32Array(0)
  let ry = new Float32Array(0)
  let px = new Float32Array(0)
  let py = new Float32Array(0)
  let vx = new Float32Array(0)
  let vy = new Float32Array(0)
  let omega = new Float32Array(0)
  /** Each column's height as a multiple of `height`. */
  let tall = new Float32Array(0)
  let hue = new Float32Array(0)
  let bucketOf = new Uint16Array(0)
  /** Column order sorted by bucket, so a run of one colour is one path. */
  let order = new Uint32Array(0)
  /** Index of a neighbour about one spacing away, or -1. */
  let neighbour = new Int32Array(0)
  let wind = createWind(initial.seed)
  let bucketHues: number[] = []
  let sideFill: string[][] = []
  let capFill: string[] = []

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    width = canvas.clientWidth || window.innerWidth
    height = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }

  function rebuildColours() {
    layers = settings.segments
    const noise = makeNoise(makeRng(hashSeed(settings.seed, 0xc0)))
    const buckets = new Map<number, number>()
    bucketHues = []
    for (let c = 0; c < count; c++) {
      const v = sharpen(colourAt(noise, rx[c]!, ry[c]!, settings.colourSize), settings.islands)
      const h = settings.hue + settings.hueRange * v
      hue[c] = h
      const key = Math.round(h / HUE_BUCKET)
      let b = buckets.get(key)
      if (b === undefined) {
        b = bucketHues.length
        buckets.set(key, b)
        bucketHues.push(key * HUE_BUCKET)
      }
      bucketOf[c] = b
    }
    order = Uint32Array.from({ length: count }, (_, i) => i).sort((a, b) => bucketOf[a]! - bucketOf[b]!)
    const sat = settings.saturation
    sideFill = bucketHues.map((h) =>
      Array.from({ length: layers }, (_, k) => {
        // Darker toward the ground: the band's midpoint height sets its light.
        const t = (k + 0.5) / layers
        return `hsl(${h.toFixed(1)} ${sat}% ${(14 + 40 * t).toFixed(1)}%)`
      }),
    )
    const lift = settings.cap
    capFill = bucketHues.map(
      (h) => `hsl(${h.toFixed(1)} ${(sat * (1 - 0.75 * lift)).toFixed(1)}% ${(58 + 40 * lift).toFixed(1)}%)`,
    )
  }

  const lean = new Float32Array(2)
  const leanAt = (c: number) => wind.at(rx[c]!, ry[c]!, lean)

  function rebuild() {
    const pad = settings.height + settings.diameter
    const pts = roots(settings.lattice, settings.spacing, -pad, -pad, width + pad, height + pad)
    count = pts.length / 2
    rx = new Float32Array(count)
    ry = new Float32Array(count)
    px = new Float32Array(count)
    py = new Float32Array(count)
    vx = new Float32Array(count)
    vy = new Float32Array(count)
    omega = new Float32Array(count)
    tall = new Float32Array(count)
    hue = new Float32Array(count)
    bucketOf = new Uint16Array(count)
    neighbour = new Int32Array(count).fill(-1)
    const rng = makeRng(hashSeed(settings.seed, 0x5a))
    for (let c = 0; c < count; c++) {
      rx[c] = pts[2 * c]!
      ry[c] = pts[2 * c + 1]!
      tall[c] = settings.heights > 0 ? Math.pow(HEIGHT_RATIO, settings.heights * (rng() - 0.5)) : 1
      // A uniform cantilever's fundamental goes as 1/length², which is
      // `heightSway` 2. It was fixed at 2 first, and at `heights` 0.37 with
      // light damping that put neighbours 2.8x apart in rate, so they rang out
      // of step and the field read as random. `sway` is the rate of a column
      // of the nominal height.
      omega[c] = (1 + settings.variety * (rng() * 2 - 1)) / Math.pow(tall[c]!, settings.heightSway)
    }
    // A neighbour per column, found through a hash of cells one spacing wide.
    const cell = settings.spacing
    const grid = new Map<number, number[]>()
    const keyOf = (x: number, y: number) => (Math.floor(x / cell) + 4096) * 8192 + Math.floor(y / cell) + 4096
    for (let c = 0; c < count; c++) {
      const key = keyOf(rx[c]!, ry[c]!)
      const list = grid.get(key)
      if (list) list.push(c)
      else grid.set(key, [c])
    }
    for (let c = 0; c < count; c++) {
      const cxi = Math.floor(rx[c]! / cell)
      const cyi = Math.floor(ry[c]! / cell)
      let best = -1
      let bestD = Infinity
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const o of grid.get((cxi + dx + 4096) * 8192 + cyi + dy + 4096) ?? []) {
            if (o === c) continue
            const d = (rx[o]! - rx[c]!) ** 2 + (ry[o]! - ry[c]!) ** 2
            if (d < bestD) {
              bestD = d
              best = o
            }
          }
        }
      }
      neighbour[c] = best
    }
    wind.resize(width, height)
    wind.update(settings, 0)
    rebuildColours()
    // Start every column where the wind already has it, so the field does not
    // open bolt upright and lurch.
    for (let c = 0; c < count; c++) {
      leanAt(c)
      px[c] = lean[0]! * settings.height * tall[c]!
      py[c] = lean[1]! * settings.height * tall[c]!
    }
  }

  /**
   * One frame of physics. The wind is sampled once per column per frame — it
   * changes over seconds, and sampling it was 85% of a frame's cost when it
   * ran inside the substeps — and only the spring is substepped, as finely as
   * that column's own stiffness needs.
   */
  function step(dt: number) {
    wind.update(settings, dt)
    const w0 = settings.sway * TAU
    const zeta = settings.damping
    const H = settings.height
    for (let c = 0; c < count; c++) {
      leanAt(c)
      const w = w0 * omega[c]!
      const k = w * w
      const damp = 2 * zeta * w
      const Hc = H * tall[c]!
      const gx = lean[0]! * Hc
      const gy = lean[1]! * Hc
      const n = Math.max(1, Math.ceil(dt / Math.min(MAX_STEP, 0.3 / (w * Math.max(1, zeta)))))
      const h = dt / n
      let x = px[c]!
      let y = py[c]!
      let u = vx[c]!
      let v = vy[c]!
      for (let i = 0; i < n; i++) {
        u += (k * (gx - x) - damp * u) * h
        v += (k * (gy - y) - damp * v) * h
        x += u * h
        y += v * h
      }
      px[c] = x
      py[c] = y
      vx[c] = u
      vy[c] = v
    }
    now += dt
  }

  /** A column's top as drawn: its lean saturates at its height, because a laid-flat column reaches no further. */
  function reach(c: number, out: Float32Array) {
    const H = settings.height * tall[c]!
    const x = px[c]!
    const y = py[c]!
    const m = Math.hypot(x, y)
    const scale = m > 1e-6 ? (H * Math.tanh(m / H)) / m : 1
    out[0] = x * scale
    out[1] = y * scale
  }

  const tip = new Float32Array(2)
  /** Projected band ends, layers + 1 per column, and each top's height. */
  let tx = new Float32Array(0)
  let ty = new Float32Array(0)
  let tz = new Float32Array(0)
  let drawMs = 0
  let stepMs = 0
  /**
   * Fraction of the top's offset at a fraction of the height. At `hinge` 0 it
   * is a cantilever's curve, stiff at the root and bending along its length;
   * at 1 a straight pole pivoting on a springy base, like a slalom gate. In
   * between, a blend of the two.
   */
  const bend = (s: number) => {
    const k = settings.hinge
    return (1 - k) * ((s * s * (3 - s)) / 2) + k * s
  }

  function draw() {
    const began = performance.now()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = `hsl(${settings.hue} 18% 4%)`
    ctx.fillRect(0, 0, width, height)

    // A camera `camera` px above the ground over the frame's middle: a point
    // at height z is pushed out from the middle by camera / (camera - z).
    // Orthographic at perspective 0. Placed against the frame's half-diagonal,
    // not the column height, because how far the eye is from the corners is
    // what decides how much a standing column shows its side there.
    const H = settings.height
    const p = settings.perspective
    const camera = p > 0 ? H * HEIGHT_RATIO + (Math.hypot(width, height) / 2) * ((1 - p) / p) : Infinity
    const cx = width / 2
    const cy = height / 2
    const grow = (z: number) => (camera === Infinity ? 1 : camera / (camera - z))

    if (tx.length !== count * (layers + 1)) {
      tx = new Float32Array(count * (layers + 1))
      ty = new Float32Array(count * (layers + 1))
      tz = new Float32Array(count)
    }
    for (let c = 0; c < count; c++) {
      reach(c, tip)
      const Hc = H * tall[c]!
      // A bent column's top comes down as it leans; the arc keeps its length.
      const top = Math.sqrt(Math.max(0, Hc * Hc - tip[0]! * tip[0]! - tip[1]! * tip[1]!))
      tz[c] = top
      for (let k = 0; k <= layers; k++) {
        const s = k / layers
        const f = grow(top * s)
        const b = bend(s)
        tx[c * (layers + 1) + k] = cx + (rx[c]! + tip[0]! * b - cx) * f
        ty[c * (layers + 1) + k] = cy + (ry[c]! + tip[1]! * b - cy) * f
      }
    }
    ctx.lineCap = "round"
    for (let k = 0; k < layers; k++) {
      ctx.lineWidth = settings.diameter * grow(H * ((k + 0.5) / layers))
      let current = -1
      for (let n = 0; n < count; n++) {
        const c = order[n]!
        const b = bucketOf[c]!
        if (b !== current) {
          if (current >= 0) ctx.stroke()
          current = b
          ctx.strokeStyle = sideFill[b]![k]!
          ctx.beginPath()
        }
        const i = c * (layers + 1) + k
        ctx.moveTo(tx[i]!, ty[i]!)
        ctx.lineTo(tx[i + 1]!, ty[i + 1]!)
      }
      if (current >= 0) ctx.stroke()
    }
    const r = settings.diameter / 2
    let current = -1
    for (let n = 0; n < count; n++) {
      const c = order[n]!
      const b = bucketOf[c]!
      if (b !== current) {
        if (current >= 0) ctx.fill()
        current = b
        ctx.fillStyle = capFill[b]!
        ctx.beginPath()
      }
      const i = c * (layers + 1) + layers
      const x = tx[i]!
      const y = ty[i]!
      const rc = r * grow(tz[c]!)
      ctx.moveTo(x + rc, y)
      ctx.arc(x, y, rc, 0, TAU)
    }
    if (current >= 0) ctx.fill()
    drawMs = drawMs ? drawMs * 0.9 + (performance.now() - began) * 0.1 : performance.now() - began

    if (debug) {
      ctx.fillStyle = "rgb(255 255 255 / 70%)"
      for (let c = 0; c < count; c++) ctx.fillRect(rx[c]! - 1, ry[c]! - 1, 2, 2)
    }
  }

  function tick(time: number) {
    frame = requestAnimationFrame(tick)
    const dt = last ? Math.min(0.1, (time - last) / 1000) : 0
    last = time
    if (dt > 0) fps = fps ? fps * 0.95 + (1 / dt) * 0.05 : 1 / dt
    if (!held && dt > 0) {
      const began = performance.now()
      step(dt)
      stepMs = stepMs ? stepMs * 0.9 + (performance.now() - began) * 0.1 : performance.now() - began
    }
    draw()
  }

  function onResize() {
    size()
    rebuild()
  }

  /**
   * What the mechanisms did, measured off the columns rather than read off settings.
   *
   * `align` is the mean cosine between two columns' lean directions: `near`
   * for each column and its nearest neighbour, `far` for pairs at least half
   * the frame apart. Measured twice — on the whole lean, and on the lean less
   * the field's mean — because a strong breeze makes everything agree and
   * hides whether the variation on top of it is local. The seed asks for
   * `near` well above `far` on the second.
   */
  /**
   * The share of a drawn side's length taken by the lower half of the column,
   * averaged over columns leaning more than a tenth of their height: 0.31 for a
   * cantilever's curl, 0.5 for a straight pole on a hinge.
   *
   * Not how far the side departs from straight, which was the first version
   * and read 0 at every setting: seen from straight above, every point of a
   * column lies on the line from its root to its top whether it curls or not.
   * The curl shows only in where the joints and shades fall along that line.
   */
  function lowerHalf(columns: number[]) {
    let sum = 0
    let n = 0
    const stride = layers + 1
    for (const c of columns) {
      const i = c * stride
      const total = Math.hypot(tx[i + layers]! - tx[i]!, ty[i + layers]! - ty[i]!)
      if (total < settings.height * tall[c]! * 0.1) continue
      // Half height, on screen: interpolated between the drawn band ends.
      const at = layers / 2
      const k = Math.min(layers - 1, Math.floor(at))
      const f = at - k
      const hx = tx[i + k]! + (tx[i + k + 1]! - tx[i + k]!) * f
      const hy = ty[i + k]! + (ty[i + k + 1]! - ty[i + k]!) * f
      sum += Math.hypot(hx - tx[i]!, hy - ty[i]!) / total
      n++
    }
    return n ? sum / n : 0
  }

  function stats() {
    const H = settings.height
    const onScreen: number[] = []
    for (let c = 0; c < count; c++)
      if (rx[c]! >= 0 && rx[c]! <= width && ry[c]! >= 0 && ry[c]! <= height) onScreen.push(c)
    const leans = onScreen.map((c) => Math.hypot(px[c]!, py[c]!) / (H * tall[c]!)).sort((a, b) => a - b)
    const speeds = onScreen.map((c) => Math.hypot(vx[c]!, vy[c]!))
    let mx = 0
    let my = 0
    for (const c of onScreen) {
      mx += px[c]!
      my += py[c]!
    }
    mx /= onScreen.length || 1
    my /= onScreen.length || 1
    const cos = (a: number, b: number, ox: number, oy: number) => {
      const ax = px[a]! - ox
      const ay = py[a]! - oy
      const bx = px[b]! - ox
      const by = py[b]! - oy
      const d = Math.hypot(ax, ay) * Math.hypot(bx, by)
      return d > 1e-9 ? (ax * bx + ay * by) / d : 0
    }
    const rng = makeRng(12345)
    const far: [number, number][] = []
    const half = Math.hypot(width, height) / 2
    for (let tries = 0; far.length < 400 && tries < 20000 && onScreen.length > 1; tries++) {
      const a = onScreen[Math.floor(rng() * onScreen.length)]!
      const b = onScreen[Math.floor(rng() * onScreen.length)]!
      if (Math.hypot(rx[a]! - rx[b]!, ry[a]! - ry[b]!) >= half) far.push([a, b])
    }
    const near = onScreen.filter((c) => neighbour[c]! >= 0).map((c) => [c, neighbour[c]!] as [number, number])
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const round = (v: number, d = 2) => Number(v.toFixed(d))
    const hues = onScreen.map((c) => hue[c]!)
    const at = (xs: number[], q: number) => xs[Math.floor(q * (xs.length - 1))] ?? 0
    return {
      columns: onScreen.length,
      simulated: count,
      frame: { width, height },
      lean: {
        mean: round(avg(leans)),
        p10: round(at(leans, 0.1)),
        p90: round(at(leans, 0.9)),
        max: round(at(leans, 1)),
      },
      meanLean: { x: round(mx / H), y: round(my / H) },
      tipSpeedPx: round(avg(speeds), 1),
      align: {
        near: round(avg(near.map(([a, b]) => cos(a, b, 0, 0)))),
        far: round(avg(far.map(([a, b]) => cos(a, b, 0, 0)))),
        nearLessMean: round(avg(near.map(([a, b]) => cos(a, b, mx, my)))),
        farLessMean: round(avg(far.map(([a, b]) => cos(a, b, mx, my)))),
      },
      hue: {
        min: round(Math.min(...hues), 0),
        max: round(Math.max(...hues), 0),
        nearStep: round(avg(near.map(([a, b]) => Math.abs(hue[a]! - hue[b]!))), 1),
        farStep: round(avg(far.map(([a, b]) => Math.abs(hue[a]! - hue[b]!))), 1),
      },
      lowerHalf: round(lowerHalf(onScreen), 3),
      segments: layers,
      wind: wind.report(),
      buckets: bucketHues.length,
      seconds: round(now, 1),
      fps: Math.round(fps),
      ms: { step: round(stepMs, 1), draw: round(drawMs, 1) },
      running,
      held,
    }
  }

  size()
  rebuild()

  return {
    start() {
      if (running) return
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
      const before = settings
      settings = next
      const latticeMoved =
        before.lattice !== next.lattice ||
        before.spacing !== next.spacing ||
        before.height !== next.height ||
        before.diameter !== next.diameter ||
        before.variety !== next.variety ||
        before.heights !== next.heights ||
        before.heightSway !== next.heightSway ||
        before.seed !== next.seed
      if (before.seed !== next.seed) wind = createWind(next.seed)
      if (latticeMoved) rebuild()
      else {
        if (needsRebuild(before, next)) rebuildColours()
      }
    },
    setPaused(on: boolean) {
      held = on
    },
    settle(seconds: number) {
      let left = seconds
      while (left > 0) {
        const dt = Math.min(1 / 60, left)
        step(dt)
        left -= dt
      }
      draw()
    },
    debug(on?: boolean) {
      debug = on ?? !debug
      draw()
      return debug
    },
    stats,
  }
}
