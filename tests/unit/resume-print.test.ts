import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * The resume's print rules, and whether they address anything that exists.
 *
 * **This check exists because CSS has no failure mode.** A selector that matches
 * nothing is indistinguishable, from the outside, from one whose rule is being
 * satisfied — the page looks fine either way, and the only symptom is a
 * behaviour that silently never happens. So the pagination rules on the one page
 * that exists to be printed were inert from the day they were written:
 *
 *     prose-h1, prose-h2, prose-h3, prose-h4, prose-h5 { page-break-after: avoid }
 *     prose-p { page-break-inside: avoid }
 *
 * Those are the Tailwind *class* names used higher up the file, written where a
 * selector goes. As selectors they are element types, and there is no
 * `<prose-h1>` element. The built stylesheet shipped them verbatim while the
 * rendered page contained `<h1>`×1, `<h2>`×4, `<h3>`×8 and `<h4>`×11.
 *
 * It is the shape `AGENTS.md` lists first — a pattern that matches nothing —
 * and the reason that shape is worth a check rather than a comment is exactly
 * that nobody can see it. A person reviewing the file reads `prose-h1` and
 * thinks of the class they wrote upstairs.
 *
 * ## What this asserts, and what it deliberately does not
 *
 * It asserts that every **type selector** in the print block names a real HTML
 * element. That is the whole of the bug, it needs no build and no browser, and
 * it stays true through a redesign — it pins "these selectors address something"
 * rather than "the resume looks like this", so it does not stand in the way of
 * the resume being rewritten or moved out of this repo.
 *
 * It does **not** assert that the rules produce good pagination. No unit test
 * can; that is a judgement made by printing the page. And it is deliberately not
 * a browser test: `AGENTS.md` names a paragraph on the resume as precisely the
 * change that should not drag in an eight-minute suite.
 */

const RESUME_CSS = "src/styles/resume.css"

/**
 * The body of `@media print`, by brace matching.
 *
 * Counted rather than matched with a regular expression, because the block
 * contains nested braces — `@page`, and every rule inside it — and the lazy
 * regex that looks right stops at the first `}` it meets, which is `@page`'s.
 * That would have quietly reduced this check to the two lines above the bug.
 */
function printBlock(css: string): string {
  const start = css.indexOf("@media print")
  if (start === -1) return ""
  const open = css.indexOf("{", start)
  if (open === -1) return ""
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++
    else if (css[i] === "}") {
      depth--
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  return ""
}

/**
 * Bare type selectors in a block of CSS — the only kind this bug can hide in.
 *
 * A class (`.container`), an id, an attribute or a pseudo is skipped: those
 * cannot be confused with an element and a wrong one is a different mistake.
 * Nested at-rules go first, so `@page`'s descriptors are not read as selectors.
 */
function typeSelectors(block: string): string[] {
  const withoutAtRules = block.replace(/@[\w-]+[^{]*\{[^}]*\}/g, "")
  const withoutComments = withoutAtRules.replace(/\/\*[\s\S]*?\*\//g, "")
  const found = new Set<string>()

  // `[, prelude]` — index 0 is the whole match, body included, and reading it as
  // the prelude quietly turns every declaration into a selector. The first draft
  // did exactly that and reported `avoid` as an unknown element.
  for (const [, prelude = ""] of withoutComments.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const selector of prelude.split(",")) {
      for (const part of selector.trim().split(/[\s>+~]+/)) {
        // The element half of the compound, before any class or pseudo hangs off
        // it: `article.minimalist` is a real `article`.
        const type = /^([a-zA-Z][\w-]*)/.exec(part.trim())?.[1]
        if (type) found.add(type.toLowerCase())
      }
    }
  }
  return [...found]
}

/**
 * Elements this stylesheet could legitimately address. Not the whole of HTML —
 * a short list is the point, because anything outside it in a hand-written
 * resume stylesheet is a mistake worth stopping on rather than a gap to widen.
 */
const HTML_ELEMENTS = new Set([
  "a",
  "article",
  "aside",
  "b",
  "blockquote",
  "body",
  "code",
  "dd",
  "div",
  "dl",
  "dt",
  "em",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "html",
  "i",
  "img",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
])

describe("the resume's print stylesheet", () => {
  const css = readFileSync(RESUME_CSS, "utf8")
  const block = printBlock(css)

  it("has a print block to check, so an empty read cannot pass for a clean one", () => {
    expect(block.trim(), `no @media print block found in ${RESUME_CSS}`).not.toBe("")
    expect(typeSelectors(block).length, "no type selectors parsed out of the print block").toBeGreaterThan(0)
  })

  it("addresses only elements that exist", () => {
    const unknown = typeSelectors(block).filter((type) => !HTML_ELEMENTS.has(type))
    expect(
      unknown,
      `${RESUME_CSS} has a print rule whose selector is not an HTML element: ${unknown.join(", ")}. ` +
        `The usual cause is a Tailwind class name written where a selector goes — \`prose-h2\` ` +
        `instead of \`h2\` — which matches nothing and fails silently, because an unmatched CSS ` +
        `rule looks exactly like a satisfied one. This page exists to be printed; these rules are ` +
        `the only thing controlling where its pages break.`,
    ).toEqual([])
  })

  /**
   * The rules the bug actually disabled, named rather than left to the general
   * assertion above.
   *
   * Without this, deleting the pagination rules entirely would pass: nothing
   * unknown remains when nothing remains. That is the absence-with-no-paired-
   * presence trap, and this block is the presence.
   */
  it("still says where pages may not break", () => {
    expect(block, "nothing in the print block avoids a break after a heading").toMatch(
      /break-after:\s*avoid|page-break-after:\s*avoid/,
    )
    expect(block, "nothing in the print block keeps a block from splitting").toMatch(
      /break-inside:\s*avoid|page-break-inside:\s*avoid/,
    )

    const types = typeSelectors(block)
    for (const element of ["h2", "p", "li"]) {
      expect(types, `the print block no longer mentions <${element}>`).toContain(element)
    }
  })

  /**
   * **The gate against cases this repo does not contain**, the way
   * `tests/unit/browser-suite.test.ts` and `tests/unit/opt-out.test.ts` do it.
   *
   * A check that reads source is only worth what its parser is worth, and the
   * parser is the part nobody sees fail. So it is run here against the bug in
   * its original form, against the fix, and against the nested-brace shape that
   * would have truncated a regex-based reader.
   */
  it("catches the mistake it was written for, and passes the correction", () => {
    const broken = "@media print { @page { margin: 1cm; } prose-h1, prose-h2 { page-break-after: avoid; } }"
    const fixed = "@media print { @page { margin: 1cm; } h1, h2 { page-break-after: avoid; } }"

    expect(typeSelectors(printBlock(broken))).toEqual(["prose-h1", "prose-h2"])
    expect(typeSelectors(printBlock(fixed))).toEqual(["h1", "h2"])

    // The brace-matching half: a reader that stopped at `@page`'s closing brace
    // would return nothing here and report a clean file.
    expect(printBlock(broken)).toContain("prose-h1")

    // A compound selector is its element, and a bare class is not a type — so
    // `article.minimalist .container` contributes `article` and nothing else.
    const compound = "@media print { article.minimalist .container { padding: 0; } }"
    expect(typeSelectors(printBlock(compound))).toEqual(["article"])
  })
})
