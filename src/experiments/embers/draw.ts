/**
 * What reaches the glass.
 *
 * ## An ember is smaller than a pixel, and that is the central drawing problem
 *
 * A 3 mm ember in a frame three metres across is 0.45 px of radius. Every piece
 * of "tiny, irregular shaped" has to survive that, and the naive answer —
 * enlarge them — throws away the one thing the physics was for, because size is
 * what sets the fall speed and a population all drawn at three pixels is a
 * population that no longer looks sorted by weight.
 *
 * So the drawing takes the same route a camera does, and each part of it is a
 * real optical effect rather than a fudge:
 *
 * - **A self-luminous point spreads.** Its image is the lens's and the eye's
 *   point-spread function, not its own diameter, and veiling glare grows with
 *   intensity — which is why a bright star looks bigger than a faint one through
 *   the same optics. So the halo's radius scales with brightness, and `flare`
 *   controls how much of it there is.
 * - **The highlights clip before the wings do.** An overexposed point goes white
 *   in the middle and keeps its colour at the edge. That is why a white-hot
 *   ember here is a coloured glow with a white centre, and why `TEMP_MAX` can be
 *   2600 K — the last of the way to white is exposure, not temperature.
 * - **Irregularity reads as twinkle at this size, not as an outline.** A
 *   tumbling flake presents a projected area that varies almost to zero
 *   edge-on, so its brightness flickers as it turns. That is the same
 *   `phase` the flutter is paced by, so the two are one thing: an ember that is
 *   fluttering is an ember that is twinkling, and a compact one does neither.
 *   The outline is drawn as well, and is legible only in a close framing —
 *   which is what `span` is for.
 * - **Motion blurs.** A streak from where it was to where it is, which is the
 *   whole reason a splinter reads as a spark rather than as a dot that moved.
 *
 * The one place this is not photographic: the streak keeps most of its
 * brightness instead of spreading a fixed exposure over its length. Conserving
 * the energy properly makes a splinter dimmer the faster it goes, which is
 * arithmetically correct and visually backwards — the fast ones are the ones
 * worth seeing. Noted rather than hidden.
 *
 * ## Everything is additive, and the ground is nearly black
 *
 * Light on a dark field, so `lighter`: two embers overlapping are brighter than
 * one, and the base of the column goes white where the population is dense.
 * `trail` fades the previous frame toward the background instead of clearing it,
 * which accumulates the paths — and makes the picture something built up over
 * frames rather than a function of one, which the poster recipe has to know
 * about. See `poster.ts`.
 */

import { hashSeed, makeRng } from "@/experiments/random"
import { makeRamp, RAMP_STEPS, rampStep, type Ramp } from "@/experiments/embers/palette"
import { SHAPES, type Ember } from "@/experiments/embers/ember"
import { screenX, screenY, type View } from "@/experiments/embers/view"
import type { Air } from "@/experiments/embers/air"
import type { Mark, Settings } from "@/experiments/embers/settings"

/**
 * How many hues the spread is quantised into.
 *
 * Every ember's colour has to come from a pre-tinted sprite, because building a
 * radial gradient per ember per frame is the single most expensive thing this
 * piece could do. Five is enough that a spread of 40° has no visible banding at
 * ember size and few enough that the whole sheet rebuilds in a couple of
 * milliseconds when the hue is dragged.
 */
export const HUE_BUCKETS = 5

/** Side of one glow sprite, in device pixels. */
const SPRITE = 40

/** Smallest core anything is drawn at, in CSS pixels. Below this it stops being a thing. */
const MIN_CORE = 0.42

export type Sheet = {
  ramps: Ramp[]
  /** `hueBucket * RAMP_STEPS + temperatureStep`. */
  glow: HTMLCanvasElement[]
  /** Unit-radius outlines, as flat `x, y` pairs. */
  outlines: Float64Array[]
  hue: number
  hueSpread: number
}

/** The hue one bucket carries, given the base hue and the spread in degrees. */
export function bucketHue(hue: number, hueSpread: number, bucket: number): number {
  // A bucket's position across the spread, in standard deviations: the tone an
  // ember carries is a clamped normal draw remapped to 0…1, so the ends of the
  // bucket range are ±2.5σ. Both halves of that mapping live here, so they
  // cannot drift apart.
  const sigmas = (bucket / (HUE_BUCKETS - 1)) * 5 - 2.5
  return hue + hueSpread * sigmas
}

/** Which bucket an ember's tone falls in. */
export const toneBucket = (tone: number): number =>
  Math.min(HUE_BUCKETS - 1, Math.max(0, Math.round(tone * (HUE_BUCKETS - 1))))

function makeSprite(r: number, g: number, b: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = SPRITE
  canvas.height = SPRITE
  const context = canvas.getContext("2d")!
  const mid = SPRITE / 2

  // A bright core with wide, faint wings — the shape of a point spread rather
  // than a linear ramp, which reads as a soft disc and not as a light.
  const gradient = context.createRadialGradient(mid, mid, 0, mid, mid, mid)
  const colour = `${r} ${g} ${b}`
  gradient.addColorStop(0, `rgb(${colour} / 100%)`)
  gradient.addColorStop(0.1, `rgb(${colour} / 62%)`)
  gradient.addColorStop(0.26, `rgb(${colour} / 24%)`)
  gradient.addColorStop(0.55, `rgb(${colour} / 6%)`)
  gradient.addColorStop(1, `rgb(${colour} / 0%)`)

  context.fillStyle = gradient
  context.fillRect(0, 0, SPRITE, SPRITE)
  return canvas
}

/**
 * The outlines, which are the piece's only baked randomness.
 *
 * Seeded so a recapture of the poster gets the same silhouettes; everything else
 * about the scene is a continuous emission and has no arrangement to preserve.
 */
function makeOutlines(seed: number): Float64Array[] {
  const outlines: Float64Array[] = []
  for (let shape = 0; shape < SHAPES; shape++) {
    const rng = makeRng(hashSeed(seed, 0x5348, shape))
    const corners = 4 + Math.floor(rng() * 4)
    const points = new Float64Array(corners * 2)
    for (let at = 0; at < corners; at++) {
      // Angles jittered off an even division, so no outline is a regular
      // polygon and none is degenerate either.
      const angle = ((at + 0.5 * (rng() - 0.5)) / corners) * Math.PI * 2
      const radius = 0.55 + rng() * 0.9
      points[at * 2] = Math.cos(angle) * radius
      points[at * 2 + 1] = Math.sin(angle) * radius
    }
    outlines.push(points)
  }
  return outlines
}

export function makeSheet(hue: number, hueSpread: number, seed: number): Sheet {
  const ramps: Ramp[] = []
  const glow: HTMLCanvasElement[] = []

  for (let bucket = 0; bucket < HUE_BUCKETS; bucket++) {
    const ramp = makeRamp(bucketHue(hue, hueSpread, bucket))
    ramps.push(ramp)
    for (let step = 0; step < RAMP_STEPS; step++) {
      glow.push(makeSprite(ramp.bytes[step * 3]!, ramp.bytes[step * 3 + 1]!, ramp.bytes[step * 3 + 2]!))
    }
  }

  return { ramps, glow, outlines: makeOutlines(seed), hue, hueSpread }
}

/** Whether a sheet still describes these settings. */
export const sheetMatches = (sheet: Sheet, settings: Settings): boolean =>
  sheet.hue === settings.hue && sheet.hueSpread === settings.hueSpread

/** The near-black the picture sits on, tinted from the same hue the embers are. */
export const groundColour = (hue: number): string => `hsl(${hue} 55% 2.6%)`

/**
 * How much halo a mark of each kind throws, as a multiplier.
 *
 * A spark is hard and nearly bare; a mote is *only* halo, so it carries the most.
 */
const FLARE_SCALE: Record<Mark, number> = { ember: 1, spark: 0.45, mote: 2.1, flake: 1 }

/**
 * The radius of a mark's bright body, in CSS pixels.
 *
 * Floored, because a 3 mm ember in a frame three metres across is 0.45 px and
 * every part of "tiny, irregular shaped" has to survive that. Grows with
 * brightness as well as with size, which is the eye's own point spread rather
 * than a fudge — see the note at the top of this file.
 */
export function coreRadius(sizeMm: number, pxPerMetre: number, alpha: number): number {
  return Math.max(MIN_CORE, (sizeMm / 2000) * pxPerMetre) * (0.7 + 0.9 * alpha)
}

/**
 * The radius of a mark's halo, in CSS pixels. Zero means it has none.
 *
 * **This function is the piece's frame budget.** Compositing a scaled sprite
 * costs its destination *area*, so the cost of a frame is the sum of the squares
 * of what this returns — which makes `flare` the performance control and `count`
 * not, the opposite of what anybody guesses. Doubling `flare` roughly doubles
 * this and therefore roughly quadruples the cost.
 *
 * It is a named function rather than an expression inside the draw loop so the
 * relationship can be checked without a browser. It was asserted through
 * `drawMs` in the browser suite first, and that test was genuinely flaky: a
 * wall-clock *ratio* under four parallel workers has contention added to both
 * halves, so at enough load it approaches 1 whatever the drawing is doing. The
 * observed magnitude — 27 ms against 5 ms at three thousand embers — is recorded
 * in `AGENTS.md`, where a measurement belongs; the relationship is checked here.
 */
export function haloRadius(core: number, alpha: number, flare: number, mark: Mark): number {
  if (flare <= 0) return 0
  return core * (2.4 + flare * 15) * FLARE_SCALE[mark] * (0.5 + alpha * 0.9)
}

export type DrawStats = {
  /** Marks that reached the glass. Not the same as the population — dark ones do not. */
  drawn: number
  /** Of those, how many were bright enough to clip white in the middle. */
  clipped: number
  /** The brightest single mark, before the tone curve. Says whether exposure is sane. */
  peak: number
}

/**
 * Fade the last frame toward the ground, or clear it.
 *
 * `trail` is the fraction of the previous frame that survives one frame at 60 Hz,
 * corrected for the frame actually taken — a scene at 30 fps must not have twice
 * as much memory as the same scene at 60. Without the correction, dropping frames
 * lengthens the trails, which reads as the piece getting *more* alive under load.
 */
export function fadeFrame(context: CanvasRenderingContext2D, view: View, settings: Settings, elapsed: number): void {
  context.globalCompositeOperation = "source-over"
  context.globalAlpha = 1

  if (settings.trail <= 0) {
    context.fillStyle = groundColour(settings.hue)
    context.fillRect(0, 0, view.width, view.height)
    return
  }

  const keep = settings.trail ** (Math.max(1 / 240, Math.min(0.25, elapsed)) * 60)
  context.globalAlpha = 1 - keep
  context.fillStyle = groundColour(settings.hue)
  context.fillRect(0, 0, view.width, view.height)
  context.globalAlpha = 1
}

/**
 * The unseen fire, as the light it throws.
 *
 * The only thing in the piece that says there is a fire below the frame at all.
 * It rides the plume's axis, so a crosswind leans the light the way it leans the
 * column, and it reads `vigour` — so a burst brightens the base of the picture
 * at the moment the slug leaves, rather than the two being separate events that
 * happen to coincide.
 */
export function drawFirelight(
  context: CanvasRenderingContext2D,
  view: View,
  settings: Settings,
  air: Air,
  sheet: Sheet,
): void {
  if (settings.firelight <= 0) return

  const ramp = sheet.ramps[Math.floor(HUE_BUCKETS / 2)]!
  // The coals are cooler than the sparks that leave them, so the light under the
  // frame is drawn from the middle of the ramp rather than its top.
  const step = Math.round(RAMP_STEPS * 0.45)
  const vigour = air.vigour()

  const cx = screenX(view, air.axisAt(0))
  const cy = screenY(view, 0)
  // A metre and a half of glow around a metre of fire, not five. The first
  // version of this used a radius of three and a half bed widths with a linear
  // falloff, which at any ordinary framing is a flat orange dome over the lower
  // half of the picture — it washed out every ember in front of it, which is the
  // one thing the piece is for.
  const radius = Math.max(20, settings.bed * 1.5 * view.pxPerMetre * (0.85 + vigour * 0.35))

  // Built from the ramp's bytes rather than with relative colour syntax, which
  // would read better and is newer than this section's floor.
  const tint = (at: number, alpha: number) =>
    `rgb(${ramp.bytes[at * 3]} ${ramp.bytes[at * 3 + 1]} ${ramp.bytes[at * 3 + 2]} / ${alpha}%)`
  const outer = Math.round(step * 0.65)

  const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius)
  gradient.addColorStop(0, tint(step, 100))
  // Steep, because a glow that reaches zero only at its own edge has no edge.
  gradient.addColorStop(0.12, tint(step, 42))
  gradient.addColorStop(0.36, tint(outer, 11))
  gradient.addColorStop(0.68, tint(outer, 2))
  gradient.addColorStop(1, "rgb(0 0 0 / 0%)")

  context.globalCompositeOperation = "lighter"
  context.globalAlpha = Math.min(1, settings.firelight * 0.85 * (0.5 + vigour * 0.5))
  context.fillStyle = gradient
  context.beginPath()
  context.arc(cx, cy, radius, 0, Math.PI * 2)
  context.fill()
  context.globalAlpha = 1
}

/**
 * Every live ember, in one additive pass.
 *
 * Ordered core-last per ember rather than in two passes over the population: a
 * second pass costs a second walk of two thousand objects, and there is nothing
 * to gain from it because everything here composites additively and additive
 * blending does not care about order.
 */
export function drawEmbers(
  context: CanvasRenderingContext2D,
  embers: readonly Ember[],
  view: View,
  settings: Settings,
  sheet: Sheet,
): DrawStats {
  context.globalCompositeOperation = "lighter"
  context.lineCap = "round"

  let drawn = 0
  let clipped = 0
  let peak = 0

  const mark: Mark = settings.mark
  const wantsCore = mark !== "mote"
  const wantsStreak = mark === "ember" || mark === "spark" || mark === "flake"
  const wantsOutline = mark === "ember" || mark === "flake"

  for (const ember of embers) {
    if (!ember.alive) continue

    const bucket = toneBucket(ember.tone)
    const ramp = sheet.ramps[bucket]!
    const step = rampStep(ember.temp)

    // How flat this one is, which decides how hard it twinkles. `loft` below 1
    // is a flake; a compact ember barely varies as it turns.
    const flat = Math.min(1, Math.max(0, (1 / ember.loft - 0.85) / 1.2))
    const facing = Math.abs(Math.cos(ember.phase))
    const area = 1 - flat * 0.62 * (1 - facing)

    const raw = settings.exposure * ramp.luminance[step]! * area
    if (raw > peak) peak = raw
    // Reinhard: the whole visible range of a cooling ember is five orders of
    // magnitude, so something has to compress it, and this is the cheapest curve
    // that never clips to black at the bottom.
    const alpha = raw / (1 + raw)
    if (alpha < 0.004) continue
    // Counted here rather than where the white centre is drawn, so the number a
    // `stats()` reports means "marks past clipping" for every mark kind — a
    // `mote` has no core to whiten and used to report none at all.
    if (raw > 1) clipped++

    const sx = screenX(view, ember.x)
    const sy = screenY(view, ember.y)

    const core = coreRadius(ember.size, view.pxPerMetre, alpha)

    // The halo. Radius grows with brightness, which is veiling glare and is why
    // a hot ember looks bigger than a cool one of the same size.
    //
    // **This is where the frame time goes, and it is worth knowing which way.**
    // Compositing a scaled sprite costs its *destination area*, so the cost of a
    // frame is the sum of the squares of the halo radii — not the ember count.
    // Three thousand embers at a flare of 1.2 is 2.7 million alpha-blended
    // pixels and 27 ms; the same three thousand at 0.8 is half that. So `flare`
    // is the performance control and `count` is not, which is the opposite of
    // what anybody would guess, and is why the dense presets carry a lower
    // flare rather than fewer embers.
    // The dim tail is skipped rather than drawn at an alpha nobody can see: it
    // is most of the population and all of it costs destination area.
    const halo = alpha >= 0.05 ? haloRadius(core, alpha, settings.flare, mark) : 0
    if (halo > 0) {
      const sprite = sheet.glow[bucket * RAMP_STEPS + step]!
      context.globalAlpha = alpha
      context.drawImage(sprite, sx - halo, sy - halo, halo * 2, halo * 2)
    }

    if (wantsStreak) {
      const dx = sx - screenX(view, ember.px)
      const dy = sy - screenY(view, ember.py)
      if (dx * dx + dy * dy > 1.4) {
        context.globalAlpha = alpha * 0.55
        context.strokeStyle = ramp.css[step]!
        context.lineWidth = core * 1.5
        context.beginPath()
        context.moveTo(sx - dx, sy - dy)
        context.lineTo(sx, sy)
        context.stroke()
      }
    }

    if (wantsCore) {
      context.globalAlpha = alpha
      context.fillStyle = ramp.css[step]!

      if (wantsOutline && core > 1.1) {
        // Legible only in a close framing, and worth having there: the outline
        // turns with the ember and is squashed by how edge-on it is, so a flake
        // seen side-on is a line.
        const points = sheet.outlines[ember.shape]!
        const spin = ember.phase * (mark === "flake" ? 0.5 : 0.25)
        const cos = Math.cos(spin)
        const sin = Math.sin(spin)
        const squash = mark === "flake" ? 0.25 + facing * 0.75 : 0.6 + facing * 0.4
        context.beginPath()
        for (let at = 0; at < points.length; at += 2) {
          const ox = points[at]! * core * (mark === "flake" ? 1.7 : 1.15)
          const oy = points[at + 1]! * core * squash * (mark === "flake" ? 1.7 : 1.15)
          const rx = ox * cos - oy * sin
          const ry = ox * sin + oy * cos
          if (at === 0) context.moveTo(sx + rx, sy + ry)
          else context.lineTo(sx + rx, sy + ry)
        }
        context.closePath()
        context.fill()
      } else if (core <= 1.1) {
        // A square. At a pixel across nothing can tell it from a disc, and it
        // skips building a path — which at three thousand marks a frame is a
        // measurable share of the budget rather than a micro-optimisation.
        const side = core * 2
        context.fillRect(sx - core, sy - core, side, side)
      } else {
        context.beginPath()
        context.arc(sx, sy, core, 0, Math.PI * 2)
        context.fill()
      }

      // Highlight clipping. Past an exposure of one the middle of the mark goes
      // white and the wings keep their colour, which is what an overexposed
      // point does on film and on a sensor, and is the last of the way to
      // white-hot that temperature alone cannot reach.
      if (raw > 1) {
        const over = raw - 1
        context.globalAlpha = Math.min(1, over / (1 + over))
        context.fillStyle = "rgb(255 255 255)"
        const white = core * 0.6
        if (white <= 1.1) context.fillRect(sx - white, sy - white, white * 2, white * 2)
        else {
          context.beginPath()
          context.arc(sx, sy, white, 0, Math.PI * 2)
          context.fill()
        }
      }
    }

    drawn++
  }

  context.globalAlpha = 1
  context.globalCompositeOperation = "source-over"
  return { drawn, clipped, peak }
}
