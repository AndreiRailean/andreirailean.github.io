import { describe, expect, it } from "vitest"
import {
  blackbodyRgb,
  makeRamp,
  NATURAL_HUE,
  planckianXy,
  RAMP_STEPS,
  rampStep,
  relativeLuminance,
  TEMP_MAX,
  TEMP_MIN,
} from "@/experiments/embers/palette"

/**
 * The piece has no fire colours written down, so this is where "the fire is the
 * right colour" is actually checked.
 *
 * Two published points on the Planckian locus catch the failure that has no
 * other symptom: a wrong coefficient in the analytic CIE fits gives colours that
 * are plausible, warm, and wrong, and no screenshot can tell. D65's correlated
 * colour temperature is 6504 K and Illuminant A is 2856 K by definition, and
 * both chromaticities are standardised — so they are facts this can be held to
 * rather than numbers read off this implementation.
 */
describe("the Planckian locus", () => {
  it("puts 6500 K where D65 is", () => {
    const { x, y } = planckianXy(6500)
    expect(x).toBeCloseTo(0.3135, 3)
    expect(y).toBeCloseTo(0.3237, 3)
  })

  it("puts 2856 K where Illuminant A is", () => {
    const { x, y } = planckianXy(2856)
    // Two thousandths, which is the accuracy of the analytic colour matching
    // fits rather than of the integration. Tightening this is asserting on
    // Wyman et al.'s residual, not on anything this piece decides.
    expect(x).toBeCloseTo(0.4476, 2)
    expect(y).toBeCloseTo(0.4074, 2)
  })

  it("gets redder as it cools", () => {
    const cool = planckianXy(900)
    const hot = planckianXy(2400)
    expect(cool.x).toBeGreaterThan(hot.x)
  })
})

/**
 * The mechanism the piece leans on hardest, and the one that would be very easy
 * to replace with a hand-drawn fade without noticing what was lost.
 */
describe("visible emission", () => {
  it("collapses by orders of magnitude as an ember cools", () => {
    // Radiant power goes as T⁴, so 1600 K over 1000 K would be a factor of 6.5
    // if that were the whole story. The *visible* band moves far faster, because
    // at 1000 K almost the entire Planck curve is in the infrared. This is the
    // reason an ember holds, reddens and then goes out with no fade curve
    // written anywhere.
    const ratio = relativeLuminance(1600) / relativeLuminance(1000)
    expect(ratio).toBeGreaterThan(1000)
  })

  it("is 1 at the temperature it is quoted against", () => {
    expect(relativeLuminance(1500)).toBeCloseTo(1, 6)
  })
})

describe("the ramp", () => {
  it("says the natural hue is a warm orange, having derived it", () => {
    expect(NATURAL_HUE).toBeGreaterThan(15)
    expect(NATURAL_HUE).toBeLessThan(40)
  })

  it("rotates the whole locus and keeps its shape", () => {
    const natural = makeRamp(NATURAL_HUE)
    const cold = makeRamp(NATURAL_HUE + 180)

    // Luminance is a property of the temperature, not of the hue, so rotating
    // must not touch it. If it ever does, a coloured fire will need its exposure
    // re-tuned and the whole point of the rotation is gone.
    expect([...cold.luminance]).toEqual([...natural.luminance])

    // And the rotation has to actually do something at the cool end, where the
    // locus is fully saturated.
    expect(cold.css[0]).not.toBe(natural.css[0])
  })

  it("desaturates toward the hot end, so a rotation barely moves a white-hot spark", () => {
    const natural = makeRamp(NATURAL_HUE)
    const spread = (step: number) => {
      const [r, g, b] = [natural.bytes[step * 3]!, natural.bytes[step * 3 + 1]!, natural.bytes[step * 3 + 2]!]
      return Math.max(r, g, b) - Math.min(r, g, b)
    }
    expect(spread(RAMP_STEPS - 1)).toBeLessThan(spread(0))
  })

  it("indexes every temperature it is asked about, and clamps outside its range", () => {
    expect(rampStep(TEMP_MIN)).toBe(0)
    expect(rampStep(TEMP_MAX)).toBe(RAMP_STEPS - 1)
    expect(rampStep(-100)).toBe(0)
    expect(rampStep(9000)).toBe(RAMP_STEPS - 1)
  })

  it("keeps the deep reds inside the gamut by clipping rather than by going negative", () => {
    // Below about 1000 K the blackbody is outside sRGB. A screen clips; so does
    // this, deliberately, rather than producing a channel nothing can show.
    for (const kelvin of [700, 900, 1200, 2600]) {
      for (const channel of blackbodyRgb(kelvin)) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(1)
      }
    }
  })
})
