/**
 * The scene: a canvas, a clock, a fire below the frame and whatever is still
 * alight above it.
 *
 * Everything interesting is in the modules this composes — `air.ts` for the
 * flow, `ember.ts` for what one ember does in it, `bed.ts` for how they leave
 * the fire, `draw.ts` for what reaches the glass. What is left here is the three
 * things that are genuinely about running it.
 *
 * ## The field is sampled once per ember per frame, and that is the budget
 *
 * A step costs one velocity sample and one temperature sample per ember, and the
 * velocity sample walks every live vortex and four noise lookups per octave. At
 * two thousand embers and fifty vortices that is a hundred thousand vortex
 * evaluations and sixteen thousand noise evaluations a frame, which is most of
 * the piece's cost and is why the integrator in `ember.ts` had to be exact for a
 * constant field: an explicit solver would need four substeps of that.
 *
 * So the clock runs at a fixed 1/60 rather than 1/120, and the reason it can is
 * the same reason it has to.
 *
 * ## Population is a pool with a free list, not an array that grows
 *
 * Embers are created at up to a couple of hundred a second and die at the same
 * rate, forever, which is exactly the shape that makes a garbage collector
 * visible. Every ember object is allocated once when `count` changes and reused
 * after that; a dead one is an index on a stack.
 *
 * A birth with no free slot is **dropped**, deliberately. The alternative is
 * evicting a live ember, which takes the dimmest one — the oldest and most
 * interesting — and replaces it with a fresh one at the bed, so raising the
 * sputter past the ceiling would visibly shorten every ember's life instead of
 * simply not adding more.
 *
 * ## Reduced motion gets a still of a fire that has been going a while
 *
 * Not an empty frame: the simulation is run forward for several seconds before
 * the one frame is drawn, because a picture of the moment a fire was lit is not
 * a picture of this piece. The poster and the note's backdrop take the same
 * route, through `settle`.
 */

import { gaussian, hashSeed, makeRng } from "@/experiments/random"
import { createAir, type Air } from "@/experiments/embers/air"
import { createBed, type Bed } from "@/experiments/embers/bed"
import { blankEmber, dress, samplePath, stepEmber, type Ember, type Physics } from "@/experiments/embers/ember"
import { clearFrame, drawEmbers, drawFirelight, makeSheet, sheetMatches, type Sheet } from "@/experiments/embers/draw"
import { DARK_TEMP, rampStep } from "@/experiments/embers/palette"
import { needsSheet, type Settings } from "@/experiments/embers/settings"
import { beyond, makeView, screenX, screenY, type View } from "@/experiments/embers/view"

/**
 * The **largest** step the simulation will take, in seconds of fire.
 *
 * A ceiling, not the step. Both integrators in `ember.ts` are exponential and so
 * unconditionally stable at any `dt` — which was the whole reason for writing
 * them that way — so what this bounds is accuracy, not stability: the vortex
 * advection is explicit Euler and a long step would cut corners off an eddy.
 *
 * **It used to be the step, with an accumulator draining it, and that was a real
 * bug at slow playback.** At 0.12x a wall frame is worth 0.002 seconds of fire,
 * so the accumulator reached a sixtieth only every eighth frame — the simulation
 * advanced once and then stood still for seven frames. Slow motion came out as
 * stop motion, and the slower it was set the worse it got, which is the opposite
 * of what the control is for. Stepping by the time that actually elapsed, cut
 * into substeps no longer than this, is smooth at every playback and is *more*
 * accurate the slower it runs rather than less.
 */
const STEP = 1 / 60

/** Most substeps in one frame. A tab returning resumes; it does not fast-forward. */
const MAX_STEPS = 4

/** How long the fire is run before a reduced-motion still is taken, in seconds. */
const STILL_SECONDS = 14

/** An ember younger than this is never retired for being dark: it may still be lighting. */
const GRACE = 0.25

/**
 * How one wall frame becomes simulation steps.
 *
 * Pulled out of the frame loop so the property that matters can be checked
 * without a browser: **every frame that is worth any time at all advances the
 * simulation.** That is not a tautology — it is the thing that was broken. An
 * accumulator draining a fixed step advances on some frames and not others, and
 * at 0.12x playback it advanced on one frame in eight, so the piece came out as
 * stop motion and got worse the slower it was set.
 */
export function framePlan(elapsed: number, playback: number): { advance: number; substeps: number; dt: number } {
  const advance = Math.max(0, Math.min(MAX_STEPS * STEP, elapsed * playback))
  const substeps = advance > 0 ? Math.max(1, Math.ceil(advance / STEP)) : 0
  return { advance, substeps, dt: substeps > 0 ? advance / substeps : 0 }
}

export type EmbersStats = {
  /** Embers being simulated. */
  alive: number
  /** Of those, how many put anything on the glass. A cooling ember stops before it dies. */
  drawn: number
  /** Marks bright enough to clip white in the middle. */
  clipped: number
  /** The brightest single mark before the tone curve. Says whether exposure is sane. */
  peak: number
  /** Live vortices in the air. */
  vortices: number
  /** How hard the fire is going, 1 at rest. Above 1 means a burst is in progress. */
  vigour: number
  /** The crosswind at head height right now, m/s, gusts included. */
  crosswind: number
  /** Bursts since the piece started. */
  bursts: number
  /** Seconds of fire simulated. The only exact read of whether time is passing. */
  clock: number
  /** Rolling average, so a heavy setting shows up as a number. */
  fps: number
  /** Milliseconds the last frame's drawing took. */
  drawMs: number
  /**
   * Whether the animation frame loop is going.
   *
   * False under `prefers-reduced-motion`, which gets one still and no loop — an
   * invariant no screenshot can show, because a held fire and a running one look
   * identical in a photograph.
   */
  running: boolean
}

export type Embers = {
  setSettings: (settings: Settings) => void
  stats: () => EmbersStats
  start: () => void
  stop: () => void
  /** Park the frame, or let it run on. Not `stop`, which is teardown. */
  setPaused: (paused: boolean) => void
  /** Run the fire forward. Seconds. */
  settle: (seconds: number) => void
  /** Make the fire surge now. */
  burst: () => void
  setDebug: (on: boolean) => void
  destroy: () => void
}

function require2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Embers: no 2d context")
  return context
}

export function createEmbers(canvas: HTMLCanvasElement, initial: Settings): Embers {
  const context = require2d(canvas)
  const stillOnly = window.matchMedia("(prefers-reduced-motion: reduce)")

  let settings = initial
  let width = 0
  let height = 0
  let dpr = 1
  let view: View = makeView(settings.span, settings.hearth, 1, 1)

  // The one seed in the piece, and it decides almost nothing: a continuous
  // emission has no arrangement to preserve, so all this fixes is which
  // silhouettes exist and the sequence the fire draws its jitter from. There is
  // no reroll button for the same reason — the scene rerolls itself, constantly.
  const seed = 0x656d62
  const rng = makeRng(hashSeed(seed, 0x706f6f6c))

  const air: Air = createAir(settings, seed)
  const bed: Bed = createBed(settings, seed)
  let sheet: Sheet = makeSheet(settings.hue, settings.hueSpread, seed)

  let pool: Ember[] = []
  let free: number[] = []
  let alive = 0

  /** Three wide: the field hands back a velocity and the gas temperature together. */
  const sample = new Float64Array(3)

  let frame = 0
  let running = false
  let previous = 0
  let fps = 0
  let drawMs = 0
  let clock = 0
  let drawn = 0
  let clipped = 0
  let peak = 0
  let debug = false
  /** Set when the picture needs repainting without the fire having moved. */
  let dirty = true

  const isAnimated = () => !stillOnly.matches && settings.playback > 0

  function resizePool(): void {
    const wanted = Math.round(settings.count)
    if (pool.length === wanted) return

    if (wanted > pool.length) {
      while (pool.length < wanted) {
        free.push(pool.length)
        pool.push(blankEmber())
      }
      return
    }

    // Shrinking. Whatever is alive past the new ceiling goes, and the free list
    // is rebuilt rather than filtered — it is a stack of indices and the indices
    // have moved.
    pool = pool.slice(0, wanted)
    free = []
    alive = 0
    for (let at = pool.length - 1; at >= 0; at--) {
      if (pool[at]!.alive) alive++
      else free.push(at)
    }
  }

  function emit(spawn: { x: number; y: number; vx: number; vy: number; heat: number; size: number }): void {
    const at = free.pop()
    // Dropped rather than evicting a live one; see the note at the top.
    if (at === undefined) return

    const ember = pool[at]!
    const low = settings.sizeMin * spawn.size
    const high = Math.max(low, settings.sizeMax * spawn.size)
    // Tone is the ember's place in the hue spread: a clamped normal draw
    // remapped to 0…1, and it has to be *exactly* the inverse of what
    // `bucketHue` does with it — that function reads the ends of 0…1 as ±2.5σ,
    // so the draw has to be divided by five and nothing else. A sum of three
    // uniforms stood here and was a σ of 0.276 rather than 0.2, which made
    // every scene's hue spread 38% wider than its own slider said. That is not
    // a cosmetic error: the fire presets are set just inside the point where a
    // symmetric rotation carries the cool end of the locus past red into
    // magenta.
    const tone = Math.min(1, Math.max(0, 0.5 + gaussian(rng) / 5))
    dress(ember, rng, low, high, settings.heat * spawn.heat, tone)

    ember.x = spawn.x
    ember.y = spawn.y
    // The air the ember is handed to, plus whatever the fire gave it. A lifted
    // flake has almost nothing of its own, so this is where most of its opening
    // motion comes from.
    air.at(spawn.x, spawn.y, sample)
    ember.vx = sample[0]! * 0.85 + spawn.vx
    ember.vy = sample[1]! * 0.85 + spawn.vy
    alive++
  }

  function kill(at: number): void {
    pool[at]!.alive = false
    free.push(at)
    alive--
  }

  function step(dt: number): void {
    clock += dt
    air.step(dt)
    bed.step(dt, air, emit)

    const physics: Physics = {
      flutter: settings.flutter,
      burn: settings.burn,
      breath: settings.breath,
      heat: settings.heat,
    }
    const luminance = sheet.ramps[0]!.luminance

    for (let at = 0; at < pool.length; at++) {
      const ember = pool[at]!
      if (!ember.alive) continue

      samplePath(ember, clock, settings.shutter)

      air.sample(ember.x, ember.y, sample)
      stepEmber(ember, sample, sample[2]!, dt, physics)

      if (beyond(view, ember.x, ember.y)) {
        kill(at)
        continue
      }
      // Retired at exactly the temperature the renderer stops being able to
      // show, which `DARK_TEMP` derives from the draw's own cutoff. The grace
      // period is for an ember born cool that its own combustion is still
      // lighting.
      if (ember.age > GRACE && ember.temp < DARK_TEMP && luminance[rampStep(ember.temp)]! < 2e-4) {
        kill(at)
      }
    }
  }

  function resize(): void {
    const nextWidth = canvas.clientWidth || window.innerWidth
    const nextHeight = canvas.clientHeight || window.innerHeight
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2)
    if (nextWidth === width && nextHeight === height && nextDpr === dpr) return

    width = nextWidth
    height = nextHeight
    dpr = nextDpr
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    view = makeView(settings.span, settings.hearth, width || 1, height || 1)
    air.setBounds(view.halfWidth + view.flank, view.ceilingY + view.margin)
  }

  /**
   * Draw one frame.
   *
   * **It takes no elapsed time, and that is the point of the tail being drawn
   * rather than accumulated.** A frame is a function of the state — the embers
   * and the paths they remember — so it does not matter how long the last one
   * took or how fast the piece is being played back. It used to need the frame's
   * duration to work out how far to fade the buffer, which is what tied the look
   * to the frame rate.
   */
  function draw(): void {
    const began = performance.now()
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    clearFrame(context, view, settings)
    drawFirelight(context, view, settings, air, sheet)
    const stats = drawEmbers(context, pool, view, settings, sheet)
    drawn = stats.drawn
    clipped = stats.clipped
    peak = stats.peak

    if (debug) drawField()

    drawMs += (performance.now() - began - drawMs) * 0.15
  }

  /**
   * The air, drawn.
   *
   * Only reachable through `experiment.debug(true)` or `?debug=1`, and it is
   * what a claim about the flow gets checked against: the plume's envelope, its
   * axis where the wind has put it, and every live vortex with its sign and its
   * core. A field is the one part of this piece a photograph of the result
   * cannot show you.
   */
  function drawField(): void {
    context.globalCompositeOperation = "source-over"
    context.globalAlpha = 1
    context.lineWidth = 1

    context.strokeStyle = "rgb(120 200 255 / 45%)"
    context.beginPath()
    for (let side = -1; side <= 1; side += 2) {
      for (let s = 0; s <= 40; s++) {
        const y = view.floorY + (s / 40) * (view.ceilingY - view.floorY)
        const b = settings.bed / 2 + settings.spread * Math.max(0, y)
        const x = air.axisAt(y) + side * b
        const point: [number, number] = [screenX(view, x), screenY(view, y)]
        if (s === 0) context.moveTo(...point)
        else context.lineTo(...point)
      }
    }
    context.stroke()

    for (const vortex of air.vortices) {
      const radius = Math.max(2, vortex.core * view.pxPerMetre)
      context.strokeStyle = vortex.gamma > 0 ? "rgb(120 255 170 / 60%)" : "rgb(255 150 120 / 60%)"
      context.beginPath()
      context.arc(screenX(view, vortex.x), screenY(view, vortex.y), radius, 0, Math.PI * 2)
      context.stroke()
    }

    // The numbers, on the glass. `stats()` is the honest read and a screenshot
    // cannot show it, which is exactly the gap this closes: a review is
    // conducted from pictures, and "does this cost 4 ms or 40" is not a thing a
    // picture says. Same reason the section asks every piece for a `stats()` at
    // all — see `src/experiments/AGENTS.md`.
    const readout = [
      `${alive} alive  ${drawn} drawn  ${clipped} clipped`,
      `${air.vortices.length} vortices  vigour ${air.vigour().toFixed(2)}  wind ${air.crosswind().toFixed(2)}m/s`,
      `${fps.toFixed(0)} fps  ${drawMs.toFixed(1)}ms draw  peak ${peak.toFixed(1)}`,
      `${view.halfWidth.toFixed(2)}m half-width  ${(view.ceilingY - view.floorY).toFixed(2)}m tall`,
    ]
    context.font = "12px ui-monospace, monospace"
    context.fillStyle = "rgb(180 220 255 / 80%)"
    readout.forEach((line, at) => context.fillText(line, 12, 20 + at * 15))
  }

  /**
   * Run the fire forward, without drawing.
   *
   * **It used to have to draw its last stretch, and no longer does** — which is
   * the tidiest dividend of the tail being drawn rather than accumulated. While
   * the picture was built out of a fading buffer it had no scene at all until
   * enough frames had gone into it, so a fast-forward that drew only its final
   * frame landed on a fire with no tails; the poster, the note's backdrop and the
   * reduced-motion still all fell into that together. Now a frame is a frame:
   * everything it needs is in the embers, including the paths they remember, and
   * those are filled by stepping.
   */
  function advance(seconds: number): void {
    const total = Math.max(0, Math.min(600, seconds))
    const steps = Math.round(total / STEP)
    for (let at = 0; at < steps; at++) step(STEP)
  }

  function tick(now: number): void {
    frame = requestAnimationFrame(tick)

    const elapsed = previous === 0 ? 0 : Math.min(0.25, (now - previous) / 1000)
    previous = now
    if (elapsed > 0) fps += (1 / elapsed - fps) * 0.1

    if (isAnimated()) {
      // **The one place playback is applied.** Everything time-dependent in the
      // piece — the plume's own clock, the shedding, the gusts, the burning, the
      // shutter — is integrated through this step or reads the clock it advances,
      // so half speed is the same fire watched slowly rather than a different
      // fire. Real time is quick: a campfire's updraft just over the coals is
      // about 4.5 m/s, which is what the plume correlations give and what this
      // piece uses, and at a close framing that is two screen-heights a second.
      const plan = framePlan(elapsed, settings.playback)
      for (let at = 0; at < plan.substeps; at++) step(plan.dt)
      // Seconds of *fire* drawn, which is what the shutter is quoted in.
      draw()
      dirty = false
      return
    }

    // Everything that changes the picture without the fire moving: a resize, a
    // colour, the overlay. Without this the loop parks and the canvas keeps
    // whatever was last on it — and setting `canvas.width` on a resize clears
    // it, so the piece would simply vanish when the window changed size.
    if (dirty) {
      dirty = false
      draw()
      return
    }

    cancelAnimationFrame(frame)
    frame = 0
    running = false
  }

  function wake(): void {
    dirty = true
    if (running) return
    running = true
    previous = 0
    frame = requestAnimationFrame(tick)
  }

  const onResize = () => {
    resize()
    wake()
  }

  window.addEventListener("resize", onResize)
  stillOnly.addEventListener("change", wake)

  resizePool()

  return {
    start() {
      resize()
      resizePool()
      // A still gets a fire that has been going a while rather than one that has
      // just been lit.
      if (!isAnimated()) advance(STILL_SECONDS)
      draw()
      wake()
    },

    stop() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
      window.removeEventListener("resize", onResize)
      stillOnly.removeEventListener("change", wake)
    },

    setPaused(paused) {
      if (!paused) {
        wake()
        return
      }
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
    },

    settle(seconds) {
      advance(seconds)
      dirty = true
      wake()
    },

    burst() {
      bed.burst()
      wake()
    },

    setDebug(on) {
      debug = on
      dirty = true
      wake()
    },

    setSettings(next) {
      const before = settings
      settings = next

      air.setSettings(next)
      bed.setSettings(next)
      if (needsSheet(before, next) || !sheetMatches(sheet, next)) {
        sheet = makeSheet(next.hue, next.hueSpread, seed)
      }
      if (before.count !== next.count) resizePool()
      if (before.span !== next.span || before.hearth !== next.hearth) {
        view = makeView(next.span, next.hearth, width || 1, height || 1)
        air.setBounds(view.halfWidth + view.flank, view.ceilingY + view.margin)
      }

      wake()
    },

    stats() {
      return {
        alive,
        drawn,
        clipped,
        peak,
        vortices: air.vortices.length,
        vigour: air.vigour(),
        crosswind: air.crosswind(),
        bursts: bed.bursts,
        clock,
        fps,
        drawMs,
        running,
      }
    },

    destroy() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
      window.removeEventListener("resize", onResize)
      stillOnly.removeEventListener("change", wake)
      pool = []
      free = []
      alive = 0
    },
  }
}
