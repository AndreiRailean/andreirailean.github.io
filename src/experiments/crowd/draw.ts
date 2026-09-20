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

import { BOB_RISE, BOB_SWAY } from "@/experiments/crowd/body"
import { CULL_ALPHA, project, type Camera } from "@/experiments/crowd/camera"
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
type Sighted = { sx: number; sy: number; r: number; depth: number; alpha: number }

/**
 * The per-frame working set, owned by the scene and handed back in every frame.
 *
 * **Two arrays rather than one, and neither is ever reallocated.** `pool` holds
 * the objects and only ever grows; `order` holds references to the live prefix
 * of it and is what gets sorted. The obvious `pool.slice(0, seen)` allocates
 * four thousand references per frame at sixty frames a second, which is a
 * megabyte a minute of pure garbage for a piece whose whole cost is the frame.
 */
export type Scratch = { pool: Sighted[]; order: Sighted[] }

export const makeScratch = (): Scratch => ({ pool: [], order: [] })

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
    settings: Settings
    width: number
    height: number
    scratch: Scratch
  },
): Frame {
  const { people, camera, settings, width, height } = options
  const { pool, order } = options.scratch

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
    const z = person.head + Math.sin(person.phase) * BOB_RISE * bob * moving
    const sway = Math.sin(person.phase / 2) * BOB_SWAY * bob * moving
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

    let slot = pool[seen]
    if (!slot) {
      slot = { sx: 0, sy: 0, r: 0, depth: 0, alpha: 0 }
      pool[seen] = slot
    }
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
  order.sort((a, b) => b.depth - a.depth)

  context.fillStyle = headColour(settings)

  let bucket = -1
  let fills = 0
  let largest = 0
  context.beginPath()

  for (const head of order) {
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

  context.globalAlpha = 1
  return { drawn: seen, fills, largest }
}
