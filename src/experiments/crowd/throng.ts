/**
 * The crowd: who is out there, what they are doing, and how many of them exist.
 *
 * ## The world is a disc that travels with the observer
 *
 * There is no map. People are kept within a radius of whoever is walking, and
 * anyone who falls outside it is re-entered on the far side — so the crowd is
 * endless without anything being stored, and the observer can walk in one
 * direction for an hour. Where somebody re-enters is derived in `random.ts`, and
 * the docblock there is worth reading before touching it: the obvious reason for
 * the derivation is wrong, the real one is a measured 2.35x in re-entry work,
 * and the difference between those two statements cost a check that passed
 * against a broken implementation.
 *
 * ## How big the disc is, and why that is a derived number
 *
 * Far enough that the fog has taken a head below anything a screen can show —
 * `horizonFor(fade)` — unless that would cost more people than the budget
 * allows, in which case the budget wins and the crowd has a visible edge.
 *
 * **That edge is reported rather than hidden.** `stats().edge` is how bright a
 * head at the boundary still is, and anything above a couple of per cent is a
 * scene whose `fade` is long for its `density`. Fading the last stretch out to
 * disguise it was the obvious fix and is the wrong one: it would make a scene
 * that cannot afford its own depth look exactly like one that can.
 *
 * ## Avoidance has a detail radius, and it is chosen to be invisible
 *
 * Anticipation is the expensive part — every person against every neighbour,
 * every step — and it is also entirely invisible past a certain distance,
 * because a head forty metres off is two pixels and two heads passing through
 * each other there is not a thing anybody can see. So only people within
 * `DETAIL` metres of the observer avoid each other.
 *
 * **The radius is derived from the anticipation, not guessed.** `steering.ts`
 * cuts the force off at `CUTOFF` seconds, and the fastest pair this piece can
 * produce closes at the top of the pace band plus the top of the observer's,
 * which is 5.2 m/s. Four seconds of that is 21 m, so at 24 m no interaction that
 * would have happened is being skipped — the two people are not yet in each
 * other's future. Raising the pace band's maximum without raising both is the
 * one way to make it wrong, and `tests/unit/crowd/throng.test.ts` says so.
 */

import {
  adultStature,
  bodyRadius,
  cadence,
  freeSpeed,
  runCadence,
  runSpeed,
  headBreadth,
  headCentre,
  statureAtAge,
  CHILD_AGES,
} from "@/experiments/crowd/body"
import { corridorPoint, entryAngle, heading } from "@/experiments/crowd/random"
import { createLoop, createPath, hikingPace, lanePush, type Frame, type Path } from "@/experiments/crowd/path"
import { createStalls, type Stalls } from "@/experiments/crowd/stalls"
import { avoid, CUTOFF } from "@/experiments/crowd/steering"
import { hashSeed, makeRng, type Rng } from "@/experiments/random"
import { BOUNDS, type Settings } from "@/experiments/crowd/settings"

/**
 * The most people that may exist at once.
 *
 * A ceiling on the frame rather than on the fiction: every one of them is
 * advanced, projected and drawn, and the arc calls are what actually costs. It
 * is what makes `stats().edge` a number worth reading — the budget is the reason
 * a long `fade` over a dense crowd cannot have the depth it asks for.
 */
export const MAX_PEOPLE = 9000

/** Metres. Inside this people avoid each other; outside it they walk. See the docblock. */
export const DETAIL = 24

/**
 * The detail radius a scene actually needs, which is `DETAIL` unless I am
 * running.
 *
 * **Derived per scene rather than raised for everybody**, because what sizes it
 * is the fastest closing pair — the top of the crowd's band plus my own pace —
 * and only a runner takes that past 24 m. Raising the constant to cover the top
 * of `walk`'s track would have cost every walking scene 1.8 times the
 * anticipation for encounters none of them can have.
 */
export function detailFor(settings: Pick<Settings, "paceHigh" | "walk">): number {
  return Math.max(DETAIL, CUTOFF * (settings.paceHigh + Math.max(settings.walk, settings.paceHigh)) + 2)
}

/**
 * Where somebody walking with you goes, in the observer's own frame:
 * `(right, ahead)` in metres.
 *
 * **Placed to be seen, and that is the whole of what a companion is for.**
 * Andrei: "just having some companions provides perspective. because i see what
 * i 'see', having a companion makes it look somewhat like a third person view."
 * A head at a known size, a known distance and a steady place is a reference the
 * rest of the picture can be read against — a first-person view has nothing else
 * playing that part.
 *
 * Abreast would be 90° off the line of travel, which is past what a neck reaches
 * and outside the frame at any field of view this piece uses. These sit at about
 * 41° and 15°, which is in shot.
 *
 * **There was a shuffle here and it has been deleted.** Six stations including
 * two behind, traded every 7-22 seconds, so people drifted ahead and fell back
 * and overtook. It worked and it earned nothing: "we don't need to overdo the
 * constellation modeling. catching up with the group and all stopping together
 * are possible, but i don't think they add any value." A companion behind you
 * provides no reference, because you cannot see them. Do not rebuild it.
 */
const COMPANION_SLOTS: readonly (readonly [number, number])[] = [
  [0.62, 0.7],
  [-0.62, 0.7],
  [0.45, 1.95],
]

/**
 * Where my team goes when more than three walk with me: a block of rows, in my
 * own frame, with me in the middle of the back row.
 *
 * **At the back, so the rule above still holds** — a companion behind is no
 * reference, and a team is a dozen of them. The spacing is the crowd's teams'
 * (0.8 m abreast, 1.05 m between rows), so mine reads as one of theirs.
 */
function teamSlots(mates: number): (readonly [number, number])[] {
  const size = mates + 1
  const across = Math.min(4, Math.ceil(Math.sqrt(size)))
  const rows = Math.ceil(size / across)
  const mine = { row: rows - 1, col: Math.floor((size - (rows - 1) * across - 1) / 2) }
  const slots: (readonly [number, number])[] = []
  for (let n = 0; n < size; n++) {
    const row = Math.floor(n / across)
    const col = n % across
    if (row === mine.row && col === mine.col) continue
    // A partial back row is centred under the full ones.
    const inRow = row === rows - 1 ? size - (rows - 1) * across : across
    const right = (col - (inRow - 1) / 2) * 0.8 - (mine.col - (size - (rows - 1) * across - 1) / 2) * 0.8
    slots.push([right, (mine.row - row) * 1.05])
  }
  return slots
}

/** Metres. Close enough that I have caught the person in red: an arm's reach and a body. */
const CAUGHT_AT = 1.1

/** Share of their waits in which they do not notice me coming, so the chase ends in a catch. */
const CAUGHT_SHARE = 0.4

/** Seconds we stand together once caught, before they bolt again. */
const CAUGHT_FOR = [2.5, 5]

/** How firmly a companion holds their place, per second squared. Stiffer than a crowd group's. */
const COMPANION_SPRING = 3.4

/** Spatial hash cell, in metres. A shade over the 3.5 m at which a pair is worth testing. */
const CELL = 4

/**
 * How far before the wall a corridor starts pushing back, in metres.
 *
 * A wall people bounce off is a wall; a wall they ease away from is a street.
 * The force is one-sided and linear in how far inside this band somebody is, so
 * it reads as room running out rather than as a barrier.
 */
const WALL_SOFTEN = 0.8

/** Pairs are only tested inside this. Beyond it the anticipation force is under half a per cent. */
const NEIGHBOUR = 3.6

/**
 * Metres. How close a head has to be for an overlap in it to be worth counting.
 *
 * `overlaps` alone cannot answer the question the detail radius raises. **Past
 * `DETAIL` nobody avoids anybody**, so the far crowd interpenetrates freely and
 * carries those overlaps in with it as the observer walks — which is fine if and
 * only if they are resolved long before anybody can see them. At eight metres a
 * head is a couple of dozen pixels across and an overlap is unmistakable, so
 * this is the count that actually holds the level-of-detail honest.
 */
const SEEN = 8

export type Person = {
  x: number
  y: number
  vx: number
  vy: number
  /** Where they would like to be going, as a unit vector. Zero for somebody standing. */
  gx: number
  gy: number
  /** Metres. */
  stature: number
  /** Height of the centre of the head above the ground, at rest. */
  head: number
  /** Radius of the head, in metres. Half of `headBreadth`. */
  headR: number
  /** The disc they will not have entered, already scaled by `spacing`. */
  radius: number
  /** Their own free walking speed. */
  preferred: number
  /** Radians. One full cycle per step. */
  phase: number
  /** Index into `groups`, or −1 for somebody on their own. */
  group: number
  /** Their place in the group's formation, in the group's own frame. */
  slotRight: number
  slotBack: number
  child: boolean
  standing: boolean
  /**
   * Standing in the lining at the side of the way, watching it go by.
   *
   * A role rather than a mood: a watcher is always standing, is only ever put
   * back into the lining, and is held there by walls on both sides — the way's
   * kerb on one and the back of the crowd on the other.
   */
  watcher: boolean
  /**
   * Walking with the observer, and therefore not part of the traffic.
   *
   * A companion keeps station rather than being met and passed, and is never
   * re-entered — the whole point of them is that they are the one person who is
   * still there in a minute's time.
   */
  companion: boolean
  /** Their place beside the observer, in the observer's frame. Only meaningful for a companion. */
  besideRight: number
  besideAhead: number
  /**
   * The one I am chasing, drawn red.
   *
   * Taken from the crowd like a companion and, like a companion, never
   * re-entered: they are the other person who is still there in a minute.
   */
  quarry: boolean
  /** Whether their gait is a run. See `runSpeed` in `body.ts`. */
  running: boolean
  /** Their nearest point on a loop last step, so this step's is a comparison away. −1 is unknown. */
  pathAt: number
  /** The last aisle crossing they decided at, so each crossing is one decision and not one per step. */
  junction: number
}

export type Group = {
  /** Unit heading the whole group is following. */
  hx: number
  hy: number
  /** The speed the group has settled on, which is the slowest member's. */
  speed: number
  size: number
  standing: boolean
}

export type ThrongStats = {
  /** How many people exist. */
  people: number
  /** How many of them are close enough to be avoiding each other. */
  avoiding: number
  /** Radius of the world, in metres. What `reach` asked for, or what the budget allowed. */
  world: number
  /** True when the budget cut the world short of the `reach` that was asked for. */
  budgeted: boolean
  /** Half the corridor, in metres. Larger than `world` means open ground. */
  halfWidth: number
  /** How bright a head at that radius still is. Above about 0.02 the crowd has a visible edge. */
  edge: number
  /** How many are children. */
  children: number
  /** How many are in a group with somebody. */
  grouped: number
  /** How many are walking with the observer. */
  companions: number
  /** How many are standing in the lining, watching. */
  watchers: number
  /** How many groups are teams. Zero unless `team` is set. */
  teams: number
  /** How far away the person in red is, in metres. Zero when there is nobody to chase. */
  quarry: number
  /** Tightest radius of turn on the way, in metres. Infinite when it runs straight. */
  minRadius: number
  /** Steepest gradient of the ground, rise over run. Zero when it is level. */
  steepestClimb: number
  /** Metres of clearance at the closest pair in the detail radius. Negative means an overlap. */
  closest: number
  /**
   * How many pairs inside the detail radius are actually overlapping.
   *
   * `closest` alone cannot tell a crowd with one unlucky pair from a crowd that
   * is generally walking through itself, and those want completely different
   * fixes. Counted per step, over ordered pairs, so a pair is seen once.
   */
  overlaps: number
  /**
   * Of those, how many are close enough for anybody to see.
   *
   * The one that matters, and the one a check should assert on. See `SEEN`.
   */
  overlapsSeen: number
  /** How close anybody has come to the observer, in metres, since the last read. */
  nearest: number
  /** Seconds of walk simulated. */
  clock: number
  /**
   * How many times somebody has been put back into the world, since the start.
   *
   * The instrument for `entryAngle`, and the only one that can see it. A crowd
   * re-entered at a uniform angle comes out at the *same density* as one
   * re-entered by flux — the wrongly-placed half leaves again immediately and is
   * re-entered until it lands somewhere it can stay — so density tells the two
   * apart not at all, and this counts the work that costs.
   */
  reentries: number
}

export type Observer = {
  x: number
  y: number
  vx: number
  vy: number
  /** The line the crowd's stream is laid along, in radians. */
  axis: number
  /** Which way the observer's body is pointing, so a companion can keep station in that frame. */
  course: number
  radius: number
}

export type Throng = ReturnType<typeof createThrong>

/**
 * How firmly somebody returns to their intended heading, per second.
 *
 * Low enough that an avoidance is a lean that persists for a metre or two rather
 * than a correction snapped back the moment the other person is past — which is
 * what real pedestrians do, and is also what lets two streams stay sorted into
 * files once they have found them. Snap it back hard and the files dissolve
 * between every pair of encounters.
 */
const RETURN = 2.2

/** Metres per second squared. Nobody accelerates harder than this, whatever the sum of forces says. */
const MAX_ACCEL = 7

export function createThrong(settings: Settings, observer: Observer) {
  const people: Person[] = []
  let groups: Group[] = []
  let current = settings
  let detail = detailFor(settings)
  let world = 1
  let budgeted = false
  let halfWidth = 1e6
  let clock = 0
  let avoiding = 0
  let closest = Infinity
  let overlaps = 0
  let overlapsSeen = 0
  let reentries = 0
  let nearest = Infinity
  /** The line the way is laid along. Straight unless `bend` says otherwise, and a circuit if `loop` does. */
  let path: Path = createPath(0, 1, 0, 0)
  /** The settings `path` was built from, so it is rebuilt only when they change. */
  let pathShape = ""
  /** The market's stalls, which nobody can see. None unless `stalls` says so. */
  let stalls: Stalls = createStalls(0, 1, 0)
  /** Metres of lining each side, or 0. Always 0 on open ground, which has no sides. */
  let lining = 0
  /**
   * Whether this scene needs the structured placement at all.
   *
   * A straight, unlined corridor is placed and re-entered exactly as it always
   * was, because every scene before the structured ones was measured on that
   * code — so it is kept rather than generalised out of existence.
   */
  let structured = false
  /** Salt for bodies made in a structured scene, so a removal and an addition never share one. */
  let spawned = 0

  /**
   * **Three streams, because the section's `random.ts` says to use three.**
   *
   * "Every caller derives a private generator from `hashSeed(seed, …salts)`
   * rather than pulling from one shared stream" — and this file pulled from one
   * shared stream, which put a real hazard in reach: the rejection sampling in
   * `restock` consumes a *variable* number of draws, more where the crowd is
   * tight, so how far along the stream a person's heading was drawn depended on
   * how crowded the spot they were placed in was.
   *
   * **That hazard was not, in the event, doing anything measurable** — the
   * statistic that sent this session looking turned out to be measuring
   * something else entirely, and splitting the streams moved it by 0.001. It is
   * split anyway, because the rule is right and the cost is nothing; what is
   * recorded here is that the split is preventive rather than a fix, so nobody
   * reads it as load-bearing and nobody re-runs the investigation.
   *
   * Salting a person's own stream by their index buys something separate and
   * real: who somebody is stops depending on the order they were made in, so
   * dragging `density` up and back down gives the same crowd rather than a
   * reshuffled one.
   */
  let place: Rng = makeRng(hashSeed(current.seed, 2))
  let cut: Rng = makeRng(hashSeed(current.seed, 3))
  const bodyRng = (index: number): Rng => makeRng(hashSeed(current.seed, index, 11))

  let nextGroup = 0

  /** Reused across the whole step, because one of these per person per step is most of the frame. */
  const force = { x: 0, y: 0 }

  const cells = new Map<number, number[]>()
  const key = (cx: number, cy: number) => (cx + 4096) * 16384 + (cy + 4096)

  /**
   * Ground available out to `radius`, in square metres.
   *
   * The world is a disc **intersected with a corridor**, which is a circular
   * segment problem rather than a rectangle one. Getting it wrong is not a
   * crash; it is a crowd at the wrong density in a narrow street, which looks
   * like a crowd.
   */
  function groundArea(radius: number, h: number = halfWidth): number {
    if (h >= radius) return Math.PI * radius * radius
    return 2 * (radius * radius * Math.asin(h / radius) + h * Math.sqrt(radius * radius - h * h))
  }

  /** Ground in the lining out to `radius`: both sides, between the kerb and the back. */
  const liningArea = (radius: number) => (lining > 0 ? groundArea(radius, halfWidth + lining) - groundArea(radius) : 0)

  /**
   * How many people a world of this radius holds, walkers and watchers together.
   *
   * On a bend the way is longer inside the disc than a straight one, so this is
   * an underestimate there by the path's mean `sec θ` — a few per cent at the
   * bends this piece allows, and it only moves the density, never the budget
   * past its ceiling, because `MAX_PEOPLE` clamps the count separately.
   */
  const population = (radius: number) =>
    (current.density / 100) * wayArea(radius) + (current.watchers / 100) * liningGround(radius)

  /**
   * Ground on the way and in its lining out to `radius`. A loop measures its
   * own length inside the disc — a circuit folds back on itself, so it can hold
   * far more way than a chord does — and every other path uses the corridor
   * formula it was measured with.
   */
  function wayArea(radius: number): number {
    const length = Number.isFinite(halfWidth) ? path.lengthWithin(observer.x, observer.y, radius) : null
    return length === null ? groundArea(radius) : length * 2 * halfWidth
  }
  function liningGround(radius: number): number {
    const length = lining > 0 ? path.lengthWithin(observer.x, observer.y, radius) : null
    return length === null ? liningArea(radius) : length * 2 * lining
  }

  /**
   * The largest world the budget affords, in metres.
   *
   * **Bisected rather than solved, because the corridor has no closed form.**
   * It used to be `sqrt(MAX / (perM2 · π))` — the answer for a full disc — which
   * is wildly wrong once there is a corridor: a 7 m street holds a fiftieth of
   * the people a disc of the same radius does, so the disc formula clamped a
   * street to a tenth of the reach it could easily have afforded. Thirty
   * bisections is exact to a millimetre and runs once per restock.
   */
  function affordableRadius(): number {
    let low = 1
    let high = 4000
    if (population(high) <= MAX_PEOPLE) return high
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2
      if (population(mid) > MAX_PEOPLE) high = mid
      else low = mid
    }
    return low
  }

  /**
   * Bind the first few people to the observer as companions.
   *
   * Taken from the crowd rather than made specially, so they are ordinary people
   * — their height, their age and their gait are drawn the same way as anybody
   * else's, which is what stops a companion reading as a different kind of
   * object from everyone around them.
   */
  function pairUp(): void {
    for (const person of people) {
      person.companion = false
      person.besideRight = 0
      person.besideAhead = 0
    }
    // Watchers sort to the end of the array, so the first few are walkers —
    // and a companion standing on the kerb would be no companion at all.
    for (const person of people) person.quarry = false
    const walkers = people.filter((person) => !person.watcher).length
    const wanted = Math.min(Math.round(current.companions), walkers)
    const slots = wanted <= COMPANION_SLOTS.length ? COMPANION_SLOTS : teamSlots(wanted)
    for (let i = 0; i < wanted; i++) {
      const mate = people[i]!
      mate.companion = true
      mate.besideRight = slots[i]![0]
      mate.besideAhead = slots[i]![1]
      mate.standing = false
      mate.group = -1
      // Beside the observer from the first frame, rather than converging on them
      // across the square over the opening minute.
      const cos = Math.cos(observer.axis)
      const sin = Math.sin(observer.axis)
      mate.x = observer.x + cos * mate.besideAhead - sin * mate.besideRight
      mate.y = observer.y + sin * mate.besideAhead + cos * mate.besideRight
      mate.vx = observer.vx
      mate.vy = observer.vy
    }
    // The person in red: the first walker who is not with me, put a little way
    // ahead so the chase starts in view rather than across the square.
    if (current.chase > 0 && walkers > wanted) {
      fleeing = true
      caughtFor = 0
      farGap = 9 + place() * 12
      const runaway = people[wanted]!
      runaway.quarry = true
      runaway.standing = false
      runaway.group = -1
      const cos = Math.cos(observer.axis)
      const sin = Math.sin(observer.axis)
      runaway.x = observer.x + cos * 7
      runaway.y = observer.y + sin * 7
      runaway.gx = cos
      runaway.gy = sin
      runaway.vx = cos * runaway.preferred
      runaway.vy = sin * runaway.preferred
    }
  }

  function restock(): void {
    // **`reach` sizes the world now, and `fade` does not.** It used to be
    // `horizonFor(fade)`, which tied how far you can see to how many people
    // exist: a long view forced a short fade or an unaffordable crowd, and the
    // near layers were washed out to pay for depth nobody asked for. They are
    // two questions and they are separate controls.
    // **The top of the track is a distinct state, not just a wide corridor.**
    // A corridor is fixed in the world, so an observer who wanders sideways
    // eventually meets its wall — which is right for a street and wrong for a
    // square, where there should be no wall to meet. At the top stop there is no
    // corridor at all, which every consumer gets for free from `Infinity`: no
    // wall force, no pull toward the line, and a plain disc to place into. The
    // control's own `format` already reads "open ground" there.
    halfWidth = current.width >= BOUNDS.width.max ? Infinity : current.width / 2
    lining = Number.isFinite(halfWidth) ? current.lining : 0
    // The bends are the seed's, like everything else about the world, so two
    // trails at the same settings are the same trail.
    // **Rebuilt only when its own settings change.** A loop is anchored where I
    // am standing when it is made, so rebuilding it for a density drag would
    // pick the whole circuit up and put it down somewhere else.
    const shape = [
      current.bend,
      current.meander,
      current.climb,
      current.hills,
      current.loop,
      current.corners,
      current.seed,
    ].join()
    if (shape !== pathShape) {
      pathShape = shape
      const bends = makeRng(hashSeed(current.seed, 5))
      const phases = [bends(), bends(), bends(), bends()].map((u) => u * Math.PI * 2) as [
        number,
        number,
        number,
        number,
      ]
      path =
        current.loop > 0
          ? createLoop(
              current.loop,
              current.corners,
              phases[0],
              phases[1],
              observer.x,
              observer.y,
              observer.course,
              current.climb,
              current.hills,
              phases[2],
              phases[3],
            )
          : createPath(
              current.bend,
              current.meander,
              phases[0],
              phases[1],
              current.climb,
              current.hills,
              phases[2],
              phases[3],
            )
      for (const person of people) person.pathAt = -1
    }
    structured = Number.isFinite(halfWidth) && (lining > 0 || !path.straight)
    stalls = createStalls(current.stalls, current.aisle, current.seed)
    const asked = Math.max(6, current.reach)
    const affordable = affordableRadius()
    budgeted = affordable < asked
    world = Math.min(asked, affordable)

    if (structured) {
      placeStructured()
      hash()
      return
    }

    // Back from a lined scene: the watchers have nowhere to stand.
    if (people.some((person) => person.watcher)) {
      const kept = people.filter((person) => !person.watcher)
      people.length = 0
      people.push(...kept)
    }

    const target = Math.min(MAX_PEOPLE, Math.round((current.density / 100) * groundArea(world)))

    while (people.length > target) people.pop()

    // **Placed so that nobody starts inside anybody**, by rejection against a
    // grid built as they go.
    //
    // A uniform scatter is the obvious thing and it puts a few dozen pairs of
    // heads through each other at t = 0, which the avoidance then spends a
    // second or two pushing apart — visibly, in the middle of the frame, on
    // every landing. It is also the whole reason the still and the poster used
    // to need a long settle: what they were waiting for was mostly this, and
    // this costs one pass instead of ten thousand steps.
    //
    // Ten tries then give up. At the densest scene the crowd is a tenth of
    // close packing, so a tenth of a per cent of placements exhaust their
    // tries, and one of those is a pair the first step separates.
    const placed = new Map<number, Person[]>()
    for (const person of people) {
      const k = key(Math.floor(person.x / CELL), Math.floor(person.y / CELL))
      const bucket = placed.get(k)
      if (bucket) bucket.push(person)
      else placed.set(k, [person])
    }

    const clearOf = (x: number, y: number, radius: number): boolean => {
      const cx = Math.floor(x / CELL)
      const cy = Math.floor(y / CELL)
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = placed.get(key(cx + ox, cy + oy))
          if (!bucket) continue
          for (const other of bucket) {
            const dx = other.x - x
            const dy = other.y - y
            const room = radius + other.radius
            if (dx * dx + dy * dy < room * room) return false
          }
        }
      }
      return true
    }

    while (people.length < target) {
      let x = 0
      let y = 0
      let room = false
      for (let attempt = 0; attempt < 10 && !room; attempt++) {
        // **Laterally the corridor is fixed in the world, not carried with the
        // observer.** One that followed them sideways would keep them
        // permanently down its middle, which is not what walking along a street
        // is like — you drift toward one side and stay there for a while.
        const spot = corridorPoint(place, world, observer.y, halfWidth)
        x = observer.x + spot.x
        y = observer.y + spot.y
        // A generous guess at the radius before the person exists. Bodies vary
        // by a third and the check that matters is the one after they do, which
        // the first step performs anyway.
        room = clearOf(x, y, 0.3 * current.spacing) && !stalls.blocked(x, y, 0.4)
      }
      const person = spawn(people.length, x, y)
      const k = key(Math.floor(x / CELL), Math.floor(y / CELL))
      const bucket = placed.get(k)
      if (bucket) bucket.push(person)
      else placed.set(k, [person])
    }

    // **The hash holds indices, so shrinking the crowd invalidates it.**
    //
    // Not a stale-neighbour problem — a crash. `stroll.step` runs *before*
    // `throng.step` and reads the hash from the previous step, so a `restock`
    // that pops anybody leaves the observer dereferencing people who no longer
    // exist on the very next frame: "Cannot read properties of undefined". It
    // reaches the page from an ordinary drag of the density slider, and it only
    // fires in the direction that makes the crowd smaller, which is why it
    // survived every unit test here — none of them shrink a crowd — and was
    // caught by the browser spec's settings round trip.
    hash()
  }

  /**
   * Fill a lined or bending way: walkers on it, watchers either side.
   *
   * Two populations with two densities, so each is counted, trimmed and topped
   * up on its own — and then walkers are sorted ahead of watchers, which is
   * what lets a group be a contiguous run of walkers and a companion be one of
   * the first few people, both of which the rest of this file relies on.
   */
  function placeStructured(): void {
    const scale = Math.min(1, MAX_PEOPLE / Math.max(1, population(world)))
    const wantWalkers = Math.round((current.density / 100) * wayArea(world) * scale)
    const wantWatchers = Math.round((current.watchers / 100) * liningGround(world) * scale)

    let walkers = 0
    let watchers = 0
    for (let i = people.length - 1; i >= 0; i--) {
      if (people[i]!.watcher) watchers++
      else walkers++
    }
    for (let i = people.length - 1; i >= 0 && (walkers > wantWalkers || watchers > wantWatchers); i--) {
      const person = people[i]!
      if (person.companion) continue
      if (person.watcher && watchers > wantWatchers) {
        people.splice(i, 1)
        watchers--
      } else if (!person.watcher && walkers > wantWalkers) {
        people.splice(i, 1)
        walkers--
      }
    }

    // Anybody left over from a scene with a different shape is put back where
    // their role says they belong, rather than left standing in the road.
    // Only those out of place, so dragging a slider does not reshuffle a crowd
    // that was already where it should be.
    for (const person of people) {
      if (person.companion) continue
      const lat = Math.abs(path.frame(person.x, person.y, frameMine, person).lateral)
      const inside = person.watcher ? lat >= halfWidth && lat <= halfWidth + lining : lat <= halfWidth
      const dx = person.x - observer.x
      const dy = person.y - observer.y
      if (inside && dx * dx + dy * dy <= world * world) continue
      const spot = person.watcher
        ? path.sample(place, world, observer.x, observer.y, halfWidth, halfWidth + lining)
        : path.sample(place, world, observer.x, observer.y, 0, halfWidth)
      person.x = spot.x
      person.y = spot.y
      person.pathAt = -1
    }

    while (walkers < wantWalkers) {
      const spot = path.sample(place, world, observer.x, observer.y, 0, halfWidth)
      spawn(500_000 + spawned++, spot.x, spot.y, false)
      walkers++
    }
    while (watchers < wantWatchers) {
      const spot = path.sample(place, world, observer.x, observer.y, halfWidth, halfWidth + lining)
      spawn(500_000 + spawned++, spot.x, spot.y, true)
      watchers++
    }

    // Stable, so the walkers keep their order and the companions stay first.
    const sorted = [...people.filter((p) => !p.watcher), ...people.filter((p) => p.watcher)]
    people.length = 0
    people.push(...sorted)
  }

  /**
   * Make one person at a stated place.
   *
   * Everything that distinguishes them is drawn here and never redrawn, which is
   * what makes a seed mean something: the same seed puts the same strangers in
   * the same order, whatever else is dragged afterwards.
   */
  function spawn(index: number, x: number, y: number, watcher = false): Person {
    const rng = bodyRng(index)
    const child = rng() < current.children
    const stature = child ? statureAtAge(CHILD_AGES.min + rng() * (CHILD_AGES.max - CHILD_AGES.min)) : adultStature(rng)

    const band = current.paceHigh - current.paceLow
    const adultSpeed = current.paceLow + rng() * band
    const preferred = child ? freeSpeed(stature, adultSpeed / 1.34) : adultSpeed

    const standing = rng() < current.standing || watcher
    const angle = aisleWise(heading(rng, observer.axis, current.stream, current.against), rng)

    const person: Person = {
      x,
      y,
      vx: standing ? 0 : Math.cos(angle) * preferred,
      vy: standing ? 0 : Math.sin(angle) * preferred,
      gx: standing ? 0 : Math.cos(angle),
      gy: standing ? 0 : Math.sin(angle),
      stature,
      head: headCentre(stature),
      headR: headBreadth(stature) / 2,
      radius: bodyRadius(stature) * current.spacing,
      preferred,
      phase: rng() * Math.PI * 2,
      group: -1,
      slotRight: 0,
      slotBack: 0,
      child,
      standing,
      watcher,
      companion: false,
      besideRight: 0,
      besideAhead: 0,
      quarry: false,
      running: false,
      pathAt: -1,
      junction: -1,
    }
    people.push(person)
    return person
  }

  /**
   * Put one person back into the world on the side they would have come from.
   *
   * Reusing the person rather than making a new one keeps who is out there
   * stable — the crowd is the same crowd all the way through a walk, met again
   * from the other side, which is both cheaper and closer to true: the strangers
   * in a square are a fixed population you keep half-recognising.
   */
  function reenter(person: Person): void {
    reentries++
    const ux = person.vx - observer.vx
    const uy = person.vy - observer.vy
    const angle = entryAngle(place, ux, uy)
    // A shade inside the boundary, so the same person is not re-entered on the
    // very next step by a rounding error.
    const r = world * 0.985
    if (structured) {
      const spot = person.watcher
        ? path.entry(place, angle, r, observer.x, observer.y, halfWidth, halfWidth + lining)
        : path.entry(place, angle, r, observer.x, observer.y, 0, halfWidth)
      person.x = spot.x
      person.y = spot.y
      person.pathAt = -1
      const next = aisleWise(heading(place, observer.axis, current.stream, current.against), place)
      person.standing = person.watcher || (person.group === -1 && place() < current.standing)
      person.gx = person.standing ? 0 : Math.cos(next)
      person.gy = person.standing ? 0 : Math.sin(next)
      const along = path.frame(person.x, person.y, frameMine, person)
      person.vx = (person.gx * along.cos - person.gy * along.sin) * person.preferred
      person.vy = (person.gx * along.sin + person.gy * along.cos) * person.preferred
      return
    }
    // In a corridor most of the circle is outside the walls, so the flux angle
    // is resampled until it lands somewhere a person could actually be. It
    // converges fast because a corridor crowd is walking along the corridor, so
    // the angle it wants is already near one of the two open ends.
    let px = observer.x + Math.cos(angle) * r
    let py = observer.y + Math.sin(angle) * r
    for (let attempt = 0; (Math.abs(py) > halfWidth || stalls.blocked(px, py, 0.4)) && attempt < 12; attempt++) {
      const retry = entryAngle(place, ux, uy)
      px = observer.x + Math.cos(retry) * r
      py = observer.y + Math.sin(retry) * r
    }
    person.x = px
    person.y = Math.max(-halfWidth, Math.min(halfWidth, py))

    // A fresh errand, so a long walk does not turn into the same faces on the
    // same headings for ever. Everything about the body is kept.
    const next = aisleWise(heading(place, observer.axis, current.stream, current.against), place)
    person.standing = person.group === -1 && place() < current.standing
    person.gx = person.standing ? 0 : Math.cos(next)
    person.gy = person.standing ? 0 : Math.sin(next)
    person.vx = person.gx * person.preferred
    person.vy = person.gy * person.preferred
  }

  /**
   * Bind some of the crowd into groups.
   *
   * Done after the population exists rather than at spawn time, because a group
   * is an arrangement of people who are already there — and because the number
   * of them has to answer to `grouping`, which is a fraction of the crowd rather
   * than a rate of arrival.
   */
  function regroup(): void {
    groups = []
    nextGroup = 0
    for (const person of people) {
      person.group = -1
      person.slotRight = 0
      person.slotBack = 0
    }

    // Watchers are sorted to the end and never grouped, so only walkers count.
    let walkers = people.length
    while (walkers > 0 && people[walkers - 1]!.watcher) walkers--
    const wanted = Math.round(walkers * current.grouping)
    const team = Math.round(current.team)
    let bound = 0
    let at = 0

    while (bound < wanted && at < walkers) {
      // Pairs are much the commonest, then threes; anything bigger is rare and
      // is what the arc formation exists for. A team is its own size, always.
      const roll = cut()
      const size = team >= 2 ? team : roll < 0.58 ? 2 : roll < 0.84 ? 3 : roll < 0.95 ? 4 : 5
      if (at + size > walkers) break

      const lead = people[at]!
      const angle = Math.atan2(lead.gy, lead.gx)
      const group: Group = {
        hx: Math.cos(angle),
        hy: Math.sin(angle),
        speed: lead.preferred,
        size,
        standing: cut() < current.standing,
      }
      const index = nextGroup++
      groups.push(group)

      // A team walks in a block: rows, a few abreast, with the lead at the
      // front corner and everybody placed relative to them.
      const across = Math.min(4, Math.ceil(Math.sqrt(size)))

      for (let i = 0; i < size; i++) {
        const member = people[at + i]!
        member.group = index
        if (team >= 2) {
          member.slotRight = (i % across) * 0.8
          member.slotBack = -Math.floor(i / across) * 1.05
        } else {
          // Abreast, 0.75 m apart, centred. Four and more bend into a shallow arc
          // with the middle lagging, which is the arrangement in which everyone
          // can see everyone else's face — and it flattens under pressure on its
          // own, because the formation is a preference and avoidance is a force.
          member.slotRight = (i - (size - 1) / 2) * 0.75
          member.slotBack = size >= 4 ? -0.35 * (1 - Math.abs(i - (size - 1) / 2) / ((size - 1) / 2)) : 0
        }
        member.standing = group.standing
        // A group walks at its slowest member's pace, which is how a family with
        // a four-year-old in it comes out slow without anything saying so.
        group.speed = Math.min(group.speed, member.preferred)
        // Re-placed beside the leader, or the group spends its first minute
        // converging from across the square.
        if (i > 0) {
          member.x = lead.x + group.hx * member.slotBack - group.hy * member.slotRight
          member.y = lead.y + group.hy * member.slotBack + group.hx * member.slotRight
        }
      }
      bound += size
      at += size
    }
  }

  /** Rebuild the spatial hash over the people close enough to be interacting. */
  function hash(): void {
    cells.clear()
    avoiding = 0
    for (let i = 0; i < people.length; i++) {
      const person = people[i]!
      const dx = person.x - observer.x
      const dy = person.y - observer.y
      if (dx * dx + dy * dy > detail * detail) continue
      avoiding++
      const k = key(Math.floor(person.x / CELL), Math.floor(person.y / CELL))
      const bucket = cells.get(k)
      if (bucket) bucket.push(i)
      else cells.set(k, [i])
    }
  }

  /**
   * Scratch frames: one for the person being stepped, one for their group's
   * lead, because a formation slot is laid out in the lead's frame and asking
   * for it must not overwrite the person's own.
   */
  const frameMine: Frame = { lateral: 0, cos: 1, sin: 0 }
  const frameLead: Frame = { lateral: 0, cos: 1, sin: 0 }

  /**
   * What one person would like to be doing, before anybody is in the way.
   *
   * **A heading is held in the path's frame, not the world's**, and turned onto
   * the path wherever the person happens to be. On a straight way the turn is
   * the identity; on a trail it is what makes the stream follow the bends,
   * which nothing else in the piece knows about.
   */
  function desired(person: Person, out: { x: number; y: number }, along: Frame): void {
    wanted(person, out)
    if (person.companion) return
    if (!path.straight) {
      const { cos, sin } = along
      const x = out.x
      out.x = x * cos - out.y * sin
      out.y = x * sin + out.y * cos
    }
    // Slower up a climb and a little slower down a steep one. A companion is
    // exempt because they match the observer, who has already been slowed.
    if (!path.flat && current.effort > 0) {
      const speed = Math.sqrt(out.x * out.x + out.y * out.y)
      if (speed > 1e-6) {
        const pace = hikingPace((path.groundSlope(person.x) * out.x) / speed, current.effort)
        out.x *= pace
        out.y *= pace
      }
    }
  }

  /**
   * A heading laid onto the aisles, when there are stalls: the nearest of the
   * four, with a few degrees of slop so a file of people is not on a wire.
   */
  function aisleWise(angle: number, rng: Rng): number {
    if (!stalls.active) return angle
    const quarter = Math.PI / 2
    return Math.round(angle / quarter) * quarter + (rng() - 0.5) * 0.12
  }

  /** How often somebody walking into a crossing turns out of it. */
  const TURN_AT_CROSSING = 0.3

  /**
   * One decision per crossing: straight on, or a quarter turn either way. A
   * group decides as one, by its lead, since a family does not split at a
   * corner.
   */
  function turnAtCrossing(person: Person, i: number): void {
    keepToAisle(person, i)
    const crossing = stalls.junction(person.x, person.y)
    if (crossing < 0 || crossing === person.junction) return
    person.junction = crossing
    if (place() >= TURN_AT_CROSSING) return
    const side = place() < 0.5 ? 1 : -1
    if (person.group >= 0) {
      if (indexInGroup(i) !== 0) return
      const group = groups[person.group]!
      const hx = group.hx
      group.hx = -group.hy * side
      group.hy = hx * side
      return
    }
    const gx = person.gx
    person.gx = -person.gy * side
    person.gy = gx * side
  }

  /**
   * Re-aim anybody whose heading does not fit the aisle they are in.
   *
   * **A turn chosen at a crossing is finished outside it.** At a run the body
   * takes most of an aisle's width to come round, so a runaway who decided at
   * the edge of a crossing came out of the far side facing across the next
   * stretch — straight into a stall, where they stayed. Measured on one seed:
   * pinned for 172 seconds with me half a metre behind, which is the
   * "wrestling" Andrei saw. So a heading that crosses its own aisle is laid
   * back along it, whichever way along is nearer to where they were facing.
   */
  function keepToAisle(person: Person, i: number): void {
    const runs = stalls.runs(person.x, person.y)
    if (runs === 3 || runs === 0) return
    const group = person.group >= 0 ? groups[person.group]! : null
    if (group && indexInGroup(i) !== 0) return
    const hx = group ? group.hx : person.gx
    const hy = group ? group.hy : person.gy
    const along = runs === 1 ? Math.abs(hx) : Math.abs(hy)
    if (along > 0.7) return
    const nx = runs === 1 ? (hx >= 0 ? 1 : -1) : 0
    const ny = runs === 2 ? (hy >= 0 ? 1 : -1) : 0
    if (group) {
      group.hx = nx
      group.hy = ny
    } else {
      person.gx = nx
      person.gy = ny
    }
  }

  /** Whether the person in red is running off, or dawdling and letting me close. */
  let fleeing = true
  /**
   * Seconds left of being caught, or 0. **Being caught is a state of its own**:
   * "if i catch them we can stand together for a little bit, then they run away
   * and I chase them again. tom and jerry style." Without it a catch was a
   * runaway dawdling beside me while I circled them, which read as wrestling.
   */
  let caughtFor = 0
  /** How far they run before stopping, and how close they let me get before running again. Redrawn each time. */
  let farGap = 14
  let nearGap = 3

  /**
   * How the person in red wants to move: two states, and the switching between
   * them is the chase.
   *
   * **A pace that varies smoothly with distance does not make a chase — it was
   * built first and measured.** Any such law has a distance at which their pace
   * equals mine, and the gap settles there: two minutes of the market ended on
   * 4 m, 4 m, 4 m, 4 m, whatever the shape of the ramp. What a child who has
   * run off actually does is a relaxation oscillator. They run until they are
   * far enough away to feel safe, stop and dawdle — looking at something,
   * looking back — until you are nearly on them, and run again. Two states with
   * a gap between their thresholds cannot settle, which is the point.
   *
   * Both thresholds are redrawn at every switch, so the rhythm does not repeat.
   * On open ground their heading wanders and bends away from me when I am
   * close; in a corridor it is the way itself, like everybody's.
   */
  function flee(person: Person, dt: number): void {
    const dx = person.x - observer.x
    const dy = person.y - observer.y
    const d = Math.sqrt(dx * dx + dy * dy)
    // Caught: stand together, then bolt with a head start. The bolt goes down
    // whichever way along their aisle is further from me.
    if (caughtFor > 0) {
      caughtFor -= dt
      person.preferred = 0
      if (caughtFor <= 0) {
        caughtFor = 0
        fleeing = true
        farGap = 9 + place() * 12
        const away = Math.atan2(dy, dx)
        const quarter = Math.PI / 2
        const heading = stalls.active ? Math.round(away / quarter) * quarter : away
        person.gx = Math.cos(heading)
        person.gy = Math.sin(heading)
        person.preferred = Math.max(0.6, current.walk) * current.flee * 1.3
      }
      return
    }
    if (d < CAUGHT_AT) {
      caughtFor = CAUGHT_FOR[0] + place() * (CAUGHT_FOR[1] - CAUGHT_FOR[0])
      person.preferred = 0
      return
    }
    if (fleeing && d > farGap) {
      fleeing = false
      // Some of the time they do not see me coming, and I catch them.
      nearGap = place() < CAUGHT_SHARE ? 0 : 2 + place() * 2.5
    } else if (!fleeing && d < nearGap) {
      fleeing = true
      farGap = 9 + place() * 12
    }
    let heading = Math.atan2(person.gy, person.gx)
    if (stalls.active) {
      // **In the aisles, a runaway picks a way at each crossing, and prefers a
      // corner.** Scoring by distance from me alone was built first: from
      // behind in the same aisle straight on always wins, so they ran down it
      // dead ahead of me and sat in the middle of the frame 77% of the time —
      // the crosshair the stalls were meant to break. A child trying to lose
      // you ducks round corners, so a turn is favoured, and a way back toward
      // me is never taken.
      const crossing = stalls.junction(person.x, person.y)
      if (crossing >= 0 && crossing !== person.junction) {
        person.junction = crossing
        const quarter = Math.PI / 2
        const base = Math.round(heading / quarter) * quarter
        let best = base
        let bestScore = -Infinity
        for (const turn of [0, quarter, -quarter]) {
          const h = base + turn
          const away = (Math.cos(h) * dx + Math.sin(h) * dy) / Math.max(1, d)
          if (away < -0.3) continue
          const score = away * 0.5 + place() + (turn === 0 ? 0 : 0.7)
          if (score > bestScore) {
            bestScore = score
            best = h
          }
        }
        heading = best
      }
      person.gx = Math.cos(heading)
      person.gy = Math.sin(heading)
      // Laid back along the aisle if a turn has carried them past the crossing.
      const runs = stalls.runs(person.x, person.y)
      if (runs === 1 && Math.abs(person.gx) < 0.7) {
        person.gx = person.gx >= 0 ? 1 : -1
        person.gy = 0
      } else if (runs === 2 && Math.abs(person.gy) < 0.7) {
        person.gx = 0
        person.gy = person.gy >= 0 ? 1 : -1
      }
      const mine = Math.max(0.6, current.walk)
      person.preferred = fleeing ? mine * current.flee : mine * 0.2
      return
    }
    heading += (place() - 0.5) * (fleeing ? 0.9 : 3) * Math.sqrt(dt) * 2
    if (!Number.isFinite(halfWidth) && d > 1e-3) {
      // Away from me, harder the closer I am, and only while running: a child
      // dawdling is not steering.
      const away = Math.atan2(dy, dx)
      let off = away - heading
      while (off > Math.PI) off -= Math.PI * 2
      while (off < -Math.PI) off += Math.PI * 2
      if (fleeing) heading += off * Math.min(1, 4 / Math.max(1, d)) * dt * 2
    } else {
      // Along the way, forward: in a corridor nobody runs off sideways.
      let off = heading
      while (off > Math.PI) off -= Math.PI * 2
      while (off < -Math.PI) off += Math.PI * 2
      heading -= off * dt * 2
    }
    person.gx = Math.cos(heading)
    person.gy = Math.sin(heading)
    const mine = Math.max(0.6, current.walk)
    person.preferred = fleeing ? mine * current.flee : mine * 0.2
  }

  function wanted(person: Person, out: { x: number; y: number }): void {
    if (person.companion) {
      // Matching the observer rather than pursuing their own errand. A companion
      // who drew their own preferred speed would spend the walk drifting ahead
      // or behind and being hauled back by the formation spring.
      out.x = observer.vx
      out.y = observer.vy
      return
    }
    if (person.group >= 0) {
      const group = groups[person.group]!
      if (group.standing) {
        out.x = 0
        out.y = 0
        return
      }
      out.x = group.hx * group.speed
      out.y = group.hy * group.speed
      return
    }
    if (person.standing) {
      out.x = 0
      out.y = 0
      return
    }
    out.x = person.gx * person.preferred
    out.y = person.gy * person.preferred
  }

  const want = { x: 0, y: 0 }

  function step(dt: number): void {
    clock += dt
    hash()

    const strength = 1.9 * current.spacing * current.spacing
    const detailSq = detail * detail
    const neighbourSq = NEIGHBOUR * NEIGHBOUR
    const worldSq = world * world
    const accelSq = MAX_ACCEL * MAX_ACCEL
    closest = Infinity
    overlaps = 0
    overlapsSeen = 0
    const seenSq = SEEN * SEEN
    let nearestSq = Infinity

    for (let i = 0; i < people.length; i++) {
      const person = people[i]!

      if (person.quarry) flee(person, dt)
      // Once per person per step: where they are on the way, which the
      // heading, the walls and the lane all want.
      const here = path.frame(person.x, person.y, frameMine, person)
      desired(person, want, here)

      force.x = (want.x - person.vx) * RETURN
      force.y = (want.y - person.vy) * RETURN

      const dxo = person.x - observer.x
      const dyo = person.y - observer.y
      const fromObserverSq = dxo * dxo + dyo * dyo
      if (fromObserverSq < nearestSq) nearestSq = fromObserverSq

      // **Everything below the `if` is skipped for most of the crowd**, and that
      // is the whole performance story of this piece: at a market's density only
      // about one person in ten is inside the detail radius, and the other nine
      // cost an integration and nothing else.
      const near = fromObserverSq <= detailSq

      if (near) {
        // A companion is pulled toward their place beside the observer, in the
        // observer's own frame, so the pair turns as a pair.
        if (person.companion) {
          const cos = Math.cos(observer.course)
          const sin = Math.sin(observer.course)
          const slotX = observer.x + cos * person.besideAhead - sin * person.besideRight
          const slotY = observer.y + sin * person.besideAhead + cos * person.besideRight
          force.x += (slotX - person.x) * COMPANION_SPRING
          force.y += (slotY - person.y) * COMPANION_SPRING
        }

        // A group member is pulled toward its place in the formation. A spring
        // rather than a hard constraint, so the formation gives way when the
        // crowd presses on it — which is why a wide group narrows to get through
        // a gap without anything measuring the gap.
        if (person.group >= 0) {
          const group = groups[person.group]!
          const lead = people[i - indexInGroup(i)]!
          if (person !== lead) {
            const { cos, sin } = path.frame(lead.x, lead.y, frameLead, lead)
            const hx = group.hx * cos - group.hy * sin
            const hy = group.hx * sin + group.hy * cos
            const slotX = lead.x + hx * person.slotBack - hy * person.slotRight
            const slotY = lead.y + hy * person.slotBack + hx * person.slotRight
            force.x += (slotX - person.x) * 1.6
            force.y += (slotY - person.y) * 1.6
          }
        }

        const cx = Math.floor(person.x / CELL)
        const cy = Math.floor(person.y / CELL)
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const bucket = cells.get(key(cx + ox, cy + oy))
            if (!bucket) continue
            for (let b = 0; b < bucket.length; b++) {
              const j = bucket[b]!
              if (j === i) continue
              const other = people[j]!
              const gapX = other.x - person.x
              const gapY = other.y - person.y
              const gapSq = gapX * gapX + gapY * gapY
              if (gapSq > neighbourSq) continue
              const clearance = Math.sqrt(gapSq) - person.radius - other.radius
              if (clearance < closest) closest = clearance
              if (clearance < 0 && j > i) {
                overlaps++
                if (fromObserverSq < seenSq) overlapsSeen++
              }
              avoid(person, other, strength, force)
            }
          }
        }

        // The observer is a person in the crowd and is avoided as one. Without
        // this the walk is a ghost's: heads pass through the camera, which is
        // the single most obviously wrong thing this piece can do.
        avoid(person, observer, strength * 1.15, force)
      }

      // The stalls, and a decision at every aisle crossing: straight on, or
      // round the corner. Which is what makes a market's crowd a grid of
      // streams rather than a square with obstacles in it.
      if (stalls.active) {
        stalls.push(person.x, person.y, force)
        if (!person.standing && !person.companion && !person.quarry && !person.watcher) turnAtCrossing(person, i)
      }

      // The corridor, if there is one. One-sided and linear, so it reads as the
      // ground running out rather than as a barrier being hit. Pushed along the
      // path's normal, which on a straight one is `y`.
      if (structured) {
        const lat = here.lateral
        const { cos, sin } = here
        const side = Math.sign(lat)
        let push = 0
        if (person.watcher) {
          // Held in the lining from both sides: off the way, and not wandering
          // off the back of the crowd.
          const kerb = halfWidth + WALL_SOFTEN - Math.abs(lat)
          if (kerb > 0) push += kerb * 7
          const back = Math.abs(lat) - (halfWidth + lining) + WALL_SOFTEN
          if (back > 0) push -= back * 7
        } else {
          const outside = Math.abs(lat) - halfWidth + WALL_SOFTEN
          if (outside > 0) push -= outside * 7
        }
        force.x += -sin * side * push
        force.y += cos * side * push
      } else {
        const outside = Math.abs(person.y) - halfWidth + WALL_SOFTEN
        if (outside > 0) force.y -= Math.sign(person.y) * outside * 7
      }

      // Which side of the way to walk on. Only for somebody going somewhere:
      // a watcher, a standing person and a companion — who follows me — are
      // exempt, and so is open ground, which has no sides.
      if (current.keep !== 0 && !person.standing && !person.companion && Number.isFinite(halfWidth)) {
        const speed = Math.sqrt(want.x * want.x + want.y * want.y)
        if (speed > 1e-6) {
          const { cos, sin } = here
          const heading = (want.x * cos + want.y * sin) / speed
          const push = lanePush(here.lateral, halfWidth, heading, current.keep)
          force.x += -sin * push
          force.y += cos * push
        }
      }

      const magnitudeSq = force.x * force.x + force.y * force.y
      if (magnitudeSq > accelSq) {
        const scale = MAX_ACCEL / Math.sqrt(magnitudeSq)
        force.x *= scale
        force.y *= scale
      }

      person.vx += force.x * dt
      person.vy += force.y * dt
      person.x += person.vx * dt
      person.y += person.vy * dt

      // **The gait is only advanced where it can be seen**, which is the same
      // trade the avoidance makes and for a sharper reason: `cadence` costs a
      // `Math.pow`, and the head's rise at the detail radius is six tenths of a
      // pixel. A frozen phase resumes wherever it was left, and phase is
      // arbitrary, so there is nothing to see at the boundary either.
      if (near) {
        const speed = Math.sqrt(person.vx * person.vx + person.vy * person.vy)
        // The same gait switch as mine, with the same hysteresis — a companion
        // keeping up with a runner runs, and a person who breaks into a jog is
        // drawn bouncing rather than walking fast.
        const threshold = runSpeed(person.stature)
        if (!person.running && speed > threshold * 1.04) person.running = true
        else if (person.running && speed < threshold * 0.9) person.running = false
        const rate = person.running
          ? runCadence(person.stature, speed)
          : cadence(person.stature, speed, person.preferred)
        person.phase += rate * dt * Math.PI * 2
      }

      // A companion is never re-entered: being the one person still there in a
      // minute's time is the whole of what they are.
      if (!person.companion && !person.quarry) {
        const ndx = person.x - observer.x
        const ndy = person.y - observer.y
        if (ndx * ndx + ndy * ndy > worldSq) reenter(person)
      }
    }

    nearest = Math.sqrt(nearestSq)
  }

  /**
   * Where a person sits inside their own group's run of members.
   *
   * People in one group are contiguous in the array by construction — `regroup`
   * walks the array in order — so this is arithmetic rather than a search, and
   * the lead is `i` minus this.
   */
  function indexInGroup(i: number): number {
    const group = people[i]!.group
    let back = 0
    while (back < i && people[i - back - 1]!.group === group) back++
    return back
  }

  restock()
  regroup()
  pairUp()
  hash()

  function quarryDistance(): number {
    const runaway = people.find((person) => person.quarry)
    return runaway ? Math.hypot(runaway.x - observer.x, runaway.y - observer.y) : 0
  }

  /** Scratch for `neighbours`, reused: this is called twice per step. */
  const found: Person[] = []

  return {
    get people() {
      return people
    },
    get groups() {
      return groups
    },
    get clock() {
      return clock
    },
    get world() {
      return world
    },

    /** Half the corridor, so the observer is held inside the same walls the crowd is. */
    /**
     * The people walking with the observer, for the gaze to find.
     *
     * Filtered rather than held as a second array, because there are at most
     * three of them and a second array is a second thing to keep in step with
     * `restock` popping people off the end.
     */
    get companions() {
      return people.filter((person) => person.companion)
    },

    get halfWidth() {
      return halfWidth
    },

    /** The stalls, so I walk round the same ones everybody else does. */
    get stalls() {
      return stalls
    },

    /** Whether I have just caught the one in red, and we are standing together. */
    get caught(): boolean {
      return caughtFor > 0
    },

    /** The one in red, if there is one. */
    get quarry(): Person | null {
      return people.find((person) => person.quarry) ?? null
    },

    /** The line the way follows, so the observer walks the same bends the crowd does. */
    get path() {
      return path
    },

    step,

    /**
     * Everybody within `radius` of a point, from the spatial hash.
     *
     * **Only people inside the detail radius are in the hash at all**, which is
     * deliberate and is the same trade the avoidance makes: the observer cannot
     * be asked to negotiate with somebody forty metres away, and would get
     * nothing from it if they could.
     *
     * The array is reused between calls, so a caller must finish with it before
     * calling again. Two calls per step over a few thousand people is enough for
     * the allocation to show up in a profile.
     */
    neighbours(x: number, y: number, radius: number): Person[] {
      found.length = 0
      const reach = Math.ceil(radius / CELL)
      const radiusSq = radius * radius
      const cx = Math.floor(x / CELL)
      const cy = Math.floor(y / CELL)
      for (let ox = -reach; ox <= reach; ox++) {
        for (let oy = -reach; oy <= reach; oy++) {
          const bucket = cells.get(key(cx + ox, cy + oy))
          if (!bucket) continue
          for (const i of bucket) {
            const person = people[i]!
            const dx = person.x - x
            const dy = person.y - y
            if (dx * dx + dy * dy <= radiusSq) found.push(person)
          }
        }
      }
      return found
    },

    /** Re-read settings that do not change who is out there. */
    resettle(next: Settings): void {
      const before = current
      current = next
      detail = detailFor(current)
      for (const person of people) {
        person.radius = bodyRadius(person.stature) * current.spacing
      }
      if (before.grouping !== current.grouping || before.team !== current.team) {
        regroup()
        pairUp()
      }
    },

    /** Change how big the world is and how many people are in it. */
    restock(next: Settings): void {
      current = next
      detail = detailFor(current)
      // Re-derived rather than continued, so the crowd at a given density is the
      // same crowd however it was arrived at — dragged up from below, down from
      // above, or landed on.
      place = makeRng(hashSeed(current.seed, 2))
      cut = makeRng(hashSeed(current.seed, 3))
      restock()
      regroup()
      pairUp()
    },

    stats(): ThrongStats {
      let children = 0
      let grouped = 0
      let withMe = 0
      let watching = 0
      for (const person of people) {
        if (person.child) children++
        if (person.group >= 0) grouped++
        if (person.companion) withMe++
        if (person.watcher) watching++
      }
      return {
        people: people.length,
        avoiding,
        world,
        budgeted,
        halfWidth,
        edge: Math.exp(-world / Math.max(0.5, current.fade)),
        children,
        grouped,
        companions: withMe,
        watchers: watching,
        teams: current.team >= 2 ? groups.length : 0,
        quarry: quarryDistance(),
        minRadius: path.minRadius,
        steepestClimb: path.steepestClimb,
        closest: Number.isFinite(closest) ? closest : 0,
        overlaps,
        overlapsSeen,
        nearest: Number.isFinite(nearest) ? nearest : 0,
        clock,
        reentries,
      }
    },
  }
}
