import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Every dated decision record carries the frontmatter `domain.md` asks for.
 *
 * The `summary` line is the one with a job: it is what lets the directory be
 * skimmed without opening files, and a record nobody can skim is a record that
 * gets rederived from scratch. That has happened here.
 *
 * **This exists because the rule was arguable and got argued.** Ten dated
 * records had no frontmatter, three of them written the same week, and the
 * reasoning for leaving them was reasonable on its face: the neighbouring
 * records use a `**Status:**` line in the body, so conforming would leave a
 * third format in one directory. The census is what settled it —
 * `domain.md` scopes its exemption to records that "predate this format and use
 * sequential numbers", which is `0001` to `0003` and nothing else. A check makes
 * that a second's work to establish rather than a judgement call.
 *
 * The sequential three are exempt here for exactly the reason `domain.md` gives:
 * they are not being migrated. Nothing new may join them, which is what the date
 * stem in the filename pattern enforces.
 */

const DIRECTORIES = ["docs/adr", "src/experiments/docs/adr"]

/** A record written under the current convention: `YYYYMMDD-slug.md`. */
const DATED = /^(\d{4})(\d{2})(\d{2})-[a-z0-9-]+\.md$/

/** The pre-format records, sequential and deliberately left alone. */
const EXEMPT = /^\d{4}-/

type Record = { path: string; name: string; source: string; stem: RegExpExecArray }

const records: Record[] = DIRECTORIES.flatMap((directory) =>
  readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({ directory, name })),
)
  .filter(({ name }) => !EXEMPT.test(name))
  .map(({ directory, name }) => {
    const stem = DATED.exec(name)
    return { path: `${directory}/${name}`, name, source: readFileSync(`${directory}/${name}`, "utf8"), stem: stem! }
  })

/** Frontmatter as a flat map. Values may wrap, so continuations fold in. */
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

const STATUSES = new Set(["proposed", "accepted", "rejected", "superseded", "deprecated"])

it("finds the records, so an empty run cannot pass for a clean one", () => {
  expect(records.length).toBeGreaterThan(10)
})

it("names every record with a date stem rather than a sequence number", () => {
  // Sequential numbering fails in the case that matters: two agents, two
  // worktrees, one afternoon, both claiming 0004.
  const misnamed = records.filter((record) => !record.stem).map((record) => record.name)
  expect(misnamed, `these are neither date-stemmed nor pre-format: ${misnamed.join(", ")}`).toEqual([])
})

describe.each(records.map((record) => [record.name, record] as const))("%s", (_name, record) => {
  const fields = frontmatter(record.source)

  it("carries frontmatter rather than a Status line in the body", () => {
    expect(
      fields,
      `${record.path} has no frontmatter. The body "**Status:**" form belongs to the pre-format ` +
        `sequential records only — see docs/agents/domain.md.`,
    ).not.toBeNull()
    expect(
      /^\*\*Status:\*\*/m.test(record.source),
      `${record.path} still carries a body Status line as well as frontmatter`,
    ).toBe(false)
  })

  it("carries type, status, date and a summary", () => {
    expect(fields?.type, `${record.path}: type`).toBe("ADR")
    expect(STATUSES.has(fields?.status ?? ""), `${record.path}: status is "${fields?.status}"`).toBe(true)
    expect(fields?.date, `${record.path}: date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // The summary is the whole reason the frontmatter is required: it is what
    // makes the directory skimmable. A stub defeats the point.
    expect((fields?.summary ?? "").length, `${record.path}: summary is missing or too short`).toBeGreaterThan(30)
  })

  it("agrees with its own filename about the date", () => {
    // A stem and a frontmatter date that disagree make the directory sort one
    // way and read another.
    const [, year, month, day] = record.stem
    expect(fields?.date, `${record.path}: frontmatter date and filename stem disagree`).toBe(`${year}-${month}-${day}`)
  })

  it("names what supersedes it when it says it is superseded", () => {
    if (fields?.status !== "superseded") return
    expect(
      fields.superseded_by,
      `${record.path} is superseded and does not say by what, so a reader has nowhere to go`,
    ).toBeTruthy()
  })
})
