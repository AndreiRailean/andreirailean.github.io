/**
 * What one ember is, and what happens to it.
 *
 * ## An ember is one number: how fast it falls
 *
 * Everything about an ember's inertia comes from its **terminal speed in still
 * air**, `fall`. That is not a simplification for convenience, it is an
 * identity: at equilibrium the drag force balances gravity, so the drag response
 * time is exactly `τ = fall/g`. One number therefore fixes both how fast it
 * sinks and how sluggishly it answers the air, and the two cannot be tuned apart
 * — which is right, because in the world they are not two things.
 *
 * The terminal speed itself comes from the size, through the drag balance
 * `v = √(4ρ_c d g / 3ρ_a C_d)`. Two consequences worth knowing before touching
 * any of it:
 *
 * - **It goes as √d.** A four-fold bigger ember falls twice as fast, not four
 *   times, so a size range of 0.4–14 mm is a fall-speed range of only about 1.6
 *   to 9.5 m/s. That is why the size range can be wide without the population
 *   splitting into two unrelated things.
 * - **The air density is the hot air's, not the room's.** At 800 K air is less
 *   than half as dense as at 300 K, and drag scales with it, so the same ember
 *   falls appreciably faster inside the plume than beside it. It is a real
 *   effect and it is folded in here, which is part of why an ember that leaves
 *   the column does not simply drift down.
 *
 * ## Why the integrator is an exponential and not Euler
 *
 * `dv/dt = (u − v)/τ + g` has a closed-form solution for constant `u`, and `τ`
 * for a small ember is a few tens of milliseconds — far shorter than a frame. An
 * explicit step at 60 Hz on a 20 ms time constant is unstable and produces
 * embers that ring, then explode; halving the step to fix it costs four times
 * the work for a worse answer. The exact solution below is unconditionally
 * stable at any step and costs one `exp`, so the field can be sampled once per
 * frame per ember rather than once per substep, which is where the whole
 * performance budget went.
 *
 * The **Stokes number** — `τ` against the time a vortex takes to turn over —
 * then does the interesting work by itself. A small ember has a small one and
 * traces the air faithfully; a large one lags, overshoots, and gets flung out of
 * a vortex core by its own inertia. Heavy particles collecting in the strain
 * between eddies rather than in them is a real and well-measured phenomenon
 * (preferential concentration), and it is the reason the column has filaments in
 * it that nothing drew.
 *
 * ## Why it flutters
 *
 * A falling irregular flake does not fall straight — it tumbles, and the lift
 * that a tumbling plate generates reverses each half turn, which is why a leaf
 * or a scrap of burnt paper comes down in a zig-zag rather than a line. Two real
 * relationships give the whole behaviour:
 *
 * - The tumble rate follows a **Strouhal number**: `f ≈ 0.2·U/d` for a bluff
 *   body, so an ember tumbles faster the faster it is going and the smaller it
 *   is. Nothing has a fixed wobble frequency, which is what stops a population
 *   of them looking synchronised.
 * - The lift is a **fraction of the drag**, because for a flat plate at
 *   incidence `C_L` and `C_D` are of the same order. Written that way it needs
 *   no separate scale: an ember hanging at terminal speed has drag `g`, so its
 *   sideways acceleration is a fraction of gravity, which is exactly the size of
 *   the zig-zag a real cinder makes.
 *
 * Presenting a varying area as it turns also modulates the drag, so a tumbling
 * ember briefly hangs and briefly drops. That is the last of the "direction that
 * always changes" and it is one term.
 *
 * ## Why it goes out
 *
 * Three things are happening at once and each is a term:
 *
 * - **Radiation**, going as `T⁴ − T_a⁴`. Dominant while it is hot, which is why
 *   the white-hot phase is short.
 * - **Convection**, going as the temperature difference times a Nusselt number
 *   that grows as `√Re` — so an ember moving fast through cold air loses heat
 *   much faster than one drifting. This is why a fast ember dies young.
 * - **Combustion**, which is the other half of that same airflow: more air is
 *   more oxygen, so being fanned makes an ember *brighter* as well as shorter
 *   lived. It is why a gust lights the whole field up and then thins it.
 *
 * The colour and brightness are not here at all — they are Planck's law, in
 * `palette.ts`, read off the temperature these equations produce.
 */

import { gaussian, type Rng } from "@/experiments/random"
import { AMBIENT } from "@/experiments/embers/air"

/** Gravity, m/s². */
export const G = 9.80665

/**
 * Density of the char that actually flies, kg/m³.
 *
 * Not the 600-odd of the wood it came from. Pyrolysis leaves a porous skeleton
 * and takes most of the mass with it, and the pieces light enough to leave the
 * bed at all are the most porous of what is left. Measured firebrand
 * terminal speeds — 1 to 4 m/s across the whole size range anybody has bothered
 * to catch — only come out of the drag balance at something in this region, and
 * they are the number to match, because they are the observable.
 */
const CHAR_DENSITY = 220

/** Air density at 20 °C, kg/m³. Scaled by temperature where it is used. */
const AIR_DENSITY = 1.204

/** Drag coefficient of a tumbling irregular chip. Nearer a plate's 1.28 than a sphere's 0.47. */
const DRAG = 1.1

/** Strouhal number for the tumble: shedding frequency times size over speed. */
const STROUHAL = 0.2

/**
 * The band the tumble is allowed to run in, in Hz — and the one place this file
 * pulls a punch, so it says so.
 *
 * The Strouhal relation is right and its answer is unusable. A 2 mm ember doing
 * 2 m/s tumbles at `0.2 × 2 / 0.002` ≈ 200 Hz, and the sideways excursion of a
 * half turn at that rate is about 5 mm — a fraction of a pixel in any framing
 * this piece has, and above the display's own rate, so a physically paced
 * flutter is *invisible and aliased at the same time*. Every zig-zag anybody can
 * actually see in a real fire is the eddy field, which `air.ts` supplies.
 *
 * So the relation is kept for what it genuinely settles — the **ordering**, that
 * a small fast ember flutters quicker than a big slow one — and the result is
 * mapped into a band a frame can carry. Below about half a hertz a flutter reads
 * as a curved path rather than as a flutter; above about nine it reads as
 * jitter and starts to alias at 60 Hz.
 */
const FLUTTER_BAND = { low: 0.5, high: 6 }

/**
 * Terminal speed in still air at a given air temperature, m/s.
 *
 * `√(4ρ_c d g / 3ρ_a C_d)` — the drag balance for a compact body, with the air
 * density taken at the temperature the ember is actually in. `loft` is the
 * ember's own departure from compactness: a thin flake of bark has far less mass
 * behind the same frontal area and falls much more slowly, and it is drawn per
 * ember so a population is not uniform.
 */
export function terminalSpeed(diameterMm: number, loft: number, airKelvin: number): number {
  const d = Math.max(1e-4, diameterMm) / 1000
  const rhoAir = AIR_DENSITY * (293 / Math.max(200, airKelvin))
  return Math.sqrt((4 * CHAR_DENSITY * d * G) / (3 * rhoAir * DRAG)) * loft
}

export type Ember = {
  alive: boolean
  x: number
  y: number
  vx: number
  vy: number
  /** Diameter in mm. Sets the fall speed and the on-screen size. */
  size: number
  /** Departure from compactness, around 1. Below 1 is a flake and hangs. */
  loft: number
  /** Kelvin. */
  temp: number
  /** Combustible fraction left, 1 down to 0. At 0 it can only cool. */
  fuel: number
  /** Tumble phase, radians. */
  phase: number
  /** Which of the pre-made outlines this one wears. */
  shape: number
  /** Its own hue, as a position in 0…1 across the spread. */
  tone: number
  /** Seconds since it left the fire. Only the stats read it. */
  age: number
  /**
   * Where it has been, newest first, as `x, y` pairs — its tail.
   *
   * Allocated once with the pool and never replaced, because an ember is
   * recycled a few times a second and this is the only per-ember allocation
   * large enough to matter.
   */
  path: Float64Array
  /** How many of those points are real. A newborn ember has none. */
  pathLength: number
  /** The clock reading when the newest point was taken. */
  sampledAt: number
}

export function blankEmber(): Ember {
  return {
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 1,
    loft: 1,
    temp: AMBIENT,
    fuel: 1,
    phase: 0,
    shape: 0,
    tone: 0.5,
    age: 0,
    path: new Float64Array(TAIL * 2),
    pathLength: 0,
    sampledAt: 0,
  }
}

/**
 * Remember where the ember is now, if it is time to.
 *
 * Sampled at a fixed interval of `shutter / TAIL` in **piece** seconds, so the
 * remembered path always spans about one exposure whatever the playback — which
 * is what makes a tail the same physical length in slow motion as at speed.
 */
export function samplePath(ember: Ember, clock: number, shutter: number): void {
  if (shutter <= 0) {
    ember.pathLength = 0
    return
  }
  if (ember.pathLength > 0 && clock - ember.sampledAt < shutter / TAIL) return

  const path = ember.path
  // Shifted rather than kept as a ring: this runs once per TAIL of an exposure
  // rather than once a frame, and a plain array in newest-first order is what
  // the drawing wants to walk.
  for (let at = Math.min(ember.pathLength, TAIL - 1); at > 0; at--) {
    path[at * 2] = path[(at - 1) * 2]!
    path[at * 2 + 1] = path[(at - 1) * 2 + 1]!
  }
  path[0] = ember.x
  path[1] = ember.y
  ember.pathLength = Math.min(TAIL, ember.pathLength + 1)
  ember.sampledAt = clock
}

/** How many distinct outlines the drawing shares out. Enough that no two neighbours match. */
export const SHAPES = 24

/**
 * How many points of its own past an ember remembers, for drawing its tail.
 *
 * The tail is the path the ember actually took over the last `shutter` seconds,
 * so it needs samples spanning that — and it has to be the real path rather than
 * a straight line back, because the whole subject of this piece is that the path
 * curves. Twelve is enough that the polyline reads as a curve and that the
 * wobble from sampling at a fixed interval is under a tenth of the length.
 */
export const TAIL = 12

/**
 * Radiative cooling rate constant, per second at the reference excess.
 *
 * Not derived from emissivity and specific heat, because those would need the
 * ember's mass and the answer would still be a number somebody picked — the
 * honest statement is that this sets the timescale and the *shape* is the
 * physics. An ember at 1600 K loses about a fifth of its excess temperature a
 * second to radiation alone, which is the right order for a millimetre of char.
 */
const RADIATION = 0.42

/** Convective cooling at rest, per second. */
const CONVECTION = 0.55

/** Speed the convective Reynolds term is quoted against, m/s. */
const FAN_SPEED = 2.5

/**
 * The temperature the burning cannot push an ember past, kelvin.
 *
 * Combustion of char is **diffusion-limited**: the reaction is faster than the
 * oxygen can reach the surface, so the heat release is set by what the boundary
 * layer can deliver and not by how hot the ember already is. Measured burning
 * char surfaces sit between 1100 and 1600 K, and nothing anybody has put a
 * pyrometer on runs away.
 *
 * Without a ceiling the model does run away, and it is the one place where three
 * separately reasonable terms compound into an unreasonable answer: an ember
 * fanned hard inside the hot column gets extra release *and* loses its
 * convective sink, and the probe found embers at 3600 K — hotter than the
 * hottest part of an oxy-acetylene flame, which is not a temperature a piece of
 * wood attains. The knee is eighth-order so it is nearly absent at 1500 K and
 * decisive by 2000.
 */
const BURN_CEILING = 1900

/**
 * Heat the remaining fuel can put back, in kelvin per second at full fuel.
 *
 * This and the two loss constants above are one number in three parts: what they
 * jointly fix is the temperature an ember *settles* at, which is where the
 * losses and the burning balance, and that temperature is the whole look of the
 * piece. At 1300 an ember outside the column holds around 1450 K — a bright
 * orange — and one inside it runs hotter and clips white. Set to 900 the balance
 * lands at 1215 K, which is a real temperature for a real coal and is four times
 * dimmer, and the picture came out as a handful of dull red specks.
 */
const COMBUSTION = 1300

export type Physics = {
  /** `flutter` from the settings. */
  flutter: number
  /** `burn`. */
  burn: number
  /** `breath`. */
  breath: number
}

/**
 * One ember, one step.
 *
 * `air` is the velocity already sampled at the ember's position and `gas` the
 * air temperature there — both passed in rather than looked up, because the
 * scene samples the field once per ember per frame and the cost of that sample
 * is most of the piece.
 */
export function stepEmber(ember: Ember, air: Float64Array, gas: number, dt: number, physics: Physics): void {
  const ux = air[0]!
  const uy = air[1]!

  const relX = ux - ember.vx
  const relY = uy - ember.vy
  const relative = Math.hypot(relX, relY)

  // Terminal speed at the temperature of the air it is in, and the response
  // time that follows from it. One is the other over g; see the note above.
  const fall = terminalSpeed(ember.size, ember.loft, gas)
  let tau = fall / G

  // A tumbling flake presents a changing area, so its drag changes twice per
  // turn — it briefly hangs and briefly drops. Flakier means more of it, which
  // is what `loft` is.
  if (physics.flutter > 0) {
    const wobble = Math.min(0.55, (0.3 * physics.flutter) / ember.loft)
    tau = Math.max(0.002, tau * (1 + wobble * Math.cos(2 * ember.phase)))
  }

  // Tumble rate: the Strouhal relation for the ordering, compressed into a band
  // a frame can show. See `FLUTTER_BAND` — this is the one place the piece does
  // not simply take the number the physics gives it.
  const diameter = Math.max(1e-4, ember.size / 1000)
  const shedding = (STROUHAL * Math.max(relative, 0.05)) / diameter
  const hertz = FLUTTER_BAND.low + (FLUTTER_BAND.high - FLUTTER_BAND.low) * (1 - 1 / (1 + shedding / 120))
  ember.phase += hertz * 2 * Math.PI * dt

  // Lift, as a fraction of the drag and perpendicular to the relative wind.
  // Reverses every half turn, which is the zig-zag.
  let liftX = 0
  let liftY = 0
  if (physics.flutter > 0 && relative > 1e-4) {
    const magnitude = (physics.flutter * 0.55 * Math.sin(ember.phase) * relative) / tau
    liftX = (-relY / relative) * magnitude
    liftY = (relX / relative) * magnitude
  }

  // The exact solution of `dv/dt = (u − v)/τ + g + lift` over one step, treating
  // the right-hand side's non-drag part as constant. Unconditionally stable.
  const decay = Math.exp(-dt / tau)
  const equilibriumX = ux + liftX * tau
  const equilibriumY = uy + (liftY - G) * tau

  const nextVx = equilibriumX + (ember.vx - equilibriumX) * decay
  const nextVy = equilibriumY + (ember.vy - equilibriumY) * decay

  // Trapezoidal position, which is what makes a fast ember's streak land where
  // it actually travelled rather than a step behind.
  ember.x += ((ember.vx + nextVx) / 2) * dt
  ember.y += ((ember.vy + nextVy) / 2) * dt
  ember.vx = nextVx
  ember.vy = nextVy

  // Heat. Three terms, and then one exponential — the same shape as the
  // velocity above and for the same reason: the radiative term is stiff at
  // 2000 K, where an explicit step at 60 Hz oscillates.
  const excess = ember.temp - gas
  const fanning = 1 + physics.breath * Math.sqrt(Math.max(0, relative) / FAN_SPEED)

  // Radiation, quoted against the reference temperature so the constant is a
  // rate rather than a Stefan–Boltzmann coefficient — which would need the
  // ember's mass and specific heat, two more numbers with no better provenance
  // than this one.
  const radiated = RADIATION * 1500 * ((ember.temp / 1500) ** 4 - (gas / 1500) ** 4)
  const convected = CONVECTION * excess * fanning
  const released =
    ember.fuel > 0 ? (COMBUSTION * physics.burn * ember.fuel * fanning) / (1 + (ember.temp / BURN_CEILING) ** 8) : 0

  if (Math.abs(excess) < 1) {
    ember.temp += released * dt
  } else {
    // Both losses collapsed into one coefficient measured at the current
    // temperature, which linearises the T⁴ term about where it is. The step is
    // then exact for that coefficient and stable at any dt.
    const loss = Math.max(1e-6, (radiated + convected) / excess)
    const target = gas + released / loss
    ember.temp = target + (ember.temp - target) * Math.exp(-loss * dt)
  }
  if (ember.temp < AMBIENT) ember.temp = AMBIENT

  // Fuel goes with the burning, and faster when it is being fanned. A gust
  // brightens the field and then thins it, which is the same line.
  if (ember.fuel > 0) {
    ember.fuel = Math.max(0, ember.fuel - physics.burn * 0.16 * fanning * dt)
  }

  ember.age += dt
}

/**
 * Give a blank ember a body.
 *
 * `loft` is lognormal: most embers are roughly compact and a few are flakes that
 * hang. A normal draw would put half the population below the mean by the same
 * amount it puts half above, which for a *ratio* is wrong — and the tail is the
 * interesting part, because the flakes are the ones that ride the longest.
 */
export function dress(ember: Ember, rng: Rng, sizeMin: number, sizeMax: number, heat: number, tone: number): void {
  const t = rng()
  // Cubed, so small embers are common and a big one is an event. Real size
  // distributions from a fire bed are steeper than uniform by a long way.
  ember.size = sizeMin + (sizeMax - sizeMin) * t * t * t
  ember.loft = Math.exp(gaussian(rng) * 0.42)
  ember.temp = heat * (0.9 + rng() * 0.14)
  ember.fuel = 0.6 + rng() * 0.4
  ember.phase = rng() * Math.PI * 2
  ember.shape = Math.floor(rng() * SHAPES)
  ember.tone = tone
  ember.age = 0
  // A fresh ember has no past, so it has no tail until it has travelled one.
  ember.pathLength = 0
  ember.alive = true
}
