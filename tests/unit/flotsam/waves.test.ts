import { describe, expect, it } from "vitest"
import {
  createSea,
  G,
  HEIGHT,
  jacobian,
  OFFSET_X,
  OFFSET_Y,
  sample,
  SAMPLE_SIZE,
  sizeResponse,
  SLOPE_X,
  stokesDrift,
  SUM_STEEPNESS_MAX,
  type SeaSpec,
} from "@/experiments/flotsam/waves"

/**
 * The sea.
 *
 * Every assertion here is a property the piece depends on and that no screenshot
 * could show: a float that comes back, a sea that has not folded, a big float
 * that ignores a small wave. A wrong sea and a right one both look like a
 * scatter of dots moving about.
 *
 * `PLAIN` is stated here rather than inherited from `DEFAULT_SETTINGS`, which is
 * editorial and has moved before — Dangler's `AGENTS.md` records two physics
 * checks that went vacuous when its defaults were retuned.
 */
const PLAIN: SeaSpec = {
  seed: 1,
  trains: 3,
  shortest: 1,
  longest: 16,
  steepness: 0.6,
  heading: 0,
  spread: 40,
}

const at = (sea: ReturnType<typeof createSea>, x: number, y: number, t: number) => {
  const out = new Float64Array(SAMPLE_SIZE)
  sample(sea, x, y, t, null, 0, out)
  return out
}

describe("dispersion", () => {
  it("gives a long wave a higher phase speed than a short one, as √λ", () => {
    const sea = createSea({ ...PLAIN, trains: 2, shortest: 1, longest: 100 })
    const [short, long] = sea.trains
    const speed = (train: { omega: number; k: number }) => train.omega / train.k

    expect(speed(long!)).toBeGreaterThan(speed(short!))
    // c = √(g/k) = √(gλ/2π): a hundredfold in length is a tenfold in speed.
    expect(speed(long!) / speed(short!)).toBeCloseTo(10, 1)
  })

  it("uses real gravity, so a wavelength names a period a person could time", () => {
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 100, longest: 100 })
    const train = sea.trains[0]!
    // The deep-water period of a hundred-metre swell is eight seconds. This is
    // the assertion that would catch g being quietly turned into a tempo knob.
    expect((2 * Math.PI) / train.omega).toBeCloseTo(8.0, 1)
    expect(train.omega ** 2 / train.k).toBeCloseTo(G, 5)
  })
})

describe("a float goes nowhere", () => {
  /**
   * The thesis of the whole piece, and the one thing that must never break.
   *
   * A single train has a period; after exactly one, the water is back where it
   * started. Not approximately — the displacement is a closed form, so this is
   * exact to floating point, and any drift at all would mean something has crept
   * into the map that does not belong there.
   */
  it("returns a parcel of water to its rest position after one wave period", () => {
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 9, longest: 9, steepness: 0.8 })
    const period = (2 * Math.PI) / sea.trains[0]!.omega

    const start = at(sea, 3.1, -0.7, 0)
    const later = at(sea, 3.1, -0.7, period)

    expect(later[OFFSET_X]).toBeCloseTo(start[OFFSET_X]!, 9)
    expect(later[OFFSET_Y]).toBeCloseTo(start[OFFSET_Y]!, 9)
    expect(later[HEIGHT]).toBeCloseTo(start[HEIGHT]!, 9)
  })

  it("moves it a long way in between, so the return is not a fixed point", () => {
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 9, longest: 9, steepness: 0.8 })
    const period = (2 * Math.PI) / sea.trains[0]!.omega
    const amplitude = sea.trains[0]!.amplitude

    // Finely sampled: the peak is a maximum of a sinusoid, and a coarse sweep
    // misses it by enough to look like a real discrepancy.
    let furthest = 0
    for (let i = 0; i < 2048; i++) {
      const out = at(sea, 3.1, -0.7, (i / 2048) * period)
      furthest = Math.max(furthest, Math.hypot(out[OFFSET_X]!, out[OFFSET_Y]!))
    }
    // A full amplitude of horizontal travel each way: the orbit is a circle of
    // radius A, so the swinging is metres where the transport is nothing.
    expect(furthest).toBeCloseTo(amplitude, 5)
  })

  it("traces a circle, not a line — the horizontal and vertical excursions match", () => {
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 6, longest: 6, steepness: 0.7 })
    const period = (2 * Math.PI) / sea.trains[0]!.omega

    let horizontal = 0
    let vertical = 0
    for (let i = 0; i < 2048; i++) {
      const out = at(sea, 0, 0, (i / 2048) * period)
      // The whole horizontal excursion, not its x component: a lone train is
      // still jittered off the heading, so the two would differ by the cosine of
      // that and the test would be measuring the jitter.
      horizontal = Math.max(horizontal, Math.hypot(out[OFFSET_X]!, out[OFFSET_Y]!))
      vertical = Math.max(vertical, Math.abs(out[HEIGHT]!))
    }
    expect(horizontal).toBeCloseTo(vertical, 5)
  })

  it("carries a float forward at the crest, which is what makes the orbit the right way round", () => {
    // The sign of the horizontal term. Reversed, the water still looks like
    // waves and every float circles backwards, which no still frame can show.
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 8, longest: 8, steepness: 0.6, heading: 0, spread: 0 })
    const train = sea.trains[0]!
    // Pick the position whose phase is 0 at t = 0: the crest.
    const x = -train.phase / train.k
    const period = (2 * Math.PI) / train.omega

    const before = at(sea, x, 0, -period / 200)
    const after = at(sea, x, 0, period / 200)

    expect(at(sea, x, 0, 0)[HEIGHT]).toBeCloseTo(train.amplitude, 9)
    expect(after[OFFSET_X]! - before[OFFSET_X]!).toBeGreaterThan(0)
  })
})

describe("gathering", () => {
  it("compresses the water at the crests, which is where the flotsam collects", () => {
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 8, longest: 8, steepness: 0.75, spread: 0, heading: 0 })
    const train = sea.trains[0]!
    const crest = -train.phase / train.k
    const trough = crest + train.wavelength / 2

    // 1 − Ak at the crest and 1 + Ak in the trough. At 0.75 that is a four-fold
    // density ratio, and it is the only reason the piece reads as water.
    expect(jacobian(sea, crest, 0, 0)).toBeCloseTo(0.25, 6)
    expect(jacobian(sea, trough, 0, 0)).toBeCloseTo(1.75, 6)
  })

  it("never folds the water, at the steepest sea the controls allow", () => {
    // The bound Σ Aₙkₙ < 1 is the worst case over all phases and directions, so
    // the hard case is every train aligned — which is `spread: 0`.
    for (const trains of [1, 2, 5, 9]) {
      const sea = createSea({ ...PLAIN, trains, steepness: 5, spread: 0 })
      expect(sea.steepness).toBeCloseTo(SUM_STEEPNESS_MAX, 9)

      let worst = Infinity
      for (let i = 0; i < 400; i++) {
        worst = Math.min(worst, jacobian(sea, (i / 400) * 120 - 60, 0.37 * i, 0.013 * i))
      }
      expect(worst).toBeGreaterThan(0)
    }
  })

  it("shares the steepness out equally, so the trains gather equally hard", () => {
    const sea = createSea({ ...PLAIN, trains: 4, steepness: 0.8 })
    for (const train of sea.trains) expect(train.amplitude * train.k).toBeCloseTo(0.2, 9)
    // Amplitude still falls with wavenumber, so the swell moves things metres
    // and the ripples millimetres. That ordering comes from the physics rather
    // than from a weighting anyone chose.
    expect(sea.trains[0]!.amplitude).toBeLessThan(sea.trains[3]!.amplitude)
  })
})

describe("size response", () => {
  it("lets a speck ride every wave and a raft ignore the short ones", () => {
    const ripple = (2 * Math.PI) / 0.4
    const swell = (2 * Math.PI) / 30

    expect(sizeResponse(ripple, 0.005)).toBeGreaterThan(0.99)
    expect(sizeResponse(ripple, 1.2)).toBeLessThan(0.01)
    // Both follow the swell: a metre-wide raft is small compared with thirty
    // metres of wave, so it heaves with it exactly as the speck does.
    expect(sizeResponse(swell, 0.005)).toBeGreaterThan(0.999)
    expect(sizeResponse(swell, 1.2)).toBeGreaterThan(0.99)
  })

  it("decays and never inverts, unlike the Bessel kernel it stands in for", () => {
    // 2J₁(kr)/(kr) goes negative past kr ≈ 3.83, which would have a raft heaving
    // in antiphase with ripples it cannot resolve. See `sizeResponse`.
    let previous = 1
    for (let kr = 0; kr <= 20; kr += 0.1) {
      const value = sizeResponse(1, kr)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(previous + 1e-12)
      previous = value
    }
  })

  it("flattens a big float as well as stilling it, so it does not glint on ripples", () => {
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 0.5, longest: 0.5, steepness: 0.8 })
    const speck = new Float32Array([sizeResponse(sea.trains[0]!.k, 0.004)])
    const raft = new Float32Array([sizeResponse(sea.trains[0]!.k, 0.9)])

    const outSpeck = new Float64Array(SAMPLE_SIZE)
    const outRaft = new Float64Array(SAMPLE_SIZE)
    sample(sea, 0.11, 0, 0, speck, 0, outSpeck)
    sample(sea, 0.11, 0, 0, raft, 0, outRaft)

    expect(Math.abs(outRaft[SLOPE_X]!)).toBeLessThan(Math.abs(outSpeck[SLOPE_X]!) / 100)
  })
})

describe("wave drift", () => {
  it("is the steepness squared times the phase speed", () => {
    // The relation the piece is really claiming, and the one worth protecting:
    // how far a wave carries things depends on how *steep* it is, not how big.
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 12, longest: 12, steepness: 0.4, spread: 0, heading: 0 })
    const train = sea.trains[0]!
    const drift = { x: 0, y: 0 }
    stokesDrift(sea, null, 0, drift)

    const phaseSpeed = train.omega / train.k
    expect(drift.x).toBeCloseTo(0.4 ** 2 * phaseSpeed, 9)
    expect(drift.y).toBeCloseTo(0, 9)
  })

  it("is tiny for a realistic sea and large for a near-breaking one", () => {
    const gentle = createSea({ ...PLAIN, trains: 1, shortest: 60, longest: 60, steepness: 0.05, spread: 0 })
    const steep = createSea({ ...PLAIN, trains: 1, shortest: 60, longest: 60, steepness: 0.5, spread: 0 })
    const out = { x: 0, y: 0 }

    stokesDrift(gentle, null, 0, out)
    const slow = Math.hypot(out.x, out.y)
    stokesDrift(steep, null, 0, out)
    const fast = Math.hypot(out.x, out.y)

    expect(slow).toBeLessThan(0.03)
    expect(fast).toBeGreaterThan(2)
  })

  it("carries a raft less far than a speck in the same sea", () => {
    const sea = createSea({ ...PLAIN, trains: 1, shortest: 1.5, longest: 1.5, steepness: 0.6 })
    const out = { x: 0, y: 0 }

    stokesDrift(sea, new Float32Array([sizeResponse(sea.trains[0]!.k, 0.004)]), 0, out)
    const speck = Math.hypot(out.x, out.y)
    // A metre and a bit across against a metre-and-a-half wave: it spans most of
    // a wavelength, so it barely rises to it and drifts at a fiftieth of the
    // rate. Drift goes as amplitude squared, so the response counts twice.
    stokesDrift(sea, new Float32Array([sizeResponse(sea.trains[0]!.k, 1.2)]), 0, out)
    const raft = Math.hypot(out.x, out.y)

    expect(raft).toBeLessThan(speck / 50)
  })
})

describe("the spectrum", () => {
  it("spaces wavelengths geometrically and puts a single train at the geometric mean", () => {
    const many = createSea({ ...PLAIN, trains: 5, shortest: 1, longest: 16 })
    const lengths = many.trains.map((train) => train.wavelength)
    expect(lengths[0]).toBeCloseTo(1, 6)
    expect(lengths[4]).toBeCloseTo(16, 6)
    expect(lengths[2]).toBeCloseTo(4, 6)

    const one = createSea({ ...PLAIN, trains: 1, shortest: 1, longest: 16 })
    expect(one.trains[0]!.wavelength).toBeCloseTo(4, 6)
  })

  it("keeps every train inside the fan it was given", () => {
    const sea = createSea({ ...PLAIN, trains: 9, heading: 30, spread: 25 })
    for (const train of sea.trains) {
      const angle = (Math.atan2(train.dy, train.dx) * 180) / Math.PI
      expect(Math.abs(angle - 30)).toBeLessThanOrEqual(25 + 1e-9)
    }
  })

  it("covers the fan evenly, which is what `spread` promises and why it restratifies", () => {
    // Two trains at a wide spread must not land on top of one another. The cost
    // is that adding a train re-lays every direction, which `createSea` states
    // as a deliberate trade against the stability rule the specks follow.
    const sea = createSea({ ...PLAIN, trains: 2, heading: 0, spread: 60 })
    const angles = sea.trains.map((train) => (Math.atan2(train.dy, train.dx) * 180) / Math.PI)
    expect(Math.abs(angles[0]! - angles[1]!)).toBeGreaterThan(30)
  })

  it("gives the same sea for the same seed and a different one otherwise", () => {
    const a = createSea(PLAIN)
    const b = createSea(PLAIN)
    const c = createSea({ ...PLAIN, seed: 2 })
    expect(a.trains.map((t) => t.phase)).toEqual(b.trains.map((t) => t.phase))
    expect(a.trains.map((t) => t.phase)).not.toEqual(c.trains.map((t) => t.phase))
  })

  it("reports a reach that really does bound the displacement", () => {
    // `view.ts` sizes the wrap margin from this. Under-report it and specks pop
    // in and out at the edge of the frame.
    const sea = createSea({ ...PLAIN, trains: 4, steepness: 0.9 })
    let furthest = 0
    for (let i = 0; i < 3000; i++) {
      const out = at(sea, i * 0.37 - 500, i * 0.11 - 150, i * 0.017)
      furthest = Math.max(furthest, Math.hypot(out[OFFSET_X]!, out[OFFSET_Y]!))
    }
    expect(furthest).toBeLessThanOrEqual(sea.reach)
  })
})
