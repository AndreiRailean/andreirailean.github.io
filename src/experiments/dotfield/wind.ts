/**
 * The air over the field: a prevailing wind that veers, gusts that arrive as
 * events from their own directions, and eddies.
 *
 * The first cut was a sum of travelling plane waves, and it read as exactly
 * that — the same wave patterns as flotsam's sea, rolling through from one
 * direction, with gusts that were only "more wind" along the breeze. Andrei's
 * words are in `seed.md`. What replaced it, part by part:
 *
 * - **The prevailing direction wanders** by up to `veer` degrees either side of
 *   `direction`, on layered sines of incommensurate rates, so it never repeats
 *   at a period anyone will sit through. A change of direction is carried
 *   downwind at `drift`, so it sweeps across the field instead of turning
 *   every column at once. `lulls` does the same for its strength.
 * - **A gust is an event**, as in dangler: scheduled from the clock and the
 *   seed at `gustRate` a minute, jittered within its slot, blowing from the
 *   prevailing direction give or take `gustSpread`. It is a patch `gustSize`
 *   wide whose front crosses the field at `drift`, rising fast and falling
 *   slowly behind the front.
 * - **Eddies are the curl of 3D gradient noise** — space and time — carried
 *   along by the prevailing wind, so they turn across it without converging
 *   anywhere and never repeat.
 *
 * Every rate is integrated per frame rather than read off the clock, so
 * dragging a rate changes how fast things move and never jumps them.
 */

import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import type { Settings } from "@/experiments/dotfield/settings"

const TAU = Math.PI * 2
const DEG = Math.PI / 180

const GUST_ATTACK = 0.25
const GUST_DECAY = 1.4
/** The envelope's raw peak, sampled rather than written down, so `gusts` means the peak lean whatever the shape. */
const GUST_PEAK = (() => {
  let peak = 0
  for (let t = 0; t < 6; t += 0.002) peak = Math.max(peak, (1 - Math.exp(-t / GUST_ATTACK)) * Math.exp(-t / GUST_DECAY))
  return peak
})()
/** How long behind its front a gust is still worth evaluating. */
const GUST_TAIL = GUST_DECAY * 6
/** Never track more than this many gusts at once, whatever the rate. */
const MAX_GUSTS = 48
/** A front never crosses slower than this, or a drift of 0 parks a gust forever. */
const MIN_FRONT_SPEED = 40
const SALT_GUST = 0x6057

export function gustEnvelope(since: number): number {
  if (since <= 0) return 0
  return ((1 - Math.exp(-since / GUST_ATTACK)) * Math.exp(-since / GUST_DECAY)) / GUST_PEAK
}

/** Seeded 3D gradient noise, roughly in [-1, 1]. */
export function makeNoise3(rng: Rng) {
  const perm = new Uint8Array(512)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[p[i], p[j]] = [p[j]!, p[i]!]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!
  // The twelve edge directions of a cube: Perlin's improved gradients.
  const G = [
    [1, 1, 0],
    [-1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
    [1, 0, 1],
    [-1, 0, 1],
    [1, 0, -1],
    [-1, 0, -1],
    [0, 1, 1],
    [0, -1, 1],
    [0, 1, -1],
    [0, -1, -1],
  ]
  const gx = new Float32Array(256)
  const gy = new Float32Array(256)
  const gz = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const g = G[i % 12]!
    gx[i] = g[0]!
    gy[i] = g[1]!
    gz[i] = g[2]!
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  return (x: number, y: number, z: number) => {
    const X = Math.floor(x)
    const Y = Math.floor(y)
    const Z = Math.floor(z)
    const fx = x - X
    const fy = y - Y
    const fz = z - Z
    const u = fade(fx)
    const v = fade(fy)
    const w = fade(fz)
    const A = perm[X & 255]! + (Y & 255)
    const B = perm[(X + 1) & 255]! + (Y & 255)
    const g = (h: number, dx: number, dy: number, dz: number) => gx[h]! * dx + gy[h]! * dy + gz[h]! * dz
    const AA = perm[A & 511]! + (Z & 255)
    const AB = perm[(A + 1) & 511]! + (Z & 255)
    const BA = perm[B & 511]! + (Z & 255)
    const BB = perm[(B + 1) & 511]! + (Z & 255)
    return lerp(
      lerp(
        lerp(g(perm[AA & 511]!, fx, fy, fz), g(perm[BA & 511]!, fx - 1, fy, fz), u),
        lerp(g(perm[AB & 511]!, fx, fy - 1, fz), g(perm[BB & 511]!, fx - 1, fy - 1, fz), u),
        v,
      ),
      lerp(
        lerp(g(perm[(AA + 1) & 511]!, fx, fy, fz - 1), g(perm[(BA + 1) & 511]!, fx - 1, fy, fz - 1), u),
        lerp(g(perm[(AB + 1) & 511]!, fx, fy - 1, fz - 1), g(perm[(BB + 1) & 511]!, fx - 1, fy - 1, fz - 1), u),
        v,
      ),
      w,
    )
  }
}

/** Step for the curl's finite differences, in noise units. */
const EPS = 0.02

/** RMS of the noise's curl in noise units, sampled, so `swirl` 1 means a lean of about one height. */
const CURL_RMS = (() => {
  const noise = makeNoise3(makeRng(99))
  const rng = makeRng(7)
  let sum = 0
  const n = 4000
  for (let i = 0; i < n; i++) {
    const x = rng() * 50
    const y = rng() * 50
    const z = rng() * 50
    const c = noise(x, y, z)
    const dx = (noise(x + EPS, y, z) - c) / EPS
    const dy = (noise(x, y + EPS, z) - c) / EPS
    sum += dx * dx + dy * dy
  }
  return Math.sqrt(sum / n)
})()

/** Layered sines of incommensurate rates, about [-1, 1], never repeating at a period worth watching. */
const wander = (t: number, a: number, b: number, c: number) =>
  0.6 * Math.sin(t + a) + 0.3 * Math.sin(2.13 * t + b) + 0.1 * Math.sin(4.71 * t + c)

type Gust = {
  /** When the front crosses the upwind edge of the field, seconds. */
  start: number
  strength: number
  /** Offset from the prevailing direction, radians. */
  offset: number
  /** Where across the front the gust is centred, 0..1 of the field's width that way. */
  across: number
}

export type Wind = ReturnType<typeof createWind>

export function createWind(seed: number) {
  const noise = makeNoise3(makeRng(hashSeed(seed, 0x3d)))
  const phases = (() => {
    const rng = makeRng(hashSeed(seed, 0x7e))
    return Array.from({ length: 6 }, () => rng() * TAU)
  })()

  let settings: Settings | undefined
  let clock = 0
  /** Integrated phases: of the veer, the lulls and the eddies' change of shape. */
  let veerPhase = 0
  let lullPhase = 0
  let churnPhase = 0
  /** How far the air has carried the eddies, css px. */
  let carriedX = 0
  let carriedY = 0
  let width = 1
  let height = 1

  // Per frame.
  let prevailing = 0
  let veerRate = 0
  let lullRate = 0
  let speed = MIN_FRONT_SPEED
  const gusts: (Gust & { dx: number; dy: number; s0: number; l0: number })[] = []

  function scheduleGusts(s: Settings) {
    gusts.length = 0
    if (s.gusts <= 0 || s.gustRate <= 0) return
    const period = 60 / s.gustRate
    const reach = Math.hypot(width, height) + 4 * s.gustSize
    const life = reach / speed + GUST_TAIL
    const current = Math.floor(clock / period)
    const first = Math.max(0, current - Math.min(MAX_GUSTS, Math.ceil(life / period)))
    for (let k = first; k <= current; k++) {
      const rng = makeRng(hashSeed(seed, k, SALT_GUST))
      const start = k * period + rng() * period * 0.8
      if (start > clock || clock - start > life) continue
      const gust: Gust = {
        start,
        // Never a sequence of identical shoves.
        strength: 0.5 + 0.5 * rng(),
        offset: (rng() * 2 - 1) * s.gustSpread * DEG,
        across: rng(),
      }
      const angle = prevailing + gust.offset
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      // Upwind edge along the gust's heading, and the field's extent across it.
      let sMin = Infinity
      let lMin = Infinity
      let lMax = -Infinity
      for (const [x, y] of [
        [0, 0],
        [width, 0],
        [0, height],
        [width, height],
      ] as const) {
        sMin = Math.min(sMin, x * dx + y * dy)
        const l = -x * dy + y * dx
        lMin = Math.min(lMin, l)
        lMax = Math.max(lMax, l)
      }
      gusts.push({
        ...gust,
        dx,
        dy,
        s0: sMin - 2 * s.gustSize,
        l0: lMin - s.gustSize + gust.across * (lMax - lMin + 2 * s.gustSize),
      })
    }
  }

  return {
    resize(w: number, h: number) {
      width = Math.max(1, w)
      height = Math.max(1, h)
    },

    /** Advance the air by `dt` seconds under `next`. Call once a frame before sampling. */
    update(next: Settings, dt: number) {
      settings = next
      clock += dt
      veerRate = (next.veerRate / 60) * TAU
      lullRate = veerRate * 0.77 + 0.05
      veerPhase += veerRate * dt
      lullPhase += lullRate * dt
      churnPhase += (next.churn / 60) * dt
      speed = Math.max(MIN_FRONT_SPEED, next.drift)
      prevailing = next.direction * DEG + next.veer * DEG * wander(veerPhase, phases[0]!, phases[1]!, phases[2]!)
      carriedX += Math.cos(prevailing) * next.drift * dt
      carriedY += Math.sin(prevailing) * next.drift * dt
      scheduleGusts(next)
    },

    /** The lean the air asks of a column rooted at `(x, y)`, as a fraction of height, into `out`. */
    at(x: number, y: number, out: Float32Array) {
      const s = settings!
      const ux = Math.cos(prevailing)
      const uy = Math.sin(prevailing)
      // How long ago the air now here passed the middle of the field: the
      // veer and the lulls reach a column that much later, so a turn sweeps
      // downwind rather than arriving everywhere at once.
      const lag = s.drift > 0 ? ((x - width / 2) * ux + (y - height / 2) * uy) / s.drift : 0
      const angle =
        s.direction * DEG + s.veer * DEG * wander(veerPhase - veerRate * lag, phases[0]!, phases[1]!, phases[2]!)
      const steady =
        s.breeze * (1 - s.lulls * (0.5 + 0.5 * wander(lullPhase - lullRate * lag, phases[3]!, phases[4]!, phases[5]!)))
      let lx = Math.cos(angle) * steady
      let ly = Math.sin(angle) * steady

      for (const g of gusts) {
        const along = x * g.dx + y * g.dy
        const across = -x * g.dy + y * g.dx
        const since = clock - g.start - (along - g.s0) / speed
        const envelope = gustEnvelope(since)
        if (envelope <= 0) continue
        const off = (across - g.l0) / s.gustSize
        const push = s.gusts * g.strength * envelope * Math.exp(-off * off)
        lx += push * g.dx
        ly += push * g.dy
      }

      if (s.swirl > 0) {
        const k = 1 / s.swirlSize
        const nx = (x - carriedX) * k
        const ny = (y - carriedY) * k
        const c = noise(nx, ny, churnPhase)
        const dx = (noise(nx + EPS, ny, churnPhase) - c) / EPS
        const dy = (noise(nx, ny + EPS, churnPhase) - c) / EPS
        const scale = s.swirl / CURL_RMS
        lx += dy * scale
        ly -= dx * scale
      }
      out[0] = lx
      out[1] = ly
    },

    /** What the air is doing, for `stats()`. */
    report() {
      return {
        prevailing: Math.round((((prevailing / DEG) % 360) + 360) % 360),
        gustsInPlay: gusts.length,
        clock: Number(clock.toFixed(1)),
      }
    },
  }
}
