/**
 * The two colours: the water, and what a speck is made of.
 *
 * Dark only, and for the same reason Dangler is — inverting a piece whose whole
 * subject is a few lit things on black water gives dark dots on white, which is
 * a different piece rather than the same one in another key. Starry Night's
 * `invert` is Starry Night's.
 */

/**
 * Deep water at night. Blue-green rather than neutral, and near-black rather
 * than black so the vignette has somewhere to go.
 *
 * The green is doing real work at one part per hundred. Water absorbs red
 * first, so a dark neutral grey reads as a dim room and a dark cyan-green reads
 * as depth — the same trick that makes a swimming pool photograph blue.
 */
export const GROUND = "#04080b"

/** How far the corners are darkened, relative to the centre. */
export const VIGNETTE = 0.5

/**
 * A speck is two colours: the piece itself, and the glare around it.
 *
 * **The body carries the hue, and whiteness is left to the arithmetic.** The
 * first version painted it at 96% lightness and a quarter of the saturation, on
 * the reasoning that anything bright enough to read as a glint saturates the eye
 * before its hue registers. That is true of a *point* of light and false of a
 * piece you can see the shape of — and since a piece's drawn size is its real
 * size, turning the size range up produced hundred-pixel discs of flat white
 * that took no colour from the hue control at all. Reported by someone looking
 * at the piece, which is the only way it was ever going to be found: at the
 * sizes the piece shipped with, every body was a pixel or two across and there
 * was nothing to see the colour of.
 *
 * So the body is properly coloured now, and the whitening happens where it
 * belongs — in the additive blend. A small piece is its body *plus* the bright
 * heart of its own glare, and the two sum past full in the strong channels and
 * clip toward white, exactly as a real over-bright highlight does. A large piece
 * has that glare out at its rim instead, so its face keeps its colour. And a dim
 * piece of any size stays coloured, because nothing clips. None of that needed a
 * rule; it falls out of drawing light additively.
 */
export const coreColour = (hue: number, saturation: number) => `hsl(${hue} ${Math.min(100, 66 * saturation)}% 76%)`

export const haloColour = (hue: number, saturation: number) => `hsl(${hue} ${Math.min(100, 64 * saturation)}% 58%)`
