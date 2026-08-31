import { mkdirSync } from "node:fs"
import { test as base, expect, type JSHandle, type Page } from "@playwright/test"

/**
 * Opening an experiment page and driving its console API.
 *
 * `src/experiments/AGENTS.md` says every piece exposes `window.experiment`
 * because anything behind a click is invisible to a headless check otherwise.
 * This is the other half of that: the thing that reaches it, so no task has to
 * hand-roll a CDP harness again.
 *
 * Deliberately generic and deliberately thin. It knows nothing about any one
 * piece — no settle threshold, no stats shape, no debug overlay. Per ADR-0002
 * that knowledge stays in the experiment's own spec until a second and a third
 * piece show what is actually common.
 */

/** Stills land here. Gitignored. Read them; nothing compares them. */
const SHOT_DIR = ".scratch/shots"

/**
 * The dev toolbar's own module, which the dev server adds to every page.
 *
 * Served empty rather than aborted: an abort shows up as a failed request, and
 * the `problems` fixture below would rightly fail the test for it.
 */
const DEV_TOOLBAR_MODULE = "**/@id/astro/runtime/client/dev-toolbar/entrypoint.js"

/**
 * The minimum surface `src/experiments/AGENTS.md` requires of every piece.
 *
 * Not a union of the real APIs, for the same reason `window.experiment` is typed
 * `unknown` — see `src/experiments/window.d.ts`. A spec passes its own
 * experiment's `ExperimentApi` as the type argument and gets the real thing.
 *
 * Settings values are `unknown` rather than `number`: the first version of this
 * said `number`, which was Dangler's shape mistaken for the section's. Starry
 * Night has a `mode` and an `invert`, and would not fit.
 */
export type BaseApi = {
  get: () => Record<string, unknown>
  set: (patch: Record<string, never>) => Record<string, unknown>
  preset: (which: number | string) => Record<string, unknown>
  /**
   * The preset names, in keyboard order.
   *
   * Part of the minimum surface since the gallery's interactive view arrived:
   * a swipe through the presets has to be able to say what it landed on, and it
   * reaches every piece through this handle and nothing else.
   */
  presets: () => string[]
  panel: (open?: boolean) => boolean
  idle: (force?: boolean | null) => void
}

export type OpenOptions = {
  /**
   * Settings, carried in the query string exactly as a shared URL would carry
   * them. Going through the URL rather than through `set()` after load means a
   * test exercises the same path a person sharing a link does.
   */
  settings?: Record<string, number | string>
  /**
   * Non-setting query params — the `?panel=1` / `?debug=1` escape hatches that
   * exist for tools which cannot evaluate JS. We can, so prefer the API; this is
   * for when the state at *load* is the thing under test.
   */
  query?: Record<string, string>
  /** Pin the chrome shown or hidden. Omit to leave the idle timer alone. */
  idle?: boolean
  /**
   * Emulate `prefers-reduced-motion: reduce`. A real code path, not a courtesy:
   * it pins the motion settings to 0 and the loop parks itself.
   *
   * Omitting it pins `no-preference` rather than leaving the browser's default,
   * which differs between the system Chromium and Playwright's headless shell.
   */
  reducedMotion?: boolean
}

export type Experiment<Api> = {
  page: Page
  /**
   * Run something against `window.experiment`, with the real API's types.
   *
   * The callback is serialised and run inside the page, so **nothing from the
   * test's scope comes with it** — a closure over a local variable throws
   * `ReferenceError` in the browser. Destructuring is how that boundary stays
   * visible: everything the callback needs arrives through its one parameter,
   * with values from the test passed as `arg`.
   *
   *     await experiment.api(({ api }) => api.settle())
   *     await experiment.api(({ api, arg }) => api.set({ strands: arg }), 8)
   */
  api: <T, Arg = undefined>(fn: (handle: { api: Api; arg: Arg }) => T | Promise<T>, arg?: Arg) => Promise<T>
  /** Write a still into `.scratch/shots/` and attach it to the report. */
  shot: (name: string) => Promise<string>
}

/**
 * Everything the page complained about, collected from before the first
 * navigation so a module that fails to load is caught rather than merely
 * producing a blank canvas.
 *
 * Auto-used, and a non-empty list fails the test on teardown. A test that means
 * to provoke an error asserts on the contents and then empties the array —
 * `problems.length = 0` — to say so out loud.
 */
export const test = base.extend<{ problems: string[]; noDevToolbar: void }>({
  /**
   * No Astro dev toolbar on any page the suite looks at.
   *
   * The suite runs against a dev server, and the toolbar is part of the dev
   * server rather than part of the site — it injects a `<astro-dev-toolbar>`
   * into every page, and with it five more `h1` elements, which is how this was
   * found: a `page.locator("h1")` on a note resolved to Astro's audit panel as
   * well as the note's own title.
   *
   * Stopping its module from arriving, rather than deleting the element
   * afterwards, because the element is only the part that is easy to see. It
   * also styles, measures and highlights the page. And it cannot be turned off
   * in `astro.config.mjs` without turning it off for the human whose dev server
   * this may well be — the suite adopts a running server rather than insisting
   * on its own, so it has no say in how that one was configured.
   */
  noDevToolbar: [
    async ({ page }, use) => {
      await page.route(DEV_TOOLBAR_MODULE, (route) =>
        route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
      )
      await use()
    },
    { auto: true },
  ],

  problems: [
    async ({ page }, use, testInfo) => {
      const problems: string[] = []
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`console.error: ${message.text()}`)
      })
      page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`))
      page.on("requestfailed", (request) => {
        problems.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`)
      })

      await use(problems)

      // Only when the test would otherwise have passed: a test that already
      // failed has a better error than this one.
      if (testInfo.status === testInfo.expectedStatus && problems.length > 0) {
        throw new Error(`The page reported ${problems.length} problem(s):\n  ${problems.join("\n  ")}`)
      }
    },
    { auto: true },
  ],
})

export { expect }

export async function openExperiment<Api extends BaseApi>(
  page: Page,
  slug: string,
  options: OpenOptions = {},
): Promise<Experiment<Api>> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options.settings ?? {})) params.set(key, String(value))
  for (const [key, value] of Object.entries(options.query ?? {})) params.set(key, value)

  // Always pinned, never inherited, and before the navigation or it has no
  // effect. `chrome-headless-shell` — what Playwright's own download launches —
  // reports `prefers-reduced-motion: reduce` where the system Chromium reports
  // no preference. A piece that honours the preference then pins every motion
  // setting to 0 and parks its loop, so a test asserting that something moves
  // passes locally and fails in CI.
  await page.emulateMedia({ reducedMotion: options.reducedMotion ? "reduce" : "no-preference" })

  const query = params.toString()
  await page.goto(`/experiments/${slug}/${query ? `?${query}` : ""}`)

  // The piece is a module script, so it arrives after the document does.
  await page.waitForFunction(() => Boolean(window.experiment), undefined, { timeout: 15_000 })

  const experiment: Experiment<Api> = {
    page,
    api: (fn, arg) => callApi(page, fn, arg as never),
    shot: (name) => shot(page, `${slug}-${name}`),
  }

  if (options.idle !== undefined) await experiment.api(({ api, arg }) => api.idle(arg), options.idle)

  return experiment
}

async function callApi<Api, Arg, T>(
  page: Page,
  fn: (handle: { api: Api; arg: Arg }) => T | Promise<T>,
  arg: Arg,
): Promise<T> {
  // A fresh handle per call, so this keeps working across a navigation — which
  // the query-string round-trip test depends on.
  const handle = (await page.evaluateHandle(() => {
    const api = window.experiment
    if (!api) throw new Error("window.experiment is missing — did the piece's module fail to load?")
    return api
  })) as JSHandle<Api>

  try {
    // Playwright transfers handles nested inside a plain object, so the API
    // arrives as the live in-page object and `arg` as serialised data. The cast
    // is because Playwright's `Unboxed<Arg>` cannot be proved equal to `Arg`
    // for a type variable; the public signature above is the checked one.
    return await page.evaluate(fn as never, { api: handle, arg })
  } finally {
    await handle.dispose()
  }
}

async function shot(page: Page, name: string): Promise<string> {
  mkdirSync(SHOT_DIR, { recursive: true })
  const path = `${SHOT_DIR}/${name}.png`
  await page.screenshot({ path })
  await test.info().attach(name, { path, contentType: "image/png" })
  return path
}
