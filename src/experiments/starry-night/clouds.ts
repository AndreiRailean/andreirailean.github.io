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
}

export function createCloudLayer(
  width: number,
  height: number,
  tint: (alpha: number) => string,
  lifetimeMs: number,
  phase: number,
): CloudLayer | null {
  const bufferWidth = Math.max(1, Math.round(width / DOWNSCALE))
  const bufferHeight = Math.max(1, Math.round(height / DOWNSCALE))

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

  return { buffer, lifetimeMs, phase }
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

export function drawCloudLayer(
  context: CanvasRenderingContext2D,
  layer: CloudLayer,
  width: number,
  height: number,
  hold: number,
  intensity: number,
): void {
  const alpha = intensity * envelope(layer.phase, hold)
  if (alpha < 0.002) return
  context.globalAlpha = alpha
  context.drawImage(layer.buffer, 0, 0, width, height)
}
