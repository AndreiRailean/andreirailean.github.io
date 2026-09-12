import { existsSync, readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * The rules have to actually reach a session.
 *
 * **This exists because for a long time they did not.** Every convention this
 * repo has lived in an `AGENTS.md` — nine of them — and a session only ever saw
 * one if it happened to go looking. Claude Code loads `CLAUDE.md` on its own and
 * does not load `AGENTS.md`, so the entire ruleset was opt-in, including the
 * rules that exist precisely because somebody skipped them.
 *
 * Nothing failed. That is the point: a convention nobody is handed looks
 * identical to a convention everybody follows, right up until a session does the
 * thing the document forbids. `AGENTS.md` names "a rule that depends on being
 * remembered" as a defect to fix with a check, and this is that check for the
 * layer above — the rules that depend on being *found*.
 *
 * Two delivery mechanisms are asserted, because they fail in different ways:
 *
 * - `CLAUDE.md` at the root, which is loaded, and which pulls in `AGENTS.md`.
 * - Skills under `.claude/skills/`, which are listed to every session with their
 *   descriptions. A malformed one is simply **not surfaced**, silently, which is
 *   the same shape of failure as a grep that matches nothing.
 */

const SKILLS = ".claude/skills"

/** Frontmatter as a flat map, in the shape `tests/unit/adr-format.test.ts` uses. */
function frontmatter(source: string): Record<string, string> | null {
  if (!source.startsWith("---\n")) return null
  const end = source.indexOf("\n---", 4)
  if (end < 0) return null
  const fields: Record<string, string> = {}
  let last = ""
  for (const line of source.slice(4, end).split("\n")) {
    const pair = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (pair) {
      last = pair[1]!
      fields[last] = pair[2]!.trim()
    } else if (last && line.trim()) {
      fields[last] = `${fields[last]} ${line.trim()}`.trim()
    }
  }
  return fields
}

describe("the conventions reach a session that reads nothing", () => {
  it("has a CLAUDE.md at the root, which is the only file loaded on its own", () => {
    expect(
      existsSync("CLAUDE.md"),
      "Without this, AGENTS.md is opt-in: a session sees it only if it goes looking, " +
        "and nothing anywhere reports that it did not.",
    ).toBe(true)
  })

  it("pulls AGENTS.md in from CLAUDE.md rather than restating it", () => {
    const source = readFileSync("CLAUDE.md", "utf8")

    // The import is what keeps the two from drifting. It degrades safely: if
    // imports are not active the line renders as literal text, which still reads
    // as a pointer, and CLAUDE.md says so immediately underneath.
    expect(source, "CLAUDE.md must import AGENTS.md").toMatch(/^@AGENTS\.md$/m)
    expect(source, "and must tell a reader what to do if the import did not happen").toMatch(/read `AGENTS\.md`/i)
  })

  it("points at every AGENTS.md that exists, so none becomes unreachable", () => {
    const source = readFileSync("CLAUDE.md", "utf8") + readFileSync("AGENTS.md", "utf8")

    // The per-experiment ones are reached through src/experiments/AGENTS.md,
    // which says to read the piece's own. These are the section-level entries,
    // and a new one nobody links is a document that will not be read.
    for (const path of ["tests/AGENTS.md", "src/experiments/AGENTS.md", "src/showcase/AGENTS.md"]) {
      expect(source.includes(path), `nothing at the root points at ${path}`).toBe(true)
    }
  })
})

describe("every skill is well formed enough to be surfaced", () => {
  const names = readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  it("finds the skills at all, so an empty run cannot pass for a clean one", () => {
    expect(names.length).toBeGreaterThan(0)
  })

  describe.each(names)("%s", (name) => {
    const path = `${SKILLS}/${name}/SKILL.md`

    it("has a SKILL.md", () => {
      expect(existsSync(path), `${SKILLS}/${name} has no SKILL.md and so is not a skill`).toBe(true)
    })

    it("carries a name matching its directory, and a description", () => {
      const fields = frontmatter(readFileSync(path, "utf8"))

      expect(fields, `${path}: no frontmatter, so this is not surfaced to anyone`).not.toBeNull()
      expect(fields?.name, `${path}: name must match the directory, or invoking it by path fails`).toBe(name)

      // The description is the entire reason a skill gets used without being
      // asked for: it is what a session reads when deciding whether this applies.
      // A stub is a skill nobody will invoke, which is the silent failure here.
      expect(
        (fields?.description ?? "").length,
        `${path}: description is missing or too short to say when the skill applies`,
      ).toBeGreaterThan(40)
    })
  })
})
