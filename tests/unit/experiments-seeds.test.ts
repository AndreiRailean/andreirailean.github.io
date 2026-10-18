import { existsSync, readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Every piece keeps the prose that started it.
 *
 * `docs/agents/experiment-writer.md` requires `src/experiments/<slug>/seed.md`:
 * Andrei's own words verbatim, plus his corrective feedback as it arrives.
 * **It is the one artefact in a piece that cannot be rederived** — the code,
 * the commits and `about.md` all describe what was built, and none of them
 * records what he asked for or how he said it. A transcript is unreadable by
 * another session at runtime, so when it goes, the brief goes with it.
 *
 * Until #204 this was held only by being remembered, which the root
 * `AGENTS.md` names as a defect to fix with a check. Six of the eight pieces
 * had no seed, and nothing anywhere said so. Now they all do, which is what
 * makes this assertion possible without a list of exceptions in it.
 *
 * **A piece is a directory with a `settings.ts`.** Derived rather than listed,
 * and deliberately not the `NOT_A_PIECE` denylist that
 * `experiments-address.test.ts` and `experiments-grid.test.ts` use — that names
 * `docs`, `gallery` and `kit`, so the section's *next* shared directory is a
 * false piece until somebody remembers to add it. Every piece has settings and
 * no shared directory does.
 */

const EXPERIMENTS = "src/experiments"

/** Directories under the section that are pieces, found rather than listed. */
const pieces = readdirSync(EXPERIMENTS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`${EXPERIMENTS}/${entry.name}/settings.ts`))
  .map((entry) => entry.name)
  .sort()

/**
 * A machine's address: an IP literal, localhost, a tailnet name, or any host
 * with a port. Andrei pastes the preview URL he has open, and the host part
 * names the machines he works from — he asked for it not to live in a record
 * this long. The path and the `?s=` scene are what the record needs, so those
 * stay; only the scheme and host go.
 */
const HOST = /https?:\/\/(?:\d{1,3}(?:\.\d{1,3}){3}|localhost|[^\s/]*\.ts\.net|[^\s/:]+:\d+)/

describe("a seed records the scene, not the machine it was on", () => {
  it("knows a host when it sees one", () => {
    // The pattern is tested against cases the seeds no longer contain, so a
    // pattern that stopped matching anything cannot pass for clean seeds.
    for (const line of [
      "> http://100.117.55.104:4627/experiments/artdeco/?s=abc",
      "> http://10.1.11.11:4456/experiments/bubbles/?s=abc",
      '> add this as "club" http://localhost:4321/experiments/streakers?s=abc',
      "> https://box.tail1234.ts.net/experiments/crowd/",
      "> http://zenith:4627/experiments/crowd/",
    ])
      expect(line).toMatch(HOST)
    for (const line of ["> /experiments/artdeco/?s=abc", "> like https://en.wikipedia.org/wiki/Art_Deco"])
      expect(line).not.toMatch(HOST)
  })

  it.each(pieces)("%s's seed names no host", (slug) => {
    const path = `${EXPERIMENTS}/${slug}/seed.md`
    if (!existsSync(path)) return
    const hosts = readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, k) => (HOST.test(line) ? [`${path}:${k + 1}`] : []))
    expect(
      hosts,
      `Keep the path and the ?s= scene of an address Andrei pastes, and drop the scheme and host: ` +
        `it names his machines, and he asked for it not to live in a long record.`,
    ).toEqual([])
  })
})

describe("every piece keeps its seed", () => {
  it("finds the pieces at all, so an empty run cannot pass for a clean one", () => {
    // Without this the `it.each` below would vanish silently if the predicate
    // stopped matching — a green suite with nothing in it, which is the shape
    // the root AGENTS.md lists first.
    expect(pieces.length, `no directory under ${EXPERIMENTS} has a settings.ts`).toBeGreaterThan(1)
  })

  it.each(pieces)("%s has a seed.md", (slug) => {
    expect(
      existsSync(`${EXPERIMENTS}/${slug}/seed.md`),
      `${EXPERIMENTS}/${slug}/seed.md is missing. It holds Andrei's own words, which exist nowhere ` +
        `else once the session's transcript is gone — see docs/agents/experiment-writer.md. ` +
        `Do not reconstruct one from the code: an invented brief is worse than an absent one.`,
    ).toBe(true)
  })

  it.each(pieces)("%s's seed quotes him rather than describing him", (slug) => {
    const path = `${EXPERIMENTS}/${slug}/seed.md`
    if (!existsSync(path)) return // the assertion above owns this case

    // A stub satisfies "has a seed.md" and carries nothing. The cheapest thing
    // that separates a real one is a blockquote: the convention is his words,
    // quoted, and a summary written in the session's own voice has none.
    const quoted = readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.startsWith(">"))
    expect(
      quoted.length,
      `${path} has no quoted lines, so it describes the seed rather than recording it. ` +
        `The rule is verbatim: transcribe what he typed, do not summarise it.`,
    ).toBeGreaterThan(0)
  })
})
