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
 * **The wind is a sum of travelling plane waves**, rather than a noise field,
 * because a column only ever asks for the wind at its own root and a handful
 * of cosines per column is cheaper than any noise there. Two families:
 *
 * - **gusts**: a scalar envelope whose wave fronts lie across the breeze,
 *   rectified so only its crests push — bands of extra lean that roll
 *   downwind, which is what waves through grass are;
 * - **swirl**: the curl of a stream function made of waves in every direction,
 *   so it turns across the breeze without converging anywhere — eddies.
 *
 * Both are carried downwind at `drift` and change shape at `churn`. Each wave's
 * phase is integrated rather than computed from the clock, so dragging `drift`
 * or `churn` changes how fast the pattern moves, never where it is.
 *
 * **Seen from straight above, orthographic.** An upright column is its top, a
 * dot. A leaning one is drawn as its side in `LAYERS` bands from root to top,
 * each band a stroke one diameter wide, every column's band k drawn before any
 * column's band k+1 — so a higher part of one column covers a lower part of its
 * neighbour, which is the only occlusion that matters from above. Bands darken
 * toward the ground.
 */

import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { needsRebuild, type Lattice, type Settings } from "@/experiments/dotfield/settings"

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** Bands a side is drawn in, root to top. */
const LAYERS = 4
/** Waves in each family. */
const GUST_WAVES = 5
const SWIRL_WAVES = 7
const WAVES = GUST_WAVES + SWIRL_WAVES
/** Hue buckets are this many degrees wide, so a field of near-alike columns shares a few fills. */
const HUE_BUCKET = 2
/** Physics never steps further than this, so a stiff column cannot go unstable on a slow frame. */
const MAX_STEP = 1 / 120

type Wave = {
  kx: number
  ky: number
  /** Turning rate from churn alone, as a fraction of `churn`'s rate. */
  rate: number
  amplitude: number
  phase: number
}

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
    case "offset":
      return { e1: [1, 0], e2: [0.5, 1] }
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
  const v = noise(x * s, y * s) * 0.62 + noise(x * s * 2.1 + 17.3, y * s * 2.1 - 4.1) * 0.28 + noise(x * s * 4.3 - 9.7, y * s * 4.3 + 31.1) * 0.1
  return Math.max(-1, Math.min(1, v * 1.6))
}

/** 0 passes `v` through; toward 1 it is pushed out to ±1, so a gradient becomes islands with quick borders. */
function sharpen(v: number, islands: number): number {
  if (islands <= 0) return v
  const k = 1 + islands * islands * 14
  return Math.tanh(k * v) / Math.tanh(k)
}

function makeWaves(settings: Settings): Wave[] {
  const rng = makeRng(hashSeed(settings.seed, 0x77))
  const heading = settings.direction * DEG
  const waves: Wave[] = []
  for (let n = 0; n < GUST_WAVES; n++) {
    // Fronts across the breeze, give or take: travelling with it, they read as
    // bands of gust rolling downwind rather than as a checkerboard.
    const angle = heading + (rng() - 0.5) * 70 * DEG
    const k = TAU / (settings.gustSize * (0.7 + rng() * 0.7))
    waves.push({
      kx: Math.cos(angle) * k,
      ky: Math.sin(angle) * k,
      rate: (0.5 + rng()) * (rng() < 0.5 ? -1 : 1),
      amplitude: Math.sqrt(2 / GUST_WAVES),
      phase: rng() * TAU,
    })
  }
  for (let n = 0; n < SWIRL_WAVES; n++) {
    const angle = rng() * TAU
    const k = TAU / (settings.swirlSize * (0.7 + rng() * 0.7))
    waves.push({
      kx: Math.cos(angle) * k,
      ky: Math.sin(angle) * k,
      rate: (0.5 + rng()) * (rng() < 0.5 ? -1 : 1),
      // Divided by k so the curl, which multiplies by k again, comes out at
      // about unit RMS whatever the eddy size.
      amplitude: Math.sqrt(2 / SWIRL_WAVES) / k,
      phase: rng() * TAU,
    })
  }
  return waves
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
  let rx = new Float32Array(0)
  let ry = new Float32Array(0)
  let px = new Float32Array(0)
  let py = new Float32Array(0)
  let vx = new Float32Array(0)
  let vy = new Float32Array(0)
  let omega = new Float32Array(0)
  let hue = new Float32Array(0)
  let bucketOf = new Uint16Array(0)
  /** Each column's k·root for every wave, so a frame adds a phase and takes a cosine. */
  let kdot = new Float32Array(0)
  /** Column order sorted by bucket, so a run of one colour is one path. */
  let order = new Uint32Array(0)
  /** Index of a neighbour about one spacing away, or -1. */
  let neighbour = new Int32Array(0)
  let waves: Wave[] = []
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

  function rebuildWaves() {
    waves = makeWaves(settings)
    kdot = new Float32Array(count * WAVES)
    for (let c = 0; c < count; c++) {
      for (let w = 0; w < WAVES; w++) kdot[c * WAVES + w] = waves[w]!.kx * rx[c]! + waves[w]!.ky * ry[c]!
    }
  }

  function rebuildColours() {
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
      Array.from({ length: LAYERS }, (_, k) => {
        // Darker toward the ground: the band's midpoint height sets its light.
        const t = (k + 0.5) / LAYERS
        return `hsl(${h.toFixed(1)} ${sat}% ${(14 + 40 * t).toFixed(1)}%)`
      }),
    )
    const lift = settings.cap
    capFill = bucketHues.map(
      (h) => `hsl(${h.toFixed(1)} ${(sat * (1 - 0.75 * lift)).toFixed(1)}% ${(58 + 40 * lift).toFixed(1)}%)`,
    )
  }

  /** The lean the wind asks of a column, as a fraction of height, into `out`. */
  const lean = new Float32Array(2)
  function leanAt(c: number) {
    const heading = settings.direction * DEG
    const ux = Math.cos(heading)
    const uy = Math.sin(heading)
    const base = c * WAVES
    let gust = 0
    for (let w = 0; w < GUST_WAVES; w++) {
      const wave = waves[w]!
      gust += wave.amplitude * Math.cos(kdot[base + w]! + wave.phase)
    }
    // Only the crests push: a gust adds to the breeze and never reverses it.
    const along = settings.breeze + settings.gusts * Math.max(0, gust) * 0.5
    let sx = 0
    let sy = 0
    for (let w = GUST_WAVES; w < WAVES; w++) {
      const wave = waves[w]!
      const g = wave.amplitude * Math.cos(kdot[base + w]! + wave.phase)
      // curl of a·sin(k·x + φ): (∂ψ/∂y, -∂ψ/∂x)
      sx += g * wave.ky
      sy -= g * wave.kx
    }
    lean[0] = ux * along + settings.swirl * sx
    lean[1] = uy * along + settings.swirl * sy
  }

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
    hue = new Float32Array(count)
    bucketOf = new Uint16Array(count)
    neighbour = new Int32Array(count).fill(-1)
    const rng = makeRng(hashSeed(settings.seed, 0x5a))
    for (let c = 0; c < count; c++) {
      rx[c] = pts[2 * c]!
      ry[c] = pts[2 * c + 1]!
      omega[c] = 1 + settings.variety * (rng() * 2 - 1)
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
    rebuildWaves()
    rebuildColours()
    // Start every column where the wind already has it, so the field does not
    // open bolt upright and lurch.
    for (let c = 0; c < count; c++) {
      leanAt(c)
      px[c] = lean[0]! * settings.height
      py[c] = lean[1]! * settings.height
    }
  }

  function advance(dt: number) {
    const heading = settings.direction * DEG
    const ux = Math.cos(heading)
    const uy = Math.sin(heading)
    const churn = (settings.churn / 60) * TAU
    for (const wave of waves) {
      // Carried downwind at drift: the phase falls by k·u·drift per second.
      wave.phase += (wave.rate * churn - (wave.kx * ux + wave.ky * uy) * settings.drift) * dt
    }
    const w0 = settings.sway * TAU
    const zeta = settings.damping
    const H = settings.height
    for (let c = 0; c < count; c++) {
      leanAt(c)
      const w = w0 * omega[c]!
      const k = w * w
      const damp = 2 * zeta * w
      const ax = k * (lean[0]! * H - px[c]!) - damp * vx[c]!
      const ay = k * (lean[1]! * H - py[c]!) - damp * vy[c]!
      vx[c] = vx[c]! + ax * dt
      vy[c] = vy[c]! + ay * dt
      px[c] = px[c]! + vx[c]! * dt
      py[c] = py[c]! + vy[c]! * dt
    }
    now += dt
  }

  function step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / MAX_STEP))
    for (let i = 0; i < n; i++) advance(dt / n)
  }

  /** A column's top as drawn: its lean saturates at its height, because a laid-flat column reaches no further. */
  function reach(c: number, out: Float32Array) {
    const H = settings.height
    const x = px[c]!
    const y = py[c]!
    const m = Math.hypot(x, y)
    const scale = m > 1e-6 ? (H * Math.tanh(m / H)) / m : 1
    out[0] = x * scale
    out[1] = y * scale
  }

  const tip = new Float32Array(2)
  /** Fraction of the top's offset at a fraction of the height: a cantilever's bend, stiff at the root. */
  const bend = (s: number) => (s * s * (3 - s)) / 2

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = `hsl(${settings.hue} 18% 4%)`
    ctx.fillRect(0, 0, width, height)

    const r = settings.diameter / 2
    ctx.lineCap = "round"
    ctx.lineWidth = settings.diameter
    const tx = new Float32Array(count)
    const ty = new Float32Array(count)
    for (let c = 0; c < count; c++) {
      reach(c, tip)
      tx[c] = tip[0]!
      ty[c] = tip[1]!
    }
    for (let k = 0; k < LAYERS; k++) {
      const s0 = bend(k / LAYERS)
      const s1 = bend((k + 1) / LAYERS)
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
        const x = rx[c]!
        const y = ry[c]!
        ctx.moveTo(x + tx[c]! * s0, y + ty[c]! * s0)
        ctx.lineTo(x + tx[c]! * s1, y + ty[c]! * s1)
      }
      if (current >= 0) ctx.stroke()
    }
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
      const x = rx[c]! + tx[c]!
      const y = ry[c]! + ty[c]!
      ctx.moveTo(x + r, y)
      ctx.arc(x, y, r, 0, TAU)
    }
    if (current >= 0) ctx.fill()

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
    if (!held && dt > 0) step(dt)
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
  function stats() {
    const H = settings.height
    const onScreen: number[] = []
    for (let c = 0; c < count; c++) if (rx[c]! >= 0 && rx[c]! <= width && ry[c]! >= 0 && ry[c]! <= height) onScreen.push(c)
    const leans = onScreen.map((c) => Math.hypot(px[c]!, py[c]!) / H).sort((a, b) => a - b)
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
      lean: { mean: round(avg(leans)), p10: round(at(leans, 0.1)), p90: round(at(leans, 0.9)), max: round(at(leans, 1)) },
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
      buckets: bucketHues.length,
      seconds: round(now, 1),
      fps: Math.round(fps),
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
        before.seed !== next.seed
      if (latticeMoved) rebuild()
      else {
        if (needsRebuild(before, next)) rebuildColours()
        if (
          before.direction !== next.direction ||
          before.gustSize !== next.gustSize ||
          before.swirlSize !== next.swirlSize
        ) {
          // New waves, but carry the old phases so the pattern changes shape
          // without jumping wholesale.
          const phases = waves.map((w) => w.phase)
          rebuildWaves()
          waves.forEach((w, i) => (w.phase = phases[i]!))
        }
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
