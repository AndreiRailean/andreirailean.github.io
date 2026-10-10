/**
 * The grid, its colours, and the loop that brings them in and out.
 *
 * Built once per change to anything in `GRID_KEYS`: which hexes exist, which
 * dark centre owns each and how many rings out it sits, and its full colour.
 * Per frame only the loop's clock moves, and each hex's intensity is read off
 * that clock and its ring. Nothing about the colour is computed per frame.
 */
import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { needsRebuild, type Gamut, type Settings } from "@/experiments/hexgrid/settings"

const SQRT3 = Math.sqrt(3)

/** The six axial steps to a pointy-top hex's neighbours. */
const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]

type Hex = {
  q: number
  r: number
  x: number
  y: number
  /** Rings out from the centre that owns it; 0 is a centre. */
  ring: number
  /** Index of the owning centre in `centres`. */
  owner: number
  /** Full colour at the bright edge, sRGB 0–255. */
  rgb: [number, number, number]
  hue: number
  /** 0–1: how late its centre starts, as a share of `stagger`. Shared by a whole flower. */
  late: number
  /** Radians: where its shimmer is in its cycle at time 0. */
  phase: number
  /** Its shimmer's rate, in cycles per second. */
  rate: number
}

// ---------------------------------------------------------------- colour

/** OKLCH to sRGB 0–1, unclipped; a channel outside 0–1 is out of gamut. */
function oklchToSrgb(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.sign(v) * Math.abs(v) ** (1 / 2.4) - 0.055)
  return [encode(lin[0]!), encode(lin[1]!), encode(lin[2]!)]
}

/**
 * How far keeping chroma may move a hue's lightness. Unbounded, cyan goes to
 * 0.9 to reach 0.22 and glares against the dark the seed asks to keep.
 */
const REACH = 0.2

const inGamut = (rgb: [number, number, number]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/**
 * The colour at this lightness and hue, as saturated as asked or as the screen
 * allows. Chroma is pulled in rather than channels clipped, because clipping
 * moves lightness and lightness is the property the flowers share.
 */
export function vivid(
  l: number,
  c: number,
  hue: number,
  keep: Gamut = "lightness",
): { rgb: [number, number, number]; chroma: number; lightness: number } {
  let rgb = oklchToSrgb(l, c, hue)
  if (inGamut(rgb)) return { rgb: to255(rgb), chroma: c, lightness: l }
  if (keep === "chroma") {
    // The nearest lightness at which this hue can be this saturated, if any.
    for (let d = 0.005; d <= REACH; d += 0.005) {
      for (const at of [l - d, l + d]) {
        if (at <= 0 || at >= 1) continue
        rgb = oklchToSrgb(at, c, hue)
        if (inGamut(rgb)) return { rgb: to255(rgb), chroma: c, lightness: at }
      }
    }
    // No lightness shows it that saturated: take the one that shows it most.
    let best = { l, c: pull(l, c, hue) }
    for (let at = Math.max(0.05, l - REACH); at <= Math.min(0.97, l + REACH); at += 0.01) {
      const most = pull(at, c, hue)
      if (most > best.c + 1e-4) best = { l: at, c: most }
    }
    return { rgb: to255(oklchToSrgb(best.l, best.c, hue)), chroma: best.c, lightness: best.l }
  }
  const lo = pull(l, c, hue)
  rgb = oklchToSrgb(l, lo, hue)
  return { rgb: to255(rgb), chroma: lo, lightness: l }
}

/** The most chroma up to `c` this hue shows at this lightness. */
function pull(l: number, c: number, hue: number): number {
  let lo = 0
  let hi = c
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToSrgb(l, mid, hue))) lo = mid
    else hi = mid
  }
  return lo
}

function to255(rgb: [number, number, number]): [number, number, number] {
  return rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)) as [number, number, number]
}

// ---------------------------------------------------------------- grid

const key = (q: number, r: number) => `${q},${r}`

/** Wraps a hue into 0–360. */
const wrap = (h: number) => ((h % 360) + 360) % 360

function buildGrid(settings: Settings, width: number, height: number) {
  const R = settings.size
  const w = SQRT3 * R
  const rows = Math.ceil(height / (1.5 * R)) + 2
  const cols = Math.ceil(width / w) + 2
  const ox = (width - (cols - 1) * w) / 2
  const oy = (height - (rows - 1) * 1.5 * R) / 2

  const hexes: Hex[] = []
  const index = new Map<string, number>()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Offset rows to axial: odd rows shift right by half a hex.
      const q = col - Math.floor(row / 2)
      const r = row
      const x = ox + w * (q + r / 2)
      const y = oy + 1.5 * R * r
      index.set(key(q, r), hexes.length)
      hexes.push({ q, r, x, y, ring: -1, owner: -1, rgb: [0, 0, 0], hue: 0, late: 0, phase: 0, rate: 0 })
    }
  }

  const rng = makeRng(hashSeed(settings.seed, 1))
  const centres =
    settings.layout === "tiled" ? tiledCentres(hexes) : scatteredCentres(hexes, index, settings.spacing, rng)

  // Multi-source breadth-first search: each hex's ring is its hex distance to
  // the nearest centre, and that centre owns it. Ties go to whichever centre's
  // wave arrived first in the queue, which is as good as any.
  const queue: number[] = []
  centres.forEach((h, i) => {
    hexes[h]!.ring = 0
    hexes[h]!.owner = i
    queue.push(h)
  })
  for (let head = 0; head < queue.length; head++) {
    const at = hexes[queue[head]!]!
    for (const [dq, dr] of STEPS) {
      const n = index.get(key(at.q + dq, at.r + dr))
      if (n === undefined || hexes[n]!.ring >= 0) continue
      hexes[n]!.ring = at.ring + 1
      hexes[n]!.owner = at.owner
      queue.push(n)
    }
  }

  colour(hexes, centres.length, settings)
  return { hexes, centres }
}

/** Every seventh hex, so each is ringed by six petals and the flowers tile exactly. */
function tiledCentres(hexes: Hex[]): number[] {
  const out: number[] = []
  hexes.forEach((hex, i) => {
    if ((((hex.q + 3 * hex.r) % 7) + 7) % 7 === 0) out.push(i)
  })
  return out
}

/** Hexes in random order, each kept if it is at least `spacing` from every one kept so far. */
function scatteredCentres(hexes: Hex[], index: Map<string, number>, spacing: number, rng: Rng): number[] {
  const order = hexes.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  const kept: number[] = []
  const blocked = new Set<number>()
  for (const i of order) {
    if (blocked.has(i)) continue
    kept.push(i)
    // Block everything within spacing - 1 rings of it.
    const centre = hexes[i]!
    for (let dq = -spacing + 1; dq < spacing; dq++) {
      for (let dr = Math.max(-spacing + 1, -dq - spacing + 1); dr <= Math.min(spacing - 1, -dq + spacing - 1); dr++) {
        const n = index.get(key(centre.q + dq, centre.r + dr))
        if (n !== undefined) blocked.add(n)
      }
    }
  }
  return kept
}

function colour(hexes: Hex[], flowers: number, settings: Settings) {
  const rng = makeRng(hashSeed(settings.seed, 2))
  const base = Array.from({ length: flowers }, () => wrap(settings.hue + settings.drift * (rng() * 2 - 1)))
  const late = Array.from({ length: flowers }, () => rng())
  const triad = [-1, 0, 1]
  for (const hex of hexes) {
    const flower = base[hex.owner] ?? settings.hue
    const own = rng() * 2 - 1
    hex.late = late[hex.owner] ?? 0
    hex.phase = rng() * Math.PI * 2
    hex.rate = 0.08 + rng() * 0.17
    if (hex.ring === 0) {
      hex.hue = flower
      hex.rgb = vivid(settings.centre, Math.min(settings.chroma, settings.centre * 0.6), flower).rgb
      continue
    }
    const offset = settings.pattern === "triad" ? triad[(((hex.q - hex.r) % 3) + 3) % 3]! + own * 0.15 : own
    hex.hue = wrap(flower + settings.hues * offset)
    hex.rgb = vivid(settings.lightness, settings.chroma, hex.hue, settings.gamut).rgb
  }
}

// ---------------------------------------------------------------- loop

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/** Where each phase of one loop starts and how long the loop is, for a grid this many rings deep. */
export function timeline(settings: Settings, maxRing: number) {
  const bloom = settings.rest
  const full = bloom + settings.stagger + maxRing * settings.travel + settings.rise
  const fade = full + settings.hold
  const period = fade + settings.fade
  return { bloom, full, fade, period }
}

/** How lit a hex is this far into the loop, when the colour reaches it `delay` seconds into the bloom. */
export function intensity(settings: Settings, line: ReturnType<typeof timeline>, delay: number, t: number): number {
  const arrive = smooth((t - line.bloom - delay) / settings.rise)
  const leave = 1 - smooth((t - line.fade) / settings.fade)
  return arrive * leave
}

// ---------------------------------------------------------------- scene

export function createHexgrid(canvas: HTMLCanvasElement, initial: Settings) {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("hexgrid: no 2d context")
  const ctx = context

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1
  let hexes: Hex[] = []
  let centres: number[] = []
  let maxRing = 0
  let line = timeline(settings, 0)
  let clock = 0
  let held = false
  let running = false
  let frame = 0
  let last = 0
  let debug = false
  let fps = 0
  let vignette: HTMLCanvasElement | null = null
  let lit = 0

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    width = canvas.clientWidth || window.innerWidth
    height = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }

  /** Drawn radius, centre to corner, once the gap is taken out. */
  const drawn = () => Math.max(0.5, settings.size - settings.gap / SQRT3)

  /**
   * The dark middle, as one sprite laid over every hex: black at `core` opacity
   * in the middle, clear at the corners. It reaches past the flat sides into the
   * gap, which is black already, so it needs no clip.
   */
  function buildVignette() {
    const r = drawn()
    const px = Math.max(2, Math.ceil(2 * r * dpr))
    const sprite = document.createElement("canvas")
    sprite.width = px
    sprite.height = px
    const s = sprite.getContext("2d")!
    const g = s.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2)
    g.addColorStop(0, `rgba(0,0,0,${settings.core})`)
    g.addColorStop(0.35, `rgba(0,0,0,${settings.core * 0.72})`)
    g.addColorStop(1, "rgba(0,0,0,0)")
    s.fillStyle = g
    s.fillRect(0, 0, px, px)
    vignette = sprite
  }

  function rebuild() {
    const grid = buildGrid(settings, width, height)
    hexes = grid.hexes
    centres = grid.centres
    maxRing = hexes.reduce((m, h) => Math.max(m, h.ring), 0)
    line = timeline(settings, maxRing)
    buildVignette()
  }

  function hexPath(x: number, y: number, r: number) {
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6
      const px = x + r * Math.cos(a)
      const py = y + r * Math.sin(a)
      if (k === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)
    const r = drawn()
    const t = clock % line.period
    let sum = 0

    for (const hex of hexes) {
      const lift = intensity(settings, line, hex.late * settings.stagger + hex.ring * settings.travel, t)
      // Shimmer dims a lit hex by up to `shimmer`, slowly and out of step with
      // its neighbours, so a held grid is still moving.
      const a = lift * (1 - settings.shimmer * (0.5 + 0.5 * Math.sin(hex.phase + clock * hex.rate * Math.PI * 2)))
      sum += a
      if (a <= 0.002) continue
      const [cr, cg, cb] = hex.rgb
      ctx.fillStyle = `rgb(${cr * a},${cg * a},${cb * a})`
      ctx.beginPath()
      hexPath(hex.x, hex.y, r)
      ctx.fill()
    }
    lit = hexes.length ? sum / hexes.length : 0

    if (vignette && settings.core > 0) {
      for (const hex of hexes) ctx.drawImage(vignette, hex.x - r, hex.y - r, 2 * r, 2 * r)
    }

    if (settings.edge > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${settings.edge})`
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const hex of hexes) hexPath(hex.x, hex.y, r)
      ctx.stroke()
    }

    if (debug) {
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.font = `${Math.max(8, r * 0.5)}px ui-monospace, monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      for (const hex of hexes) ctx.fillText(String(hex.ring), hex.x, hex.y)
    }
  }

  function tick(time: number) {
    frame = requestAnimationFrame(tick)
    const dt = last ? Math.min(0.1, (time - last) / 1000) : 0
    last = time
    if (dt > 0) fps = fps ? fps * 0.95 + (1 / dt) * 0.05 : 1 / dt
    if (!held) clock += dt
    draw()
  }

  function onResize() {
    size()
    rebuild()
  }

  /** What the mechanisms did, measured off the built grid and the live clock. */
  function stats() {
    const round = (v: number, d = 2) => Number(v.toFixed(d))
    const t = clock % line.period
    const phase = t < line.bloom ? "rest" : t < line.full ? "bloom" : t < line.fade ? "hold" : "fade"
    const byRing: number[] = []
    // Ignoring stagger: how far the wave has come out from a centre that started on time.
    for (let k = 0; k <= maxRing; k++) byRing.push(round(intensity(settings, line, k * settings.travel, t)))
    // How different a centre's six neighbours are from each other in hue, on
    // average: the "same feel, not the same colour" property, as a number.
    const index = new Map(hexes.map((h, i) => [key(h.q, h.r), i]))
    const petalSpread: number[] = []
    for (const c of centres) {
      const centre = hexes[c]!
      const petals = STEPS.map(([dq, dr]) => index.get(key(centre.q + dq, centre.r + dr)))
        .filter((n): n is number => n !== undefined)
        .map((n) => hexes[n]!.hue)
      if (petals.length < 2) continue
      // The narrowest arc holding every petal's hue: 360 less the widest gap between them.
      const sorted = [...petals].sort((a, b) => a - b)
      let widest = 360 - sorted[sorted.length - 1]! + sorted[0]!
      for (let i = 1; i < sorted.length; i++) widest = Math.max(widest, sorted[i]! - sorted[i - 1]!)
      petalSpread.push(360 - widest)
    }
    const coloured = hexes.filter((h) => h.ring > 0)
    const shown = coloured.map((h) => vivid(settings.lightness, settings.chroma, h.hue, settings.gamut))
    const chromas = shown.map((v) => v.chroma)
    const lights = shown.map((v) => v.lightness)
    return {
      hexes: hexes.length,
      centres: centres.length,
      rings: maxRing,
      loop: {
        period: round(line.period, 1),
        at: round(t, 1),
        phase,
        bloom: round(line.bloom, 1),
        full: round(line.full, 1),
        fade: round(line.fade, 1),
      },
      lit: round(lit),
      byRing,
      petalHueSpread: petalSpread.length ? round(petalSpread.reduce((a, b) => a + b, 0) / petalSpread.length, 1) : 0,
      chroma: {
        asked: settings.chroma,
        min: round(Math.min(...chromas), 3),
        mean: round(chromas.reduce((a, b) => a + b, 0) / (chromas.length || 1), 3),
      },
      lightness: { asked: settings.lightness, min: round(Math.min(...lights)), max: round(Math.max(...lights)) },
      frame: { width, height },
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
      if (needsRebuild(before, next)) rebuild()
      else line = timeline(settings, maxRing)
    },
    setPaused(on: boolean) {
      held = on
    },
    settle(seconds: number) {
      clock += seconds
      draw()
    },
    clear() {
      clock = 0
      draw()
    },
    debug(on?: boolean) {
      debug = on ?? !debug
      return debug
    },
    stats,
  }
}
