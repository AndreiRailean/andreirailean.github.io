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
  { slug: "dangler", title: "Dangler" },
  { slug: "starry-night", title: "Starry Night" },
]

test("lists every experiment, each with a poster that actually loaded", async ({ page }) => {
  await page.goto("/experiments/")

  const plates = page.locator(".plate")
  await expect(plates).toHaveCount(EXPECTED.length)

  for (const { slug, title } of EXPECTED) {
    const plate = plates.filter({ has: page.locator(`a.open[href="/experiments/${slug}/"]`) })
    await expect(plate).toHaveCount(1)
    await expect(plate.locator(".title")).toHaveText(title)

    // Decoded, not merely present. A missing or unreadable image still has a
    // box; only `naturalWidth` tells them apart.
    const poster = plate.locator("img")
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  }
})

test("the caption sits over the plate's link without swallowing it", async ({ page }) => {
  await page.goto("/experiments/")

  // A real pointer press at the caption's own centre, not `locator.click()`:
  // Playwright refuses that one because it can see `a.open` "intercepting" the
  // event, which is exactly the arrangement under test. What a person does is
  // press at those coordinates, so that is what this does.
  const summary = page.locator(".plate").first().locator(".summary")
  const box = await summary.boundingBox()
  if (!box) throw new Error("the caption has no box to click")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  await expect(page).toHaveURL(/\/experiments\/dangler\/\?/)
})

test("about is the one thing on the caption that catches its own click", async ({ page }) => {
  await page.goto("/experiments/")

  await page.locator(".plate").first().locator("a.note").click()
  await expect(page).toHaveURL(/\/experiments\/dangler\/about\/$/)
})

test("a plate is two tab stops, not two links to the same place", async ({ page }) => {
  await page.goto("/experiments/")

  // The poster used to be a second anchor to the piece, which meant a second tab
  // stop and a second announcement of one destination.
  const links = page.locator(".plate").first().locator("a")
  await expect(links).toHaveCount(2)
  await expect(links.nth(0)).toHaveAttribute("href", "/experiments/dangler/")
  await expect(links.nth(1)).toHaveAttribute("href", "/experiments/dangler/about/")
})

test("the panel names the artist and counts the room from the work in it", async ({ page }) => {
  await page.goto("/experiments/")

  await expect(page.locator(".masthead .byline")).toHaveText("Andrei Railean")

  // Derived, not written down. The count and the opening date come from the
  // collection, so a third piece cannot leave the panel claiming two.
  const plates = await page.locator(".plate").count()
  await expect(page.locator(".masthead .run")).toHaveText(new RegExp(`^${plates} pieces · since \\w+ \\d{4}$`))
})
