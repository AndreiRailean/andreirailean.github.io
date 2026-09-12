import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * What must be true about the runners that are committed.
 *
 * A published page pins a runner by content hash, which buys the property the
 * whole arrangement rests on — a scene keeps running the bytes it was published
 * against — and costs the one this file exists to cover: **the failures are
 * silent.** A page naming a runner that was never committed, or a piece changed
 * without republishing, both end with the loader emptying its container and the
 * host's own background showing. It looks deliberate.
 *
 * Unlike a poster, a runner *is* byte-reproducible, so these can be checked
 * rather than merely hoped for. See
 * `src/experiments/docs/adr/20260907-runners-are-committed.md`.
 */

const root = resolve(import.meta.dirname, "../..")
const runners = resolve(root, "public/showcase/runners")

/**
 * The store is what git tracks, not what is on disk.
 *
 * `pnpm run runners` writes every piece's current build into the same
 * directory, so an unpublished piece's newest build sits there untracked. That
 * is build output rather than store contents and nothing here should assert
 * anything about it. See
 * `src/experiments/docs/adr/20260912-the-store-holds-published-runners-only.md`.
 */
const committed = execFileSync("git", ["ls-files", "public/showcase/runners"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((path) => path.endsWith(".js"))
  .map((path) => path.slice("public/showcase/runners/".length))

/**
 * A runner holds the bytes its name claims, and until now nothing said so.
 *
 * **The name is the hash**, which makes this directory self-verifying and makes
 * the check a recompute rather than a lookup. Nothing else is needed: no
 * history, no second file, no base revision.
 *
 * Nothing else checked a runner's bytes. The other checks here concern the
 * store as a whole, so an individual file could be edited freely once it was in
 * it. Measured rather than assumed, before this was added:
 * appending a byte to a superseded runner left the whole suite green.
 *
 * **Deliberately no filename here.** A runner named in prose is still a runner
 * named in this repo, and anything that decides what is still referenced by
 * looking for its name would keep that file alive forever on the strength of a
 * comment. Examples belong in the commit message, which nothing scans.
 *
 * Those are exactly the runners that matter most. A current runner is covered
 * by the rebuild check; a superseded one is a published pin and nothing else,
 * which makes it simultaneously the valuable case and the one that looks most
 * like clutter. #47 is a session that read it as clutter.
 *
 * **This is true whatever the store turns out to be.** Whether runners are kept
 * forever or collected once nothing references them, a file that does not hash
 * to its own name is corrupt either way — so this check does not depend on that
 * question and does not wait for it. Deletion is the half that does: it is
 * covered by the `Runner store` workflow for now, and what should replace that
 * is undecided.
 */
describe("the runner store", () => {
  it.each(committed)("%s holds the bytes its name claims", (name) => {
    const claimed = name.split(".")[1]
    const actual = createHash("sha256")
      .update(readFileSync(resolve(runners, name)))
      .digest("hex")
      .slice(0, 12)
    expect(
      actual,
      `${name} does not hash to ${String(claimed)}. A runner is named by its own bytes, so either the ` +
        `file was edited — which silently changes what every page pinning it renders — or it was renamed. ` +
        `Neither is recoverable from here: restore it from git rather than renaming it to match.`,
    ).toBe(claimed)
  })
})

/**
 * Every runner this repo names is committed — whoever names it.
 *
 * **The property is about references, not about destinations.** A runner is
 * needed because something still points at it, and what that something *is*
 * should not be this file's business: the home page pins one, the wall pins
 * six, and the next consumer is not yet written. Three separate hand-written checks used to assert this, one
 * per destination, and a fourth destination would have needed a fourth check
 * that nobody would remember to add.
 *
 * So this finds the references rather than being told where they are. It scans
 * every tracked file for anything shaped like a runner filename and insists
 * each one exists. Proved on a new page pinning a runner with no check written
 * for it: the runner went from collectable to protected with no other change.
 *
 * **It runs in the direction that matters.** Not "is this committed runner
 * still wanted", which is a retention question and undecided, but "does
 * everything that is wanted exist" — which is the one that fails silently, with
 * an empty container that looks deliberate.
 *
 * **Prose counts, deliberately.** A runner named in an ADR is a runner this repo
 * still talks about, and retaining it is the safe direction. The cost is that an
 * example in a comment pins a file forever, which is why the note above this
 * describes a superseded runner rather than naming one.
 */
describe("every runner this repo names", () => {
  /** `<slug>.<12 hex>.js`, the shape `scripts/runners.ts` writes. */
  const SHAPE = /\b[a-z0-9][a-z0-9-]*\.[0-9a-f]{12}\.js\b/g

  /** Read as text; a binary that happens to contain the shape is not a reference. */
  const BINARY = /\.(webp|jpe?g|png|gif|ico|woff2?|ttf|otf|mp4|webm|pdf|svg)$/i

  const named = new Map<string, string[]>()
  for (const path of execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n")) {
    // The store itself is excluded: a runner containing its own name, or another
    // runner's, is not a reference to it.
    if (!path || path.startsWith("public/showcase/runners/") || BINARY.test(path)) continue
    let text: string
    try {
      text = readFileSync(resolve(root, path), "utf8")
    } catch {
      continue
    }
    // Deduped: a file naming the same runner on eight entries is one referencer,
    // and listing it eight times in the failure buries the other referencers.
    for (const [name] of text.matchAll(SHAPE)) {
      const where = named.get(name) ?? []
      if (!where.includes(path)) named.set(name, [...where, path])
    }
  }

  /**
   * The guard against this whole thing passing vacuously.
   *
   * A scan that matches nothing asserts nothing, which is the failure mode this
   * session has hit twice elsewhere. If the naming convention ever moves — a
   * longer hash, a different separator — `SHAPE` stops matching, every check
   * below silently disappears, and only this notices.
   *
   * It is stated against the committed files rather than against a number, so
   * it cannot be satisfied by a stale expectation.
   */
  it("is found by a pattern that still describes a runner's name", () => {
    const unparsed = committed.filter((name) => !new RegExp(`^${SHAPE.source}$`).test(name))
    expect(
      unparsed,
      `these committed runners do not match the pattern this check scans for, so references to them ` +
        `would not be found and every assertion below them would pass by finding nothing. ` +
        `If runner filenames have changed shape, SHAPE has to change with them.`,
    ).toEqual([])
    expect(named.size, "no file in the repo names any runner, which cannot be right").toBeGreaterThan(0)
  })

  it.each([...named].sort())("%s is committed", (name, where) => {
    expect(
      committed,
      `${where.join(", ")} name${where.length > 1 ? "" : "s"} ${name}, which is not in ` +
        `public/showcase/runners/. A page pinning a runner by content hash fails silently when it is ` +
        `missing — the loader empties its container and the host's own background shows, which looks ` +
        `deliberate. Either restore it from git, or stop referencing it.`,
    ).toContain(name)
  })
})

describe("committed runners", () => {
  it("there is at least one, or every check here passes vacuously", () => {
    expect(committed.length).toBeGreaterThan(0)
  })
})

/**
 * **Running the script must not change a tracked file.**
 *
 * `pnpm run dev` is `pnpm run runners && astro dev`, so the browser suite runs
 * this script every time `globalSetup` starts a server. That made every full
 * `pnpm run test:browser` leave `public/showcase/manifest.json` modified —
 * forbidden outright by `src/experiments/AGENTS.md` ("not `pnpm test`, which
 * must never write tracked files"), and in the one directory where a stray
 * modification is expensive to misread: a previous steward, seeing one, was on
 * the point of gitignoring the published pins. #163.
 *
 * That manifest is gone, and with it the unconditional write that caused it.
 * The property it protected is not gone, which is why this stays: the script
 * still writes into a directory holding tracked files, and a rebuild that
 * rewrote one would dirty the tree on every browser run.
 *
 * **This runs the real script rather than reasoning about it**, because the
 * property is about what the script does to the disk. A rebuild is
 * byte-deterministic, so a published runner comes back byte-identical.
 *
 * A piece that has changed since it was published builds to a *new* name, which
 * is a new untracked file rather than a modification — so this stays green, and
 * correctly: not republishing is the ordinary case.
 */
describe("running the script", () => {
  const tracked = committed.map((name) => resolve(runners, name))

  it("leaves every committed file byte-identical", () => {
    const before = new Map(tracked.map((path) => [path, readFileSync(path)]))

    execFileSync("node", ["scripts/runners.ts"], { cwd: root, encoding: "utf8" })

    const changed = tracked.filter((path) => !before.get(path)!.equals(readFileSync(path)))

    expect(
      changed.map((path) => path.slice(root.length + 1)),
      `\`pnpm run runners\` rewrote a committed file. If a piece changed, that is this file's ` +
        `usual instruction — commit what the script wrote. If nothing changed, the script is ` +
        `writing unconditionally again, which makes every browser run dirty the tree. See #163.`,
    ).toEqual([])
  })
})

describe("the home page's embed", () => {
  const page = readFileSync(resolve(root, "src/pages/index.astro"), "utf8")

  /**
   * That the pin names a committed runner is checked above, with every other
   * reference in the repo, rather than here. What is still this block's own
   * business is that the page pins one **at all** — a home page that quietly
   * stopped embedding anything would pass a reference check by having no
   * references.
   */
  it("pins a runner", () => {
    expect(page, "no data-showcase-runner in src/pages/index.astro").toMatch(
      /data-showcase-runner="\/showcase\/runners\/[\w.-]+\.js"/,
    )
  })

  it("carries its scenes inline, rather than fetching them", () => {
    expect(page).toMatch(/data-showcase-scene="[\w-]+"/)
    // The artefact-file indirection is gone on purpose — see the correction in
    // `docs/adr/20260906-a-published-scene-is-settings-plus-a-frozen-runner.md`.
    // `src/showcase/README.md` used to say so and no longer exists.
    expect(page).not.toMatch(/data-showcase="/)
  })

  /**
   * The site's own background is the embed's fallback, so removing it would turn
   * a failed embed from "unchanged page" into "blank page".
   */
  it("still has the CSS background it falls back to", () => {
    const globals = readFileSync(resolve(root, "src/styles/globals.css"), "utf8")
    expect(globals).toMatch(/bg-\[url\('\/bg\.svg'\)\]/)
    expect(globals).toMatch(/dark:bg-\[url\('\/bg-dark\.svg'\)\]/)
  })
})
