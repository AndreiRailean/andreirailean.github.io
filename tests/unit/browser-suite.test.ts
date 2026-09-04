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

/**
 * The escape hatch, and the whole point of the gate being a gate.
 *
 * **The reason is mandatory, not the marker.** What these gates rule out is
 * *silence* — nobody has ever argued for a slow test, they have written one
 * where the symptom appeared and moved on. A bare `browser-because:` satisfying
 * the check would turn a stop-and-think into a magic word, which is the one
 * failure mode that puts us back where we started.
 */
const MARKER = /browser-because:[ \t]*([^\n]*)/

/**
 * Whether a marker carries an actual reason.
 *
 * Not `\S` after the colon, which was the first attempt and accepted a comment
 * terminator — the close of the very docblock the marker was written in. So a
 * bare `browser-because:` inside a comment satisfied the check that exists to
 * refuse exactly that. The terminator comes off first, and what is left has to
 * contain a word.
 *
 * Writing this comment broke the file twice over: spelling the terminator out
 * inside a block comment ends the block comment.
 */
function hasReason(text: string): boolean {
  const stated = MARKER.exec(text)?.[1]
  if (stated === undefined) return false
  return /[A-Za-z]{3}/.test(stated.replace(/\*+\/\s*$/, ""))
}

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
  return casesFrom(readFileSync(`${SPECS}/${file}`, "utf8"), file)
}

export function casesFrom(source: string, file = "(inline)"): Case[] {
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

/**
 * The whole rule, over text, so it can be tested against cases that do not
 * exist in the repo.
 *
 * A gate nothing exercises is the same hazard it was written to prevent: it
 * would pass for ever, whether or not it still recognises anything.
 */
export function misplacedIn(source: string, file = "(inline)"): string[] {
  return casesFrom(source, file)
    .filter((item) => /\bsettle\s*\(\s*\d/.test(item.body))
    .filter((item) => !NEEDS_A_PAGE.some((pattern) => pattern.test(item.body)))
    .filter((item) => !hasReason(item.preamble) && !hasReason(item.body))
    .map((item) => `${item.file} › ${item.title}`)
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
    const misplaced = files.flatMap((file) => misplacedIn(readFileSync(`${SPECS}/${file}`, "utf8"), file))

    expect(
      misplaced,
      [
        "These settle a scene and then assert on stats the piece's headless core",
        "already answers, so they are in the browser suite and using none of it.",
        "Moving one will not make it much faster — the settle dominates and is",
        "the same arithmetic in either runner. What it buys is that the browser",
        "suite stops growing with tests that do not need it, and that a spec's",
        "serial chain, which sets the whole suite's wall clock, gets shorter.",
        "Move them to tests/unit/<piece>/ — walkers has a harness with the same",
        "verbs at tests/unit/walkers/park.ts — or, if the page really is the",
        'subject, write "browser-because: <reason>" in a comment above the test.',
        "The reason is not optional; the marker alone does not satisfy this.",
      ].join(" "),
    ).toEqual([])
  })
})

/**
 * The gate, against cases the repo does not contain.
 *
 * Without this the check above is only evidence that today's specs pass it —
 * which a rule matching nothing at all would also produce, for ever, silently.
 * Every case here is one this has already got wrong or could.
 */
describe("the gate itself", () => {
  const settling = `
test("settles and asks the model", async ({ page }) => {
  const experiment = await open(page)
  await experiment.api(({ api }) => api.settle(30))
  expect((await experiment.api(({ api }) => api.stats())).inFrame).toBeGreaterThan(3)
})
`

  it("flags a test that settles and reads only model stats", () => {
    expect(misplacedIn(settling)).toEqual(["(inline) › settles and asks the model"])
  })

  it("lets a stated reason through", () => {
    const excused = `
/** browser-because: settle is the page's verb, not the crowd's. */${settling}`
    expect(misplacedIn(excused)).toEqual([])
  })

  it("does not accept the marker without a reason", () => {
    // The failure this gate is for is silence, so a magic word that means
    // nothing is the one escape hatch that must not work.
    const bare = `
/** browser-because: */${settling}`
    expect(misplacedIn(bare)).toEqual(["(inline) › settles and asks the model"])
  })

  it("lets a test that reads the canvas through", () => {
    const drawing = settling.replace("api.stats()", "api.stats()\n  const pixels = getImageData()")
    expect(misplacedIn(drawing)).toEqual([])
  })

  it("does not let a neighbour's prose excuse a test", () => {
    // The bug this file shipped with. Blocks ended at the next `test(`, so the
    // docblock below was read as part of the test above it, and the word
    // "getImageData" in a neighbour's comment excused a test that draws nothing.
    const pair = `${settling}
/**
 * The next test explains that it calls getImageData on a canvas.
 */
test("reads the canvas", async ({ page }) => {
  await experiment.api(({ api }) => api.settle(10))
  const pixels = getImageData()
})
`
    expect(misplacedIn(pair)).toEqual(["(inline) › settles and asks the model"])
  })
})
