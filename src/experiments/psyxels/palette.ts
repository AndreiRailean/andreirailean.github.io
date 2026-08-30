import type { Psyx } from "@/experiments/psyxels/field"
import type { Settings } from "@/experiments/psyxels/settings"

/**
 * What colour a psyx is, and how much of that is its own idea.
 *
 * The piece has a subject with colours of its own — a white letter, a face — and
 * a field of psyxels with opinions. `wildness` is the whole argument between
 * them: at zero the psyxels wear the subject's colour and the picture is honest,
 * at one they have replaced it and the subject survives as a shape only.
 * Everything between is a picture being talked over, which is where the piece
 * spends most of its time.
 *
 * A psyx's own hue is drawn fresh every time it changes frame, so colour and
 * frame change together — see `field.ts`. What lives here is only the arithmetic
 * for turning that draw into something to paint with.
 */

/** The ground. Never painted on; the subject's absence is this colour. */
export const GROUND = "#05050a"

/** Hue buckets precomputed per frame. Two degrees is finer than anyone reads. */
const HUE_STEPS = 180

export type Palette = {
  /**
   * The CSS colour a psyx paints with, for one of its two frames.
   *
   * `own` is the hue offset that frame was drawn with — a psyx keeps the one
   * it is leaving as well as the one it is arriving at, so a change of frame
   * cross-fades colour along with the mark rather than cutting to it.
   */
  colour: (psyx: Psyx, settings: Settings, own: number) => string
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
 * Two costs are being avoided, and both are per psyx per frame. Converting a
 * hue is the smaller: thousands of psyxels share a few hundred hues between them,
 * so the wheel is built once and read by index. Building the CSS string is the
 * larger — it is an allocation per psyx per frame, and a scene of eight
 * thousand psyxels makes half a million a second. Quantising to six bits a
 * channel gives the cache something to hit: a scene at full wildness draws from
 * the wheel alone and settles on a few hundred strings, and even the portrait,
 * whose colours come off a photograph, reuses everything within a shade.
 *
 * Lightness is fixed and brightness is carried by alpha instead: a psyx dimming
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
    colour(psyx, settings, own) {
      /**
       * **An edge gets a colour of its own.**
       *
       * The packing already knows where the contours are — unevenness is what
       * makes a square subdivide — so the same number can say *this psyx is on
       * the boundary* and shift it away from the field's hue. It is the accent
       * the piece was missing: a letter's edge picks itself out in a
       * complementary colour while its interior stays in the base, and the
       * outline reads without a single psyx changing size.
       *
       * Deliberately not brightness. Lighting the edges is what an outline
       * filter does, and it fights the coverage — a psyx half inside the
       * subject is *dim*, and brightening it because it is also on the boundary
       * says the opposite of what the tone map just said.
       */
      const degrees = settings.hue + own * settings.spread + psyx.edge * settings.edge * settings.edgeHue
      let bucket = Math.round((degrees / 360) * HUE_STEPS) % HUE_STEPS
      if (bucket < 0) bucket += HUE_STEPS

      // The subject's colour is normalised to its brightest channel, so what
      // survives of it is its *hue* and nothing of its darkness. Brightness is
      // carried once, by the alpha the caller works out from coverage.
      // Unnormalised it is carried twice — a shadowed cheek came out both dim
      // and muddy, and the portrait read as a brown smear where a dim,
      // saturated skin tone was wanted.
      const peak = Math.max(psyx.r, psyx.g, psyx.b, 1e-3)
      // An edge is also more its own psyx and less the subject's: at full
      // strength a boundary psyx takes the field's colour outright, which is
      // what makes the accent survive a photograph whose own colours are
      // everywhere.
      const wild = Math.min(1, settings.wildness + psyx.edge * settings.edge)
      const keep = (1 - wild) / peak

      const red = Math.min(63, ((keep * psyx.r + wild * r[bucket]!) * 63) | 0)
      const green = Math.min(63, ((keep * psyx.g + wild * g[bucket]!) * 63) | 0)
      const blue = Math.min(63, ((keep * psyx.b + wild * b[bucket]!) * 63) | 0)

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
