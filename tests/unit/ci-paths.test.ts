import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * The test workflow's `paths-ignore` must never cover something a test reads.
 *
 * `test.yml` skips both suites for changes that provably cannot reach an
 * experiment — the resume, the site's components, agent docs, ADRs, skills. That
 * is worth having: a docs-only pull request was running the browser suite over
 * five pieces to approve a paragraph.
 *
 * **The trap is one character wide.** The list names prose specifically —
 * `docs/**`, every `AGENTS.md`, `.claude/**` — and the tempting simplification is
 * a blanket glob over all markdown. That would also swallow
 * `src/experiments/<slug>/about.md`, which is not prose: it is the content
 * collection `/experiments/` is generated from, asserted by
 * `tests/experiments-index.spec.ts` and `tests/experiments-notes.spec.ts`. The
 * suites would stop running for the one kind of markdown that is tested, and
 * nothing would say so — a green run that checked nothing, which is the failure
 * `paths-ignore` was chosen over an allow-list to avoid.
 *
 * So the rule is asserted here rather than left to whoever edits the YAML next.
 * The comment in `test.yml` explains; this fails.
 */

const WORKFLOW = ".github/workflows/test.yml"

/**
 * GitHub's path filters, as much of them as this file needs.
 *
 * A doubled star crosses directory separators, a single one does not. Written
 * out rather than pulled in: the whole check is about not trusting a pattern to
 * mean what it looks like, and a dependency whose semantics differ from GitHub's
 * would be the same fault one level down.
 */
function matches(pattern: string, path: string): boolean {
  const parts = pattern.split("/")
  let source = ""
  for (const [index, part] of parts.entries()) {
    const last = index === parts.length - 1
    if (part === "**") {
      source += last ? ".*" : "(?:.*/)?"
      continue
    }
    const literal = part
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")
    source += literal + (last ? "" : "/")
  }
  return new RegExp(`^${source}$`).test(path)
}

const ignored: string[] = (() => {
  const yaml = readFileSync(WORKFLOW, "utf8")
  const start = yaml.indexOf("paths-ignore:")
  const lines = yaml.slice(start).split("\n").slice(1)
  const out: string[] = []
  for (const line of lines) {
    const entry = /^\s+-\s+"([^"]+)"\s*$/.exec(line)
    if (!entry) break
    out.push(entry[1]!)
  }
  return out
})()

/** Paths a test genuinely depends on. Each is a real file, checked below. */
const TESTED = [
  "src/experiments/psyxels/about.md",
  "src/experiments/kit/controls.ts",
  "src/experiments/kit/controls.css",
  "src/experiments/address.ts",
  "src/experiments/starry-night/settings.ts",
  "src/pages/experiments/psyxels/index.astro",
  "src/content.config.ts",
  "package.json",
  "tests/kit.spec.ts",
  ".github/workflows/test.yml",
]

describe("the test workflow's path filter", () => {
  it("reads a filter at all, so an empty list cannot pass for a careful one", () => {
    expect(ignored.length, `no paths-ignore entries parsed out of ${WORKFLOW}`).toBeGreaterThan(5)
  })

  it("names paths that exist, so a stale entry does not sit there meaning nothing", () => {
    for (const path of TESTED) {
      expect(() => readFileSync(path, "utf8"), `${path} does not exist`).not.toThrow()
    }
  })

  it.each(TESTED)("does not skip the suites for %s", (path) => {
    const covering = ignored.filter((pattern) => matches(pattern, path))
    expect(
      covering,
      `${WORKFLOW} skips both suites for changes to ${path}, which tests read. The usual way ` +
        `in is a blanket glob over markdown — an about.md is content, not prose.`,
    ).toEqual([])
  })

  /** The matcher itself, or the check above is only as good as a guess. */
  it("matches the way GitHub's filters do", () => {
    expect(matches("docs/**", "docs/agents/x.md")).toBe(true)
    expect(matches("docs/**", "docs/x.md")).toBe(true)
    expect(matches("**/AGENTS.md", "AGENTS.md")).toBe(true)
    expect(matches("**/AGENTS.md", "src/experiments/AGENTS.md")).toBe(true)
    expect(matches("**/AGENTS.md", "src/experiments/psyxels/about.md")).toBe(false)
    expect(matches("*.md", "README.md")).toBe(true)
    // The one that matters: a single star must not cross a directory, and the
    // doubled form must.
    expect(matches("*.md", "src/experiments/psyxels/about.md")).toBe(false)
    expect(matches("**/*.md", "src/experiments/psyxels/about.md")).toBe(true)
    expect(matches("src/pages/index.astro", "src/pages/experiments/psyxels/index.astro")).toBe(false)
  })
})
