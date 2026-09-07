import { expect, test } from "./support/experiment.ts"

/**
 * What the harness itself guarantees, checked rather than assumed.
 *
 * The suite drives a dev server, so every page it sees can carry things the
 * published site does not. The dev toolbar is the one that bit: it injects an
 * `<astro-dev-toolbar>` and five more `h1` elements, and a `page.locator("h1")`
 * on a note resolved to Astro's audit panel as well as the note's own title.
 *
 * **This asserts the end state, not the mechanism, and that changed.** There are
 * now two things keeping the toolbar off these pages, and this test cannot tell
 * which one did it:
 *
 * 1. `devToolbar: { enabled: false }` in `astro.config.mjs`, so a server started
 *    from this checkout never serves it at all.
 * 2. The `noDevToolbar` fixture in `tests/support/experiment.ts`, which serves
 *    the toolbar's module empty.
 *
 * The second is not redundant, because the suite **adopts** a running dev server
 * rather than insisting on its own — a server from an older worktree, cut before
 * the config option landed, still serves the toolbar. So the fixture is what
 * covers the adopted case and the config covers the ordinary one.
 *
 * **What this test no longer is.** It used to say it was "the test that would
 * notice" a module path changing in a minor release, since interception was the
 * only defence. It is not that any more: with the config off, a stale
 * `DEV_TOOLBAR_MODULE` glob would let this pass while the fixture silently
 * matched nothing. That gap only opens against a server this checkout did not
 * configure, which is exactly the case nothing here can arrange — noted rather
 * than papered over, because a check whose docblock overstates it is worse than
 * one that admits its edge.
 */

test("no dev toolbar reaches the pages under test", async ({ page }) => {
  await page.goto("/experiments/")
  await expect(page.locator("astro-dev-toolbar")).toHaveCount(0)

  // The element is the visible half. The module also styles and measures the
  // page, so the check that matters is that it never ran.
  expect(await page.evaluate(() => "__astro_dev_toolbar_ready__" in window)).toBe(false)
  await expect(page.locator("#dev-toolbar-root")).toHaveCount(0)
})
