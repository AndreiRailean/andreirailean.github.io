/**
 * The grid, its colours, and the loop that brings them in and out.
 *
 * A pattern is built once per cycle, and again on any change to `GRID_KEYS`:
 * which hexes are dark centres, how far each other hex is from them along the
 * cheapest path, and its full colour. Per frame only the clock moves, and each
 * hex's intensity is read off that clock and its distance. Patterns overlap,
 * so more than one may be live at once.
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
  /** Rings out from the centre that owns it, counted in hexes; 0 is a centre. */
  ring: number
  /**
   * Distance from the nearest centre along the cheapest path, where crossing a
   * hex costs about 1 and `ragged` spreads that cost. In units of `travel`.
   */
  steps: number
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

/**
 * One pattern. Cycle 0 is the seed's own, so an address always opens on the same
 * picture; every cycle after draws fresh centres and hues from the seed and its number.
 */
function buildPattern(settings: Settings, width: number, height: number, cycle: number) {
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
      hexes.push({
        q,
        r,
        x,
        y,
        ring: -1,
        steps: Infinity,
        owner: -1,
        rgb: [0, 0, 0],
        hue: 0,
        late: 0,
        phase: 0,
        rate: 0,
      })
    }
  }

  const salt = (n: number) => (cycle === 0 ? hashSeed(settings.seed, n) : hashSeed(settings.seed, n, cycle))
  const rng = makeRng(salt(1))
  const centres =
    settings.layout === "tiled"
      ? tiledCentres(hexes, cycle)
      : settings.layout === "random"
        ? randomCentres(hexes, settings.density, rng)
        : scatteredCentres(hexes, index, settings.spacing, rng)

  grow(hexes, index, centres, settings.ragged, makeRng(salt(3)))
  colour(hexes, centres.length, settings, makeRng(salt(2)), cycle)
  const maxSteps = hexes.reduce((m, h) => Math.max(m, h.steps), 0)
  return { hexes, centres, maxSteps }
}

/**
 * How the colour gets from the centres to every hex: the cheapest path, where
 * entering a hex costs between `1 - 0.9 ragged` and `1 + 0.9 ragged`, at random.
 *
 * At 0 every hex costs 1 and the colour arrives in clean rings. Above it the
 * six hexes round a centre come in at different times and the front grows
 * unevenly, reaching further where crossing is cheap — first-passage growth,
 * the shape of a stain spreading or a crystal forming. A hex belongs to the
 * centre whose colour reaches it first. `ring` is kept as the plain count of
 * hexes for the debug overlay.
 */
function grow(hexes: Hex[], index: Map<string, number>, centres: number[], ragged: number, rng: Rng) {
  const cost = hexes.map(() => 1 - 0.9 * ragged + 1.8 * ragged * rng())
  const heap = new MinHeap()
  centres.forEach((h, i) => {
    hexes[h]!.steps = 0
    hexes[h]!.ring = 0
    hexes[h]!.owner = i
    heap.push(0, h)
  })
  const done = new Uint8Array(hexes.length)
  while (heap.size) {
    const h = heap.pop()
    if (done[h]) continue
    done[h] = 1
    const at = hexes[h]!
    for (const [dq, dr] of STEPS) {
      const n = index.get(key(at.q + dq, at.r + dr))
      if (n === undefined || done[n]) continue
      const next = hexes[n]!
      const steps = at.steps + cost[n]!
      if (steps >= next.steps) continue
      next.steps = steps
      next.ring = at.ring + 1
      next.owner = at.owner
      heap.push(steps, n)
    }
  }
}

/** A binary min-heap of hex indices by priority; enough for a grid of a few thousand. */
class MinHeap {
  private keys: number[] = []
  private values: number[] = []
  get size() {
    return this.keys.length
  }
  push(priority: number, value: number) {
    const k = this.keys
    const v = this.values
    let i = k.length
    k.push(priority)
    v.push(value)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (k[parent]! <= priority) break
      k[i] = k[parent]!
      v[i] = v[parent]!
      i = parent
    }
    k[i] = priority
    v[i] = value
  }
  pop(): number {
    const k = this.keys
    const v = this.values
    const top = v[0]!
    const lastK = k.pop()!
    const lastV = v.pop()!
    if (k.length) {
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        if (l >= k.length) break
        const c = l + 1 < k.length && k[l + 1]! < k[l]! ? l + 1 : l
        if (k[c]! >= lastK) break
        k[i] = k[c]!
        v[i] = v[c]!
        i = c
      }
      k[i] = lastK
      v[i] = lastV
    }
    return top
  }
}

/**
 * Every seventh hex, so each is ringed by six petals and the flowers tile
 * exactly. A new cycle shifts which residue is the centre, so it moves.
 */
function tiledCentres(hexes: Hex[], cycle: number): number[] {
  const out: number[] = []
  const shift = (cycle * 3) % 7
  hexes.forEach((hex, i) => {
    if ((((hex.q + 3 * hex.r - shift) % 7) + 7) % 7 === 0) out.push(i)
  })
  return out
}

/** This share of the hexes, in per cent, chosen at random with no spacing at all: centres may touch. */
function randomCentres(hexes: Hex[], density: number, rng: Rng): number[] {
  const count = Math.max(1, Math.round((hexes.length * density) / 100))
  const order = hexes.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return order.slice(0, count)
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

function colour(hexes: Hex[], flowers: number, settings: Settings, rng: Rng, cycle: number) {
  // Each cycle after the first moves the whole pattern's hue by up to `wander`.
  const hue = cycle === 0 ? settings.hue : wrap(settings.hue + settings.wander * (rng() * 2 - 1))
  const base = Array.from({ length: flowers }, () => wrap(hue + settings.drift * (rng() * 2 - 1)))
  const late = Array.from({ length: flowers }, () => rng())
  const triad = [-1, 0, 1]
  for (const hex of hexes) {
    const flower = base[hex.owner] ?? hue
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

// ---------------------------------------------------------------- timing

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/**
 * Where each phase of one pattern starts and how long it lives, for a pattern
 * whose furthest hex is `maxSteps` out. `full` is when the last hex has its
 * colour and `fade` when the first starts to lose it; the two fades agree on
 * the period. `next` is when the following pattern starts growing.
 */
export function timeline(settings: Settings, maxSteps: number) {
  const bloom = settings.rest
  const spread = settings.stagger + maxSteps * settings.travel
  const full = bloom + spread + settings.rise
  const fade = settings.fadeBy === "wave" ? bloom + settings.rise + settings.hold : full + settings.hold
  const period = full + settings.hold + settings.fade
  const next = period * (1 - settings.overlap)
  return { bloom, full, fade, period, next }
}

/**
 * How lit a hex is this far into its pattern, when the colour reaches it
 * `delay` seconds into the bloom: `[colour, outline]`.
 *
 * The outline is the finishing touch: it comes up `trail` seconds after the
 * hex's own colour is full, and leaves with the colour.
 *
 * A wave fade takes each hex out in the order it came in, `hold` seconds after
 * it reached full colour, so every hex is lit for as long as every other and
 * the fade's spread is the bloom's: a quick bloom fades quickly. Together takes
 * every hex out at once, once the last is full.
 */
export function intensity(
  settings: Settings,
  line: ReturnType<typeof timeline>,
  delay: number,
  t: number,
): [number, number, number] {
  const arrived = line.bloom + delay
  const arrive = smooth((t - arrived) / settings.rise)
  const outline = smooth((t - arrived - settings.rise - settings.trail) / settings.rise)
  const leaving = settings.fadeBy === "wave" ? line.fade + delay : line.fade
  const leave = 1 - smooth((t - leaving) / settings.fade)
  // How far the hole has opened past its resting size: 0 at rest, 1 when it
  // has swallowed the whole hex. Dimming leaves it at 0 and fades the colour.
  let open = 0
  let coming = arrive
  let going = leave
  if (settings.entry === "hole") {
    // The hex arrives as a bright rim almost at once, and its hole closes in.
    open = Math.max(open, 1 - arrive)
    coming = smooth(arrive / SWALLOW_LEAD)
  }
  if (settings.exit === "hole") {
    // The hole grows at full colour; only once it has reached the boundary
    // does what is left fade out completely.
    const g = 1 - leave
    open = Math.max(open, g)
    going = 1 - smooth((g - (1 - SWALLOW_LEAD)) / SWALLOW_LEAD)
  }
  return [coming * going, outline * going, open]
}

/**
 * The last share of a hole-out (or first of a hole-in) in which the colour
 * itself fades: by then the hole has reached the boundary and only a thin
 * rim is left, which would otherwise wink out.
 */
const SWALLOW_LEAD = 0.15

/** How many sizes of hole are drawn ahead, from resting to swallowed. */
const OPENINGS = 32

/**
 * The hole at `open` of the way from resting to swallowed: its half-dark radius
 * grows from `hole` until the hex's corners are dark, and its middle deepens
 * from `core` to black, so a swallowed hex is gone rather than tinted.
 */
export function opened(settings: Settings, open: number): Settings {
  const swallowed = 1.16 + settings.soft * 0.6
  return {
    ...settings,
    hole: settings.hole + open * (swallowed - settings.hole),
    core: settings.core + open * (1 - settings.core),
  }
}

/** Seconds into the bloom the colour reaches this hex. */
const delayOf = (settings: Settings, hex: Hex) => hex.late * settings.stagger + hex.steps * settings.travel

// ---------------------------------------------------------------- the hole

/**
 * How dark a hex is this far from its middle, as a share of its inner radius:
 * `core` at the middle, falling to 0 through `hole`, the radius at which it is
 * half as dark, over a transition `soft` wide.
 *
 * The shape of that fall is `curve`. Linear is a straight ramp — the plain
 * radial gradient. Eased is smoothstep over the same width. S-curve is a
 * logistic, which is what Andrei asked for: a dark centre that stays dark,
 * a quick fall through the middle, and a long tail into the colour. Each is
 * renormalised so the middle is exactly `core` and the far edge exactly 0.
 */
export function darkness(settings: Settings, at: number): number {
  const { hole, soft, core, curve } = settings
  const w = Math.max(0.005, soft)
  let fall: (x: number) => number
  if (curve === "linear") fall = (x) => Math.min(1, Math.max(0, (x - hole) / w + 0.5))
  else if (curve === "eased") fall = (x) => smooth((x - hole) / w + 0.5)
  else {
    // A logistic whose 10%–90% span is `soft` wide: that span is 4.39 scales.
    const scale = w / 4.39
    fall = (x) => 1 / (1 + Math.exp(-(x - hole) / scale))
  }
  const a = fall(0)
  // Once the hole has grown past the corners, renormalising at the corner would
  // divide by almost nothing; normalise at the end of the fall instead.
  const b = fall(Math.max(1.16, hole + w))
  const f = b - a > 1e-6 ? (fall(at) - a) / (b - a) : at < hole ? 0 : 1
  return core * (1 - Math.min(1, Math.max(0, f)))
}

// ---------------------------------------------------------------- scene

type Pattern = ReturnType<typeof buildPattern> & {
  cycle: number
  /** Clock reading it began at. */
  begun: number
  line: ReturnType<typeof timeline>
}

export function createHexgrid(canvas: HTMLCanvasElement, initial: Settings) {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("hexgrid: no 2d context")
  const ctx = context

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1
  /** Live patterns, oldest first. Every one is laid on the same hexes. */
  let patterns: Pattern[] = []
  let clock = 0
  let held = false
  let running = false
  let frame = 0
  let last = 0
  let debug = false
  let fps = 0
  /** The dark middle at each size from resting to swallowed; `openings[0]` is at rest. */
  let openings: HTMLCanvasElement[] = []
  let lit = 0
  const outlines: number[] = []
  /** Per hex, which of `openings` to lay over it this frame, or -1 for none. */
  const holes: number[] = []

  function pattern(cycle: number, begun: number): Pattern {
    const built = buildPattern(settings, width, height, cycle)
    return { ...built, cycle, begun, line: timeline(settings, built.maxSteps) }
  }

  /**
   * Moves the clock on. A new pattern starts `next` seconds after the newest
   * one did, while that one is still fading when `overlap` is above 0, and a
   * pattern is dropped once its own period is over.
   */
  function advance(seconds: number) {
    clock += seconds
    for (;;) {
      const newest = patterns[patterns.length - 1]!
      const at = newest.begun + newest.line.next
      if (clock < at) break
      patterns.push(pattern(newest.cycle + 1, at))
    }
    patterns = patterns.filter((p, i) => i === patterns.length - 1 || clock - p.begun < p.line.period)
  }

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
   * The dark middle, as sprites laid over the hexes, their opacity at each
   * radius read off `darkness`: one at rest, and one per size the hole passes
   * through as it swallows a hex. Sampled densely because the canvas only
   * interpolates linearly between stops. Each sprite is clipped to the hex:
   * a grown hole is dark out to the sprite's square corners, which would
   * otherwise lie over the neighbours.
   */
  function buildVignette() {
    const r = drawn()
    const px = Math.max(2, Math.ceil(2 * r * dpr))
    // Stops are shares of the corner radius; `darkness` takes shares of the
    // inner radius, which is 0.866 of it.
    const inner = SQRT3 / 2
    const STOPS = 48
    openings = []
    for (let k = 0; k < OPENINGS; k++) {
      const at = opened(settings, k / (OPENINGS - 1))
      const sprite = document.createElement("canvas")
      sprite.width = px
      sprite.height = px
      const s = sprite.getContext("2d")!
      const g = s.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2)
      for (let j = 0; j <= STOPS; j++) {
        const x = j / STOPS
        g.addColorStop(x, `rgba(0,0,0,${darkness(at, x / inner)})`)
      }
      s.fillStyle = g
      s.fillRect(0, 0, px, px)
      // Clip to the hex. A resting hole is clear by the sprite's corners, but a
      // growing one is not, and the square's dark corners land on neighbours.
      s.globalCompositeOperation = "destination-in"
      s.fillStyle = "#000"
      s.beginPath()
      hexPath(px / 2, px / 2, px / 2, s)
      s.fill()
      openings.push(sprite)
    }
  }

  /** Rebuilds every live pattern at the current settings, keeping which cycle each is and when it began. */
  function rebuild() {
    patterns = patterns.length ? patterns.map((p) => pattern(p.cycle, p.begun)) : [pattern(0, 0)]
    buildVignette()
  }

  /** A hexagon with its corners rounded by `round`: 0 sharp, 1 as round as the sides allow. */
  function hexPath(x: number, y: number, r: number, c: CanvasRenderingContext2D = ctx) {
    const corners: [number, number][] = []
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6
      corners.push([x + r * Math.cos(a), y + r * Math.sin(a)])
    }
    const rr = settings.round * r * (SQRT3 / 2) * 0.999
    if (rr <= 0.01) {
      c.moveTo(corners[0]![0], corners[0]![1])
      for (let k = 1; k < 6; k++) c.lineTo(corners[k]![0], corners[k]![1])
      c.closePath()
      return
    }
    const [ax, ay] = corners[5]!
    const [bx, by] = corners[0]!
    c.moveTo((ax + bx) / 2, (ay + by) / 2)
    for (let k = 0; k < 6; k++) {
      const [cx, cy] = corners[k]!
      const [nx, ny] = corners[(k + 1) % 6]!
      c.arcTo(cx, cy, nx, ny, rr)
    }
    c.closePath()
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)
    const r = drawn()
    const base = patterns[0]!.hexes
    let sum = 0
    outlines.length = 0

    for (let i = 0; i < base.length; i++) {
      // Where two patterns overlap their colours add, so one cross-fades into
      // the next rather than snapping; the outline is whichever is stronger.
      let red = 0
      let green = 0
      let blue = 0
      let level = 0
      let outline = 0
      // The hole is the strongest pattern's: two patterns cannot share a hole.
      let strongest = 0
      let open = 0
      for (const p of patterns) {
        const hex = p.hexes[i]!
        const [lift, edge, hole] = intensity(settings, p.line, delayOf(settings, hex), clock - p.begun)
        outline = Math.max(outline, edge)
        if (lift <= 0) continue
        if (lift > strongest) {
          strongest = lift
          open = hole
        }
        // Shimmer dims a lit hex by up to `shimmer`, slowly and out of step with
        // its neighbours, so a held grid is still moving.
        const a = lift * (1 - settings.shimmer * (0.5 + 0.5 * Math.sin(hex.phase + clock * hex.rate * Math.PI * 2)))
        red += hex.rgb[0] * a
        green += hex.rgb[1] * a
        blue += hex.rgb[2] * a
        level += a
      }
      outlines.push(outline)
      holes[i] = level <= 0.002 ? -1 : Math.round(open * (OPENINGS - 1))
      sum += Math.min(1, level)
      if (level <= 0.002) continue
      const hex = base[i]!
      ctx.fillStyle = `rgb(${Math.min(255, red)},${Math.min(255, green)},${Math.min(255, blue)})`
      ctx.beginPath()
      hexPath(hex.x, hex.y, r)
      ctx.fill()
    }
    lit = base.length ? sum / base.length : 0

    // An unlit hex is black already; a resting hole at no core is nothing.
    base.forEach((hex, i) => {
      const k = holes[i]!
      if (k < 0 || (k === 0 && settings.core === 0)) return
      ctx.drawImage(openings[k]!, hex.x - r, hex.y - r, 2 * r, 2 * r)
    })

    if (settings.edge > 0) {
      ctx.lineWidth = 1
      base.forEach((hex, i) => {
        const o = outlines[i]! * settings.edge
        if (o <= 0.002) return
        ctx.strokeStyle = `rgba(255,255,255,${o})`
        ctx.beginPath()
        hexPath(hex.x, hex.y, r)
        ctx.stroke()
      })
    }

    if (debug) {
      const newest = patterns[patterns.length - 1]!
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.font = `${Math.max(8, r * 0.4)}px ui-monospace, monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      for (const hex of newest.hexes) ctx.fillText(hex.steps.toFixed(1), hex.x, hex.y)
    }
  }

  function tick(time: number) {
    frame = requestAnimationFrame(tick)
    const dt = last ? Math.min(0.1, (time - last) / 1000) : 0
    last = time
    if (dt > 0) fps = fps ? fps * 0.95 + (1 / dt) * 0.05 : 1 / dt
    if (!held) advance(dt)
    draw()
  }

  function onResize() {
    size()
    rebuild()
  }

  /** What the mechanisms did, measured off the oldest live pattern and the clock. */
  function stats() {
    const round = (v: number, d = 2) => Number(v.toFixed(d))
    const p = patterns[0]!
    const { hexes, centres, line } = p
    const t = clock - p.begun
    const phase = t < line.bloom ? "rest" : t < line.full ? "bloom" : t < line.fade ? "hold" : "fade"
    // Mean colour by whole steps out from a centre, as this pattern alone has it now.
    const sums: number[] = []
    const counts: number[] = []
    for (const hex of hexes) {
      const k = Math.floor(hex.steps)
      sums[k] = (sums[k] ?? 0) + intensity(settings, line, delayOf(settings, hex), t)[0]
      counts[k] = (counts[k] ?? 0) + 1
    }
    const byStep = counts.map((c, k) => round((sums[k] ?? 0) / (c || 1)))
    // The six round a centre: how far apart in hue, and how far apart in when
    // the colour reaches them — 0 when they all light at once.
    const index = new Map(hexes.map((h, i) => [key(h.q, h.r), i]))
    const petalSpread: number[] = []
    const petalArrival: number[] = []
    for (const c of centres) {
      const centre = hexes[c]!
      const petals = STEPS.map(([dq, dr]) => index.get(key(centre.q + dq, centre.r + dr)))
        .filter((n): n is number => n !== undefined)
        .map((n) => hexes[n]!)
        .filter((h) => h.ring === 1)
      if (petals.length < 2) continue
      const steps = petals.map((h) => h.steps)
      petalArrival.push(Math.max(...steps) - Math.min(...steps))
      // The narrowest arc holding every petal's hue: 360 less the widest gap between them.
      const sorted = petals.map((h) => h.hue).sort((a, b) => a - b)
      let widest = 360 - sorted[sorted.length - 1]! + sorted[0]!
      for (let i = 1; i < sorted.length; i++) widest = Math.max(widest, sorted[i]! - sorted[i - 1]!)
      petalSpread.push(360 - widest)
    }
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const coloured = hexes.filter((h) => h.ring > 0)
    const shown = coloured.map((h) => vivid(settings.lightness, settings.chroma, h.hue, settings.gamut))
    const chromas = shown.map((v) => v.chroma)
    const lights = shown.map((v) => v.lightness)
    return {
      hexes: hexes.length,
      centres: centres.length,
      rings: hexes.reduce((m, h) => Math.max(m, h.ring), 0),
      steps: round(p.maxSteps, 1),
      patterns: patterns.length,
      loop: {
        cycle: p.cycle,
        hue: centres.length ? round(hexes[centres[0]!]!.hue, 0) : 0,
        period: round(line.period, 1),
        next: round(line.next, 1),
        at: round(t, 1),
        phase,
        bloom: round(line.bloom, 1),
        full: round(line.full, 1),
        fade: round(line.fade, 1),
      },
      lit: round(lit),
      byStep,
      petalHueSpread: round(mean(petalSpread), 1),
      petalArrivalSpread: round(mean(petalArrival)),
      // Lit hexes in the last frame drawn whose hole was opening or closing, and
      // the furthest any had opened: the hole entry and exit, seen firing.
      openHoles: holes.filter((k) => k > 0).length,
      widestHole: round(Math.max(0, ...holes) / (OPENINGS - 1)),
      chroma: {
        asked: settings.chroma,
        min: round(Math.min(...chromas), 3),
        mean: round(mean(chromas), 3),
      },
      lightness: { asked: settings.lightness, min: round(Math.min(...lights)), max: round(Math.max(...lights)) },
      // The hole's profile, measured off the function the sprite is drawn from:
      // where it is half dark and how wide its 10%–90% fall is, in shares of the
      // inner radius, and how dark it is at the middle and at the flat side.
      hole: (() => {
        const at = (x: number) => darkness(settings, x) / (settings.core || 1)
        const cross = (level: number) => {
          for (let x = 0; x <= 1.16; x += 0.001) if (at(x) <= level) return x
          return 1.16
        }
        return {
          half: round(cross(0.5), 3),
          fall: round(cross(0.1) - cross(0.9), 3),
          middle: round(darkness(settings, 0)),
          side: round(darkness(settings, 1)),
        }
      })(),
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
      else for (const p of patterns) p.line = timeline(settings, p.maxSteps)
    },
    setPaused(on: boolean) {
      held = on
    },
    settle(seconds: number) {
      advance(seconds)
      draw()
    },
    clear() {
      clock = 0
      patterns = []
      rebuild()
      draw()
    },
    debug(on?: boolean) {
      debug = on ?? !debug
      return debug
    },
    stats,
  }
}
