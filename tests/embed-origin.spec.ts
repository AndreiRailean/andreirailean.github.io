import { expect, test } from "@playwright/test"
import { WALL } from "@/showcase/wall"
import { startOrigins, type Origins } from "./support/origin-server.ts"

/**
 * The embed across an origin boundary, which is the only way it is ever used.
 *
 * `gallery/embed.ts` exists so a page **we do not control** can run a piece.
 * Every other test of it runs same-origin — `showcase.spec.ts` drives our own
 * home page — and same-origin hides three separate requirements at once, all
 * of which appear together the first time somebody pastes the tag elsewhere:
 *
 * 1. the **module script tag** that loads `embed.js`,
 * 2. the dynamic **`import()`** of the runner,
 * 3. any **fetch** either makes.
 *
 * Each needs CORS across a host boundary and none needs it here. #186 recorded
 * the gap; `support/origin-server.ts` is the harness, serving the same bytes
 * under `/cors/` and `/nocors/` so the difference is demonstrated rather than
 * asserted.
 *
 * **Nothing is broken today** — GitHub Pages sends `access-control-allow-origin:
 * *` on every asset, verified on the live host. The risk this covers is a change
 * that quietly stops depending on that, and a host that does not send it. The
 * failure mode is the worst kind: the piece mounts and shows nothing, on
 * somebody else's host only, where nobody is looking.
 *
 * It also puts a test behind a term of the embed contract that had none.
 * `docs/.../20260912-the-image-is-an-input-not-a-subject.md` makes CORS a
 * contract term rather than an implementation detail, and says so with no check
 * behind it.
 *
 * ## Why this is a browser test
 *
 * CORS is enforced by the browser and by nothing else. There is no unit-level
 * version: node's fetch does not apply it, and the requirement is precisely
 * about what a browser refuses.
 */

/** A real published pair, read off the wall rather than pinned here, so it cannot go stale. */
const PUBLISHED = WALL[0]!

/** The tag a copy-embed button produces, with the artefacts on a named mount. */
const hostPage = (assets: string, embedMount: string, runnerMount: string) => `<!doctype html>
<title>somebody else's site</title>
<body style="background:#123">
  <div id="bg" style="position:fixed;inset:0"
       data-showcase-runner="${assets}/${runnerMount}/runners/${PUBLISHED.runner}"
       data-showcase-scene="${PUBLISHED.scene}"></div>
  <script type="module" src="${assets}/${embedMount}/embed.js"></script>
</body>`

let origins: Origins

test.beforeAll(async () => {
  origins = await startOrigins()
})

test.afterAll(async () => {
  await origins.close()
})

/**
 * The arm that proves the harness is measuring CORS and not something else.
 *
 * Without this passing, the two failures below would be equally well explained
 * by "the second origin serves nothing at all" — which is the null control this
 * whole file would otherwise lack.
 */
test("a page on another origin runs the piece when the artefacts allow it", async ({ page }) => {
  origins.setPage(hostPage(origins.assets, "cors", "cors"))
  await page.goto(origins.host)

  const container = page.locator("#bg")
  await expect(container).toHaveAttribute("data-showcase-state", "running")
  await expect(container.locator("canvas")).toHaveCount(1)

  // Through the loader rather than the pixels: a still canvas and a running one
  // are identical in a screenshot, which is why `stats()` exists.
  const stats = await page.evaluate(() => (window as { showcase?: { stats: () => unknown[] } }).showcase?.stats())
  expect(stats, "the embed did not register an instance on a foreign origin").toHaveLength(1)
})

/**
 * The arm the issue was filed for.
 *
 * A runner the host cannot read is exactly the shape of a host that forgets the
 * header, and the embed's documented promise is that failure **leaves the host
 * page as it was**. So this asserts the promise, not just the absence of a
 * canvas: the container is emptied and the host's own background survives.
 */
test("a runner served without CORS fails, and leaves the host page alone", async ({ page }) => {
  const complaints: string[] = []
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") complaints.push(message.text())
  })

  // `embed.js` still on /cors/, so the loader itself runs and only the runner
  // is unreadable. Isolating requirement 2 from requirement 1.
  origins.setPage(hostPage(origins.assets, "cors", "nocors"))
  await page.goto(origins.host)

  const container = page.locator("#bg")
  await expect(container).toHaveAttribute("data-showcase-state", "failed")
  await expect(container.locator("canvas")).toHaveCount(0)

  // The host's page is untouched — the reason the loader empties the container
  // rather than leaving a dead canvas in it.
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(background, "the host's own background did not survive a failed embed").toBe("rgb(17, 34, 51)")

  expect(
    complaints.some((text) => text.includes("[showcase] embed failed")),
    `the loader failed without saying so. Saw: ${JSON.stringify(complaints)}`,
  ).toBe(true)
})

/**
 * Requirement 1 on its own, which fails earlier and more quietly than the rest.
 *
 * A module script the host cannot read never executes, so none of the loader's
 * error handling runs: there is no `failed` state, because there is nothing to
 * set it. Worth pinning because it is the one failure that leaves no trace in
 * the DOM at all, and the temptation is to assume the `failed` state covers it.
 */
test("an embed.js served without CORS never runs, and marks nothing", async ({ page }) => {
  origins.setPage(hostPage(origins.assets, "nocors", "cors"))
  await page.goto(origins.host)

  await expect(page.locator("#bg")).not.toHaveAttribute("data-showcase-state", /.*/)
  await expect(page.locator("#bg").locator("canvas")).toHaveCount(0)
  expect(
    await page.evaluate(() => "showcase" in window),
    "embed.js executed despite being unreadable across the origin",
  ).toBe(false)
})
