import { ESLint } from "eslint"
import { beforeAll, describe, expect, it } from "vitest"

/**
 * Whether the experiments boundary is still a lint failure.
 *
 * `CONTEXT-MAP.md` and
 * `src/experiments/docs/adr/0001-experiments-inside-the-site-project.md` say an
 * experiment imports nothing from the site. `eslint.config.mjs` enforces it, and
 * this asserts the enforcement rather than the invariant — `npm run lint` over
 * the real tree already covers the invariant, and would keep passing perfectly
 * if the rule stopped matching anything at all.
 *
 * That is not hypothetical. The rule's allow-list is written as a gitignore-style
 * group, `["@/**", "!@/experiments", "!@/experiments/**"]`, and the middle
 * pattern is load-bearing in a way nothing about it looks: gitignore cannot
 * re-include a path whose parent directory is excluded, so `@/**` on its own
 * swallows the `@/experiments` directory and every negation under it fails. The
 * first draft here was written without it, and the visible symptom was the
 * *opposite* of vacuous — 104 errors on correct code. The invisible symptom is
 * the one to guard: any later edit that drops `@/**` or narrows the file globs
 * leaves a rule that reports nothing and a suite that stays green.
 *
 * So each case below is an import that must fail, and one that must not.
 */

const CONFIGURED = "eslint.config.mjs"

/** One instance for the file; constructing it reads and resolves the config. */
let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({ overrideConfigFile: CONFIGURED, cwd: process.cwd() })
})

/** The rule's own reports for one hypothetical file, by rule id. */
async function boundaryErrors(filePath: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath, warnIgnored: false })
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "no-restricted-imports")
    .map((message) => message.message)
}

const TS = "src/experiments/flotsam/boundary-fixture.ts"

/**
 * A page, with the site import inside the client `<script>`.
 *
 * This is the case the ticket said to confirm rather than assume, and it is the
 * file most likely to reach for a site component in the first place — the only
 * place in a page that imports behaviour rather than a stylesheet.
 *
 * The obvious guess about how it is covered is wrong, which is the reason to
 * pin it here. A `<script>` block looks like it should need a virtual-file glob
 * — `<page>.astro/<n>_<n>.js`, the shape the config already uses further up to
 * pick a parser. It does not: `astro-eslint-parser` reads the frontmatter and
 * the script blocks into a single AST, so the config's plain `.astro` glob
 * lints the file whole. That was established by deleting those patterns from a
 * draft config and finding this test still green, not by reading the docs.
 */
const PAGE = "src/pages/experiments/flotsam/boundary-fixture.astro"

const page = (script: string) => `---
// frontmatter
---

<html>
  <body>
    <script>
      ${script}
    </script>
  </body>
</html>
`

describe("the experiments boundary", () => {
  it.each([
    ["a component", "@/components/Header.astro"],
    ["a layout", "@/layouts/Layout.astro"],
    ["a stylesheet", "@/styles/globals.css"],
    ["a site helper", "@/lib/utils"],
    // Not one of the four folders named in the ticket. The rule is an
    // allow-list precisely so that the site's next folder is covered without
    // anyone remembering to add it.
    ["something the site grows later", "@/assets/logo.svg"],
    ["the content config", "@/content.config"],
  ])("fails a .ts in the section importing %s", async (_what, specifier) => {
    const errors = await boundaryErrors(TS, `import x from "${specifier}"\nexport const y = x\n`)
    expect(errors, `${specifier} should be restricted`).toHaveLength(1)
    expect(errors[0]).toContain("imports nothing from the site")
  })

  it("fails a relative path that climbs out into the site", async () => {
    const errors = await boundaryErrors(TS, 'import x from "../../lib/utils"\nexport const y = x\n')
    expect(errors, "../../lib/utils should be restricted").toHaveLength(1)
  })

  it("fails a site import inside a page's client script block", async () => {
    const errors = await boundaryErrors(PAGE, page('import Layout from "@/layouts/Layout.astro"'))
    expect(errors, "the <script> block is not being linted").toHaveLength(1)
  })

  it("fails a site import in a page's frontmatter", async () => {
    const source = '---\nimport "@/styles/globals.css"\n---\n\n<html></html>\n'
    const errors = await boundaryErrors(PAGE, source)
    expect(errors, "the frontmatter is not being linted").toHaveLength(1)
  })

  it.each([
    "@/experiments/kit/controls",
    "@/experiments/kit/controls.css",
    "@/experiments/poster",
    "@/experiments/gallery/Note.astro",
    "@/experiments/flotsam/settings",
  ])("allows %s, which is the section reaching inside itself", async (specifier) => {
    const errors = await boundaryErrors(TS, `import x from "${specifier}"\nexport const y = x\n`)
    expect(errors, `${specifier} is the section's own code and must stay importable`).toEqual([])
  })

  it("allows a real dependency and Astro's own virtual modules", async () => {
    const source = [
      'import { getCollection } from "astro:content"',
      'import "@fontsource-variable/archivo/wdth.css"',
      "export const y = getCollection",
    ].join("\n")
    expect(await boundaryErrors(TS, source)).toEqual([])
  })

  it("leaves the site itself alone, since the boundary runs one way", async () => {
    const source = 'import x from "@/lib/utils"\nexport const y = x\n'
    expect(await boundaryErrors("src/components/Fixture.ts", source)).toEqual([])
  })
})
