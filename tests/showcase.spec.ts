import { expect, test } from "./support/experiment.ts"

/**
 * The published background on the site's own home page, and the loader beneath
 * it.
 *
 * Everything here needs a real browser, and for a sharper reason than most of
 * this suite: the whole arrangement is that the page reaches the piece through
 * **a pinned URL and a 19-character string, with no imports**. A unit test
 * cannot tell that working apart from a build that quietly inlined the piece;
 * only fetching the page and watching a canvas appear can.
 *
 * What needs no browser — that the pinned runner is committed, and that a piece
 * has not changed without being republished — is in
 * `tests/unit/showcase-runners.test.ts`.
 */

type Stats = { runner: string; variant: string; followSystem: boolean; dots: number; running: boolean }
type ShowcaseWindow = { showcase?: { setVariant: (variant: string) => void; stats: () => Stats[] } }

const mounted = () => (window as unknown as ShowcaseWindow).showcase?.stats().length === 1
const first = () => (window as unknown as ShowcaseWindow).showcase!.stats()[0]!

test("the home page runs a pinned runner from an inline scene", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(mounted)

  const container = page.locator("#showcase-bg")
  await expect(container).toHaveAttribute("data-showcase-state", "running")
  await expect(container.locator("canvas")).toHaveCount(1)

  // Reading through the loader rather than off the pixels: a still canvas and a
  // running one look identical in a screenshot, the same reason `stats().running`
  // exists for the pieces.
  const stats = await page.evaluate(first)
  expect(stats.running).toBe(true)
  expect(stats.dots).toBeGreaterThan(0)
  expect(stats.runner).toMatch(/^\/showcase\/runners\/starry-night\.[0-9a-f]{12}\.js$/)
})

test("the page's own content sits over the background, not under it", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("#showcase-bg canvas")).toHaveCount(1)

  // A `position: fixed` container outranks unpositioned block content in the
  // paint order whatever the DOM order says, so this is one CSS rule away from a
  // page whose text is invisible — and invisible in a way nothing else here
  // would catch, since every element still exists and still reports a box.
  await expect(page.locator("h1")).toBeVisible()
  await expect(page.locator("footer button").first()).toBeVisible()
  expect(await page.locator("h1").evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(0)
})

test("this page drives the scheme itself, and says so", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(mounted)

  // The site's theme is a class and a `localStorage` choice, not a media query,
  // so the page takes the switch over. `followSystem: false` is the loader
  // recording that it has been told to stop guessing.
  expect((await page.evaluate(first)).followSystem).toBe(false)

  const variant = async () => (await page.evaluate(first)).variant
  const before = await variant()
  await page.evaluate(() => document.documentElement.classList.toggle("dark"))
  await expect.poll(variant).not.toBe(before)
  await page.evaluate(() => document.documentElement.classList.toggle("dark"))
  await expect.poll(variant).toBe(before)
})

/**
 * The scheme has to be right on the *first* frame, not eventually.
 *
 * `<Footer>` carries the script that puts `.dark` on the document and renders
 * after the page's own slot, so anything here that reads the class while parsing
 * reads it before it exists. Worth a test rather than a comment because the
 * symptom was not a wrong background — it was a *flash*, and then, depending on
 * whether the theme toggle had finished hydrating, sometimes a correction and
 * sometimes not. A test of the settled state passed throughout.
 */
for (const [name, stored, os] of [
  ["the OS preference, with nothing stored", null, "dark"],
  ["a stored choice that disagrees with the OS", "light", "dark"],
] as const) {
  test(`the background starts on ${name}, without passing through the other one`, async ({ page }) => {
    await page.addInitScript((value) => {
      if (value) localStorage.setItem("theme", value)
      const seen: string[] = []
      ;(window as unknown as { __variants: string[] }).__variants = seen
      new MutationObserver(() => {
        const shown = document.getElementById("showcase-bg")?.dataset.showcaseVariant
        if (shown && seen.at(-1) !== shown) seen.push(shown)
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-showcase-variant"] })
    }, stored)

    await page.emulateMedia({ colorScheme: os })
    await page.goto("/")
    await page.waitForFunction(mounted)

    expect(await page.evaluate(() => (window as unknown as { __variants: string[] }).__variants)).toEqual([
      stored ?? os,
    ])
  })
}

/**
 * The default mode, which the home page deliberately does not use.
 *
 * A page that pastes the snippet and writes no code should follow the system
 * theme **and keep following it**, including a change made while the page is
 * open — reading `prefers-color-scheme` once at mount is how a background ends
 * up on yesterday's scheme in a long session.
 *
 * Driven through a synthetic host page served on the dev server's own origin,
 * rather than a route added to `src/pages/`: a module script is subject to CORS,
 * so `setContent` on `about:blank` cannot load the loader, and a fixture page
 * that shipped to production would be a page nobody asked for.
 */
test("a page that names two scenes and no variant follows the system, live", async ({ page }) => {
  const scenes = await page.request.get("/").then(async (response) => {
    const html = await response.text()
    return {
      runner: /data-showcase-runner="([^"]+)"/.exec(html)![1]!,
      light: /data-showcase-scene="([^"]+)"/.exec(html)![1]!,
      dark: /data-showcase-scene-dark="([^"]+)"/.exec(html)![1]!,
    }
  })

  await page.route("**/__showcase-fixture", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><html><body>
        <div id="bg" style="position:fixed;inset:0"
             data-showcase-runner="${scenes.runner}"
             data-showcase-scene="${scenes.light}"
             data-showcase-scene-dark="${scenes.dark}"></div>
        <script type="module" src="/showcase/embed.js"></script>
      </body></html>`,
    }),
  )

  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/__showcase-fixture")
  await page.waitForFunction(mounted)

  expect(await page.evaluate(first)).toMatchObject({ variant: "light", followSystem: true })

  await page.emulateMedia({ colorScheme: "dark" })
  await expect.poll(async () => (await page.evaluate(first)).variant).toBe("dark")

  await page.emulateMedia({ colorScheme: "light" })
  await expect.poll(async () => (await page.evaluate(first)).variant).toBe("light")

  // And a host that takes over stops the system deciding, so the two cannot fight.
  await page.evaluate(() => (window as unknown as ShowcaseWindow).showcase!.setVariant("dark"))
  await page.emulateMedia({ colorScheme: "light" })
  await expect.poll(async () => (await page.evaluate(first)).variant).toBe("dark")
})

/**
 * The failure that matters, because it is the one nobody would notice.
 *
 * The site's dot pattern is left in `globals.css` precisely so a dead embed
 * leaves the page looking deliberate rather than blank. If the loader ever
 * started leaving an empty canvas behind instead of removing it, the page would
 * go flat and every other test here would still pass.
 */
test("an unreachable runner leaves the host page exactly as it was", async ({ page, problems }) => {
  await page.route("**/showcase/runners/*.js", (route) => route.fulfill({ status: 404, body: "gone" }))
  await page.goto("/")

  const container = page.locator("#showcase-bg")
  await expect(container).toHaveAttribute("data-showcase-state", "failed")
  await expect(container.locator("canvas")).toHaveCount(0)

  await expect(page.locator("h1")).toBeVisible()
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundImage)
  expect(background).toContain("bg")
  expect(background).not.toBe("none")

  // This test breaks something on purpose, so the suite's console watchdog is
  // read rather than suppressed: the dead runner is the *only* thing the page is
  // allowed to complain about, and anything else here would be a real fault
  // hiding behind an expected one. Cleared afterwards, or the fixture fails the
  // test for the failure it was asked to cause.
  //
  // A blocked module script is reported twice and only one of the two names the
  // URL: the failed request does, the console line is a bare "404 (Not Found)".
  // So the runner has to be named at least once — proving the right thing broke
  // — and nothing may complain about anything else.
  const expected = (problem: string) => problem.includes("/showcase/runners/") || problem.includes("404")
  expect(problems.some((problem) => problem.includes("/showcase/runners/"))).toBe(true)
  expect(problems.filter((problem) => !expected(problem))).toEqual([])
  problems.length = 0
})
