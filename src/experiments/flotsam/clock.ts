/**
 * How far one animation frame moves the sea.
 *
 * The frame's wall time comes from the section's `parkingLoop`, which adds
 * nothing on the first frame after a start and never counts a frame for more
 * than `MAX_FRAME`, so a tab left in the background comes back to one short
 * step rather than a jump across everything it missed.
 *
 * **This is the one place the speed is applied, and it has to stay the one
 * place.** Everything time-dependent in the piece reads the clock or is
 * integrated through `advance`, so scaling the step here slows the waves, the
 * current, the gusts and the wind's veering by exactly the same factor — which
 * is what makes it a clock rather than a claim about the water. A control that
 * reached into the sea instead would be the wave-speed setting `waves.ts`
 * refuses to have.
 */
export const MAX_FRAME = 0.25

export function seaStep(elapsed: number, rate: number): number {
  return elapsed * rate
}
