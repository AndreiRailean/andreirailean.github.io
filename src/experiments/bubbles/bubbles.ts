/**
 * The water: a canvas, a clock, some jets, and whatever foam is still on the
 * surface.
 *
 * ## We are above the water and the jets are below it
 *
 * Nothing in this piece draws the water. The surface is black and the bubbles
 * are white, so every reading of the flow a viewer gets is inferred from how the
 * white circles move — which is the constraint the piece is built around rather
 * than a style choice, and is why the velocity field has to be worth inferring.
 *
 * ## The field has three parts, and each is a different kind of thing
 *
 * 1. **The jets.** Each is a softened point source at the surface: radial speed
 *    peaks at the mouth and falls away like 1/r outside it, which is what a
 *    source in shallow water does. Analytic, sampled per bubble, and sharp — a
 *    grid fine enough to hold a 5cm mouth across a 3m tub would be 240 cells on
 *    a side.
 * 2. **The churn**, which is the curl of a scalar noise field. Taking a curl is
 *    not decoration: it makes the flow *divergence-free*, so the background can
 *    only move water around and never make or destroy any. A noise field used
 *    directly as a velocity has sources and sinks all over it, and bubbles
 *    gather into the sinks and thin out of the sources — which reads instantly
 *    as particles obeying a texture rather than as water.
 * 3. **The ebb**, a slow linear pull toward the middle. A tub is closed, so
 *    everything the jets push out has to return. Where the ebb balances a jet's
 *    push there is a ring the foam cannot cross, and that standing ring is the
 *    thing a real jacuzzi always has.
 *
 * ## Growth has exactly one mechanism
 *
 * A bubble is born small and can only get bigger by swallowing another, area
 * conserved — so radius goes as the square root and it takes four to double one.
 * Nothing grows on its own. That is the seed's "as they radiate, they combine
 * and become bigger", and it is worth stating because the alternative — growing
 * a bubble with its age — is much easier and produces a picture where size means
 * time instead of meaning history.
 *
 * ## Popping is a hazard rate, not a ceiling
 *
 * Past `popSize` the chance of bursting climbs with the square of the excess, so
 * a bubble that keeps feeding goes quickly and one that stops just over the line
 * can last a while. A hard ceiling makes every large bubble the same size, which
 * is the tell that a number rather than a process is in charge.
 */

import { gaussian, hashSeed, makeRng } from "@/experiments/random"
import { curlAt } from "@/experiments/bubbles/water"
import { needsPool, type Settings } from "@/experiments/bubbles/settings"

/** The largest step the simulation will take, in seconds of water. */
const STEP = 1 / 60

/** Most substeps in one frame. A tab coming back resumes; it does not catch up. */
const MAX_STEPS = 4

/** How long the water runs before a reduced-motion still is taken, in seconds. */
const STILL_SECONDS = 22

/** How far outside the frame a bubble is still simulated, as a fraction of `span`. */
const MARGIN = 0.18

/** Contacts per second at `merge` 1. Below a contact lasting a frame or two. */
const MERGE_EAGERNESS = 14

/** A bubble thinner than this many metres has drained away. */
const GONE = 0.0012

/** Biggest the contact grid may get on a side, so a fine scene cannot allocate wildly. */
const MAX_CELLS = 220

export type View = {
  /** CSS pixels. */
  width: number
  height: number
  /** Screen pixels per metre. */
  pxPerMetre: number
  /** Half the visible width and height, in metres, from the middle of the tub. */
  halfWidth: number
  halfHeight: number
  /** How far outside the frame a bubble is still simulated, in metres. */
  margin: number
}

/**
 * The frame, in metres.
 *
 * **Across the shorter side**, which is the section's rule for a subject with no
 * preferred direction — a sky, a sea, water from above. Embers frames by height
 * instead and says why: its subject is a column and has a natural height. This
 * one does not. A portrait phone gets the same tub at the same scale in a
 * narrower crop.
 */
export function makeView(span: number, width: number, height: number): View {
  const pxPerMetre = Math.max(1, Math.min(width, height)) / Math.max(0.2, span)
  return {
    width,
    height,
    pxPerMetre,
    halfWidth: width / 2 / pxPerMetre,
    halfHeight: height / 2 / pxPerMetre,
    margin: Math.max(0.1, span * MARGIN),
  }
}

export const screenX = (view: View, x: number): number => view.width / 2 + x * view.pxPerMetre
export const screenY = (view: View, y: number): number => view.height / 2 + y * view.pxPerMetre

export type Jet = {
  x: number
  y: number
  /** +1 or -1: which way this jet turns the water under it. */
  spin: number
  /** Seconds one surge takes, and where in it this jet currently is. */
  period: number
  phase: number
}

/**
 * Where the jets are, from the seed and the arrangement.
 *
 * **In metres of real water, not in units of the frame.** `spread` was a
 * fraction of `span` for about an hour, which made `span` move the jets apart
 * rather than step the camera back — so zooming out changed the tub instead of
 * showing more of it, and no two framings of one scene were the same scene.
 */
export function placeJets(settings: Settings): Jet[] {
  const { jets, layout, spin, spread, seed } = settings
  const radius = spread
  const rng = makeRng(hashSeed(seed, 0x9e37))
  const out: Jet[] = []

  for (let index = 0; index < jets; index++) {
    let x: number
    let y: number
    if (layout === "ring") {
      // Half a step of phase, so an even count never puts two jets on the
      // horizontal axis and reads as a row by accident.
      const angle = (index / jets) * Math.PI * 2 + Math.PI / jets
      x = Math.cos(angle) * radius
      y = Math.sin(angle) * radius
    } else if (layout === "row") {
      const t = jets === 1 ? 0 : (index / (jets - 1)) * 2 - 1
      x = t * radius
      y = 0
    } else {
      // Rejection-free disc sampling: sqrt on the radius keeps the middle from
      // being crowded, which is what a naive uniform radius does.
      const angle = rng() * Math.PI * 2
      const at = Math.sqrt(rng()) * radius
      x = Math.cos(angle) * at
      y = Math.sin(angle) * at
    }

    const turn = spin === "same" ? 1 : spin === "alternate" ? (index % 2 === 0 ? 1 : -1) : rng() < 0.5 ? -1 : 1
    // Every jet surges on its own clock, at its own rate. One shared period
    // makes the whole tub breathe together, which is the same tell a shared
    // waver frequency is one layer down — and here it would be worse, because a
    // surge is visible at the scale of the whole picture.
    out.push({ x, y, spin: turn, period: 2.2 + rng() * 4.2, phase: rng() * Math.PI * 2 })
  }

  return out
}

export type BubblesStats = {
  /** Bubbles on the surface. */
  alive: number
  /** The largest of them, in millimetres of radius. */
  biggest: number
  /** The average of them, in millimetres of radius. */
  mean: number
  /** Coalescences and bursts in the last second. */
  merges: number
  pops: number
  /** Frames per second, averaged over the last second. */
  fps: number
}

export type Bubbles = {
  start: () => void
  stop: () => void
  setPaused: (held: boolean) => void
  setSettings: (next: Settings) => void
  /** Run the water forward without waiting for it, in seconds. */
  settle: (seconds: number) => void
  /** Clear the surface and let it fill again. */
  clear: () => void
  stats: () => BubblesStats
}

export function createBubbles(canvas: HTMLCanvasElement, initial: Settings): Bubbles {
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) throw new Error("Bubbles: no 2d context")
  const ctx = context

  let settings = initial
  let jets = placeJets(settings)
  let view = makeView(settings.span, canvas.clientWidth || 1, canvas.clientHeight || 1)

  // The pool. Every bubble is allocated once when `count` changes and reused
  // after that: births and deaths both run at hundreds a second forever, which
  // is exactly the shape that makes a garbage collector visible.
  let capacity = Math.round(settings.count)
  let px = new Float32Array(capacity)
  let py = new Float32Array(capacity)
  let vx = new Float32Array(capacity)
  let vy = new Float32Array(capacity)
  let radius = new Float32Array(capacity)
  let phase = new Float32Array(capacity)
  let hertz = new Float32Array(capacity)
  let live = new Uint8Array(capacity)
  let free = new Int32Array(capacity)
  let freeCount = 0
  let alive = 0

  // The contact grid, rebuilt each step as a linked list per cell. Int32Array
  // heads and a `next` chain rather than arrays of arrays, for the same reason
  // the pool exists.
  let heads = new Int32Array(0)
  let next = new Int32Array(capacity)
  let cellSize = 0.05
  let cols = 1
  let rows = 1
  let originX = 0
  let originY = 0

  let rng = makeRng(hashSeed(settings.seed, 0x51ed))
  let clock = 0
  let owed = new Float64Array(8)

  let running = false
  let held = false
  let frame = 0
  let last = 0

  let merges = 0
  let pops = 0
  let mergesShown = 0
  let popsShown = 0
  let frames = 0
  let fps = 0
  let tallyAt = 0

  function resetPool(size: number) {
    capacity = Math.max(1, Math.round(size))
    px = new Float32Array(capacity)
    py = new Float32Array(capacity)
    vx = new Float32Array(capacity)
    vy = new Float32Array(capacity)
    radius = new Float32Array(capacity)
    phase = new Float32Array(capacity)
    hertz = new Float32Array(capacity)
    live = new Uint8Array(capacity)
    free = new Int32Array(capacity)
    next = new Int32Array(capacity)
    freeCount = capacity
    for (let i = 0; i < capacity; i++) free[i] = capacity - 1 - i
    alive = 0
  }

  resetPool(settings.count)

  /**
   * Takes a slot, or -1.
   *
   * A birth with no slot is **dropped** rather than evicting a live bubble.
   * Eviction would take the oldest — which here means the biggest, the one that
   * has been collecting others and is about to burst — and replace it with a
   * fresh speck at a jet, so raising the gas past the ceiling would visibly
   * destroy the interesting half of the picture instead of simply not adding
   * more.
   */
  function take(): number {
    if (freeCount === 0) return -1
    const index = free[--freeCount]!
    live[index] = 1
    alive++
    return index
  }

  function release(index: number) {
    if (live[index] === 0) return
    live[index] = 0
    free[freeCount++] = index
    alive--
  }

  function born(x: number, y: number, r: number, bx: number, by: number) {
    const index = take()
    if (index < 0) return
    px[index] = x
    py[index] = y
    vx[index] = bx
    vy[index] = by
    radius[index] = r
    phase[index] = rng() * Math.PI * 2
    // Each bubble wavers on its own clock, spread around the setting. One shared
    // frequency makes the whole surface breathe together, which is the single
    // clearest tell that a field rather than a fluid is in charge.
    hertz[index] = settings.waveHz * (0.55 + rng() * 0.9)
  }

  /**
   * The water's velocity at a point, in m/s.
   *
   * Sampled once per bubble per step, which is the budget: the churn costs eight
   * noise lookups and each jet costs about ten operations.
   */
  function flow(x: number, y: number, out: { x: number; y: number }) {
    let ux = 0
    let uy = 0

    for (const jet of jets) {
      const dx = x - jet.x
      const dy = y - jet.y
      const d2 = dx * dx + dy * dy
      const d = Math.sqrt(d2)
      if (d < 1e-6) continue
      // Peaks at exactly `outflow` when d is the mouth radius, and falls away
      // like 1/d outside it. A bare 1/d would be infinite over the jet.
      const profile = surgeOf(jet) * ((2 * settings.core * d) / (d2 + settings.core * settings.core))
      const nx = dx / d
      const ny = dy / d
      ux += settings.outflow * profile * nx + settings.swirl * profile * -ny * jet.spin
      uy += settings.outflow * profile * ny + settings.swirl * profile * nx * jet.spin
    }

    if (settings.churn > 0) {
      curlAt(settings.seed, x, y, clock, settings.scale, settings.churn, settings.drift, out)
      ux += out.x
      uy += out.y
    }

    // The return. A closed tub has to give back everything the jets push out,
    // and where this balances a jet there is a ring the foam cannot cross.
    ux -= settings.ebb * x
    uy -= settings.ebb * y

    out.x = ux
    out.y = uy
  }

  const sample = { x: 0, y: 0 }

  /**
   * How hard one jet is working right now, as a multiple of its settings.
   *
   * The same number scales the gas and the push, because they have the same
   * cause: a pump delivering harder pushes more water *and* entrains more air.
   * Scaling only the gas gives a tub whose density pulses while its flow does
   * not, which reads as the bubbles changing rather than the jet.
   */
  function surgeOf(jet: Jet): number {
    if (settings.pulse <= 0) return 1
    return 1 + settings.pulse * Math.sin((clock / jet.period) * Math.PI * 2 + jet.phase)
  }

  function emit(dt: number) {
    if (jets.length === 0) return
    const low = settings.birthMin
    const high = Math.max(settings.birthMin, settings.birthMax)

    for (let index = 0; index < jets.length; index++) {
      const jet = jets[index]!
      owed[index] = (owed[index] ?? 0) + settings.rate * surgeOf(jet) * dt
      while (owed[index]! >= 1) {
        owed[index]! -= 1
        const angle = rng() * Math.PI * 2
        const at = settings.core * (0.2 + rng() * 0.75)
        const x = jet.x + Math.cos(angle) * at
        const y = jet.y + Math.sin(angle) * at
        // Sizes clustered toward the small end of the band: a bubble leaving a
        // nozzle is graded by how much gas broke off, not drawn from a hat.
        const t = Math.min(1, Math.max(0, 0.5 + gaussian(rng) * 0.28))
        flow(x, y, sample)
        born(x, y, low + (high - low) * t * t, sample.x, sample.y)
      }
    }
  }

  function rebuildGrid() {
    let biggest = settings.birthMax
    for (let i = 0; i < capacity; i++) {
      if (live[i] === 1 && radius[i]! > biggest) biggest = radius[i]!
    }

    const extentX = view.halfWidth + view.margin
    const extentY = view.halfHeight + view.margin
    // A cell must hold the largest pair *at the current reach*, or a 3x3 sweep
    // misses contacts. `pack` above 1 lets films reach for each other before
    // they meet, so it widens what counts as a pair and has to be in here.
    let size = Math.max(biggest * 2 * Math.max(1, settings.pack) * 1.1, 0.004)
    cols = Math.ceil((extentX * 2) / size)
    rows = Math.ceil((extentY * 2) / size)
    if (cols > MAX_CELLS || rows > MAX_CELLS) {
      size = Math.max((extentX * 2) / MAX_CELLS, (extentY * 2) / MAX_CELLS)
      cols = Math.ceil((extentX * 2) / size)
      rows = Math.ceil((extentY * 2) / size)
    }
    cellSize = size
    originX = -extentX
    originY = -extentY

    const wanted = cols * rows
    if (heads.length !== wanted) heads = new Int32Array(wanted)
    heads.fill(-1)

    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      const cx = Math.min(cols - 1, Math.max(0, Math.floor((px[i]! - originX) / cellSize)))
      const cy = Math.min(rows - 1, Math.max(0, Math.floor((py[i]! - originY) / cellSize)))
      const cell = cy * cols + cx
      next[i] = heads[cell]!
      heads[cell] = i
    }
  }

  /**
   * Coalescence and jostling, in one sweep over touching pairs.
   *
   * Merging conserves area and momentum. Not merging separates the pair by mass
   * share, so a big bubble barely moves when a speck runs into it — which is
   * what turns a crowd into a raft with structure rather than a heap of
   * overlapping circles.
   */
  function contacts(dt: number) {
    if (settings.merge <= 0 && settings.bounce <= 0) return
    rebuildGrid()

    const chance = 1 - Math.exp(-settings.merge * MERGE_EAGERNESS * dt)

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        for (let i = heads[cy * cols + cx]!; i >= 0; i = next[i]!) {
          if (live[i] === 0) continue
          for (let oy = -1; oy <= 1; oy++) {
            const ny = cy + oy
            if (ny < 0 || ny >= rows) continue
            for (let ox = -1; ox <= 1; ox++) {
              const nx = cx + ox
              if (nx < 0 || nx >= cols) continue
              for (let j = heads[ny * cols + nx]!; j >= 0; j = next[j]!) {
                // Each unordered pair once, and never a bubble with itself.
                if (j <= i || live[j] === 0 || live[i] === 0) continue

                const dx = px[j]! - px[i]!
                const dy = py[j]! - py[i]!
                const ri = radius[i]!
                const rj = radius[j]!
                const reach = (ri + rj) * settings.pack
                const d2 = dx * dx + dy * dy
                if (d2 > reach * reach) continue
                const d = Math.sqrt(d2) || 1e-6

                const mi = ri * ri
                const mj = rj * rj
                const total = mi + mj

                if (chance > 0 && rng() < chance) {
                  // Area conserved, so radius goes as the square root: four
                  // bubbles to double one.
                  px[i] = (px[i]! * mi + px[j]! * mj) / total
                  py[i] = (py[i]! * mi + py[j]! * mj) / total
                  vx[i] = (vx[i]! * mi + vx[j]! * mj) / total
                  vy[i] = (vy[i]! * mi + vy[j]! * mj) / total
                  radius[i] = Math.sqrt(total)
                  if (rj > ri) {
                    phase[i] = phase[j]!
                    hertz[i] = hertz[j]!
                  }
                  release(j)
                  merges++
                  continue
                }

                if (settings.bounce <= 0) continue
                const overlap = ri + rj - d
                if (overlap <= 0) continue
                const push = overlap * settings.bounce * 0.5
                const ux = dx / d
                const uy = dy / d
                px[i]! -= ux * push * (mj / total) * 2
                py[i]! -= uy * push * (mj / total) * 2
                px[j]! += ux * push * (mi / total) * 2
                py[j]! += uy * push * (mi / total) * 2
              }
            }
          }
        }
      }
    }
  }

  function burst(index: number) {
    const r = radius[index]!
    const x = px[index]!
    const y = py[index]!
    release(index)
    pops++

    const count = Math.round(settings.spray)
    if (count <= 0) return
    // A film letting go throws droplets outward, fast and small. They are gas
    // the surface has not finished with rather than a decoration: the flow takes
    // them straight back into whatever is nearby.
    const speed = 0.4 + 6 * r
    const start = rng() * Math.PI * 2
    for (let k = 0; k < count; k++) {
      const angle = start + (k / count) * Math.PI * 2 + rng() * 0.4
      born(
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r,
        Math.max(GONE * 1.5, settings.birthMin * 0.6),
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
      )
    }
  }

  function step(dt: number) {
    clock += dt
    emit(dt)

    const killX = view.halfWidth + view.margin
    const killY = view.halfHeight + view.margin
    const wave = settings.wave
    const lag = settings.lag

    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue

      flow(px[i]!, py[i]!, sample)
      let ux = sample.x
      let uy = sample.y

      if (wave > 0) {
        // Across the direction of travel rather than along it, so the sidestep
        // bends the path instead of changing how fast it is walked.
        const speed = Math.hypot(ux, uy)
        const dx = speed > 1e-5 ? ux / speed : 1
        const dy = speed > 1e-5 ? uy / speed : 0
        const swing = Math.sin(clock * hertz[i]! * Math.PI * 2 + phase[i]!) * wave
        ux += -dy * swing
        uy += dx * swing
      }

      if (lag > 0) {
        // Exponential relaxation toward the water, so it is stable at any step
        // and a big bubble takes longer to turn than a small one.
        const tau = lag * 0.35 * Math.sqrt(Math.max(radius[i]!, GONE) / 0.008)
        const k = tau > 1e-4 ? 1 - Math.exp(-dt / tau) : 1
        vx[i]! += (ux - vx[i]!) * k
        vy[i]! += (uy - vy[i]!) * k
      } else {
        vx[i] = ux
        vy[i] = uy
      }

      px[i]! += vx[i]! * dt
      py[i]! += vy[i]! * dt

      if (settings.dissolve > 0) radius[i]! -= settings.dissolve * dt

      if (radius[i]! <= GONE || Math.abs(px[i]!) > killX || Math.abs(py[i]!) > killY) {
        release(i)
        continue
      }

      if (settings.popRate > 0 && radius[i]! > settings.popSize) {
        const excess = radius[i]! / settings.popSize - 1
        const hazard = settings.popRate * excess * excess
        if (rng() < 1 - Math.exp(-hazard * dt)) burst(i)
      }
    }

    contacts(dt)
  }

  function draw() {
    if (settings.trail > 0) {
      // A wake: the last frame left behind, fading. Not a blur — every circle is
      // still drawn at full white, so what dims is only where they have been.
      ctx.fillStyle = `rgb(0 0 0 / ${((1 - settings.trail) * 100).toFixed(1)}%)`
      ctx.fillRect(0, 0, view.width, view.height)
    } else {
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, view.width, view.height)
    }

    // Two passes, because a stroke and a fill cannot share a path. Within each
    // pass it is **one** path for the whole surface: the circles are all the
    // same white and overlaps union under the default winding rule, so the
    // picture is identical to drawing them one by one and costs a single
    // operation.
    //
    // `mixed` is the reason the split is by bubble rather than by scene. A ring
    // whose wall is under about three quarters of a pixel does not draw as a
    // ring; it draws as a grey smudge, because the only thing a sub-pixel
    // stroke can do is lower the coverage. So a bubble too small to hold a wall
    // is a dot, which is also what an eye sees.
    const wall = settings.rim
    const wantRing = settings.look !== "disc"
    const ringAll = settings.look === "ring"

    ctx.fillStyle = "#fff"
    ctx.beginPath()
    let filled = false
    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      const r = radius[i]! * view.pxPerMetre
      if (r < 0.15) continue
      if (wantRing && (ringAll || r * wall >= 0.75)) continue
      const x = screenX(view, px[i]!)
      const y = screenY(view, py[i]!)
      ctx.moveTo(x + r, y)
      ctx.arc(x, y, r, 0, Math.PI * 2)
      filled = true
    }
    if (filled) ctx.fill()

    if (!wantRing) return

    ctx.strokeStyle = "#fff"
    ctx.beginPath()
    let stroked = false
    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      const r = radius[i]! * view.pxPerMetre
      if (r < 0.15) continue
      if (!ringAll && r * wall < 0.75) continue
      const x = screenX(view, px[i]!)
      const y = screenY(view, py[i]!)
      // A stroke straddles its path, so the arc is inset by half the wall and
      // the bubble's outer edge still lands at `r`. Without that a ring is
      // visibly bigger than the disc it replaces and toggling `drawn as`
      // changes the size of everything.
      const width = Math.max(0.45, Math.min(r * 1.9, r * wall * 2))
      const at = Math.max(0.05, r - width / 2)
      ctx.moveTo(x + at, y)
      ctx.arc(x, y, at, 0, Math.PI * 2)
      stroked = true
      ctx.lineWidth = width
      // One path cannot carry two widths, so a run of same-width rings would be
      // ideal and is not worth the bookkeeping: stroke per bubble here, and the
      // pass only runs for bubbles large enough to be few.
      ctx.stroke()
      ctx.beginPath()
    }
    if (stroked) ctx.beginPath()
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    view = makeView(settings.span, width, height)
  }

  function tick(now: number) {
    if (!running) return
    frame = requestAnimationFrame(tick)
    if (held) {
      last = now
      return
    }

    const elapsed = last === 0 ? STEP : Math.min(0.25, (now - last) / 1000)
    last = now

    let remaining = elapsed
    let steps = 0
    while (remaining > 1e-6 && steps < MAX_STEPS) {
      const dt = Math.min(STEP, remaining)
      step(dt)
      remaining -= dt
      steps++
    }

    draw()

    frames++
    if (now - tallyAt >= 1000) {
      fps = (frames * 1000) / (now - tallyAt)
      mergesShown = merges
      popsShown = pops
      merges = 0
      pops = 0
      frames = 0
      tallyAt = now
    }
  }

  const onResize = () => {
    resize()
    draw()
  }

  resize()

  const still = window.matchMedia("(prefers-reduced-motion: reduce)")

  return {
    start() {
      if (running) return
      window.addEventListener("resize", onResize)
      if (still.matches) {
        // A picture of the instant the jets were switched on is not a picture of
        // this piece, so the still is of water that has been going a while.
        for (let t = 0; t < STILL_SECONDS; t += STEP) step(STEP)
        draw()
        return
      }
      running = true
      last = 0
      tallyAt = performance.now()
      frame = requestAnimationFrame(tick)
    },

    stop() {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", onResize)
    },

    setPaused(next) {
      held = next
    },

    setSettings(nextSettings) {
      const before = settings
      settings = nextSettings
      if (needsPool(before, nextSettings)) resetPool(nextSettings.count)
      if (
        before.jets !== nextSettings.jets ||
        before.layout !== nextSettings.layout ||
        before.spin !== nextSettings.spin ||
        before.spread !== nextSettings.spread ||
        before.seed !== nextSettings.seed
      ) {
        jets = placeJets(nextSettings)
        owed = new Float64Array(Math.max(8, nextSettings.jets))
      }
      if (before.seed !== nextSettings.seed) rng = makeRng(hashSeed(nextSettings.seed, 0x51ed))
      if (before.span !== nextSettings.span) resize()
      if (held || !running) draw()
    },

    settle(seconds) {
      const bounded = Math.max(0, Math.min(600, seconds))
      for (let t = 0; t < bounded; t += STEP) step(STEP)
      draw()
    },

    clear() {
      resetPool(settings.count)
      draw()
    },

    stats: () => {
      let biggest = 0
      let total = 0
      for (let i = 0; i < capacity; i++) {
        if (live[i] === 0) continue
        total += radius[i]!
        if (radius[i]! > biggest) biggest = radius[i]!
      }
      return {
        alive,
        biggest: Number((biggest * 1000).toFixed(2)),
        mean: Number(((alive > 0 ? total / alive : 0) * 1000).toFixed(2)),
        merges: mergesShown,
        pops: popsShown,
        fps: Number(fps.toFixed(1)),
      }
    },
  }
}
