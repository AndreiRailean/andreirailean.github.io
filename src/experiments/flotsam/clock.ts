/**
 * How far one animation frame moves the sea.
 *
 * `previous` is the last frame's timestamp, or 0 when there was none, so the
 * first frame after a start adds nothing. A frame never counts for more than
 * `MAX_FRAME` of wall time, so a tab left in the background comes back to one
 * short step rather than a jump across everything it missed.
 *
 * **This is the one place `playback` is applied, and it has to stay the one
 * place.** Everything time-dependent in the piece reads the clock or is
 * integrated through `advance`, so scaling the step here slows the waves, the
 * current, the gusts and the wind's veering by exactly the same factor — which
 * is what makes it a clock rather than a claim about the water. A control that
 * reached into the sea instead would be the wave-speed setting `waves.ts`
 * refuses to have.
 */
export const MAX_FRAME = 0.25

export function frameStep(previous: number, now: number, playback: number): { elapsed: number; step: number } {
  const elapsed = previous === 0 ? 0 : Math.min(MAX_FRAME, (now - previous) / 1000)
  return { elapsed, step: elapsed * playback }
}
