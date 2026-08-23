import { envelope } from "@/experiments/starry-night/character"

/**
 * Soft mottling beneath the stars, so the ground is not a flat wash of one
 * colour. Clouds fade in and out on their own clocks exactly as the star layers
 * do — they are scenery on the same heartbeat, not a static backdrop.
 *
 * Each layer is pre-rendered once into an offscreen buffer. A full-viewport
 * radial gradient costs roughly a megapixel of blending, and several of those
 * per frame will not hold 60fps; caching turns the per-frame cost into one
 * `drawImage` with `globalAlpha` doing the fading. The buffer is kept at a
 * fraction of the real resolution because the content is soft enough that the
 * upscale is invisible.
 */

const DOWNSCALE = 4
const BLOBS_PER_LAYER = 3

/**
 * How much wider than the viewport each buffer is rendered.
 *
 * Drift needs somewhere to drift from. The buffer covers more than the screen
 * and is drawn at a moving offset inside that slack, so the edges never come
 * into view. Costs nothing per frame — it is the same single drawImage.
 */
const MARGIN = 1.4

/**
 * Alpha jitter, in 8-bit levels, applied once after the gradients are drawn.
 *
 * A cloud's alpha climbs from 0 to roughly 0.2 over several hundred pixels, so
 * at 8-bit precision neighbouring steps collapse onto the same value and the
 * gradient shows as concentric contour rings — the buffer upscale widens each
 * band further. Extra colour stops cannot help; the quantisation is the limit.
 * Jittering alpha breaks the bands into grain, which the upscale then softens.
 */
const DITHER_LEVELS = 9

/** Clouds run on the star tempo, slowed: same clock, statelier drift. */
export const CLOUD_LIFETIME_FACTOR = 3

export type CloudLayer = {
  buffer: HTMLCanvasElement
  lifetimeMs: number
  phase: number
  /**
   * Where the buffer sits within its slack, at birth and at death, each 0..1.
   * Tying drift to the life rather than to a velocity bounds it by
   * construction: a cloud cannot outrun its own margin.
   */
  from: { x: number; y: number }
  to: { x: number; y: number }
}

export function createCloudLayer(
  width: number,
  height: number,
  tint: (alpha: number) => string,
  lifetimeMs: number,
  phase: number,
): CloudLayer | null {
  const bufferWidth = Math.max(1, Math.round((width * MARGIN) / DOWNSCALE))
  const bufferHeight = Math.max(1, Math.round((height * MARGIN) / DOWNSCALE))

  const buffer = document.createElement("canvas")
  buffer.width = bufferWidth
  buffer.height = bufferHeight
  const context = buffer.getContext("2d")
  if (!context) return null

  const span = Math.max(bufferWidth, bufferHeight)
  for (let index = 0; index < BLOBS_PER_LAYER; index += 1) {
    const radius = span * (0.28 + Math.random() * 0.34)

    context.save()
    context.translate(Math.random() * bufferWidth, Math.random() * bufferHeight)
    context.rotate(Math.random() * Math.PI)
    // Squashed, not round: a circular cloud reads as a spotlight.
    context.scale(1, 0.45 + Math.random() * 0.5)

    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius)
    gradient.addColorStop(0, tint(1))
    gradient.addColorStop(0.55, tint(0.45))
    gradient.addColorStop(1, tint(0))
    context.fillStyle = gradient
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  dither(context, bufferWidth, bufferHeight)

  return {
    buffer,
    lifetimeMs,
    phase,
    from: { x: Math.random(), y: Math.random() },
    to: { x: Math.random(), y: Math.random() },
  }
}

function dither(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height)
  const { data } = image
  // Alpha only: the banding lives there, and the tint should stay a single hue.
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] === 0) continue
    data[index] = Math.max(0, Math.min(255, data[index] + (Math.random() - 0.5) * DITHER_LEVELS))
  }
  context.putImageData(image, 0, 0)
}

/**
 * Scratch buffer the cloud layers are combined in, at the same reduced scale
 * they are drawn at. Sized to the viewport, so it must be remade on resize.
 */
export function createCloudScratch(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width / DOWNSCALE))
  canvas.height = Math.max(1, Math.round(height / DOWNSCALE))
  return canvas.getContext("2d")
}

/**
 * Draws a whole set of cloud layers using one full-screen composite.
 *
 * Each layer used to be blended straight onto the canvas, which meant a
 * full-viewport alpha composite per layer per frame — measured at roughly 5ms
 * each at 2560x1440, so five of them cost more than every star put together.
 * They are combined in the reduced-scale scratch first, where a layer costs a
 * sixteenth as much, and only the result is scaled up.
 *
 * Intensity therefore applies to the combined result rather than per layer.
 * The composite maths differ slightly from before; visually it reads as one
 * master opacity, which is what the control was always trying to be.
 */
export function drawCloudSet(
  context: CanvasRenderingContext2D,
  scratch: CanvasRenderingContext2D,
  layers: CloudLayer[],
  width: number,
  height: number,
  fade: number,
  curve: number,
  intensity: number,
): void {
  if (intensity <= 0.002 || layers.length === 0) return

  const scratchWidth = scratch.canvas.width
  const scratchHeight = scratch.canvas.height
  scratch.clearRect(0, 0, scratchWidth, scratchHeight)

  const slack = MARGIN - 1
  let visible = false

  for (const layer of layers) {
    const alpha = envelope(layer.phase, fade, curve)
    if (alpha < 0.002) continue
    visible = true

    const t = Math.min(1, Math.max(0, layer.phase))
    const at = (from: number, to: number) => from + (to - from) * t

    scratch.globalAlpha = alpha
    scratch.drawImage(
      layer.buffer,
      -slack * scratchWidth * at(layer.from.x, layer.to.x),
      -slack * scratchHeight * at(layer.from.y, layer.to.y),
      scratchWidth * MARGIN,
      scratchHeight * MARGIN,
    )
  }

  scratch.globalAlpha = 1
  if (!visible) return

  context.globalAlpha = intensity
  context.drawImage(scratch.canvas, 0, 0, width, height)
}
