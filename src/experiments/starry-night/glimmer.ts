/**
 * A single star briefly flaring.
 *
 * Glimmers live outside the layer system: they are per-star events on a
 * sub-second timescale, where a layer's fade runs for 6-26 seconds. A glimmer
 * copies its star's position at birth rather than referencing the dot, so it
 * completes cleanly even if the layer underneath it dies mid-flare.
 */

export type Glimmer = {
  x: number
  y: number
  /** Radius of the star underneath; the flare is drawn proportional to it. */
  radius: number
  durationMs: number
  elapsedMs: number
}

const MIN_DURATION_MS = 250
const MAX_DURATION_MS = 700

/** Multipliers on the star's radius for the bright core and the soft halo. */
const CORE_SCALE = 1.6
const HALO_SCALE = 6
const HALO_ALPHA = 0.3

export function createGlimmer(x: number, y: number, radius: number): Glimmer {
  return {
    x,
    y,
    radius,
    durationMs: MIN_DURATION_MS + Math.random() * (MAX_DURATION_MS - MIN_DURATION_MS),
    elapsedMs: 0,
  }
}

export const isGlimmerAlive = (glimmer: Glimmer) => glimmer.elapsedMs < glimmer.durationMs

/**
 * Brightness across a glimmer's life, 0..1.
 *
 * Deliberately asymmetric: a near-instant attack over the first 18%, then an
 * eased decay across the rest. A symmetric curve reads as a slow pulse — the
 * fast attack is what makes it read as a glint.
 */
export function glimmerEnvelope(progress: number): number {
  const t = Math.min(1, Math.max(0, progress))
  const attack = 0.18
  if (t < attack) return t / attack
  const decay = (t - attack) / (1 - attack)
  return (1 - decay) ** 2
}

/**
 * Draws a halo plus a brightened core over the star already painted underneath.
 * Assumes a light star colour — the halo is white.
 */
export function drawGlimmer(context: CanvasRenderingContext2D, glimmer: Glimmer): void {
  const intensity = glimmerEnvelope(glimmer.elapsedMs / glimmer.durationMs)
  if (intensity <= 0.002) return

  const { x, y, radius } = glimmer
  const haloRadius = radius * HALO_SCALE
  const halo = context.createRadialGradient(x, y, 0, x, y, haloRadius)
  halo.addColorStop(0, `rgba(255, 255, 255, ${intensity * HALO_ALPHA})`)
  halo.addColorStop(1, "rgba(255, 255, 255, 0)")

  context.globalAlpha = 1
  context.fillStyle = halo
  context.beginPath()
  context.arc(x, y, haloRadius, 0, Math.PI * 2)
  context.fill()

  context.globalAlpha = intensity
  context.fillStyle = "#ffffff"
  context.beginPath()
  context.arc(x, y, radius * CORE_SCALE, 0, Math.PI * 2)
  context.fill()
  context.globalAlpha = 1
}
