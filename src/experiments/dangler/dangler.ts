/**
 * The engine: canvas, the clock, and everything drawn on it.
 *
 * Holds the arrangement, the chains and the frames together, and decides what a
 * settings change costs. Only `seed`, `wires` and `segments` reallocate; the
 * canopy, the wire parameters, the camera and every colour are read live, so
 * dragging a slider relaxes the scene into its new state rather than replacing
 * it with a fresh one.
 */

import { buildArrangement, flickerAt, type Arrangement } from "@/experiments/dangler/arrangement"
import { createBeads, type Beads } from "@/experiments/dangler/beads"
import { makeCamera, nearFade, project, type Camera } from "@/experiments/dangler/camera"
import { createFrames, updateFrames, type Frames } from "@/experiments/dangler/frame"
import { GROUND, VIGNETTE } from "@/experiments/dangler/palette"
import { createRopes, FIXED_DT, type Ropes } from "@/experiments/dangler/rope"
import { needsRebuild, type Settings } from "@/experiments/dangler/settings"
import { createSway } from "@/experiments/dangler/sway"
import { canopyTremble, createWind } from "@/experiments/dangler/wind"

export type DanglerStats = {
  wires: number
  beads: number
  particles: number
  /** Bulbs that actually reached the canvas this frame. */
  drawnBeads: number
  /** Summed sprite area drawn this frame, in css px². The real cost model. */
  fillPx: number
  /** Largest link-length violation, in world units. ~0 means settled. */
  maxConstraintError: number
  fps: number
  /** False when the loop has parked itself because nothing is moving. */
  running: boolean
}

export type Dangler = {
  start: () => void
  stop: () => void
  setSettings: (next: Settings) => void
  /** Runs the scene to rest. Returns once it is still. */
  settle: () => void
  stats: () => DanglerStats
  /** Draws the wires and anchors that are normally invisible. */
  setDebug: (on: boolean) => void
}

/**
 * Most simulation steps allowed to make up one frame.
 *
 * Without a cap, a frame that runs long asks for more steps next time, which
 * makes it run longer still. The scene falling behind real time is a far better
 * failure than the tab locking up.
 */
const MAX_SUBSTEPS = 12

/**
 * Anchor movement past which a wire is carried to its new place rather than
 * dragged there, in world units.
 *
 * An anchor that moves teleports, and the wire below is left where it was, so
 * the solver hauls it across. Small moves make a pleasant snap — nudging the
 * canopy's spread is the nicest accident in the piece and is what `gust` and
 * `tremble` came from. Large ones do not: changing the branch count moves
 * anchors metres, which throws the wires hard enough that they never settle.
 *
 * Re-settling was tried and is worse than the problem. It blocks: 3056ms of
 * frozen main thread on one notch of the branches slider, because a wire thrown
 * that far does not converge and the settle runs to its cap. Carrying costs
 * about a microsecond — a hanging wire's shape does not depend on where it
 * hangs from, so the wire arrives already settled and still doing whatever it
 * was doing.
 */
const CARRY_ABOVE = 0.1

/**
 * Narrowing a `const` does not reach into hoisted function declarations, and
 * every draw routine below is one — so the guard has to produce a non-null type
 * rather than assert one at the call site.
 */
function require2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Dangler: no 2d context")
  return context
}

export function createDangler(canvas: HTMLCanvasElement, initial: Settings): Dangler {
  const context = require2d(canvas)

  const stillOnly = window.matchMedia("(prefers-reduced-motion: reduce)")

  let settings = withMotionPreference(initial)
  let arrangement: Arrangement = buildArrangement(settings)
  let ropes: Ropes = createRopes(arrangement.specs)
  let frames: Frames = createFrames(ropes.particleCount)
  const beads: Beads = createBeads(context)

  let width = 0
  let height = 0
  let dpr = 1
  let background: HTMLCanvasElement | null = null
  let camera: Camera = makeCamera(settings.fieldOfView, settings.pitch, 1, 1)

  let frame = 0
  let running = false
  let debug = false
  let clock = 0
  let previous = 0
  let accumulator = 0
  let fps = 0
  let drawnBeads = 0
  /** Set when the picture needs repainting without anything having moved. */
  let dirty = true
  const wind = createWind()
  const sway = createSway()
  /** Reused, so sampling the wind allocates nothing however many wires there are. */
  const air = { x: 0, y: 0, z: 0 }

  /**
   * Reduced motion gets a still frame, not a slowed one.
   *
   * It needs no special path: with the breeze and the flicker at zero the loop
   * parks itself once the scene settles, which is exactly the required
   * behaviour, so the preference is expressed by pinning two settings.
   */
  function withMotionPreference(next: Settings): Settings {
    return stillOnly.matches ? { ...next, breeze: 0, gust: 0, tremble: 0, sway: 0, flicker: 0 } : next
  }

  const isAnimated = () => settings.breeze > 0 || settings.gust > 0 || settings.tremble > 0 || settings.flicker > 0

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
    camera = makeCamera(settings.fieldOfView, settings.pitch, width, height)
    background = null
  }

  /**
   * The ground, rendered once per resize.
   *
   * A full-viewport gradient every frame will not hold 60fps. Baked into an
   * opaque buffer it becomes a single blit with no blending at all, which is
   * about as close to free as a full-screen operation gets.
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
      radius * 0.2,
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

  /**
   * The wind at one wire, sampled once for the whole of it.
   *
   * A breeze varies over metres, not over the centimetres between two
   * particles, so there is nothing to gain from sampling per particle. The lag
   * down a wire comes from the chain itself: the force is applied hardest at the
   * free end and the anchor holds the top, so the wire swings and its tip trails
   * rather than the whole thing being shunted sideways.
   */
  function windAt(wire: number): { x: number; y: number; z: number } {
    const anchor = arrangement.specs[wire].anchor
    wind.at(anchor.x, anchor.y, air)
    return air
  }

  /**
   * Shakes the anchors, once per frame rather than once per substep.
   *
   * Written straight into the solver's own array so this allocates nothing at
   * any wire count.
   */
  function updateAnchors(elapsed: number): void {
    const offsets = ropes.anchorOffsets

    // The canopy is driven by the wind at its centre, not per wire — it is one
    // object, and sampling it per anchor would be the very incoherence this is
    // here to avoid.
    wind.at(0, 0, air)
    sway.update(air.x, air.y, clock, elapsed, settings.sway)

    const swaying = settings.sway > 0 && !sway.atRest()
    if (!swaying && settings.tremble <= 0) {
      offsets.fill(0)
      return
    }

    for (let w = 0; w < ropes.wireCount; w++) {
      const anchor = arrangement.specs[w].anchor
      let x = 0
      let y = 0
      let z = 0

      if (swaying) {
        sway.displace(anchor.x, anchor.y, anchor.z, air)
        x = air.x
        y = air.y
        z = air.z
      }

      if (settings.tremble > 0) {
        canopyTremble(anchor.x, anchor.y, clock, settings.tremble, air)
        x += air.x
        y += air.y
        z += air.z
      }

      offsets[w * 3] = x
      offsets[w * 3 + 1] = y
      offsets[w * 3 + 2] = z
    }
  }

  /** Interpolates a bulb's world position and the direction it points. */
  function beadAt(index: number, out: Float64Array): boolean {
    const wire = arrangement.wireOf[index]
    const start = ropes.offset[wire]
    const last = ropes.offset[wire + 1] - 1
    const span = last - start

    const at = start + arrangement.along[index] * span
    const i = Math.min(last - 1, Math.floor(at))
    const f = at - i

    const px = ropes.px[i] + (ropes.px[i + 1] - ropes.px[i]) * f
    const py = ropes.py[i] + (ropes.py[i + 1] - ropes.py[i]) * f
    const pz = ropes.pz[i] + (ropes.pz[i + 1] - ropes.pz[i]) * f

    const nx = frames.nx[i]
    const ny = frames.ny[i]
    const nz = frames.nz[i]
    const tx = frames.tx[i]
    const ty = frames.ty[i]
    const tz = frames.tz[i]
    // Binormal completes the carried frame; no need to store it.
    const bx = ty * nz - tz * ny
    const by = tz * nx - tx * nz
    const bz = tx * ny - ty * nx

    const angle = arrangement.angle[index]
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const ox = nx * cos + bx * sin
    const oy = ny * cos + by * sin
    const oz = nz * cos + bz * sin

    // The bulb sits against the wire rather than on its centreline. The offset is
    // almost invisible; what it is really for is `out[3..5]`, the direction the
    // bulb faces.
    const stand = settings.size * 1.2
    out[0] = px + ox * stand
    out[1] = py + oy * stand
    out[2] = pz + oz * stand
    out[3] = ox
    out[4] = oy
    out[5] = oz
    return true
  }

  const bead = new Float64Array(6)

  function draw(): void {
    resize()
    if (!background) background = paintBackground()

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.globalCompositeOperation = "source-over"
    context.globalAlpha = 1
    context.drawImage(background, 0, 0, width, height)

    updateFrames(ropes, frames)
    beads.reset()
    drawnBeads = 0

    context.globalCompositeOperation = "lighter"

    const reference = settings.ceiling
    const flickering = settings.flicker > 0

    for (let i = 0; i < arrangement.beadCount; i++) {
      beadAt(i, bead)
      const screen = project(camera, bead[0], bead[1], bead[2])
      if (!screen) continue
      if (screen.x < -200 || screen.y < -200 || screen.x > width + 200 || screen.y > height + 200) continue

      let brightness = arrangement.brightness[i] * nearFade(screen.depth)

      // An LED throws its light along its own axis, so a bulb turned away from
      // you is dimmer than one facing you. This is why a real string shimmers as
      // you walk under it, and with the bulbs alternating sides it is most of
      // what stops a wire reading as a row of identical dots.
      if (settings.facing > 0) {
        const length = Math.hypot(bead[0], bead[1], bead[2]) || 1
        const toward = -(bead[3] * bead[0] + bead[4] * bead[1] + bead[5] * bead[2]) / length
        const lit = 0.2 + 0.8 * Math.max(0, toward)
        brightness *= 1 - settings.facing + settings.facing * lit
      }

      // Only the far bulbs dim. Boosting the near ones instead would blow them
      // out, and size already says most of what there is to say about depth.
      if (settings.falloff > 0 && screen.depth > reference) {
        brightness *= (reference / screen.depth) ** (2 * settings.falloff)
      }

      if (flickering) {
        brightness *= flickerAt(arrangement.flickerRate[i], arrangement.flickerPhase[i], clock, settings.flicker)
      }

      if (brightness <= 0) continue

      beads.draw(
        screen.x,
        screen.y,
        settings.size * screen.scale,
        settings.bloom,
        arrangement.hue[i],
        arrangement.saturation[i],
        brightness,
      )
      drawnBeads++
    }

    context.globalCompositeOperation = "source-over"
    context.globalAlpha = 1
    if (debug) drawDebug()
  }

  /**
   * The wires and anchors, which the piece never shows.
   *
   * Not a nicety. With only the bulbs visible, a broken frame, a broken
   * constraint and a broken projection all look the same — a scatter of dots in
   * the wrong places.
   */
  function drawDebug(): void {
    context.lineWidth = 1
    context.strokeStyle = "rgb(90 200 255 / 55%)"

    for (let w = 0; w < ropes.wireCount; w++) {
      context.beginPath()
      let started = false
      for (let i = ropes.offset[w]; i < ropes.offset[w + 1]; i++) {
        const at = project(camera, ropes.px[i], ropes.py[i], ropes.pz[i])
        if (!at) {
          started = false
          continue
        }
        if (started) context.lineTo(at.x, at.y)
        else context.moveTo(at.x, at.y)
        started = true
      }
      context.stroke()

      const anchor = arrangement.specs[w].anchor
      const at = project(camera, anchor.x, anchor.y, anchor.z)
      if (!at) continue
      context.fillStyle = "rgb(255 120 90 / 80%)"
      context.fillRect(at.x - 2, at.y - 2, 4, 4)
    }

    // The canopy's rim, so its extent and relief are visible rather than inferred.
    context.strokeStyle = "rgb(255 120 90 / 30%)"
    context.beginPath()
    let started = false
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2
      const at = project(camera, Math.cos(angle) * settings.extent, Math.sin(angle) * settings.extent, settings.ceiling)
      if (!at) {
        started = false
        continue
      }
      if (started) context.lineTo(at.x, at.y)
      else context.moveTo(at.x, at.y)
      started = true
    }
    context.stroke()
  }

  function advance(elapsed: number, wind: boolean): boolean {
    accumulator += elapsed
    let steps = 0
    while (accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      ropes.step(wind ? windAt : null)
      accumulator -= FIXED_DT
      steps++
    }
    // Behind real time. Dropping the backlog keeps the scene slightly slow
    // rather than letting a long frame ask for more steps and run longer still.
    if (steps === MAX_SUBSTEPS) accumulator = 0
    return steps > 0
  }

  function tick(now: number): void {
    frame = requestAnimationFrame(tick)

    const elapsed = previous === 0 ? 0 : Math.min(0.25, (now - previous) / 1000)
    previous = now
    if (elapsed > 0) fps += (1 / elapsed - fps) * 0.1

    let moved = false
    if (isAnimated()) {
      clock += elapsed
      wind.update(settings, clock)
      updateAnchors(elapsed)
      moved = advance(elapsed, wind.blowing())
    } else if (!ropes.atRest()) {
      moved = advance(elapsed, false)
    }

    // `dirty` covers everything that changes the picture without moving a
    // particle: a resize, the debug overlay, a hue. Without it the loop parks
    // and the canvas keeps whatever was last on it — and setting `canvas.width`
    // on a resize clears it, so the piece simply vanished when the window
    // changed size or a screenshot was taken.
    if (moved || dirty) {
      dirty = false
      draw()
      return
    }

    // Nothing moving and nothing to redraw. Park until something asks for a
    // frame again — this is also the reduced-motion path, which is why that
    // needs no separate one.
    cancelAnimationFrame(frame)
    frame = 0
    running = false
  }

  function wake(): void {
    dirty = true
    if (running) return
    running = true
    previous = 0
    accumulator = 0
    frame = requestAnimationFrame(tick)
  }

  const onResize = () => {
    background = null
    resize()
    wake()
  }

  window.addEventListener("resize", onResize)
  stillOnly.addEventListener("change", () => {
    settings = withMotionPreference(settings)
    wake()
  })

  return {
    start() {
      resize()
      ropes.settle()
      draw()
      wake()
    },

    stop() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
      window.removeEventListener("resize", onResize)
    },

    setSettings(next) {
      const before = settings
      const previousAnchors = arrangement.specs.map(({ anchor }) => anchor)
      settings = withMotionPreference(next)
      arrangement = buildArrangement(settings)

      let laidOutFresh: readonly number[] = []

      if (needsRebuild(before, settings)) {
        // A new seed redraws every wire's length, stiffness, set and twist, not
        // just where it hangs — so nothing carries over and the whole scene is
        // laid out afresh. Carrying wires through a reroll leaves each one's
        // shape contradicting its own new constraints, which the solver then
        // resolves at 139 m/s.
        const previousRopes = before.seed === settings.seed ? ropes : undefined
        ropes = createRopes(arrangement.specs, previousRopes)
        frames = createFrames(ropes.particleCount)
        laidOutFresh = ropes.freshWires
        // Only the wires this build laid out fresh; settling the carried ones
        // would zero their velocity and visibly calm a scene in a breeze.
        ropes.settle(laidOutFresh)
      } else {
        ropes.update(arrangement.specs)
      }

      // Wires whose anchor has been *relocated* rather than nudged go with it.
      // This has to run on both paths: a reroll reallocates but keeps every
      // wire's particle count, so all of them are carried over and every anchor
      // is somewhere new — without this the whole scene is dragged across at
      // once and thrashes.
      const carried = new Set(laidOutFresh)
      const shared = Math.min(previousAnchors.length, arrangement.specs.length)
      for (let w = 0; w < shared; w++) {
        if (carried.has(w)) continue
        const from = previousAnchors[w]
        const to = arrangement.specs[w].anchor
        const dx = to.x - from.x
        const dy = to.y - from.y
        const dz = to.z - from.z
        if (Math.hypot(dx, dy, dz) > CARRY_ABOVE) ropes.carry(w, dx, dy, dz)
      }

      camera = makeCamera(settings.fieldOfView, settings.pitch, width, height)
      wake()
    },

    settle() {
      ropes.settle()
      draw()
    },

    stats: () => ({
      wires: ropes.wireCount,
      beads: arrangement.beadCount,
      particles: ropes.particleCount,
      drawnBeads,
      fillPx: Math.round(beads.fill()),
      maxConstraintError: ropes.maxError(),
      fps: Math.round(fps * 10) / 10,
      running,
    }),

    setDebug(on) {
      debug = on
      wake()
    },
  }
}
