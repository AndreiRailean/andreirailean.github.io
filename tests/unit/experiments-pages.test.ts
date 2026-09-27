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
 * So the script moved to `src/experiments/<slug>/page.ts` and the page called
 * `boot()`; since #238 the boot is the gallery's, handed the piece's three
 * files. This keeps it there. See
 * `src/experiments/docs/adr/20260906-a-page-holds-no-logic.md` and
 * `src/experiments/docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
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

/**
 * The file that boots the piece: the route itself, or the piece's own
 * component when the route only renders one. Crowd's does, because one
 * component serves both its addresses — the piece, and the piece with its note
 * open (#223). Followed rather than exempted, so the checks below still read
 * the script that runs.
 */
function bootingSource(slug: string): string {
  const route = readFileSync(`${PAGES}/${slug}/index.astro`, "utf8")
  const piece = `src/experiments/${slug}/Piece.astro`
  return route.includes(`@/experiments/${slug}/Piece.astro`) ? readFileSync(piece, "utf8") : route
}

describe.each(slugs)("%s", (slug) => {
  const page = bootingSource(slug)

  /**
   * **Served by the gallery's page, at both addresses — #223.** The document,
   * `#ui`, the interactive view and the note are `gallery/PiecePage.astro`'s,
   * so a piece does not roll its own page any more than its own controls. A
   * route that writes its own document, or a note page of its own, fails here.
   */
  it("is served by the gallery's page, at both of its addresses", () => {
    for (const route of ["index", "about"]) {
      const source = readFileSync(`${PAGES}/${slug}/${route}.astro`, "utf8")
      expect(
        source.includes(`@/experiments/${slug}/Piece.astro`) && /<Piece\b/.test(source),
        `${slug}/${route}.astro does not render src/experiments/${slug}/Piece.astro`,
      ).toBe(true)
    }
    const piece = readFileSync(`src/experiments/${slug}/Piece.astro`, "utf8")
    expect(
      piece.includes("@/experiments/gallery/PiecePage.astro") && /<PiecePage\b/.test(piece),
      `src/experiments/${slug}/Piece.astro does not render gallery/PiecePage.astro — ` +
        `the document, the chrome's mount and the note are the gallery's`,
    ).toBe(true)
    expect(piece, `${slug}'s Piece.astro writes its own document`).not.toMatch(/<html\b|<!doctype/i)
  })

  /**
   * **The gallery's boot, handed the piece's three files, and nothing else.**
   * A piece is a library behind `settings.ts`, `presets.ts` and `runner.ts`,
   * and `gallery/boot.ts` wires any piece from them, so the script is those
   * imports and one call. Anything more is logic that a grep of
   * `src/experiments/` will not find and `kit-adoption` cannot read — and a
   * piece reaching past its three files is a second way in. See
   * `src/experiments/docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
   */
  it("boots through the gallery from the piece's three files", () => {
    const lines = statements(scriptBody(page))
    const imports = lines.filter((line) => line.startsWith("import "))
    const strays = lines.filter((line) => !line.startsWith("import ") && !/^boot\(\{.*\}\)$/.test(line))

    expect(
      strays,
      `${slug}'s page carries script of its own (${strays.slice(0, 3).join(" / ")}). A page imports ` +
        `gallery/boot and the piece's settings, presets and runner, and calls boot() — code outside ` +
        `src/experiments is invisible to a grep of the section and to kit-adoption.test.ts, which is how ` +
        `five copies of requireElement went unnoticed.`,
    ).toEqual([])
    expect(
      lines.filter((line) => line.startsWith("boot(")),
      `${slug}'s page does not call boot() once`,
    ).toHaveLength(1)

    const from = imports.map((line) => /from "([^"]+)"/.exec(line)?.[1]).sort()
    expect(from, `${slug}'s page imports something other than the boot and the piece's three files`).toEqual(
      [
        "@/experiments/gallery/boot",
        `@/experiments/${slug}/presets`,
        `@/experiments/${slug}/runner`,
        `@/experiments/${slug}/settings`,
      ].sort(),
    )
  })
})
