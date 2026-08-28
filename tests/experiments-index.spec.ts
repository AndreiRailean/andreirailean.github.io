import { expect, test } from "./support/experiment.ts"

/**
 * The index, which is the one page in this section that is not a piece.
 *
 * It is here rather than in a unit test because the thing worth checking is
 * whether the posters actually arrive: `astro:assets` rewrites every `src` into
 * a generated URL, and a broken one renders as a perfectly valid `<img>` with a
 * `naturalWidth` of zero. `src/experiments/AGENTS.md` puts it plainly — a 200
 * proves nothing about content.
 */

const EXPECTED = [
  { slug: "dangler", title: "Dangler" },
  { slug: "starry-night", title: "Starry Night" },
]

test("lists every experiment, each with a poster that actually loaded", async ({ page }) => {
  await page.goto("/experiments/")

  const entries = page.locator("main li")
  await expect(entries).toHaveCount(EXPECTED.length)

  for (const { slug, title } of EXPECTED) {
    const entry = entries.filter({ has: page.locator(`a.name[href="/experiments/${slug}/"]`) })
    await expect(entry).toHaveCount(1)
    await expect(entry.locator("a.name")).toHaveText(title)

    const poster = entry.locator("a.poster img")
    await expect(poster).toHaveCount(1)

    // Decoded, not merely present. A missing or unreadable image still has a
    // box; only `naturalWidth` tells them apart.
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  }
})

test("the poster is skipped by the keyboard and the screen reader, since the title repeats it", async ({ page }) => {
  await page.goto("/experiments/")

  // Two anchors to the same place would otherwise be two tab stops and two
  // announcements of the same link.
  const posters = page.locator("a.poster")
  await expect(posters).toHaveCount(EXPECTED.length)
  for (const attribute of ["tabindex", "aria-hidden"]) {
    const values = await posters.evaluateAll(
      (links, name) => links.map((l) => l.getAttribute(name as string)),
      attribute,
    )
    expect(values).toEqual(EXPECTED.map(() => (attribute === "tabindex" ? "-1" : "true")))
  }
})
