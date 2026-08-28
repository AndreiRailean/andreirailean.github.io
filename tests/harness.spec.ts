import { expect, test } from "./support/experiment.ts"

/**
 * What the harness itself guarantees, checked rather than assumed.
 *
 * The suite drives a dev server, so every page it sees carries things the
 * published site does not. Each of those is suppressed in
 * `tests/support/experiment.ts` by intercepting a module path — and a module
 * path is exactly the kind of thing that changes in a minor release, silently
 * and without breaking anything else. This is the test that would notice.
 */

test("no dev toolbar reaches the pages under test", async ({ page }) => {
  await page.goto("/experiments/")
  await expect(page.locator("astro-dev-toolbar")).toHaveCount(0)

  // The element is the visible half. The module also styles and measures the
  // page, so the check that matters is that it never ran.
  expect(await page.evaluate(() => "__astro_dev_toolbar_ready__" in window)).toBe(false)
  await expect(page.locator("#dev-toolbar-root")).toHaveCount(0)
})
