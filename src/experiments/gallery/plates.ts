/**
 * The index's plates, drawn by their pieces rather than shown as posters.
 *
 * Each plate gets a canvas in the box its poster was captured in, `PLATE`, and
 * the piece is started in it, brought to the moment its poster recipe
 * photographs, drawn once, and stopped. What is left is a still the piece made
 * on this device, faded in where the poster would have been. The poster stays
 * in the page for everything that cannot do this: no script, a piece that
 * throws, a piece listed in `POSTER_ONLY`, and a device too slow to be asked.
 *
 * **Gallery rather than kit**, on the section's own test: nothing here is
 * offered to a piece or declinable by one. It drives a piece through `start`
 * and its recipe, the same two things `scripts/posters.ts` drives, so a recipe
 * that photographs well also draws well here.
 *
 * **One plate at a time, in idle time, only as plates come near the screen.**
 * Andrei: "i don't want to tax any computer, no matter how powerful, into
 * running these simulations all at the same time." Nothing is left running: a
 * plate's piece is destroyed as soon as its frame is drawn, so the cost of a
 * wall is the cost of its slowest plate, once, rather than thirteen loops.
 *
 * **A device that is slow says so by being slow.** The first plate that takes
 * longer than `BUDGET_MS` to draw stops the rest, and every plate after it gets
 * its poster. So does every plate for a visitor who asked for less motion; see
 * `stillOnly`. Measured rather than guessed from a user agent or a core count,
 * so a fast phone is not punished and a struggling laptop is not trusted.
 */

import { PLATE, type PosterRecipe } from "@/experiments/poster"
import { sceneFromPreset, type Live, type Preset, type SettingsModule, type Start } from "@/experiments/piece"

/**
 * Pieces whose poster moment is too far from their start to reach on a page
 * load. They keep their posters until each can start from a state that already
 * looks like it has been running, rather than simulating its way there.
 *
 * Measured on 2026-11-02 on the preview box, which has no GPU, drawing each
 * plate the way this file does with the budget lifted: walkers 39 s (its
 * recipe settles 120 s), crowd 26 s (45 s), flotsam 5.6 s (runs 40 s), hexgrid
 * 2.8 s (sweeps a whole loop for its most lit moment), psyxels 0.8 s (runs
 * 90 s).
 *
 * **Measure before listing a piece here.** Two were listed unmeasured and drew
 * well inside the budget once tried: embers in 289 ms, listed for the settle in
 * its runner's `mount`, which this file never calls; and Starry Night in 30 ms,
 * listed because a fresh sky has no glimmers yet. That is still true, so its
 * plate is a quieter sky than its poster, which is the brightest of twelve
 * frames. Bubbles really was slow, 1.7 s for its old primary, and its primary
 * is now `standing still`, reached through a coarse warm-up; its `poster.ts`
 * says why. Its plate takes about 260 ms, of which `warm` is 220.
 *
 * Crowd, Flotsam and Psyxels draw their first frame, in 176, 219 and 88 ms,
 * rather than the 45, 40 and 90 s their recipes used to run, and Hexgrid looks
 * for its brightest moment every half second instead of every tenth, 358 ms
 * instead of 2.8 s. Their `poster.ts` files say why.
 *
 * Walkers is the one left. Its picture is the ground people have worn, which
 * takes minutes of crowd and tens of seconds of painted trail to arrive at:
 * 5 s of it alone costs 2.5 s.
 */
const POSTER_ONLY = new Set(["walkers"])

/**
 * Longest a plate may take to draw before the device is judged too slow for
 * the rest. A long task this size is a visible hitch in a scroll, which is the
 * thing being protected. The slowest plate drawn here, embers, takes about half
 * of it on the box above.
 */
const BUDGET_MS = 600

type Piece = {
  start: Start<object>
  settings: Pick<SettingsModule<object>, "normalizeSettings" | "reroll">
  presets: Preset<object>[]
  recipe: PosterRecipe<Record<string, unknown>>
}

const runners = import.meta.glob<Start<object>>("../*/runner.ts", { import: "start" })
const settings = import.meta.glob<Pick<SettingsModule<object>, "normalizeSettings" | "reroll">>("../*/settings.ts")
const presets = import.meta.glob<Preset<object>[]>("../*/presets.ts", { import: "PRESETS" })
const recipes = import.meta.glob<PosterRecipe<Record<string, unknown>>>("../*/poster.ts", { import: "default" })

/** A piece's four modules, fetched only when its plate comes near; `null` for a folder that is not a piece. */
async function load(slug: string): Promise<Piece | null> {
  const start = runners[`../${slug}/runner.ts`]
  const module = settings[`../${slug}/settings.ts`]
  const list = presets[`../${slug}/presets.ts`]
  const recipe = recipes[`../${slug}/poster.ts`]
  if (!start || !module || !list || !recipe) return null
  const loaded = await Promise.all([start(), module(), list(), recipe()])
  return { start: loaded[0], settings: loaded[1], presets: loaded[2], recipe: loaded[3] }
}

/**
 * What a recipe's `prepare` is handed in place of `window.experiment`: the
 * piece's own verbs and stats, and the kit's `pause`, which is the one chrome
 * verb a recipe uses. Anything else a recipe reaches for throws, and the plate
 * falls back to its poster.
 */
function handle(live: Live<object>): Record<string, unknown> {
  return {
    ...live.verbs,
    stats: live.stats,
    pause: (held?: boolean) => {
      live.setPaused(held ?? true)
      return held ?? true
    },
  }
}

/**
 * How long a piece's modules may take to arrive, or its recipe to finish,
 * before its plate gives up and shows the poster. Without it, a chunk that
 * stalls on a flaky network would hold the queue, and every plate after it
 * would stay empty with nothing left to bring its poster back.
 */
const PATIENCE_MS = 10_000

/**
 * The most the whole wall may take, added up. `BUDGET_MS` alone would let a
 * device that takes just under it per plate pay that on every plate.
 *
 * It was 1.5 s, and the ten plates drawn here came to about 1.5 s on the box
 * above, so a busy run of that box already ended with the last plates on their
 * posters. Andrei raised it: "let's raise the 1.5s limit". It is paid one plate
 * at a time in idle time, never as one long task, so the total is CPU time spent
 * rather than a freeze.
 */
const TOTAL_BUDGET_MS = 3000

/**
 * `?budget=off` draws every plate whatever it costs. For the browser suite,
 * which runs slower than the machines the budget protects and has to see every
 * recipe drawn: with the budget on, one slow plate on CI would turn the rest
 * into posters and leave their recipes untried, with nothing failing.
 */
const unlimited = new URLSearchParams(location.search).get("budget") === "off"

function within<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms} ms`)), ms)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()))

const idle = () =>
  new Promise<void>((done) => {
    if ("requestIdleCallback" in window) requestIdleCallback(() => done(), { timeout: 1000 })
    else setTimeout(done, 50)
  })

/** A plate's canvas layer: the box `PLATE`, which CSS scales to the plate. */
function layer(): { layer: HTMLDivElement; canvas: HTMLCanvasElement } {
  const layer = document.createElement("div")
  layer.className = "live"
  // The piece sizes itself from the canvas's css box, so this box is what it
  // composes in, whatever the plate's width. CSS scales the result to fit.
  const canvas = document.createElement("canvas")
  canvas.style.width = `${PLATE.width}px`
  canvas.style.height = `${PLATE.height}px`
  layer.append(canvas)
  return { layer, canvas }
}

/**
 * Starts the piece on `scene` in `canvas` and brings it to its recipe's moment.
 * On a throw the piece is destroyed before the error leaves.
 */
async function begin(canvas: HTMLCanvasElement, piece: Piece, scene: object): Promise<Live<object>> {
  const { recipe } = piece
  const live = piece.start(canvas, scene)
  try {
    if (recipe.prepare) await within(Promise.resolve(recipe.prepare({ api: handle(live) })), PATIENCE_MS, "prepare")
    // A recipe that only waits lets the piece run in real time before the
    // shutter. Here that time is settled instead, where the piece has the verb.
    else if (recipe.dwellMs && typeof live.verbs.settle === "function") live.verbs.settle(recipe.dwellMs / 1000)
    return live
  } catch (error) {
    live.destroy()
    throw error
  }
}

/** What a drawn plate was drawn from, so waking it starts the same scene. */
const drawn = new WeakMap<HTMLElement, { piece: Piece; scene: object }>()

/** Draws the plate's still: the piece started, brought to its recipe's moment, drawn, and destroyed. */
async function draw(plate: HTMLElement, piece: Piece): Promise<void> {
  const { recipe } = piece
  const preset = recipe.preset ? piece.presets.find(({ label }) => label === recipe.preset) : piece.presets[0]
  if (!preset) throw new Error(`no preset ${JSON.stringify(recipe.preset ?? "primary")}`)
  // Through the same function a landing goes through, so a preset that rolls
  // its seed draws a different arrangement on every load here too.
  const scene = piece.settings.normalizeSettings({ ...sceneFromPreset(piece.settings, preset), ...recipe.settings })

  const { layer: still, canvas } = layer()
  plate.prepend(still)
  const live = await begin(canvas, piece, scene)
  try {
    await frame()
    await frame()
    live.setPaused(true)
  } finally {
    live.destroy()
  }
  drawn.set(plate, { piece, scene })
}

/**
 * Why a plate shows its poster, kept on the plate as `data-why` so a check can
 * tell a plate that was never meant to be drawn from one that failed or was
 * cut off by the budget.
 */
type Why = "poster-only" | "reduced motion" | "slow" | "failed" | "not a piece"

function showPoster(plate: HTMLElement, why: Why): void {
  plate.dataset.why = why
  const poster = plate.querySelector("img")
  const reveal = () => {
    plate.dataset.shown = "poster"
  }
  if (poster) void poster.decode().then(reveal, reveal)
  else reveal()
}

let slow = false
let total = 0
const waiting: HTMLElement[] = []
let draining = false

async function show(plate: HTMLElement): Promise<void> {
  const slug = plate.dataset.piece ?? ""
  if (slow) return showPoster(plate, "slow")
  let spent = 0
  try {
    const piece = await within(load(slug), PATIENCE_MS, `${slug}'s modules`)
    if (!piece) return showPoster(plate, "not a piece")
    await idle()
    const began = performance.now()
    try {
      await draw(plate, piece)
    } finally {
      spent = performance.now() - began
    }
    plate.dataset.shown = "live"
    plate.dataset.drawnMs = String(Math.round(spent))
  } catch (error) {
    // An error rather than a warning: the visitor still gets a poster, but a
    // piece that cannot draw its plate is broken, and the browser suite fails
    // on errors the page reports.
    console.error(`plates: ${slug} fell back to its poster`, error)
    plate.querySelector(".live")?.remove()
    showPoster(plate, "failed")
  } finally {
    // Counted whether the plate drew or threw: a piece that took five seconds
    // and then failed has said as much about the device as one that succeeded.
    total += spent
    if (!unlimited && (spent > BUDGET_MS || total > TOTAL_BUDGET_MS)) slow = true
  }
}

/**
 * `data-plates` on the root: `running` while plates are being drawn, `idle`
 * once the queue is empty. Its being set at all is what tells the inline
 * script in the page's head that this module ran.
 */
async function drain(): Promise<void> {
  if (draining) return
  draining = true
  document.documentElement.dataset.plates = "running"
  try {
    while (waiting.length > 0) await show(waiting.shift()!)
  } finally {
    draining = false
    document.documentElement.dataset.plates = "idle"
    rest()
  }
}

/** Keeps each plate's canvas the width of its plate. The piece never knows: it sees `PLATE`. */
const fit = new ResizeObserver((entries) => {
  for (const { target, contentRect } of entries) {
    ;(target as HTMLElement).style.setProperty("--fit", String(contentRect.width / PLATE.width))
  }
})

const near = new IntersectionObserver(
  (entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue
      near.unobserve(target)
      waiting.push(target as HTMLElement)
    }
    void drain()
  },
  { rootMargin: "50% 0px" },
)

/**
 * A visitor who asked for less motion gets every poster and no plate drawn.
 *
 * Not for the fade, which CSS already drops. A piece honours the preference
 * inside its own `start()`, and differently each time: embers runs fourteen
 * seconds of fire and bubbles twenty-two of water before their first frame, and
 * Starry Night pins its motion to nothing. That is a different picture from the
 * recipe's, and its cost lands before the recipe's on top: about two seconds
 * for the first of those plates, which turned every plate after it into a
 * poster anyway. A poster is already a still of the moment the recipe meant.
 */
const stillOnly = matchMedia("(prefers-reduced-motion: reduce)").matches

document.documentElement.dataset.plates = "running"
let watched = 0
for (const plate of document.querySelectorAll<HTMLElement>(".plate[data-piece]")) {
  // Neither is queued: a plate that will show its poster has nothing to wait
  // for but its image, and in the queue it would wait behind every plate being
  // drawn ahead of it.
  if (stillOnly) {
    showPoster(plate, "reduced motion")
    continue
  }
  if (POSTER_ONLY.has(plate.dataset.piece ?? "")) {
    showPoster(plate, "poster-only")
    continue
  }
  fit.observe(plate)
  near.observe(plate)
  watched += 1
}
// Only `drain` sets `idle`, and with nothing queued it never runs, so a wall
// with no plate to draw would read as running forever.
if (watched === 0) document.documentElement.dataset.plates = "idle"

/*
 * ## Waking
 *
 * A drawn plate is a still, and one plate at a time comes alive: the one under
 * the pointer or the keyboard's focus, or, when nobody is pointing at anything,
 * each plate on screen in turn. Andrei's terms for the whole wall apply here
 * too, so **only the awake plate has a running piece**: waking starts a fresh
 * one on the scene the plate was drawn from, and sleeping pauses and destroys
 * it, leaving its last frame as the plate's new still.
 *
 * The fresh piece is drawn into a layer over the still and faded in, so a
 * piece that does not come back to exactly the same frame on the same scene
 * changes under a fade rather than with a jump.
 *
 * Nothing wakes for a visitor who asked for less motion, whose plates are all
 * posters, nor on a device that the drawing judged slow, nor while plates are
 * still being drawn.
 */

/** How long a plate stays awake when the wall wakes it on its own. */
const AWAKE_MS = 6000

/** The pause between one plate falling asleep and the next waking, and before the first. */
const REST_MS = 1500

/** The fade from still to awake plate: `.live`'s opacity transition in the index page, and a little over. */
const FADE_MS = 800

/** How long the pointer has to stay on a plate to wake it, so sweeping across the wall wakes nothing. */
const LINGER_MS = 150

let awake: { plate: HTMLElement; live: Live<object>; layer: HTMLDivElement } | null = null
/** Bumped on every wake and sleep, so a wake that finishes after it was overtaken stands down. */
let turn = 0

function sleep(): void {
  turn += 1
  if (!awake) return
  const { plate, live } = awake
  awake = null
  live.setPaused(true)
  live.destroy()
  delete plate.dataset.awake
}

async function wake(plate: HTMLElement): Promise<void> {
  if (awake?.plate === plate) return
  const from = drawn.get(plate)
  if (!from || slow || draining) return
  sleep()
  const mine = turn
  const { layer: fresh, canvas } = layer()
  fresh.dataset.waking = ""
  const below = [...plate.querySelectorAll(".live")].at(-1)
  if (below) below.after(fresh)
  else plate.prepend(fresh)
  let live: Live<object>
  try {
    live = await begin(canvas, from.piece, from.scene)
  } catch (error) {
    // The still stays, and this plate is not woken again.
    console.warn(`plates: ${plate.dataset.piece} could not wake`, error)
    drawn.delete(plate)
    fresh.remove()
    return
  }
  if (mine !== turn) {
    live.destroy()
    fresh.remove()
    return
  }
  live.setPaused(false)
  awake = { plate, live, layer: fresh }
  plate.dataset.awake = "true"
  await frame()
  delete fresh.dataset.waking
  // Once the fade is over, the stills underneath are covered for good. Timed
  // rather than read off `transitionend`, which the hover's own transform
  // transition would fire first.
  setTimeout(() => {
    for (const old of plate.querySelectorAll(".live")) if (old !== fresh) old.remove()
  }, FADE_MS)
}

/** The plate under the pointer or holding focus, which outranks the wall's own turn. */
let held: HTMLElement | null = null
let lingering = 0

function hold(plate: HTMLElement | null): void {
  held = plate
  clearTimeout(lingering)
  clearTimeout(cycling)
  if (plate) lingering = window.setTimeout(() => void wake(plate), LINGER_MS)
  else {
    sleep()
    rest()
  }
}

/** Plates mostly on screen, in page order: the ones the wall takes turns between. */
const onScreen = new Set<HTMLElement>()
const seen = new IntersectionObserver(
  (entries) => {
    for (const { target, isIntersecting } of entries) {
      const plate = target as HTMLElement
      if (isIntersecting) onScreen.add(plate)
      else {
        onScreen.delete(plate)
        if (awake?.plate === plate && !held) sleep()
      }
    }
  },
  { threshold: 0.6 },
)

let cycling = 0
let last: HTMLElement | null = null

/** Waits `REST_MS`, then wakes the next plate on screen after the last one woken, for `AWAKE_MS`. */
function rest(): void {
  clearTimeout(cycling)
  // A plate held while others were being drawn could not wake then.
  if (held && !draining) void wake(held)
  if (held || slow || draining || document.hidden) return
  cycling = window.setTimeout(() => {
    const plates = [...document.querySelectorAll<HTMLElement>(".plate[data-piece]")].filter(
      (plate) => onScreen.has(plate) && drawn.has(plate),
    )
    if (plates.length === 0) return
    const next = plates[(plates.indexOf(last!) + 1) % plates.length]!
    last = next
    void wake(next).then(() => {
      if (held) return
      cycling = window.setTimeout(() => {
        if (held) return
        sleep()
        rest()
      }, AWAKE_MS)
    })
  }, REST_MS)
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(cycling)
    if (!held) sleep()
  } else rest()
})

if (!stillOnly) {
  for (const plate of document.querySelectorAll<HTMLElement>(".plate[data-piece]")) {
    seen.observe(plate)
    plate.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") hold(plate)
    })
    plate.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" && held === plate) hold(null)
    })
    plate.addEventListener("focusin", () => hold(plate))
    plate.addEventListener("focusout", (event) => {
      if (!plate.contains(event.relatedTarget as Node | null) && held === plate) hold(null)
    })
  }
}
