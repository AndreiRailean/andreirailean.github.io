/**
 * The two colours in the piece: the dark it sits on, and what a bulb is made of.
 *
 * There is no light scheme and no `invert`. Starry Night has one, and it is
 * Starry Night's — inverting a piece whose entire subject is emitted light gives
 * dark dots on white, which is a different piece rather than the same one in
 * another key. ADR-0002 leaves each experiment its own look; this is the first
 * place the section's only precedent is declined.
 */

/** Near-black rather than black, so the vignette has somewhere to go. */
export const GROUND = "#05070c"

/** How far the corners are darkened, relative to the centre. */
export const VIGNETTE = 0.55

/**
 * A bulb is two colours, not one.
 *
 * Anything bright enough to look like a light source reads as white at the
 * centre whatever colour it is — the eye saturates before the hue registers —
 * and shows its colour only in the halo around it. A single-colour dot looks
 * like a coloured dot; a white core inside a coloured glow looks lit.
 */
export const coreColour = (hue: number, saturation: number) => `hsl(${hue} ${Math.min(100, 42 * saturation)}% 96%)`

export const haloColour = (hue: number, saturation: number) => `hsl(${hue} ${Math.min(100, 88 * saturation)}% 56%)`
