import { describe, expect, it } from "vitest"
import { createAir } from "@/experiments/embers/air"
import { createBed } from "@/experiments/embers/bed"
import { blankEmber, dress, stepEmber, terminalSpeed, type Ember } from "@/experiments/embers/ember"
import { DEFAULT_SETTINGS, PRESETS, type Settings } from "@/experiments/embers/settings"
import { beyond, makeView } from "@/experiments/embers/view"
import { makeRng } from "@/experiments/random"

/**
 * The simulation, run headless.
 *
 * **None of what is checked here is visible in a screenshot**, which is the whole
 * reason it exists — and it is not a hypothetical: this file, as a throwaway
 * script printing percentiles, is what found the two real faults in the piece.
 *
 * - Embers at **3600 K**, hotter than an oxy-acetylene flame. A burst was
 *   multiplying the gas temperature instead of the buoyancy flux, so the air
 *   over a surging fire reached 4600 K and every ember in it heated to match.
 *   On screen this was a slightly brighter burst. See `FLAME_EXCESS` in
 *   `air.ts`.
 * - A population of **forty**, against a ceiling of sixteen hundred, because the
 *   steady emission rate had been guessed rather than derived from how long an
 *   ember lasts. On screen this was a picture that looked sparse for reasons that
 *   could have been any of a dozen settings.
 *
 * `air.ts`, `ember.ts` and `bed.ts` touch no DOM precisely so that this is
 * possible. `draw.ts` and `embers.ts` are the parts that need a browser, and
 * they are the parts with nothing arithmetic in them.
 */

/** Where an ember ended up. The brief asks for all four, so all four are counted. */
type Fates = { top: number; side: number; fellBack: number; burnedOut: number }

type Outcome = {
  fates: Fates
  born: number
  /** Mean population over the run, sampled twice a second after it has settled. */
  alive: number
  vortices: number
  temperatures: number[]
  heights: number[]
}

const STEP = 1 / 60

/**
 * Everything `embers.ts` does per frame except drawing, which is the point.
 *
 * Deliberately a re-statement rather than an import: the scene owns a canvas, a
 * clock and an animation frame, and none of those exist here. What is shared is
 * the four modules under test.
 */
function burn(settings: Settings, seconds: number): Outcome {
  const air = createAir(settings, 1)
  const bed = createBed(settings, 1)
  const view = makeView(settings.span, settings.hearth, 1280, 900)
  air.setBounds(view.halfWidth + view.flank, view.ceilingY + view.margin)

  const rng = makeRng(7)
  const pool: Ember[] = Array.from({ length: Math.round(settings.count) }, () => blankEmber())
  const free = pool.map((_, at) => at).reverse()
  const sample = new Float64Array(3)
  const physics = { flutter: settings.flutter, burn: settings.burn, breath: settings.breath }

  const fates: Fates = { top: 0, side: 0, fellBack: 0, burnedOut: 0 }
  const temperatures: number[] = []
  const heights: number[] = []
  const counts: number[] = []
  let alive = 0
  let born = 0

  const emit = (spawn: { x: number; y: number; vx: number; vy: number; heat: number; size: number }) => {
    const at = free.pop()
    if (at === undefined) return
    const ember = pool[at]!
    const low = settings.sizeMin * spawn.size
    dress(ember, rng, low, Math.max(low, settings.sizeMax * spawn.size), settings.heat * spawn.heat, 0.5)
    ember.x = spawn.x
    ember.y = spawn.y
    air.at(spawn.x, spawn.y, sample)
    ember.vx = sample[0]! * 0.85 + spawn.vx
    ember.vy = sample[1]! * 0.85 + spawn.vy
    ember.px = spawn.x
    ember.py = spawn.y
    alive++
    born++
  }

  for (let frame = 0; frame < Math.round(seconds / STEP); frame++) {
    air.step(STEP)
    bed.step(STEP, air, emit)

    for (let at = 0; at < pool.length; at++) {
      const ember = pool[at]!
      if (!ember.alive) continue
      ember.px = ember.x
      ember.py = ember.y
      air.sample(ember.x, ember.y, sample)
      stepEmber(ember, sample, sample[2]!, STEP, physics)

      if (beyond(view, ember.x, ember.y)) {
        // Classified by which edge it went past, in the order a viewer would
        // read them: above the top of the picture, out through a side, or back
        // down into the fire. Not by which retirement bound fired.
        if (ember.y > view.ceilingY) fates.top++
        else if (Math.abs(ember.x) > view.halfWidth) fates.side++
        else fates.fellBack++
        ember.alive = false
        free.push(at)
        alive--
        continue
      }
      if (ember.age > 0.25 && ember.temp < 980) {
        fates.burnedOut++
        ember.alive = false
        free.push(at)
        alive--
      }
    }

    // After two seconds, so a cold start is not averaged in.
    if (frame % 30 === 0 && frame > 120) {
      counts.push(alive)
      for (const ember of pool) {
        if (!ember.alive) continue
        temperatures.push(ember.temp)
        heights.push((ember.y - view.floorY) / (view.ceilingY - view.floorY))
      }
    }
  }

  return {
    fates,
    born,
    alive: counts.reduce((total, count) => total + count, 0) / Math.max(1, counts.length),
    vortices: air.vortices.length,
    temperatures,
    heights,
  }
}

const quantile = (values: number[], at: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(at * (sorted.length - 1))] ?? Number.NaN
}

describe("terminal speed", () => {
  /**
   * The one observable the drag balance can be held against.
   *
   * Firebrands have been caught and dropped and timed by people who study
   * how fires spread, and everything anybody has measured falls between about
   * one and four metres a second across the whole size range. That is the
   * constraint on `CHAR_DENSITY` and `DRAG` — neither of which is separately
   * knowable — and it is why they are set from here rather than from a table of
   * wood properties.
   */
  it("matches measured firebrands across the whole size range", () => {
    for (const mm of [0.4, 1, 3, 8, 14]) {
      const speed = terminalSpeed(mm, 1, 700)
      expect(speed, `${mm}mm falls at ${speed.toFixed(2)}m/s`).toBeGreaterThan(1)
      expect(speed, `${mm}mm falls at ${speed.toFixed(2)}m/s`).toBeLessThan(9)
    }
  })

  /** Square root of diameter, which is why a wide size range is still one population. */
  it("goes as the square root of diameter, not as diameter", () => {
    expect(terminalSpeed(4, 1, 700) / terminalSpeed(1, 1, 700)).toBeCloseTo(2, 1)
  })

  /** Hot air is thin air, so the same ember sinks faster inside the column. */
  it("is faster in the hot air of the plume than beside it", () => {
    expect(terminalSpeed(2, 1, 1200)).toBeGreaterThan(terminalSpeed(2, 1, 300))
  })
})

describe.each(PRESETS.map((preset) => [preset.label, preset.settings] as const))("%s", (label, settings) => {
  const outcome = burn(settings, 18)

  /**
   * **The temperature ceiling, which is the check that earns this whole file.**
   *
   * Nothing in the model forbids a runaway: combustion adds heat, being fanned
   * adds more of it, and sitting inside the column removes the convective sink
   * that would otherwise carry it away. Those three are individually reasonable
   * and compounded to 3600 K.
   */
  it("keeps every ember at a temperature a piece of burning wood can reach", () => {
    const hottest = quantile(outcome.temperatures, 1)
    expect(hottest, `${label}'s hottest ember reached ${hottest.toFixed(0)}K`).toBeLessThan(2400)
  })

  /** And not so cold that the picture is a handful of dull specks. */
  it("holds the population around a glowing temperature rather than a dying one", () => {
    const middle = quantile(outcome.temperatures, 0.5)
    expect(middle, `${label}'s median ember is ${middle.toFixed(0)}K`).toBeGreaterThan(1150)
  })

  /**
   * The population, against the rate. Both numbers matter and neither is
   * inferable from the other, because an ember's life is decided by the physics.
   */
  it("fills the frame without pressing against its own ceiling", () => {
    // A floor rather than a density, because the two ends of `span` are not
    // comparable: `coals` frames a metre of air and holds about 120, and that is
    // a crowded picture, while `bonfire` frames eleven and needs thousands for
    // the same one. What this rules out is a scene that is simply empty — which
    // is what the piece was when the emission rate had been guessed.
    expect(outcome.alive, `${label} holds ${outcome.alive.toFixed(0)} embers`).toBeGreaterThan(60)
    // Against the ceiling means embers are being dropped at birth, and the
    // scene stops responding to `sputter` at all.
    expect(outcome.alive, `${label} holds ${outcome.alive.toFixed(0)} of ${settings.count}`).toBeLessThan(
      settings.count * 0.95,
    )
  })

  /**
   * The eddy field has to settle somewhere sane on its own.
   *
   * It did not, at first: every roll-up on one side of the plume carries the
   * same sign, and a cluster of same-signed vortices co-rotates without
   * dispersing, so they accumulated to the hard cap and drifted off to one side
   * as a blob. Pairing is what fixed it — see `pairUp` in `air.ts` — and this is
   * what would catch it coming back.
   */
  it("settles to a legible number of eddies rather than the cap", () => {
    expect(outcome.vortices, `${label} has ${outcome.vortices} vortices`).toBeLessThan(40)
  })
})

describe("the campfire, in detail", () => {
  const outcome = burn(DEFAULT_SETTINGS, 25)

  /**
   * The brief, as a test: *"some disappear from view at the top. others float
   * through the side. some zig-zag their way back to the bottom."*
   *
   * All three happen here without anything choosing which — an ember's fate is
   * where its own terminal speed crosses the plume's, and which eddy caught it
   * on the way. A version of this piece with a scripted rise would satisfy every
   * other check in this file and fail this one flat.
   */
  it("loses embers by every route the scene is supposed to have", () => {
    const { top, side, fellBack, burnedOut } = outcome.fates
    for (const [route, count] of Object.entries({ top, side, fellBack, burnedOut })) {
      expect(count, `nothing left by "${route}" — fates were ${JSON.stringify(outcome.fates)}`).toBeGreaterThan(10)
    }
  })

  /** And it uses the whole frame, rather than piling up in the bottom fifth. */
  it("spreads the population up the frame", () => {
    expect(quantile(outcome.heights, 0.1)).toBeLessThan(0.25)
    expect(quantile(outcome.heights, 0.9)).toBeGreaterThan(0.6)
  })
})
