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
 * A shadow here is the shadow of a **circle**: a soft ellipse, stretched along
 * the light. It was the shadow of a whole person, which is what a drone actually
 * photographs and which was the wrong thing to draw — the piece is dots with
 * human motion, and a person-shaped shadow puts the body back into a picture
 * that had agreed not to have one. What the light is still for is **height**: a
 * shadow that slides out from under its dot is the only cue for somebody leaving
 * the ground, and that needs no figure.
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

/** Below this radius in pixels a gradient is invisible and a flat fill is not. */
const GRADIENT_FLOOR = 6

export type Layers = {
  ground: HTMLCanvasElement | null
  shadow: HTMLCanvasElement | null
  /** Where people have been, fading. Null until anybody asks for it. */
  trail: HTMLCanvasElement | null
}

/**
 * How much of a mark a walker leaves per second, before it starts to fade.
 *
 * Low, and the marks are narrower than the feet that make them. A trace that
 * reaches full strength in a stride is a ribbon rather than a trace, and it
 * takes the picture over from the people making it — which is the wrong way
 * round for a piece about the people.
 */
const DEPOSIT = 2.2

/** The trail buffer's resolution, as a fraction of the frame. */
const TRAIL_SCALE = 2

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

/**
 * Where people have been.
 *
 * A layer of its own between the ground and the shadows, holding a mark laid
 * down at each walker's feet every frame and fading everywhere at a stated rate.
 * The fading is the whole idea rather than a concession: without it the frame
 * silts up to a flat wash within a minute and the picture is over. With it, what
 * is on the ground is the last half-minute of the crowd — the paths that are
 * used stay dark because they keep being renewed, and the ones that are not
 * disappear. Nobody draws a desire line; it is what is left when everything else
 * has faded.
 *
 * Fading is done by erasing rather than by painting the ground colour over the
 * top, so the layer stays transparent and can sit over ground of any colour.
 * `destination-out` at an alpha derived from the elapsed time makes the decay
 * exponential and frame-rate independent — painting a fixed alpha per frame
 * would make the trail's length depend on how fast the machine is.
 */
export function makeTrailBuffer(width: number, height: number): HTMLCanvasElement {
  const buffer = document.createElement("canvas")
  buffer.width = Math.max(1, Math.round(width / TRAIL_SCALE))
  buffer.height = Math.max(1, Math.round(height / TRAIL_SCALE))
  return buffer
}

export function paintTrails(
  buffer: HTMLCanvasElement,
  walkers: readonly Walker[],
  view: View,
  settings: Settings,
  elapsed: number,
): void {
  const context = buffer.getContext("2d")
  if (!context) return

  const scale = 1 / TRAIL_SCALE
  context.setTransform(1, 0, 0, 1, 0, 0)

  // Everything decays toward nothing with a time constant of `traces` seconds.
  context.globalCompositeOperation = "destination-out"
  context.fillStyle = `rgba(0, 0, 0, ${Math.min(1, 1 - Math.exp(-elapsed / settings.traces))})`
  context.fillRect(0, 0, buffer.width, buffer.height)

  context.globalCompositeOperation = "source-over"
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.globalAlpha = Math.min(0.25, elapsed * DEPOSIT)

  for (const walker of walkers) {
    // At the feet, not under the head: a trace is where somebody trod, and at a
    // low camera the head is half a metre from where its owner is standing.
    context.beginPath()
    context.arc(
      screenX(view, walker.x),
      screenY(view, walker.y),
      Math.max(0.7, walker.body.radius * 0.45 * view.pxPerMetre),
      0,
      Math.PI * 2,
    )
    context.fillStyle = walker.tones.trace
    context.fill()
  }

  context.globalAlpha = 1
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
 * One soft ellipse each, at the point the light puts it, with the short axis the
 * walker's own size and the long axis stretched along the light — which is what
 * the shadow of a ball is. Overhead it is a disc directly underneath; low down
 * it is a streak thrown a long way off.
 *
 * A jump lifts the dot, so its shadow moves away from it and shrinks. That is
 * the whole reason this layer survives.
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
  context.fillStyle = ground.shadow

  // The light's bearing on screen, which every shadow is stretched along.
  const along = Math.atan2(-sun.y, sun.x)

  for (const walker of walkers) {
    const z = headHeight(walker, settings.bob)
    const cast = shadowOf(sun, walker.x, walker.y, z)
    const radius = walker.body.headBreadth * 0.62 * view.pxPerMetre

    context.beginPath()
    context.ellipse(
      screenX(view, cast.x),
      screenY(view, cast.y),
      Math.max(0.8, radius * sun.stretch),
      Math.max(0.8, radius),
      along,
      0,
      Math.PI * 2,
    )
    context.fill()
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
  /** Screen position of the dot, in CSS pixels. */
  sx: number
  sy: number
  /** Its radius in pixels. */
  radius: number
  /** How high it is, which is also the paint order. */
  z: number
}

/**
 * Where every dot is on the glass this frame.
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
    // somebody standing still is in whatever direction it feels like.
    const sway = headSway(walker, settings.bob)
    const drift = headDrift(walker, clock)
    const x = walker.x - Math.sin(walker.facing) * sway + drift.x
    const y = walker.y + Math.cos(walker.facing) * sway + drift.y

    // A dot at height z is closer to the lens, so it is displaced outward from
    // the centre of the frame and magnified by the same factor.
    placed.push({
      walker,
      sx: screenX(view, x * magnify),
      sy: screenY(view, y * magnify),
      radius: (walker.body.headBreadth / 2) * magnify * view.pxPerMetre,
      z,
    })
  }

  // Higher dots are nearer the camera, so they occlude. Sorting by height is
  // the whole of the depth test, and it is exact for a camera looking straight
  // down.
  placed.sort((a, b) => a.z - b.z)
  return placed
}

/**
 * One walker: a circle.
 *
 * **A circle, and nothing else.** It was an oval a quarter longer front to back,
 * with a face that came into view as the chin lifted and a highlight pushed to
 * where the sun would really put it — all of it true of a head seen from above,
 * and all of it the wrong thing to draw. Which way somebody's head is pointing
 * is not what this piece is about; how they move is. Little ovals each pointing
 * their own way read as something swimming, and a face at four pixels reads as
 * nothing at all.
 *
 * What is left is a lit sphere, which is what the other pieces in this section
 * draw and what the brief asked for: dots, circles, points of light. The shading
 * says "ball" rather than "disc" and says nothing about direction — the offset
 * is small and toward the sun, the same way for everybody, so the frame has a
 * light in it rather than a field of little arrows.
 */
export function drawHead(context: CanvasRenderingContext2D, item: Placed, sun: Sun): void {
  const { walker, sx, sy, radius } = item
  const tones = walker.tones

  // Toward the sun, in screen coordinates. The same direction for every dot in
  // the frame, which is what makes it a light rather than a heading.
  const towardX = sun.x * radius * 0.26
  const towardY = -sun.y * radius * 0.26

  if (radius >= GRADIENT_FLOOR) {
    const gradient = context.createRadialGradient(sx + towardX, sy + towardY, radius * 0.1, sx, sy, radius * 1.35)
    gradient.addColorStop(0, tones.lit)
    gradient.addColorStop(0.68, tones.shade)
    gradient.addColorStop(1, tones.edge)
    context.beginPath()
    context.arc(sx, sy, radius, 0, Math.PI * 2)
    context.fillStyle = gradient
    context.fill()
    return
  }

  // Under six pixels a gradient is invisible and a second flat circle is not.
  context.beginPath()
  context.arc(sx, sy, radius, 0, Math.PI * 2)
  context.fillStyle = tones.shade
  context.fill()

  context.beginPath()
  context.arc(sx + towardX * 0.6, sy + towardY * 0.6, radius * 0.72, 0, Math.PI * 2)
  context.fillStyle = tones.lit
  context.fill()
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
    /** Seconds of piece time since the last frame was drawn. */
    elapsed: number
    width: number
    height: number
  },
): number {
  const { walkers, view, sun, settings, ground, layers, clock, elapsed, width, height } = options

  if (layers.ground) context.drawImage(layers.ground, 0, 0, width, height)
  else {
    context.fillStyle = ground.base
    context.fillRect(0, 0, width, height)
  }

  if (settings.traces > 0 && layers.trail) {
    paintTrails(layers.trail, walkers, view, settings, Math.max(1 / 240, elapsed))
    context.drawImage(layers.trail, 0, 0, width, height)
  }

  if (layers.shadow) {
    paintShadows(layers.shadow, walkers, view, sun, settings, ground)
    blitShadows(context, layers.shadow, width, height, ground)
  }

  if (!settings.heads) return 0

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

  // Where each walker is looking, as a ray a metre long. Not drawn in the piece
  // — the dots are circles — so this overlay is the only way to see the gaze
  // behaviour at all, which is most of what says a group is a group.
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
