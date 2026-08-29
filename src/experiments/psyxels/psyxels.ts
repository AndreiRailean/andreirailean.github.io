import { packField, type Field, type Pixel } from "@/experiments/psyxels/field"
import { paintGlyph } from "@/experiments/psyxels/glyphs"
import { buildMask, maskSize, type Mask } from "@/experiments/psyxels/mask"
import { createPalette, GROUND, type Palette } from "@/experiments/psyxels/palette"
import { arrivalOf, breathOf, levelOf } from "@/experiments/psyxels/pulse"
import { needsPacking, needsSubject, type Settings } from "@/experiments/psyxels/settings"
import { paintSubject } from "@/experiments/psyxels/subject"

/**
 * The engine: a canvas, a clock, and the two questions the piece is made of.
 *
 * The still question — what is under each square — is answered once, by
 * `mask.ts`, and consulted by `field.ts` whenever a square is packed. The moving
 * question — what each pixel is doing now — is answered every frame and can move
 * nothing. That separation is the piece: colour, breathing, frames and rates can
 * all be wound anywhere at all and the subject underneath does not shift by a
 * pixel, because nothing on that side of the line is allowed to.
 *
 * Everything here is in CSS pixels. The canvas is scaled by the device ratio
 * once, in `resize`, and no other code in the piece knows about it.
 */

/** Devices past this ratio cost fill rate and return nothing a viewer can see. */
const MAX_RATIO = 2

/** Steps `run()` takes per second of simulated time. */
const RUN_HZ = 30

export type PsyxelsStats = {
  /** Pixels the packing produced, including ones currently below the threshold. */
  pixels: number
  /** Pixels actually painted last frame. */
  drawn: number
  /** How many pixels at each subdivision level, coarsest first. */
  byDepth: number[]
  /** The smallest and largest pixel on screen, in CSS pixels. */
  smallest: number
  largest: number
  /**
   * How well the field covers the subject: intersection over union, against the
   * coverage the subject was rasterised at.
   *
   * The piece's one number for *is this still recognisable*. 1 would be a
   * perfect stencil; the packing never reaches it, because a pixel is a square
   * and a letter is not. Below about 0.6 the subject is being described rather
   * than drawn, and it is usually the threshold or the levels that did it.
   */
  match: number
  /** Painted area over frame area. What the piece costs to look at. */
  fill: number
  /** Squares that have changed size since the field was packed. */
  changes: number
  /** Frame changes the pixels have made since the field was packed. */
  flicks: number
  /** How long the last frame took to paint, in milliseconds, smoothed. */
  drawMs: number
  /** Distinct colours the scene has needed. A wide spread on a photograph wants thousands. */
  colours: number
  /** Seconds on the piece's own clock, which `playback` scales. */
  clock: number
  fps: number
}

export type Psyxels = {
  start: () => void
  stop: () => void
  setSettings: (next: Settings) => void
  /** Draw the squares the packing chose, which the piece never shows. */
  setDebug: (on: boolean) => void
  /** Run the field forward by this many seconds at once, then redraw. */
  run: (seconds: number) => void
  stats: () => PsyxelsStats
}

export type Options = {
  /** The photographic subject. Absent, the piece still runs; the portrait is blank. */
  avatar?: HTMLImageElement | null
}

export function createPsyxels(canvas: HTMLCanvasElement, initial: Settings, options: Options = {}): Psyxels {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Psyxels: no 2d context")
  const ctx = context

  const avatar = options.avatar ?? null
  let settings = initial
  let width = 0
  let height = 0

  const stage = document.createElement("canvas")
  const stageCtx = stage.getContext("2d", { willReadFrequently: true })

  let mask: Mask | null = null
  let field: Field | null = null
  let palette: Palette = createPalette(settings.saturation)

  let clock = 0
  let last = 0
  let frames = 0
  let fps = 0
  let fpsSince = 0
  let drawn = 0
  let fill = 0
  let drawMs = 0
  let debug = false
  let running = false
  let handle = 0
  /** Set by anything that changes the picture without the clock moving. */
  let dirty = true

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")

  /**
   * Rasterises the subject and reads it into the coverage tables.
   *
   * The only expensive thing in the piece — a `getImageData` and five summed-area
   * tables over most of a megapixel — so it happens on a resize, a new subject
   * or a new fill, and never on a frame.
   */
  function rebuildMask(): void {
    if (!stageCtx || width <= 0 || height <= 0) return
    const { cols, rows } = maskSize(width, height)
    stage.width = cols
    stage.height = rows
    stageCtx.setTransform(cols / width, 0, 0, cols / width, 0, 0)
    paintSubject(stageCtx, width, height, settings.subject, settings.fill, avatar)
    mask = buildMask(stage, width, height)
  }

  function rebuildField(): void {
    if (!mask) return
    field = packField(mask, settings, clock)
    dirty = true
  }

  function resize(): void {
    const ratio = Math.min(MAX_RATIO, window.devicePixelRatio || 1)
    const nextWidth = Math.max(1, canvas.clientWidth || window.innerWidth)
    const nextHeight = Math.max(1, canvas.clientHeight || window.innerHeight)
    const pixelWidth = Math.round(nextWidth * ratio)
    const pixelHeight = Math.round(nextHeight * ratio)

    const changed = width !== nextWidth || height !== nextHeight
    width = nextWidth
    height = nextHeight

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    // Setting either dimension clears the canvas, so a parked loop would leave
    // the piece simply gone after a resize. Inherited from Dangler and Flotsam,
    // where it was a real bug both times.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    dirty = true

    if (changed) {
      rebuildMask()
      rebuildField()
    }
  }

  /**
   * One pixel, drawn.
   *
   * Three multiplied factors decide its alpha and nothing decides its position:
   * where it is was settled when it was packed. See `pulse.ts` for what each
   * factor answers.
   */
  function paintPixel(pixel: Pixel, time: number, span: number): number {
    const level = levelOf(pixel.ink, settings.threshold, settings.flatten)
    if (level <= 0) return 0

    const arrival = arrivalOf(time, pixel.born)
    const spatial = (pixel.x + pixel.y * 0.62) / span
    const alpha = level * breathOf(pixel, settings, time, spatial) * arrival
    if (alpha < 0.012) return 0

    // The arrival scales the mark as well as fading it: a pixel that only fades
    // in still arrives at full size, and four of them appearing inside the
    // square that was there a frame ago reads as a flash rather than a split.
    const extent = (pixel.size / 2) * (1 - settings.inset) * (0.6 + 0.4 * arrival)
    const colour = palette.colour(pixel, settings)

    ctx.globalAlpha = alpha
    ctx.strokeStyle = colour
    ctx.fillStyle = colour
    paintGlyph(
      ctx,
      pixel.glyph,
      pixel.x + pixel.size / 2,
      pixel.y + pixel.size / 2,
      extent,
      Math.max(0.7, pixel.size * settings.weight),
    )

    return extent * extent * 4
  }

  function draw(time: number): void {
    const began = performance.now()
    ctx.globalAlpha = 1
    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, width, height)

    if (!field) return
    const pixels = field.pixels()
    const span = width + height
    let painted = 0
    let area = 0

    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    for (const pixel of pixels) {
      const covered = paintPixel(pixel, time, span)
      if (covered > 0) {
        painted++
        area += covered
      }
    }

    drawn = painted
    fill = area / (width * height)

    if (debug) paintDebug(pixels)
    ctx.globalAlpha = 1
    // Smoothed, because a single frame's timing is dominated by whatever else
    // the machine was doing during it.
    drawMs = drawMs === 0 ? performance.now() - began : drawMs * 0.9 + (performance.now() - began) * 0.1
  }

  /** The squares themselves, which the piece otherwise never shows. */
  function paintDebug(pixels: Pixel[]): void {
    ctx.globalAlpha = 0.4
    ctx.lineWidth = 0.5
    ctx.strokeStyle = "#39d0ff"
    ctx.beginPath()
    for (const pixel of pixels) ctx.rect(pixel.x, pixel.y, pixel.size, pixel.size)
    ctx.stroke()
  }

  function step(now: number): void {
    const elapsed = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000)
    last = now

    // The clock is scaled in exactly one place, so the breathing, the frame
    // changes and the repacking all slow by the same factor and every
    // relationship between them survives.
    const frozen = reduced?.matches ?? false
    const advance = frozen ? 0 : elapsed * settings.playback
    clock += advance

    if (advance > 0 || dirty) {
      if (field) field.update(clock, settings)
      draw(clock)
      dirty = false
    }

    frames++
    if (now - fpsSince >= 1000) {
      fps = (frames * 1000) / (now - fpsSince)
      frames = 0
      fpsSince = now
    }

    if (running) handle = window.requestAnimationFrame(step)
  }

  const observer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          resize()
        })

  resize()
  observer?.observe(canvas)
  window.addEventListener("resize", resize)

  // The portrait usually is not decoded yet when the piece is created, and an
  // undecoded image rasterises to nothing at all — a blank subject, a field with
  // no pixels in it, and no error anywhere. Rebuilding on load is the whole fix,
  // and it costs nothing on the scenes that never look at it.
  const onAvatarLoad = () => {
    if (settings.subject !== "avatar") return
    rebuildMask()
    rebuildField()
  }
  if (avatar && !avatar.complete) avatar.addEventListener("load", onAvatarLoad)

  return {
    start() {
      if (running) return
      running = true
      last = 0
      fpsSince = performance.now()
      handle = window.requestAnimationFrame(step)
    },

    stop() {
      running = false
      window.cancelAnimationFrame(handle)
      observer?.disconnect()
      window.removeEventListener("resize", resize)
      avatar?.removeEventListener("load", onAvatarLoad)
    },

    setSettings(next) {
      const before = settings
      settings = next
      if (next.saturation !== before.saturation) palette = createPalette(next.saturation)
      if (needsSubject(before, next)) rebuildMask()
      if (needsPacking(before, next)) rebuildField()
      dirty = true
    },

    setDebug(on) {
      debug = on
      dirty = true
    },

    /**
     * Steps the field forward without waiting for it.
     *
     * Stepped rather than jumped, because every clock in the piece is a
     * *deadline* — a pixel changes frame when enough time has passed since its
     * last change — and a single jump of forty seconds fires each of them once
     * rather than forty times. A poster of a field that has repacked once is a
     * poster of frame one.
     */
    run(seconds) {
      if (!field || !(seconds > 0)) return
      const steps = Math.min(6000, Math.round(seconds * RUN_HZ))
      for (let i = 0; i < steps; i++) {
        clock += 1 / RUN_HZ
        field.update(clock, settings)
      }
      draw(clock)
      dirty = false
    },

    stats() {
      const pixels = field ? field.pixels() : []
      let smallest = Infinity
      let largest = 0
      let inter = 0
      let covered = 0

      for (const pixel of pixels) {
        if (pixel.size < smallest) smallest = pixel.size
        if (pixel.size > largest) largest = pixel.size
        if (levelOf(pixel.ink, settings.threshold, settings.flatten) <= 0) continue
        const area = pixel.size * pixel.size
        covered += area
        inter += pixel.ink * area
      }

      const union = (mask?.total ?? 0) + covered - inter
      return {
        pixels: pixels.length,
        drawn,
        byDepth: field ? field.byDepth() : [],
        smallest: Number.isFinite(smallest) ? smallest : 0,
        largest,
        match: union > 0 ? inter / union : 0,
        fill,
        changes: field ? field.changes() : 0,
        flicks: field ? field.flicks() : 0,
        drawMs,
        colours: palette.size(),
        clock,
        fps,
      }
    },
  }
}
