import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, describe, expect, it } from "vitest"

import { namedRunners, publishNamed } from "../../scripts/runner-store.ts"

/**
 * The one door from `.runners/` into the store.
 *
 * Builds live in `.runners/`, disposable; the store holds only what something
 * names. `publishNamed` is what moves a build across, so these hold that it
 * moves exactly the named ones, and never rewrites a file already published.
 * `src/experiments/docs/adr/20261106-runner-builds-live-outside-the-store.md`.
 */
const root = resolve(import.meta.dirname, "../..")
const scratch = mkdtempSync(join(tmpdir(), "runner-store-"))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function dirs(name: string) {
  const builds = join(scratch, name, "builds")
  const store = join(scratch, name, "store")
  mkdirSync(builds, { recursive: true })
  mkdirSync(store, { recursive: true })
  return { builds, store }
}

// Put together at runtime: written out whole, each would read as a reference
// to a runner the store must hold, and the reference check would want it.
const A = ["walkers", "a".repeat(12), "js"].join(".")
const B = ["crowd", "b".repeat(12), "js"].join(".")

describe("publishNamed", () => {
  it("copies a named build into the store, and only the named one", () => {
    const { builds, store } = dirs("named")
    writeFileSync(join(builds, A), "a")
    writeFileSync(join(builds, B), "b")
    expect(publishNamed([A], builds, store)).toEqual([A])
    expect(readdirSync(store)).toEqual([A])
    expect(readFileSync(join(store, A), "utf8")).toBe("a")
  })

  it("never rewrites a runner already in the store", () => {
    const { builds, store } = dirs("published")
    writeFileSync(join(builds, A), "rebuilt")
    writeFileSync(join(store, A), "published")
    expect(publishNamed([A], builds, store)).toEqual([])
    expect(readFileSync(join(store, A), "utf8")).toBe("published")
  })

  it("leaves a name with no build for the reference check to report", () => {
    const { builds, store } = dirs("missing")
    expect(publishNamed([A], builds, store)).toEqual([])
    expect(readdirSync(store)).toEqual([])
  })
})

describe("namedRunners", () => {
  /**
   * In a scratch repository, so the files can be shaped: a publish is an edit
   * nobody has committed yet, so an untracked page has to count, and git quotes
   * a path with an unusual character unless asked not to.
   */
  it("reads untracked files and unusual paths, and skips ignored ones", () => {
    const repo = join(scratch, "repo")
    mkdirSync(join(repo, "pages"), { recursive: true })
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")))
    execFileSync("git", ["init", "-q"], { cwd: repo, env })
    writeFileSync(join(repo, ".gitignore"), "scratch/\n")
    mkdirSync(join(repo, "scratch"))
    writeFileSync(join(repo, "pages", "new.astro"), `<div data-runner="${A}">`)
    writeFileSync(join(repo, "pages", "café.astro"), `<div data-runner="${B}">`)
    const ignored = ["dotfield", "c".repeat(12), "js"].join(".")
    writeFileSync(join(repo, "scratch", "note.md"), ignored)

    const names = namedRunners(repo)
    expect(names, "an untracked page's runner was not found").toContain(A)
    expect(names, "a runner named in a file with a non-ASCII name was not found").toContain(B)
    expect(names, "an ignored file counted as a reference").not.toContain(ignored)
  })

  it("finds the runner the home page pins", () => {
    const page = readFileSync(resolve(root, "src/pages/index.astro"), "utf8")
    const pinned = /data-showcase-runner="\/showcase\/runners\/([\w.-]+\.js)"/.exec(page)?.[1]
    expect(pinned, "the home page pins no runner, so this checks nothing").toBeDefined()
    expect(namedRunners(root)).toContain(pinned)
  })
})
