import { packField, type Field, type Psyx } from "@/experiments/psyxels/field"
import { paintGlyph } from "@/experiments/psyxels/glyphs"
import { buildMask, maskSize, type Mask } from "@/experiments/psyxels/mask"
import { createPalette, GROUND, type Palette } from "@/experiments/psyxels/palette"
import { arrivalOf, breathOf, levelOf, morphOf, spanOf } from "@/experiments/psyxels/pulse"
import { needsPacking, needsSubject, type Settings } from "@/experiments/psyxels/settings"
import { paintSubject } from "@/experiments/psyxels/subject"

/**
 * The engine: a canvas, a clock, and the two questions the piece is made of.
 *
 * The still question — what is under each square — is answered once, by
 * `mask.ts`, and consulted by `field.ts` whenever a square is packed. The moving
 * question — what each psyx is doing now — is answered every frame and can move
 * nothing. That separation is the piece: colour, breathing, frames and rates can
 * all be wound anywhere at all and the subject underneath does not shift by a
 * psyx, because nothing on that side of the line is allowed to.
 *
 * Everything here is in CSS pixels. The canvas is scaled by the device ratio
 * once, in `resize`, and no other code in the piece knows about it.
 */

/** Devices past this ratio cost fill rate and return nothing a viewer can see. */
const MAX_RATIO = 2

/** Steps `run()` takes per second of simulated time. */
const RUN_HZ = 30

/** Below this a mark costs a draw call and shows nothing. */
const ALPHA_FLOOR = 0.012

/**
 * How small the glow is gathered at, against the frame.
 *
 * A quarter in each direction is a sixteenth of the pixels, and the upscale
 * afterwards is itself a blur — so most of the softness is free and the actual
 * blur only has to smooth what is left.
 */
const GLOW_SCALE = 0.25

/** Frames a fast-forward draws at the end, so the glow buffer is not empty. */
const GLOW_SETTLE = 20

/**
 * How much wider than its own stroke a psyx's bloom is, at full.
 *
 * Ten, because that is what it takes. A large plus at a light weight puts ink on
 * a tenth of its square and the rest is ground; a bloom that only doubles the
 * stroke leaves the hole it was drawn to fill.
 */
const BLOOM_WIDTH = 9

export type PsyxelsStats = {
  /** Psyxels the packing produced, including ones the threshold or their own luck leaves out. */
  psyxels: number
  /** Psyxels the threshold and their own luck let through: what the field would paint at full breath. */
  live: number
  /** Marks actually painted in the last frame. A psyx mid-change paints two. */
  drawn: number
  /** How many psyxels at each subdivision level, coarsest first. */
  byDepth: number[]
  /**
   * Mean age in seconds at each subdivision level, coarsest first.
   *
   * The piece's one number for *are the big marks outstaying the small ones*. A
   * psyx is ended by the first of its ancestors to change its mind, so a deep
   * one has more clocks that can end it — and with every square asking at the
   * same rate the coarse marks sat five times longer than the grain around them,
   * which is exactly backwards when they are the marks the eye goes to.
   */
  ageByDepth: number[]
  /** The smallest and largest psyx on screen, in CSS pixels. */
  smallest: number
  largest: number
  /**
   * How well the field covers the subject: intersection over union, against the
   * coverage the subject was rasterised at.
   *
   * The piece's one number for *is this still recognisable*. 1 would be a
   * perfect stencil; the packing never reaches it, because a psyx is a square
   * and a letter is not. Below about 0.6 the subject is being described rather
   * than drawn, and it is usually the threshold or the levels that did it.
   */
  match: number
  /**
   * The marks' *bounding* area over the frame's, which is what the piece costs
   * to draw rather than how much ink is on screen. It cannot see `bloom`, which
   * changes only how much of a mark's box is drawn on; count lit canvas pixels
   * for that.
   */
  fill: number
  /** Squares that have changed size since the field was packed. */
  changes: number
  /** Frame changes the psyxels have made since the field was packed. */
  flicks: number
  /** How long the last frame took to paint, in milliseconds, smoothed. */
  drawMs: number
  /** Distinct colours the scene has needed. A wide spread on a photograph wants thousands. */
  colours: number
  /** Seconds on the piece's own clock, which `playback` scales. */
  clock: number
  fps: number
}

export type Psyxels = {
  start: () => void
  stop: () => void
  setSettings: (next: Settings) => void
  /** Draw the squares the packing chose, which the piece never shows. */
  setDebug: (on: boolean) => void
  /** Run the field forward by this many seconds at once, then redraw. */
  run: (seconds: number) => void
  stats: () => PsyxelsStats
}

export type Options = {
  /** The photographic subject. Absent, the piece still runs; the portrait is blank. */
  avatar?: HTMLImageElement | null
}

export function createPsyxels(canvas: HTMLCanvasElement, initial: Settings, options: Options = {}): Psyxels {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Psyxels: no 2d context")
  const ctx = context

  const avatar = options.avatar ?? null
  let settings = initial
  let width = 0
  let height = 0

  const stage = document.createElement("canvas")
  const stageCtx = stage.getContext("2d", { willReadFrequently: true })

  /**
   * Where the light is gathered, and kept.
   *
   * **The glow is a post-process, not a halo per psyx.** Drawing a sprite behind
   * every mark gives each one its own aura and no two of them ever add up; here
   * the whole frame is blurred into this buffer and composited back over itself,
   * so what glows is whatever is *bright* — two psyxels close together glow more
   * than either alone, which is what light does and what a per-psyx halo cannot
   * do at any price.
   *
   * It is faded rather than cleared between frames, and that is the afterglow:
   * the buffer holds what was there, so a psyx easing out leaves its light
   * behind for a moment. A phosphor, not a filter.
   */
  const halo = document.createElement("canvas")
  const haloCtx = halo.getContext("2d")
  /** The clock reading the buffer was last faded against. */
  let haloAt = 0

  let mask: Mask | null = null
  let field: Field | null = null
  let palette: Palette = createPalette(settings.saturation)

  let clock = 0
  let last = 0
  let frames = 0
  let fps = 0
  let fpsSince = 0
  let drawn = 0
  let fill = 0
  let drawMs = 0
  let debug = false
  let running = false
  let handle = 0
  /** Set by anything that changes the picture without the clock moving. */
  let dirty = true

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")

  /**
   * Kept apart, and cached separately.
   *
   * They were set together, which is two property writes where one is wanted —
   * and with the knockout tile a psyx sets a colour three times a frame, so the
   * pair was six writes against three. Canvas state changes are most of what
   * this piece costs.
   */
  let stroking = ""
  let filling = ""
  function setStroke(colour: string): void {
    if (colour === stroking) return
    stroking = colour
    ctx.strokeStyle = colour
  }
  function setFill(colour: string): void {
    if (colour === filling) return
    filling = colour
    ctx.fillStyle = colour
  }

  /**
   * Rasterises the subject and reads it into the coverage tables.
   *
   * The only expensive thing in the piece — a `getImageData` and five summed-area
   * tables over most of a megapixel — so it happens on a resize, a new subject
   * or a new fill, and never on a frame.
   */
  function rebuildMask(): void {
    if (!stageCtx || width <= 0 || height <= 0) return
    const { cols, rows } = maskSize(width, height)
    stage.width = cols
    stage.height = rows
    stageCtx.setTransform(cols / width, 0, 0, cols / width, 0, 0)
    paintSubject(stageCtx, width, height, settings.subject, settings.face, settings.fill, avatar)
    mask = buildMask(stage, width, height)
  }

  function rebuildField(): void {
    if (!mask) return
    field = packField(mask, settings, clock)
    dirty = true
  }

  function resize(): void {
    const ratio = Math.min(MAX_RATIO, window.devicePixelRatio || 1)
    const nextWidth = Math.max(1, canvas.clientWidth || window.innerWidth)
    const nextHeight = Math.max(1, canvas.clientHeight || window.innerHeight)
    const pixelWidth = Math.round(nextWidth * ratio)
    const pixelHeight = Math.round(nextHeight * ratio)

    const changed = width !== nextWidth || height !== nextHeight
    width = nextWidth
    height = nextHeight

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    halo.width = Math.max(1, Math.round(pixelWidth * GLOW_SCALE))
    halo.height = Math.max(1, Math.round(pixelHeight * GLOW_SCALE))
    // Setting either dimension clears the canvas, so a parked loop would leave
    // the piece simply gone after a resize. Inherited from Dangler and Flotsam,
    // where it was a real bug both times.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    dirty = true

    if (changed) {
      rebuildMask()
      rebuildField()
    }
  }

  /**
   * One psyx, drawn.
   *
   * Three multiplied factors decide its alpha and nothing decides its position:
   * where it is was settled when it was packed. See `pulse.ts` for what each
   * factor answers.
   */
  function paintPsyx(
    psyx: Psyx,
    time: number,
    span: number,
    coarsePx: number,
    leaving = 0,
    fade = 1,
    withBloom = true,
  ): number {
    const level = levelOf(psyx.ink, psyx.luck, settings.threshold, settings.fuzz, settings.flatten)
    if (level <= 0) return 0

    // How large this one is against the coarsest square, which decides both how
    // quickly it arrives and how much bloom it is given.
    const share = Math.min(1, psyx.size / coarsePx)
    const life = spanOf(share)
    // A ghost runs the same ease backwards over the same span, so a departure
    // takes exactly as long as the arrival replacing it.
    const arrival = leaving > 0 ? 1 - arrivalOf(time, leaving, life) : arrivalOf(time, psyx.born, life)
    if (arrival <= 0) return 0
    const spatial = (psyx.x + psyx.y * 0.62) / span
    const alpha = level * breathOf(psyx, settings, time, spatial) * arrival * fade
    if (alpha < ALPHA_FLOOR) return 0

    // The arrival scales the mark as well as fading it: four marks appearing at
    // full size inside the square that was there a frame ago reads as a flash
    // rather than as a split.
    // Negative spacing is an overlap: the mark spills past its own square into
    // its neighbours', which is the only thing that dissolves the lattice the
    // subdivision leaves behind.
    const room = (psyx.size / 2) * (1 - settings.inset)
    const extent = room * (0.6 + 0.4 * arrival)
    const weight = Math.max(0.7, psyx.size * settings.weight)

    /**
     * **A mark may sit off the centre of its own square, and overlap its
     * neighbours.**
     *
     * The packing is a subdivision, so the squares are a lattice — and a coarse
     * psyx can only ever appear in one of a handful of places, which the eye
     * learns within a few seconds. Letting the *mark* wander inside its square
     * breaks that without touching the cover: every square still answers for its
     * own patch of the picture, and what is drawn for it is simply not centred.
     * Far enough and marks cross into each other, which is the piece's only
     * overlap and reads as depth rather than as error.
     */
    const wander = settings.wander * psyx.size * 0.5
    const cx = psyx.x + psyx.size / 2 + psyx.offsetX * wander
    const cy = psyx.y + psyx.size / 2 + psyx.offsetY * wander

    /**
     * A change of frame is a cross-fade of two whole marks.
     *
     * Interpolating the features was tried first and is wrong at size: a large
     * plus spends its transition as a pair of stubs, and a ring has no legible
     * fraction of itself at all. Here the outgoing mark shrinks a little as it
     * fades and the incoming one grows into place, so a psyx is always showing
     * marks the vocabulary contains — briefly two of them.
     */
    const morph = morphOf(psyx, settings, time)

    /**
     * **A large mark sits in a hole, and the hole is the problem.**
     *
     * A mark's ink is a fixed share of its own square — stroke width follows
     * size — so the same drawing reads as *tone* at seven screen pixels and as a
     * thin sign surrounded by ground at a hundred. The eye reads that ground as
     * part of the mark, which is why a large psyx demands attention out of all
     * proportion to the patch of picture it stands for.
     *
     * The bloom is the same mark again, far wider and dim, laid down first. It
     * fills the hole in the shape of what is in it rather than as a patch, and
     * it is weighted by how large this psyx is against the coarsest — the fine
     * grain already reads as tone and is left alone.
     */
    // A solid tile has already filled the ground, so the bloom stands down — and
    // so does a divided square, whose ground is filled by the grain that
    // replaced it. Blooming those as well buried the letter in soft discs: there
    // are a third as many branches as leaves and every one of them is large.
    const bloom = withBloom ? settings.bloom * share * share * (1 - settings.solid) : 0
    if (bloom > 0.02) {
      const level = alpha * bloom * 0.3
      if (level >= ALPHA_FLOOR) {
        setStroke(palette.colour(psyx, settings, morph < 0.5 ? psyx.hueFrom : psyx.hue))
        ctx.globalAlpha = level
        paintGlyph(ctx, morph < 0.5 ? psyx.from : psyx.glyph, cx, cy, extent, weight * (1 + BLOOM_WIDTH * bloom))
      }
    }

    /**
     * **A tile with the sign knocked out of it, rather than a sign on the
     * ground.**
     *
     * The other answer to a large psyx sitting in a hole, and the complete one:
     * fill its square with its own colour and cut the mark out. Nothing is left
     * empty, and because the tile is opaque it covers whatever a neighbour has
     * spilled underneath — the piece's author asked for exactly that, that a
     * larger psyx should "knock out the smaller pieces".
     *
     * The tile follows the *mark*, not the square. A wandering psyx that left
     * its ground behind would open the hole again a step to one side, which is
     * the thing that made an off-centre mark read as a slip rather than as a
     * move.
     */
    if (settings.solid > 0) {
      const tile = alpha * settings.solid
      if (tile >= ALPHA_FLOOR) {
        setFill(palette.colour(psyx, settings, morph < 0.5 ? psyx.hueFrom : psyx.hue))
        ctx.globalAlpha = tile
        ctx.beginPath()
        // Rounded only where the rounding can be seen. `roundRect` costs several
        // times a plain `rect` and a two-pixel corner on a six-pixel tile is not
        // a corner.
        if (room > 6) ctx.roundRect(cx - room, cy - room, room * 2, room * 2, room * 0.22)
        else ctx.rect(cx - room, cy - room, room * 2, room * 2)
        ctx.fill()

        // Knocked out in the ground's own colour rather than composited out, so
        // the tile stays opaque over whatever is beneath it. Skipped where the
        // mark would be thinner than a line: below that the knockout is a
        // scratch on a tile too small to read it.
        if (extent > 3) {
          setStroke(GROUND)
          setFill(GROUND)
          paintGlyph(ctx, morph < 0.5 ? psyx.from : psyx.glyph, cx, cy, extent, weight * 2)
        }
      }
    }

    const drawn = 1 - settings.solid
    if (drawn <= 0) return room * room * 4

    if (morph < 1) {
      const leaving = alpha * drawn * (1 - morph)
      if (leaving >= ALPHA_FLOOR) {
        const scale = 1 - 0.22 * morph
        const colour = palette.colour(psyx, settings, psyx.hueFrom)
        setStroke(colour)
        setFill(colour)
        ctx.globalAlpha = leaving
        paintGlyph(ctx, psyx.from, cx, cy, extent * scale, weight * scale)
      }
    }

    const arriving = alpha * drawn * morph
    if (arriving >= ALPHA_FLOOR) {
      const scale = 0.78 + 0.22 * morph
      const colour = palette.colour(psyx, settings, psyx.hue)
      setStroke(colour)
      setFill(colour)
      ctx.globalAlpha = arriving
      paintGlyph(ctx, psyx.glyph, cx, cy, extent * scale, weight * scale)
    }

    return extent * extent * 4
  }

  function draw(time: number): void {
    const began = performance.now()
    ctx.globalAlpha = 1
    /**
     * **Cleared to nothing, not painted with the ground.**
     *
     * The page's own background is the ground — it always was, and the canvas
     * was painting over it with the same colour for no reason. It matters now:
     * the glow is gathered by blurring this canvas into a buffer that is added
     * to itself frame after frame, and a ground of `#05050a` accumulated there
     * would settle into a grey wash over the whole picture. Transparent, only
     * the light is gathered.
     */
    ctx.clearRect(0, 0, width, height)

    if (!field) return
    const psyxels = field.psyxels()
    const span = width + height
    let painted = 0
    let area = 0

    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    // What the coarsest square is in screen pixels, which the bloom weighs
    // against. `field.ts` owns the same expression.
    const coarsePx = Math.max(6, settings.coarse * Math.min(width, height))

    // Under everything: what has just been replaced, on its way out.
    for (const ghost of field.ghosts()) paintPsyx(ghost, time, span, coarsePx, ghost.died)

    for (const psyx of psyxels) {
      const covered = paintPsyx(psyx, time, span, coarsePx)
      if (covered > 0) {
        painted++
        area += covered
      }
    }

    /**
     * **Over the grain, not under it.**
     *
     * The coarse marks are drawn last so that what shows through the unfilled
     * parts of one is the finer psyxels that replaced it. Underneath, the grain
     * would cover the coarse mark instead and the layering would read as haze
     * rather than as depth — which is the wrong way round: the piece's author
     * asked for "smaller psyxels shown in the empty spaces left by the unfilled
     * portions of the big ones".
     */
    if (settings.layers > 0) {
      for (const branch of field.branches()) {
        painted += paintPsyx(branch, time, span, coarsePx, 0, settings.layers, false) > 0 ? 1 : 0
      }
    }

    drawn = painted
    fill = area / (width * height)

    if (debug) paintDebug(psyxels)
    ctx.globalAlpha = 1
    if (settings.glow > 0 && haloCtx) gather(time)
    else haloAt = time
    // Smoothed, because a single frame's timing is dominated by whatever else
    // the machine was doing during it.
    drawMs = drawMs === 0 ? performance.now() - began : drawMs * 0.9 + (performance.now() - began) * 0.1
  }

  /**
   * Gathers this frame's light into the buffer, then adds the buffer back.
   *
   * The order is what stops it running away: the buffer is filled from the
   * canvas *before* the glow is composited onto it, so the next frame gathers
   * the field rather than the field plus its own glow.
   */
  function gather(time: number): void {
    if (!haloCtx) return
    const width = halo.width
    const height = halo.height

    /**
     * Faded on the piece's clock rather than per frame, so the trail is the same
     * length however fast the machine is drawing — and lengthens, in wall time,
     * when the piece is watched slowly. That is the right way round: the whole
     * point of slowing a scene down is to see what a psyx leaves behind.
     */
    const elapsed = Math.max(0, time - haloAt)
    haloAt = time
    const life = 0.04 + 1.8 * settings.afterglow
    const kept = Math.exp(-elapsed / life)

    haloCtx.setTransform(1, 0, 0, 1, 0, 0)
    haloCtx.globalCompositeOperation = "destination-out"
    haloCtx.globalAlpha = 1 - kept
    haloCtx.filter = `blur(${Math.max(1, Math.min(width, height) * 0.006)}px)`
    haloCtx.fillStyle = "#000"
    haloCtx.fillRect(0, 0, width, height)

    /**
     * **Added at the same weight it was faded by**, which makes the buffer a
     * running average of recent frames rather than a sum of them.
     *
     * Added at full weight it is a sum, and the sum's resting value is the frame
     * divided by how much was faded — at a long afterglow and a fast frame rate
     * that is a factor of a hundred and eighty, and the picture whites out. It
     * also made the glow's strength depend on the frame rate, which is the kind
     * of fault that looks like a taste problem on one machine and a bug on
     * another.
     */
    haloCtx.globalCompositeOperation = "lighter"
    haloCtx.globalAlpha = 1 - kept
    haloCtx.filter = `blur(${Math.max(1, Math.min(width, height) * 0.006)}px)`
    // The quarter-scale upscale at the end is itself a blur, so this only has to
    // smooth what is left of the grain — and a wide radius here is most of what
    // the glow costs.
    haloCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height)
    haloCtx.filter = "none"

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = "lighter"
    ctx.globalAlpha = settings.glow
    ctx.drawImage(halo, 0, 0, width, height, 0, 0, canvas.width, canvas.height)
    ctx.restore()
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 1
  }

  /** The squares themselves, which the piece otherwise never shows. */
  function paintDebug(psyxels: Psyx[]): void {
    ctx.globalAlpha = 0.4
    ctx.lineWidth = 0.5
    ctx.strokeStyle = "#39d0ff"
    ctx.beginPath()
    for (const psyx of psyxels) ctx.rect(psyx.x, psyx.y, psyx.size, psyx.size)
    ctx.stroke()
  }

  function step(now: number): void {
    const elapsed = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000)
    last = now

    // The clock is scaled in exactly one place, so the breathing, the frame
    // changes and the repacking all slow by the same factor and every
    // relationship between them survives.
    const frozen = reduced?.matches ?? false
    const advance = frozen ? 0 : elapsed * settings.playback
    clock += advance

    if (advance > 0 || dirty) {
      if (field) field.update(clock, settings)
      draw(clock)
      dirty = false
    }

    frames++
    if (now - fpsSince >= 1000) {
      fps = (frames * 1000) / (now - fpsSince)
      frames = 0
      fpsSince = now
    }

    if (running) handle = window.requestAnimationFrame(step)
  }

  const observer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          resize()
        })

  resize()
  observer?.observe(canvas)
  window.addEventListener("resize", resize)

  // The portrait usually is not decoded yet when the piece is created, and an
  // undecoded image rasterises to nothing at all — a blank subject, a field with
  // no psyxels in it, and no error anywhere. Rebuilding on load is the whole fix,
  // and it costs nothing on the scenes that never look at it.
  const onAvatarLoad = () => {
    if (settings.subject !== "avatar") return
    rebuildMask()
    rebuildField()
  }
  if (avatar && !avatar.complete) avatar.addEventListener("load", onAvatarLoad)

  return {
    start() {
      if (running) return
      running = true
      last = 0
      fpsSince = performance.now()
      handle = window.requestAnimationFrame(step)
    },

    stop() {
      running = false
      window.cancelAnimationFrame(handle)
      observer?.disconnect()
      window.removeEventListener("resize", resize)
      avatar?.removeEventListener("load", onAvatarLoad)
    },

    setSettings(next) {
      const before = settings
      settings = next
      if (next.saturation !== before.saturation) palette = createPalette(next.saturation)
      if (needsSubject(before, next)) rebuildMask()
      if (needsPacking(before, next)) rebuildField()
      dirty = true
    },

    setDebug(on) {
      debug = on
      dirty = true
    },

    /**
     * Steps the field forward without waiting for it.
     *
     * Stepped rather than jumped, because every clock in the piece is a
     * *deadline* — a psyx changes frame when enough time has passed since its
     * last change — and a single jump of forty seconds fires each of them once
     * rather than forty times. A poster of a field that has repacked once is a
     * poster of frame one.
     */
    run(seconds) {
      if (!field || !(seconds > 0)) return
      const steps = Math.min(6000, Math.round(seconds * RUN_HZ))
      for (let i = 0; i < steps; i++) {
        clock += 1 / RUN_HZ
        field.update(clock, settings)
        // The glow is gathered *between* frames, so a run that draws only its
        // last one leaves the buffer holding a single frame's worth — a poster
        // with no glow on a scene that has plenty. The last stretch is drawn as
        // well, which is what the buffer needs to settle.
        if (i >= steps - GLOW_SETTLE) draw(clock)
      }
      draw(clock)
      dirty = false
    },

    stats() {
      const psyxels = field ? field.psyxels() : []
      let smallest = Infinity
      let largest = 0
      let inter = 0
      let covered = 0
      let live = 0
      const ages: number[] = []
      const counts: number[] = []

      for (const psyx of psyxels) {
        ages[psyx.depth] = (ages[psyx.depth] ?? 0) + (clock - psyx.born)
        counts[psyx.depth] = (counts[psyx.depth] ?? 0) + 1
        if (psyx.size < smallest) smallest = psyx.size
        if (psyx.size > largest) largest = psyx.size
        if (levelOf(psyx.ink, psyx.luck, settings.threshold, settings.fuzz, settings.flatten) <= 0) continue
        live++
        const area = psyx.size * psyx.size
        covered += area
        inter += psyx.ink * area
      }

      const union = (mask?.total ?? 0) + covered - inter
      return {
        psyxels: psyxels.length,
        live,
        drawn,
        byDepth: field ? field.byDepth() : [],
        ageByDepth: counts.map((count, depth) => (count > 0 ? (ages[depth] ?? 0) / count : 0)),
        smallest: Number.isFinite(smallest) ? smallest : 0,
        largest,
        match: union > 0 ? inter / union : 0,
        fill,
        changes: field ? field.changes() : 0,
        flicks: field ? field.flicks() : 0,
        drawMs,
        colours: palette.size(),
        clock,
        fps,
      }
    },
  }
}
