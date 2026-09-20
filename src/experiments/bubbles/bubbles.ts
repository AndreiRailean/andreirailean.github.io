/**
 * The water: a canvas, a clock, some jets, and whatever foam is still on the
 * surface.
 *
 * ## We are above the water and the jets are below it
 *
 * Nothing in this piece draws the water. The surface is black and the bubbles
 * are white, so every reading of the flow a viewer gets is inferred from how the
 * white circles move — which is the constraint the piece is built around rather
 * than a style choice, and is why the velocity field has to be worth inferring.
 *
 * ## The jets are at the bottom, and that is two separate things
 *
 * **This is the correction that shaped the piece.** The first build had one
 * field doing two jobs: a jet's outflow decided both where a bubble was born
 * and how fast it then skidded away across the surface. Those are different
 * things, and only the second one is water.
 *
 * A jet sits on the bottom. Its gas rises, fanning out as it climbs, and
 * **arrives** at the surface across a footprint — with no lateral momentum of
 * its own. A bubble leaving a nozzle fast does not skid across the surface; it
 * floats up to it. What moves it afterwards is the surface current, and that is
 * a much gentler thing, because the upwelling has spread its push over the whole
 * depth before it gets there.
 *
 * So `depth` governs both halves and in opposite directions: it **widens** the
 * circle bubbles appear in, and it **weakens** the current they appear into,
 * roughly as one over the depth. Deep water with a jet that is not industrial
 * gives bubbles arriving gently and nearly all of the motion coming from the
 * swirl and the waver — which is what the surface of real water does.
 *
 * ## The field has three parts, and each is a different kind of thing
 *
 * 1. **The jets' upwelling.** A softened source whose width is the *plume's*
 *    width at the surface rather than the nozzle's, and whose strength is the
 *    jet's power divided down by the depth. Analytic and sampled per bubble,
 *    because a grid fine enough to hold it would be hundreds of cells a side.
 * 2. **The churn**, which is the curl of a scalar noise field. Taking a curl is
 *    not decoration: it makes the flow *divergence-free*, so the background can
 *    only move water around and never make or destroy any. A noise field used
 *    directly as a velocity has sources and sinks all over it, and bubbles
 *    gather into the sinks and thin out of the sources — which reads instantly
 *    as particles obeying a texture rather than as water.
 * 3. **The ebb**, a slow linear pull toward the middle. A tub is closed, so
 *    everything the jets push out has to return. Where the ebb balances a jet's
 *    push there is a ring the foam cannot cross, and that standing ring is the
 *    thing a real jacuzzi always has.
 *
 * ## Growth has exactly one mechanism
 *
 * A bubble is born small and can only get bigger by swallowing another, area
 * conserved — so radius goes as the square root and it takes four to double one.
 * Nothing grows on its own. That is the seed's "as they radiate, they combine
 * and become bigger", and it is worth stating because the alternative — growing
 * a bubble with its age — is much easier and produces a picture where size means
 * time instead of meaning history.
 *
 * **Which is why `gas` is a quantity and not a count.** It was bubbles per
 * second in the first build, and that silently broke the only growth path there
 * is: halving the born size quartered the foam's coverage, so encounters became
 * rare and small bubbles could never coarsen into big ones. Measuring the gas
 * instead — how much surface a second's worth of bubbles covers — means smaller
 * bubbles simply means more of them, coverage holds, and the size a scene
 * settles at is decided by the foam rather than by the emitter.
 *
 * ## Popping is a hazard rate, not a ceiling
 *
 * Past `popSize` the chance of bursting climbs with the square of the excess, so
 * a bubble that keeps feeding goes quickly and one that stops just over the line
 * can last a while. A hard ceiling makes every large bubble the same size, which
 * is the tell that a number rather than a process is in charge.
 *
 * **Bursting is not the only way a big bubble dies, and it used to be.** Below
 * `popSize` the hazard is exactly zero, so a bubble born large simply sat there
 * — there was nothing anywhere in the piece that made a big film shorter-lived
 * than a small one. `fragile` is that: a wide film held up against gravity
 * drains faster than a narrow one, so the drain rate scales with radius. The
 * consequence is the useful part — growth now has a cost, and the foam settles
 * at a size where coalescence and drainage balance instead of running away.
 */

import { gaussian, hashSeed, makeRng } from "@/experiments/random"
import { curlAt } from "@/experiments/bubbles/water"
import { needsPool, type Settings } from "@/experiments/bubbles/settings"

/** The largest step the simulation will take, in seconds of water. */
const STEP = 1 / 60

/** Most substeps in one frame. A tab coming back resumes; it does not catch up. */
const MAX_STEPS = 4

/** How long the water runs before a reduced-motion still is taken, in seconds. */
const STILL_SECONDS = 22

/**
 * Frames actually drawn at the end of a `settle`, so a wake has time to build.
 *
 * **A picture that accumulates has to be drawn into, not merely advanced to.**
 * `trail` keeps a share of the previous frame, so the streaks are a rendering
 * artefact rather than simulation state: stepping the water forward a hundred
 * seconds and drawing once gives a frame with no wake in it at all, however
 * settled the water is. All three surfaces that arrive somewhere without
 * watching it happen fall into this together — the captured poster, the note's
 * backdrop and the reduced-motion still.
 *
 * Thirty is generous. At `trail` 0.95 the oldest visible frame is about sixty
 * back; below 0.8 it is under ten. The section's record on this is the posters
 * part of `../AGENTS.md`, and psyxels hit it first.
 */
const WAKE_FRAMES = 60

/** How far outside the frame a bubble is still simulated, as a fraction of `span`. */
const MARGIN = 0.18

/** How quickly a touching pair is brought to a common velocity, at `cling` 1. */
const CLING_RATE = 26

/** How hard bubbles within reach are drawn together, in m/s per second. */
const CLING_PULL = 0.6

/**
 * A bubble thinner than this many metres has drained away.
 *
 * **It must stay well under the smallest radius the birth band can ask for**,
 * and it did not. It was 1.2mm, chosen when the band's floor was 2mm, and when
 * that floor came down to half a millimetre this quietly became a filter on
 * birth: a bubble born at 1mm was already past the "gone" test and was released
 * on its first step, so setting the band to 1mm–1mm produced **no bubbles at
 * all**. Andrei found it within a minute of the range widening.
 *
 * The lesson is the one the section already has about literals: widening a
 * control's range can walk it into a constant that was fine on the day it was
 * written and was never about that control. 0.12mm is a quarter of the band's
 * floor, which leaves room for drainage and tearing to produce something
 * genuinely spent.
 */
const GONE = 0.00012

/** Biggest the contact grid may get on a side, so a fine scene cannot allocate wildly. */
const MAX_CELLS = 220

export type View = {
  /** CSS pixels. */
  width: number
  height: number
  /** Screen pixels per metre. */
  pxPerMetre: number
  /** Half the visible width and height, in metres, from the middle of the tub. */
  halfWidth: number
  halfHeight: number
  /** How far outside the frame a bubble is still simulated, in metres. */
  margin: number
}

/**
 * The frame, in metres.
 *
 * **Across the shorter side**, which is the section's rule for a subject with no
 * preferred direction — a sky, a sea, water from above. Embers frames by height
 * instead and says why: its subject is a column and has a natural height. This
 * one does not. A portrait phone gets the same tub at the same scale in a
 * narrower crop.
 */
export function makeView(span: number, width: number, height: number): View {
  const pxPerMetre = Math.max(1, Math.min(width, height)) / Math.max(0.2, span)
  return {
    width,
    height,
    pxPerMetre,
    halfWidth: width / 2 / pxPerMetre,
    halfHeight: height / 2 / pxPerMetre,
    margin: Math.max(0.1, span * MARGIN),
  }
}

export const screenX = (view: View, x: number): number => view.width / 2 + x * view.pxPerMetre
export const screenY = (view: View, y: number): number => view.height / 2 + y * view.pxPerMetre

export type Jet = {
  x: number
  y: number
  /** +1 or -1: which way this jet turns the water under it. */
  spin: number
  /** Seconds one surge takes, and where in it this jet currently is. */
  period: number
  phase: number
}

/**
 * Where the jets are, from the seed and the arrangement.
 *
 * **In metres of real water, not in units of the frame.** `spread` was a
 * fraction of `span` for about an hour, which made `span` move the jets apart
 * rather than step the camera back — so zooming out changed the tub instead of
 * showing more of it, and no two framings of one scene were the same scene.
 */
export function placeJets(settings: Settings): Jet[] {
  const { jets, layout, spin, spread, seed } = settings
  const radius = spread
  const rng = makeRng(hashSeed(seed, 0x9e37))
  const out: Jet[] = []

  for (let index = 0; index < jets; index++) {
    let x: number
    let y: number
    if (layout === "ring") {
      // Half a step of phase, so an even count never puts two jets on the
      // horizontal axis and reads as a row by accident.
      const angle = (index / jets) * Math.PI * 2 + Math.PI / jets
      x = Math.cos(angle) * radius
      y = Math.sin(angle) * radius
    } else if (layout === "row") {
      const t = jets === 1 ? 0 : (index / (jets - 1)) * 2 - 1
      x = t * radius
      y = 0
    } else {
      // Rejection-free disc sampling: sqrt on the radius keeps the middle from
      // being crowded, which is what a naive uniform radius does.
      const angle = rng() * Math.PI * 2
      const at = Math.sqrt(rng()) * radius
      x = Math.cos(angle) * at
      y = Math.sin(angle) * at
    }

    const turn = spin === "same" ? 1 : spin === "alternate" ? (index % 2 === 0 ? 1 : -1) : rng() < 0.5 ? -1 : 1
    // Every jet surges on its own clock, at its own rate. One shared period
    // makes the whole tub breathe together, which is the same tell a shared
    // waver frequency is one layer down — and here it would be worse, because a
    // surge is visible at the scale of the whole picture.
    out.push({ x, y, spin: turn, period: 2.2 + rng() * 4.2, phase: rng() * Math.PI * 2 })
  }

  return out
}

export type BubblesStats = {
  /** Bubbles on the surface. */
  alive: number
  /** The largest of them, in millimetres of radius. */
  biggest: number
  /** The average of them, in millimetres of radius. */
  mean: number
  /**
   * How fast the foam is actually moving, in millimetres a second.
   *
   * Here because "the surface moves too fast" is a claim about a number, and
   * the piece could not report that number — so the only way to answer it was
   * to look, which is exactly what this section says not to rely on. It is the
   * bubbles' speed rather than the water's, deliberately: the bubbles are the
   * whole of what anybody can see.
   */
  speed: number
  /**
   * Births, coalescences, bursts and tearings **since the last sweep**.
   *
   * Cumulative rather than a per-second window, and that is a fix rather than a
   * preference: the window was flushed from the animation frame, so every one
   * of them read as a stale number or a zero under `settle` — which is the only
   * way anything measures this piece. Two sessions' worth of lifetime
   * measurements were wrong before that was noticed. A rate is a subtraction
   * away; a number that was never written down is not.
   */
  made: number
  merges: number
  pops: number
  torn: number
  /**
   * Mean radius out in the calm, over mean radius inside a boil.
   *
   * **Above 1 means bubbles are bigger away from the jets**, which is what a
   * real tub does and what this piece did not do until tearing arrived: the
   * boil is where the foam is densest, density is what drives coalescence, so
   * the biggest bubbles necessarily formed in the one place they never should.
   *
   * Here because "big bubbles tend to become big in the middle" is a claim
   * about a number and the piece could not report that number. The first
   * version of it compared *above-mean* bubbles with *below-mean* ones by
   * distance, which was too blunt to steer by — with a skewed distribution
   * almost everything sits below the mean. This asks the question the way it
   * was actually put: inside the boil, or outside it.
   */
  bigOut: number
  /**
   * How deeply **comparable** bubbles interpenetrate, as a percentage of the
   * distance at which they would rest tangent, averaged over those pairs.
   *
   * Zero is bubbles resting against each other; 100 would be concentric. A disc
   * hides interpenetration — the union of two white discs is one white blob —
   * and an outline cannot, which is why rings revealed this rather than caused
   * it.
   *
   * **Comparable** means both are at least four times the largest birth size —
   * bubbles that got big by merging rather than by arriving — and the
   * qualifier is the whole usefulness of the number. It took two goes to get
   * right. Over every pair it read 731%, swamped by half-millimetre specks
   * sitting inside fifty-millimetre rings for the frame before they are
   * absorbed. Restricted only to pairs of *similar* size it read about 20% and
   * barely moved, because dust-on-dust pairs outnumber the big rings by
   * hundreds to one and they are similar to each other.
   *
   * Neither of those is the pair anybody is looking at. This one is.
   */
  overlap: number
  /**
   * How fast touching bubbles slide against each other, in millimetres a
   * second, averaged over every touching pair.
   *
   * Foam is bound by shared walls and a raft travels as a unit, so this should
   * be small next to the speed the foam is moving at. Both numbers are here
   * because "they appear on top of one another" and "they stick together and
   * move together" are claims about numbers the piece could not report.
   */
  slip: number
  /**
   * How far contact moves a bubble directly, in millimetres a second, averaged
   * over every live bubble.
   *
   * Separating an overlap is a correction to the position: it does not show up
   * in the motion and the flow undoes it next step, so it reads as a jump
   * rather than as a push. Against `speed` it says how much of what a viewer
   * sees is the flow and how much is the solver.
   */
  shove: number
  /**
   * Radius of the standing ring, in millimetres, or 0 if there is not one.
   *
   * A closed tub has to give back what the jets push out, so somewhere the
   * outflow and the return cancel and the radial flow is zero. Foam carried out
   * from the jets arrives there and cannot go further; foam outside is brought
   * back to it. It is the thing a real jacuzzi always has and nobody draws.
   *
   * **Analytic, not measured** — it falls out of the settings, which is the
   * point of reporting it. Far enough out the jets read as one source of `jets`
   * times the strength, so the balance is where
   * `n x reaching x 2 x boil / (d^2 + boil^2)` equals `ebb`. Checked against
   * where the foam actually sits, over a range of `ebb`, and the two agree
   * inside one per cent.
   *
   * It is here because the ring is easy to have and impossible to see: at the
   * primary's framing it sits outside the picture entirely, and Andrei found it
   * by accident after widening `frame` for an unrelated reason. Against
   * `span / 2` it says whether the frame contains it.
   */
  ring: number
  /** Frames per second, averaged over the last second. */
  fps: number
}

export type Bubbles = {
  start: () => void
  stop: () => void
  setPaused: (held: boolean) => void
  setSettings: (next: Settings) => void
  /** Run the water forward without waiting for it, in seconds. */
  settle: (seconds: number) => void
  /** Clear the surface and let it fill again. */
  clear: () => void
  stats: () => BubblesStats
}

export function createBubbles(canvas: HTMLCanvasElement, initial: Settings): Bubbles {
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) throw new Error("Bubbles: no 2d context")
  const ctx = context

  let settings = initial
  let jets = placeJets(settings)
  let view = makeView(settings.span, canvas.clientWidth || 1, canvas.clientHeight || 1)

  // The pool. Every bubble is allocated once when `count` changes and reused
  // after that: births and deaths both run at hundreds a second forever, which
  // is exactly the shape that makes a garbage collector visible.
  let capacity = Math.round(settings.count)
  let px = new Float32Array(capacity)
  let py = new Float32Array(capacity)
  let vx = new Float32Array(capacity)
  let vy = new Float32Array(capacity)
  let radius = new Float32Array(capacity)
  let phase = new Float32Array(capacity)
  let hertz = new Float32Array(capacity)
  // How far through its film life each bubble is, 0 at birth and 1 when the
  // film gives way. A fraction rather than an age in seconds, because the rate
  // it fills at depends on the radius, and a bubble's radius changes.
  let spent = new Float32Array(capacity)
  // How hard the jets are working where each bubble is, carried from the step
  // loop into the contact sweep so neither has to sample the field twice.
  let worked = new Float32Array(capacity)
  let live = new Uint8Array(capacity)
  let free = new Int32Array(capacity)
  let freeCount = 0
  let alive = 0

  // The contact grid, rebuilt each step as a linked list per cell. Int32Array
  // heads and a `next` chain rather than arrays of arrays, for the same reason
  // the pool exists.
  let heads = new Int32Array(0)
  let entryOf = new Int32Array(0)
  let entryNext = new Int32Array(0)
  let seen = new Int32Array(capacity)
  let stamp = 1
  let cellSize = 0.05
  let cols = 1
  let rows = 1
  let originX = 0
  let originY = 0

  let rng = makeRng(hashSeed(settings.seed, 0x51ed))
  let clock = 0
  let owed = new Float64Array(8)

  let running = false
  let held = false
  let frame = 0
  let last = 0

  // Accumulated over every touching pair since the last sweep, for `stats`.
  // **Not the last step's average**, which is what they were: at any instant
  // only a handful of large bubbles are in contact, so a per-step mean came
  // back as 15, then 45, then 14 for the same scene. Averaging over the run
  // makes them steerable.
  let overlapSum = 0
  let overlapCount = 0
  let slipSum = 0
  let slipCount = 0
  let shoveSum = 0
  let shoveSeconds = 0
  let made = 0
  let merges = 0
  let pops = 0
  let torn = 0
  let frames = 0
  let fps = 0
  let tallyAt = 0

  function resetPool(size: number) {
    capacity = Math.max(1, Math.round(size))
    px = new Float32Array(capacity)
    py = new Float32Array(capacity)
    vx = new Float32Array(capacity)
    vy = new Float32Array(capacity)
    radius = new Float32Array(capacity)
    phase = new Float32Array(capacity)
    hertz = new Float32Array(capacity)
    spent = new Float32Array(capacity)
    worked = new Float32Array(capacity)
    live = new Uint8Array(capacity)
    free = new Int32Array(capacity)
    seen = new Int32Array(capacity)
    freeCount = capacity
    for (let i = 0; i < capacity; i++) free[i] = capacity - 1 - i
    alive = 0
  }

  resetPool(settings.count)

  /**
   * Takes a slot, or -1.
   *
   * A birth with no slot is **dropped** rather than evicting a live bubble.
   * Eviction would take the oldest — which here means the biggest, the one that
   * has been collecting others and is about to burst — and replace it with a
   * fresh speck at a jet, so raising the gas past the ceiling would visibly
   * destroy the interesting half of the picture instead of simply not adding
   * more.
   */
  function take(): number {
    if (freeCount === 0) return -1
    const index = free[--freeCount]!
    live[index] = 1
    alive++
    return index
  }

  function release(index: number) {
    if (live[index] === 0) return
    live[index] = 0
    free[freeCount++] = index
    alive--
  }

  function born(x: number, y: number, r: number, bx: number, by: number) {
    const index = take()
    if (index < 0) return
    made++
    px[index] = x
    py[index] = y
    vx[index] = bx
    vy[index] = by
    radius[index] = r
    spent[index] = 0
    phase[index] = rng() * Math.PI * 2
    // Each bubble wavers on its own clock, spread around the setting. One shared
    // frequency makes the whole surface breathe together, which is the single
    // clearest tell that a field rather than a fluid is in charge.
    hertz[index] = settings.waveHz * (0.55 + rng() * 0.9)
  }

  /**
   * The water's velocity at a point, in m/s.
   *
   * Sampled once per bubble per step, which is the budget: the churn costs eight
   * noise lookups and each jet costs about ten operations.
   */
  function flow(x: number, y: number, out: { x: number; y: number; jetted: number }) {
    let ux = 0
    let uy = 0
    // How hard the jets are working *here*, in m/s, kept apart from the total.
    // It is what decides whether a bubble can hold together, and the churn is
    // deliberately not in it: the churn is a smooth large-scale advection that
    // a bubble rides without being sheared, where a boil is the violent part.
    let jetted = 0

    const boil = boilRadius()
    const fade = surfaceFade()
    const reaching = settings.outflow * fade
    // The twist is attenuated by the same factor, and it has to be: a jet's
    // rotation spreads over the depth it climbs exactly as its push does.
    // Exempting it would make `depth` calm the spokes and leave the spirals,
    // which is not a thing water does.
    const twisting = settings.swirl * fade
    for (const jet of jets) {
      const dx = x - jet.x
      const dy = y - jet.y
      const d2 = dx * dx + dy * dy
      const d = Math.sqrt(d2)
      if (d < 1e-6) continue
      // Peaks where the plume breaks the surface and falls away like 1/d
      // outside it. A bare 1/d would be infinite over the jet. The width is the
      // *plume's* at the surface, not the nozzle's: what a viewer can see of a
      // jet is as wide as the boil, and the boil is as wide as the gas by the
      // time it has climbed.
      const profile = surgeOf(jet) * ((2 * boil * d) / (d2 + boil * boil))
      const nx = dx / d
      const ny = dy / d
      ux += reaching * profile * nx + twisting * profile * -ny * jet.spin
      uy += reaching * profile * ny + twisting * profile * nx * jet.spin
      jetted += (reaching + twisting) * profile
    }

    if (settings.churn > 0) {
      curlAt(settings.seed, x, y, clock, settings.scale, settings.churn, settings.drift, out)
      ux += out.x
      uy += out.y
    }

    // The return. A closed tub has to give back everything the jets push out,
    // and where this balances a jet there is a ring the foam cannot cross.
    ux -= settings.ebb * x
    uy -= settings.ebb * y

    out.x = ux
    out.y = uy
    out.jetted = jetted
  }

  const sample = { x: 0, y: 0, jetted: 0 }

  /** The speed at which a patch of water counts as fully worked. */
  const WORKED = 0.06

  /** The radius `fragile` is measured against: half a centimetre. */
  const FILM_REFERENCE = 0.005

  /**
   * How long this bubble's film will hold, in seconds.
   *
   * **A total life, not a decay constant, and the difference is the whole
   * point.** This was a radius loss in metres per second, which inverted the
   * control that depends on it: a flat rate means a big bubble simply has more
   * to lose, so it outlasted the small ones `fragile` was written to outlive.
   * Andrei reported it as "drain is scaled incorrectly — the only interesting
   * values are very close to zero", and both halves of that are the same fault.
   *
   * Exponential shrinking does not fix it either, and was tried: decaying
   * toward a fixed floor takes a 40mm bubble *longer* to disappear than a 1mm
   * one, because it has so much further to fall. What was wrong was modelling
   * the film as something that thins away to nothing. A real surface bubble
   * holds its size and then ruptures, and how long it holds is what depends on
   * how wide the film is.
   */
  const filmLife = (r: number) => settings.life / (1 + (settings.fragile * r) / FILM_REFERENCE)

  /**
   * The largest a bubble can hold together at a point, in metres.
   *
   * **This is the mechanism that keeps big bubbles out of the boil**, and it is
   * the Kolmogorov–Hinze scale in the only form this piece needs: the harder the
   * water is being worked, the smaller the bubble that survives it. A pocket of
   * air rising through a jacuzzi does not arrive as one bubble for exactly this
   * reason, which is also why the birth band has a low ceiling and does not need
   * one written down.
   *
   * Without it, the biggest bubbles necessarily formed where the foam was
   * densest, which is directly over a jet — the one place a real tub never has
   * them. Density drives coalescence, so no amount of tuning the birth positions
   * could have fixed that; something had to take large bubbles apart again.
   */
  const stableAt = (jetted: number) =>
    settings.shatter > 0 ? settings.stable / (1 + (settings.shatter * jetted) / WORKED) : settings.stable

  /**
   * Cut a bubble down to what the water there will hold, and give the rest to a
   * sibling.
   *
   * Tearing is not bursting: the gas stays in the tub, it is simply carried by
   * more bubbles. The parent is always cut to the limit whether or not a slot is
   * free, so the ceiling holds even with the pool full — a remainder too small
   * to draw, or with nowhere to go, is lost the way real fines are.
   */
  function tear(index: number, limit: number) {
    const r = radius[index]!
    const rest = Math.sqrt(Math.max(0, r * r - limit * limit))
    radius[index] = limit
    torn++
    if (rest <= GONE) return
    const angle = rng() * Math.PI * 2
    const apart = limit + rest
    const before = freeCount
    born(
      px[index]! + Math.cos(angle) * apart,
      py[index]! + Math.sin(angle) * apart,
      rest,
      vx[index]! + Math.cos(angle) * 0.05,
      vy[index]! + Math.sin(angle) * 0.05,
    )
    // Tearing does not refresh a film: the halves carry the parent's wear.
    if (freeCount < before) spent[free[freeCount]!] = spent[index]!
  }

  /**
   * How wide the plume is by the time it reaches the surface, in metres.
   *
   * A bubble plume entrains water as it climbs and spreads roughly in
   * proportion to how far it has come, so the boil over a jet is the nozzle
   * plus a share of the depth. This is the width of the visible disturbance and
   * the width of the circle bubbles arrive in; they are the same thing, which
   * is the point.
   */
  const boilRadius = () => settings.core + settings.depth * settings.plume

  /**
   * What share of a jet's work reaches the surface at all.
   *
   * **It is the ratio of the nozzle's width to the boil's, and that is not a
   * curve somebody drew.** A round turbulent jet conserves its momentum flux
   * while spreading over a cone, so `u² × area` is constant; area goes as the
   * square of the width, and the centreline speed therefore falls as the width
   * grows. Deeper water means a wider boil means a slower one, in exactly that
   * proportion, and `plume` sets both because it is one spreading rate.
   *
   * This is the whole of "deep water does not move violently at the surface",
   * and it is why `depth` is the control to reach for rather than the clock: it
   * changes what the jets do instead of how fast we watch them.
   *
   * **The first version of this was invented rather than derived** — a plain
   * `1/(1 + depth/0.5)` — and measuring said so. Over the entire range of
   * `depth` it moved the foam's mean speed from 318 mm/s to 164, where the
   * docblock beside it claimed an order of magnitude. The derived form gives
   * about nine times at the same settings, and it ties the falloff to `core`
   * and `plume`, which is correct: a wider nozzle carries further, and a jet
   * that fans out harder gives up its speed sooner.
   */
  const surfaceFade = () => settings.core / boilRadius()

  /**
   * Where the jets' push and the return cancel, in metres, or 0 for nowhere.
   *
   * See `BubblesStats.ring`. Zero when the return is off — everything then
   * leaves through the sides and there is no standing radius — and zero when the
   * jets are too weak to reach past their own boil, which is the same thing said
   * the other way.
   */
  function ringRadius(): number {
    if (settings.ebb <= 0 || jets.length === 0) return 0
    const boil = boilRadius()
    const reaching = settings.outflow * surfaceFade()
    const solved = (jets.length * reaching * 2 * boil) / settings.ebb - boil * boil
    return solved > 0 ? Math.sqrt(solved) : 0
  }

  /**
   * How hard one jet is working right now, as a multiple of its settings.
   *
   * The same number scales the gas and the push, because they have the same
   * cause: a pump delivering harder pushes more water *and* entrains more air.
   * Scaling only the gas gives a tub whose density pulses while its flow does
   * not, which reads as the bubbles changing rather than the jet.
   */
  function surgeOf(jet: Jet): number {
    if (settings.pulse <= 0) return 1
    return 1 + settings.pulse * Math.sin((clock / jet.period) * Math.PI * 2 + jet.phase)
  }

  /**
   * Gas arriving at the surface.
   *
   * **The debt is in square metres, not in bubbles**, so a jet delivers a
   * quantity of gas and the born size decides how many bubbles that comes to.
   * Halving the size therefore quadruples the count and the foam keeps its
   * coverage — which is what makes coalescence survive a small born size, and
   * is the whole of why this is not a counter.
   *
   * **A bubble arrives; it is not fired.** It appears somewhere in the plume's
   * footprint with a Gaussian spread, because a plume's gas flux is densest on
   * its axis, and it takes the velocity of the water *it arrives into* rather
   * than anything of the jet's own. A jet at the bottom gives a bubble a place,
   * not a direction.
   */
  function emit(dt: number) {
    if (jets.length === 0) return
    const low = settings.birthMin
    const high = Math.max(settings.birthMin, settings.birthMax)
    // cm² a second, as the control reads, to m² of bubble cross-section.
    const flux = settings.gas * 1e-4
    const footprint = boilRadius()

    for (let index = 0; index < jets.length; index++) {
      // A backlog of at most a second, so a tab coming back does not empty a
      // held-up queue into one frame.
      owed[index] = Math.min(flux, (owed[index] ?? 0) + flux * surgeOf(jets[index]!) * dt)
    }

    // **Round robin, and this is not tidiness.** Serving the jets in order out
    // of one pool meant the first jet took every slot freed that step, and the
    // rest got whatever was left — which at a small born size is nothing, since
    // demand runs to thousands of bubbles a second against a pool of a couple
    // of thousand. On screen it read as one working jet and two blocked
    // nozzles, and Andrei reported it as exactly that. Nothing about it was
    // variability; it was a queue with no fairness in it.
    let made = 0
    const ceiling = 400 * jets.length
    for (let pending = true; pending && made < ceiling;) {
      pending = false
      for (let index = 0; index < jets.length && made < ceiling; index++) {
        if (owed[index]! <= 0) continue

        // Sizes clustered toward the small end of the band: a bubble breaking
        // off a plume is graded by how much gas went with it, not drawn from a
        // hat.
        const t = Math.min(1, Math.max(0, 0.5 + gaussian(rng) * 0.28))
        const r = low + (high - low) * t * t

        // **Only if the jet can afford it**, and the overdraft is never
        // forgiven. It used to subtract the cost whether or not the debt
        // covered it and zero anything negative at the end of the frame, which
        // silently made this a counter again: a jet emitted exactly one bubble
        // per step whatever its size, so 180 a second at three jets no matter
        // what `gas` or `born size` said. Measured — the births came out
        // identical at 5mm, 10mm and 14mm, which is impossible if gas is a
        // quantity. Everything this file claims about smaller bubbles meaning
        // more of them was false while that line stood.
        const cost = Math.PI * r * r
        if (owed[index]! < cost) continue
        owed[index]! -= cost
        pending = true
        made++

        // Gaussian across the footprint, because a plume has no edge, and it
        // takes the velocity of the water it arrives into rather than anything
        // of the jet's own.
        const jet = jets[index]!
        const x = jet.x + gaussian(rng) * footprint * 0.45
        const y = jet.y + gaussian(rng) * footprint * 0.45
        flow(x, y, sample)
        born(x, y, r, sample.x, sample.y)
      }
    }
  }

  /**
   * The contact grid, rebuilt each step.
   *
   * **The cell is sized from the *typical* bubble, not the largest**, and each
   * bubble is entered into every cell its own reach covers. The obvious
   * arrangement — one cell per bubble, sized to hold the largest pair, swept
   * 3x3 — is what this replaced, and it has a failure that only shows up in the
   * scenes worth looking at: a single 52mm bubble forces a 12cm cell on
   * everybody, so `rolling boil`'s 5,800 four-millimetre bubbles landed about
   * fifty to a cell and the sweep came to two and a half million pair tests a
   * step. Measured at **10 fps**, against 58 for the same scene before it had
   * anything big enough in it.
   *
   * Entering a bubble into every cell it covers costs one pass and makes the
   * big ones pay for themselves instead of taxing the small ones. Two bubbles
   * can touch only if their reaches overlap, and if they do they share at least
   * one cell, so nothing is missed. A pair can share several cells, which is
   * what `seen` is for — without it a jostle would be applied twice to exactly
   * the pairs that overlap most.
   */
  function rebuildGrid() {
    let total = 0
    let count = 0
    let biggest = settings.birthMax
    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      total += radius[i]!
      count++
      if (radius[i]! > biggest) biggest = radius[i]!
    }
    const typical = count > 0 ? total / count : settings.birthMax

    const extentX = view.halfWidth + view.margin
    const extentY = view.halfHeight + view.margin
    const reach = Math.max(1, settings.pack)
    let size = Math.max(typical * 2.5 * reach, 0.003)
    cols = Math.ceil((extentX * 2) / size)
    rows = Math.ceil((extentY * 2) / size)
    if (cols > MAX_CELLS || rows > MAX_CELLS) {
      size = Math.max((extentX * 2) / MAX_CELLS, (extentY * 2) / MAX_CELLS)
      cols = Math.ceil((extentX * 2) / size)
      rows = Math.ceil((extentY * 2) / size)
    }
    cellSize = size
    originX = -extentX
    originY = -extentY

    const wanted = cols * rows
    if (heads.length !== wanted) heads = new Int32Array(wanted)
    heads.fill(-1)

    // One entry per (bubble, cell) pair, so the arrays are sized by coverage
    // rather than by population. They only ever grow.
    let entries = 0
    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      const r = radius[i]! * reach
      const x0 = cellX(px[i]! - r)
      const x1 = cellX(px[i]! + r)
      const y0 = cellY(py[i]! - r)
      const y1 = cellY(py[i]! + r)
      entries += (x1 - x0 + 1) * (y1 - y0 + 1)
    }
    if (entryOf.length < entries) {
      entryOf = new Int32Array(entries * 2)
      entryNext = new Int32Array(entries * 2)
    }

    let at = 0
    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      const r = radius[i]! * reach
      const x0 = cellX(px[i]! - r)
      const x1 = cellX(px[i]! + r)
      const y0 = cellY(py[i]! - r)
      const y1 = cellY(py[i]! + r)
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const cell = cy * cols + cx
          entryOf[at] = i
          entryNext[at] = heads[cell]!
          heads[cell] = at
          at++
        }
      }
    }
  }

  const cellX = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor((x - originX) / cellSize)))
  const cellY = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y - originY) / cellSize)))

  /**
   * Coalescence and jostling, in one sweep over touching pairs.
   *
   * Merging conserves area and momentum. Not merging separates the pair by mass
   * share, so a big bubble barely moves when a speck runs into it — which is
   * what turns a crowd into a raft with structure rather than a heap of
   * overlapping circles.
   */
  function contacts(dt: number) {
    if (settings.merge <= 0 && settings.bounce <= 0) return
    rebuildGrid()

    // `merge` is now a rate — film failures per second of contact — rather than
    // a dial scaled by a constant. **That is what decides whether the piece can
    // make foam at all.** At the old top end a touching pair became one bubble
    // inside a frame: measured at 3,242 merges a second against 1,203 bubbles
    // alive, every bubble merging three times a second, so no raft of
    // neighbours could ever exist and `cling` had nothing to hold together.
    const base = settings.merge * dt
    const reach = Math.max(1, settings.pack)
    stamp++

    // "Big" is four times the largest a bubble can arrive at, so it means
    // assembled here rather than delivered.
    const grown = settings.birthMax * 4
    shoveSeconds += dt

    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      const ri = radius[i]!
      const ir = ri * reach
      const x0 = cellX(px[i]! - ir)
      const x1 = cellX(px[i]! + ir)
      const y0 = cellY(py[i]! - ir)
      const y1 = cellY(py[i]! + ir)

      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          for (let e = heads[cy * cols + cx]!; e >= 0; e = entryNext[e]!) {
            const j = entryOf[e]!
            // Each unordered pair once per step, however many cells it shares,
            // and never a bubble with itself.
            if (j <= i || live[j] === 0 || live[i] === 0) continue
            if (seen[j] === stamp) continue
            seen[j] = stamp

            const dx = px[j]! - px[i]!
            const dy = py[j]! - py[i]!
            const rj = radius[j]!
            const span = (radius[i]! + rj) * settings.pack
            const d2 = dx * dx + dy * dy
            if (d2 > span * span) continue
            const d = Math.sqrt(d2) || 1e-6

            const mi = radius[i]! * radius[i]!
            const mj = rj * rj
            const total = mi + mj

            // **Worked water does not let bubbles join either.** Films need a
            // moment of quiet to drain and rupture between two bubbles, and a
            // boil does not give them one — so agitation suppresses coalescence
            // by the same factor it lowers the size a bubble can hold. It is
            // also what stops the merge-and-tear treadmill: without it, the one
            // place bubbles are torn apart fastest was also the place they were
            // joined fastest.
            const busy = Math.max(worked[i]!, worked[j]!)
            const chance = base > 0 ? 1 - Math.exp(-base / (1 + (settings.shatter * busy) / WORKED)) : 0

            if (chance > 0 && rng() < chance) {
              // **A film giving way does not always join two bubbles.** It can
              // take the outer wall with it, and then one of them is simply
              // gone — which is what a foam raft does constantly and is why a
              // crowd of neighbours does not inevitably coarsen into one
              // enormous bubble. The larger of the pair is likelier to be the
              // one that goes, because it is holding up more film.
              if (settings.rupture > 0 && rng() < settings.rupture) {
                burst(rng() < mi / total ? i : j)
                continue
              }
              // Area conserved, so radius goes as the square root: four
              // bubbles to double one.
              px[i] = (px[i]! * mi + px[j]! * mj) / total
              py[i] = (py[i]! * mi + py[j]! * mj) / total
              vx[i] = (vx[i]! * mi + vx[j]! * mj) / total
              vy[i] = (vy[i]! * mi + vy[j]! * mj) / total
              // Area-weighted, so swallowing a fresh bubble buys a little time
              // and swallowing a tired one costs it.
              spent[i] = (spent[i]! * mi + spent[j]! * mj) / total
              radius[i] = Math.sqrt(total)
              if (rj > radius[i]!) {
                phase[i] = phase[j]!
                hertz[i] = hertz[j]!
              }
              release(j)
              merges++
              continue
            }

            const ux = dx / d
            const uy = dy / d
            const overlap = radius[i]! + rj - d

            slipSum += Math.hypot(vx[j]! - vx[i]!, vy[j]! - vy[i]!)
            slipCount++
            if (overlap > 0 && radius[i]! >= grown && rj >= grown) {
              overlapSum += overlap / (radius[i]! + rj)
              overlapCount++
            }

            // **Contact acts on velocity, not on position.** It used to shove
            // the two apart by a share of the overlap every step, which is a
            // teleport: undamped, not carried in the motion, and undone by the
            // flow on the next step. Between two large bubbles that came to
            // about 100mm/s of positional noise against a foam moving at 60,
            // which is what "big ones jump around randomly" was.
            const shareI = mj / total
            const shareJ = mi / total

            if (settings.cling > 0) {
              // **Foam is bound by shared walls and travels as a unit.** Nothing
              // here made bubbles stick: they could only become one or push
              // apart, so a crowd was a set of tracers that happened to be near
              // each other and slid freely through the overlap. This pulls a
              // touching pair toward a common velocity, which is what turns a
              // crowd into a raft.
              //
              // The attraction below it is the same effect one layer out: two
              // bubbles on a water surface deform the meniscus between them and
              // are drawn together — the reason cereal clumps in a bowl — so
              // within reach but not yet touching, they close.
              const bind = settings.cling * (1 - Math.exp(-CLING_RATE * dt))
              const rvx = vx[j]! - vx[i]!
              const rvy = vy[j]! - vy[i]!
              vx[i]! += rvx * shareI * bind
              vy[i]! += rvy * shareI * bind
              vx[j]! -= rvx * shareJ * bind
              vy[j]! -= rvy * shareJ * bind

              if (overlap <= 0) {
                const pull = settings.cling * CLING_PULL * dt
                vx[i]! += ux * pull * shareI
                vy[i]! += uy * pull * shareI
                vx[j]! -= ux * pull * shareJ
                vy[j]! -= uy * pull * shareJ
              }
            }

            if (settings.bounce <= 0 || overlap <= 0) continue

            // **Resolve the overlap in the positions, and damp the approach in
            // the velocities.** Both halves are needed and the piece has now had
            // each one alone.
            //
            // Positions only was the original, and it jittered: two bubbles were
            // shoved apart every step, the flow pushed them straight back, and
            // nothing in the motion remembered either — which between two large
            // bubbles came to about 100mm/s of noise against a foam moving at
            // 60. That is what "big ones jump around randomly" was.
            //
            // Velocity only was the first attempt at a fix, and it does not
            // separate anything: a spring soft enough to be stable needs about
            // three seconds to clear an overlap a fifth of the way in, so the
            // pair stays visibly interpenetrated for its whole life. Measured at
            // 20% mean overlap between grown bubbles, barely moved by `bounce`.
            //
            // So the position correction does the separating, at full strength,
            // and the normal velocity is damped so the pair stops arriving at
            // each other again. The tangential half is `cling`'s.
            // Capped at the smaller bubble's radius. Without it a speck caught
            // near the middle of a large bubble has an overlap of nearly the
            // large one's whole radius, and separating "fully" flings it that
            // far in one step. They almost always merge before it matters, but
            // "almost always" is not a thing to leave in a contact solver.
            const push = Math.min(overlap, Math.min(radius[i]!, rj)) * settings.bounce
            shoveSum += push
            px[i]! -= ux * push * shareI
            py[i]! -= uy * push * shareI
            px[j]! += ux * push * shareJ
            py[j]! += uy * push * shareJ

            const closing = (vx[j]! - vx[i]!) * ux + (vy[j]! - vy[i]!) * uy
            if (closing < 0) {
              const kill = closing * settings.bounce
              vx[i]! += ux * kill * shareI
              vy[i]! += uy * kill * shareI
              vx[j]! -= ux * kill * shareJ
              vy[j]! -= uy * kill * shareJ
            }
          }
        }
      }
      // A fresh stamp per bubble, so `seen` means "already paired with i".
      stamp++
    }
  }

  function burst(index: number) {
    const r = radius[index]!
    const x = px[index]!
    const y = py[index]!
    release(index)
    pops++

    const count = Math.round(settings.spray)
    if (count <= 0) return
    // A film letting go throws droplets outward, fast and small. They are gas
    // the surface has not finished with rather than a decoration: the flow takes
    // them straight back into whatever is nearby.
    const speed = 0.4 + 6 * r
    const start = rng() * Math.PI * 2
    for (let k = 0; k < count; k++) {
      const angle = start + (k / count) * Math.PI * 2 + rng() * 0.4
      born(
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r,
        Math.max(GONE * 1.5, settings.birthMin * 0.6),
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
      )
    }
  }

  function step(dt: number) {
    clock += dt
    emit(dt)

    const killX = view.halfWidth + view.margin
    const killY = view.halfHeight + view.margin
    const wave = settings.wave
    const lag = settings.lag

    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue

      flow(px[i]!, py[i]!, sample)
      worked[i] = sample.jetted
      let ux = sample.x
      let uy = sample.y

      if (wave > 0) {
        // Across the direction of travel rather than along it, so the sidestep
        // bends the path instead of changing how fast it is walked.
        const speed = Math.hypot(ux, uy)
        const dx = speed > 1e-5 ? ux / speed : 1
        const dy = speed > 1e-5 ? uy / speed : 0
        const swing = Math.sin(clock * hertz[i]! * Math.PI * 2 + phase[i]!) * wave
        ux += -dy * swing
        uy += dx * swing
      }

      if (lag > 0) {
        // Exponential relaxation toward the water, so it is stable at any step
        // and a big bubble takes longer to turn than a small one.
        const tau = lag * 0.35 * Math.sqrt(Math.max(radius[i]!, GONE) / 0.008)
        const k = tau > 1e-4 ? 1 - Math.exp(-dt / tau) : 1
        vx[i]! += (ux - vx[i]!) * k
        vy[i]! += (uy - vy[i]!) * k
      } else {
        vx[i] = ux
        vy[i] = uy
      }

      px[i]! += vx[i]! * dt
      py[i]! += vy[i]! * dt

      // The film clock. It fills faster the wider the bubble is, so a speck
      // can sit in a quiet corner for minutes while a big one is on its way out
      // from the moment it becomes big — and a bubble that grows by swallowing
      // others brings its own share of wear with it.
      spent[i]! += dt / filmLife(radius[i]!)
      if (spent[i]! >= 1) {
        burst(i)
        continue
      }

      if (radius[i]! <= GONE || Math.abs(px[i]!) > killX || Math.abs(py[i]!) > killY) {
        release(i)
        continue
      }

      if (settings.shatter > 0 || settings.stable < 0.06) {
        const limit = stableAt(sample.jetted)
        // A fifth over before it goes, so a merge that lands just above the
        // limit is not torn straight back apart. Without the gap, a high
        // `coalesce` next to a low limit is a treadmill: two bubbles at the
        // limit merge, exceed it, split, and do it again — measured at 200,000
        // tearings among 5,000 bubbles in ninety seconds, which is a dynamic
        // equilibrium in the arithmetic and a waste of a frame on screen.
        if (radius[i]! > limit * 1.2) tear(i, limit)
      }

      if (settings.popRate > 0 && radius[i]! > settings.popSize) {
        const excess = radius[i]! / settings.popSize - 1
        const hazard = settings.popRate * excess * excess
        if (rng() < 1 - Math.exp(-hazard * dt)) burst(i)
      }
    }

    contacts(dt)
  }

  function draw() {
    if (settings.trail > 0) {
      // A wake: the last frame left behind, fading. Not a blur — every circle is
      // still drawn at full white, so what dims is only where they have been.
      ctx.fillStyle = `rgb(0 0 0 / ${((1 - settings.trail) * 100).toFixed(1)}%)`
      ctx.fillRect(0, 0, view.width, view.height)
    } else {
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, view.width, view.height)
    }

    // Two passes, because a stroke and a fill cannot share a path. Within each
    // pass it is **one** path for the whole surface: the circles are all the
    // same white and overlaps union under the default winding rule, so the
    // picture is identical to drawing them one by one and costs a single
    // operation.
    //
    // `mixed` is the reason the split is by bubble rather than by scene. A ring
    // whose wall is under about three quarters of a pixel does not draw as a
    // ring; it draws as a grey smudge, because the only thing a sub-pixel
    // stroke can do is lower the coverage. So a bubble too small to hold a wall
    // is a dot, which is also what an eye sees.
    // **The same wall for every bubble, in pixels.** It was a fraction of the
    // radius, which is backwards to look at: a small bubble came out with a
    // visibly thicker wall than a large one, when a real bubble's wall reads as
    // the same fine line whatever its size.
    const wall = settings.rim
    const wantRing = settings.look !== "disc"
    const ringAll = settings.look === "ring"

    ctx.fillStyle = "#fff"
    ctx.beginPath()
    let filled = false
    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      const r = radius[i]! * view.pxPerMetre
      if (r < 0.15) continue
      // A ring needs room for its wall plus a hole; under that it is a dot.
      if (wantRing && (ringAll || r >= wall * 1.6)) continue
      const x = screenX(view, px[i]!)
      const y = screenY(view, py[i]!)
      ctx.moveTo(x + r, y)
      ctx.arc(x, y, r, 0, Math.PI * 2)
      filled = true
    }
    if (filled) ctx.fill()

    if (!wantRing) return

    ctx.strokeStyle = "#fff"
    ctx.beginPath()
    let stroked = false
    for (let i = 0; i < capacity; i++) {
      if (live[i] === 0) continue
      const r = radius[i]! * view.pxPerMetre
      if (r < 0.15) continue
      if (!ringAll && r < wall * 1.6) continue
      const x = screenX(view, px[i]!)
      const y = screenY(view, py[i]!)
      // A stroke straddles its path, so the arc is inset by half the wall and
      // the bubble's outer edge still lands at `r`. Without that a ring is
      // visibly bigger than the disc it replaces and toggling `drawn as`
      // changes the size of everything. The wall is capped at the radius so a
      // bubble smaller than its own wall cannot invert.
      const width = Math.min(wall, r * 1.6)
      const at = Math.max(0.05, r - width / 2)
      ctx.moveTo(x + at, y)
      ctx.arc(x, y, at, 0, Math.PI * 2)
      stroked = true
      ctx.lineWidth = width
      // One path cannot carry two widths, so a run of same-width rings would be
      // ideal and is not worth the bookkeeping: stroke per bubble here, and the
      // pass only runs for bubbles large enough to be few.
      ctx.stroke()
      ctx.beginPath()
    }
    if (stroked) ctx.beginPath()
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    view = makeView(settings.span, width, height)
  }

  function tick(now: number) {
    if (!running) return
    frame = requestAnimationFrame(tick)
    if (held) {
      last = now
      return
    }

    const wall = last === 0 ? STEP : Math.min(0.25, (now - last) / 1000)
    last = now
    // Seconds of water per second of wall clock. Substeps are still capped at
    // STEP, so slow motion is smooth rather than the stop-motion an accumulator
    // draining a fixed step produces below about a fifth speed.
    const elapsed = wall * settings.playback

    let remaining = elapsed
    let steps = 0
    while (remaining > 1e-6 && steps < MAX_STEPS) {
      const dt = Math.min(STEP, remaining)
      step(dt)
      remaining -= dt
      steps++
    }

    draw()

    frames++
    if (now - tallyAt >= 1000) {
      fps = (frames * 1000) / (now - tallyAt)
      frames = 0
      tallyAt = now
    }
  }

  const onResize = () => {
    resize()
    draw()
  }

  resize()

  const still = window.matchMedia("(prefers-reduced-motion: reduce)")

  return {
    start() {
      if (running) return
      window.addEventListener("resize", onResize)
      if (still.matches) {
        // A picture of the instant the jets were switched on is not a picture of
        // this piece, so the still is of water that has been going a while —
        // and its last frames are drawn rather than stepped past, so a scene
        // with a wake keeps it.
        const drawn = settings.trail > 0 ? WAKE_FRAMES * STEP : 0
        for (let t = 0; t < STILL_SECONDS - drawn; t += STEP) step(STEP)
        for (let t = 0; t < drawn; t += STEP) {
          step(STEP)
          draw()
        }
        draw()
        return
      }
      running = true
      last = 0
      tallyAt = performance.now()
      frame = requestAnimationFrame(tick)
    },

    stop() {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", onResize)
    },

    setPaused(next) {
      held = next
    },

    setSettings(nextSettings) {
      const before = settings
      settings = nextSettings
      if (needsPool(before, nextSettings)) resetPool(nextSettings.count)
      if (
        before.jets !== nextSettings.jets ||
        before.layout !== nextSettings.layout ||
        before.spin !== nextSettings.spin ||
        before.spread !== nextSettings.spread ||
        before.seed !== nextSettings.seed
      ) {
        jets = placeJets(nextSettings)
        owed = new Float64Array(Math.max(8, nextSettings.jets))
      }
      if (before.seed !== nextSettings.seed) rng = makeRng(hashSeed(nextSettings.seed, 0x51ed))
      if (before.span !== nextSettings.span) resize()
      if (before.gas !== nextSettings.gas) owed.fill(0)
      if (held || !running) draw()
    },

    settle(seconds) {
      const bounded = Math.max(0, Math.min(600, seconds))
      // The tail is drawn frame by frame rather than stepped past, so a scene
      // with a wake arrives with its wake. See `WAKE_FRAMES`.
      const drawn = settings.trail > 0 ? Math.min(bounded, WAKE_FRAMES * STEP) : 0
      for (let t = 0; t < bounded - drawn; t += STEP) step(STEP)
      for (let t = 0; t < drawn; t += STEP) {
        step(STEP)
        draw()
      }
      draw()
    },

    clear() {
      resetPool(settings.count)
      made = 0
      merges = 0
      pops = 0
      torn = 0
      overlapSum = 0
      overlapCount = 0
      slipSum = 0
      slipCount = 0
      shoveSum = 0
      shoveSeconds = 0
      clock = 0
      draw()
    },

    stats: () => {
      let biggest = 0
      let total = 0
      let pace = 0
      for (let i = 0; i < capacity; i++) {
        if (live[i] === 0) continue
        total += radius[i]!
        pace += Math.hypot(vx[i]!, vy[i]!)
        if (radius[i]! > biggest) biggest = radius[i]!
      }
      // Inside a boil, or outside it, in one pass over the live bubbles.
      const boil = boilRadius()
      let inside = 0
      let insideCount = 0
      let outside = 0
      let outsideCount = 0
      for (let i = 0; i < capacity; i++) {
        if (live[i] === 0) continue
        let nearest = Infinity
        for (const jet of jets) {
          const d = Math.hypot(px[i]! - jet.x, py[i]! - jet.y)
          if (d < nearest) nearest = d
        }
        if (nearest <= boil) {
          inside += radius[i]!
          insideCount++
        } else {
          outside += radius[i]!
          outsideCount++
        }
      }
      const insideMean = insideCount > 0 ? inside / insideCount : 0
      const outsideMean = outsideCount > 0 ? outside / outsideCount : 0

      return {
        alive,
        biggest: Number((biggest * 1000).toFixed(2)),
        bigOut: Number((insideMean > 0 ? outsideMean / insideMean : 0).toFixed(3)),
        mean: Number(((alive > 0 ? total / alive : 0) * 1000).toFixed(2)),
        speed: Number(((alive > 0 ? pace / alive : 0) * 1000).toFixed(1)),
        ring: Number((ringRadius() * 1000).toFixed(0)),
        shove: Number((shoveSeconds > 0 && alive > 0 ? (shoveSum / shoveSeconds / alive) * 1000 : 0).toFixed(1)),
        overlap: Number((overlapCount > 0 ? (overlapSum / overlapCount) * 100 : 0).toFixed(1)),
        slip: Number((slipCount > 0 ? (slipSum / slipCount) * 1000 : 0).toFixed(1)),
        made,
        merges,
        pops,
        torn,
        fps: Number(fps.toFixed(1)),
      }
    },
  }
}
