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

const A = "walkers.aaaaaaaaaaaa.js"
const B = "crowd.bbbbbbbbbbbb.js"

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
  it("finds the runner the home page pins", () => {
    const page = readFileSync(resolve(root, "src/pages/index.astro"), "utf8")
    const pinned = /data-showcase-runner="\/showcase\/runners\/([\w.-]+\.js)"/.exec(page)?.[1]
    expect(pinned, "the home page pins no runner, so this checks nothing").toBeDefined()
    expect(namedRunners(root)).toContain(pinned)
  })
})
