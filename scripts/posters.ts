import { mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { chromium, type Page } from "playwright"
import sharp from "sharp"
import { PLATE, type PosterRecipe } from "../src/experiments/poster.ts"
import { resolveChromium } from "../tests/support/chromium.ts"
import startPreviewServer from "../tests/support/preview-server.ts"

/**
 * Capturing the still that represents each experiment on `/experiments/`.
 *
 * Run by hand — `pnpm run posters` — not by the build and not by `pnpm test`.
 * Three reasons, in order of how much they mattered:
 *
 * 1. The build stays browserless. Rendering posters during `astro build` would
 *    put a headless Chromium on the deploy path for an image that changes maybe
 *    twice a year, and turn a flaky capture into a broken deploy.
 * 2. `pnpm test` must not write tracked files. `playwright.config.ts` is explicit
 *    that stills are scratch evidence a human reads, with nothing comparing
 *    them; an asset generator has the opposite contract.
 * 3. "The piece looks right now" is a human judgement. Keeping a person in the
 *    loop is the point, the same way `updated` in the frontmatter is kept
 *    current by hand.
 *
 * No capture is reproducible, so re-running this churns whatever it touches.
 * A preset that names no seed rolls a fresh arrangement each time it is
 * applied, and most name none
 * (`src/experiments/docs/adr/20261106-a-preset-names-a-look-not-an-arrangement.md`).
 * Hence the slug filter: name the piece you actually changed, and leave the
 * rest alone.
 *
 *     pnpm run posters                 every experiment
 *     pnpm run posters dangler         just this one
 */

/** Beside the piece, so an experiment folder stays one self-contained thing. */
const posterPath = (slug: string) => `src/experiments/${slug}/poster.webp`

/**
 * 16:9, at the plate's own size: the 38rem a plate on the index sits at.
 *
 * The index shows the poster full-width in its column, so this is the shape the
 * reader sees. It is not a cropped detail of a taller frame: Dangler divides by
 * depth, which makes field of view — and therefore what is in the picture at
 * all — follow the viewport's aspect ratio. Cropping would show a scene the
 * piece never composes.
 *
 * **The size matters as well as the shape.** It used to be 1024×576, shown in
 * a 608px plate, so every poster was the piece at 0.6×. A piece framed by its
 * frame (bubbles, crowd, embers) shrinks as a whole and does not care, but one
 * sized in css px (hexgrid's hexes, starry night's stars, dotfield's spacing)
 * came out smaller than it ever is in the piece. At the plate's size a poster
 * is what a canvas in that plate draws, which is what the index rendering its
 * own frames will need to match.
 */
const VIEWPORT = { ...PLATE }

/** Captured at 2× and published at that, so a retina plate gets a pixel for a pixel. */
const SCALE = 2
const OUTPUT_WIDTH = VIEWPORT.width * SCALE

/** Tuned by eye against the size budget below; these are dark, grainy fields. */
const WEBP_QUALITY = 80

/** Nothing here should be approaching this. It is a tripwire, not a target. */
const SIZE_BUDGET_BYTES = 400_000

/**
 * The pieces, in the order the index would list them. A new experiment joins by
 * adding a `poster.ts` beside its code and a line here.
 *
 * Listed rather than globbed. A glob would silently capture a piece whose
 * recipe is a placeholder, and the failure mode — a poster nobody chose, shipped
 * to the index — is worse than the chore.
 */
export const SLUGS = [
  "artdeco",
  "bubbles",
  "crowd",
  "dangler",
  "dotfield",
  "embers",
  "flotsam",
  "hexgrid",
  "melting",
  "psyxels",
  "starry-night",
  "streakers",
  "walkers",
]

/**
 * Which pieces a run was asked for, from `process.argv.slice(2)`.
 *
 * **A `--` argument is dropped, because pnpm forwards it and npm did not.**
 * `npm run posters -- dangler` swallowed the separator; pnpm hands it to the
 * script, where it arrives as an unknown slug and the run dies before it
 * captures anything — #114, found by the session adding a piece, which is
 * exactly who follows these instructions.
 *
 * The migration converted the *prefix* everywhere an agent reads an
 * instruction, and the `--` came through untouched because it had always been
 * invisible. Both spellings are accepted rather than one: the npm form is in
 * muscle memory, in every other project, and in this repo's own ADRs, which are
 * append-only and were deliberately not rewritten —
 * `docs/adr/20260902-pnpm-is-the-package-manager.md`. `--` is never a slug, so
 * ignoring it cannot mask a typo.
 *
 * Extracted from `main` so it can be tested at all. Everything else in this
 * file needs a browser and a dev server; this is a function and a list.
 */
export function slugsFrom(argv: string[]): string[] {
  const wanted = argv.filter((arg) => arg !== "--")
  const unknown = wanted.filter((slug) => !SLUGS.includes(slug))
  if (unknown.length > 0) {
    throw new Error(`No such experiment: ${unknown.join(", ")}. Known: ${SLUGS.join(", ")}.`)
  }
  return wanted.length > 0 ? wanted : SLUGS
}

async function main(): Promise<void> {
  const slugs = slugsFrom(process.argv.slice(2))

  // Builds first, so a recapture shoots the piece as it will ship rather than
  // as the dev server renders it. It also removes the trap that made a
  // recaptured poster fail to reach a reviewer: a build emits content-hashed
  // `_astro/` names, where the dev `<Image>` endpoint keyed a year-long cache on
  // the file path and could not change the address when the bytes changed.
  //
  // **This is also why no capture intercepts the dev toolbar any more.** It used
  // to, because the toolbar renders over the bottom of every page and the first
  // run of this script put it in both posters. A build emits no toolbar under
  // any configuration — it is something the dev server injects — so the route
  // matched nothing and read as protection while providing none. If a toolbar
  // ever appears in a poster again, the thing that broke is this line, not the
  // interception that used to follow it.
  const baseUrl = await startPreviewServer()

  const browser = await chromium.launch({ executablePath: resolveChromium() })
  try {
    for (const slug of slugs) await capture(browser, baseUrl, slug)
  } finally {
    await browser.close()
  }
}

async function capture(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  baseUrl: string,
  slug: string,
): Promise<void> {
  const recipe: PosterRecipe<unknown> = (await import(`../src/experiments/${slug}/poster.ts`)).default

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    // Pinned, never inherited. `chrome-headless-shell` reports `reduce` where a
    // system Chromium reports no preference, and a piece that honours it pins
    // every motion setting to 0 and parks its loop — which for Starry Night
    // means the poster would be its reduced-motion still instead of the sky.
    reducedMotion: "no-preference",
  })
  const page = await context.newPage()

  const problems: string[] = []
  page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`)
  })

  try {
    await page.goto(`${baseUrl}/experiments/${slug}/`)
    await page.waitForFunction(() => Boolean(window.experiment), undefined, { timeout: 30_000 })

    // Before anything else: the chrome and the pointer are not part of the
    // picture. Every piece has `idle()` — it is in the minimum surface
    // `src/experiments/AGENTS.md` requires — so this belongs here and not in a
    // recipe that would have to remember it.
    await run(page, ({ api }) => (api as { idle: (force: boolean) => void }).idle(true))

    // Preset first, then the recipe's own settings on top, so a recipe can say
    // "that preset, but wound down" without restating the whole thing.
    if (recipe.preset) {
      const load = ({ api, arg }: { api: unknown; arg?: unknown }) =>
        (api as { preset: (which: string) => unknown }).preset(arg as string)
      await run(page, load, recipe.preset)
    }
    if (recipe.settings) await layer(page, slug, recipe.settings)
    if (recipe.prepare) await run(page, recipe.prepare)

    const attempts = Math.max(1, recipe.attempts ?? 1)
    let best: { png: Buffer; luminance: number } | null = null
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (recipe.dwellMs) await page.waitForTimeout(recipe.dwellMs)
      const png = await page.screenshot({ type: "png" })
      const luminance = await meanLuminance(png)
      if (!best || luminance > best.luminance) best = { png, luminance }
    }

    if (problems.length > 0) {
      throw new Error(`${slug} reported ${problems.length} problem(s):\n  ${problems.join("\n  ")}`)
    }

    const png = best!.png

    const path = posterPath(slug)
    mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true })
    const { size } = await sharp(png).resize({ width: OUTPUT_WIDTH }).webp({ quality: WEBP_QUALITY }).toFile(path)

    const kb = Math.round(size / 1024)
    const picked = attempts > 1 ? `  best of ${attempts}` : ""
    const over = size > SIZE_BUDGET_BYTES ? `  ← over the ${SIZE_BUDGET_BYTES / 1024}KB budget` : ""
    console.log(`${slug.padEnd(14)} ${String(kb).padStart(4)}KB  ${path}${picked}${over}`)
  } finally {
    await context.close()
  }
}

/**
 * Layer a recipe's settings over whatever is loaded, and fail unless every one
 * of them reads back.
 *
 * **The read-back is the point.** These used to travel in the query string,
 * and both recipes that used them were dropped without a sound: streakers
 * reads only the packed `s=` address, and embers loaded its preset after the
 * address, which replaced it. Each poster was captured, looked plausible, and
 * was not the scene its recipe described. A setting `normalize` clamps or
 * snaps comes back a little different, so numbers are compared to within a
 * hundredth of their own size.
 *
 * **A key the piece does not have is checked against the settings it had
 * before**, not the ones it returns. `normalize` spreads the patch over its
 * base, so a misspelt key comes back in the result exactly as asked and would
 * pass a read-back on its own.
 */
async function layer(page: Page, slug: string, settings: Record<string, number | string>): Promise<void> {
  const get = ({ api }: { api: unknown }) => (api as { get: () => Record<string, unknown> }).get()
  const known = new Set(Object.keys(await run(page, get)))
  const set = ({ api, arg }: { api: unknown; arg?: unknown }) =>
    (api as { set: (patch: unknown) => Record<string, unknown> }).set(arg)
  const applied = await run(page, set, settings)
  const missed = Object.entries(settings).filter(([key, wanted]) => {
    if (!known.has(key)) return true
    const got = applied[key]
    if (typeof wanted === "number" && typeof got === "number") {
      return Math.abs(got - wanted) > Math.abs(wanted) / 100
    }
    return got !== wanted
  })
  if (missed.length > 0) {
    const detail = missed.map(([key, wanted]) =>
      known.has(key) ? `${key}: asked ${wanted}, got ${String(applied[key])}` : `${key}: not one of ${slug}'s settings`,
    )
    throw new Error(`${slug}'s recipe settings did not land:\n  ${detail.join("\n  ")}`)
  }
}

/** Mean of the three channel means. Only ever compared against itself. */
async function meanLuminance(png: Buffer): Promise<number> {
  const { channels } = await sharp(png).stats()
  return channels.slice(0, 3).reduce((total, channel) => total + channel.mean, 0) / 3
}

/**
 * Run something against `window.experiment` inside the page.
 *
 * The same trick `tests/support/experiment.ts` uses, for the same reason: the
 * callback is serialised and runs in the browser, so **nothing from this
 * module's scope comes with it** — a closure over an import throws
 * `ReferenceError` there. Playwright transfers handles nested inside a plain
 * object, so the API arrives as the live in-page object while `arg` arrives as
 * data. Everything a callback needs comes through its one parameter, which is
 * what makes that boundary visible in a recipe.
 */
async function run<T>(page: Page, fn: (handle: { api: unknown; arg?: unknown }) => T, arg?: unknown): Promise<T> {
  const handle = await page.evaluateHandle(() => {
    const api = window.experiment
    if (!api) throw new Error("window.experiment is missing — did the piece's module fail to load?")
    return api
  })

  try {
    return await page.evaluate(fn as never, { api: handle, arg })
  } finally {
    await handle.dispose()
  }
}

/**
 * Run only when this file is the thing that was executed.
 *
 * It used to be a bare top-level `await main()`, which makes *importing* the
 * module capture: a dev server, a Chromium, and an overwrite of every tracked
 * `poster.webp`. Nothing imported it, so nothing had gone wrong — but the
 * docblock at the top of this file says `pnpm test` must never write tracked
 * files, and the unit test on `slugsFrom` is an import. The check that keeps
 * #114 fixed would have been the thing that broke that rule.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
