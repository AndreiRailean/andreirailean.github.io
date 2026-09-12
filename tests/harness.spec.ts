import { expect, test } from "./support/experiment.ts"

/**
 * What the harness itself guarantees, checked rather than assumed.
 *
 * **Read the next paragraph before trusting this file.** What it asserts has not
 * changed; what it is *capable of catching* has, twice, and a docblock that
 * overstates a check is worse than no check — it reads as coverage.
 *
 * ## What it was
 *
 * The suite drove a dev server, and the dev toolbar is part of the dev server
 * rather than part of the site. It injected an `<astro-dev-toolbar>` and four
 * more `h1` elements into every page, so a `page.locator("h1")` on a note
 * resolved to Astro's audit panel as well as the note's own title. Three things
 * successively took that away:
 *
 * 1. The `noDevToolbar` fixture, which served the toolbar's module empty.
 * 2. `devToolbar: { enabled: false }` in `astro.config.mjs` (#170), so a server
 *    started from this checkout never served it at all.
 * 3. The suite moving to a **static build** served by `astro preview`. A build
 *    emits no toolbar under any configuration, because the toolbar is a thing
 *    the dev server injects and there is no dev server.
 *
 * The fixture is gone: its stated job was to cover a dev server *adopted* from
 * an older worktree, cut before the config option landed, and under preview
 * there is no adoption and no toolbar to adopt.
 *
 * ## What it is now
 *
 * **A revert detector, and nothing else.** Against a static build this asserts
 * the absence of something structurally impossible, so it cannot fail for the
 * reason it was written — there is no longer any mechanism by which a toolbar
 * could reach these pages while the suite is configured as it is.
 *
 * That is still worth keeping, for the one failure it *can* see: the day anyone
 * points the suite back at `astro dev`, this is what goes red. It is cheap, it
 * names the thing that would break, and the alternative — deleting it — would
 * mean the revert lands silently and gets diagnosed from a `page.locator("h1")`
 * returning Astro's audit panel, which is how an afternoon went the first time.
 *
 * So: do not read a green run here as evidence that toolbar suppression works.
 * Read it as evidence that the suite is still on a build.
 */
test("no dev toolbar reaches the pages under test", async ({ page }) => {
  await page.goto("/experiments/")
  await expect(page.locator("astro-dev-toolbar")).toHaveCount(0)

  // The element is the visible half. The module also styles and measures the
  // page, so the check that matters is that it never ran.
  expect(await page.evaluate(() => "__astro_dev_toolbar_ready__" in window)).toBe(false)
  await expect(page.locator("#dev-toolbar-root")).toHaveCount(0)
})

/**
 * No test traffic reaches the live analytics property.
 *
 * **This could not have been written before the suite moved onto a build.**
 * `GoogleAnalytics.astro` gates itself on `import.meta.env.PROD`, so under
 * `astro dev` there was nothing to block and nothing to notice. The first
 * build-served run reported a failed beacon, and the failure was the small half
 * of the problem: the large half is that every `page.goto("/")` here is a
 * `page_view` against the real property, silently, for as long as nobody looks.
 *
 * The `noAnalytics` fixture in `tests/support/experiment.ts` fulfils those
 * requests with a 204 so nothing leaves the box.
 *
 * ## Why this asserts fulfilments rather than absence of failures
 *
 * The first version of this test watched for `requestfailed` and asserted there
 * were none. **It passed with the matcher deliberately broken**, which is how it
 * was caught: a request that is allowed through is still in flight when the test
 * ends, so there is nothing to fail yet. Absence of a failure was measuring the
 * test's own length.
 *
 * Counting what the route *fulfilled* cannot be faked by timing, and it fails in
 * both directions that matter:
 *
 * - The matcher stops matching — nothing is intercepted, and that is the number
 *   asserted, so this goes red rather than quietly stopping work.
 * - Analytics stops being on the page at all — then nothing is attempted either,
 *   and the first assertion catches a test that would otherwise pass for ever
 *   while proving nothing.
 */
test("no analytics beacon leaves the machine", async ({ page, noAnalytics }) => {
  const attempted: string[] = []
  const isAnalytics = (url: string) => /googletagmanager|google-analytics/.test(url)
  page.on("request", (request) => {
    if (isAnalytics(request.url())) attempted.push(request.url())
  })

  // **Armed before navigating, not after.** `waitForRequest` only sees requests
  // made after it is called, and the footer's script fires the beacon during
  // `goto` — so awaiting it afterwards waits for a *second* beacon that never
  // comes and times out.
  const beacon = page.waitForRequest((request) => isAnalytics(request.url()), { timeout: 15_000 })
  await page.goto("/")
  await beacon

  expect(
    attempted.length,
    "the page made no analytics request at all, so this test proves nothing — has the " +
      "GoogleAnalytics component or its PROD gate changed?",
  ).toBeGreaterThan(0)
  expect(
    noAnalytics.length,
    "analytics requests were made and the noAnalytics fixture intercepted none of them, so they " +
      "went to the live property. Its route pattern has stopped matching.",
  ).toBeGreaterThan(0)
})
