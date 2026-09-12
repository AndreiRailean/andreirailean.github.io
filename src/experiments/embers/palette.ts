/**
 * Colour, from Planck's law.
 *
 * **Nothing here is a palette anybody chose.** An ember glows because it is hot,
 * so its colour is the colour of a blackbody at its temperature, and its
 * brightness is how much visible light a blackbody at that temperature emits.
 * Both come out of the same integral, and the piece has no fire colours written
 * down anywhere.
 *
 * That matters for two reasons beyond fidelity.
 *
 * **It is why an ember dies the way it does.** Radiant power goes as T⁴, but the
 * part of it a person can *see* goes very much faster than that near these
 * temperatures, because at 1000 K almost the whole curve is in the infrared and
 * Wien's displacement law drags the peak into the visible only as the thing gets
 * hotter. Photopic emittance between 900 K and 1600 K differs by about four
 * orders of magnitude. So a cooling ember does not dim smoothly — it holds,
 * reddens, and then goes out — and it does that here without a fade curve,
 * because the integral says so. An earlier version normalised brightness to a
 * lifetime and had to have that shape drawn in by hand.
 *
 * **And it is what makes another colour possible without another palette.**
 * `makeRamp` rotates the hue of the whole locus and leaves everything else — the
 * saturation falling away toward white-hot, the luminance curve, the shape of
 * the death — exactly as the physics gives it. Blue embers are then the same
 * fire in a different light rather than a second set of numbers that has to be
 * re-tuned to look alive.
 *
 * ## The route
 *
 * Planck's law at 5 nm steps, against analytic fits to the CIE 1931 colour
 * matching functions, gives XYZ; XYZ gives sRGB; and Y on its own is the
 * relative luminance. `tests/unit/embers/palette.test.ts` checks the chromaticity
 * against two published Planckian-locus points, which is what catches a wrong
 * coefficient in the fits — an error that otherwise shows up as "the fire looks
 * a bit off" and is untraceable.
 */

/** Coolest an ember is tracked to. Below this it emits nothing anyone can see. */
export const TEMP_MIN = 650
/** Hottest. Above this the mark is clipped white and the chromaticity stops moving. */
export const TEMP_MAX = 2600

/**
 * The temperature relative luminance is quoted against.
 *
 * Chosen as a bright-but-not-clipped ember so `exposure` sits near 1 for a scene
 * that looks like a fire. It is a units choice and nothing depends on the value.
 */
export const TEMP_REFERENCE = 1500

/** Second radiation constant, hc/k, in metre-kelvin. */
const C2 = 1.4387768775e-2

/**
 * Planck's law up to a constant factor.
 *
 * The constant is dropped deliberately: everything downstream is either a ratio
 * (chromaticity) or normalised against `TEMP_REFERENCE`, so carrying 2hc² would
 * only invite somebody to believe the numbers are in W/m²/sr/m.
 */
function planck(metres: number, kelvin: number): number {
  return 1 / (metres ** 5 * (Math.exp(C2 / (metres * kelvin)) - 1))
}

/**
 * One lobe of a piecewise Gaussian: a Gaussian with a different width each side
 * of its peak.
 */
function lobe(nm: number, peak: number, below: number, above: number): number {
  const t = (nm - peak) / (nm < peak ? below : above)
  return Math.exp(-0.5 * t * t)
}

/**
 * The CIE 1931 2° colour matching functions, as multi-lobe piecewise Gaussians.
 *
 * Wyman, Sloan & Shirley, *Simple Analytic Approximations to the CIE XYZ Color
 * Matching Functions* (JCGT 2013). Accurate to well under a per cent of peak,
 * which is far inside what any of this needs, and it means the piece carries no
 * table.
 */
const xBar = (nm: number): number =>
  1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2)

const yBar = (nm: number): number => 0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1)

const zBar = (nm: number): number => 1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8)

/** Tristimulus values of a blackbody, in arbitrary but consistent units. */
export function blackbodyXyz(kelvin: number): { X: number; Y: number; Z: number } {
  let X = 0
  let Y = 0
  let Z = 0
  for (let nm = 360; nm <= 830; nm += 5) {
    const power = planck(nm * 1e-9, kelvin)
    X += power * xBar(nm)
    Y += power * yBar(nm)
    Z += power * zBar(nm)
  }
  return { X, Y, Z }
}

/** Where a blackbody sits on the CIE 1931 chromaticity diagram. */
export function planckianXy(kelvin: number): { x: number; y: number } {
  const { X, Y, Z } = blackbodyXyz(kelvin)
  const sum = X + Y + Z
  return { x: X / sum, y: Y / sum }
}

const SRGB_FROM_XYZ = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.204, 1.057],
] as const

/** The sRGB transfer function, linear light to the values a canvas wants. */
function encode(value: number): number {
  const v = Math.min(1, Math.max(0, value))
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
}

/**
 * A blackbody's colour, at full brightness, as sRGB in 0…1.
 *
 * Normalised so the largest channel is 1 — the *brightness* of an ember is a
 * separate number, applied when it is drawn, because the same colour has to work
 * for a bright ember and a faint one. Channels that come out negative are clipped
 * to zero: the deep reds below about 1000 K are outside the sRGB gamut, and the
 * clip is what a screen would do anyway.
 */
export function blackbodyRgb(kelvin: number): [number, number, number] {
  const { X, Y, Z } = blackbodyXyz(kelvin)
  const linear = SRGB_FROM_XYZ.map((row) => Math.max(0, row[0] * X + row[1] * Y + row[2] * Z))
  const peak = Math.max(...linear) || 1
  return [encode(linear[0]! / peak), encode(linear[1]! / peak), encode(linear[2]! / peak)]
}

/** Visible light emitted, relative to `TEMP_REFERENCE`. This is what makes an ember go out. */
export function relativeLuminance(kelvin: number): number {
  return blackbodyXyz(kelvin).Y / blackbodyXyz(TEMP_REFERENCE).Y
}

/**
 * The response curve, from emitted light to what the plate makes of it.
 *
 * **Film is not linear in exposure and neither is this, for the same reason.** A
 * blackbody's visible output spans five orders of magnitude across the range
 * `heat` offers — 1000 K to 2200 K is a factor of half a million — and mapped
 * straight through, `heat` and `exposure` fight: nudging the fire's colour up
 * blows the picture to a solid white blob, and nudging it down leaves nothing on
 * screen. Both were measured, at the two ends, and neither is a picture.
 *
 * A power law compresses that the way an emulsion's characteristic curve does.
 * At 0.4 the 1000 K to 2200 K range comes out as a factor of about eighty rather
 * than half a million: still unmistakably a gradient from dull cinder to
 * white-hot spark, and one that fits inside a picture at a single exposure.
 *
 * It also moves the piece the way it was asked to. An ember's *colour* is its
 * temperature and its brightness is this — so flattening the brightness range
 * without touching the chromaticity trades a light-to-dark gradient for a
 * red-to-yellow-to-white one, which is what a fire looks like and what a linear
 * response could not give.
 *
 * **It lives here rather than in `draw.ts` because two things read it**, and
 * they have to agree: the renderer, deciding what to paint, and the scene,
 * deciding what to retire. They did not agree when this was a private constant
 * in the drawing code, and the consequence is under `SEEN` below.
 */
export const RESPONSE = 0.4

export const response = (luminance: number): number => luminance ** RESPONSE

/**
 * The exposure below which a mark is not worth painting, and the one below
 * which an ember is not worth simulating.
 *
 * **Two numbers, deliberately, with the retirement strictly lower.** An ember
 * between them is alive and unpainted, which is the correct end of a life: it
 * has cooled past visibility and is on its way out. If the two were equal an
 * ember would wink out on the frame it stopped being drawn; if retirement were
 * *higher*, it would vanish while still lit.
 *
 * Which is what happened. The retirement used to be a temperature —
 * `DARK_TEMP`, bisected for the luminance that a linear response put at the
 * paint cutoff — and adding the response curve above silently broke the
 * derivation without touching the constant. At 975 K an ember's `raw` went from
 * 0.004 to `exposure × 0.0132`, so at any exposure over about 0.3 it was being
 * killed while plainly visible: at 20x it was being killed at an alpha of 0.21.
 *
 * Nothing in a still shows that. What showed it was `tests/embers.spec.ts`
 * asserting that fewer embers are drawn than are alive — which had quietly
 * become impossible, because retiring above the paint cutoff means every live
 * ember is painted.
 */
export const SEEN = { paint: 0.004, keep: 0.002 }

/* ------------------------------------------------------------------ *
 * Hue rotation
 * ------------------------------------------------------------------ */

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const chroma = max - min
  if (chroma === 0) return [0, 0, lightness]

  const saturation = chroma / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === r) hue = ((g - b) / chroma) % 6
  else if (max === g) hue = (b - r) / chroma + 2
  else hue = (r - g) / chroma + 4
  return [(((hue * 60) % 360) + 360) % 360, saturation, lightness]
}

function fromHsl(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const h = (((hue % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((h % 2) - 1))
  const [r, g, b] =
    h < 1
      ? [chroma, x, 0]
      : h < 2
        ? [x, chroma, 0]
        : h < 3
          ? [0, chroma, x]
          : h < 4
            ? [0, x, chroma]
            : h < 5
              ? [x, 0, chroma]
              : [chroma, 0, x]
  const m = lightness - chroma / 2
  return [r + m, g + m, b + m]
}

/**
 * The hue a real fire comes out at, which is the offset every other hue is
 * measured from.
 *
 * Read off the physics rather than typed, so the `hue` control means "put the
 * fire here" and leaving it at this value means "leave the fire where Planck
 * put it".
 */
export const NATURAL_HUE = Math.round(toHsl(...blackbodyRgb(TEMP_REFERENCE))[0])

/* ------------------------------------------------------------------ *
 * The ramp
 * ------------------------------------------------------------------ */

/** How finely temperature is quantised for drawing. */
export const RAMP_STEPS = 24

export type Ramp = {
  /** `rgb(r g b)` per step, ready for `fillStyle`. */
  css: string[]
  /** Channels in 0…255 per step, three at a time, for building sprites. */
  bytes: Uint8Array
  /** Visible light emitted at each step, relative to `TEMP_REFERENCE`. */
  luminance: Float64Array
  /**
   * That light through `response`, precomputed.
   *
   * A `**` per ember per frame is not free and the answer only has
   * `RAMP_STEPS` distinct values, so it is table not arithmetic — and having one
   * table is what keeps the renderer and the scene reading the same number.
   */
  response: Float64Array
}

/** Which ramp step a temperature falls in. */
export function rampStep(kelvin: number): number {
  const t = (kelvin - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)
  return Math.min(RAMP_STEPS - 1, Math.max(0, Math.round(t * (RAMP_STEPS - 1))))
}

/** The temperature a ramp step stands for. */
export const rampTemperature = (step: number): number => TEMP_MIN + (step / (RAMP_STEPS - 1)) * (TEMP_MAX - TEMP_MIN)

/**
 * The blackbody locus, rotated to sit at `hue`, sampled at `RAMP_STEPS`.
 *
 * Rotation is in HSL and leaves saturation and lightness alone, which is the
 * cheap trick that makes this work: the hot end of the locus is nearly white and
 * so barely moves, the cool end is fully saturated and moves the whole way. A
 * blue fire therefore still has white-hot sparks and deep, dying blue cinders,
 * and the *shape* of the transition is the one Planck gave it.
 */
export function makeRamp(hue: number): Ramp {
  const shift = hue - NATURAL_HUE
  const css: string[] = []
  const bytes = new Uint8Array(RAMP_STEPS * 3)
  const luminance = new Float64Array(RAMP_STEPS)
  const responded = new Float64Array(RAMP_STEPS)

  for (let step = 0; step < RAMP_STEPS; step++) {
    const kelvin = rampTemperature(step)
    const [nr, ng, nb] = blackbodyRgb(kelvin)
    const [h, s, l] = toHsl(nr, ng, nb)
    const [r, g, b] = fromHsl(h + shift, s, l)

    const r8 = Math.round(Math.min(1, Math.max(0, r)) * 255)
    const g8 = Math.round(Math.min(1, Math.max(0, g)) * 255)
    const b8 = Math.round(Math.min(1, Math.max(0, b)) * 255)

    bytes[step * 3] = r8
    bytes[step * 3 + 1] = g8
    bytes[step * 3 + 2] = b8
    css.push(`rgb(${r8} ${g8} ${b8})`)
    luminance[step] = relativeLuminance(kelvin)
    responded[step] = response(luminance[step]!)
  }

  return { css, bytes, luminance, response: responded }
}
