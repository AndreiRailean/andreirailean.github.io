import type { Pixel } from "@/experiments/psyxels/field"
import type { Settings } from "@/experiments/psyxels/settings"

/**
 * What colour a pixel is, and how much of that is its own idea.
 *
 * The piece has a subject with colours of its own — a white letter, a face — and
 * a field of pixels with opinions. `wildness` is the whole argument between
 * them: at zero the pixels wear the subject's colour and the picture is honest,
 * at one they have replaced it and the subject survives as a shape only.
 * Everything between is a picture being talked over, which is where the piece
 * spends most of its time.
 *
 * A pixel's own hue is drawn fresh every time it changes frame, so colour and
 * frame change together — see `field.ts`. What lives here is only the arithmetic
 * for turning that draw into something to paint with.
 */

/** The ground. Never painted on; the subject's absence is this colour. */
export const GROUND = "#05050a"

/** Hue buckets precomputed per frame. Two degrees is finer than anyone reads. */
const HUE_STEPS = 180

export type Palette = {
  /**
   * The CSS colour a pixel paints with, `morph` being how far it is through its
   * change of frame — the colour slides across it rather than cutting.
   */
  colour: (pixel: Pixel, settings: Settings, morph: number) => string
  /** How many distinct colours have been built. Cheap insight into what a scene costs. */
  size: () => number
}

function hueToChannel(p: number, q: number, t: number): number {
  let h = t
  if (h < 0) h += 1
  if (h > 1) h -= 1
  if (h < 1 / 6) return p + (q - p) * 6 * h
  if (h < 1 / 2) return q
  if (h < 2 / 3) return p + (q - p) * (2 / 3 - h) * 6
  return p
}

/**
 * The whole hue wheel at one saturation, plus a cache of the strings it makes.
 *
 * Two costs are being avoided, and both are per pixel per frame. Converting a
 * hue is the smaller: thousands of pixels share a few hundred hues between them,
 * so the wheel is built once and read by index. Building the CSS string is the
 * larger — it is an allocation per pixel per frame, and a scene of eight
 * thousand pixels makes half a million a second. Quantising to six bits a
 * channel gives the cache something to hit: a scene at full wildness draws from
 * the wheel alone and settles on a few hundred strings, and even the portrait,
 * whose colours come off a photograph, reuses everything within a shade.
 *
 * Lightness is fixed and brightness is carried by alpha instead: a pixel dimming
 * by lightness slides toward the ground colour, which on this ground means
 * sliding toward blue, and the whole field goes cold as it breathes out.
 */
export function createPalette(saturation: number, lightness = 0.56): Palette {
  const r = new Float32Array(HUE_STEPS)
  const g = new Float32Array(HUE_STEPS)
  const b = new Float32Array(HUE_STEPS)
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q

  for (let i = 0; i < HUE_STEPS; i++) {
    const h = i / HUE_STEPS
    r[i] = hueToChannel(p, q, h + 1 / 3)
    g[i] = hueToChannel(p, q, h)
    b[i] = hueToChannel(p, q, h - 1 / 3)
  }

  const strings = new Map<number, string>()

  return {
    colour(pixel, settings, morph) {
      // Interpolated as a signed offset from the field's hue rather than around
      // the wheel, so a pixel slides through the colours between its old and new
      // draw instead of taking the long way round the spectrum.
      const own = pixel.hueFrom + (pixel.hue - pixel.hueFrom) * morph
      const degrees = settings.hue + own * settings.spread
      let bucket = Math.round((degrees / 360) * HUE_STEPS) % HUE_STEPS
      if (bucket < 0) bucket += HUE_STEPS

      // The subject's colour is normalised to its brightest channel, so what
      // survives of it is its *hue* and nothing of its darkness. Brightness is
      // carried once, by the alpha the caller works out from coverage.
      // Unnormalised it is carried twice — a shadowed cheek came out both dim
      // and muddy, and the portrait read as a brown smear where a dim,
      // saturated skin tone was wanted.
      const peak = Math.max(pixel.r, pixel.g, pixel.b, 1e-3)
      const wild = settings.wildness
      const keep = (1 - wild) / peak

      const red = Math.min(63, ((keep * pixel.r + wild * r[bucket]!) * 63) | 0)
      const green = Math.min(63, ((keep * pixel.g + wild * g[bucket]!) * 63) | 0)
      const blue = Math.min(63, ((keep * pixel.b + wild * b[bucket]!) * 63) | 0)

      const key = (red << 12) | (green << 6) | blue
      const known = strings.get(key)
      if (known !== undefined) return known

      const made = `rgb(${(red * 255) / 63} ${(green * 255) / 63} ${(blue * 255) / 63})`
      strings.set(key, made)
      return made
    },

    size: () => strings.size,
  }
}
