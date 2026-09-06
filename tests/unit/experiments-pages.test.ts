import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * A piece's page holds markup. It holds no logic.
 *
 * Every `src/pages/experiments/<slug>/index.astro` used to carry about 115 lines
 * of boot script — over half the file — reading elements, building the chrome,
 * wiring the console API, rewriting the address. That code was the section's,
 * and it lived outside `src/experiments/`.
 *
 * **Two things follow from that, and only one of them is inconvenience.**
 *
 * A grep of `src/experiments/` never reached it, so a refactor across the
 * section missed call sites it could not see — `copyLabel` was renamed with
 * three live callers in these files, caught only by `astro check` inside the
 * lint job, which is the one thing here that types `.astro` at all.
 *
 * The worse one: **`tests/unit/kit-adoption.test.ts` reads `.ts` files**, so the
 * check written to catch a piece reimplementing shared code could not see any of
 * this. Five byte-identical copies of `requireElement` sat there, differing only
 * in the piece's name in an error string, well past the third-copy rule, for as
 * long as the pages existed.
 *
 * So the script moved to `src/experiments/<slug>/page.ts` and the page calls
 * `boot()`. This keeps it there. See
 * `src/experiments/docs/adr/20260906-a-page-holds-no-logic.md`.
 */

const PAGES = "src/pages/experiments"

const slugs = readdirSync(PAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

/** The body of the page's `<script>`, or "" if it has none. */
function scriptBody(source: string): string {
  const open = source.indexOf("<script>")
  if (open < 0) return ""
  const close = source.indexOf("</script>", open)
  return source.slice(open + "<script>".length, close)
}

const statements = (body: string) =>
  body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*"))

it("finds the pages, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  const page = readFileSync(`${PAGES}/${slug}/index.astro`, "utf8")

  it("boots from a module rather than carrying the script itself", () => {
    const lines = statements(scriptBody(page))

    // An import and a call. Anything else is logic that a grep of
    // `src/experiments/` will not find and `kit-adoption` cannot read.
    const strays = lines.filter((line) => !line.startsWith("import ") && !/^boot\(\)$/.test(line))

    expect(
      strays,
      `${slug}'s page carries script of its own (${strays.slice(0, 3).join(" / ")}). Move it to ` +
        `src/experiments/${slug}/page.ts and call boot() — code outside src/experiments is invisible ` +
        `to a grep of the section and to kit-adoption.test.ts, which is how five copies of ` +
        `requireElement went unnoticed.`,
    ).toEqual([])
  })

  it("imports its boot from the section, not from a path that climbs out of it", () => {
    const body = scriptBody(page)
    expect(
      body.includes(`@/experiments/${slug}/page`),
      `${slug}'s page does not import its boot from @/experiments/${slug}/page`,
    ).toBe(true)
  })
})
