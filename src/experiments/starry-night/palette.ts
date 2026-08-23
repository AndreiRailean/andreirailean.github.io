/**
 * The two colour schemes. Inverting swaps which is in play and changes nothing
 * else — same layers, same lifespans, same glimmers.
 */

export type Rgb = readonly [number, number, number]

export type Palette = {
  /** Components, so the occluding haze can be drawn in it at partial alpha. */
  background: Rgb
  /** Star colour as components, since alpha is applied per layer and per flare. */
  star: Rgb
  /**
   * Cloud tint minus its hue, which the viewer controls. Saturation stays low
   * and lightness stays near the background: the mottling is meant to be felt
   * rather than looked at, and a saturated tint takes over the frame.
   */
  cloud: { saturation: number; lightness: number }
}

export const NIGHT: Palette = {
  background: [5, 7, 15],
  star: [255, 255, 255],
  cloud: { saturation: 24, lightness: 30 },
}

/** The mirror of NIGHT: its background becomes the stars and vice versa. */
export const DAY: Palette = {
  background: [244, 246, 251],
  star: [5, 7, 15],
  cloud: { saturation: 20, lightness: 72 },
}

/**
 * Cloud colour at a given alpha. Comma syntax rather than the modern
 * space-separated form, which is fussier about `var()` substitution.
 */
export const cloudTint = (palette: Palette, hue: number) => (alpha: number) =>
  `hsla(${hue}, ${palette.cloud.saturation}%, ${palette.cloud.lightness}%, ${alpha})`

export const paletteFor = (invert: boolean): Palette => (invert ? DAY : NIGHT)

/**
 * Legacy `rgba()` rather than the modern slash syntax: canvas gradient colour
 * stops parse this form everywhere, which is not guaranteed for the newer one.
 */
export const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`
