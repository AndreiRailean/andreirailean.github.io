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
 * A speck is two colours, and *less* saturated than one of Dangler's bulbs.
 *
 * A bulb emits its own colour and is as saturated as it likes. A speck reflects
 * whatever is lighting the sea, so its colour is the light's colour weakened by
 * a wet surface, and pushing the saturation up turns floating debris into a
 * scatter of gems. The core still whites out, because anything bright enough to
 * read as a glint saturates the eye before its hue registers, and only the halo
 * around it carries colour — which is the same reason Dangler's beads are built
 * this way and one of the few places two pieces here agree about anything.
 */
export const coreColour = (hue: number, saturation: number) => `hsl(${hue} ${Math.min(100, 26 * saturation)}% 95%)`

export const haloColour = (hue: number, saturation: number) => `hsl(${hue} ${Math.min(100, 64 * saturation)}% 58%)`
