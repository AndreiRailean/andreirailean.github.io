/**
 * Which builds enter the store, decided by what names them.
 *
 * `scripts/runners.ts` builds every piece into `.runners/`, which is gitignored
 * and nobody's business: any of it can be deleted at any time and the next
 * build writes it back byte for byte. The store, `public/showcase/runners/`,
 * holds only runners something in this repo names. This file is the one door
 * between them: after a build, every runner a file names that is in `.runners/`
 * and not yet in the store is copied in, to be committed with the edit that
 * names it.
 *
 * Publishing is unchanged for whoever does it: take a filename from the build's
 * output, name it in `src/showcase/wall.ts` or a page, and the next build (every
 * preview and test run does one) puts it in the store. What changed is that
 * nothing else does, so an untracked file in the store is always a publish
 * waiting for its commit, and never build output.
 * `src/experiments/docs/adr/20261106-runner-builds-live-outside-the-store.md`.
 *
 * **The scan is the third copy of one pattern**, beside `scripts/prune-runners.ts`
 * and `tests/unit/showcase-runners.test.ts`, and is kept apart from both on
 * purpose, as they are from each other. A reference this scan misses leaves a
 * named runner out of the store, and the test, scanning on its own, fails on the
 * missing file.
 */

import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/** `<slug>.<12 hex>.js`, the shape `scripts/runners.ts` writes. */
const SHAPE = /\b[a-z0-9][a-z0-9-]*\.[0-9a-f]{12}\.js\b/g

/** Read as text; a binary that happens to contain the shape is not a reference. */
const BINARY = /\.(webp|jpe?g|png|gif|ico|woff2?|ttf|otf|mp4|webm|pdf|svg)$/i

export const STORE = "public/showcase/runners"
export const BUILDS = ".runners"

/**
 * Every runner name a file in the worktree mentions, committed or not.
 *
 * **Untracked files count**, unlike in the prune and the test, because a
 * publish is an edit nobody has committed yet: the wall entry naming a new
 * runner is in the working tree when the build that should copy it runs.
 * Ignored files do not, so `.scratch/` and the build output itself name nothing.
 * The store is left out, since a runner's own bytes are not a reference to it.
 */
export function namedRunners(root: string): Set<string> {
  const names = new Set<string>()
  // `-z`, or git quotes a path with an unusual character and the read below
  // fails on the quoted form. Without git's hook variables, so the repository
  // is the one at `root` even when this runs inside a pre-push hook.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")))
  const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    env,
    encoding: "utf8",
  }).split("\0")
  for (const path of files) {
    if (!path || path.startsWith(`${STORE}/`) || path.startsWith(`${BUILDS}/`) || BINARY.test(path)) continue
    let text: string
    try {
      text = readFileSync(resolve(root, path), "utf8")
    } catch {
      continue
    }
    for (const [name] of text.matchAll(SHAPE)) names.add(name)
  }
  return names
}

/**
 * Copies each named build the store lacks into the store, and returns the names
 * it copied. A runner already in the store is never touched: its name is the
 * hash of its bytes, so a copy could only rewrite a published file. A name with
 * no build here is left for the test to report.
 */
export function publishNamed(names: Iterable<string>, builds: string, store: string): string[] {
  const copied: string[] = []
  for (const name of [...names].sort()) {
    const built = resolve(builds, name)
    const published = resolve(store, name)
    if (existsSync(published) || !existsSync(built)) continue
    copyFileSync(built, published)
    copied.push(name)
  }
  return copied
}
