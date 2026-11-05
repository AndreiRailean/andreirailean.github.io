import type { Page } from "@playwright/test"
import { expect, test } from "./support/experiment.ts"

/**
 * The index, which is the one page in this section that is not a piece.
 *
 * Two things here are worth a real browser. The posters: `astro:assets` rewrites
 * every `src` into a generated URL, and a broken one renders as a perfectly
 * valid `<img>` with a `naturalWidth` of zero — `src/experiments/AGENTS.md` puts
 * it plainly, a 200 proves nothing about content. And the plate's two targets:
 * the caption sits *over* the link that opens the piece and is only clickable
 * through because it declines pointer events, which is a rule no markup
 * assertion can check. Both are tested by using them.
 */

const EXPECTED = [
  { slug: "artdeco", title: "Art Deco" },
  { slug: "bubbles", title: "Bubbles" },
  { slug: "crowd", title: "Crowd" },
  { slug: "dangler", title: "Dangler" },
  { slug: "dotfield", title: "Dotfield" },
  { slug: "embers", title: "Embers" },
  { slug: "flotsam", title: "Flotsam" },
  { slug: "hexgrid", title: "Hexgrid" },
  { slug: "melting", title: "Melting" },
  { slug: "psyxels", title: "Psyxels" },
  { slug: "starry-night", title: "Starry Night" },
  { slug: "streakers", title: "Streakers" },
  { slug: "walkers", title: "Walkers" },
]

/**
 * The slug of whichever plate is first, read off the page rather than written
 * down.
 *
 * The index sorts by `updated`, so the first plate changes whenever any piece is
 * touched — naming it here made three tests fail on the arrival of a third
 * experiment, for no reason connected to what they were checking. The panel test
 * below already derives its count for the same reason.
 */
/**
 * Opens the index and waits until the plates near the screen are drawn.
 *
 * `gallery/plates.ts` fetches each piece's code as its plate comes near, one
 * plate at a time, for a second or two after the page loads. A test that
 * clicks through to a piece before that is done aborts a fetch in flight,
 * which the `problems` fixture rightly reports as a failed request.
 */
async function openIndex(page: Page, query = ""): Promise<void> {
  await page.goto(`/experiments/${query}`)
  await expect(page.locator("html")).toHaveAttribute("data-plates", "idle", { timeout: 30_000 })
}

async function firstPlateSlug(page: Page): Promise<string> {
  const href = await page.locator(".plate").first().locator("a.open").getAttribute("href")
  const slug = href?.match(/^\/experiments\/([^/]+)\/$/)?.[1]
  if (!slug) throw new Error(`the first plate does not link to a piece: ${href}`)
  return slug
}

test("lists every experiment, each with a poster that actually loaded", async ({ page }) => {
  await page.goto("/experiments/")

  const plates = page.locator(".plate")
  await expect(plates).toHaveCount(EXPECTED.length)

  for (const { slug, title } of EXPECTED) {
    const plate = plates.filter({ has: page.locator(`a.open[href="/experiments/${slug}/"]`) })
    await expect(plate).toHaveCount(1)
    await expect(plate.locator(".title")).toHaveText(title)
    // And its note, which `experiments-notes.spec.ts` used to check by walking
    // every note back to here; the notes are now tested on one host (#287).
    await expect(plate.locator(`a.note[href="/experiments/${slug}/about/"]`)).toHaveCount(1)

    // Decoded, not merely present. A missing or unreadable image still has a
    // box; only `naturalWidth` tells them apart. Scrolled to first, because the
    // posters load lazily: a plate far enough down the wall is never fetched,
    // which is a poster nobody asked for yet rather than a broken one. The
    // thirteenth plate was the first to land past Chromium's lazy-load margin.
    await plate.scrollIntoViewIfNeeded()
    const poster = plate.locator("img")
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  }
})

test("the caption sits over the plate's link without swallowing it", async ({ page }) => {
  await openIndex(page)

  // A real pointer press at the caption's own centre, not `locator.click()`:
  // Playwright refuses that one because it can see `a.open` "intercepting" the
  // event, which is exactly the arrangement under test. What a person does is
  // press at those coordinates, so that is what this does.
  const slug = await firstPlateSlug(page)
  const summary = page.locator(".plate").first().locator(".summary")
  const box = await summary.boundingBox()
  if (!box) throw new Error("the caption has no box to click")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  // The piece, not the piece with a query string on it. This used to insist on a
  // `?`, because Dangler rewrites the address on landing to name the scene it
  // opened on — but a piece whose defaults *are* its featured scene has nothing
  // to rewrite and lands bare, which is correct and is not what this is about.
  await expect(page).toHaveURL(new RegExp(`/experiments/${slug}/(\\?|$)`))
})

test("about is the one thing on the caption that catches its own click", async ({ page }) => {
  await openIndex(page)

  const slug = await firstPlateSlug(page)
  await page.locator(".plate").first().locator("a.note").click()
  // A query is allowed for the reason it is on the piece above: the note's
  // address is the piece with its note open now, so the kit rewrites it to name
  // the scene it landed on. Insisting on a bare address made this a race
  // against that rewrite, which it lost under load.
  await expect(page).toHaveURL(new RegExp(`/experiments/${slug}/about/(\\?|$)`))
})

test("a plate is two tab stops, not two links to the same place", async ({ page }) => {
  await page.goto("/experiments/")

  // The poster used to be a second anchor to the piece, which meant a second tab
  // stop and a second announcement of one destination.
  const slug = await firstPlateSlug(page)
  const links = page.locator(".plate").first().locator("a")
  await expect(links).toHaveCount(2)
  await expect(links.nth(0)).toHaveAttribute("href", `/experiments/${slug}/`)
  await expect(links.nth(1)).toHaveAttribute("href", `/experiments/${slug}/about/`)
})

test("the panel names the artist and counts the room from the work in it", async ({ page }) => {
  await page.goto("/experiments/")

  await expect(page.locator(".masthead .byline")).toHaveText("Andrei Railean")

  // Derived, not written down. The count and the opening date come from the
  // collection, so a third piece cannot leave the panel claiming two.
  const plates = await page.locator(".plate").count()
  await expect(page.locator(".masthead .run")).toHaveText(new RegExp(`^${plates} pieces · since \\w+ \\d{4}$`))
})

test("every piece that can be drawn draws its plate, as a real frame the width of its plate", async ({
  page,
}, testInfo) => {
  // With the budget lifted, because this machine is slower than the ones it
  // protects: one slow plate would turn the rest into posters, leave their
  // recipes untried, and fail nothing.
  await openIndex(page, "?budget=off")
  // Off every plate, so none is lifted by its hover and measures wider than it sits.
  await page.mouse.move(0, 0)

  // Each plate starts empty and is filled by `gallery/plates.ts`. Scrolled to
  // in turn, because a plate is only drawn once it comes near the screen.
  const plates = page.locator(".plate")
  for (let i = 0; i < (await plates.count()); i += 1) {
    await plates.nth(i).scrollIntoViewIfNeeded()
    await expect(plates.nth(i)).toHaveAttribute("data-shown", /^(live|poster)$/, { timeout: 30_000 })
  }

  // A poster only where a piece is not drawn on purpose. `failed`, `slow` and
  // `not a piece` all mean a plate that should have been drawn and was not.
  const outcomes = await plates.evaluateAll((elements) =>
    elements.map((element) => ({
      piece: element.getAttribute("data-piece"),
      shown: element.getAttribute("data-shown"),
      why: element.getAttribute("data-why"),
      ms: element.getAttribute("data-drawn-ms"),
    })),
  )
  testInfo.annotations.push({
    type: "plates",
    description: outcomes.map(({ piece, shown, why, ms }) => `${piece} ${shown} ${why ?? `${ms} ms`}`).join(", "),
  })
  expect(outcomes.filter(({ shown, why }) => shown !== "live" && why !== "poster-only")).toEqual([])
  // Presence, not only the absence of a stray poster: a module that marked
  // every piece poster-only would pass the line above.
  const drawn = page.locator('.plate[data-shown="live"]')
  expect(await drawn.count()).toBeGreaterThan(0)

  for (const plate of await drawn.all()) {
    const { width, frame, lit, poster } = await plate.evaluate((element) => {
      const canvas = element.querySelector<HTMLCanvasElement>(".live canvas")!
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height)
      // Pixels that differ from the corner, as a share of all of them. A
      // canvas the piece never drew on is one colour throughout.
      let differ = 0
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i]! - data[0]!) + Math.abs(data[i + 1]! - data[1]!) + Math.abs(data[i + 2]! - data[2]!) >
          30
        ) {
          differ += 1
        }
      }
      return {
        width: element.getBoundingClientRect().width,
        frame: canvas.getBoundingClientRect().width,
        lit: differ / (data.length / 4),
        poster: getComputedStyle(element.querySelector("img")!).opacity,
      }
    })
    const piece = await plate.getAttribute("data-piece")
    expect(Math.abs(frame - width), `${piece}'s frame is ${frame}px in a ${width}px plate`).toBeLessThan(1)
    // A canvas nothing drew on scores exactly 0. The floor sits well under
    // the sparsest plate, Starry Night's sky at about 0.7%, which a 1% floor
    // written for the denser pieces failed.
    expect(lit, `${piece}'s frame is blank`).toBeGreaterThan(0.002)
    // The poster under a drawn frame stays hidden. This is what the page
    // starting blank rests on; without it the rejected poster-then-crossfade
    // (src/experiments/docs/adr/20260901-a-poster-held-over-a-booting-piece.md)
    // would be back with nothing failing.
    expect(poster, `${piece}'s poster shows under its frame`).toBe("0")
  }
})

test("a device that draws slowly gets posters for the rest of the wall", async ({ page }) => {
  // Twenty times slower: on the box the budget was set on, the second plate
  // drawn takes over a second, past the 600 ms a plate is allowed.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 })
  await openIndex(page)

  const plates = page.locator(".plate")
  for (let i = 0; i < (await plates.count()); i += 1) {
    await plates.nth(i).scrollIntoViewIfNeeded()
    await expect(plates.nth(i)).toHaveAttribute("data-shown", /^(live|poster)$/, { timeout: 60_000 })
  }
  // Something was cut off by the budget, and nothing failed while it was.
  await expect(page.locator('.plate[data-why="slow"]').first()).toBeAttached()
  await expect(page.locator('.plate[data-why="failed"]')).toHaveCount(0)
})

test("the posters come back if the script that draws the plates never runs", async ({ page, problems }) => {
  // The page hides every poster before it paints, so that a drawn frame can
  // fade in where nothing was. If the module never arrives, that would leave a
  // wall of empty plates; the inline script that hid them brings them back.
  // That they are hidden in the first place is checked by the test above.
  await page.route(/\/_astro\/.*\.js$/, (route) => route.abort())
  await page.goto("/experiments/")

  await expect(page.locator("html")).not.toHaveClass(/\bplates\b/, { timeout: 10_000 })
  const poster = page.locator(".plate img").first()
  await expect.poll(() => poster.evaluate((img) => getComputedStyle(img).opacity)).toBe("1")

  // The aborted scripts, which are the point of this test, reported once as a
  // failed request and once by the console.
  const expected = /^(request failed: .*\/_astro\/|console\.error: Failed to load resource)/
  expect(problems.filter((problem) => !expected.test(problem))).toEqual([])
  problems.length = 0
})
