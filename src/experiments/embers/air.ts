/**
 * The air over the fire: a plume, a field of vortices, and a wind.
 *
 * Everything in here is **divergence-free by construction**, and that is the one
 * structural decision the whole piece rests on. A field with sources and sinks
 * in it gathers light things in the places it happens to converge, and it does
 * so convincingly enough to read as something the fire is doing — the section
 * has already paid for that lesson once, in
 * `../docs/adr/20260829-a-wrapped-patch-needs-a-periodic-field.md`. So each of
 * the three parts is a stream function or a closed-form solution of one, and a
 * sum of divergence-free fields is divergence-free.
 *
 * ## The plume is the real scaling law, not a cone
 *
 * A buoyant plume above a source of width D entrains still air as it rises,
 * which widens it and slows it: the half-width grows linearly, `b = b₀ + αy`
 * with α around an eighth, and the centreline speed falls as `y^(-1/3)` because
 * the buoyancy flux is conserved while the mass flux is not. Both are Morton,
 * Taylor & Turner's 1956 result and both are load-bearing here:
 *
 * - The `y^(-1/3)` decay is why an ember **accelerates up and then wants to
 *   fall**. It is not a lifetime or an envelope. An ember whose terminal speed
 *   is 2 m/s rises while the plume is doing more than 2 m/s and starts losing
 *   the argument at the height where the plume no longer is, which is a
 *   different height for every ember and needs nothing written down.
 * - The linear widening is why the column frays rather than staying a jet.
 *
 * The gas temperature falls out of the same conservation: `ΔT ∝ y^(-5/3)`, with
 * the same radial profile. So an ember cools slowly while it is inside the
 * column and quickly the moment a vortex throws it out of one, which is most of
 * why they die where they do.
 *
 * A crosswind bends the whole thing. The plume axis is displaced by exactly the
 * distance the wind carries a parcel in the time it takes that parcel to rise to
 * that height — `xc(y) = U·t(y)`, with `t(y)` the analytic integral of `1/W` —
 * which is the standard bent-plume trajectory, and the tilt carries the
 * entrainment with it because the shift is applied inside the stream function.
 *
 * ## The vortices are coherent, because in a fire they are
 *
 * A fire plume does not have generic turbulence in it. The shear layer at the
 * plume's edge rolls up into vortices — Kelvin–Helmholtz — which then travel up
 * with the flow, grow, and pair; and the whole column pulses at a frequency that
 * depends only on its width, `f ≈ 1.5/√D` Hz, which is the "puffing" every
 * campfire does and is one of the most robust measurements in fire science. Both
 * are the same object here:
 *
 * - **Roll-ups** are born singly at the plume's edges, counter-clockwise on the
 *   left and clockwise on the right, which is the sign the shear actually has.
 * - **Puffs** are born as counter-rotating *pairs* at the bed, at the puffing
 *   frequency. A pair like that induces an upward velocity on itself and rises
 *   as a unit — it is the cross-section of a vortex ring — so a puff is a
 *   travelling thing that carries embers up in a bulge rather than a burst of
 *   noise.
 * - **A burst** is a strong puff plus a spike in bed vigour, so the plume, the
 *   firelight and the emission rate all lift together.
 *
 * Each vortex is a Kaufmann (Scully) vortex — `Γ/(2π(r²+r_c²))` tangential —
 * which is the algebraic sibling of Lamb–Oseen: same shape, no `exp`, and
 * exactly divergence-free. The core grows as `r_c² += 4νt` with a turbulent
 * eddy viscosity, which is the viscous-diffusion law with the molecular value
 * swapped for the one that actually applies, and it is why an old eddy is a wide
 * soft one rather than a tight one that never lets go.
 *
 * ## The wind has a profile, and that is what makes embers curve
 *
 * A logarithmic profile over rough ground: nearly still at the coals and
 * stronger with height. It costs nothing, it is `u(y)` only so it adds no
 * divergence, and it is the difference between embers being pushed sideways as a
 * block and embers leaning over as they climb.
 */

import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { curlNoise, type Octave } from "@/experiments/embers/noise"
import type { Settings } from "@/experiments/embers/settings"

/** Ambient air temperature, kelvin. Everything cools toward this. */
export const AMBIENT = 293

/**
 * Gas temperature on the plume axis just above the coals, above ambient.
 *
 * A wood fire's flame gas runs 1100–1300 K, and the bed of coals under it is
 * hotter. This is the number an ember's cooling is fighting, and it is a
 * constant rather than a control because `heat` — the temperature embers are
 * *born* at — is the version of this a visitor has any use for.
 */
const BED_EXCESS = 950

/**
 * The hottest the gas may get above ambient, whatever the fire is doing.
 *
 * **This is a bound, and it needed to be found the hard way.** Vigour used to
 * multiply the gas temperature directly, so a burst at vigour 4.5 produced air
 * at 4600 K and every ember in it heated to match — the probe found embers at
 * 3600 K, hotter than an oxy-acetylene flame. The mistake was conceptual rather
 * than arithmetic: **a surge is more fuel burning, not hotter fuel.** It raises
 * the mass flow and therefore the buoyancy flux; the temperature of the gas is
 * fixed by the chemistry of what is burning, and the adiabatic flame temperature
 * of wood volatiles is a little over 2000 K no matter how much of it there is.
 *
 * So the flux scales and the temperature saturates, which is what these two
 * constants and `plumeGain` say together.
 */
const FLAME_EXCESS = 1250

/** Entrainment turns velocity into width; this is how much of it becomes core growth. */
const EDDY = 0.012

/** Roughness length of the ground the wind blows over, in metres. Rough grass. */
const ROUGHNESS = 0.03

/** The height the `wind` setting is quoted at, in metres. */
const WIND_HEIGHT = 1.5

/** Most vortices alive at once. Beyond this the field is mush and the cost is real. */
const MAX_VORTICES = 56

export type Vortex = {
  x: number
  y: number
  /** Circulation. Positive is counter-clockwise. */
  gamma: number
  /** Core radius, metres. Grows. */
  core: number
  /** Seconds it takes the circulation to fall by 1/e. */
  life: number
  age: number
}

export type Air = {
  step: (dt: number) => void
  /** Air velocity in m/s at a world point, written into `out`. */
  at: (x: number, y: number, out: Float64Array) => void
  /**
   * Velocity **and** gas temperature at one point, in one pass: `out` gets
   * `[ux, uy, kelvin]`.
   *
   * The hot path, and the reason it exists is arithmetic rather than tidiness.
   * The two answers share nearly all of their work — the axis the wind has
   * carried the plume to, the local half-width, the centreline speed, and the
   * `tanh` of the position across it — and asking for them separately does all
   * of that twice, which is six logarithms and five powers per ember per frame
   * instead of three and two. It was a fifth of a heavy frame.
   */
  sample: (x: number, y: number, out: Float64Array) => void
  /** Gas temperature in kelvin at a world point. For anything not in the hot path. */
  temperatureAt: (x: number, y: number) => number
  /** Where the plume's axis is at a height, in metres. The firelight follows it. */
  axisAt: (y: number) => number
  /** 1 at rest, up to several during a burst. Drives emission and the firelight. */
  vigour: () => number
  /** The crosswind at `WIND_HEIGHT` right now, m/s, gusts included. */
  crosswind: () => number
  /** A puff of hot gas leaves the bed. `strength` multiplies an ordinary puff. */
  puff: (strength: number, width: number) => void
  /**
   * Where the picture is, in metres, so an eddy that has left it can be retired.
   *
   * The air is otherwise unaware of the frame and would rather stay that way —
   * but a vortex is evaluated for **every ember, every frame**, and one that has
   * risen twenty metres above the top of the picture still influences nothing
   * and still costs that. Without this the field saturates its own cap within
   * ten seconds: fifty-odd eddies, of which perhaps fifteen are in shot, and the
   * flow reads as mush because the ones in shot are competing with the sum of
   * everything that has ever been shed.
   */
  setBounds: (halfWidth: number, top: number) => void
  vortices: readonly Vortex[]
  setSettings: (next: Settings) => void
  clock: number
}

export function createAir(initial: Settings, seed: number): Air {
  let settings = initial
  let clock = 0
  /**
   * How hard the fire is going, 1 at rest.
   *
   * Raised by a burst and relaxed back exponentially, so the plume swells and
   * settles rather than switching. Three things read it — the plume's speed, its
   * gas temperature, and the firelight under the frame — which is what makes a
   * burst arrive as one event instead of three.
   */
  let vigourValue = 1

  const rng: Rng = makeRng(hashSeed(seed, 0x41726))
  const vortices: Vortex[] = []

  /** Seconds until the next puff and the next roll-up. Poisson-ish, not metronomic. */
  let nextPuff = 0
  let nextRollUp = 0

  /** The current gust event: how strong, how long, and how far through it we are. */
  let gustPeak = 0
  let gustSpan = 1
  let gustAt = 1e9
  let nextGust = rng() * 6

  /** Generous defaults, so an unbounded air is a slow air rather than a wrong one. */
  let boundHalfWidth = 1e4
  let boundTop = 1e4

  /**
   * How many octaves of curl noise the mixing is built from.
   *
   * **Three, and the third one is not decoration.** With two the smallest eddy was
   * a share of the plume's own width, which is fine while the frame is comparable
   * to the fire and useless when it is not: at a four-metre bed seen from a metre
   * away the smallest structure in the field was wider than the picture, so it
   * translated everything in unison and there was no fine motion at all. That is
   * the frame the piece is most worth looking at closely, and it was the frame
   * with the least going on.
   *
   * A turbulent cascade is scale-free — that is the whole content of Kolmogorov's
   * argument — so the honest fix is more of it rather than a scale tuned to the
   * viewport. Three octaves spanning a factor of about twenty cover any framing
   * this piece offers.
   */
  const OCTAVES = 3

  /** Each octave is this much smaller than the one above it. */
  const OCTAVE_STEP = 2.7

  /**
   * The curl-noise octaves, sized and paced off the fire rather than chosen.
   *
   * Amplitudes and rates both follow the cascade rather than being picked; see
   * `tuneOctaves`.
   */
  const octaves: Octave[] = Array.from({ length: OCTAVES }, (_, at) => ({
    scale: 1,
    rate: 1,
    amplitude: 0,
    seed: hashSeed(seed, 1 + at) | 0,
  }))

  /** For the vortex advection loop, which is the only place a field is summed by hand. */
  const scratch = new Float64Array(3)
  /** For `temperatureAt` and `at`, so neither can clobber a caller mid-sample. */
  const spare = new Float64Array(3)
  /** For the curl, so `sample` is safe even when handed its own buffer back. */
  const noised = new Float64Array(2)

  /* -------------------------------------------------------------- *
   * The plume
   * -------------------------------------------------------------- */

  /** Half-width of the source, metres. */
  const bedHalf = () => Math.max(0.02, settings.bed / 2)

  /**
   * The plume's virtual origin scale: the height at which entrainment has
   * doubled its width. Derived from the source rather than declared, so a
   * hearth-sized fire and a bonfire are the same law at two sizes.
   */
  const originHeight = () => bedHalf() / Math.max(0.01, settings.spread)

  /**
   * What a surge does to the plume, as a multiplier on its speed.
   *
   * The **cube root** of vigour, not vigour. A plume's centreline speed goes as
   * the cube root of its buoyancy flux — the same exponent as the height decay,
   * and for the same reason — so a fire burning four and a half times as hard
   * has a column going about two thirds faster, and not four and a half times
   * faster. Getting this wrong is what produced 4600 K air; see `FLAME_EXCESS`.
   */
  const plumeGain = () => Math.cbrt(vigourValue)

  /** Centreline speed at a height, m/s. */
  function speedAt(y: number): number {
    const h0 = originHeight()
    return settings.updraft * plumeGain() * (h0 / (h0 + Math.max(0, y))) ** (1 / 3)
  }

  /**
   * How long a parcel takes to rise from the bed to `y`, seconds.
   *
   * The analytic integral of `1/W`, which is what makes the bent-plume
   * trajectory closed-form. `updraft` is floored rather than guarded: at zero
   * updraft nothing rises at all, so there is no trajectory to bend, and the
   * floor keeps the tilt finite instead of letting it run away as the plume
   * dies.
   */
  function riseTime(y: number): number {
    return riseTimeAt(originHeight(), Math.max(0, y), plumeGain())
  }

  /** The same, with the two quantities `plumeAt` has already computed passed in. */
  function riseTimeAt(h0: number, yy: number, gain: number): number {
    const w0 = Math.max(0.2, settings.updraft * gain)
    return ((3 * h0) / (4 * w0)) * (((h0 + yy) / h0) ** (4 / 3) - 1)
  }

  /**
   * The wind at a height, m/s.
   *
   * Logarithmic, normalised so the `wind` setting is the speed at
   * `WIND_HEIGHT`. Below the roughness length it is simply zero — the coals sit
   * in still air, which is why a fire can lean without its base moving.
   */
  function windAt(y: number): number {
    const above = Math.max(0, y) + ROUGHNESS
    const profile = Math.log(above / ROUGHNESS) / Math.log((WIND_HEIGHT + ROUGHNESS) / ROUGHNESS)
    return crosswind() * Math.max(0, profile)
  }

  function crosswind(): number {
    if (settings.gust <= 0) return settings.wind
    // A slow multi-scale wander, plus whichever discrete gust is in progress.
    // Three incommensurate periods so the wander never audibly repeats; the
    // event is a raised cosine so it arrives and leaves rather than switching.
    const wander =
      0.5 * Math.sin(clock * 0.27 + 1.1) + 0.32 * Math.sin(clock * 0.68 + 4.2) + 0.18 * Math.sin(clock * 1.63 + 2.7)
    const through = gustAt / gustSpan
    const event = through >= 1 ? 0 : gustPeak * 0.5 * (1 - Math.cos(2 * Math.PI * through))
    return settings.wind + settings.gust * (0.45 * wander + event)
  }

  /** Where the plume's axis has been carried to, at a height. */
  function axisAt(y: number): number {
    const drift = windAt(y) * riseTime(y)
    const limit = 40 * bedHalf() + 6
    return Math.max(-limit, Math.min(limit, drift))
  }

  /**
   * The plume, evaluated once for both of the things it decides.
   *
   * Written as the derivatives of `ψ = -W(y)·b(y)·tanh((x-xc)/b)`, so the flow is
   * incompressible exactly rather than nearly. The three terms of `ux` are, in
   * order: entrainment inflow toward the axis, the outward spreading of the
   * column as it widens, and the tilt of the axis carrying the vertical flow
   * sideways with it.
   *
   * The temperature falls out of the same geometry, from the same conserved
   * buoyancy flux the speed came from: `ΔT·w·b² = const` with `w ∝ y^(-1/3)` and
   * `b ∝ y` gives `ΔT ∝ y^(-5/3)`, and the radial profile is the one the
   * velocity has, because they have the same cause. Cool air outside the column
   * and hot air in it, and the boundary between them is where embers stop
   * surviving.
   *
   * Velocity is **added** to `out[0..1]` so the field can be summed; the
   * temperature is **written** to `out[2]`, since there is only one of it.
   */
  function plumeAt(x: number, y: number, out: Float64Array): void {
    const h0 = originHeight()
    const yy = Math.max(0, y)
    const alpha = Math.max(0.01, settings.spread)
    const b = bedHalf() + alpha * yy
    const gain = plumeGain()
    const w = settings.updraft * gain * (h0 / (h0 + yy)) ** (1 / 3)

    // Both of these want the axis, and the axis wants the wind at this height.
    const wind = windAt(y)
    const drift = wind * riseTimeAt(h0, yy, gain)
    const limit = 40 * bedHalf() + 6
    const axis = Math.max(-limit, Math.min(limit, drift))

    const s = (x - axis) / b
    const th = Math.tanh(s)
    const sech2 = 1 - th * th

    // Saturating, not scaling. See `FLAME_EXCESS`.
    const excess = Math.min(FLAME_EXCESS, BED_EXCESS * gain)
    out[2] = AMBIENT + excess * (h0 / (h0 + yy)) ** (5 / 3) * sech2

    if (w <= 0) return

    const dw = -w / (3 * (h0 + yy))
    const dAxis = wind / Math.max(0.2, w)
    const uy = w * sech2

    out[0] += -(dw * b + w * alpha) * th + w * alpha * s * sech2 + dAxis * uy
    out[1] += uy
  }

  /** Gas temperature alone. Not the hot path; `plumeAt` is. */
  function temperatureAt(x: number, y: number): number {
    spare[0] = 0
    spare[1] = 0
    plumeAt(x, y, spare)
    return spare[2]!
  }

  /* -------------------------------------------------------------- *
   * The vortices
   * -------------------------------------------------------------- */

  function addVortex(x: number, y: number, gamma: number, core: number, life: number): void {
    if (vortices.length >= MAX_VORTICES) {
      // The weakest goes, not the oldest: an old strong eddy is the interesting
      // one and a young weak one has not done anything yet.
      let weakest = 0
      for (let at = 1; at < vortices.length; at++) {
        if (Math.abs(vortices[at]!.gamma) < Math.abs(vortices[weakest]!.gamma)) weakest = at
      }
      vortices.splice(weakest, 1)
    }
    vortices.push({ x, y, gamma, core, life, age: 0 })
  }

  /** Seconds between puffs. `f ≈ 1.5/√D` — the fire's own frequency. */
  const puffPeriod = () => Math.sqrt(Math.max(0.02, settings.bed)) / (1.5 * Math.max(0.05, settings.churn))

  /**
   * A counter-rotating pair at the bed, which rises as a unit.
   *
   * The circulation is set from the speed the pair should rise at rather than
   * chosen: two vortices `2d` apart each induce `Γ/(4πd)` on the other, so
   * asking for a pair that keeps up with the plume fixes Γ. Left is
   * counter-clockwise and right clockwise, which is the only arrangement that
   * propels upward — the other sign sends the puff into the fire.
   */
  function puff(strength: number, width: number): void {
    const d = Math.max(0.02, bedHalf() * width)
    const rise = speedAt(0) * 0.7 * strength * Math.max(0.15, settings.swirl)
    const gamma = 4 * Math.PI * d * rise
    const core = d * 0.55
    const life = puffPeriod() * 2.6
    const at = axisAt(0)
    addVortex(at - d, 0.05, gamma, core, life)
    addVortex(at + d, 0.05, -gamma, core, life)
  }

  /**
   * One shear-layer roll-up, on one edge of the plume.
   *
   * Sign by side, because the shear has a sign: on the left edge the vertical
   * speed increases with x, which is positive vorticity. Getting this backwards
   * gives a column that visibly braids inward instead of outward, and it looks
   * deliberate.
   */
  function rollUp(): void {
    // **Height off the source, not off the virtual origin.** A shear layer rolls
    // up within about a source-width of where it is formed, so this scales with
    // the bed. It used to scale with `originHeight`, which is the bed over the
    // entrainment coefficient — six to nine times larger — and the consequence
    // was worst exactly where the piece is most worth looking at closely: on a
    // four-metre bed the roll-ups were born four to thirty metres up, every one
    // of them outside a frame a metre tall, and the debug overlay reported *zero
    // vortices* in a scene that should be full of them.
    const y = bedHalf() * (0.2 + rng() * 1.6)
    const b = bedHalf() + Math.max(0.01, settings.spread) * y
    const side = rng() < 0.5 ? -1 : 1
    const core = b * (0.3 + rng() * 0.35)
    const w = speedAt(y)
    // Peak tangential speed of a Kaufmann vortex is `Γ/(4πr_c)`, so this asks
    // for an eddy whose fastest air is a stated fraction of the plume's.
    const gamma = side * 4 * Math.PI * core * w * 0.55 * settings.swirl * (0.6 + rng() * 0.8)
    // **A band across the profile rather than a line at its edge.** What rolls up
    // is a velocity gradient, and `sech²` has its steepest one at `|s| ≈ 0.66` —
    // so shedding is drawn from a band around the inflection rather than pinned
    // to `|s| = 1`. On a narrow fire that is the edge either way. On one wider
    // than the frame it is the difference between structure you can see and a
    // vortex street happening off to both sides of the picture.
    const across = side * (0.4 + rng() * 1.2)
    addVortex(axisAt(y) + across * b, y, gamma, core, puffPeriod() * (1.5 + rng() * 2))
  }

  function vortexAt(x: number, y: number, out: Float64Array): void {
    for (const vortex of vortices) {
      const dx = x - vortex.x
      const dy = y - vortex.y
      const denominator = 2 * Math.PI * (dx * dx + dy * dy + vortex.core * vortex.core)
      const k = vortex.gamma / denominator
      out[0] += -k * dy
      out[1] += k * dx
    }
  }

  /* -------------------------------------------------------------- *
   * The whole field
   * -------------------------------------------------------------- */

  function sample(x: number, y: number, out: Float64Array): void {
    out[0] = windAt(y)
    out[1] = 0
    plumeAt(x, y, out)
    vortexAt(x, y, out)

    if (settings.mixing > 0) {
      curlNoise(octaves, x, y, clock, noised)
      out[0] += noised[0]!
      out[1] += noised[1]!
    }
  }

  /** Velocity only, for callers with a two-element buffer. */
  function at(x: number, y: number, out: Float64Array): void {
    sample(x, y, spare)
    out[0] = spare[0]!
    out[1] = spare[1]!
  }

  /**
   * Size and pace the octaves off the fire, following the cascade.
   *
   * Two relationships do all of it and neither is a free number:
   *
   * - **Velocity at a scale goes as ℓ^(1/3)**, which is the Kolmogorov
   *   two-thirds law read as a speed. So each octave down carries
   *   `OCTAVE_STEP^(-1/3)` — about 0.72 — of the one above it: the fine
   *   structure is real but it is not what moves an ember across the frame.
   * - **Turnover time goes as ℓ^(2/3)**, so small eddies churn faster. At a
   *   factor of 2.7 per octave that is about 1.9 times faster each step down.
   *
   * `mixing` is therefore a fraction of the plume's own speed at every size of
   * fire, and the stream function's amplitude carries the extra factor of scale
   * because the curl of it is what has to come out as a velocity.
   */
  function tuneOctaves(): void {
    const w = Math.max(0.2, settings.updraft)
    const largest = Math.max(0.06, bedHalf() * 2.4)

    for (let at = 0; at < OCTAVES; at++) {
      const scale = largest / OCTAVE_STEP ** at
      const octave = octaves[at]!
      octave.scale = scale
      octave.amplitude = settings.mixing * w * scale * 0.42 * (scale / largest) ** (1 / 3)
      octave.rate = (w / largest) * (largest / scale) ** (2 / 3)
    }
  }

  tuneOctaves()

  function step(dt: number): void {
    clock += dt

    // A burst sets vigour high and this is the whole of the way back down: an
    // exponential relaxation with a time constant of about six tenths of a
    // second, which is long enough for the swell to be a thing you watch and
    // short enough that two bursts in a row read as two.
    vigourValue += (1 - vigourValue) * (1 - Math.exp(-dt / 0.6))

    // Gusts.
    gustAt += dt
    if (settings.gust > 0) {
      nextGust -= dt
      if (nextGust <= 0) {
        gustPeak = (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.8)
        gustSpan = 1.4 + rng() * 4
        gustAt = 0
        nextGust = 3 + rng() * 12
      }
    }

    // Shedding. Both clocks are exponential rather than periodic: a fire puffs
    // at a frequency, not on a beat, and a metronome reads as machinery.
    const period = puffPeriod()
    nextPuff -= dt
    if (nextPuff <= 0 && settings.swirl > 0 && settings.churn > 0) {
      puff(0.85 + rng() * 0.4, 0.75 + rng() * 0.5)
      nextPuff = period * (0.55 - Math.log(Math.max(1e-6, rng())) * 0.7)
    }
    nextRollUp -= dt
    if (nextRollUp <= 0 && settings.swirl > 0 && settings.churn > 0) {
      rollUp()
      nextRollUp = period * (0.7 - Math.log(Math.max(1e-6, rng())) * 1.1)
    }

    // Advect, diffuse and decay. Every vortex moves with the field the others
    // and the plume make, which is what pairs them up and what carries a puff
    // out of frame instead of leaving it hanging over the fire.
    const nu = EDDY * bedHalf() * Math.max(0.2, settings.updraft)
    for (let at = vortices.length - 1; at >= 0; at--) {
      const vortex = vortices[at]!
      scratch[0] = windAt(vortex.y)
      scratch[1] = 0
      plumeAt(vortex.x, vortex.y, scratch)
      for (const other of vortices) {
        if (other === vortex) continue
        const dx = vortex.x - other.x
        const dy = vortex.y - other.y
        const denominator = 2 * Math.PI * (dx * dx + dy * dy + other.core * other.core)
        const k = other.gamma / denominator
        scratch[0] += -k * dy
        scratch[1] += k * dx
      }
      vortex.x += scratch[0]! * dt
      vortex.y += scratch[1]! * dt
      vortex.core = Math.sqrt(vortex.core * vortex.core + 4 * nu * dt)
      vortex.gamma *= Math.exp(-dt / vortex.life)
      vortex.age += dt

      // Spent, out of shot, or no longer a plume eddy at all. The margin is a
      // core radius, because a vortex still reaches about that far past its own
      // centre.
      const b = bedHalf() + Math.max(0.01, settings.spread) * Math.max(0, vortex.y)
      const spent = Math.abs(vortex.gamma) < 4 * Math.PI * vortex.core * 0.02
      const outside =
        vortex.y < -1 || vortex.y > boundTop + vortex.core * 2 || Math.abs(vortex.x) > boundHalfWidth + vortex.core * 2
      // Diffused past the column that made it, which is the honest end of a
      // plume eddy: once it is wider than twice the plume or three widths out to
      // the side it has been mixed into the ambient air, and what is left is a
      // lookup per ember per frame buying nothing. The debug overlay is how this
      // was found — a drift of old eddies parked off to one side, influencing
      // no ember and costing the same as one that was.
      const dissipated = vortex.core > b * 2 || Math.abs(vortex.x - axisAt(vortex.y)) > b * 3
      if (spent || outside || dissipated) vortices.splice(at, 1)
    }

    pairUp()
  }

  /**
   * **Vortex pairing: two overlapping eddies of the same sign become one.**
   *
   * Real, and load-bearing twice over. Like-signed vortices in a shear layer
   * merge — it is the pairing cascade, and it is why a plume's structure gets
   * larger and slower with height instead of staying the size it was shed at.
   * Circulation is conserved and the cores add in quadrature, so the merged eddy
   * is stronger and wider, which is exactly the observable.
   *
   * It is also the fix for a fault the debug overlay found and no screenshot
   * could have: every roll-up on the left of the plume has the same sign, and a
   * cluster of same-signed vortices **co-rotates without dispersing**. So they
   * accumulated — fifty of them, the cap, drifting off to one side as one blob,
   * each costing a lookup per ember per frame and none of them near the fire.
   * With pairing the field settles at a dozen or so, and they are a dozen real
   * structures rather than fifty fragments of one.
   */
  function pairUp(): void {
    for (let a = vortices.length - 1; a > 0; a--) {
      const first = vortices[a]!
      for (let b = a - 1; b >= 0; b--) {
        const second = vortices[b]!
        // Opposite signs do not merge, they orbit — and a counter-rotating pair
        // orbiting is a puff rising, which is a thing this piece needs.
        if (first.gamma * second.gamma <= 0) continue

        const dx = first.x - second.x
        const dy = first.y - second.y
        const reach = (first.core + second.core) * 0.6
        if (dx * dx + dy * dy > reach * reach) continue

        const weight = Math.abs(first.gamma) / (Math.abs(first.gamma) + Math.abs(second.gamma))
        second.x += (first.x - second.x) * weight
        second.y += (first.y - second.y) * weight
        second.gamma += first.gamma
        second.core = Math.hypot(first.core, second.core)
        second.life = Math.max(first.life, second.life)
        vortices.splice(a, 1)
        break
      }
    }
  }

  return {
    step,
    at,
    sample,
    temperatureAt,
    axisAt,
    vigour: () => vigourValue,
    crosswind,
    puff(strength, width) {
      // The vigour goes up *before* the pair is made, so the puff's own
      // circulation is set from the raised plume rather than from the resting
      // one. A burst that made an ordinary-strength pair and only then swelled
      // the column read as the fire flaring and the eddy arriving late.
      vigourValue = Math.max(vigourValue, 1 + 0.6 + strength * 1.1)
      puff(strength, width)
    },
    vortices,
    setBounds(halfWidth, top) {
      boundHalfWidth = halfWidth
      boundTop = top
    },
    setSettings(next) {
      settings = next
      tuneOctaves()
    },
    get clock() {
      return clock
    },
  }
}
