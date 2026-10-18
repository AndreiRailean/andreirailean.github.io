/**
 * A hue in degrees, folded into [0, 360) — negative hues included, which a
 * bare `% 360` leaves negative. Written out the same way in six pieces.
 */
export const wrapHue = (hue: number): number => ((hue % 360) + 360) % 360
