/**
 * The engine: the canvas, the loop, and everything drawn on it.
 *
 * The water itself — the sea, the current, the flotsam, the one integration
 * step and every number `stats()` reports about them — is `water.ts`, and has no
 * canvas in it. This file asks it where each piece is and how bright once a
 * frame, and puts the specks there. What it adds on top is what only a page
 * has: the pixel ratio, the vignette, the light the specks actually made, the
 * frame rate and the loop parking itself.
 *
 * Settings changes are the water's to cost. The sea, the current and the
 * flotsam are rebuilt independently there, because they change on different
 * occasions: turning up the steepness rebuilds the waves and leaves every piece
 * where the current has taken it, and changing a colour rebuilds the population
 * without disturbing the water.
 */

import { context2d, fitCanvas } from "@/experiments/simulation/canvas"
import { parkingLoop } from "@/experiments/simulation/loop"
import { MAX_FRAME, seaStep } from "@/experiments/flotsam/clock"
import { currentAt } from "@/experiments/flotsam/current"
import { GROUND, VIGNETTE } from "@/experiments/flotsam/palette"
import { createSpecks, type Specks } from "@/experiments/flotsam/specks"
import type { Settings } from "@/experiments/flotsam/settings"
import { screenX, screenY, worldX, worldY } from "@/experiments/flotsam/view"
import { createWater, type Water } from "@/experiments/flotsam/water"

export type FlotsamStats = {
  dots: number
  /** Wave trains in the sea. */
  trains: number
  /** Σ Aₙkₙ, the sea's total steepness. 1 is where the water folds. */
  steepness: number
  /**
   * Smallest area-compression factor found anywhere on the patch this frame.
   *
   * Below 1 the flotsam is being gathered, and **at or below 0 the displacement
   * map has folded** and the sea is inside out. A still cannot tell the two
   * apart; this is the piece's equivalent of Dangler's constraint error.
   */
  minJacobian: number
  /**
   * Index of dispersion of the flotsam over a grid of the frame: the variance of
   * the per-cell counts divided by their mean.
   *
   * 1 is a uniform random scatter, which is exactly where the piece starts,
   * because that is how the homes are drawn. Above 1 is clustered. **This is the
   * number that says the waves are gathering the flotsam into lines**, and no
   * screenshot can be made to say it.
   *
   * It reads gathering coarser than a cell and is blind to anything finer, which
   * is worth knowing before trusting a low number: a wave shorter than about
   * four crests to the frame compresses the water just as hard and barely moves
   * this at all.
   */
  dispersion: number
  /** RMS wave displacement across the population, in metres. What swinging costs. */
  orbit: number
  /** Mean speed of the rest positions, in m/s. What actually takes flotsam away. */
  transport: number
  /** Pieces that reached the canvas this frame. */
  drawnDots: number
  /** Summed sprite area drawn this frame, in css px². The real cost model. */
  fillPx: number
  /**
   * Pieces the screen cannot resolve as a point: their core fell under the
   * sub-pixel floor, so they were drawn wider and fainter than asked.
   *
   * The trade is energy-preserving, so `light` barely notices it — which is why
   * this is reported separately. `light` is dominated by the halo and says how
   * much haze there is; this says how much of the population is *only* haze. At
   * `simmer` on a phone it was all of them, and that is what "the dots lost their
   * shine" turned out to mean.
   */
  dimmedDots: number
  /**
   * How much light the scene is making, as alpha-weighted sprite area over the
   * area of the canvas.
   *
   * 1 is a frame's worth of fully-lit pixels, spread however it happens to be
   * spread. **No single control owns this** — the count, both ends of the size
   * range, the size mix, the gleam and the exposure all move it, which is
   * exactly why it is worth reporting: judging "too bright" by eye means judging
   * it on one monitor in one room, and every other way of dimming a scene also
   * empties, narrows or flattens it.
   */
  light: number
  /** Seconds of sea simulated since the piece opened. */
  clock: number
  fps: number
  /** False when the loop has parked itself because nothing is moving. */
  running: boolean
}

export type Flotsam = {
  start: () => void
  stop: () => void
  /**
   * Hold the loop where it is, or let it run on.
   *
   * Not `stop()` and `start()`: those are teardown and setup — they drop and
   * re-add the resize listener, and starting redraws and re-measures. This parks the
   * animation frame and nothing else, and resuming picks the clock up from the
   * moment it comes back rather than from where it was left, so a piece held for
   * a minute does not leap a minute when it is let go.
   */
  setPaused: (paused: boolean) => void
  setSettings: (next: Settings) => void
  /** Advance the sea by this many seconds at once, then redraw. */
  run: (seconds: number) => void
  stats: () => FlotsamStats
  /** Draw the wave crests and the current, which the piece never shows. */
  setDebug: (on: boolean) => void
}

/**
 * Narrowing a `const` does not reach into hoisted function declarations, and
 * every draw routine below is one — so the guard has to produce a non-null type
 * rather than assert one at the call site.
 */
export function createFlotsam(canvas: HTMLCanvasElement, initial: Settings): Flotsam {
  const context = context2d(canvas, "Flotsam")

  const stillOnly = window.matchMedia("(prefers-reduced-motion: reduce)")

  const water: Water = createWater(initial)
  const specks: Specks = createSpecks(context)

  let width = 0
  let height = 0
  let dpr = 1
  let background: HTMLCanvasElement | null = null

  let debug = false

  /** Reused by the debug overlay, so drawing the current allocates nothing. */
  const flow = { x: 0, y: 0 }

  /**
   * Reduced motion gets a still frame, not a slowed one.
   *
   * Unlike Dangler this cannot be expressed by pinning settings to zero, because
   * the waves have no speed setting to pin — their speed comes from their length
   * through the dispersion relation, and a sea with a wavelength has a period
   * whether anyone wants one or not. So the clock is simply not advanced, which
   * gives a still of the sea at t = 0 with all its shape and gathering intact
   * rather than the flat water that zeroing the steepness would give.
   */
  const isAnimated = () => {
    const settings = water.settings
    return (
      !stillOnly.matches &&
      settings.playback > 0 &&
      (settings.steepness > 0 ||
        settings.drift > 0 ||
        settings.eddies > 0 ||
        (settings.stokes > 0 && water.sea.steepness > 0))
    )
  }

  function resize(): void {
    const next = fitCanvas(canvas, { width, height, dpr })
    if (!next) return
    ;({ width, height, dpr } = next)
    water.resize(width, height)
    background = null
  }

  /**
   * The water, rendered once per resize.
   *
   * A full-viewport gradient every frame will not hold 60fps. Baked into an
   * opaque buffer it becomes a single blit with no blending at all.
   *
   * **This is the only thing drawn that is not a piece of flotsam.** The sea
   * itself is never rendered — no surface, no crests, no shading. Everything you
   * read as water is read off the specks: how they swing, where they gather, and
   * when they catch the light. Drawing the surface was never tried, because the
   * moment it exists the flotsam is decoration on top of it rather than the only
   * evidence there is.
   */
  function paintBackground(): HTMLCanvasElement {
    const buffer = document.createElement("canvas")
    buffer.width = Math.max(1, Math.round(width))
    buffer.height = Math.max(1, Math.round(height))
    const ctx = buffer.getContext("2d")
    if (!ctx) return buffer

    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, buffer.width, buffer.height)

    const radius = Math.hypot(buffer.width, buffer.height) / 2
    const vignette = ctx.createRadialGradient(
      buffer.width / 2,
      buffer.height / 2,
      radius * 0.25,
      buffer.width / 2,
      buffer.height / 2,
      radius,
    )
    vignette.addColorStop(0, "rgb(0 0 0 / 0%)")
    vignette.addColorStop(1, `rgb(0 0 0 / ${Math.round(VIGNETTE * 100)}%)`)
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, buffer.width, buffer.height)
    return buffer
  }

  function draw(): void {
    resize()
    if (!background) background = paintBackground()

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.globalCompositeOperation = "source-over"
    context.globalAlpha = 1
    context.drawImage(background, 0, 0, width, height)

    const seen = water.survey()

    specks.reset()
    context.globalCompositeOperation = "lighter"
    specks.setSoftness(water.settings.softness)
    // The sub-pixel floor is about the real pixel grid, and the canvas is backed
    // at `dpr`. See MIN_CORE_DEVICE_PX.
    specks.setScale(dpr)

    const { scatter } = water
    const { visible, px, py, core, halo, brightness } = seen
    for (let n = 0; n < seen.count; n++) {
      const i = visible[n]!
      specks.draw(px[i]!, py[i]!, core[i]!, halo[i]!, scatter.hue[i]!, scatter.saturation[i]!, brightness[i]!)
    }

    context.globalCompositeOperation = "source-over"
    context.globalAlpha = 1
    if (debug) drawDebug()
  }

  /**
   * The waves and the current, which the piece never shows.
   *
   * Not a nicety. With only the flotsam visible, a sea running the wrong way, a
   * current running the wrong way and a response table full of zeroes all look
   * identical — a scatter of dots that is not doing very much. This is the
   * difference between debugging and guessing, and it is where the sign of the
   * horizontal displacement was checked the one time it mattered.
   */
  function drawDebug(): void {
    const centreX = width / 2
    const centreY = height / 2
    const diagonal = Math.hypot(width, height)

    const { sea, view, current, clock } = water

    for (const train of sea.trains) {
      const spacing = train.wavelength / view.metresPerPx
      if (spacing < 6) continue

      // Crests are the lines where the phase is a multiple of 2π. Perpendicular
      // to the direction of travel, and marching along it at the phase speed.
      const dirX = train.dx
      const dirY = -train.dy
      const offset = ((train.omega * clock - train.phase) / (2 * Math.PI)) * spacing
      const start = -Math.ceil(diagonal / spacing)

      context.strokeStyle = `rgb(90 200 255 / ${Math.min(0.5, train.amplitude * train.k * 0.6).toFixed(3)})`
      context.lineWidth = 1
      context.beginPath()
      for (let n = start; n <= -start; n++) {
        const along = n * spacing + (offset % spacing)
        const ax = centreX + dirX * along
        const ay = centreY + dirY * along
        context.moveTo(ax - dirY * diagonal, ay + dirX * diagonal)
        context.lineTo(ax + dirY * diagonal, ay - dirX * diagonal)
      }
      context.stroke()
    }

    // The current, as arrows on a grid. A uniform set and a swirl look the same
    // in the flotsam until you can see the field they came from.
    context.strokeStyle = "rgb(255 150 90 / 70%)"
    context.lineWidth = 1.5
    const arrowSeconds = 3
    for (let j = 0; j < 6; j++) {
      for (let i = 0; i < 10; i++) {
        const x = worldX(view, (i + 0.5) / 10)
        const y = worldY(view, (j + 0.5) / 6)
        currentAt(current, x, y, clock, flow)
        const fromX = screenX(view, x)
        const fromY = screenY(view, y)
        // Arrows are drawn as where the water gets to in three seconds, so their
        // length is metres of travel rather than an arbitrary gain.
        const toX = screenX(view, x + flow.x * arrowSeconds)
        const toY = screenY(view, y + flow.y * arrowSeconds)
        context.beginPath()
        context.moveTo(fromX, fromY)
        context.lineTo(toX, toY)
        context.stroke()
        context.fillStyle = "rgb(255 150 90 / 70%)"
        context.fillRect(fromX - 1.5, fromY - 1.5, 3, 3)
      }
    }
  }

  const loop = parkingLoop({
    clamp: MAX_FRAME,
    frame(elapsed) {
      if (!isAnimated()) return "idle"
      // `seaStep` is the only place `playback` is applied — see `clock.ts`.
      water.step(seaStep(elapsed, water.settings.playback))
      return "moved"
    },
    draw,
  })
  const wake = loop.wake

  const onResize = () => {
    background = null
    resize()
    wake()
  }

  window.addEventListener("resize", onResize)
  stillOnly.addEventListener("change", wake)

  return {
    start() {
      resize()
      draw()
      wake()
    },

    stop() {
      loop.hold()
      window.removeEventListener("resize", onResize)
      // Both of them, or the one left behind holds this whole closure alive —
      // canvas, settings and 8,500 specks — for every mount that is ever torn
      // down. See #168; `tests/unit/experiments-listeners.test.ts` now checks it.
      stillOnly.removeEventListener("change", wake)
    },

    setPaused(paused) {
      if (!paused) {
        wake()
        return
      }
      loop.hold()
    },

    setSettings(next) {
      water.setSettings(next)
      wake()
    },

    /** Stepped in fixed steps; see `Water.run` for why it is not one jump. */
    run(seconds) {
      water.run(seconds)
      draw()
    },

    stats: () => {
      const measured = water.stats()
      return {
        dots: measured.dots,
        trains: measured.trains,
        steepness: measured.steepness,
        minJacobian: measured.minJacobian,
        dispersion: measured.dispersion,
        orbit: measured.orbit,
        transport: measured.transport,
        drawnDots: measured.drawnDots,
        fillPx: Math.round(specks.fill()),
        dimmedDots: specks.dimmed(),
        light: Math.round((specks.lit() / Math.max(1, width * height)) * 1000) / 1000,
        clock: measured.clock,
        fps: Math.round(loop.fps() * 10) / 10,
        running: loop.running(),
      }
    },

    setDebug(on) {
      debug = on
      wake()
    },
  }
}
