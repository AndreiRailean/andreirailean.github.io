/**
 * The scene: emitters, the lines they make, and the dots on those lines.
 *
 * **A dot is a time, not a position.** Every dot on a line moves at the line's
 * one speed along the line's one heading, so a dot is wholly described by when
 * its emitter let go of it: its distance down the line is `(now - t) * speed`.
 * A line is therefore a queue of emission times, appended at the emitter and
 * dropped once the oldest has run off the far side of the screen. Nothing is
 * integrated, so nothing drifts, and `settle` is just a clock change.
 *
 * **The screen starts full.** Building a line back-fills it with every dot
 * that would be on it had it been running for as long as one takes to cross,
 * so a scene arrives as it looks in its steady state rather than as lines
 * creeping in from the edge. `clear()` is there to watch the creep.
 */

import { gaussian, hashSeed, makeRng, type Rng } from "@/experiments/random"
import { needsRebuild, type Settings } from "@/experiments/streakers/settings"

type Line = {
  /** Emitter, in css px. */
  ox: number
  oy: number
  /** Unit heading. */
  dx: number
  dy: number
  /** px per second. */
  speed: number
  /** Distances along the line at which it enters and leaves the padded frame. */
  enter: number
  exit: number
  /** False for a line that never crosses the screen — a ring with wide scatter makes them. */
  hits: boolean
  /** This line's dot radius before per-dot variety. */
  radius: number
  /** Degrees off the scene's hue, rounded so lines sharing a colour share a fill. */
  hue: number
  /** Mean seconds between emissions. */
  meanGap: number
  /** Next emission time. */
  next: number
  times: number[]
  radii: number[]
  head: number
  rng: Rng
}

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/**
 * A gamma draw of mean 1 and shape `k` — Marsaglia and Tsang.
 *
 * Shape 1 is the exponential, which makes emissions a Poisson stream; its
 * coefficient of variation is `1/sqrt(k)`, so a large shape tends to a
 * metronome. `evenness` maps onto that CV linearly, which is why it reads as
 * one even control rather than all happening in its last tenth.
 */
function gammaUnit(rng: Rng, k: number): number {
  if (k < 1) return gammaUnit(rng, k + 1) * Math.pow(rng(), 1 / k)
  const d = k - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = gaussian(rng)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x * x * x * x) return (d * v) / k
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return (d * v) / k
  }
}

/** Intervals' coefficient of variation for an `evenness`: 1 at 0, 0.03 at 1. */
export const gapCv = (evenness: number) => 1 - 0.97 * evenness

/** Where a ray crosses a rectangle: the distances it enters and leaves at, or null. */
function clip(ox: number, oy: number, dx: number, dy: number, x0: number, y0: number, x1: number, y1: number) {
  let lo = 0
  let hi = Infinity
  for (const [o, d, a, b] of [
    [ox, dx, x0, x1],
    [oy, dy, y0, y1],
  ] as const) {
    if (Math.abs(d) < 1e-9) {
      if (o < a || o > b) return null
      continue
    }
    let t0 = (a - o) / d
    let t1 = (b - o) / d
    if (t0 > t1) [t0, t1] = [t1, t0]
    lo = Math.max(lo, t0)
    hi = Math.min(hi, t1)
    if (lo > hi) return null
  }
  return { enter: lo, exit: hi }
}

function buildLines(settings: Settings, width: number, height: number): Line[] {
  const cx = width / 2
  const cy = height / 2
  const halfDiag = Math.hypot(cx, cy)
  const diag = halfDiag * 2
  const n = Math.round(settings.emitters)
  const theta = settings.heading * DEG
  const hx = Math.cos(theta)
  const hy = Math.sin(theta)

  // Room for the largest dot to be wholly off screen before it is dropped.
  const pad = settings.size * 6 + 4

  // Speeds in px/s. Logarithmic between the ends, because the ends are a ratio
  // apart — up to two hundred — and a linear draw would make nearly every line
  // as fast as the fastest.
  const slow = (settings.slowest / 100) * diag
  const fast = (settings.fastest / 100) * diag
  const reference = Math.sqrt(slow * fast)

  // A ring laid out evenly still turns as a whole with the seed, so a reroll of
  // an even star is not the same star.
  const ringPhase = makeRng(hashSeed(settings.seed, 0x51a))() * TAU

  const lines: Line[] = []
  for (let i = 0; i < n; i++) {
    const place = makeRng(hashSeed(settings.seed, i, 1))
    const pick = makeRng(hashSeed(settings.seed, i, 2))

    let ox: number
    let oy: number
    let aim: number

    if (settings.layout === "edge") {
      // Stand on a line square to the heading, just upstream of the screen, and
      // only as wide as the screen's shadow on it — so every line, unscattered,
      // crosses the picture and none is wasted off a corner.
      const along = Math.abs(cx * hx) + Math.abs(cy * hy)
      const across = Math.abs(cx * hy) + Math.abs(cy * hx)
      const u = settings.placement === "even" ? ((i + 0.5) / n) * 2 - 1 : place() * 2 - 1
      ox = cx - hx * (along + pad) - hy * u * across
      oy = cy - hy * (along + pad) + hx * u * across
      aim = theta
    } else {
      const phi = settings.placement === "even" ? ringPhase + (i / n) * TAU : place() * TAU
      const r = settings.ring * halfDiag
      ox = cx + Math.cos(phi) * r
      oy = cy + Math.sin(phi) * r
      aim = settings.aim === "centre" ? phi + Math.PI + settings.twist * DEG : theta
    }

    aim += (pick() * 2 - 1) * settings.spread * DEG
    const dx = Math.cos(aim)
    const dy = Math.sin(aim)
    const speed = slow * Math.pow(fast / slow, pick())
    const radius = settings.size * spreadFactor(settings.lineSizes, pick())
    const hue = Math.round(((pick() * 2 - 1) * settings.hues) / 2) * 2
    const meanGap = (settings.gapBy === "distance" ? settings.gap / speed : settings.gap / reference) || 1

    const crossing = clip(ox, oy, dx, dy, -pad, -pad, width + pad, height + pad)
    const rng = makeRng(hashSeed(settings.seed, i, 3))
    const line: Line = {
      ox,
      oy,
      dx,
      dy,
      speed,
      enter: crossing?.enter ?? 0,
      exit: crossing?.exit ?? 0,
      hits: crossing !== null,
      radius,
      hue,
      meanGap,
      next: 0,
      times: [],
      radii: [],
      head: 0,
      rng,
    }
    lines.push(line)
  }
  return lines
}

/** Every dot the line would hold had it been running for one crossing, ending at `now`. */
function fill(line: Line, now: number, shape: number, dotSizes: number) {
  line.times.length = 0
  line.radii.length = 0
  line.head = 0
  if (!line.hits) return
  // Starting a gap's worth of random phase back, so lines do not all release
  // their first dot at the same instant.
  let t = now - line.exit / line.speed - line.rng() * line.meanGap
  while (t <= now) {
    line.times.push(t)
    line.radii.push(dotRadius(line, dotSizes))
    t += line.meanGap * gammaUnit(line.rng, shape)
  }
  line.next = t
}

/**
 * A size multiplier, uniform in log between `1/sqrt(r)` and `sqrt(r)`, where `r`
 * is the ratio between the largest and smallest: 1 at a spread of 0 and
 * `SIZE_RATIO` at 1. Uniform rather than lognormal so the panel's end means a
 * stated ratio — a lognormal of sigma 0.6 came out as ±19% at 0.3, which on a
 * 0.7px dot is invisible, and was reported so. The spread at a given value is about what the lognormal gave; what changed is how far the end reaches.
 */
export const SIZE_RATIO = 16
const spreadFactor = (spread: number, u: number) => (spread > 0 ? Math.pow(SIZE_RATIO, spread * (u - 0.5)) : 1)

const dotRadius = (line: Line, dotSizes: number) =>
  dotSizes > 0 ? line.radius * spreadFactor(dotSizes, line.rng()) : line.radius

export function createStreakers(canvas: HTMLCanvasElement, initial: Settings) {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("streakers: no 2d context")
  const ctx = context

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1
  let lines: Line[] = []
  let shape = 1
  let now = 0
  let held = false
  let running = false
  let frame = 0
  let last = 0
  let debug = false
  let drawn = 0
  let fps = 0

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    width = canvas.clientWidth || window.innerWidth
    height = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }

  function rebuild(empty = false) {
    shape = 1 / gapCv(settings.evenness) ** 2
    lines = buildLines(settings, width, height).sort((a, b) => a.hue - b.hue)
    for (const line of lines) {
      if (empty) {
        line.times.length = 0
        line.radii.length = 0
        line.head = 0
        line.next = now + line.rng() * line.meanGap
      } else {
        fill(line, now, shape, settings.dotSizes)
      }
    }
  }

  function step(dt: number) {
    now += dt
    for (const line of lines) {
      if (!line.hits) continue
      while (line.next <= now) {
        line.times.push(line.next)
        line.radii.push(dotRadius(line, settings.dotSizes))
        line.next += line.meanGap * gammaUnit(line.rng, shape)
      }
      const oldest = now - line.exit / line.speed
      while (line.head < line.times.length && line.times[line.head]! < oldest) line.head++
      if (line.head > 512) {
        line.times.splice(0, line.head)
        line.radii.splice(0, line.head)
        line.head = 0
      }
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)

    if (debug) {
      ctx.strokeStyle = `hsl(${settings.hue} 70% 60% / 35%)`
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const line of lines) {
        ctx.moveTo(line.ox, line.oy)
        const reach = line.hits ? line.exit : Math.hypot(width, height) * 2
        ctx.lineTo(line.ox + line.dx * reach, line.oy + line.dy * reach)
      }
      ctx.stroke()
      ctx.fillStyle = `hsl(${settings.hue} 80% 65%)`
      for (const line of lines) ctx.fillRect(line.ox - 3, line.oy - 3, 6, 6)
    }

    let count = 0
    // One fill per colour: lines are sorted by hue offset at rebuild, so a run
    // of equal offsets shares a path. Untinted, every line is one run.
    const tinted = settings.tint > 0
    let current = NaN
    for (const line of lines) {
      const key = tinted ? line.hue : 0
      if (key !== current) {
        if (current === current) ctx.fill()
        current = key
        ctx.fillStyle = tinted
          ? `hsl(${settings.hue + key} ${Math.round(settings.tint * 90)}% ${Math.round(100 - settings.tint * 40)}%)`
          : "#fff"
        ctx.beginPath()
      }
      const { times, radii, speed, ox, oy, dx, dy, enter } = line
      // Oldest first, so distance falls as the index rises: everything before
      // the entry point is still off screen upstream and can be skipped whole.
      for (let j = line.head; j < times.length; j++) {
        const s = (now - times[j]!) * speed
        if (s < enter) break
        const r = radii[j]!
        const x = ox + dx * s
        const y = oy + dy * s
        if (x < -r || y < -r || x > width + r || y > height + r) continue
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, TAU)
        count++
      }
    }
    if (current === current) ctx.fill()
    drawn = count
  }

  function tick(time: number) {
    frame = requestAnimationFrame(tick)
    const dt = last ? Math.min(0.1, (time - last) / 1000) : 0
    last = time
    if (dt > 0) fps = fps ? fps * 0.95 + (1 / dt) * 0.05 : 1 / dt
    if (!held) step(dt)
    draw()
  }

  function onResize() {
    size()
    rebuild()
  }

  /** What the mechanisms actually did, measured off the live lines rather than read off settings. */
  function stats() {
    const live = lines.filter((line) => line.hits)
    const speeds = live.map((line) => line.speed)
    // Per line, the coefficient of variation of the intervals it actually
    // emitted at — about 1 for a Poisson stream, near 0 for a metronome.
    const cvs: number[] = []
    const spacings: number[] = []
    const radii: number[] = []
    for (const line of live) {
      const gaps: number[] = []
      for (let j = line.head + 1; j < line.times.length; j++) gaps.push(line.times[j]! - line.times[j - 1]!)
      for (let j = line.head; j < line.radii.length; j++) radii.push(line.radii[j]!)
      if (gaps.length < 4) continue
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
      const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length)
      cvs.push(sd / mean)
      spacings.push(mean * line.speed)
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const rMean = avg(radii)
    const rSd = Math.sqrt(avg(radii.map((r) => (r - rMean) ** 2)))
    const sorted = [...radii].sort((a, b) => a - b)
    const at = (q: number) => sorted[Math.floor(q * (sorted.length - 1))] ?? 0
    const lineRadii = live.map((line) => line.radius)
    const round = (v: number, d = 2) => Number(v.toFixed(d))
    return {
      lines: lines.length,
      crossing: live.length,
      missing: lines.length - live.length,
      dots: lines.reduce((a, line) => a + line.times.length - line.head, 0),
      drawn,
      speedPx: { min: round(Math.min(...speeds), 1), max: round(Math.max(...speeds), 1) },
      spacingPx: round(avg(spacings), 1),
      intervalCv: round(avg(cvs)),
      expectedCv: round(gapCv(settings.evenness)),
      radius: {
        mean: round(rMean),
        cv: round(rMean ? rSd / rMean : 0),
        min: round(at(0)),
        max: round(at(1)),
        lineRatio: round(Math.max(...lineRadii) / Math.min(...lineRadii)),
      },
      colours: new Set(live.map((line) => line.hue)).size,
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
      if (needsRebuild(before, next) || before.size !== next.size) rebuild()
    },
    setPaused(on: boolean) {
      held = on
    },
    settle(seconds: number) {
      step(seconds)
      draw()
    },
    clear() {
      rebuild(true)
    },
    debug(on?: boolean) {
      debug = on ?? !debug
      return debug
    },
    stats,
  }
}
