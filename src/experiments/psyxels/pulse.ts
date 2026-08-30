import type { Psyx } from "@/experiments/psyxels/field"
import type { Settings } from "@/experiments/psyxels/settings"

/**
 * How bright a psyx is at a moment: the three factors, kept separate and kept
 * out of the drawing code.
 *
 * They multiply, and they answer different questions. `levelOf` is *how much
 * subject is here*, which is a fact about the picture. `breathOf` is *where the
 * psyx is in its own cycle*, which is a fact about the psyx. `arrivalOf` is
 * *how long it has existed*, which is a fact about the packing. Only the first
 * survives when everything is turned off, and that is the still image.
 */

const TAU = Math.PI * 2

/** Eased at both ends: 6t⁵ − 15t⁴ + 10t³, whose first and second derivatives vanish at both. */
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * Longest a change of frame may take, however slow the psyx is.
 *
 * A transition is a share of the interval it starts, so a psyx changing twice a
 * minute would otherwise spend twenty seconds in the middle of a morph — which
 * is not a slow change of frame, it is a psyx that never shows a frame at all.
 */
export const MORPH_MAX = 0.55

/**
 * How far a psyx is through its change of frame, eased at both ends.
 *
 * **A share of the current hold rather than a fixed duration**, because the
 * flicker control spans two orders of magnitude: a quarter-second ease is
 * languid at one change every two seconds and never completes at five a second,
 * so the field would sit permanently between frames and the vocabulary would
 * stop being legible. At `morph: 0` this is 1 from the first instant, which is
 * the hard cut the piece had before.
 */
export function morphOf(psyx: Psyx, settings: Settings, time: number): number {
  const span = Math.min(MORPH_MAX, settings.morph * psyx.gap)
  if (!(span > 0)) return 1
  return smooth(Math.min(1, Math.max(0, (time - psyx.flicked) / span)))
}

/**
 * How much of the subject a psyx is standing in for, and whether it is there
 * at all.
 *
 * A black point, a band of doubt around it, and a curve above it.
 *
 * `threshold` is the black point. On a letter it decides how much of a square
 * has to be inside the stroke before it appears; on a photograph it decides
 * which tones are the subject at all — the portrait's wall is a mid grey and its
 * shadowed cheek is not far off it, and where the point falls between them is
 * the difference between a face and a rectangle of psyxels.
 *
 * **`fuzz` is what stops that being a cut.** A hard point means a psyx is
 * inside the artwork or it does not exist, and a letter drawn that way has a
 * boundary as exact as the letter's own — which is the one place the field stops
 * looking packed and starts looking clipped. Inside the band, a psyx is there
 * *by luck*: its own draw against how far through the band its coverage sits. So
 * the boundary becomes a scatter of psyxels thinning outward, some of them
 * hanging off the edge of the artwork entirely, rather than a line. At `fuzz: 0`
 * the band closes and this is exactly the cut it was before.
 *
 * `flatten` is the curve above the band, from linear to nearly flat. The first
 * version lifted the level toward full instead — `ink + (1 - ink) × flatten` —
 * which looks right on a letter, where ink is 1 almost everywhere, and gives a
 * photograph a hard cut with no shading above it: every surviving tone came out
 * at nearly the same brightness and the face read as a splotch.
 */
export function levelOf(ink: number, luck: number, threshold: number, fuzz: number, flatten: number): number {
  const band = 0.5 * fuzz
  const floor = threshold - band
  if (ink <= floor) return 0

  if (band > 0 && ink < threshold + band) {
    // Eased so the fringe thins out rather than ending on a line of its own.
    const through = (ink - floor) / (2 * band)
    if (luck > through * through * (3 - 2 * through)) return 0
  }

  const above = (ink - floor) / Math.max(1e-6, 1 - floor)
  return Math.min(1, above ** (1 - 0.92 * flatten))
}

/**
 * Where a psyx is in its own breath, as a multiplier from `1 - depth` to 1.
 *
 * `wave` mixes the psyx's own phase toward one read off its position, and its
 * own rate toward the field's — both, because a wave crossing a field whose
 * psyxels run at different rates smears back into a simmer within a few cycles.
 * At `wave: 0` every psyx is alone and the field shimmers; at 1 the pulse is a
 * single slope travelling across the picture.
 */
export function breathOf(psyx: Psyx, settings: Settings, time: number, spatial: number): number {
  const depth = Math.min(1, settings.pulse * psyx.swing)
  if (depth <= 0) return 1

  const rate = psyx.rate + (1 - psyx.rate) * settings.wave
  const phase = psyx.phase + (spatial - psyx.phase) * settings.wave
  const swing = 0.5 + 0.5 * Math.sin(TAU * (time * settings.tempo * rate + phase))
  return 1 - depth + depth * swing
}

/** How long a newly packed psyx of the finest grain takes to be fully here. */
export const BIRTH_S = 0.5

/**
 * How much quicker the coarsest psyx arrives and leaves than the finest.
 *
 * **A large unit should have more gravity, not less.** Eased over the same span
 * as a speck, a coarse mark spends its whole arrival as a translucent ghost of
 * itself and its whole departure as a hole — and being large, both read as an
 * event rather than as grain moving. The piece's author asked for this in as
 * many words; it is also the third claim of
 * `../docs/adr/20260830-large-units-demand-attention.md`.
 */
const GRAVITY = 0.32

/** How long a psyx of this size takes to arrive or to go. */
export const spanOf = (share: number) => BIRTH_S * (GRAVITY + (1 - GRAVITY) * (1 - Math.min(1, share)))

/**
 * A psyx arriving, eased.
 *
 * Repacking is instantaneous underneath — a square is four squares between one
 * frame and the next — and shown that way it reads as a glitch. Newcomers grow
 * and brighten into place instead, which is the only thing in the piece that
 * makes a size change legible as an event rather than a discontinuity.
 */
export function arrivalOf(time: number, born: number, span = BIRTH_S): number {
  return smooth(Math.min(1, Math.max(0, (time - born) / Math.max(1e-3, span))))
}
