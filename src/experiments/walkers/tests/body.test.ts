import { describe, expect, it } from "vitest"
import {
  cadence,
  childStature,
  froude,
  gaitOffset,
  headBreadthFor,
  makeBody,
  posturalSway,
  REFERENCE_STATURE,
  speedForStature,
  stepLength,
  type Body,
} from "@/experiments/walkers/body"
import { lift, makeView } from "@/experiments/walkers/view"
import { makeRng } from "@/experiments/random"

/**
 * Anatomy, checked against the measurements it claims to come from.
 *
 * These are not regression tests on numbers somebody liked the look of. Each one
 * names a figure from outside the piece — free-flowing walking speed, adult
 * cadence, head breadth at age three — and checks that what the piece produces
 * is that figure. If a constant in `body.ts` is retuned by eye to fix how
 * something looks, this is what says so.
 */

const adult = (rng = makeRng(11)): Body => makeBody(rng, "adult", 1.34)
const child = (rng = makeRng(11)): Body => makeBody(rng, "child", 1.34)

describe("stature", () => {
  it("puts adults either side of the two sex means", () => {
    const statures = Array.from({ length: 400 }, (_, index) => makeBody(makeRng(index), "adult", 1.34).stature)
    const mean = statures.reduce((sum, value) => sum + value, 0) / statures.length

    // The mixture of 1.75 and 1.62 averages a little under 1.69.
    expect(mean).toBeGreaterThan(1.65)
    expect(mean).toBeLessThan(1.73)
    expect(Math.min(...statures)).toBeGreaterThan(1.4)
    expect(Math.max(...statures)).toBeLessThan(2.05)
  })

  it("follows the growth charts for children", () => {
    expect(childStature(2)).toBeCloseTo(0.87, 2)
    expect(childStature(12)).toBeCloseTo(1.49, 2)
    // Six-year-olds are about 1.15 m; the straight line is within a couple of
    // centimetres of the real curve across the range it is sampled over.
    expect(childStature(6)).toBeGreaterThan(1.08)
    expect(childStature(6)).toBeLessThan(1.18)
  })
})

describe("the head", () => {
  it("is 15.2 cm across on a reference adult", () => {
    expect(headBreadthFor(REFERENCE_STATURE)).toBeCloseTo(0.152, 4)
  })

  /**
   * The piece's most consequential measurement.
   *
   * A three-year-old's head circumference is about 49 cm against an adult's 56,
   * so their head is seven-eighths of an adult's across while they are barely
   * more than half the height. It is why an orthographic view of a crowd is
   * nearly uniform, and therefore why the camera in `view.ts` has to be a real
   * pinhole rather than a scale.
   */
  it("barely shrinks with age, which is the reason for the perspective", () => {
    const ratio = headBreadthFor(childStature(3)) / headBreadthFor(REFERENCE_STATURE)
    expect(ratio).toBeGreaterThan(0.83)
    expect(ratio).toBeLessThan(0.92)
  })

  it("is longer front to back than it is across", () => {
    const body = adult()
    expect(body.headLength).toBeGreaterThan(body.headBreadth * 1.2)
    expect(body.headLength).toBeLessThan(body.headBreadth * 1.35)
  })

  it("sits just below the top of the head when standing, and about half way when sitting", () => {
    const body = adult()
    expect(body.headHeightStanding).toBeCloseTo(body.stature - body.headHeight / 2, 9)
    expect(body.headHeightSitting).toBeLessThan(body.headHeightStanding * 0.65)
    expect(body.headHeightSitting).toBeGreaterThan(body.headHeightStanding * 0.4)
  })
})

describe("how fast people walk", () => {
  it("gives a reference adult the observed free-flow speed", () => {
    expect(speedForStature(1.34, REFERENCE_STATURE)).toBeCloseTo(1.34, 9)
  })

  /**
   * Preferred speed goes as the square root of leg length, which is what a fixed
   * Froude number means. A 1.10 m child comes out at four-fifths of the adult
   * pace — slower, but not as much slower as their legs are short.
   */
  it("scales a child's pace by the root of their height, not by their height", () => {
    const pace = speedForStature(1.34, 1.1)
    expect(pace / 1.34).toBeCloseTo(Math.sqrt(1.1 / REFERENCE_STATURE), 6)
    expect(pace).toBeGreaterThan(1.05)
    expect(pace).toBeLessThan(1.12)
  })

  it("has everybody walking at the same Froude number", () => {
    const tall = froude(speedForStature(1.34, 1.9), 1.9)
    const short = froude(speedForStature(1.34, 1.05), 1.05)
    expect(tall).toBeCloseTo(short, 9)
    // And that number is the one preferred walking actually sits at.
    expect(tall).toBeGreaterThan(0.17)
    expect(tall).toBeLessThan(0.24)
  })

  it("runs at about twice a walk, and children harder than adults", () => {
    const grown = adult()
    const small = child()
    expect(grown.runSpeed / grown.preferredSpeed).toBeCloseTo(2.05, 2)
    expect(small.runSpeed / small.preferredSpeed).toBeGreaterThan(grown.runSpeed / grown.preferredSpeed)
  })
})

describe("cadence", () => {
  it("is about 1.9 steps a second for an adult at their own pace", () => {
    const body = makeBody(makeRng(3), "adult", 1.34)
    const rate = cadence(body, body.preferredSpeed)
    expect(rate).toBeGreaterThan(1.7)
    expect(rate).toBeLessThan(2.1)
  })

  /**
   * The detail the whole "children read as children" effect rests on, and the
   * reason cadence is not a setting: it is not chosen, it falls out of the legs.
   */
  it("is faster for a child than for the adult they are walking with", () => {
    // Averaged over the population rather than compared between two draws: the
    // distributions overlap at the ends, and a short adult beside a tall
    // twelve-year-old is a real pair of people rather than a broken one.
    const mean = (age: "adult" | "child") => {
      const rates = Array.from({ length: 300 }, (_, index) => {
        const body = makeBody(makeRng(index), age, 1.34)
        return cadence(body, body.preferredSpeed)
      })
      return rates.reduce((sum, value) => sum + value, 0) / rates.length
    }

    expect(mean("child")).toBeGreaterThan(mean("adult") * 1.15)
  })

  it("lengthens the step as well as quickening it when somebody hurries", () => {
    const body = makeBody(makeRng(3), "adult", 1.34)
    const strolling = stepLength(body, body.preferredSpeed)
    const hurrying = stepLength(body, body.preferredSpeed * 2)

    expect(hurrying).toBeGreaterThan(strolling)
    // Both share the work, so neither doubles.
    expect(hurrying).toBeLessThan(strolling * 2)
    expect(cadence(body, body.preferredSpeed * 2)).toBeLessThan(cadence(body, body.preferredSpeed) * 2)
  })
})

describe("what the gait does to the head", () => {
  it("rises and falls twice per stride and sways once", () => {
    const body = adult()
    const at = (stride: number) => gaitOffset(body, stride, body.preferredSpeed, false)

    // Two steps to a stride: the rise repeats at the half-way point, the sway
    // is the opposite of what it was.
    expect(at(0.1).rise).toBeCloseTo(at(0.6).rise, 9)
    expect(at(0.1).sway).toBeCloseTo(-at(0.6).sway, 9)
  })

  it("moves a head about four and a half centimetres peak to peak, walking", () => {
    const body = makeBody(makeRng(3), "adult", 1.34)
    let low = Infinity
    let high = -Infinity
    for (let stride = 0; stride < 1; stride += 0.001) {
      const { rise } = gaitOffset(body, stride, body.preferredSpeed, false)
      low = Math.min(low, rise)
      high = Math.max(high, rise)
    }
    // Quoted against stature, since the body drawn here is whatever the seed
    // gave: 4 to 5 cm on a reference adult is 2.3 to 2.9 per cent of height.
    expect((high - low) / body.stature).toBeGreaterThan(0.021)
    expect((high - low) / body.stature).toBeLessThan(0.031)
  })

  it("triples the rise and all but removes the sway when running", () => {
    const body = adult()
    const walking = gaitOffset(body, 0.125, body.preferredSpeed, false)
    const running = gaitOffset(body, 0.125, body.runSpeed, true)

    expect(Math.abs(running.rise)).toBeGreaterThan(Math.abs(walking.rise) * 2.5)
    expect(Math.abs(gaitOffset(body, 0.25, body.runSpeed, true).sway)).toBeLessThan(
      Math.abs(gaitOffset(body, 0.25, body.preferredSpeed, false).sway) * 0.5,
    )
  })

  it("does nothing at all when the multiplier is zero", () => {
    // The scene multiplies by `bob`; this is the amplitude it multiplies.
    const body = adult()
    expect(gaitOffset(body, 0, body.preferredSpeed, false).rise).toBeCloseTo(0, 9)
  })
})

describe("standing still", () => {
  it("is not still, and never repeats", () => {
    const body = adult()
    const samples = Array.from({ length: 200 }, (_, index) => posturalSway(body, index * 0.5, 1.1))
    const spread = Math.max(...samples.map((s) => s.x)) - Math.min(...samples.map((s) => s.x))

    // A centimetre or two of slow wander, which is what quiet standing is.
    expect(spread).toBeGreaterThan(0.005)
    expect(spread).toBeLessThan(0.05)
  })

  it("puts two people side by side out of phase with each other", () => {
    const body = adult()
    expect(posturalSway(body, 4, 0.2).x).not.toBeCloseTo(posturalSway(body, 4, 2.9).x, 3)
  })
})

describe("the camera", () => {
  /**
   * What the perspective is actually worth.
   *
   * Head breadth alone makes an adult about a fifth wider than a child. The
   * pinhole adds to that, and the amount it adds is what the height control
   * moves — which is the whole argument for having one.
   */
  it("makes adults larger than children, and more so the lower it is", () => {
    const grown = 1.75
    const small = 1.1
    const flat = headBreadthFor(grown) / headBreadthFor(small)

    const high = makeView(12, 100, 1280, 800)
    const low = makeView(12, 14, 1280, 800)

    const ratioAt = (view: ReturnType<typeof makeView>) =>
      (headBreadthFor(grown) * lift(view, grown - 0.11)) / (headBreadthFor(small) * lift(view, small - 0.1))

    // An eighth, from head breadth alone — which is not much, and is exactly
    // why the perspective is worth having.
    expect(flat).toBeGreaterThan(1.08)
    expect(flat).toBeLessThan(1.16)
    expect(ratioAt(high)).toBeGreaterThan(flat)
    expect(ratioAt(low)).toBeGreaterThan(ratioAt(high) * 1.02)
  })

  it("magnifies nothing at ground level", () => {
    expect(lift(makeView(12, 24, 1280, 800), 0)).toBeCloseTo(1, 9)
  })
})
