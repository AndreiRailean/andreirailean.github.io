import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * A gate on the browser suite: does this test need a browser?
 *
 * The browser suite is 336 seconds of the CI job against the unit suite's 108,
 * and the difference is not rendering. A browser test is simply the natural
 * place to call `settle()`, and `settle()` is minutes of simulated park —
 * arithmetic that costs the same in node with no page at all.
 *
 * So this gate does **not** claim a test gets cheap by moving. Measured on the
 * first one it caught: about 18 seconds in Chromium, 16.3 in vitest. What it
 * buys is that the browser suite stops accumulating tests that use none of it,
 * and that matters more than the per-test difference suggests — Playwright
 * parallelises across files but not within one, so a spec's serial chain sets
 * the wall clock of the whole suite.
 *
 * **The rule is mechanical, and it comes from `stats()` rather than from
 * taste.** Each piece documents which of its stats are filled in *while
 * drawing* and which are properties of the model — walkers says so under "Which
 * stats are computed when". Only the drawing ones need a page. So a browser
 * test that settles a scene and then asserts on model stats, without ever
 * reading a canvas or anything the page itself owns, is asserting something its
 * piece's headless core could answer, and the unit suite is its home.
 *
 * This does not ban anything. It is a stop-and-think: adding
 * `browser-because: <reason>` in a comment above the test satisfies it, the way
 * `kit-opt-out:` does for the kit. What it prevents is the *silent* case, which
 * is the only one that has ever happened — nobody has argued for a slow test,
 * they have just written it where the symptom appeared.
 *
 * The counter-pressure is the harness. `tests/unit/walkers/park.ts` offers
 * `settle`, `set` and `stats` under the names the page uses, so the answer to
 * "it was easier in the browser" is now "it is not".
 */

const SPECS = "tests"

/** What a page owns, and no headless harness can answer. */
const NEEDS_A_PAGE = [
  // The canvas itself.
  /getImageData/,
  /toDataURL/,
  /\binked\s*\(/,
  /\bpainted\s*\(/,
  // The frame loop, and the three stats that only exist because something drew.
  // Read off `stats`, not as bare words: `heads` is also a *setting* in walkers,
  // and `settings: { heads: false }` says nothing about needing a page.
  /requestAnimationFrame/,
  /stats(?:\(\))?\.(heads|fps|running)\b/,
  // The document, the URL, the keyboard, the panel, the media query.
  /page\.(goto|keyboard|mouse|locator|getBy|evaluate|reload|setViewportSize)/,
  /\bmatchMedia|reducedMotion\b/,
  /\bapi\.url\s*\(/,
  /\blocator\b/,
  /experiment\.(shot|chrome|panel)\b/,
  // A piece being re-created, resized or destroyed is page lifecycle.
  /\bresize\b/,
  /\bdestroy\s*\(/,
]

/** The escape hatch, and the whole point of the gate being a gate. */
const BECAUSE = "browser-because:"

type Case = { file: string; title: string; body: string; preamble: string }

/** The blank line above a test's comment, which is where its neighbour ends. */
function boundaryBefore(source: string, position: number): number {
  const gap = source.slice(0, position).lastIndexOf("\n\n")
  return gap === -1 ? position : gap
}

/**
 * Split a spec into its `test(...)` blocks, with whatever comment sits above
 * each one.
 *
 * Text rather than a parse, which is how
 * `tests/unit/experiments-presets.test.ts` reads pages too. It is coarse and it
 * is allowed to be: a miss costs a slow test nobody was warned about, which is
 * exactly today, and a false positive costs one line of justification.
 */
function casesIn(file: string): Case[] {
  const source = readFileSync(`${SPECS}/${file}`, "utf8")
  const starts: number[] = []
  const opener = /^ {0,2}test(?:\.\w+)?\(\s*[`"']/gm
  for (const match of source.matchAll(opener)) starts.push(match.index)

  return starts.map((start, index) => {
    // **Up to the next test's comment, not up to the next test.** Ending a
    // block at the next `test(` swallows that test's docblock into this one, and
    // the words in a neighbour's prose then answer for this one's code. That is
    // not hypothetical: it read "heads lean out over their own feet" as evidence
    // that the test above it needed a canvas, and excused exactly the test this
    // gate was written to catch.
    const end = index + 1 < starts.length ? boundaryBefore(source, starts[index + 1]!) : source.length
    const block = source.slice(start, end)
    const title = /test(?:\.\w+)?\(\s*[`"']([^`"']*)/.exec(block)?.[1] ?? "(unnamed)"
    // Back up over the comment or docblock immediately above the test.
    const before = source.slice(0, start)
    const preamble = before.slice(Math.max(0, before.lastIndexOf("\n\n")))
    return { file, title, body: block, preamble }
  })
}

const files = readdirSync(SPECS).filter((name) => name.endsWith(".spec.ts"))

describe("the browser suite earns its place", () => {
  it("finds the specs at all", () => {
    // A regex that silently matches nothing is the failure mode this whole file
    // has: it would pass for ever and check nothing.
    expect(files.length).toBeGreaterThan(5)
    expect(files.flatMap(casesIn).length).toBeGreaterThan(40)
  })

  it("has no test that settles a scene and then asks only the model", () => {
    const misplaced = files
      .flatMap(casesIn)
      .filter((item) => /\bsettle\s*\(\s*\d/.test(item.body))
      .filter((item) => !NEEDS_A_PAGE.some((pattern) => pattern.test(item.body)))
      .filter((item) => !item.preamble.includes(BECAUSE) && !item.body.includes(BECAUSE))
      .map((item) => `${item.file} › ${item.title}`)

    expect(
      misplaced,
      [
        "These settle a scene and then assert on stats the piece's headless core",
        "already answers, so they are paying for Chromium and using none of it.",
        "Move them to tests/unit/<piece>/ — walkers has a harness at",
        "tests/unit/walkers/park.ts with the same verbs — or, if the page really",
        `is the subject, write "${BECAUSE} <reason>" in a comment above the test.`,
      ].join(" "),
    ).toEqual([])
  })
})
