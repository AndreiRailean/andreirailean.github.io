/**
 * Who is out there, what they are doing, and where they go next.
 *
 * `steering.ts` says why nobody walks through anybody; this says why they are
 * walking at all. Three layers, and they are separate on purpose:
 *
 * - **A group has an errand.** Cross the frame, visit a spot and sit in it, or
 *   already be sitting in it when you arrive. The errand is the group's, not the
 *   person's, which is what keeps a family together without anyone being told to
 *   follow anyone.
 * - **A person has a place in the group.** Pairs and threes walk abreast; four
 *   and up bend into a shallow arc with the middle lagging, because that is the
 *   shape in which everyone can see everyone else's face. Both flatten when it
 *   gets crowded — a group that will not narrow cannot get through a gap, and
 *   real ones narrow.
 * - **A child has their own ideas.** Play overrides the slot: darting off and
 *   being called back, chasing another child until they are caught, jumping,
 *   crouching over something, falling over. The leash is what makes it read as a
 *   family rather than as one crowd that happens to contain children.
 *
 * ## Everything is a bounded excursion from somewhere
 *
 * The one structural decision worth stating. Every behaviour here is "leave the
 * thing you are attached to, do something, come back" — a child from its parent,
 * a glance from the direction of travel, a group from its formation to get round
 * an obstacle. Nothing wanders freely, because free wandering at these
 * timescales reads as drift rather than as intent, and nothing is rigid, because
 * rigid reads as machinery. The section calls the target *organic change*; this
 * is the shape it takes when the units are people.
 */

import { cadence, gaitOffset, makeBody, posturalSway, rngFor, type Body } from "@/experiments/walkers/body"
import { clearGrid, createGrid, forNear, insert, type Grid } from "@/experiments/walkers/grid"
import { skinOf, tonesFor, type Tones } from "@/experiments/walkers/palette"
import type { Flow, Settings } from "@/experiments/walkers/settings"
import {
  avoidance,
  overlapOf,
  passingBias,
  personalSpace,
  seek,
  SIDE_PREFERENCE,
  timeToCollision,
  weightBehind,
  type Disc,
  type Force,
} from "@/experiments/walkers/steering"
import type { View } from "@/experiments/walkers/view"
import { makeRng, type Rng } from "@/experiments/random"

const TAU = Math.PI * 2

/** Standard gravity, for the jumps. */
const G = 9.81

/** Seconds to reach most of the way to a wanted velocity. */
const RELAXATION = 0.5

/** How far a group's members try to stay apart, shoulder to shoulder, in metres. */
const ABREAST = 0.78

/** How far a child may get from their adult before being called back, in metres. */
const LEASH = 3.4

/**
 * How far anyone looks for somebody to avoid, in metres, and the grid cell that
 * search is bucketed into.
 *
 * The cell is **exactly half the reach**, and that is not a rounding. `forNear`
 * visits a square of `ceil(reach / cell)` cells either way, so a cell of 2.2
 * against a reach of 4.5 needs three — a 7×7 block covering 237 m² to answer a
 * question about 64. At half the reach it is 2, a 5×5 block covering 126, and
 * the piece visits half as many candidates for exactly the same answer. It was
 * the cheapest frame in the file to find and worth about 40 per cent of the
 * simulation at festival density.
 */
const REACH = 4.5
const CELL = REACH / 2

/** Radians per second a head can comfortably turn. */
const NECK_RATE = 4.5

/** Radians. Past this the body turns instead of the head. */
const NECK_LIMIT = 1.15

/**
 * How far a person's pace wanders around the speed they prefer, and how slowly.
 *
 * Measured intra-individual speed variability over a single walk runs at a
 * coefficient of variation of five to ten per cent; two out-of-phase sines at
 * this amplitude give about eight. The periods are tens of seconds and
 * irrationally related, so nobody's pace ever repeats and no two people's agree.
 *
 * It is the cheapest of the three things in this file that break the glide, and
 * on its own it is not enough — a crowd all drifting gently is still a crowd all
 * doing the same thing. The other two are `Urge` and yielding.
 */
const PACE_DRIFT = 0.12

/** How much of their pace a dawdling group keeps, and a hurrying one adds. */
const DAWDLE = 0.42
const HURRY = 1.45

/**
 * Seconds of imminent collision below which somebody might stop and let the
 * other person go, rather than steering around them.
 *
 * Steering is what the avoidance already does, and it is most of what people do.
 * But not all: at very short notice, and where the other person is crossing
 * rather than coming head-on, the human answer is often to stop dead for a
 * second. It is the most legible single behaviour in the piece from directly
 * above — everything else is a gradual change of course, and this is a full
 * stop.
 */
const YIELD_HORIZON = 0.9

/** Rate per second of deciding to yield while an imminent crossing lasts. */
const MAY_YIELD = 1.4

/**
 * How far a group's heading wanders off the line to its goal, in radians, and
 * how often it changes its mind about the goal entirely — both by `flow`.
 *
 * A walker who holds one bearing for their whole visit reads as being *on a
 * mission*, and a whole crowd doing it reads as traffic however well they avoid
 * each other. Real paths curve, and real people turn round.
 *
 * Scaled by `flow` because that setting already means exactly this: `through`
 * *is* a crowd on a mission — people crossing a concourse do walk in straight
 * lines, and blurring that would cost the setting its point. `wander` is
 * somebody with an afternoon.
 *
 * Two separate things, because they read differently. The meander is a gentle
 * curve nobody would name; the change of mind is a decision you can watch
 * somebody make.
 */
const MEANDER: Record<Flow, number> = { through: 0.07, wander: 0.5, gather: 0.28 }

/**
 * Roughly how long somebody who stops stays, in seconds — the mean of the two
 * ranges the dwell timers draw from. Used only to convert `settling` from a
 * fraction of the crowd into a fraction of arrivals; see `stoppingChance`.
 */
const MEAN_DWELL = 120

/** Rate per second at which a crossing group reconsiders where it is going. */
const RECONSIDER: Record<Flow, number> = { through: 0.002, wander: 0.03, gather: 0.02 }

/** And how often that change of mind is "actually, let us stop here". */
const STOPS_INSTEAD = 0.4

/** Seconds the in-frame count is averaged over before the loop reads it. */
const SMOOTHING_SECONDS = 6

/**
 * Seconds ahead the population controller looks when counting who is on their
 * way in — derived from the margin rather than fixed.
 *
 * It has to be a little longer than the walk in from the edge of the world, and
 * how long that walk is depends entirely on the span: at a wide view the margin
 * is a few seconds of the frame, and at a narrow one it is four times the frame
 * itself. A fixed twenty-five seconds is right for the first and hopeless for
 * the second — it credits everybody in a margin that big at nearly full weight,
 * the loop concludes the frame is full, and the picture holds three people
 * against a target of fourteen.
 */
const arrivalHorizon = (margin: number) => Math.max(4, Math.min(25, margin / 1.2))

/**
 * How much faster than the steady state the frame is allowed to fill.
 *
 * The arrival rate that holds N people in shot is N over how long each one
 * stays — Little's law, and `maintain` works it out from the frame and the
 * crowd's own measured pace rather than guessing. This is the headroom on top,
 * so an empty frame recovers rather than merely holding.
 *
 * It cannot be large. Every arrival is ordered several seconds before it can be
 * seen, so the rate times that delay is the overshoot, and a rate far above the
 * steady state turns the on/off gate into a limit cycle: order flat out, arrive
 * all at once, drain, repeat. Both failures have been measured here — a cap
 * *below* the steady state left the frame at three people against a target of
 * fourteen with the loop running flat out for ever, and a cap at five times it
 * put the crossing scene 58 per cent over and swinging.
 */
const FILL_HEADROOM = 1.6

/** A floor, so a nearly empty frame does not crawl. */
const MAX_ARRIVALS = 2

/** Metres of clear ground an arrival needs between them and anybody else. */
const SPAWN_CLEARANCE = 0.6

export type Activity =
  "walking" | "running" | "standing" | "sitting" | "crouching" | "chasing" | "fleeing" | "darting" | "fallen"

export type Errand = "cross" | "visit" | "resident"

export type Walker = {
  id: number
  group: Group
  body: Body
  /** Ground position, metres, origin at the centre of the frame, y up. */
  x: number
  y: number
  vx: number
  vy: number
  /** Height of the head above where the current posture would put it. Jumps. */
  hop: number
  hopRate: number
  /** Where the posture puts the head, eased so standing up takes a moment. */
  posture: number
  /** Gait phase in [0, 1); one turn is two steps. */
  stride: number
  /** Which way the shoulders point, radians. */
  facing: number
  /** Which way the head points, radians, absolute. */
  yaw: number
  yawWanted: number
  /** Up is positive. The face comes into view as this rises. */
  pitch: number
  pitchWanted: number
  /** Who they are looking at, and until when. */
  looking: Walker | null
  lookUntil: number
  /** Personal phase, so two people standing side by side do not sway together. */
  phase: number
  /** +1 for somebody who gives way to their right, −1 to their left. */
  handed: number
  /**
   * Whether this is somebody out for a run, which is a fact about them rather
   * than about how fast they happen to be going.
   *
   * Held separately from `activity` because the two answer different questions,
   * and conflating them cost the piece its runners entirely. `activity` was
   * being promoted and demoted from the current speed — running above 1.45 of
   * preferred, walking below 1.1 — and since everybody spawns at rest, every
   * runner in the crowd was demoted to a walker on their first frame and never
   * given the run speed that would have promoted them back. `runners` read zero
   * at every setting of the slider.
   */
  runs: boolean
  activity: Activity
  until: number
  /** Where this person in particular is going, which is usually their slot. */
  slot: number
  skin: { hue: number; lightness: number; saturation: number }
  tones: Tones
  /** Who they are chasing, in a game of tag. */
  quarry: Walker | null
  /**
   * Stopped dead until this time, to let somebody cross in front of them.
   *
   * Individual rather than the group's, and brief. See `MAY_YIELD`.
   */
  yieldUntil: number
  /** Metres per second, cached for the gait and the stats. */
  speed: number
  /**
   * False once they have left and been culled.
   *
   * A flag rather than an `includes` on the population. Two places hold a
   * reference to another walker — who somebody is chasing, and who they are
   * looking at — and both have to know whether that person is still here. Asking
   * the array was a linear scan **per walker per frame**: at fourteen hundred
   * walkers that is two million comparisons a frame for a boolean, and it was
   * most of what the piece was doing at the top of the density slider.
   */
  present: boolean
  rng: Rng
}

export type Group = {
  id: number
  members: Walker[]
  errand: Errand
  /** Where the group is headed on the ground, metres. */
  goalX: number
  goalY: number
  /** Where it leaves by, once it is done. */
  exitX: number
  exitY: number
  /** The adult walking pace the group has settled on: the slowest member's. */
  pace: number
  state: "arriving" | "dwelling" | "leaving"
  until: number
  /** Whether the dwelling is on the ground or on their feet. */
  sits: boolean
  /** Who is talking, as an index into `members`, and until when. */
  talker: number
  talkUntil: number
  hue: number
  team: number
  /**
   * What the group has decided about its pace just now, and until when.
   *
   * A **group's** property rather than a person's, because that is how it works:
   * people stop to look at something together and hurry to catch a train
   * together. One member dawdling while the others walk on is not a crowd
   * behaviour, it is a formation bug — the slot force would drag them along
   * anyway and the result reads as a rubber band.
   */
  urge: Urge
  urgeUntil: number
  /** Whether this hurry is a run rather than a brisk walk. */
  sprinting: boolean
}

/**
 * What somebody has decided about their own pace.
 *
 * The gap this fills is the one thing that gives the whole piece away at a
 * distance: a walker drew a preferred speed when they arrived and held it
 * exactly, for ever. Real people are never doing that. They drift, they dawdle
 * at something worth looking at, they decide they are late — and at small sizes
 * a field of dots each gliding at its own fixed rate does not read as people at
 * all, it reads as something swimming.
 */
export type Urge = "steady" | "dawdle" | "hurry"

export type CrowdStats = {
  walkers: number
  /**
   * How many of them are actually in the picture.
   *
   * The world is wider than the frame — people arrive from off screen and leave
   * the same way — so `walkers` counts a good many nobody can see. This is what
   * `density` is quoted against, and getting the two the wrong way round is why
   * the first version's frames looked half as busy as the number said: at a
   * small span the margin is most of the world, and the target was being met
   * almost entirely by people walking about outside the shot.
   */
  inFrame: number
  groups: number
  children: number
  sitting: number
  /** How many are running rather than walking. */
  runners: number
  /** How many have stopped dead to let somebody cross in front of them. */
  yielding: number
  /** How many are dawdling or hurrying rather than walking at their own pace. */
  unsteady: number
  playing: number
  /** Mean ground speed, m/s. Falls as the crowd thickens, which is the point. */
  meanSpeed: number
  /** Deepest two bodies have been pushed into each other this frame, metres. */
  overlap: number
  /** How many pairs are touching at all. */
  contacts: number
  /**
   * How far the crowd has sorted itself into files, from 0 to about 1.
   *
   * Nothing in the piece knows what a lane is, so the claim that lanes form has
   * to be measured rather than asserted. This is the mean cosine between the
   * headings of people within a metre and a half of each other, **minus** the
   * same quantity over the crowd as a whole.
   *
   * The subtraction is the whole measurement. Raw local alignment is near 1 for
   * any crowd that happens to be going one way, which says nothing at all — a
   * first attempt at this scored a *wandering* crowd higher than a head-on
   * counterflow for exactly that reason, and would have been read as evidence
   * against the thing that was actually happening. What matters is whether
   * somebody's neighbours agree with them *more than the room does*, and that is
   * the definition of a lane.
   */
  sorting: number
}

export type Crowd = {
  walkers: Walker[]
  groups: Group[]
  /** Things to walk around. Empty for now; the steering already handles them. */
  obstacles: Disc[]
  step: (dt: number) => void
  /** Bring the crowd up to the population the view and density ask for. */
  fill: () => void
  remeasure: (view: View, settings: Settings) => void
  recolour: (settings: Settings) => void
  stats: () => CrowdStats
  clock: number
}

type Options = {
  view: View
  settings: Settings
}

export function createCrowd({ view: initialView, settings: initialSettings }: Options): Crowd {
  let view = initialView
  let settings = initialSettings

  /**
   * One stream for the whole crowd rather than a generator per person.
   *
   * The other pieces in the section index their randomness so unit seven is the
   * same unit however many others exist. That argument does not reach here:
   * nobody persists, the population turns over continuously, and there is no
   * "walker seven" to keep stable. What the seed buys instead is that the same
   * seed run for the same length of time gives the same afternoon, which is what
   * the poster needs and all anyone asked of it.
   */
  let stream: Rng = makeRng(initialSettings.seed | 0)

  const walkers: Walker[] = []
  const groups: Group[] = []
  const obstacles: Disc[] = []

  let clock = 0
  let nextId = 1
  let grid: Grid = createGrid(-1, -1, 1, 1, 2)

  let overlapPeak = 0
  let contactCount = 0
  /** Fractional people the population controller has promised but not spawned. */
  let owed = 0
  /** The smoothed count of who is in shot or about to be, which the loop reads. */
  let inFrameAverage = 0
  /** The crowd's own mean walking pace, measured rather than assumed. */
  let paceSeen = 1.3

  // Reused so a frame of steering allocates nothing.
  const force: Force = { x: 0, y: 0 }
  const push: Force = { x: 0, y: 0 }
  const self: Disc = { x: 0, y: 0, vx: 0, vy: 0, r: 0 }
  const other: Disc = { x: 0, y: 0, vx: 0, vy: 0, r: 0 }

  const target = () => Math.round((settings.density / 100) * view.area)

  /** How many are inside the picture, which is what the target is about. */
  function countInFrame(): number {
    let count = 0
    for (const walker of walkers) {
      if (Math.abs(walker.x) <= view.halfWidth && Math.abs(walker.y) <= view.halfHeight) count++
    }
    return count
  }

  /** Half the frame plus the margin: where people come from and go to. */
  const outerX = () => view.halfWidth + view.margin
  const outerY = () => view.halfHeight + view.margin

  // ── Arrivals ────────────────────────────────────────────────────────────

  /**
   * A point off one edge, and the way in from it.
   *
   * The four edges are not equally likely: the long ones get more of the traffic
   * in proportion to their length, which is what stops a wide window looking
   * like everyone is coming out of the two short sides.
   *
   * `beyond` is how far past the edge the point sits, and it is the difference
   * between an entrance and an exit. **An exit has to be outside the cull line,
   * not on it.** Putting one on the edge is the obvious thing and it is a trap
   * the whole piece falls through: a group walks to its exit, arrives, and — the
   * goal being reached — stops. They pile up in a stationary ring just off
   * screen, the cull never fires because nobody crosses it, and the population
   * target is met entirely by people standing outside the frame. The symptoms
   * were an empty picture, a mean speed of 2 cm/s, and a crush thirty
   * centimetres deep in the pile that the contact solver could not clear because
   * every one of them was still being pushed into it by their own goal.
   */
  function edgePoint(edge: number, beyond = 0): { x: number; y: number } {
    const x = outerX() + beyond
    const y = outerY() + beyond
    switch (edge) {
      case 0:
        return { x: -x, y: (stream() * 2 - 1) * view.halfHeight }
      case 1:
        return { x, y: (stream() * 2 - 1) * view.halfHeight }
      case 2:
        return { x: (stream() * 2 - 1) * view.halfWidth, y: y }
      default:
        return { x: (stream() * 2 - 1) * view.halfWidth, y: -y }
    }
  }

  /** Far enough past the edge that walking to it means walking out of the world. */
  const AWAY = 14

  /** And far enough that "toward it" is a heading rather than a destination. */
  const FAR = 200

  /**
   * Straight over: a *direction*, not a destination.
   *
   * `through` means two opposing streams, and how the goal is expressed decides
   * whether they can sort themselves out. Two versions were wrong in opposite
   * ways and the second is the more instructive:
   *
   * - Aiming at a **random point** on the far edge made every path its own
   *   angle. Two streams, yes, but not parallel ones, and files cannot form out
   *   of trajectories that cross each other at every angle.
   * - Aiming at the **same lateral position** on the far edge made them parallel
   *   and pinned every walker to the line they came in on. Sorting measured
   *   *worse* the longer it ran — 0.21 falling to 0.01 — because a person who
   *   cannot drift sideways cannot join a file. The correction that keeps the
   *   streams tidy is the same correction that forbids the effect.
   *
   * So the goal is put two hundred metres away. The direction is then all but
   * exactly across the frame wherever somebody happens to be standing, the
   * lateral pull is a hundredth of what it was, and a walker who finds a gap
   * going their way is free to move into it and stay there.
   */
  function straightAcross(entryEdge: number, entry: { x: number; y: number }): { x: number; y: number } {
    if (entryEdge <= 1) {
      return { x: (entryEdge === 0 ? 1 : -1) * (outerX() + FAR), y: entry.y }
    }
    return { x: entry.x, y: (entryEdge === 2 ? -1 : 1) * (outerY() + FAR) }
  }

  function pickEdge(): number {
    const long = view.halfWidth >= view.halfHeight
    // Weight by edge length. The two long sides share `weight` of the traffic.
    const ratio = long
      ? view.halfWidth / (view.halfWidth + view.halfHeight)
      : view.halfHeight / (view.halfWidth + view.halfHeight)
    const horizontal = stream() > ratio
    return horizontal ? (stream() < 0.5 ? 0 : 1) : stream() < 0.5 ? 2 : 3
  }

  /** A spot inside the frame worth going to, kept off the very edge. */
  function spotInside(): { x: number; y: number } {
    return {
      x: (stream() * 2 - 1) * view.halfWidth * 0.72,
      y: (stream() * 2 - 1) * view.halfHeight * 0.72,
    }
  }

  /**
   * Anywhere in the world, margin included — which is where the opening cast
   * goes.
   *
   * **Not `spotInside`.** That insets by 28 per cent, which is right for a spot
   * somebody has *chosen* to stand in — nobody picnics pressed against the edge
   * of the frame — and quite wrong for scattering an opening crowd, because it
   * lays them out in a rectangle in the middle of the screen with a quarter of
   * the picture visibly empty around it. With traces on it is worse than
   * visible: the first thing the ground remembers is the shape of the spawner,
   * and it takes the best part of a minute to fade.
   *
   * The margin is included for the same reason. A crowd that starts exactly at
   * the frame's edge has an edge; one that starts across the whole world does
   * not, and the people out of shot walk in as the ones in shot walk out.
   */
  function spotAnywhere(): { x: number; y: number } {
    return {
      x: (stream() * 2 - 1) * (view.halfWidth + view.margin * 0.9),
      y: (stream() * 2 - 1) * (view.halfHeight + view.margin * 0.9),
    }
  }

  /**
   * A spot to settle on that somebody else has not already settled on.
   *
   * Two groups given nearby spots do not sort it out between them: each is
   * holding a formation around its own centre, so they push into each other and
   * keep pushing, and the contact solver spends every frame prising apart a
   * crush that both sides are actively maintaining. It measured as ten
   * centimetres of standing interpenetration in the park scene — not a collision
   * but a permanent one, which is worse.
   *
   * Eight tries and then whatever came up: a frame with nowhere free is a frame
   * where the density slider has been turned past what the ground holds, and
   * refusing to place anybody at all would empty it instead.
   */
  function freeSpot(size: number): { x: number; y: number } {
    const clearance = 2.4 + size * 0.45
    let best = spotInside()
    let bestGap = -Infinity

    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = attempt === 0 ? best : spotInside()
      let nearest = Infinity
      for (const other of groups) {
        if (other.errand === "cross") continue
        nearest = Math.min(nearest, Math.hypot(other.goalX - candidate.x, other.goalY - candidate.y))
      }
      if (nearest > bestGap) {
        best = candidate
        bestGap = nearest
      }
      if (nearest >= clearance) break
    }

    return best
  }

  /**
   * How big a group is.
   *
   * The distribution is the observed one: most people are alone or in twos, and
   * the tail past four is thin. `grouping` scales how much of the crowd is in
   * company at all rather than reshaping the tail, because the tail is a fact
   * about people and the amount of company is a fact about the place.
   */
  function groupSize(): number {
    if (stream() > settings.grouping) return 1
    const draw = stream()
    if (draw < 0.52) return 2
    if (draw < 0.79) return 3
    if (draw < 0.93) return 4
    return 5
  }

  function makeGroup(errand: Errand): Group {
    return {
      id: nextId++,
      members: [],
      errand,
      goalX: 0,
      goalY: 0,
      exitX: 0,
      exitY: 0,
      pace: 1.3,
      state: errand === "resident" ? "dwelling" : "arriving",
      until: 0,
      sits: false,
      talker: 0,
      talkUntil: 0,
      // Filled in by the caller, which is where the group's colour is drawn so
      // that `kin` can hand the one hue to every member.
      hue: 0,
      team: stream() < 0.5 ? -1 : 1,
      urge: "steady",
      urgeUntil: 0,
      sprinting: false,
    }
  }

  /**
   * The chance an arrival is somebody who stops, rather than somebody crossing.
   *
   * **Not `settling` itself**, and the difference is a factor of six. `settling`
   * promises "the fraction who stop somewhere in frame rather than crossing it",
   * which anybody reading it takes to be a fraction of the crowd they can see —
   * but applied to *arrivals* it is not, because the people who stop stay far
   * longer than the people who cross. A dweller sits for two minutes and a
   * crosser is gone in twenty seconds, so at a setting of 0.3 three quarters of
   * everybody in shot was stationary. The park looked asleep and the number
   * looked right.
   *
   * Little's law both ways round: to hold a fraction `f` of the *population*
   * stationary when they stay `r` times as long, the arrivals have to be
   * `f / (f + r(1 − f))`. At 0.3 with r ≈ 6 that is 7 per cent of arrivals — and
   * 30 per cent of the crowd, which is what the control says.
   */
  function stoppingChance(): number {
    const wanted = settings.settling
    if (wanted <= 0) return 0
    if (wanted >= 1) return 1

    // A crossing is about the frame's own size at whatever pace the band gives.
    const pace = Math.max(0.4, (settings.paceLow + settings.paceHigh) / 2)
    const crossing = Math.max(4, (view.halfWidth + view.halfHeight) / pace)
    const ratio = Math.max(1, MEAN_DWELL / crossing)

    return wanted / (wanted + ratio * (1 - wanted))
  }

  function spawnGroup(placeInside: boolean): void {
    const size = groupSize()
    const stops = stream() < stoppingChance()
    const errand: Errand = placeInside ? (stops ? "resident" : "cross") : stops ? "visit" : "cross"

    const group = makeGroup(errand)
    const skinRng = rngFor(settings.seed, group.id)
    group.hue = (settings.hue + 160 + (skinRng() * 2 - 1) * settings.spread * 1.6) % 360

    const entryEdge = pickEdge()
    const entry = placeInside ? spotAnywhere() : edgePoint(entryEdge)

    // Where they are going, which depends on what the crowd is for.
    if (errand === "cross") {
      const exit =
        settings.flow === "through"
          ? straightAcross(entryEdge, entry)
          : edgePoint((entryEdge + 1 + Math.floor(stream() * 3)) % 4, AWAY)
      group.goalX = exit.x
      group.goalY = exit.y
      group.exitX = exit.x
      group.exitY = exit.y
    } else {
      const spot = freeSpot(size)
      group.goalX = spot.x
      group.goalY = spot.y
      const exit = edgePoint(pickEdge(), AWAY)
      group.exitX = exit.x
      group.exitY = exit.y
      // Whether they sit is decided below, once it is known whether there are
      // children with them.
      group.until = clock
    }

    // The group's pace is the slowest member's, so it is drawn before the
    // members and then lowered by whoever cannot keep up.
    const adultPace = settings.paceLow + Math.abs(gaussLike()) * (settings.paceHigh - settings.paceLow)
    group.pace = Math.min(settings.paceHigh, Math.max(settings.paceLow, adultPace))

    const runs = stream() < settings.runners
    // Children come with adults far more often than alone, and a lone child in
    // an otherwise adult crowd reads as a mistake rather than as a child.
    const childCount =
      size === 1 ? (stream() < settings.children * 0.35 ? 1 : 0) : Math.min(size - 1, countChildren(size))

    const arriving: Walker[] = []
    for (let index = 0; index < size; index++) {
      const child = index >= size - childCount
      const walker = makeWalker(group, child ? "child" : "adult", group.pace, index)
      walker.runs = runs && !child
      walker.activity = walker.runs ? "running" : "walking"
      arriving.push(walker)
      // The group goes at the pace of whoever is slowest, which is nearly always
      // the smallest child. Written as the *member's own* preferred speed: the
      // first version divided it back out by the Froude scaling it had just been
      // multiplied by, which is the identity, so the line did nothing at all and
      // families walked at adult pace with the children permanently trailing.
      group.pace = Math.min(group.pace, walker.body.preferredSpeed)
    }

    // A group with children stands far more often than it sits: somebody has to
    // be watching, and a playground full of seated adults is a picnic. Decided
    // here rather than with the rest of the errand because it needs to know
    // whether there are any children in the group, which is decided above.
    if (errand !== "cross") {
      group.sits = stream() < (childCount > 0 ? 0.22 : 0.62)
      // Long enough that a picnic is a picnic. A stand is a couple of minutes.
      group.until = clock + (group.sits ? 90 + stream() * 240 : 25 + stream() * 90)
    }

    /**
     * Lay the group out around a point, fanned *across* the way they are going.
     *
     * Fanning along x regardless of heading put every group entering from the
     * side into a single file pointing at its own destination, and they spent
     * the first few metres sorting themselves out sideways in full view.
     */
    const layOut = (spot: { x: number; y: number }) => {
      const spanX = group.goalX - spot.x
      const spanY = group.goalY - spot.y
      const length = Math.hypot(spanX, spanY) || 1
      const aheadX = spanX / length
      const aheadY = spanY / length

      for (let index = 0; index < size; index++) {
        const walker = arriving[index]!
        const lateral = (index - (size - 1) / 2) * ABREAST * 0.9
        walker.x = spot.x - aheadY * lateral + (stream() - 0.5) * 0.3
        walker.y = spot.y + aheadX * lateral + (stream() - 0.5) * 0.3
      }
    }

    // **Nobody materialises inside anybody.** A spawn point is chosen at random,
    // and at any density worth looking at some of those land on top of somebody
    // already standing there — which the contact solver then has to dig apart
    // over several frames, and which reads exactly like two people walking
    // through each other, because that is what it is.
    //
    // Several tries rather than one. At half a person per square metre a random
    // point is already more likely than not to be within arm's reach of
    // somebody, and a pair needs *both* places free — so a single attempt
    // succeeds about a tenth of the time, and the frame stops filling long
    // before the ground is full. That is not the ground refusing them; it is the
    // spawner giving up.
    // A resident is already at their spot, so they are laid out in the ring they
    // will be standing in rather than in a walking formation — and the clearance
    // check below then covers the positions they will actually occupy.
    if (errand === "resident") {
      group.state = "dwelling"
      group.until = clock + (group.sits ? 60 + stream() * 260 : 20 + stream() * 100)
      group.goalX = entry.x
      group.goalY = entry.y
      group.members.push(...arriving)
    }

    let placed = false
    let where = entry
    for (let attempt = 0; attempt < 6 && !placed; attempt++) {
      where = attempt === 0 ? entry : placeInside ? spotAnywhere() : edgePoint(entryEdge)
      if (errand === "resident") arrangeRing(group, where)
      else layOut(where)
      placed = arriving.every(isClear)
    }

    if (!placed) {
      group.members.length = 0
      for (const walker of arriving) walker.present = false
      return
    }

    if (errand === "resident") {
      group.goalX = where.x
      group.goalY = where.y
      poseGroup(group)
    } else {
      for (const walker of arriving) group.members.push(walker)
    }

    for (const walker of arriving) walkers.push(walker)

    // Head start: somebody arriving already knows which way they are facing,
    // and is **already walking**. Spawning at rest costs a second of everybody
    // standing still while the relaxation gets them going — which is a second of
    // the avoidance solving a problem that does not exist, and, with traces on,
    // a blob deposited at every spawn point before anybody moves.
    for (const walker of group.members) {
      const dx = group.goalX - walker.x
      const dy = group.goalY - walker.y
      const distance = Math.hypot(dx, dy) || 1
      walker.facing = Math.atan2(dy, dx)
      walker.yaw = walker.facing
      walker.yawWanted = walker.facing

      if (walker.activity === "walking" || walker.activity === "running") {
        const speed = walker.activity === "running" ? walker.body.runSpeed : walker.body.preferredSpeed
        walker.vx = (dx / distance) * speed
        walker.vy = (dy / distance) * speed
        walker.speed = speed
      }
    }

    groups.push(group)
  }

  /**
   * Whether a spawning walker has room to exist where they are being put.
   *
   * The clearance is over half a metre rather than the width of a hand, because
   * an arrival is **already walking** — at up to three metres a second, and
   * possibly straight at somebody. A gap that is merely clear is closed inside a
   * tenth of a second, before the avoidance has had a frame to notice, and the
   * contact solver spends the next few prising apart a collision that was dealt
   * at the moment of arrival.
   */
  function isClear(walker: Walker): boolean {
    for (const other of walkers) {
      const gap = Math.hypot(other.x - walker.x, other.y - walker.y) - other.body.radius - walker.body.radius
      if (gap < SPAWN_CLEARANCE) return false
    }
    return true
  }

  /**
   * How many of a group are children.
   *
   * Drawn per member at the stated fraction, and then capped at one short of the
   * group's size by the caller — somebody has to be the adult. The cap is why
   * this used to be inflated by a factor of 1.4, on the reasoning that the cap
   * and the rarity of lone children would eat the difference. It over-corrected:
   * a setting of 30 per cent produced crowds that were half children.
   */
  function countChildren(size: number): number {
    let count = 0
    for (let index = 0; index < size; index++) if (stream() < settings.children) count++
    return count
  }

  /** A rough normal draw off the shared stream, for anything that wants a bell. */
  function gaussLike(): number {
    return (stream() + stream() + stream() - 1.5) / 1.5
  }

  function makeWalker(group: Group, age: "adult" | "child", pace: number, slot: number): Walker {
    const rng = rngFor(settings.seed, group.id, slot)
    const body = makeBody(rng, age, pace)
    const skin = skinOf(settings.palette, settings, rng, group.hue, group.team)

    return {
      id: nextId++,
      group,
      body,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hop: 0,
      hopRate: 0,
      posture: body.headHeightStanding,
      stride: rng(),
      facing: 0,
      yaw: 0,
      yawWanted: 0,
      pitch: 0,
      pitchWanted: 0,
      looking: null,
      lookUntil: 0,
      phase: rng() * TAU,
      // A convention with dissenters, which is what a real crowd is. All of one
      // hand sorts fastest and reads as drilled; half and half does not sort at
      // all.
      handed: rng() < 0.85 ? 1 : -1,
      runs: false,
      activity: "walking",
      until: 0,
      slot,
      skin,
      tones: tonesFor(settings, skin),
      quarry: null,
      yieldUntil: 0,
      speed: 0,
      present: true,
      rng,
    }
  }

  // ── The formation ───────────────────────────────────────────────────────

  /**
   * Where a member should be, relative to the group's centre.
   *
   * Abreast for two and three; for four and more the outer members come forward
   * so the arc opens toward where they are going, which is the shape that lets
   * everybody see everybody. The bend is small — a third of the lateral offset —
   * because a deep V reads as a formation rather than as friends.
   */
  function slotOffset(size: number, index: number, crowding: number): { lateral: number; forward: number } {
    // Floored at a pair of shoulders plus a hand's width. The narrowing under
    // crowding is real — a wide group cannot get through a gap — but it was
    // narrowing past the width of the people in it, so at high density every
    // group was steering itself into a permanent overlap that the contact
    // solver spent the rest of the frame undoing.
    const spacing = Math.max(0.56, ABREAST * (1 - 0.45 * crowding))
    const lateral = (index - (size - 1) / 2) * spacing
    const bend = size >= 4 ? 0.34 : size === 3 ? 0.16 : 0
    return { lateral, forward: bend * Math.abs(lateral) }
  }

  /**
   * The ring a dwelling group stands or sits in, so it can talk.
   *
   * **Positions only.** Split from `poseGroup` below because the arrangement has
   * to happen *before* the clearance check and the posing has to happen after:
   * the first version arranged the ring after the group had already been checked
   * and committed, which teleported every member out of the place that had been
   * checked and into a ring that had not. It put people inside strangers at up
   * to thirty centimetres — measured in three of the five presets, and the
   * deepest interpenetration the piece has ever recorded.
   */
  function ringRadius(group: Group): number {
    const size = group.members.length
    if (size <= 1) return 0
    return Math.max(0.62, (size * (group.sits ? 0.42 : 0.5)) / Math.PI + 0.35)
  }

  function arrangeRing(group: Group, spot: { x: number; y: number }): void {
    const size = group.members.length
    const radius = ringRadius(group)
    for (let index = 0; index < size; index++) {
      const walker = group.members[index]!
      const angle = (index / size) * TAU + group.id
      walker.x = spot.x + Math.cos(angle) * radius
      walker.y = spot.y + Math.sin(angle) * radius
    }
  }

  /** And then face inward, sit down, and stop moving. */
  function poseGroup(group: Group): void {
    for (const walker of group.members) {
      walker.vx = 0
      walker.vy = 0
      walker.facing = Math.atan2(group.goalY - walker.y, group.goalX - walker.x)
      walker.yaw = walker.facing
      walker.activity = group.sits ? "sitting" : "standing"
      walker.posture = group.sits ? walker.body.headHeightSitting : walker.body.headHeightStanding
    }
  }

  // ── Behaviour ───────────────────────────────────────────────────────────

  function updateGroup(group: Group, dt: number): void {
    const size = group.members.length
    if (size === 0) return

    let centreX = 0
    let centreY = 0
    for (const member of group.members) {
      centreX += member.x
      centreY += member.y
    }
    centreX /= size
    centreY /= size

    if (group.state === "arriving") {
      const reach = group.errand === "cross" ? 0.9 : 0.8 + size * 0.18
      if (Math.hypot(group.goalX - centreX, group.goalY - centreY) < reach) {
        if (group.errand === "cross") {
          // Nothing to do: they are on their way out and will be culled.
        } else {
          group.state = "dwelling"
          group.until = clock + (group.sits ? 70 + stream() * 220 : 20 + stream() * 90)
          for (const member of group.members) {
            // Adults settle; children mostly do not. A child who sits down the
            // moment their group arrives is a child who never plays, and at a
            // playground that emptied the whole point of the scene.
            if (member.body.age === "adult" || stream() < 0.25) {
              member.activity = group.sits ? "sitting" : "standing"
            }
          }
        }
      }
    } else if (group.state === "dwelling" && clock > group.until) {
      group.state = "leaving"
      group.goalX = group.exitX
      group.goalY = group.exitY
      for (const member of group.members) {
        if (member.activity === "sitting" || member.activity === "standing") member.activity = "walking"
      }
    }

    // Where they are going, which is not settled for the whole visit. A group
    // crossing the park can decide to leave by a different side, or to stop
    // here after all — which is the same decision anybody makes about an
    // afternoon, and the only thing in the piece that produces a deliberate
    // turn rather than a curve.
    if (group.errand === "cross" && group.state === "arriving") {
      if (stream() < 1 - Math.exp(-RECONSIDER[settings.flow] * dt)) {
        if (stream() < STOPS_INSTEAD * stoppingChance()) {
          const spot = freeSpot(size)
          group.errand = "visit"
          group.goalX = spot.x
          group.goalY = spot.y
          const away = edgePoint(pickEdge(), AWAY)
          group.exitX = away.x
          group.exitY = away.y
          group.sits = stream() < (group.members.some((m) => m.body.age === "child") ? 0.22 : 0.62)
        } else {
          const away = edgePoint(pickEdge(), AWAY)
          group.goalX = away.x
          group.goalY = away.y
          group.exitX = away.x
          group.exitY = away.y
        }
      }
    }

    // What the group has decided about its pace. Not every crowd dawdles: a
    // concourse of people going somewhere does far less of it than a park, and
    // `settling` is already the setting that says which this is, so it scales
    // the rates rather than a control of its own.
    if (clock > group.urgeUntil) {
      const appetite = 0.35 + settings.settling
      const draw = stream()

      if (group.urge !== "steady") {
        group.urge = "steady"
        group.sprinting = false
        group.urgeUntil = clock + 6 + stream() * 25
      } else if (draw < 0.3 * appetite) {
        // Something worth slowing down for. Short, and it happens often.
        group.urge = "dawdle"
        group.urgeUntil = clock + 2 + stream() * 7
      } else if (draw < 0.45 * appetite) {
        // Late, or catching somebody up. A third of the time it is a real run,
        // which is how somebody who was walking a moment ago starts running.
        group.urge = "hurry"
        group.sprinting = stream() < 0.35
        group.urgeUntil = clock + 4 + stream() * 12
      } else {
        group.urgeUntil = clock + 3 + stream() * 12
      }
    }

    // Who is talking. A group in company talks, and the turn passes round; the
    // listeners' heads follow it, which is most of what says these people are
    // together rather than merely adjacent.
    if (size > 1 && clock > group.talkUntil) {
      group.talker = Math.floor(stream() * size)
      group.talkUntil = clock + 1.6 + stream() * 5
    }
  }

  /**
   * A child's own agenda.
   *
   * Only reached when `play` is above zero, and every transition is scaled by
   * it, so the slider runs from a child who trails their parent to one who is
   * never in formation at all.
   */
  function updatePlay(walker: Walker): void {
    if (walker.body.age !== "child" || settings.play <= 0) return

    const group = walker.group
    const anchor = group.members.find((member) => member.body.age === "adult") ?? walker
    const away = Math.hypot(walker.x - anchor.x, walker.y - anchor.y)

    // The leash. Called back before they are out of sight, which is what an
    // adult actually does, and the adult looks at them while it happens.
    //
    // Every play state, not just the two that go somewhere on purpose. A
    // *fleeing* child runs for three to eight seconds at over 2 m/s and the
    // first version had no opinion about that at all: one was measured
    // twenty-one metres from its parent, which is not a game of tag, it is a
    // missing child.
    if (away > LEASH && walker.activity !== "sitting" && walker.activity !== "fallen") {
      walker.activity = "walking"
      walker.quarry = null
      walker.until = clock + 1
      if (anchor !== walker) {
        anchor.looking = walker
        anchor.lookUntil = clock + 1.2 + stream() * 1.5
      }
      return
    }

    if (clock < walker.until) return

    // Getting up takes as long as it takes; nothing else is decided until then.
    if (walker.activity === "fallen") {
      walker.activity = "standing"
      walker.until = clock + 0.4 + stream()
      return
    }

    const energy = settings.play
    const draw = stream()

    // A child in formation mostly stays in it. The rates below are per decision
    // point rather than per second, and decision points come every second or so.
    if (draw < 0.1 * energy) {
      const quarry = findPlaymate(walker)
      if (quarry) {
        walker.activity = "chasing"
        walker.quarry = quarry
        quarry.activity = "fleeing"
        quarry.quarry = walker
        quarry.until = clock + 3 + stream() * 5
        walker.until = clock + 3 + stream() * 5
        return
      }
    }
    if (draw < 0.2 * energy) {
      walker.activity = "darting"
      walker.until = clock + 1.2 + stream() * 2.2
      return
    }
    if (draw < 0.26 * energy) {
      walker.activity = "crouching"
      walker.until = clock + 1.5 + stream() * 3.5
      walker.vx = 0
      walker.vy = 0
      return
    }
    if (draw < 0.31 * energy && walker.hop <= 0.001) {
      // A child's standing jump clears fifteen to twenty-five centimetres.
      const height = 0.14 + stream() * 0.12
      walker.hopRate = Math.sqrt(2 * G * height)
      walker.until = clock + 0.6
      return
    }
    if (draw < 0.335 * energy && walker.speed > 0.9) {
      walker.activity = "fallen"
      walker.until = clock + 0.9 + stream() * 1.6
      walker.vx = 0
      walker.vy = 0
      return
    }

    if (walker.activity === "darting" || walker.activity === "crouching" || walker.activity === "fleeing") {
      walker.activity = "walking"
    }
    walker.until = clock + 0.7 + stream() * 1.4
  }

  function findPlaymate(walker: Walker): Walker | null {
    let best: Walker | null = null
    let bestDistance = 9
    for (const other of walkers) {
      if (other === walker || other.body.age !== "child") continue
      if (other.activity === "fallen" || other.activity === "sitting") continue
      const distance = Math.hypot(other.x - walker.x, other.y - walker.y)
      if (distance < bestDistance) {
        best = other
        bestDistance = distance
      }
    }
    return best
  }

  /**
   * What this person wants their velocity to be, before anyone is in the way.
   *
   * The group's errand comes in through the slot; play and tag override it; the
   * stationary activities want nothing at all, which is not the same as wanting
   * to stand still — a standing person still gets pushed out of the way and
   * still drifts back, and that difference is visible.
   */
  function wantedVelocity(walker: Walker, crowding: number, out: Force): void {
    const group = walker.group
    out.x = 0
    out.y = 0

    switch (walker.activity) {
      case "sitting":
      case "fallen":
        return
      case "crouching":
        return
      case "standing": {
        // Hold the spot they chose, loosely, so being shoved is temporary. The
        // ring is the same one `arrangeRing` laid out, radius and all — two
        // expressions for it drift, and the drift is people slowly pulling
        // themselves out of the arrangement they were placed in.
        const size = group.members.length
        const angle = (walker.slot / Math.max(1, size)) * TAU + group.id
        const radius = ringRadius(group)
        const homeX = group.goalX + Math.cos(angle) * radius
        const homeY = group.goalY + Math.sin(angle) * radius
        const dx = homeX - walker.x
        const dy = homeY - walker.y
        const distance = Math.hypot(dx, dy)
        if (distance > 0.25) {
          const speed = Math.min(0.6, distance * 0.8)
          out.x = (dx / distance) * speed
          out.y = (dy / distance) * speed
        }
        return
      }
      case "chasing": {
        if (clock < walker.yieldUntil) return
        const quarry = walker.quarry
        if (!quarry || !quarry.present) {
          walker.activity = "walking"
          walker.quarry = null
          return
        }
        const dx = quarry.x - walker.x
        const dy = quarry.y - walker.y
        const distance = Math.hypot(dx, dy) || 1
        if (distance < 0.55) {
          // Caught. Roles swap and both take a breath, which is the beat that
          // makes it read as a game rather than as pursuit.
          walker.activity = "standing"
          walker.until = clock + 0.6 + stream()
          quarry.activity = "chasing"
          quarry.quarry = walker
          quarry.until = clock + 3 + stream() * 5
          walker.quarry = null
          return
        }
        const speed = walker.body.runSpeed
        out.x = (dx / distance) * speed
        out.y = (dy / distance) * speed
        return
      }
      case "fleeing": {
        // Away from the chaser, unless that is away from home too — a fleeing
        // child who is already at the end of their leash turns and comes back,
        // which is also what happens in the park.
        const anchor = group.members.find((member) => member.body.age === "adult")
        if (anchor && anchor !== walker && Math.hypot(walker.x - anchor.x, walker.y - anchor.y) > LEASH) {
          const dx = anchor.x - walker.x
          const dy = anchor.y - walker.y
          const distance = Math.hypot(dx, dy) || 1
          out.x = (dx / distance) * walker.body.runSpeed * 0.8
          out.y = (dy / distance) * walker.body.runSpeed * 0.8
          return
        }
        const chaser = walker.quarry
        if (!chaser || !chaser.present) {
          walker.activity = "walking"
          walker.quarry = null
          return
        }
        const dx = walker.x - chaser.x
        const dy = walker.y - chaser.y
        const distance = Math.hypot(dx, dy) || 1
        // Fleeing is not a straight line away — a fleeing child curves, which is
        // the whole reason the chase lasts more than two seconds.
        const swerve = Math.sin(clock * 1.7 + walker.phase) * 0.8
        const speed = walker.body.runSpeed * 0.95
        out.x = ((dx / distance) * Math.cos(swerve) - (dy / distance) * Math.sin(swerve)) * speed
        out.y = ((dx / distance) * Math.sin(swerve) + (dy / distance) * Math.cos(swerve)) * speed
        return
      }
      case "darting": {
        const anchor = group.members.find((member) => member.body.age === "adult") ?? walker
        // Out and around the adult rather than off toward the horizon.
        const angle = clock * 1.1 + walker.phase
        const targetX = anchor.x + Math.cos(angle) * LEASH * 0.7
        const targetY = anchor.y + Math.sin(angle) * LEASH * 0.7
        const dx = targetX - walker.x
        const dy = targetY - walker.y
        const distance = Math.hypot(dx, dy) || 1
        const speed = walker.body.runSpeed * 0.7
        out.x = (dx / distance) * speed
        out.y = (dy / distance) * speed
        return
      }
      default:
        break
    }

    // Walking or running: to the slot, and the slot to the goal.
    const size = group.members.length
    let centreX = 0
    let centreY = 0
    for (const member of group.members) {
      centreX += member.x
      centreY += member.y
    }
    centreX /= size
    centreY /= size

    const towardX = group.goalX - centreX
    const towardY = group.goalY - centreY
    const distance = Math.hypot(towardX, towardY) || 1

    // The group's own slow wander off the straight line. Keyed on the group
    // rather than the person, so a family curves as a family; two sines at an
    // irrational ratio, so nobody's path ever repeats and no two agree.
    const wander =
      MEANDER[settings.flow] *
      (0.65 * Math.sin(clock * 0.07 + group.id) + 0.35 * Math.sin(clock * 0.031 + group.id * 1.9))
    const turn = Math.cos(wander)
    const lean = Math.sin(wander)

    const dirX = (towardX * turn - towardY * lean) / distance
    const dirY = (towardX * lean + towardY * turn) / distance

    const { lateral, forward } = slotOffset(size, walker.slot, crowding)
    // Rotate the slot into the direction of travel: lateral is across it.
    const slotX = centreX + dirX * forward - dirY * lateral
    const slotY = centreY + dirY * forward + dirX * lateral

    // Nobody in a group outwalks the group. On their own, `group.pace` is their
    // own preferred speed and this does nothing.
    const base = walker.activity === "running" ? walker.body.runSpeed : Math.min(walker.body.preferredSpeed, group.pace)
    const speed = base * paceScale(walker)

    if (speed < 0.05) {
      // Stopped on purpose, which is not the same as having nowhere to go: they
      // still hold their place against being shoved, and `advanceGait` will
      // give them the postural sway of somebody standing.
      out.x = 0
      out.y = 0
      return
    }

    const toSlotX = slotX - walker.x
    const toSlotY = slotY - walker.y

    // Two terms: go where the group is going, and take your place in it. The
    // second is deliberately weak — a group that snaps into formation looks
    // choreographed, and real ones are always a little out of shape.
    out.x = dirX * speed + toSlotX * 0.9
    out.y = dirY * speed + toSlotY * 0.9

    const size2 = Math.hypot(out.x, out.y)
    if (size2 > speed) {
      out.x = (out.x / size2) * speed
      out.y = (out.y / size2) * speed
    }
  }

  /**
   * How fast this person wants to walk *right now*, as a multiple of the speed
   * they prefer.
   *
   * Three things multiply together, and they are three different timescales:
   * a slow personal drift that never repeats, whatever their group has decided
   * about its pace, and a full stop while they are giving way to somebody.
   */
  function paceScale(walker: Walker): number {
    if (clock < walker.yieldUntil) return 0

    const drift =
      1 +
      PACE_DRIFT * (0.6 * Math.sin(clock * 0.11 + walker.phase) + 0.4 * Math.sin(clock * 0.043 + walker.phase * 2.7))

    switch (walker.group.urge) {
      case "dawdle":
        return drift * DAWDLE
      case "hurry":
        return drift * HURRY
      default:
        return drift
    }
  }

  // ── Gaze ────────────────────────────────────────────────────────────────

  /**
   * Where the head points, which is not where the feet are going.
   *
   * Priorities, highest first: whoever they are already looking at until that
   * expires, then a child who has strayed, then whoever in the group is talking,
   * then a stranger passing close, and otherwise a slow scan around the
   * direction of travel. Every one of them is a bounded excursion that ends by
   * coming back to the path.
   *
   * The head is limited to about 65° off the shoulders in either direction,
   * which is roughly where a person's neck stops and their whole body starts
   * turning. Without the limit heads spin like turrets and the crowd reads as
   * machinery instantly.
   */
  function updateGaze(walker: Walker, dt: number): void {
    if (settings.gaze <= 0) {
      walker.yaw = walker.facing
      walker.pitch = 0
      return
    }

    const group = walker.group

    if (walker.looking && (clock > walker.lookUntil || !walker.looking.present)) {
      walker.looking = null
    }

    if (!walker.looking && clock > walker.lookUntil) {
      const talker = group.members[group.talker]
      if (walker.activity === "chasing" && walker.quarry) {
        walker.looking = walker.quarry
        walker.lookUntil = clock + 0.6
      } else if (talker && talker !== walker && group.members.length > 1 && stream() < 0.55 * settings.gaze) {
        walker.looking = talker
        walker.lookUntil = clock + 0.8 + stream() * 2
      } else if (stream() < 0.25 * settings.gaze) {
        const passer = nearestStranger(walker)
        if (passer) {
          walker.looking = passer
          walker.lookUntil = clock + 0.3 + stream() * 0.6
        }
      } else {
        walker.lookUntil = clock + 0.4 + stream() * 1.6
      }
    }

    let wantedYaw: number
    let wantedPitch: number

    if (walker.looking) {
      const dx = walker.looking.x - walker.x
      const dy = walker.looking.y - walker.y
      const distance = Math.max(0.4, Math.hypot(dx, dy))
      wantedYaw = Math.atan2(dy, dx)
      // Looking at a face: up if they are taller, down if they are shorter.
      const rise = walker.looking.posture - walker.posture
      wantedPitch = Math.atan2(rise, distance) * 0.55
    } else {
      // Scanning. Two slow sines so it never settles into a rhythm, and the
      // amplitude is what the gaze slider mostly moves.
      const scan = (Math.sin(clock * 0.31 + walker.phase) + 0.5 * Math.sin(clock * 0.53 + walker.phase * 2.1)) * 0.42
      wantedYaw = walker.facing + scan * settings.gaze
      // Walking, people look a few metres down the path rather than at the
      // horizon, which from above is the crown of the head coming toward you.
      wantedPitch = -Math.atan2(walker.posture, 4.5) * 0.45
    }

    if (walker.activity === "crouching") wantedPitch = -0.75
    if (walker.activity === "fallen") wantedPitch = -0.4
    if (walker.activity === "running") {
      wantedYaw = walker.facing
      wantedPitch = -0.12
    }
    if (walker.hop > 0.01) wantedPitch += 0.25

    // Clamp to what a neck can do, relative to the shoulders.
    const off = normalizeAngle(wantedYaw - walker.facing)
    walker.yawWanted = walker.facing + Math.max(-NECK_LIMIT, Math.min(NECK_LIMIT, off))
    walker.pitchWanted = Math.max(-0.9, Math.min(0.8, wantedPitch))

    // Approach at a limited rate, so a glance is a movement rather than a cut.
    const delta = normalizeAngle(walker.yawWanted - walker.yaw)
    const step = Math.min(Math.abs(delta), NECK_RATE * dt * (0.4 + 0.6 * settings.gaze))
    walker.yaw += Math.sign(delta) * step
    walker.pitch += (walker.pitchWanted - walker.pitch) * Math.min(1, dt * 4)
  }

  function nearestStranger(walker: Walker): Walker | null {
    let best: Walker | null = null
    let bestDistance = 2.6
    forNear(grid, walker.x, walker.y, 2.6, (index) => {
      const candidate = walkers[index]
      if (!candidate || candidate === walker || candidate.group === walker.group) return
      const distance = Math.hypot(candidate.x - walker.x, candidate.y - walker.y)
      if (distance < bestDistance) {
        best = candidate
        bestDistance = distance
      }
    })
    return best
  }

  // ── The frame ───────────────────────────────────────────────────────────

  /**
   * The neighbour grid, rebuilt in place.
   *
   * Allocated only when the world's bounds move, which is a resize. Rebuilding
   * the buckets is a clear and a push per person; rebuilding the *structure* is
   * a few hundred array allocations, and doing that twice a frame at 120 Hz was
   * the piece's largest source of garbage.
   */
  function rebuildGrid(): void {
    const spanX = outerX() + 2
    const spanY = outerY() + 2
    if (grid.minX !== -spanX || grid.minY !== -spanY || grid.cols * grid.cell < spanX * 2) {
      grid = createGrid(-spanX, -spanY, spanX, spanY, CELL)
    }
    clearGrid(grid)
    for (let index = 0; index < walkers.length; index++) {
      insert(grid, index, walkers[index]!.x, walkers[index]!.y)
    }
  }

  function step(dt: number): void {
    clock += dt

    maintain(dt)
    rebuildGrid()

    for (const group of groups) updateGroup(group, dt)
    for (const walker of walkers) updatePlay(walker)

    overlapPeak = 0
    contactCount = 0

    for (let index = 0; index < walkers.length; index++) {
      const walker = walkers[index]!
      const stationary =
        walker.activity === "sitting" || walker.activity === "fallen" || walker.activity === "crouching"

      self.x = walker.x
      self.y = walker.y
      self.vx = walker.vx
      self.vy = walker.vy
      self.r = walker.body.radius

      // How hemmed in they are, which flattens the group's formation.
      let neighbours = 0

      // The most imminent *crossing* encounter, which is the one they might
      // stop for. Tracked through the loop and acted on after it, so a walker
      // makes one decision per frame rather than one per neighbour.
      let soonest = Infinity

      let ax = 0
      let ay = 0

      forNear(grid, walker.x, walker.y, REACH, (candidateIndex) => {
        if (candidateIndex === index) return
        const candidate = walkers[candidateIndex]
        if (!candidate) return

        const dx = candidate.x - walker.x
        const dy = candidate.y - walker.y
        const distance = Math.hypot(dx, dy)
        if (distance > REACH) return
        if (distance < 1.6) neighbours++

        other.x = candidate.x
        other.y = candidate.y
        other.vx = candidate.vx
        other.vy = candidate.vy
        other.r = candidate.body.radius

        const visibility = weightBehind(self, dx, dy)

        // Somebody crossing my path, rather than coming at me or going my way.
        // Head-on is resolved by stepping aside and overtaking needs no
        // decision; it is the crossing that people stop for.
        if (!stationary && walker.speed > 0.3 && candidate.speed > 0.3) {
          const alignment = (walker.vx * candidate.vx + walker.vy * candidate.vy) / (walker.speed * candidate.speed)
          if (Math.abs(alignment) < 0.55) {
            const tau = timeToCollision(self, other)
            if (tau < soonest) soonest = tau
          }
        }

        avoidance(self, other, force)
        ax += force.x * visibility
        ay += force.y * visibility

        // And a side to give way on, which is what lets a counterflow sort
        // itself into files at all — see `passingBias`. A fraction of the
        // avoidance just computed, so it cannot outgrow it.
        passingBias(self, other, force, SIDE_PREFERENCE, walker.handed, push)
        ax += push.x * visibility
        ay += push.y * visibility

        personalSpace(self, other, push)
        // Company is closer than strangers are: the same repulsion between two
        // friends walking side by side would blow the formation apart, and the
        // formation is what makes them friends.
        //
        // But only while there is still air between them. The discount used to
        // apply at any separation, so a group being squeezed by the crowd around
        // it had its own members' last defence turned down to a third exactly
        // when it was needed, and the deepest overlaps in the piece were all
        // inside groups.
        const touching = distance < walker.body.radius + candidate.body.radius + 0.06
        const familiar = candidate.group === walker.group && !touching ? 0.3 : 1
        ax += push.x * visibility * familiar
        ay += push.y * visibility * familiar
      })

      for (const obstacle of obstacles) {
        avoidance(self, obstacle, force)
        ax += force.x
        ay += force.y
        personalSpace(self, obstacle, push)
        ax += push.x
        ay += push.y
      }

      // Stop and let them go. Once the decision is made it stands for its own
      // duration, so nobody flickers between yielding and not.
      if (soonest < YIELD_HORIZON && clock > walker.yieldUntil && stream() < 1 - Math.exp(-MAY_YIELD * dt)) {
        walker.yieldUntil = clock + 0.4 + stream() * 1.2
      }

      if (!stationary) {
        const crowding = Math.min(1, neighbours / 5)
        wantedVelocity(walker, crowding, force)
        seek(self, force.x, force.y, RELAXATION, push)
        ax += push.x
        ay += push.y
      } else {
        // Sitting or down: they still resist being pushed, they just do not walk.
        ax -= walker.vx * 3
        ay -= walker.vy * 3
      }

      walker.vx += ax * dt
      walker.vy += ay * dt

      // Nobody exceeds what their legs can do, whatever the forces say.
      const ceiling = walker.body.runSpeed * 1.15
      const speed = Math.hypot(walker.vx, walker.vy)
      if (speed > ceiling) {
        walker.vx = (walker.vx / speed) * ceiling
        walker.vy = (walker.vy / speed) * ceiling
      }

      walker.speed = Math.hypot(walker.vx, walker.vy)
    }

    for (const walker of walkers) {
      walker.x += walker.vx * dt
      walker.y += walker.vy * dt
    }

    // Against where everyone actually is, not where they were when the forces
    // were worked out. A step's worth of movement is a centimetre, which is
    // nothing — but it is a centimetre in the direction of whoever they were
    // about to touch.
    rebuildGrid()

    // Four passes. One resolves a pair; it does not resolve a knot, because
    // pushing A off B can push A into C, and in a crush that is most of what
    // happens. Each pass roughly halves what is left, and by four the deepest
    // interpenetration at festival density is a couple of centimetres — a body
    // being squeezed, not a body being passed through.
    separate()
    separate()
    separate()
    separate()

    for (const walker of walkers) {
      advanceGait(walker, dt)
      updateGaze(walker, dt)
    }

    cull()
  }

  /**
   * Push apart anyone who has ended the step inside somebody else.
   *
   * Positional rather than force-based, because a force can always be outrun: at
   * a closing speed of 4 m/s and a 60 Hz step, two runners cover 13 cm between
   * frames and a purely elastic response lets them pass through each other. This
   * is the line that makes the promise, and `stats().overlap` is the measurement
   * of whether it is being kept.
   */
  function separate(): void {
    for (let index = 0; index < walkers.length; index++) {
      const walker = walkers[index]!
      forNear(grid, walker.x, walker.y, 1.4, (candidateIndex) => {
        if (candidateIndex <= index) return
        const candidate = walkers[candidateIndex]
        if (!candidate) return

        self.x = walker.x
        self.y = walker.y
        self.r = walker.body.radius
        other.x = candidate.x
        other.y = candidate.y
        other.r = candidate.body.radius

        const depth = overlapOf(self, other)
        if (depth <= 0) return

        contactCount++
        if (depth > overlapPeak) overlapPeak = depth

        let dx = candidate.x - walker.x
        let dy = candidate.y - walker.y
        let distance = Math.hypot(dx, dy)
        if (distance < 1e-4) {
          // Exactly coincident, which happens when two people are spawned on the
          // same square metre. Any direction will do; a fixed one would make
          // every such pair separate along the same axis.
          dx = Math.cos(walker.id)
          dy = Math.sin(walker.id)
          distance = 1
        }
        const nx = dx / distance
        const ny = dy / distance

        // Heavier people give way less. Mass goes as stature cubed, which is
        // why an adult wading through children barely notices.
        const massA = Math.pow(walker.body.stature, 3)
        const massB = Math.pow(candidate.body.stature, 3)
        const shareA = massB / (massA + massB)
        const shareB = 1 - shareA

        walker.x -= nx * depth * shareA
        walker.y -= ny * depth * shareA
        candidate.x += nx * depth * shareB
        candidate.y += ny * depth * shareB

        // And they bleed off the speed they ran into each other with.
        const closing = (candidate.vx - walker.vx) * nx + (candidate.vy - walker.vy) * ny
        if (closing < 0) {
          walker.vx += nx * closing * shareA
          walker.vy += ny * closing * shareA
          candidate.vx -= nx * closing * shareB
          candidate.vy -= ny * closing * shareB
        }
      })
    }
  }

  /**
   * The gait, the posture and the hop: everything about the head's height.
   *
   * Posture eases rather than switching, and it eases down faster than it eases
   * up, because sitting down is gravity and standing up is work. A quarter of a
   * second and three-quarters of one, which is close enough to life that nobody
   * asks.
   */
  function advanceGait(walker: Walker, dt: number): void {
    const body = walker.body
    const moving = walker.speed > 0.08

    if (moving) {
      walker.stride = (walker.stride + cadence(body, walker.speed) * 0.5 * dt) % 1
      walker.facing = approachAngle(walker.facing, Math.atan2(walker.vy, walker.vx), dt * 6)
    }

    // Running is something somebody is out doing, not a speed they have
    // reached. See `runs` on `Walker` for what conflating the two cost.
    //
    // Two ways to be out running: it is what you came out to do, or your group
    // has just decided it is late. The second is read rather than written into
    // `runs`, so it ends when the urge does — writing it would make every
    // hurry permanent, one walker at a time.
    if (walker.activity === "walking" || walker.activity === "running") {
      const running = walker.runs || (walker.group.sprinting && walker.body.age === "adult")
      walker.activity = running ? "running" : "walking"
    }

    let base: number
    switch (walker.activity) {
      case "sitting":
        base = body.headHeightSitting
        break
      case "crouching":
        base = 0.62 * body.stature - body.headHeight / 2
        break
      case "fallen":
        base = body.headHeight * 0.55
        break
      default:
        base = body.headHeightStanding
    }

    const rate = base < walker.posture ? 1 - Math.exp(-dt / 0.22) : 1 - Math.exp(-dt / 0.7)
    walker.posture += (base - walker.posture) * rate

    // The hop is ballistic, so it comes down on its own and lands exactly.
    if (walker.hopRate !== 0 || walker.hop > 0) {
      walker.hopRate -= G * dt
      walker.hop += walker.hopRate * dt
      if (walker.hop <= 0) {
        walker.hop = 0
        walker.hopRate = 0
      }
    }
  }

  /**
   * How many people are in the picture or about to be.
   *
   * The population controller counts this rather than the bare in-frame number,
   * and that is the whole of what makes it stable. Somebody spawned at the edge
   * of the world takes ten or twenty seconds to walk into shot, and a loop that
   * cannot see them keeps ordering more until they all arrive at once — which is
   * exactly what the first two versions of this did.
   *
   * Weighted by how soon they will arrive, not counted flat. Two thirds of the
   * world is margin, and most of the people out there are leaving, passing by,
   * or half a minute away; crediting them all equally starves the frame instead,
   * which was the third version. The horizon below is a little longer than the
   * walk in from the edge, so a fresh arrival counts for most of a person
   * immediately and a distant one for nothing.
   */
  function committed(): number {
    let total = 0
    paceSeen = 0
    let moving = 0

    for (const walker of walkers) {
      if (walker.speed > 0.25) {
        paceSeen += walker.speed
        moving++
      }
      const outX = Math.max(0, Math.abs(walker.x) - view.halfWidth)
      const outY = Math.max(0, Math.abs(walker.y) - view.halfHeight)
      if (outX === 0 && outY === 0) {
        total += 1
        continue
      }
      if (walker.speed < 0.15) continue
      // Heading toward the middle at all, rather than away from it.
      if (walker.vx * -walker.x + walker.vy * -walker.y <= 0) continue

      const eta = Math.hypot(outX, outY) / walker.speed
      total += Math.max(0, 1 - eta / arrivalHorizon(view.margin))
    }

    paceSeen = moving > 0 ? paceSeen / moving : (settings.paceLow + settings.paceHigh) / 2
    return total
  }

  /**
   * Keeping the frame as busy as the density asks for.
   *
   * A **Smith predictor**, which is the standard answer to a control loop with a
   * transport delay in it, and this one has a long delay: people are spawned off
   * screen and take ten or twenty seconds to walk into shot. Two earlier
   * versions ignored that and both produced waves — a crowd arriving and leaving
   * together, which is the one thing it must never look like:
   *
   * - Proportional on the in-frame count swung between 0 and 57 against a target
   *   of 16, on a period of about half a minute.
   * - Integral on the same count swung between 6 and 70 on a period of about
   *   four minutes. Slower is not safer; it is the same instability at a lower
   *   frequency.
   *
   * Counting the pipeline removes the delay from the loop, and then the simplest
   * possible controller is enough: spawn while short, stop while not, at a rate
   * that cannot fill the frame faster than people can walk into it.
   *
   * Arrivals accumulate as a fraction of a person per step and are spent when
   * they come to a whole one, so the rate is honest at any step size and group
   * sizes still come out of the distribution rather than out of the controller.
   */
  function maintain(dt: number): void {
    const wanted = target()

    // Smoothed, because the count jumps by whole groups and the loop should not
    // chase that.
    inFrameAverage += (committed() - inFrameAverage) * (1 - Math.exp(-dt / SMOOTHING_SECONDS))
    if (inFrameAverage >= wanted) return

    // Little's law, forwards: to hold `wanted` people in a frame each of them
    // crosses in `stay` seconds, the arrivals have to come at `wanted / stay`.
    // Measured from the crowd's own pace rather than the pace band, because a
    // dense crowd walks at half what it drew and would otherwise be ordered at
    // twice the rate it can absorb.
    const stay = Math.max(3, (view.halfWidth + view.halfHeight) / Math.max(0.35, paceSeen))
    owed += Math.max(MAX_ARRIVALS, (wanted / stay) * FILL_HEADROOM) * dt
    if (owed < 1) return

    // **A big shortfall is filled from inside, a small one from the edges.**
    // Turning the density slider up asks for hundreds of people who are not
    // there, and at three a second from off screen that is a five-minute wait
    // in which the picture is simply wrong. A shortfall this large only happens
    // when something about the world has just changed, and a frame that is
    // half empty of what was asked for has nothing to lose by being filled —
    // whereas the ordinary turnover, which is the case that has to look right,
    // still walks in.
    const before = walkers.length
    spawnGroup(inFrameAverage < wanted * 0.5)
    // A spawn abandoned for want of room still spends its turn, so a congested
    // edge cannot make this spin.
    owed -= Math.max(1, walkers.length - before)
  }

  function cull(): void {
    const limitX = outerX() + 3
    const limitY = outerY() + 3
    let culled = false

    for (let index = groups.length - 1; index >= 0; index--) {
      const group = groups[index]!
      const gone = group.members.every((member) => Math.abs(member.x) > limitX || Math.abs(member.y) > limitY)
      if (!gone) continue
      for (const member of group.members) member.present = false
      groups.splice(index, 1)
      culled = true
    }

    // One filter for the whole frame rather than a splice per person, which is
    // a memory move of the tail of the array each time.
    if (culled) {
      let kept = 0
      for (const walker of walkers) if (walker.present) walkers[kept++] = walker
      walkers.length = kept
    }
  }

  /**
   * The lane order parameter: local agreement minus the room's own.
   *
   * Computed here rather than per frame, because nothing in the simulation reads
   * it — it exists to be asked for. The global term is the mean cosine over
   * *every* pair, which for unit headings is `(|Σû|² − n) / (n(n−1))` and costs
   * one pass rather than n².
   */
  function measureSorting(): number {
    let local = 0
    let pairs = 0
    let sumX = 0
    let sumY = 0
    let moving = 0

    for (let index = 0; index < walkers.length; index++) {
      const walker = walkers[index]!
      if (walker.speed < 0.25) continue

      sumX += walker.vx / walker.speed
      sumY += walker.vy / walker.speed
      moving++

      forNear(grid, walker.x, walker.y, 1.6, (candidateIndex) => {
        if (candidateIndex <= index) return
        const candidate = walkers[candidateIndex]
        if (!candidate || candidate.speed < 0.25) return
        if (Math.hypot(candidate.x - walker.x, candidate.y - walker.y) > 1.6) return
        local += (walker.vx * candidate.vx + walker.vy * candidate.vy) / (walker.speed * candidate.speed)
        pairs++
      })
    }

    if (pairs === 0 || moving < 2) return 0
    const global = (sumX * sumX + sumY * sumY - moving) / (moving * (moving - 1))
    return local / pairs - global
  }

  function fill(): void {
    for (const walker of walkers) walker.present = false
    walkers.length = 0
    groups.length = 0
    stream = makeRng(settings.seed | 0)
    // The guard is generous because an arrival that lands on somebody is
    // abandoned rather than moved, so a dense frame takes several tries per
    // group. It is a bound on the loop, not a target.
    let guard = 0
    while (countInFrame() < target() && guard++ < 900) spawnGroup(true)

    // And a pipeline, so the opening crowd is not one cohort that all leaves
    // together. Without this the frame fills, empties on cue about thirty
    // seconds in, and takes another half-minute to recover — which is the same
    // oscillation `maintain` was fixed for, arriving through the initial
    // conditions instead of through the loop.
    //
    // Half a frameful, which is roughly what walks in during the first
    // half-minute — and that is exactly the window in which the crossers laid
    // out inside walk back out again. Without it the opening dips to a quarter
    // of the target around thirty seconds in and takes a minute to recover; the
    // controller cannot fill a frame faster than people can walk into it, and
    // nor can anything else.
    let inbound = 0
    guard = 0
    while (inbound < target() * 0.55 && guard++ < 900) {
      const before = walkers.length
      spawnGroup(false)
      inbound += walkers.length - before
    }

    owed = 0
    inFrameAverage = committed()
  }

  return {
    walkers,
    groups,
    obstacles,
    step,
    fill,

    remeasure(nextView, nextSettings) {
      view = nextView
      settings = nextSettings
    },

    recolour(nextSettings) {
      settings = nextSettings
      for (const walker of walkers) {
        walker.skin = skinOf(settings.palette, settings, walker.rng, walker.group.hue, walker.group.team)
        walker.tones = tonesFor(settings, walker.skin)
      }
    },

    stats() {
      let children = 0
      let sitting = 0
      let runners = 0
      let yielding = 0
      let unsteady = 0
      let playing = 0
      let speed = 0
      for (const walker of walkers) {
        if (walker.body.age === "child") children++
        if (walker.activity === "sitting") sitting++
        if (walker.activity === "running") runners++
        if (clock < walker.yieldUntil) yielding++
        if (walker.group.urge !== "steady") unsteady++
        if (
          walker.activity === "chasing" ||
          walker.activity === "fleeing" ||
          walker.activity === "darting" ||
          walker.activity === "crouching" ||
          walker.activity === "fallen" ||
          walker.hop > 0.01
        ) {
          playing++
        }
        speed += walker.speed
      }
      return {
        walkers: walkers.length,
        inFrame: countInFrame(),
        groups: groups.length,
        children,
        sitting,
        runners,
        yielding,
        unsteady,
        playing,
        meanSpeed: walkers.length > 0 ? speed / walkers.length : 0,
        overlap: overlapPeak,
        contacts: contactCount,
        sorting: measureSorting(),
      }
    },

    get clock() {
      return clock
    },
  }
}

/** Shortest signed difference between two angles. */
export function normalizeAngle(angle: number): number {
  let value = angle
  while (value > Math.PI) value -= TAU
  while (value < -Math.PI) value += TAU
  return value
}

/** Move `from` toward `to` by at most `rate`, the short way round. */
export function approachAngle(from: number, to: number, rate: number): number {
  const delta = normalizeAngle(to - from)
  const step = Math.min(Math.abs(delta), rate)
  return from + Math.sign(delta) * step
}

/**
 * Whether the gait is a run.
 *
 * A jogger, and also a child in the middle of a chase — the vertical excursion
 * of a running head is three times a walking one and it is what makes a chase
 * legible from above as running rather than as brisk walking.
 */
export const isRunning = (walker: Walker): boolean =>
  walker.activity === "running" ||
  walker.activity === "chasing" ||
  walker.activity === "fleeing" ||
  walker.activity === "darting"

/** Where a walker's head actually is, in metres above the ground. */
export const headHeight = (walker: Walker, bob: number): number => {
  const moving = walker.speed > 0.08
  const rise = moving ? gaitOffset(walker.body, walker.stride, walker.speed, isRunning(walker)).rise : 0
  return walker.posture + walker.hop + rise * bob
}

/** The head's sideways weave, in metres across the direction of travel. */
export const headSway = (walker: Walker, bob: number): number => {
  if (walker.speed <= 0.08) return 0
  return gaitOffset(walker.body, walker.stride, walker.speed, isRunning(walker)).sway * bob
}

/** The slow drift of a head that is not going anywhere. */
export const headDrift = (walker: Walker, clock: number): { x: number; y: number } =>
  walker.speed > 0.08 ? { x: 0, y: 0 } : posturalSway(walker.body, clock, walker.phase)
