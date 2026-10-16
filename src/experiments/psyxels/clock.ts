/**
 * How far one animation frame moves the piece's clock.
 *
 * `last` is the timestamp of the previous frame, or 0 when there was none — the
 * first frame after `start()` or a resume, which therefore adds nothing.
 *
 * **The cap is the guard, not the reset.** A frame never counts for more than
 * `MAX_FRAME` of wall time, so a tab left in the background, a long hold or a
 * resume that forgot to clear `last` all cost one short step rather than the
 * whole gap in one jump.
 *
 * The clock is scaled by `playback` in exactly this one place, so the
 * breathing, the frame changes and the repacking all slow by the same factor;
 * reduced motion holds it at zero.
 */
export const MAX_FRAME = 0.1

export function frameAdvance(last: number, now: number, playback: number, frozen: boolean): number {
  const elapsed = last === 0 ? 0 : Math.min(MAX_FRAME, (now - last) / 1000)
  return frozen ? 0 : elapsed * playback
}
