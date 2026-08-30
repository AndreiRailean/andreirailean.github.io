import type { Pixel } from "@/experiments/psyxels/field"
import type { Settings } from "@/experiments/psyxels/settings"

/**
 * How bright a pixel is at a moment: the three factors, kept separate and kept
 * out of the drawing code.
 *
 * They multiply, and they answer different questions. `levelOf` is *how much
 * subject is here*, which is a fact about the picture. `breathOf` is *where the
 * pixel is in its own cycle*, which is a fact about the pixel. `arrivalOf` is
 * *how long it has existed*, which is a fact about the packing. Only the first
 * survives when everything is turned off, and that is the still image.
 */

const TAU = Math.PI * 2

/** Eased at both ends: 6t⁵ − 15t⁴ + 10t³, whose first and second derivatives vanish at both. */
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * Longest a change of frame may take, however slow the pixel is.
 *
 * A transition is a share of the interval it starts, so a pixel changing twice a
 * minute would otherwise spend twenty seconds in the middle of a morph — which
 * is not a slow change of frame, it is a pixel that never shows a frame at all.
 */
export const MORPH_MAX = 0.55

/**
 * How far a pixel is through its change of frame, eased at both ends.
 *
 * **A share of the current hold rather than a fixed duration**, because the
 * flicker control spans two orders of magnitude: a quarter-second ease is
 * languid at one change every two seconds and never completes at five a second,
 * so the field would sit permanently between frames and the vocabulary would
 * stop being legible. At `morph: 0` this is 1 from the first instant, which is
 * the hard cut the piece had before.
 */
export function morphOf(pixel: Pixel, settings: Settings, time: number): number {
  const span = Math.min(MORPH_MAX, settings.morph * pixel.gap)
  if (!(span > 0)) return 1
  return smooth(Math.min(1, Math.max(0, (time - pixel.flicked) / span)))
}

/**
 * How much of the subject a pixel is standing in for.
 *
 * A black point and a curve, which is one more thing than it first needed and
 * the difference between a letter and a portrait working at once.
 *
 * `threshold` is the black point: below it a pixel is not dim, it is *absent* —
 * a hole in the field rather than a faint mark. That is what makes a letter's
 * edge hard, and on a photograph it is what decides which tones are the subject
 * at all. The portrait's wall is a mid grey and its shadowed cheek is not far
 * off it; where the point falls between them is the whole difference between a
 * face and a rectangle of pixels.
 *
 * `flatten` is the curve above it, from linear to nearly flat. The first
 * version of this lifted the level toward full instead — `ink + (1 - ink) ×
 * flatten` — and it looked right on the letter, where ink is 1 almost
 * everywhere, while giving the photograph a hard cut with no shading above it:
 * every surviving tone came out at nearly the same brightness and the face read
 * as a splotch. A curve costs one `**` and gives both, because a letter's
 * interior is at 1 whatever exponent it is raised to.
 */
export function levelOf(ink: number, threshold: number, flatten: number): number {
  if (ink <= threshold) return 0
  const above = (ink - threshold) / Math.max(1e-6, 1 - threshold)
  return Math.min(1, above ** (1 - 0.92 * flatten))
}

/**
 * Where a pixel is in its own breath, as a multiplier from `1 - depth` to 1.
 *
 * `wave` mixes the pixel's own phase toward one read off its position, and its
 * own rate toward the field's — both, because a wave crossing a field whose
 * pixels run at different rates smears back into a simmer within a few cycles.
 * At `wave: 0` every pixel is alone and the field shimmers; at 1 the pulse is a
 * single slope travelling across the picture.
 */
export function breathOf(pixel: Pixel, settings: Settings, time: number, spatial: number): number {
  const depth = Math.min(1, settings.pulse * pixel.swing)
  if (depth <= 0) return 1

  const rate = pixel.rate + (1 - pixel.rate) * settings.wave
  const phase = pixel.phase + (spatial - pixel.phase) * settings.wave
  const swing = 0.5 + 0.5 * Math.sin(TAU * (time * settings.tempo * rate + phase))
  return 1 - depth + depth * swing
}

/** How long a newly packed pixel takes to be fully here. */
export const BIRTH_S = 0.5

/**
 * A pixel arriving, eased.
 *
 * Repacking is instantaneous underneath — a square is four squares between one
 * frame and the next — and shown that way it reads as a glitch. Newcomers grow
 * and brighten into place instead, which is the only thing in the piece that
 * makes a size change legible as an event rather than a discontinuity.
 */
export function arrivalOf(time: number, born: number): number {
  return smooth(Math.min(1, Math.max(0, (time - born) / BIRTH_S)))
}
