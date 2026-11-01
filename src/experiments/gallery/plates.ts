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
 * its poster. Measured rather than guessed from a user agent or a core count,
 * so a fast phone is not punished and a struggling laptop is not trusted.
 */

import { PLATE, type PosterRecipe } from "@/experiments/poster"
import type { Live, Preset, Start } from "@/experiments/piece"

/**
 * Pieces whose poster moment is too far from their start to reach on a page
 * load. They keep their posters until each can start from a state that already
 * looks like it has been running, rather than simulating its way there.
 *
 * Measured on 2026-11-02 on the preview box, which has no GPU, drawing each
 * plate the way this file does with the budget lifted: walkers 39 s (its
 * recipe settles 120 s), crowd 26 s (45 s), flotsam 5.6 s (runs 40 s), hexgrid
 * 2.8 s (sweeps a whole loop for its most lit moment), psyxels 0.8 s (runs
 * 90 s). Bubbles and Embers settle inside their runners, for 30 s and 14 s of
 * water and fire, and a fresh Starry Night has no glimmers yet. The five
 * drawn here took 17–224 ms.
 */
const POSTER_ONLY = new Set(["bubbles", "crowd", "embers", "flotsam", "hexgrid", "psyxels", "starry-night", "walkers"])

/**
 * Longest a plate may take to draw before the device is judged too slow for
 * the rest. A long task this size is a visible hitch in a scroll, which is the
 * thing being protected. The slowest plate drawn here takes about a third of it
 * on the box above.
 */
const BUDGET_MS = 600

type Piece = {
  start: Start<object>
  normalize: (patch: object) => object
  presets: Preset<object>[]
  recipe: PosterRecipe<Record<string, unknown>>
}

const runners = import.meta.glob<Start<object>>("../*/runner.ts", { import: "start" })
const settings = import.meta.glob<(patch: object) => object>("../*/settings.ts", { import: "normalizeSettings" })
const presets = import.meta.glob<Preset<object>[]>("../*/presets.ts", { import: "PRESETS" })
const recipes = import.meta.glob<PosterRecipe<Record<string, unknown>>>("../*/poster.ts", { import: "default" })

/** A piece's four modules, fetched only when its plate comes near; `null` for a folder that is not a piece. */
async function load(slug: string): Promise<Piece | null> {
  const start = runners[`../${slug}/runner.ts`]
  const normalize = settings[`../${slug}/settings.ts`]
  const list = presets[`../${slug}/presets.ts`]
  const recipe = recipes[`../${slug}/poster.ts`]
  if (!start || !normalize || !list || !recipe) return null
  const loaded = await Promise.all([start(), normalize(), list(), recipe()])
  return { start: loaded[0], normalize: loaded[1], presets: loaded[2], recipe: loaded[3] }
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
 */
const TOTAL_BUDGET_MS = 1500

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

/** Draws the plate's still: the piece started, brought to its recipe's moment, drawn, and destroyed. */
async function draw(plate: HTMLElement, piece: Piece): Promise<void> {
  const { recipe } = piece
  const base = recipe.preset
    ? piece.presets.find(({ label }) => label === recipe.preset)?.settings
    : piece.presets[0]?.settings
  if (!base) throw new Error(`no preset ${JSON.stringify(recipe.preset ?? "primary")}`)

  const layer = document.createElement("div")
  layer.className = "live"
  // The piece sizes itself from the canvas's css box, so this box is what it
  // composes in, whatever the plate's width. CSS scales the result to fit.
  const canvas = document.createElement("canvas")
  canvas.style.width = `${PLATE.width}px`
  canvas.style.height = `${PLATE.height}px`
  layer.append(canvas)
  plate.prepend(layer)

  const live = piece.start(canvas, piece.normalize({ ...base, ...recipe.settings }))
  try {
    if (recipe.prepare) await within(Promise.resolve(recipe.prepare({ api: handle(live) })), PATIENCE_MS, "prepare")
    // A recipe that only waits lets the piece run in real time before the
    // shutter. Here that time is settled instead, where the piece has the verb.
    else if (recipe.dwellMs && typeof live.verbs.settle === "function") live.verbs.settle(recipe.dwellMs / 1000)
    await frame()
    await frame()
    live.setPaused(true)
  } finally {
    live.destroy()
  }
}

/**
 * Why a plate shows its poster, kept on the plate as `data-why` so a check can
 * tell a plate that was never meant to be drawn from one that failed or was
 * cut off by the budget.
 */
type Why = "poster-only" | "slow" | "failed" | "not a piece"

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

document.documentElement.dataset.plates = "running"
for (const plate of document.querySelectorAll<HTMLElement>(".plate[data-piece]")) {
  // Not queued: a poster-only plate has nothing to wait for but its image, and
  // in the queue it would wait behind every plate being drawn ahead of it.
  if (POSTER_ONLY.has(plate.dataset.piece ?? "")) {
    showPoster(plate, "poster-only")
    continue
  }
  fit.observe(plate)
  near.observe(plate)
}
