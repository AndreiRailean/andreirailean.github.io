import { mkdirSync } from "node:fs"
import { chromium, type Page } from "playwright"
import sharp from "sharp"
import type { PosterRecipe } from "../src/experiments/poster.ts"
import { resolveChromium } from "../tests/support/chromium.ts"
import startDevServer from "../tests/support/dev-server.ts"

/**
 * Capturing the still that represents each experiment on `/experiments/`.
 *
 * Run by hand — `npm run posters` — not by the build and not by `npm test`.
 * Three reasons, in order of how much they mattered:
 *
 * 1. The build stays browserless. Rendering posters during `astro build` would
 *    put a headless Chromium on the deploy path for an image that changes maybe
 *    twice a year, and turn a flaky capture into a broken deploy.
 * 2. `npm test` must not write tracked files. `playwright.config.ts` is explicit
 *    that stills are scratch evidence a human reads, with nothing comparing
 *    them; an asset generator has the opposite contract.
 * 3. "The piece looks right now" is a human judgement. Keeping a person in the
 *    loop is the point, the same way `updated` in the frontmatter is kept
 *    current by hand.
 *
 * No capture is byte-reproducible, so re-running this churns whatever it
 * touches. Starry Night takes no seed and comes out a different sky. Dangler's
 * landing preset is seeded, which fixes the arrangement, but its wind is
 * derived from the clock as well, so the strands are caught at a different
 * point in the same breeze. Neither difference is visible to a person. Hence
 * the slug filter: name the piece you actually changed, and leave the rest
 * alone.
 *
 *     npm run posters                 every experiment
 *     npm run posters -- dangler      just this one
 */

/** Beside the piece, so an experiment folder stays one self-contained thing. */
const posterPath = (slug: string) => `src/experiments/${slug}/poster.webp`

/**
 * 16:9, and wider than the suite's 1280×900 on purpose.
 *
 * The index shows the poster full-width in its column, so this is the shape the
 * reader sees. It is not a cropped detail of a taller frame: Dangler divides by
 * depth, which makes field of view — and therefore what is in the picture at
 * all — follow the viewport's aspect ratio. Cropping would show a scene the
 * piece never composes.
 */
const VIEWPORT = { width: 1024, height: 576 }

/** Captured at 2×, published at 1× of that. Retina without a 3200px file. */
const SCALE = 2
const OUTPUT_WIDTH = 1600

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
const SLUGS = ["dangler", "starry-night"]

async function main(): Promise<void> {
  const wanted = process.argv.slice(2)
  const unknown = wanted.filter((slug) => !SLUGS.includes(slug))
  if (unknown.length > 0) {
    throw new Error(`No such experiment: ${unknown.join(", ")}. Known: ${SLUGS.join(", ")}.`)
  }
  const slugs = wanted.length > 0 ? wanted : SLUGS

  const baseUrl = await startDevServer()

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

  // The dev toolbar is part of the dev server, not the site, and it renders over
  // the bottom of every page — the first run of this script put it in both
  // posters. Its module is served empty so it never arrives; deleting the
  // element afterwards left a window in which a capture could still catch it.
  await page.route("**/@id/astro/runtime/client/dev-toolbar/entrypoint.js", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  )

  const problems: string[] = []
  page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`)
  })

  try {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(recipe.settings ?? {})) params.set(key, String(value))
    const query = params.toString()

    await page.goto(`${baseUrl}/experiments/${slug}/${query ? `?${query}` : ""}`)
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

await main()
