/**
 * Putting it on the glass.
 *
 * Three layers, drawn in this order and for these reasons.
 *
 * **The ground** is baked once per resize. It is a flat colour with a few dozen
 * soft blotches over it, which is not scenery — it is there so the eye has
 * something to measure the crowd's movement against. On a perfectly flat ground
 * a slow walker at a small span looks stationary.
 *
 * **The shadows** go into a buffer at a third of the resolution and are blitted
 * back scaled up, which softens their edges for nothing. It is the cheapest
 * useful blur there is, and a shadow is the one thing in the picture that is
 * supposed to be indistinct. They are composited as a single layer at one alpha
 * so two overlapping shadows do not darken where they cross, which is what
 * actually happens outdoors and never happens when you draw them one at a time.
 *
 * A shadow here is of the **whole person**, not of the head. Only heads are
 * drawn, and a head alone with a head-shaped shadow reads as a counter on a
 * board; a head with a person-shaped shadow beside it reads as a person, and it
 * is the same picture a drone actually takes. It is where all the information
 * about the body goes, and it costs three round-capped lines each — narrow at
 * the legs, widest at the shoulders, narrow again at the head.
 *
 * **The heads** are drawn last, sorted by height so that the taller of two
 * overlapping people is on top — which is not a stylistic choice but what a
 * camera above them would do.
 */

import { headDrift, headHeight, headSway, type Walker } from "@/experiments/walkers/crowd"
import type { Ground } from "@/experiments/walkers/palette"
import type { Settings } from "@/experiments/walkers/settings"
import { lift, screenX, screenY, shadowOf, type Sun, type View } from "@/experiments/walkers/view"

/**
 * How much smaller the shadow buffer is than the frame.
 *
 * The scaling back up is the blur: it costs nothing, and a shadow is the one
 * thing in the picture that is meant to be indistinct. Three was chosen by
 * looking — at two the edges are still crisp enough to read as geometry, and at
 * four a small child's shadow is four pixels across and flickers as it moves.
 */
const SHADOW_SCALE = 3

/**
 * Where the shoulders and the hips are, as fractions of the way from the ground
 * to the middle of the head, and how wide the shadow is at each.
 *
 * A person's shadow is not a capsule. It is narrow at the feet, widest at the
 * shoulders and narrow again at the head, and the difference between those two
 * pictures is the whole difference between a crowd of people and a scattering
 * of pills — which is what the first version of this looked like, unmistakably,
 * the moment there were more than a dozen of them.
 *
 * Shoulder height is 0.82 of stature and hip height is 0.53, both standard, and
 * quoting them against the *current* head height rather than against stature is
 * what makes a sitting person's shadow shorten correctly for nothing.
 */
const HIP = 0.53
const SHOULDER = 0.82

/** Below this radius in pixels a head is shaded with two flat ellipses. */
const GRADIENT_FLOOR = 6

export type Layers = {
  ground: HTMLCanvasElement | null
  shadow: HTMLCanvasElement | null
}

/**
 * The ground, rendered once and blitted after that.
 *
 * A full-viewport fill plus fifty gradients every frame will not hold 60 fps,
 * and none of it moves.
 */
export function paintGround(
  width: number,
  height: number,
  dpr: number,
  ground: Ground,
  seed: number,
): HTMLCanvasElement {
  const buffer = document.createElement("canvas")
  buffer.width = Math.max(1, Math.round(width * dpr))
  buffer.height = Math.max(1, Math.round(height * dpr))
  const context = buffer.getContext("2d")
  if (!context) return buffer

  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.fillStyle = ground.base
  context.fillRect(0, 0, width, height)

  // Blotches. Deterministic from the seed, so a resize is the same ground.
  let state = (seed | 0) + 0x9e3779b9
  const random = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Small and many rather than large and few. The first version used blotches a
  // sixth of the frame across and the ground came out looking like weather —
  // a soft vignette the eye reads as fog rather than as ground, and worse, as
  // something that ought to be moving.
  const diagonal = Math.hypot(width, height)
  const count = 130
  for (let index = 0; index < count; index++) {
    const x = random() * width
    const y = random() * height
    const radius = diagonal * (0.012 + random() * 0.055)
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, ground.mottle)
    gradient.addColorStop(1, ground.mottleOut)
    context.globalAlpha = 0.06 + random() * 0.1
    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1

  return buffer
}

/** The buffer the shadows are drawn into, at a third of the frame's size. */
export function makeShadowBuffer(width: number, height: number): HTMLCanvasElement {
  const buffer = document.createElement("canvas")
  buffer.width = Math.max(1, Math.round(width / SHADOW_SCALE))
  buffer.height = Math.max(1, Math.round(height / SHADOW_SCALE))
  return buffer
}

/**
 * Every walker's shadow, as one composited layer.
 *
 * Three segments — feet to hip, hip to shoulder, shoulder to head — each a
 * round-capped line of the right width at that height, which is a person's
 * shadow to within the accuracy of a soft edge at a third resolution. A jump
 * lifts the feet as well as the head, so the whole thing detaches from the
 * person and slides, and that is the clearest reading of a jump in the piece.
 */
export function paintShadows(
  buffer: HTMLCanvasElement,
  walkers: readonly Walker[],
  view: View,
  sun: Sun,
  settings: Settings,
  ground: Ground,
): void {
  const context = buffer.getContext("2d")
  if (!context) return

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, buffer.width, buffer.height)
  if (settings.shadow <= 0) return

  const scale = 1 / SHADOW_SCALE
  context.setTransform(scale, 0, 0, scale, 0, 0)
  // The shadow's own colour, drawn opaque here and composited once, so two
  // overlapping shadows do not darken where they cross. Outdoors they do not.
  context.strokeStyle = ground.shadow
  context.lineCap = "round"
  context.lineJoin = "round"

  for (const walker of walkers) {
    const body = walker.body
    const head = headHeight(walker, settings.bob)
    const foot = walker.hop
    const rise = head - foot
    if (rise <= 0.02) continue

    const at = (height: number) => {
      const point = shadowOf(sun, walker.x, walker.y, height)
      return { x: screenX(view, point.x), y: screenY(view, point.y) }
    }

    const feet = at(foot)
    const hip = at(foot + rise * HIP)
    const shoulder = at(foot + rise * SHOULDER)
    const crown = at(head)

    const shoulders = body.radius * 2 * view.pxPerMetre

    context.lineWidth = Math.max(1, shoulders * 0.62)
    context.beginPath()
    context.moveTo(feet.x, feet.y)
    context.lineTo(hip.x, hip.y)
    context.stroke()

    context.lineWidth = Math.max(1.2, shoulders * 0.96)
    context.beginPath()
    context.moveTo(hip.x, hip.y)
    context.lineTo(shoulder.x, shoulder.y)
    context.stroke()

    context.lineWidth = Math.max(1, body.headBreadth * 1.08 * view.pxPerMetre)
    context.beginPath()
    context.moveTo(shoulder.x, shoulder.y)
    context.lineTo(crown.x, crown.y)
    context.stroke()
  }
}

/** The shadow layer, put back over the ground at one alpha for the whole crowd. */
export function blitShadows(
  context: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  width: number,
  height: number,
  ground: Ground,
): void {
  if (ground.shadowAlpha <= 0) return
  context.save()
  context.globalAlpha = ground.shadowAlpha
  // Plain source-over rather than `multiply`. Multiply is the physically
  // truthful blend and it costs a full-viewport composite every frame at device
  // resolution, which was measurably the most expensive thing the piece did —
  // and against a ground this flat the two are indistinguishable, because the
  // shadow is already the ground's own colour darkened.
  context.imageSmoothingEnabled = true
  context.drawImage(buffer, 0, 0, width, height)
  context.restore()
}

type Placed = {
  walker: Walker
  /** Screen position of the head, in CSS pixels. */
  sx: number
  sy: number
  /** Semi-axes in pixels: along the head's facing, and across it. */
  along: number
  across: number
  /** How high the head is, which is also the paint order. */
  z: number
}

/**
 * Where every head is on the glass this frame.
 *
 * Separated from the drawing so the tests and the debug overlay can ask the
 * same question the renderer asks, rather than a similar one.
 */
export function placeHeads(walkers: readonly Walker[], view: View, settings: Settings, clock: number): Placed[] {
  const placed: Placed[] = []

  for (const walker of walkers) {
    const z = headHeight(walker, settings.bob)
    const magnify = lift(view, z)

    // The gait's sway is across the direction of travel; the postural drift of
    // someone standing still is in whatever direction it feels like.
    const sway = headSway(walker, settings.bob)
    const drift = headDrift(walker, clock)
    const x = walker.x - Math.sin(walker.facing) * sway + drift.x
    const y = walker.y + Math.cos(walker.facing) * sway + drift.y

    // A head at height z is closer to the lens, so it is displaced outward from
    // the centre of the frame and magnified by the same factor.
    const sx = screenX(view, x * magnify)
    const sy = screenY(view, y * magnify)

    // Pitch foreshortens the oval front to back. Never all the way: a head seen
    // exactly edge on is not a thing that happens from above.
    const foreshorten = 0.34 + 0.66 * Math.cos(walker.pitch)
    const scale = magnify * view.pxPerMetre

    placed.push({
      walker,
      sx,
      sy,
      along: (walker.body.headLength / 2) * scale * foreshorten,
      across: (walker.body.headBreadth / 2) * scale,
      z,
    })
  }

  // Taller heads are nearer the camera, so they occlude. Sorting by height is
  // the whole of the depth test, and it is exact for a camera looking straight
  // down.
  placed.sort((a, b) => a.z - b.z)
  return placed
}

/**
 * One head.
 *
 * A head from directly above is an oval about a quarter longer than it is wide,
 * lit from one side, with a face that comes into view as the chin lifts. Those
 * three things are the entire drawing, and between them they carry which way
 * somebody is facing, which way they are looking, and whether they are looking
 * up, down or level — at eight pixels across.
 */
export function drawHead(context: CanvasRenderingContext2D, item: Placed, sun: Sun): void {
  const { walker, sx, sy, along, across } = item
  const tones = walker.tones

  // Canvas y runs down, world y runs up, so a world angle is negated here.
  const rotation = -walker.yaw

  context.save()
  context.translate(sx, sy)
  context.rotate(rotation)

  // The sun's direction in the head's own frame, so the highlight stays where
  // the sun is while the head turns under it. Rotating the light with the head
  // was the first version and it is unmistakable: every face in the crowd lights
  // up on the same side of itself, and the whole picture stops having a sun in
  // it.
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const sunScreenX = sun.x
  const sunScreenY = -sun.y
  const sunLocalX = cos * sunScreenX + sin * sunScreenY
  const sunLocalY = -sin * sunScreenX + cos * sunScreenY

  // The face, drawn first so the crown covers all but the part that is showing.
  const reveal = Math.max(0, Math.sin(walker.pitch))
  if (reveal > 0.02) {
    context.save()
    context.beginPath()
    context.ellipse(along * (0.34 + 0.5 * reveal), 0, along * 0.52, across * 0.62, 0, 0, Math.PI * 2)
    context.fillStyle = tones.face
    context.fill()
    context.restore()
  }

  context.beginPath()
  context.ellipse(0, 0, along, across, 0, 0, Math.PI * 2)

  if (across >= GRADIENT_FLOOR) {
    const gradient = context.createRadialGradient(
      sunLocalX * along * 0.55,
      sunLocalY * across * 0.55,
      across * 0.08,
      0,
      0,
      Math.max(along, across) * 1.25,
    )
    gradient.addColorStop(0, tones.lit)
    gradient.addColorStop(0.62, tones.shade)
    gradient.addColorStop(1, tones.edge)
    context.fillStyle = gradient
    context.fill()
  } else {
    // Under six pixels a gradient is invisible and a second flat ellipse is not.
    context.fillStyle = tones.shade
    context.fill()
    context.beginPath()
    context.ellipse(sunLocalX * along * 0.24, sunLocalY * across * 0.24, along * 0.74, across * 0.74, 0, 0, Math.PI * 2)
    context.fillStyle = tones.lit
    context.fill()
  }

  // A hairline of shade round the edge, which is what stops a crowd of pastel
  // heads on pastel ground dissolving into it.
  if (across > 2.4) {
    context.beginPath()
    context.ellipse(0, 0, along, across, 0, 0, Math.PI * 2)
    context.lineWidth = Math.max(0.6, across * 0.09)
    context.strokeStyle = tones.edge
    context.globalAlpha = 0.55
    context.stroke()
    context.globalAlpha = 1
  }

  context.restore()
}

/** Everything, in order. */
export function drawFrame(
  context: CanvasRenderingContext2D,
  options: {
    walkers: readonly Walker[]
    view: View
    sun: Sun
    settings: Settings
    ground: Ground
    layers: Layers
    clock: number
    width: number
    height: number
  },
): number {
  const { walkers, view, sun, settings, ground, layers, clock, width, height } = options

  if (layers.ground) context.drawImage(layers.ground, 0, 0, width, height)
  else {
    context.fillStyle = ground.base
    context.fillRect(0, 0, width, height)
  }

  if (layers.shadow) {
    paintShadows(layers.shadow, walkers, view, sun, settings, ground)
    blitShadows(context, layers.shadow, width, height, ground)
  }

  const placed = placeHeads(walkers, view, settings, clock)
  for (const item of placed) drawHead(context, item, sun)

  return placed.length
}

/**
 * The overlay, which is off unless someone asks for it.
 *
 * What it draws is what is hard to see and easy to get wrong: where each group
 * thinks it is going, who is in it, how big everyone's body is as opposed to
 * their head, and which way each head is pointing. Nearly every bug in this
 * piece has been visible here and invisible in the picture.
 */
export function drawDebug(
  context: CanvasRenderingContext2D,
  walkers: readonly Walker[],
  groups: readonly { members: Walker[]; goalX: number; goalY: number }[],
  view: View,
): void {
  context.save()
  context.lineWidth = 1

  context.strokeStyle = "rgb(255 90 120 / 65%)"
  for (const group of groups) {
    const gx = screenX(view, group.goalX)
    const gy = screenY(view, group.goalY)
    context.beginPath()
    context.moveTo(gx - 6, gy)
    context.lineTo(gx + 6, gy)
    context.moveTo(gx, gy - 6)
    context.lineTo(gx, gy + 6)
    context.stroke()

    context.beginPath()
    for (const member of group.members) {
      context.moveTo(gx, gy)
      context.lineTo(screenX(view, member.x), screenY(view, member.y))
    }
    context.stroke()
  }

  // Bodies, which are what actually collide, and the heads that are drawn.
  context.strokeStyle = "rgb(60 200 255 / 70%)"
  for (const walker of walkers) {
    const sx = screenX(view, walker.x)
    const sy = screenY(view, walker.y)
    context.beginPath()
    context.arc(sx, sy, walker.body.radius * view.pxPerMetre, 0, Math.PI * 2)
    context.stroke()
  }

  // Where each head is pointing, as a ray a metre long.
  context.strokeStyle = "rgb(255 220 90 / 80%)"
  context.beginPath()
  for (const walker of walkers) {
    const sx = screenX(view, walker.x)
    const sy = screenY(view, walker.y)
    context.moveTo(sx, sy)
    context.lineTo(sx + Math.cos(walker.yaw) * view.pxPerMetre, sy - Math.sin(walker.yaw) * view.pxPerMetre)
  }
  context.stroke()

  context.restore()
}
