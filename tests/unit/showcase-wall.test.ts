import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { runnerUrl, WALL } from "@/showcase/wall"

/**
 * What must be true about the published wall.
 *
 * The wall and `public/showcase/manifest.json` are two committed indexes that
 * answer different questions — the manifest says what a piece's runner is
 * *now*, an entry says what a scene was published *against* — so they are
 * allowed to disagree, and an entry left on an older runner is the freeze
 * working rather than rot.
 *
 * **What is not allowed is an entry naming a runner nobody committed**, because
 * that failure is the silent one. The import rejects, the stage stays empty,
 * and an empty stage is indistinguishable from a piece that has not booted yet.
 * The same class of fault as the one `showcase-runners.test.ts` exists for, and
 * the reason both files are cheap and worth having.
 *
 * These deliberately do not decode a scene. Only a piece's own registry can
 * read one, `src/showcase/` may not import a piece, and a test that reached
 * past that boundary would be asserting the boundary does not exist. Whether a
 * scene decodes is the runner's business and is covered where the registries
 * live.
 */

const root = resolve(import.meta.dirname, "../..")
const manifest = JSON.parse(readFileSync(resolve(root, "public/showcase/manifest.json"), "utf8")) as {
  runners: Record<string, string>
}

describe("the published wall", () => {
  it("is not empty", () => {
    expect(WALL.length).toBeGreaterThan(0)
  })

  it("gives every entry an id nothing else uses", () => {
    // The id is the address. A duplicate is a page that shadows another and a
    // `neighbours` lookup that lands on the wrong one, both silently.
    const seen = new Map<string, number>()
    for (const [at, entry] of WALL.entries()) {
      const first = seen.get(entry.id)
      expect(first === undefined, `"${entry.id}" is used by entries ${String(first)} and ${at}`).toBe(true)
      seen.set(entry.id, at)
    }
  })

  it("keeps every id usable as a path segment", () => {
    for (const entry of WALL) {
      expect(entry.id, `"${entry.id}" is not a clean path segment`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  it("pins a runner that is actually committed", () => {
    for (const entry of WALL) {
      const file = resolve(root, "public/showcase/runners", entry.runner)
      expect(
        existsSync(file),
        `${entry.id} pins ${entry.runner}, which is not in public/showcase/runners. ` +
          `Either run \`pnpm run runners\` and commit what it writes, or point the entry at a runner that exists. ` +
          `A missing runner fails silently in the browser: the stage stays empty and looks like it is still loading.`,
      ).toBe(true)
    }
  })

  it("names a runner belonging to the piece it claims", () => {
    // A content-addressed name starts with its slug, so a mismatch here is an
    // entry that would mount the wrong piece's code against this scene — which
    // decodes to nonsense rather than to nothing, and is therefore worse than
    // the missing-file case.
    for (const entry of WALL) {
      expect(
        entry.runner.startsWith(`${entry.piece}.`),
        `${entry.id} pins ${entry.runner}, not a ${entry.piece} runner`,
      ).toBe(true)
    }
  })

  it("carries a scene for every entry", () => {
    for (const entry of WALL) {
      expect(entry.scene.length, `${entry.id} has no scene`).toBeGreaterThan(0)
    }
  })

  it("knows every piece it names", () => {
    for (const entry of WALL) {
      expect(entry.piece in manifest.runners, `${entry.id} names piece "${entry.piece}", which has no runner`).toBe(
        true,
      )
    }
  })

  it("serves runners from the one path the loader uses", () => {
    for (const entry of WALL) {
      expect(runnerUrl(entry)).toBe(`/showcase/runners/${entry.runner}`)
    }
  })
})
