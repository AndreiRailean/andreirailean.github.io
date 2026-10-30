/**
 * Melting: a lava lamp, some of whose blobs are the shadows of a hidden turning solid.
 *
 * **The scene is a function of time, not a simulation.** Everything drawn at
 * scene time `t` — where every blob lies, how far every lump of wax has risen,
 * where every satellite has got to on its way out of one blob and into another
 * — is computed from `t` and the seed alone, never integrated frame by frame.
 * That is what lets `clock: "wall"` start from the time of day and have two
 * screens opened together agree, and what makes `settle` exact: stepping is
 * only ever adding to `t`.
 *
 * **One solid keeps time, and it is the only shape in the lamp.** It sits in
 * the middle at `scale`. Everything else is wax, and the wax is never made or
 * lost: what is not out in lumps lies in the pool along the bottom, and a lump
 * swells out of it, rises, rests at the top, sinks and runs back in. A blob's
 * matter goes as `r²`, so whatever buds, splits or is swallowed takes its
 * matter from one blob and gives it to another.
 *
 * **The depth is thrown away on purpose.** Corners are projected straight down
 * and `z` survives only as `swell`. Blobs merge and split because the lamp is
 * one field: every blob adds to it, and the edge is wherever it crosses 1,
 * traced by marching squares and filled once as a single path.
 *
 * **The beats are a stream the piece does not interpret.** `beatValue(k, salt)`
 * is the k-th value — today a hash of the seed and `k`. It is spent on which
 * way each axis tips, on whether a satellite comes out in a given cycle, which
 * way it goes and where it is swallowed, and on what each lump does in each of
 * its cycles. Replacing the source changes nothing else.
 */

import { context2d, fitCanvas } from "@/experiments/simulation/canvas"
import { steadyLoop } from "@/experiments/simulation/loop"
import { hashSeed } from "@/experiments/random"
import { CLOCK_RATE, HAND_RATIO, SHAPES, type Settings, type Shape } from "@/experiments/melting/settings"

const TAU = Math.PI * 2
const PHI = (1 + Math.sqrt(5)) / 2
/** The land field is sampled on a grid this many css px apart; the coast is interpolated between samples. */
const CELL = 4
/** How far a blob's influence reaches, in its own radii. Its coast is at 1. */
const SUPPORT = 2.2
const KERNEL_AT_COAST = (1 - 1 / (SUPPORT * SUPPORT)) ** 3
/** Lobes round each island, so no coast is a plain circle. */
const LOBES = 3
/** Seconds between the two moments a blob's velocity is measured across. */
const STEP = 0.2
/** How much thinner a blob is when stretched as far as it goes, so its tail adds no matter. */
const THINNING = 0.45
/** Points across the lamp the pool's heaps are evened out over. */
const POOL_SAMPLES = 64
/** How deep the pool's blobs reach, against the depth its wax would lie at spread flat across the lamp. */
const POOL_DEPTH = 1.03
/** The ceiling's thinnest, and how much thicker each unit of `ceiling` makes it at most, as shares of the height. */
const CEILING_LEAST = 0.015
const CEILING_MORE = 0.03
/** Distance between the ceiling's blobs, as a share of the height: close enough that the layer never parts. */
const CEILING_SPACING = 0.03

type Vec = [number, number, number]

// ---------------------------------------------------------------- geometry

const signs = [-1, 1]

function corners(shape: Shape): Vec[] {
  const out: Vec[] = []
  if (shape === "tetra") {
    out.push([1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1])
  } else if (shape === "cube") {
    for (const x of signs) for (const y of signs) for (const z of signs) out.push([x, y, z])
  } else if (shape === "octa") {
    out.push([1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1])
  } else if (shape === "icosa") {
    for (const a of signs) for (const b of signs) out.push([0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b])
  } else {
    for (const x of signs) for (const y of signs) for (const z of signs) out.push([x, y, z])
    for (const a of signs)
      for (const b of signs) out.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI])
  }
  return out.map(normalize)
}

/** Every pair of corners at the shortest distance any pair is apart: a regular solid's edges. Debug only. */
function edgesOf(points: Vec[]): [number, number][] {
  let shortest = Infinity
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) shortest = Math.min(shortest, distance(points[i]!, points[j]!))
  const out: [number, number][] = []
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      if (distance(points[i]!, points[j]!) < shortest * 1.001) out.push([i, j])
  return out
}

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const distance = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
function normalize(a: Vec): Vec {
  const n = Math.sqrt(dot(a, a)) || 1
  return [a[0] / n, a[1] / n, a[2] / n]
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const smooth = (u: number) => u * u * (3 - 2 * u)
/** 0 before `a`, 1 after `b`, and eased between. */
const ramp = (v: number, a: number, b: number) => smooth(Math.min(1, Math.max(0, (v - a) / (b - a))))

/** Any unit vector square to `a`. */
function perpendicular(a: Vec): Vec {
  const other: Vec = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  return normalize(cross(a, other))
}

/** Rodrigues: `v` turned by `angle` about the unit `axis`. */
function rotate(v: Vec, axis: Vec, angle: number): Vec {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = dot(axis, v) * (1 - c)
  const x = cross(axis, v)
  return [v[0] * c + x[0] * s + axis[0] * k, v[1] * c + x[1] * s + axis[1] * k, v[2] * c + x[2] * s + axis[2] * k]
}

/** The fractional part of `t / period`, taken so a wall-clock `t` keeps its precision. */
const phase = (t: number, period: number) => (((t % period) + period) % period) / period
/** `sin` of a whole cycle every `period` seconds, offset by `offset` cycles. */
const wave = (t: number, period: number, offset = 0) => Math.sin((phase(t, period) + offset) * TAU)

/** A seeded unit draw, for things fixed for the life of a scene. */
const fixed = (seed: number, ...salts: number[]) => hashSeed(seed, ...salts) / 4294967296

// ---------------------------------------------------------------- the scene

/** The timekeeper's frame: its size and axes, whichever solid it is in a cycle. */
type Form = { radius: number; axis: Vec; second: Vec }
/** One solid the timekeeper can be: its corners, and the regular solid's edges between them. */
type Solid = { shape: Shape; points: Vec[]; edges: [number, number][] }
/** Where the timekeeper is in its comings and goings, and which solid it is. */
type Keeping = { spread: number; core: number; y: number; pooled: number; solid: Solid }

/** Ids: the solid's corners are `i`, satellites `SATELLITE_ID + corner * 8 + s`, wax `WAX_ID + lump * 2 + part`, the pool `POOL_ID + 1000 + i` and the ceiling `CEILING_ID + 1000 + i`, both counted out from the middle. */
const SATELLITE_ID = 100000
const WAX_ID = 200000
/** The one blob the solid's corners gather into when it goes, and rise as when it comes. */
const CORE_ID = 150000
const POOL_ID = 300000
const CEILING_ID = 400000

/**
 * The share of the wax a lump can take out of the pool, at most, across all of
 * them at once. The rest is always in the pool, so it never runs dry.
 */
const OUT_AT_MOST = 0.85
/**
 * Seconds the timekeeper's matter takes to leave the pool as it comes, or to
 * run back in as it goes. Fixed in seconds rather than as a share of its cycle:
 * the whole solid's matter at once, crossing in a share of a short cycle,
 * swelled every heap of the pool by several pixels a frame.
 */
const EXCHANGE_SECONDS = 7.5
/** The share of a cycle the timekeeper takes to gather into one blob before it changes solid, and again to burst out as the new one. */
const MORPH = 0.12
/** Columns a steered lump keeps to, and how many beats each lighting of them lasts. */
const COLUMNS = 4
const STEER_BEATS = 5
/** Regions of the pool's surface the stream lifts and lowers, and how many beats each draw lasts. */
const REGIONS = 8
const RIPPLE_BEATS = 2

/**
 * Keeps `v` inside `[lo, hi]` without a wall: within `k` of an edge it slows
 * exponentially, so a blob pushed outward gathers against the edge and pools
 * there rather than leaving or bouncing. A blob too big for the room keeps
 * the same easing over half of it, rather than snapping to the middle the
 * frame it outgrows it.
 */
function pool(v: number, lo: number, hi: number, k: number): number {
  k = Math.min(k, (hi - lo) / 2)
  if (!(k > 0)) return (lo + hi) / 2
  if (v < lo + k) return lo + k * Math.exp((v - lo - k) / k)
  if (v > hi - k) return hi - k * Math.exp((hi - k - v) / k)
  return v
}

/**
 * A blob as it lies at some moment, in css px. `id` keys everything seeded
 * about it; `vx`, `vy` is how fast it is moving, in px a second, which is what
 * stretches it. Its matter goes as `r²`: what one blob gives up, another gains.
 */
type Spot = { x: number; y: number; r: number; id: number; vx: number; vy: number }

/** A blob's radius after `area` more of matter, in px², has run into it — or out of it, when negative. */
const grown = (r: number, area: number) => Math.sqrt(Math.max(0, r * r + area))

export function createMelting(canvas: HTMLCanvasElement, initial: Settings) {
  const ctx = context2d(canvas, "melting")

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1
  let gw = 0
  let gh = 0
  let field = new Float32Array(0)
  /** Per edge of the grid: the two edges its coast segment links to, where it crosses, and when last walked. */
  let linkA = new Int32Array(0)
  let linkB = new Int32Array(0)
  let pointX = new Float32Array(0)
  let pointY = new Float32Array(0)
  let visited = new Uint32Array(0)
  let stamp = 1
  const touched: number[] = []
  /** The rows and columns any splat touched this frame, so tracing skips empty sea. */
  let dirty = { x0: 0, x1: 0, y0: 0, y1: 0 }
  let main: Form = { radius: 0, axis: [0, 1, 0], second: [1, 0, 0] }
  const shapes = new Map<Shape, Vec[]>(SHAPES.map((shape) => [shape, corners(shape)]))
  let solids = new Map<Shape, Solid>()
  let t = 0
  /** Seconds the scene's time stands from the wall's. */
  let offset = 0
  let debug = false
  let beatsSeen = 0
  let lastBeat = NaN
  let satellitesOut = 0
  let cornersLost = 0
  let fastest = 0
  let lumpsOut = 0
  let lumpsSplit = 0
  let poolShare = 1
  /** How far the timekeeping solid is spread into corners: 1 there, 0 gone. */
  let keeperShare = 1
  let landCells = 0
  let spotCount = 0
  /** Blobs whose centre lies off screen this frame, the pool aside; the bound should hold it at 0. */
  let outside = 0
  let drawMs = 0
  /** Milliseconds per phase of the last frame: where the time goes, for `stats()`. */
  let phases = { field: 0, coast: 0 }

  function size() {
    ;({ width, height, dpr } = fitCanvas(canvas))
    // One sample off screen on every side, and the far ones a cell beyond the edge.
    gw = Math.ceil(width / CELL) + 3
    gh = Math.ceil(height / CELL) + 3
    field = new Float32Array(gw * gh)
    linkA = new Int32Array(gw * gh * 2).fill(-1)
    linkB = new Int32Array(gw * gh * 2).fill(-1)
    pointX = new Float32Array(gw * gh * 2)
    pointY = new Float32Array(gw * gh * 2)
    visited = new Uint32Array(gw * gh * 2)
    touched.length = 0
    rebuild()
  }

  function clockStart(clock: Settings["clock"]) {
    t = clock === "wall" ? Date.now() / 1000 : 0
    offset = t - Date.now() / 1000
    lastBeat = NaN
  }

  function rebuild() {
    const seed = settings.seed
    // Tipped off every corner, so the solid never turns about one of its symmetry axes.
    const a = fixed(seed, 0, 21)
    const b = fixed(seed, 0, 22)
    const axis = normalize([Math.cos(a * TAU) * 0.6, 1, Math.sin(a * TAU) * 0.6 + 0.17])
    // Each corner pushed off its place by a fixed draw, so no turn of the solid maps it onto itself.
    const off = settings.irregular
    solids = new Map(
      SHAPES.map((shape) => {
        const regular = shapes.get(shape)!
        const points = off
          ? regular.map((p, i) => normalize(p.map((v, j) => v + off * (fixed(seed, 201, i, j) * 2 - 1)) as Vec))
          : regular
        return [shape, { shape, points, edges: edgesOf(regular) }]
      }),
    )
    main = {
      radius: (Math.min(width, height) / 2) * settings.scale,
      axis,
      second: normalize(cross(axis, [b - 0.5, 0.3, 1])),
    }
  }

  // ------------------------------------------------------------ the stream

  /** The k-th beat's value for one use, in [0, 1). The piece's one source of variability over time. */
  const beatValue = (k: number, salt: number) =>
    hashSeed(settings.seed, Math.floor(k / 4294967296), k >>> 0, salt) / 4294967296

  /** A beat's axis: `base` tipped `nudge` degrees in a direction the beat draws. */
  function beatAxis(base: Vec, k: number, salt: number): Vec {
    if (settings.nudge === 0) return base
    const side = rotate(perpendicular(base), base, beatValue(k, salt) * TAU)
    return rotate(base, side, (settings.nudge * Math.PI) / 180)
  }

  function axisAt(base: Vec, at: number, salt: number): Vec {
    const k = Math.floor(at / settings.beat)
    const u = smooth(at / settings.beat - k)
    const from = beatAxis(base, k, salt)
    const to = beatAxis(base, k + 1, salt)
    return normalize([lerp(from[0], to[0], u), lerp(from[1], to[1], u), lerp(from[2], to[2], u)])
  }

  // ------------------------------------------------------------ the solid

  /** Corner `p` of the solid turned to time `at`. */
  function turn(p: Vec, at: number): Vec {
    const angle = phase(at, settings.turn * 4) * TAU
    const axis = axisAt(main.axis, at, 1)
    if (settings.motion === "tumble") {
      const second = phase(at, settings.turn * 4 * PHI) * TAU
      p = rotate(p, axisAt(main.second, at, 2), second)
    }
    p = rotate(p, axis, angle)
    for (let level = 1; level <= settings.hands; level++) p = handAt(p, at, level)
    return p
  }

  /**
   * Slow hand `level` tips `p`: by `sway` degrees about an axis the stream draws
   * once every `HAND_RATIO ** level` beats, eased from one draw to the next as a
   * turning vector, so the tilt never jumps. Every hand is as big as every other;
   * what makes the slow ones an hour hand is only that they change slowly, so a
   * pose the fast motion comes back to is tipped differently each time.
   */
  function handAt(p: Vec, at: number, level: number): Vec {
    const period = settings.beat * HAND_RATIO ** level
    const k = Math.floor(at / period)
    const u = smooth(at / period - k)
    const draw = (n: number): Vec => {
      const z = 2 * beatValue(n, 95000 + level * 2) - 1
      const around = beatValue(n, 95001 + level * 2) * TAU
      const flat = Math.sqrt(1 - z * z)
      const size = (settings.sway * Math.PI) / 180
      return [flat * Math.cos(around) * size, flat * Math.sin(around) * size, z * size]
    }
    const a = draw(k)
    const b = draw(k + 1)
    const turning: Vec = [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]
    const angle = Math.sqrt(dot(turning, turning))
    return angle > 1e-9 ? rotate(p, [turning[0] / angle, turning[1] / angle, turning[2] / angle], angle) : p
  }

  /** The screen is the lamp: a blob pushed past an edge pools against it. */
  function bound(spot: Spot): Spot {
    const k = spot.r * 1.5
    spot.x = pool(spot.x, spot.r * 0.8, width - spot.r * 0.8, k)
    spot.y = pool(spot.y, spot.r * 0.8, height - spot.r * 0.8, k)
    return spot
  }

  /**
   * Where the solid is in its comings and goings at `at`, and which solid it
   * is: how far it is spread into corners, and how much of its matter is
   * gathered in one blob at height `y` or lying in the pool. The three shares
   * always add to 1.
   *
   * It lives in cycles of `cycle` quarter turns, and `keeper` is the chance it
   * is there in any one. Going, its corners draw together into one blob of all
   * their matter, which sinks into the pool; coming, a blob swells out of the
   * pool, rises to the middle and spreads into corners. `change` is the chance a
   * cycle draws its solid afresh; between two cycles that are both there but
   * differ, the corners gather into one blob in the middle and burst out again
   * as the other solid, without sinking.
   */
  function keeperAt(at: number): Keeping {
    const middle = height / 2
    const kept = solids.get(settings.shape)!
    if (settings.keeper >= 1 && settings.change <= 0) return { spread: 1, core: 0, y: middle, pooled: 0, solid: kept }
    const length = settings.turn * settings.cycle
    const v = phase(at, length)
    const k = Math.round(at / length - v)
    const there = (n: number) => settings.keeper >= 1 || beatValue(n, 90000) < settings.keeper
    const shapeOf = (n: number) =>
      settings.change > 0 && beatValue(n, 91000) < settings.change
        ? SHAPES[Math.floor(beatValue(n, 91001) * SHAPES.length)]!
        : settings.shape
    const solid = solids.get(shapeOf(k))!
    const exchange = Math.min(0.12, EXCHANGE_SECONDS / length)
    if (!there(k)) return { spread: 0, core: 0, y: height, pooled: 1, solid }
    if (v < 0.25 && !there(k - 1)) {
      const out = ramp(v, 0, exchange)
      const spread = ramp(v, 0.12, 0.25)
      return { spread, core: out * (1 - spread), y: lerp(height, middle, ramp(v, 0, 0.12)), pooled: 1 - out, solid }
    }
    if (v < MORPH && shapeOf(k - 1) !== shapeOf(k)) {
      const spread = ramp(v, 0, MORPH)
      return { spread, core: 1 - spread, y: middle, pooled: 0, solid }
    }
    if (v > 0.75 && !there(k + 1)) {
      const gathered = ramp(v, 0.75, 0.88)
      const sunk = ramp(v, 1 - exchange, 1)
      return {
        spread: 1 - gathered,
        core: gathered * (1 - sunk),
        y: lerp(middle, height, ramp(v, 0.88, 1)),
        pooled: sunk,
        solid,
      }
    }
    if (v > 1 - MORPH && shapeOf(k + 1) !== shapeOf(k)) {
      const spread = 1 - ramp(v, 1 - MORPH, 1)
      return { spread, core: 1 - spread, y: middle, pooled: 0, solid }
    }
    return { spread: 1, core: 0, y: middle, pooled: 0, solid }
  }

  /** The radius of a corner's blob before it swells, in the solid `shape` sets. */
  const cornerRadius = () => settings.size * main.radius
  /** All the timekeeper's matter, as r² summed over its corners: the same whichever solid it is. */
  const keeperMatter = () => shapes.get(settings.shape)!.length * cornerRadius() ** 2

  /** Corner `i` of the solid at `at`, flattened onto the screen and spread as far as the solid is there. */
  function corner(i: number, at: number, keeping = keeperAt(at)): Spot {
    const p = turn(keeping.solid.points[i]!, at)
    const reach = main.radius * keeping.spread
    // Every solid holds the same matter, so one with more corners has smaller ones.
    const own = Math.sqrt(keeperMatter() / keeping.solid.points.length)
    return bound({
      x: width / 2 + p[0] * reach,
      y: height / 2 - p[1] * reach,
      r: own * (1 + settings.swell * 0.6 * p[2]) * Math.sqrt(keeping.spread),
      id: i,
      vx: 0,
      vy: 0,
    })
  }

  // ------------------------------------------------------------ the wax

  /** All the wax in the lamp, as the area it would cover lying flat, in px². It is never made or lost. */
  const waxArea = () => settings.wax * width * height

  /**
   * Where lump `j` and the part that splits off it are at `at`, and how much of
   * the wax they hold: none of it when the lump is resting in the pool.
   *
   * A lump lives in cycles. In each the stream decides whether it leaves the
   * pool at all — `heat` is the chance — and how big it is, where it rises,
   * where it settles at the top and where it sinks. It swells out of the pool,
   * rises, the bigger the faster, rests against the top, drifting towards
   * wherever the others are gathering, then sinks and runs back in. On the way
   * up it may split: a part buds out of it, lags and sidles off, and joins it
   * again at the top as far as `joining` lets the two gather.
   */
  function lumpAt(j: number, at: number): Spot[] {
    const u = (n: number) => fixed(settings.seed, 101, j, n)
    const length = settings.rise * (3.2 + 1.6 * u(0))
    const cycles = at / length + u(1)
    const c = Math.floor(cycles)
    const v = cycles - c
    const d = (n: number) => beatValue(c, 70000 + j * 16 + n)
    if (d(0) >= settings.heat) return []

    const big = d(1)
    const mass = ((OUT_AT_MOST * waxArea()) / settings.lumps) * (0.35 + 0.65 * big)
    const full = Math.sqrt(mass / Math.PI)
    // Fractions of the cycle: swelling out, risen, settled, sunk; the rest is running back in.
    const swelled = 0.07
    const risen = swelled + 0.16 + 0.14 * (1 - big)
    const settled = risen + 0.1 + 0.2 * d(2)
    const sunk = 0.93
    const when = (f: number) => (c + f - u(1)) * length
    const across = (n: number, f: number) => {
      const free = width * (0.1 + 0.8 * d(n))
      return settings.steer > 0 ? lerp(free, steered(d(n), when(f)), settings.steer) : free
    }
    const [x0, x1, x2] = [across(3, 0), across(4, risen), across(5, sunk)]
    const gathered = lerp(x1, gatherAt(when(settled)), settings.joining)
    const top = full
    const bottom = height - full * 0.5
    const sway = width * 0.04 * (d(6) - 0.5)

    let x: number
    let y: number
    let held: number
    if (v < swelled) {
      const p = smooth(v / swelled)
      ;[x, y, held] = [x0, bottom - full * 0.6 * p, p]
    } else if (v < risen) {
      const p = (v - swelled) / (risen - swelled)
      const e = smooth(p)
      x = lerp(x0, x1, e) + sway * Math.sin(p * Math.PI * 2)
      y = lerp(bottom - full * 0.6, top, e)
      held = 1
    } else if (v < settled) {
      const p = (v - risen) / (settled - risen)
      ;[x, y, held] = [lerp(x1, gathered, smooth(p)), top + full * 0.15 * Math.sin(p * Math.PI), 1]
    } else if (v < sunk) {
      const e = smooth((v - settled) / (sunk - settled))
      ;[x, y, held] = [lerp(gathered, x2, e), lerp(top, bottom, e), 1]
    } else {
      const p = smooth((v - sunk) / (1 - sunk))
      ;[x, y, held] = [x2, bottom + full * 0.4 * p, 1 - p]
    }
    const whole = mass * held
    const lump: Spot = { x, y, r: 0, id: WAX_ID + j * 2, vx: 0, vy: 0 }

    // A split buds a part out of the lump partway up. It grows as it necks off,
    // so no matter appears; lags, being smaller; and comes back as the two
    // gather at the top, then parts again on the way down.
    let part: Spot | null = null
    if (d(7) < settings.splitting && v >= swelled) {
      const at0 = swelled + (risen - swelled) * (0.25 + 0.45 * d(8))
      if (v > at0) {
        const share = 0.25 + 0.25 * d(9)
        const out = ramp(v, at0, at0 + 0.06)
        const together = ramp(v, risen, settled) - ramp(v, settled, settled + 0.08)
        const apart = out * (1 - settings.joining * together)
        const side = d(10) < 0.5 ? -1 : 1
        const lag = full * 1.6 * out * (1 - ramp(v, risen, settled))
        const partMass = whole * share * out
        part = {
          x: x + side * full * (1.2 + 1.4 * d(11)) * apart,
          y: y + lag,
          r: Math.sqrt(partMass / Math.PI),
          id: WAX_ID + j * 2 + 1,
          vx: 0,
          vy: 0,
        }
        lump.r = Math.sqrt((whole - partMass) / Math.PI)
      }
    }
    if (!part) lump.r = Math.sqrt(whole / Math.PI)
    return part ? [bound(lump), bound(part)] : [bound(lump)]
  }

  /**
   * Where a steered lump goes for the draw `d`, at `at`: into one of the
   * columns the stream lights then. The lamp is `COLUMNS` columns, and every
   * `STEER_BEATS` beats the stream lights each one or not, so the wax comes to
   * lie thicker in some than in others. With none lit, anywhere.
   */
  function steered(d: number, at: number): number {
    const w = Math.floor(at / (settings.beat * STEER_BEATS))
    const lit: number[] = []
    for (let col = 0; col < COLUMNS; col++) if (beatValue(w, 97000 + col) < 0.5) lit.push(col)
    if (!lit.length) return width * (0.1 + 0.8 * d)
    const pick = d * lit.length
    const col = lit[Math.min(lit.length - 1, Math.floor(pick))]!
    return (width * (col + 0.2 + 0.6 * (pick - Math.floor(pick)))) / COLUMNS
  }

  /** Where the lumps at the top are drifting together at `at`: one place for all of them, wandering slowly. */
  const gatherAt = (at: number) =>
    width * (0.5 + 0.38 * wave(at, settings.rise * 7, fixed(settings.seed, 102)) * wave(at, settings.rise * 11.3))

  /**
   * How far the stream lifts each of the pool's `REGIONS` regions at `at`, from
   * -1 to 1: a fresh draw every `RIPPLE_BEATS` beats, eased from one to the next
   * over the whole stretch, so the surface never stops moving and never jumps.
   */
  function regionsAt(at: number): number[] {
    const span = settings.beat * RIPPLE_BEATS
    const k = Math.floor(at / span)
    const u = smooth(at / span - k)
    return Array.from({ length: REGIONS }, (_, i) =>
      lerp(beatValue(k, 96000 + i) * 2 - 1, beatValue(k + 1, 96000 + i) * 2 - 1, u),
    )
  }

  /** The regions' lifts eased across the lamp, from one region's middle to the next. */
  function liftAt(lift: number[], x: number): number {
    const at = Math.min(REGIONS - 1, Math.max(0, (x / width) * REGIONS - 0.5))
    const i = Math.floor(at)
    return lerp(lift[i]!, lift[Math.min(REGIONS - 1, i + 1)]!, smooth(at - i))
  }

  /**
   * The pool: whatever wax is not out, lying along the bottom of the lamp in
   * slow heaps. `out` is the area the lumps hold between them, less whatever
   * of the solid has sunk into it.
   */
  function poolOf(out: number, at: number): Spot[] {
    const area = Math.max(0, waxArea() - out)
    const all = waxArea() + Math.PI * keeperMatter() * (settings.keeper < 1 ? 1 : 0)
    poolShare = all > 0 ? area / all : 1
    if (area <= 0) return []
    const depth = area / width
    const spacing = Math.max(CELL * 2, depth * 0.9)
    // Laid out from the middle, so as the spacing changes the blobs at the edges slide half as far.
    const half = Math.ceil(width / 2 / spacing) + 3
    const spots: Spot[] = []
    const lift = settings.ripple > 0 ? regionsAt(at) : null
    const heaps = (x: number) =>
      Math.max(
        0.05,
        0.95 +
          0.28 * Math.sin((x / width) * TAU * 1.3 + phase(at, settings.rise * 9) * TAU) +
          0.22 * Math.sin((x / width) * TAU * 2.7 - phase(at, settings.rise * 13) * TAU) +
          (lift ? 0.7 * settings.ripple * liftAt(lift, x) : 0),
      )
    // Matter goes as r², so the heaps are evened out by their squares, one rising as
    // others fall. The evening is taken over fixed points across the lamp rather than
    // over the blobs themselves: their count steps as the pool deepens, and evening
    // over them made the whole surface jump in one frame each time it did.
    let sum = 0
    for (let k = 0; k < POOL_SAMPLES; k++) sum += heaps(((k + 0.5) / POOL_SAMPLES) * width) ** 2
    const even = depth * POOL_DEPTH * Math.sqrt(POOL_SAMPLES / sum)
    for (let i = -half; i <= half; i++) {
      const x = width / 2 + i * spacing
      // Well past either edge a blob fades out, so one added there as the spacing shrinks
      // grows in from nothing, and too far out for the fading to show on screen.
      const edge = width / 2 + 1.5 * spacing
      const r = even * heaps(x) * (1 - ramp(Math.abs(x - width / 2), edge, edge + spacing))
      spots.push({ x, y: height + r * 0.25, r, id: POOL_ID + 1000 + i, vx: 0, vy: 0 })
    }
    return spots
  }

  /**
   * The ceiling: wax hanging under the top edge, as a row of blobs whose
   * centres sit a quarter radius above it, like the pool's below the bottom.
   * Its depth undulates slowly by two waves whose phases the seed fixes, and
   * never comes nearer the edge than `CEILING_LEAST` of the height. It holds
   * whatever the rest of the wax does; a lump that rises into it merges in the
   * field and parts again as it sinks. It is the pool's counterweight, so the
   * lamp can be turned on its side.
   */
  function ceilingOf(at: number): Spot[] {
    const spacing = CEILING_SPACING * height
    // A canvas with no height has no ceiling, and would loop for ever below.
    if (!(spacing > 0)) return []
    const half = Math.ceil(width / 2 / spacing) + 3
    const p1 = fixed(settings.seed, 301, 0)
    const p2 = fixed(settings.seed, 301, 1)
    const spots: Spot[] = []
    for (let i = -half; i <= half; i++) {
      const x = width / 2 + i * spacing
      const swell =
        0.5 +
        0.3 * Math.sin(((x / width) * 1.1 + p1) * TAU + phase(at, settings.rise * 11) * TAU) +
        0.2 * Math.sin(((x / width) * 2.3 + p2) * TAU - phase(at, settings.rise * 17) * TAU)
      const depth = height * (CEILING_LEAST + CEILING_MORE * settings.ceiling * Math.min(1, Math.max(0, swell)))
      // The coast lies three quarters of a radius below a centre a quarter radius above the edge.
      const r = depth / 0.75
      spots.push({ x, y: -r * 0.25, r, id: CEILING_ID + 1000 + i, vx: 0, vy: 0 })
    }
    return spots
  }

  /**
   * Every blob except satellites at `at`, in place: the solid's corners first —
   * the only ones that keep time — then the blob they gather into while the
   * solid comes or goes, then the wax that is out, then the pool.
   */
  function bodiesAt(at: number): Spot[] {
    const spots: Spot[] = []
    const keeping = keeperAt(at)
    for (let i = 0; i < keeping.solid.points.length; i++) spots.push(corner(i, at, keeping))
    const matter = keeperMatter()
    if (keeping.core > 0) {
      const r = Math.sqrt(matter * keeping.core)
      spots.push({ x: width / 2, y: Math.min(keeping.y, height - r * 0.5), r, id: CORE_ID, vx: 0, vy: 0 })
    }
    keeperShare = keeping.spread
    let out = 0
    poolShare = 1
    lumpsOut = 0
    lumpsSplit = 0
    for (let j = 0; j < settings.lumps && settings.wax > 0; j++) {
      const lump = lumpAt(j, at)
      if (lump.length) lumpsOut++
      if (lump.length > 1) lumpsSplit++
      for (const spot of lump) {
        out += Math.PI * spot.r * spot.r
        spots.push(spot)
      }
    }
    // A bottomless pool keeps its level whatever is out of it.
    spots.push(...poolOf((out - Math.PI * matter * keeping.pooled) * (1 - settings.reservoir), at))
    // Last, so the field's sums for every other blob keep their order.
    if (settings.ceiling > 0) spots.push(...ceilingOf(at))
    return spots
  }

  /** How many beats one cycle of corner `p`'s satellite `s` lasts. */
  const satelliteLength = (p: number, s: number) => 3 + Math.floor(fixed(settings.seed, 81, p, s, 0) * 6)

  /**
   * Whether corner `p`'s satellite `s` comes out in its cycle `c`, and if so
   * which corner swallows it and how the corner was moving when the cycle
   * opened. A corner moving fast then is stretched, so it is likelier to bud,
   * and buds from its trailing end.
   */
  function budOf(p: number, s: number, c: number, keeping: number) {
    const salt = 30000 + p * 8 + s
    const length = satelliteLength(p, s)
    let urge = 0
    let trailing = 0
    if (settings.stretch > 0) {
      const opened = (c - fixed(settings.seed, 81, p, s, 1)) * length * settings.beat
      const then = keeperAt(opened)
      const before = keeperAt(opened - STEP)
      // A corner the solid had no such corner for then was not moving at all.
      if (p < then.solid.points.length && p < before.solid.points.length) {
        const a = corner(p, opened, then)
        const b = corner(p, opened - STEP, before)
        const speed = Math.hypot(a.x - b.x, a.y - b.y) / STEP
        urge = Math.min(1, speed / Math.max(1, a.r)) * settings.stretch
        trailing = Math.atan2(b.y - a.y, b.x - a.x)
      }
    }
    if (beatValue(c, salt) >= settings.presence * (1 - settings.stretch + urge)) return null
    const roams = keeping > 1 && beatValue(c, salt + 1) < settings.roam
    const other = (p + 1 + Math.floor(beatValue(c, salt + 2) * (keeping - 1))) % keeping
    return { into: roams ? other : p, urge, trailing }
  }

  /** Every blob at time `at`: the bodies, then every satellite. */
  function blobsAt(at: number): Spot[] {
    // The moment before first, so the counts `stats()` reads are left at this one.
    const before = new Map(bodiesAt(at - STEP).map((spot) => [spot.id, spot]))
    const now = bodiesAt(at)
    fastest = 0
    for (const spot of now) {
      const then = before.get(spot.id)
      if (!then || spot.id >= POOL_ID) continue
      spot.vx = (spot.x - then.x) / STEP
      spot.vy = (spot.y - then.y) / STEP
      fastest = Math.max(fastest, Math.hypot(spot.vx, spot.vy))
    }
    const beats = at / settings.beat
    // While the solid is gone its corners are empty, so nothing is lost from them and nothing buds.
    const standing = keeperAt(at)
    const keeping = standing.spread > 0 ? standing.solid.points.length : 0
    const out = now.map((spot) => ({ ...spot }))
    /** Matter run into each corner, or out of it, in px² of r², settled once every move is known. */
    const gained = new Float64Array(keeping)

    // A corner that loses its place runs into a neighbouring corner and is
    // swallowed there halfway through its cycle, its matter with it, and is
    // budded out of it again to find its way back.
    cornersLost = 0
    if (settings.integrity < 1 && keeping > 1) {
      for (let p = 0; p < keeping; p++) {
        const u = (n: number) => fixed(settings.seed, 91, p, n)
        const salt = 50000 + p * 4
        const cycles = beats / (4 + Math.floor(u(0) * 7)) + u(1)
        const c = Math.floor(cycles)
        if (beatValue(c, salt) < settings.integrity) continue
        const v = cycles - c
        const other = (p + 1 + Math.floor(beatValue(c, salt + 1) * (keeping - 1))) % keeping
        const into = Math.sin(Math.PI * v)
        const left = Math.abs(Math.cos(Math.PI * v))
        const spot = out[p]!
        spot.x = lerp(now[p]!.x, now[other]!.x, into)
        spot.y = lerp(now[p]!.y, now[other]!.y, into)
        const r2 = now[p]!.r ** 2
        gained[p]! -= r2 * (1 - left)
        gained[other]! += r2 * (1 - left)
        cornersLost++
      }
    }

    // Satellites bud out of a corner, roam, and are swallowed — by the corner
    // they left or by a neighbour. Each lives in cycles of a few beats, and the
    // beat that opens a cycle decides whether it comes out at all, which way,
    // how far and where it ends. A corner that was moving fast when the cycle
    // opened is stretched, so it is likelier to bud and buds from its trailing
    // end. Its matter is the corner's: it necks off taking it, and gives it to
    // whichever corner swallows it.
    satellitesOut = 0
    const satellites: Spot[] = []
    for (let p = 0; p < keeping && settings.satellites > 0; p++) {
      const parent = out[p]!
      for (let s = 0; s < settings.satellites; s++) {
        const u = (n: number) => fixed(settings.seed, 81, p, s, n)
        const salt = 30000 + p * 8 + s
        const cycles = beats / satelliteLength(p, s) + u(1)
        const c = Math.floor(cycles)
        const v = cycles - c
        const bud = budOf(p, s, c, keeping)
        const whole = (now[p]!.r * (0.24 + 0.2 * u(3))) ** 2
        // What the last one carried to a neighbour seeps back while this one buds,
        // so the matter never jumps home when a cycle turns over.
        const last = budOf(p, s, c - 1, keeping)
        if (last && last.into !== p) {
          const still = 1 - ramp(v, 0, 0.35)
          gained[p]! -= whole * still
          gained[last.into]! += whole * still
        }
        if (!bud) continue
        const { into, urge, trailing } = bud
        const target = out[into]!
        const free = beatValue(c, salt + 3) * TAU
        const heading = urge > 0 ? trailing + (free - Math.PI) * (1 - urge) : free
        const angle = heading + (v - 0.5) * (u(2) - 0.5) * 2
        const away = now[p]!.r * (1.4 + 1.6 * beatValue(c, salt + 4)) * Math.sin(Math.PI * v) ** 0.8
        const along = smooth(v)
        const left = smooth(Math.min(1, v / 0.35))
        const taken = smooth(Math.max(0, (v - 0.65) / 0.35))
        gained[p]! -= whole * left
        gained[into]! += whole * taken
        satellites.push(
          bound({
            x: lerp(parent.x, target.x, along) + Math.cos(angle) * away,
            y: lerp(parent.y, target.y, along) + Math.sin(angle) * away,
            r: Math.sqrt(whole * (left - taken)),
            id: SATELLITE_ID + p * 8 + s,
            vx: 0,
            vy: 0,
          }),
        )
        satellitesOut++
      }
    }
    // A corner never gives up more than three quarters of itself, however many buds are out at once.
    for (let p = 0; p < keeping; p++) {
      const r = now[p]!.r
      out[p]!.r = Math.max(r * 0.5, grown(r, gained[p]!))
    }
    return out.concat(satellites)
  }

  // ------------------------------------------------------------ the land field

  /**
   * Adds one blob to the land field. Sample `gx` sits at `(gx - 1) * CELL`, so
   * the grid's outermost samples lie off screen; they are never written, which
   * keeps them sea and every coast a closed loop.
   */
  function splat(x: number, y: number, r: number, weight: number) {
    if (r <= 0) return
    const reach = r * SUPPORT
    const gx0 = Math.max(1, Math.floor((x - reach) / CELL) + 1)
    const gx1 = Math.min(gw - 2, Math.ceil((x + reach) / CELL) + 1)
    const gy0 = Math.max(1, Math.floor((y - reach) / CELL) + 1)
    const gy1 = Math.min(gh - 2, Math.ceil((y + reach) / CELL) + 1)
    if (gx0 > gx1 || gy0 > gy1) return
    dirty.x0 = Math.min(dirty.x0, gx0)
    dirty.x1 = Math.max(dirty.x1, gx1)
    dirty.y0 = Math.min(dirty.y0, gy0)
    dirty.y1 = Math.max(dirty.y1, gy1)
    const inv = 1 / (reach * reach)
    const scale = weight / KERNEL_AT_COAST
    for (let gy = gy0; gy <= gy1; gy++) {
      const dy = (gy - 1) * CELL - y
      const row = gy * gw
      for (let gx = gx0; gx <= gx1; gx++) {
        const dx = (gx - 1) * CELL - x
        const q = 1 - (dx * dx + dy * dy) * inv
        if (q > 0) field[row + gx]! += q * q * q * scale
      }
    }
  }

  function blob(spot: Spot, at: number) {
    // A moving blob draws out behind itself into a teardrop, the faster the longer,
    // and is thinner for it: the tail is made of its own matter.
    const speed = Math.hypot(spot.vx, spot.vy)
    const length = settings.stretch > 0 && speed > 0 ? Math.min(spot.r * 2.5, speed * 1.2 * settings.stretch) : 0
    const r = spot.r / (1 + (THINNING * length) / (2.5 * spot.r || 1))
    splat(spot.x, spot.y, r, 1)
    for (let k = 1; k <= 3 && length > 0; k++) {
      const back = (length * k) / 3 / speed
      splat(spot.x - spot.vx * back, spot.y - spot.vy * back, r * (1 - 0.2 * k), 0.9)
    }
    // Lobes turn slowly round the island, so its coast is never a circle and never still.
    for (let s = 0; s < LOBES; s++) {
      const u = (n: number) => fixed(settings.seed, 41, spot.id, s, n)
      const a = (u(0) + (u(2) < 0.5 ? 1 : -1) * phase(at, 60 + 90 * u(1))) * TAU
      const d = r * (0.45 + 0.35 * u(3))
      splat(spot.x + Math.cos(a) * d, spot.y + Math.sin(a) * d, r * (0.4 + 0.25 * u(4)), 0.8)
    }
  }

  /**
   * The coast, by marching squares, chained into closed loops and filled once.
   *
   * Every cell the coast crosses adds a segment between two of its edges; each
   * crossed edge is shared by exactly two cells, so following the segments edge
   * to edge closes every loop. The cost goes with the length of the coastline
   * rather than with the number of cells — filling one path of a polygon per
   * cell was 137 ms a frame on a crowded ocean. Lakes come out as inner loops,
   * which `evenodd` leaves as sea whichever way they wind.
   */
  function traceCoast() {
    // Edge ids: 2·sample for the edge running right from a sample, 2·sample + 1 for the one running down.
    for (const e of touched) {
      linkA[e] = -1
      linkB[e] = -1
    }
    touched.length = 0
    const link = (e: number, f: number) => {
      if (linkA[e] === -1) {
        linkA[e] = f
        touched.push(e)
      } else linkB[e] = f
      if (linkA[f] === -1) {
        linkA[f] = e
        touched.push(f)
      } else linkB[f] = e
    }
    const crossing = (e: number, v: number, w: number, x: number, y: number, right: boolean) => {
      const k = (1 - v) / (w - v)
      pointX[e] = right ? x + k * CELL : x
      pointY[e] = right ? y : y + k * CELL
      return e
    }

    let land = 0
    for (let gy = dirty.y0 - 1; gy <= dirty.y1; gy++) {
      for (let gx = dirty.x0 - 1; gx <= dirty.x1; gx++) {
        const n = gy * gw + gx
        const a = field[n]!
        const b = field[n + 1]!
        const c = field[n + gw + 1]!
        const d = field[n + gw]!
        const index = (a >= 1 ? 8 : 0) | (b >= 1 ? 4 : 0) | (c >= 1 ? 2 : 0) | (d >= 1 ? 1 : 0)
        if (a >= 1) land++
        if (index === 0 || index === 15) continue
        const x = (gx - 1) * CELL
        const y = (gy - 1) * CELL
        const top = index & 8 ? (index & 4 ? -1 : 1) : index & 4 ? 1 : -1
        const right = index & 4 ? (index & 2 ? -1 : 1) : index & 2 ? 1 : -1
        const bottom = index & 1 ? (index & 2 ? -1 : 1) : index & 2 ? 1 : -1
        const left = index & 8 ? (index & 1 ? -1 : 1) : index & 1 ? 1 : -1
        const T = top > 0 ? crossing(2 * n, a, b, x, y, true) : -1
        const R = right > 0 ? crossing(2 * (n + 1) + 1, b, c, x + CELL, y, false) : -1
        const B = bottom > 0 ? crossing(2 * (n + gw), d, c, x, y + CELL, true) : -1
        const L = left > 0 ? crossing(2 * n + 1, a, d, x, y, false) : -1
        if (index === 5 || index === 10) {
          // A saddle: two diagonal corners of land. The centre decides whether they join.
          const joined = (a + b + c + d) / 4 >= 1
          if ((index === 5) === joined) {
            link(T, L)
            link(R, B)
          } else {
            link(T, R)
            link(L, B)
          }
          continue
        }
        const ends = [T, R, B, L].filter((e) => e >= 0)
        link(ends[0]!, ends[1]!)
      }
    }
    landCells = land

    ctx.beginPath()
    for (const start of touched) {
      if (visited[start] === stamp) continue
      let previous = -1
      let edge = start
      ctx.moveTo(pointX[edge]!, pointY[edge]!)
      while (visited[edge] !== stamp) {
        visited[edge] = stamp
        ctx.lineTo(pointX[edge]!, pointY[edge]!)
        const next = linkA[edge] !== previous ? linkA[edge]! : linkB[edge]!
        previous = edge
        edge = next
        if (edge < 0) break
      }
      ctx.closePath()
    }
    stamp++
    ctx.fill("evenodd")
  }

  // ------------------------------------------------------------ colour

  /** The colour of palette entry `n`: the hue and as many more, spaced evenly round the wheel. */
  const paletteHue = (n: number) => settings.hue + (n * 360) / settings.colours

  /**
   * The hue blob `spot` is drawn in at `at`, or null for the plain hue. A
   * corner draws its colour afresh every few beats and turns to it over a
   * moment, the whole blob at once; its satellites wear its colour. A lump
   * draws one each time it leaves the pool, so it changes only while it is in
   * it. The pool and the gathered timekeeper keep the plain hue.
   */
  function hueOf(spot: Spot, at: number): number | null {
    let corner = -1
    if (spot.id < SATELLITE_ID) corner = spot.id
    else if (spot.id < CORE_ID) corner = Math.floor((spot.id - SATELLITE_ID) / 8)
    if (corner >= 0) {
      const beats = 3 + Math.floor(fixed(settings.seed, 111, corner) * 4)
      const cycles = at / (settings.beat * beats) + fixed(settings.seed, 112, corner)
      const c = Math.floor(cycles)
      const pick = (n: number) => paletteHue(Math.floor(beatValue(n, 98000 + corner) * settings.colours))
      const from = pick(c - 1)
      const to = pick(c)
      // The short way round the wheel.
      const turn = ((((to - from) % 360) + 540) % 360) - 180
      return from + turn * ramp(cycles - c, 0, 0.12)
    }
    if (spot.id >= WAX_ID && spot.id < POOL_ID) {
      const j = Math.floor((spot.id - WAX_ID) / 2)
      const length = settings.rise * (3.2 + 1.6 * fixed(settings.seed, 101, j, 0))
      const c = Math.floor(at / length + fixed(settings.seed, 101, j, 1))
      return paletteHue(Math.floor(beatValue(c, 70000 + j * 16 + 12) * settings.colours))
    }
    return null
  }

  /**
   * Paints the land in colours, inside the coast just filled: each blob's own
   * patch, flat, the wax first and the timekeeper over it. What no patch
   * reaches — the necks between blobs, the tails — keeps the plain hue.
   */
  function paint(spots: Spot[]) {
    const { tint } = settings
    const saturation = Math.round(Math.max(0.35, tint) * 90)
    const lightness = Math.round(100 - Math.max(0.35, tint) * 40)
    ctx.save()
    ctx.clip("evenodd")
    const order = [
      ...spots.filter((spot) => spot.id >= WAX_ID && spot.id < POOL_ID),
      ...spots.filter((spot) => spot.id < SATELLITE_ID),
      ...spots.filter((spot) => spot.id >= SATELLITE_ID && spot.id < CORE_ID),
    ]
    for (const spot of order) {
      const hue = hueOf(spot, t)
      if (hue === null || spot.r <= 0) continue
      ctx.fillStyle = `hsl(${hue} ${saturation}% ${lightness}%)`
      ctx.beginPath()
      ctx.arc(spot.x, spot.y, spot.r * 1.3, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  // ------------------------------------------------------------ drawing

  function step(dt: number) {
    t += dt * settings.timescale * CLOCK_RATE
    offset = t - Date.now() / 1000
    counted()
  }

  /**
   * A frame's worth of time. On the wall clock at normal speed the scene reads
   * the wall rather than adding up frames: the loop clamps a slow frame, so a
   * machine drawing fewer than ten frames a second fell behind the time it
   * shows, and a hidden tab stopped it. `offset` carries whatever `settle`, a
   * slowed clock or `goto` has set it away from the wall, so none of them jumps.
   */
  function tick(dt: number) {
    if (settings.clock !== "wall" || settings.timescale * CLOCK_RATE !== 1) return step(dt)
    t = Date.now() / 1000 + offset
    counted()
  }

  function counted() {
    const k = Math.floor(t / settings.beat)
    if (k !== lastBeat) {
      if (lastBeat === lastBeat) beatsSeen++
      lastBeat = k
    }
  }

  /** The land field at `at`, and every blob in it. */
  function fieldAt(at: number): Spot[] {
    field.fill(0)
    dirty = { x0: gw, x1: -1, y0: gh, y1: -1 }
    const spots = blobsAt(at)
    for (const spot of spots) blob(spot, at)
    return spots
  }

  function draw() {
    const started = performance.now()
    const spots = fieldAt(t)
    spotCount = spots.length
    outside = spots.filter(
      (spot) => spot.id < POOL_ID && (spot.x < 0 || spot.y < 0 || spot.x > width || spot.y > height),
    ).length
    const fielded = performance.now()

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)
    const { hue, tint } = settings
    ctx.fillStyle = tint > 0 ? `hsl(${hue} ${Math.round(tint * 90)}% ${Math.round(100 - tint * 40)}%)` : "#fff"
    traceCoast()
    if (settings.colours > 1) paint(spots)
    phases = { field: fielded - started, coast: performance.now() - fielded }
    if (debug) drawDebug(spots)
    const ms = performance.now() - started
    drawMs = drawMs ? drawMs * 0.9 + ms * 0.1 : ms
  }

  function drawDebug(spots: Spot[]) {
    const solid = keeperAt(t).solid
    const keeping = solid.points.length
    ctx.save()
    ctx.lineWidth = 1
    ctx.strokeStyle = "rgb(255 80 80 / 70%)"
    ctx.beginPath()
    for (const [i, j] of solid.edges) {
      ctx.moveTo(spots[i]!.x, spots[i]!.y)
      ctx.lineTo(spots[j]!.x, spots[j]!.y)
    }
    ctx.stroke()
    ctx.font = "12px ui-monospace, monospace"
    ctx.fillStyle = "rgb(255 80 80)"
    for (let i = 0; i < keeping; i++) ctx.fillText(String(i), spots[i]!.x + 8, spots[i]!.y - 8)
    const k = Math.floor(t / settings.beat)
    const lines = [
      `t ${t.toFixed(2)}s`,
      `beat ${k}  ${((t / settings.beat - k) * 100).toFixed(0)}%`,
      `turn ${(phase(t, settings.turn * 4) * 4).toFixed(3)} quarters`,
      `${spots.length} blobs, ${satellitesOut} satellites out, ${keeping} keeping time`,
      `${lumpsOut} lumps out, ${lumpsSplit} split, ${Math.round(poolShare * 100)}% of the wax in the pool`,
      `${drawMs.toFixed(1)} ms a frame`,
    ]
    ctx.textAlign = "right"
    lines.forEach((line, n) => ctx.fillText(line, width - 16, height - 60 - (lines.length - 1 - n) * 16))
    ctx.restore()
  }

  const loop = steadyLoop({ clamp: 0.1, step: tick, draw })

  function onResize() {
    size()
  }

  /** Landmasses on the field's grid, by flood fill — how many separate blobs there are right now. */
  function landmasses(): number {
    const seen = new Uint8Array(field.length)
    let count = 0
    const stack: number[] = []
    for (let start = 0; start < field.length; start++) {
      if (seen[start] || field[start]! < 1) continue
      count++
      stack.push(start)
      seen[start] = 1
      while (stack.length) {
        const n = stack.pop()!
        const x = n % gw
        for (const m of [n - gw, n + gw, x > 0 ? n - 1 : -1, x < gw - 1 ? n + 1 : -1]) {
          if (m < 0 || m >= field.length || seen[m] || field[m]! < 1) continue
          seen[m] = 1
          stack.push(m)
        }
      }
    }
    return count
  }

  function stats() {
    const k = Math.floor(t / settings.beat)
    const round = (v: number, d = 3) => Number(v.toFixed(d))
    return {
      shape: settings.shape,
      keepingTime: keeperAt(t).solid.points.length,
      solid: keeperAt(t).solid.shape,
      blobs: spotCount,
      landmasses: landmasses(),
      landCover: round(landCells / Math.max(1, field.length), 5),
      t: round(t),
      beat: k,
      beatPhase: round(t / settings.beat - k),
      beatsSeen,
      quarters: round(phase(t, settings.turn * 4) * 4),
      axis: axisAt(main.axis, t, 1).map((v) => round(v)),
      satellitesOut,
      cornersLost,
      lumpsOut,
      lumpsSplit,
      poolShare: round(poolShare),
      keeper: round(keeperShare),
      outside,
      fastestPx: round(fastest, 1),
      drawMs: round(drawMs, 2),
      phaseMs: { field: round(phases.field, 2), coast: round(phases.coast, 2) },
      frame: { width, height },
      fps: Math.round(loop.fps()),
      running: loop.running(),
      held: loop.held(),
    }
  }

  size()
  clockStart(settings.clock)

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
      const moved = (["shape", "seed", "scale", "irregular"] as const).some((key) => before[key] !== next[key])
      if (moved) rebuild()
      if (before.clock !== next.clock) clockStart(next.clock)
    },
    setPaused(on: boolean) {
      loop.setHeld(on)
    },
    settle(seconds: number) {
      step(seconds)
      draw()
    },
    /** Puts the scene at time `at`, in seconds — since 1970 on the wall clock — and draws it there. */
    goto(at: number) {
      t = at
      offset = t - Date.now() / 1000
      lastBeat = NaN
      counted()
      draw()
    },
    debug(on?: boolean) {
      debug = on ?? !debug
      return debug
    },
    /** Every blob drawn now, by id: the raw material, for checking that nothing jumps between frames. */
    blobs() {
      return blobsAt(t).map(({ id, x, y, r }) => ({ id, x, y, r }))
    },
    stats,
  }
}
