/**
 * White circles on black, and the two decisions that make that enough.
 *
 * ## Painter's order, because a near head has to block a far one
 *
 * Heads are sorted back to front and drawn in that order. On a black ground with
 * near-opaque near heads that is a depth buffer for free, and it is not
 * optional: without it a head twenty metres off shows *through* the head of
 * somebody passing at arm's length, and the crowd stops having any depth at all.
 *
 * ## One fill per brightness, not one per head — and it is a smaller win than it looks
 *
 * The alpha is quantised into 160 logarithmic steps and the heads, already
 * sorted by depth, come out with a monotonic alpha — so each bucket is one
 * contiguous run, and the number of `fill()` calls is bounded by the buckets
 * however many people there are. About 108 fills for 1,200 heads.
 *
 * **This docblock used to say that one fill per head was "several frames' worth
 * of work", and that is simply untrue.** Measured with `stats().drawMs`, at
 * 1,207 heads on a market scene:
 *
 * | fills | draw time |
 * | ----- | --------- |
 * | 108   | 1.09 ms   |
 * | 1,207 | 1.50 ms   |
 *
 * A 27% saving on a draw that is a fifteenth of a frame. Worth keeping, because
 * it costs four lines and scales with the head count rather than against it —
 * but **not what makes this piece affordable, and nobody should come here
 * looking for headroom.** The frame is the simulation: at the same scene the
 * anticipation is an order of magnitude more expensive than everything in this
 * file put together. `fps` cannot show that, because a frame loop capped by the
 * display reports 60 whether the draw takes 1 ms or 10, which is why `drawMs`
 * exists at all.
 *
 * **The quantisation is logarithmic because the fade is exponential.** Linear
 * buckets put 99% of their resolution in the first two metres and band the far
 * crowd into visible shells, which is exactly where all the heads are.
 *
 * ## A head smaller than a pixel keeps a floor, and that is a choice
 *
 * Canvas antialiasing conserves coverage, so a circle of radius 0.2 px comes out
 * at about a seventh of a pixel of ink — which fades a distant head by its
 * *area* on top of the fog that is already fading it, and the far crowd vanishes
 * a good deal sooner than the air says it should. Below half a pixel the screen
 * cannot say how big something is anyway; only how bright. So the radius has a
 * floor and the brightness carries the distance, which is what actually happens
 * when you look at a crowd.
 */

import { BOB_RISE, BOB_SWAY, RUN_RISE, RUN_SWAY, runBounce } from "@/experiments/crowd/body"
import type { Boulder } from "@/experiments/crowd/boulders"
import { CULL_ALPHA, horizonFor, project, sightSphere, type Camera, type SphereSight } from "@/experiments/crowd/camera"
import type { Person } from "@/experiments/crowd/throng"
import type { Settings } from "@/experiments/crowd/settings"

/** Pixels. Below this a head is a point source and only its brightness means anything. */
const MIN_RADIUS = 0.45

/** Logarithmic steps the alpha is cut into. 160 over the full range is about 3.4% apart. */
const BUCKETS = 160

const TAU = Math.PI * 2
const LOG_RANGE = Math.log(1 / CULL_ALPHA)

const bucketOf = (alpha: number): number =>
  Math.max(0, Math.min(BUCKETS - 1, Math.round((Math.log(alpha / CULL_ALPHA) / LOG_RANGE) * (BUCKETS - 1))))

const alphaOfBucket = (bucket: number): number => CULL_ALPHA * Math.exp((bucket / (BUCKETS - 1)) * LOG_RANGE)

/** One head, ready to draw. */
type Sighted = { sx: number; sy: number; r: number; depth: number; alpha: number; red: boolean; under: boolean }

/**
 * The colour of the one person I am chasing. Red because it is the colour the
 * eye finds first against white and black, and it is the only hue in the
 * piece that is not the scene's own — so it carries no hint of the settings.
 */
const QUARRY = "hsl(2, 88%, 56%)"

/**
 * The per-frame working set, owned by the scene and handed back in every frame.
 *
 * **Two arrays rather than one, and neither is ever reallocated.** `pool` holds
 * the objects and only ever grows; `order` holds references to the live prefix
 * of it and is what gets sorted. The obvious `pool.slice(0, seen)` allocates
 * four thousand references per frame at sixty frames a second, which is a
 * megabyte a minute of pure garbage for a piece whose whole cost is the frame.
 */
/** A boulder as the eye sees it, and which boulder it is. */
type Rock = SphereSight & { at: Boulder }

export type Scratch = { pool: Sighted[]; order: Sighted[]; rocks: Rock[]; rockOrder: Rock[] }

export const makeScratch = (): Scratch => ({ pool: [], order: [], rocks: [], rockOrder: [] })

const newSight = (): Rock => ({
  wx: 0,
  wy: 0,
  wz: 1,
  distance: 1,
  sin: 0,
  cos: 1,
  outline: [],
  at: { x: 0, y: 0, r: 0, side: 1 },
})

/**
 * What a boulder does to one head: `0` nothing, `1` hides it outright, `2` is
 * in front of part of it, so the head is painted before the boulder and the
 * boulder's edge cuts it.
 *
 * **Exact, per head, rather than painter's order with the boulders in the
 * sort.** A sphere has no single depth, and every depth it could be given is
 * wrong for somebody at its edge — which is exactly where people walking round
 * a boulder are. Given its centre's, somebody just behind the rim sorts in
 * front of it and shows through; given its nearest point's, somebody just in
 * front of the rim sorts behind it and vanishes. So the question is asked along
 * the head's own line of sight: does it enter the sphere before it reaches the
 * head?
 *
 * `(hx, hy, hz)` is the head in the eye's frame, `span` its radius in metres.
 */
function blockedBy(rock: SphereSight, hx: number, hy: number, hz: number, span: number): 0 | 1 | 2 {
  const length = Math.sqrt(hx * hx + hy * hy + hz * hz)
  const cosPsi = (hx * rock.wx + hy * rock.wy + hz * rock.wz) / length
  if (cosPsi >= rock.cos) {
    // The sight line enters the sphere. Where, is the nearer root.
    const b = rock.distance * cosPsi
    const root = Math.sqrt(Math.max(0, b * b - rock.distance * rock.distance * (1 - rock.sin * rock.sin)))
    return length > b - root ? 1 : 0
  }
  // Grazing: the head overlaps the silhouette's edge without its centre being
  // inside it. Behind the grazing ring, the edge cuts it.
  const sinRho = Math.min(1, span / length)
  const cosRho = Math.sqrt(1 - sinRho * sinRho)
  const edge = rock.cos * cosRho - rock.sin * sinRho
  if (cosPsi < edge) return 0
  return length > rock.distance * rock.cos ? 2 : 0
}

/**
 * The colour of a head.
 *
 * `tint` is what lets the hue through at all, so the primary scenes — which are
 * all `tint: 0` — come out white whatever `hue` says. That is the piece as it
 * was asked for; the hue still has to be a real value because the note, the
 * chrome and the index placard tint themselves from it.
 */
export function headColour(settings: Settings): string {
  const saturation = Math.round(settings.tint * 72)
  const lightness = Math.round(97 - settings.tint * 12)
  return `hsl(${Math.round(settings.hue)} ${saturation}% ${lightness}%)`
}

export type Frame = {
  /** Heads that reached the glass. */
  drawn: number
  /** How many fills the batching actually cost. */
  fills: number
  /** Screen radius of the largest head drawn, in CSS pixels. */
  largest: number
  /** Heads a boulder hid outright. */
  hidden: number
  /** Whether one of them was the person in red. */
  quarryHidden: boolean
  /** Heads a boulder's edge cuts, painted before the boulders so it can. */
  cut: number
  /** Boulders that threw an outline this frame. */
  rocks: number
}

/**
 * Draw one frame.
 *
 * `scratch` is handed in and reused: this allocates nothing per frame, because
 * at four thousand heads a fresh array of objects per frame is the frame.
 */
export function drawFrame(
  context: CanvasRenderingContext2D,
  options: {
    people: Person[]
    camera: Camera
    /** Height of the ground under a point, so a head on a hillside is drawn on it. */
    ground: (x: number) => number
    settings: Settings
    width: number
    height: number
    scratch: Scratch
    /** Boulders near enough to matter. Empty when there are none. */
    boulders: readonly Boulder[]
  },
): Frame {
  const { people, camera, settings, width, height } = options
  const { pool, order, rocks } = options.scratch

  // The boulders first, because every head is asked about each of them. Past
  // the horizon a boulder hides only what the air already has.
  const horizon = horizonFor(camera.fade)
  let rockCount = 0
  for (const boulder of options.boulders) {
    const slot = rocks[rockCount] ?? newSight()
    rocks[rockCount] = slot
    if (!sightSphere(camera, boulder.x, boulder.y, options.ground(boulder.x), boulder.r, slot)) continue
    if (slot.distance - boulder.r > horizon || slot.outline.length < 6) continue
    slot.at = boulder
    rockCount++
  }
  let hidden = 0
  let cut = 0
  let quarryHidden = false

  context.globalAlpha = 1
  context.fillStyle = "#000"
  context.fillRect(0, 0, width, height)

  const bob = settings.bob
  let seen = 0

  for (let i = 0; i < people.length; i++) {
    const person = people[i]!

    // The head's own gait. One cycle of rise per step, one of sway per stride —
    // which is two steps, hence the half. Too small to notice on anybody at ten
    // metres, and the reason a crowd at three metres is not a set of gliding
    // discs. `moving` fades it out as somebody stops.
    const speed = Math.hypot(person.vx, person.vy)
    const moving = Math.min(1, speed / 0.35)
    const rise = person.running ? runBounce(person.phase / TAU) * RUN_RISE : Math.sin(person.phase) * BOB_RISE
    const z = options.ground(person.x) + person.head + rise * bob * moving
    const sway = Math.sin(person.phase / 2) * (person.running ? RUN_SWAY : BOB_SWAY) * bob * moving
    // Perpendicular to the way they are walking, which is where a sway goes.
    const nx = speed > 1e-4 ? -person.vy / speed : 0
    const ny = speed > 1e-4 ? person.vx / speed : 0

    const sighting = project(camera, person.x + nx * sway, person.y + ny * sway, z)
    if (!sighting) continue
    if (sighting.alpha < CULL_ALPHA) continue

    const r = Math.max(MIN_RADIUS, sighting.scale * person.headR)
    // Off the side of the frame. Generous, because a head near the edge is
    // partly on screen and its centre is not.
    if (sighting.sx < -r - 2 || sighting.sx > width + r + 2) continue
    if (sighting.sy < -r - 2 || sighting.sy > height + r + 2) continue

    let under = false
    if (rockCount > 0) {
      // Back from the screen to the eye's frame, which is where the spheres are.
      const hz = sighting.depth
      const hx = ((sighting.sx - width / 2) * hz) / camera.focal
      const hy = (-(sighting.sy - height / 2) * hz) / camera.focal
      const span = r / sighting.scale
      let blocked = 0
      for (let k = 0; k < rockCount && blocked !== 1; k++) {
        const rock = rocks[k]!
        // **Standing inside its footprint is inside the boulder**, whatever the
        // sight line says. Only the detail radius is pushed off boulders, so
        // out past it people walk through them — and a dome is narrower at head
        // height than at the ground, so a head near the edge of the footprint is
        // outside the sphere and was drawn on the boulder's flank, at the
        // boulder's own distance. About one drawn head in ten past 24 m on a
        // honeycomb: "only the first two rows of boulders … are opaque".
        const fx = person.x - rock.at.x
        const fy = person.y - rock.at.y
        if (fx * fx + fy * fy < rock.at.r * rock.at.r) {
          blocked = 1
          break
        }
        const verdict = blockedBy(rock, hx, hy, hz, span)
        if (verdict > blocked) blocked = verdict
      }
      if (blocked === 1) {
        hidden++
        if (person.quarry) quarryHidden = true
        continue
      }
      under = blocked === 2
      if (under) cut++
    }

    let slot = pool[seen]
    if (!slot) {
      slot = { sx: 0, sy: 0, r: 0, depth: 0, alpha: 0, red: false, under: false }
      pool[seen] = slot
    }
    slot.red = person.quarry
    slot.under = under
    slot.sx = sighting.sx
    slot.sy = sighting.sy
    slot.r = r
    slot.depth = sighting.depth
    slot.alpha = sighting.alpha
    order[seen] = slot
    seen++
  }

  // Truncated rather than rebuilt, so the backing store survives from frame to
  // frame and a quiet frame after a busy one costs nothing.
  order.length = seen
  // Heads a boulder's edge cuts go first, then the boulders, then everyone
  // else — each run back to front. Boulders are black on black, so their order
  // among themselves cannot show.
  order.sort((a, b) => (a.under === b.under ? b.depth - a.depth : a.under ? -1 : 1))
  let rocksPainted = rockCount === 0

  context.fillStyle = headColour(settings)

  let bucket = -1
  let fills = 0
  let largest = 0
  context.beginPath()

  for (const head of order) {
    if (!rocksPainted && !head.under) {
      if (bucket >= 0) {
        context.globalAlpha = alphaOfBucket(bucket)
        context.fill()
        fills++
      }
      fills += paintRocks(context, options.scratch, rockCount, settings.shade, camera.fade)
      context.fillStyle = headColour(settings)
      context.beginPath()
      bucket = -1
      rocksPainted = true
    }
    const next = bucketOf(head.alpha)
    if (next !== bucket) {
      if (bucket >= 0) {
        context.globalAlpha = alphaOfBucket(bucket)
        context.fill()
        fills++
        context.beginPath()
      }
      bucket = next
    }
    // **The one red head is painted in order, not on top.** Flushing the batch
    // and drawing it on its own keeps painter's order, so somebody nearer who
    // steps in front still hides them — which is half of what makes a chase
    // through a crowd a chase.
    if (head.red) {
      if (bucket >= 0) {
        context.globalAlpha = alphaOfBucket(bucket)
        context.fill()
        fills++
      }
      context.beginPath()
      context.fillStyle = QUARRY
      context.globalAlpha = head.alpha
      context.moveTo(head.sx + head.r, head.sy)
      context.arc(head.sx, head.sy, head.r, 0, TAU)
      context.fill()
      fills++
      context.fillStyle = headColour(settings)
      context.beginPath()
      bucket = -1
      if (head.r > largest) largest = head.r
      continue
    }
    // `moveTo` first, or the arc is joined to the previous subpath by a line
    // across the frame — which looks exactly like a rendering bug and is one.
    context.moveTo(head.sx + head.r, head.sy)
    context.arc(head.sx, head.sy, head.r, 0, TAU)
    if (head.r > largest) largest = head.r
  }

  if (bucket >= 0) {
    context.globalAlpha = alphaOfBucket(bucket)
    context.fill()
    fills++
  }
  if (!rocksPainted) fills += paintRocks(context, options.scratch, rockCount, settings.shade, camera.fade)

  context.globalAlpha = 1
  return { drawn: seen, fills, largest, hidden, cut, quarryHidden, rocks: rockCount }
}

/**
 * Every boulder's outline, opaque, in the ground's own colour.
 *
 * One fill each rather than one path for all: in a single path two outlines
 * wound opposite ways would cancel where they overlap and leave a hole in the
 * middle of an island. There are tens of them, so the fills cost nothing.
 */
function paintRocks(
  context: CanvasRenderingContext2D,
  scratch: Scratch,
  count: number,
  shade: number,
  fade: number,
): number {
  context.globalAlpha = 1
  if (shade <= 0) {
    // The ground's own black: nothing shows, so neither the order nor the air matters.
    context.fillStyle = "#000"
  } else {
    // **Far to near, and through the same air as the heads.** An unfogged grey
    // is the one thing in the frame the distance does not touch, so it reads as
    // the nearest thing there is, and every faded head in front of a far
    // boulder looked like it was shining through it: "boulders only appear to
    // lose transparency when i'm right in front of them". Measured on his
    // scene, none of those heads was behind a boulder — they were at 25–61% of
    // its distance, more than half of them below half brightness. Fogged, the
    // far boulder is dim and they read as what they are. Once the shades differ
    // the nearer boulder has to be painted over the farther.
    const order = scratch.rockOrder
    order.length = 0
    for (let k = 0; k < count; k++) order.push(scratch.rocks[k]!)
    order.sort((a, b) => b.distance - a.distance)
  }
  const order = shade <= 0 ? scratch.rocks : scratch.rockOrder
  for (let k = 0; k < count; k++) {
    const rock = order[k]!
    if (shade > 0) {
      const near = rock.distance * (1 - rock.sin)
      const air = Math.exp(-near / Math.max(0.5, fade))
      context.fillStyle = `hsl(0 0% ${(shade * 40 * air).toFixed(1)}%)`
    }
    const outline = rock.outline
    context.beginPath()
    context.moveTo(outline[0]!, outline[1]!)
    for (let p = 2; p < outline.length; p += 2) context.lineTo(outline[p]!, outline[p + 1]!)
    context.closePath()
    context.fill()
  }
  return count
}
