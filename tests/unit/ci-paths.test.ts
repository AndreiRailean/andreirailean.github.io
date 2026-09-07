import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * A workflow's `paths-ignore` must never cover something that workflow's own
 * tests read.
 *
 * `test-browser.yml` skips the browser suite for changes that provably cannot
 * reach an experiment — the resume, the site's components, agent docs, ADRs,
 * skills. That is worth having: a docs-only pull request was running the browser
 * suite over five pieces to approve a paragraph.
 *
 * **The trap is one character wide.** The list names prose specifically —
 * `docs/**`, every `AGENTS.md`, `.claude/**` — and the tempting simplification is
 * a blanket glob over all markdown. That would also swallow
 * `src/experiments/<slug>/about.md`, which is not prose: it is the content
 * collection `/experiments/` is generated from, asserted by
 * `tests/experiments-index.spec.ts` and `tests/experiments-notes.spec.ts`. The
 * suite would stop running for the one kind of markdown that is tested, and
 * nothing would say so — a green run that checked nothing, which is the failure
 * `paths-ignore` was chosen over an allow-list to avoid.
 *
 * So the rule is asserted here rather than left to whoever edits the YAML next.
 * The comment in the workflow explains; this fails.
 *
 * ### Why there are two workflows, and why the unit one is asserted to have no
 * filter at all
 *
 * This check used to read one `test.yml` carrying both suites, and it missed the
 * second instance of its own subject. `tests/unit/adr-format.test.ts` reads
 * exactly `docs/adr` and `src/experiments/docs/adr`; both were on that shared
 * ignore list; so the check validating ADR frontmatter **could not fail on an
 * ADR-only pull request**, which is the only kind where it has anything to say.
 * #166.
 *
 * It hid because #161 — the pull request that added the ADR check — also touched
 * `tests/unit/adr-format.test.ts`, which is not ignored. The suite ran, went
 * green over seven real records, and looked correct. The hole opened for every
 * ADR-only pull request afterwards.
 *
 * The fix is structural rather than a longer `TESTED` list: the unit job has no
 * path filter now, so no unit test can be skipped by one. **That absence is
 * itself asserted below**, because it is load-bearing and a future edit adding a
 * filter "for speed" would silently reopen the whole class — the list of unit
 * tests that read otherwise-ignored prose is not something anyone should have to
 * keep correct.
 */

const BROWSER = ".github/workflows/test-browser.yml"
const UNIT = ".github/workflows/test-unit.yml"

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

/**
 * A workflow's `paths-ignore` entries. Empty when it has no filter at all.
 *
 * The `paths-ignore:` key is absent from an unfiltered workflow, and
 * `indexOf` returns -1 for that — which `slice(-1)` would turn into the file's
 * last character rather than into nothing. Checked explicitly, because the
 * silent version of this bug reads as "no entries" and would make every
 * assertion below pass vacuously against a workflow that does filter.
 */
function ignoredBy(workflow: string): string[] {
  const yaml = readFileSync(workflow, "utf8")
  const start = yaml.indexOf("paths-ignore:")
  if (start === -1) return []
  const lines = yaml.slice(start).split("\n").slice(1)
  const out: string[] = []
  for (const line of lines) {
    const entry = /^\s+-\s+"([^"]+)"\s*$/.exec(line)
    if (!entry) break
    out.push(entry[1]!)
  }
  return out
}

const ignored = ignoredBy(BROWSER)

/**
 * Paths a **browser** test genuinely depends on. Each is a real file, checked
 * below.
 *
 * Scoped to the browser suite because that is the only filtered workflow. A path
 * a unit test reads needs no entry here — `test-unit.yml` has no filter, which
 * is asserted separately rather than assumed.
 */
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
  ".github/workflows/test-browser.yml",
]

/**
 * Directories a unit test reads that the browser filter ignores.
 *
 * These are why the unit job must stay unfiltered. Listed as real files so the
 * pairing is checked rather than asserted: each one **is** covered by the
 * browser workflow's ignore list, and each one **is** read by a unit test. If
 * either half ever stops being true this file says which.
 */
const UNIT_READS_IGNORED = [
  { path: "docs/adr/20260828-a-derived-port-per-worktree.md", reader: "tests/unit/adr-format.test.ts" },
  {
    path: "src/experiments/docs/adr/20260906-a-frame-is-not-a-viewport.md",
    reader: "tests/unit/adr-format.test.ts",
  },
]

describe("the browser workflow's path filter", () => {
  it("reads a filter at all, so an empty list cannot pass for a careful one", () => {
    expect(ignored.length, `no paths-ignore entries parsed out of ${BROWSER}`).toBeGreaterThan(5)
  })

  it("names paths that exist, so a stale entry does not sit there meaning nothing", () => {
    for (const path of [...TESTED, ...UNIT_READS_IGNORED.map(({ path }) => path)]) {
      expect(() => readFileSync(path, "utf8"), `${path} does not exist`).not.toThrow()
    }
  })

  it.each(TESTED)("does not skip the browser suite for %s", (path) => {
    const covering = ignored.filter((pattern) => matches(pattern, path))
    expect(
      covering,
      `${BROWSER} skips the browser suite for changes to ${path}, which a browser test reads. ` +
        `The usual way in is a blanket glob over markdown — an about.md is content, not prose.`,
    ).toEqual([])
  })

  /**
   * **The unit job has no filter, and that absence is the fix for #166.**
   *
   * Asserted rather than trusted, because it is load-bearing and invisible: a
   * future edit adding a filter "for speed" would reopen the class this file
   * exists to close, and nothing else would notice. The alternative — keeping a
   * correct list of every unit test that reads otherwise-ignored prose — is a
   * rule that depends on being remembered, which `AGENTS.md` names as the
   * weakest kind.
   */
  it("is the only filtered test workflow, so no unit test can be skipped by one", () => {
    expect(
      ignoredBy(UNIT),
      `${UNIT} has a paths-ignore list. It must not: tests under tests/unit/ read prose that ` +
        `${BROWSER} ignores, so any filter here can silence a check on exactly the pull ` +
        `requests it exists to police. That was #166 — adr-format.test.ts could not fail on an ` +
        `ADR-only change. If this job has become too slow to run always, split it rather than ` +
        `filtering it.`,
    ).toEqual([])
  })

  /**
   * The pairing behind that absence, checked from both ends.
   *
   * Each of these is a real prose file which the browser filter **does** ignore
   * and a unit test **does** read. If the filter ever stops covering one, this
   * says so and the entry can go; if a reader disappears, likewise. Without it,
   * the assertion above is a rule with no stated reason.
   */
  it.each(UNIT_READS_IGNORED)("$path is ignored by the browser filter and read by $reader", ({ path, reader }) => {
    expect(
      ignored.filter((pattern) => matches(pattern, path)).length,
      `${path} is no longer covered by ${BROWSER}'s ignore list, so it is not evidence for the ` +
        `unit job staying unfiltered. Drop it from UNIT_READS_IGNORED.`,
    ).toBeGreaterThan(0)

    const source = readFileSync(reader, "utf8")
    const directory = path.slice(0, path.lastIndexOf("/"))
    expect(
      source.includes(directory),
      `${reader} no longer names ${directory}, so it may not read ${path} any more. Re-check ` +
        `why the unit job is unfiltered before trusting this list.`,
    ).toBe(true)
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
