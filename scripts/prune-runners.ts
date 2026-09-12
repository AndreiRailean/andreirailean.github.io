/**
 * Removes committed runners that nothing references.
 *
 * ## Why this is allowed to exist
 *
 * `public/showcase/runners/` was append-only, because a page pins a runner by
 * the hash of its own bytes and nobody could prove who still held one. That was
 * the right rule while the consuming set was unknowable. It is knowable:
 * **everything that names a runner is in this repo**, and
 * `tests/unit/showcase-runners.test.ts` fails if a named one is missing.
 *
 * So the store stops needing to be a hoard. Keeping a runner nothing names, in
 * case a reader nobody can identify might want it, is insurance against a risk
 * that does not exist — and git already holds every deleted file, so the
 * recovery it was buying was already bought. `git checkout <sha> -- <path>`
 * restores the exact bytes, and a runner is byte-reproducible from its source at
 * that commit besides.
 *
 * **This becomes wrong the moment a runner URL can leave this repo.** A
 * copy-embed button would put one on a page nobody here controls, and no runner
 * would ever again be provably unreferenced. Then the store goes back to being
 * append-only, permanently. That is a decision to take before such a button
 * ships rather than after.
 *
 * ## Why the scan is written twice
 *
 * `tests/unit/showcase-runners.test.ts` computes the same reachability and this
 * file does not import it, nor the reverse. **A pruner and the check that
 * catches a bad prune must not share a blind spot**: a scanner that missed a
 * reference would delete a live runner *and* stay silent about it, because both
 * halves would agree. Deliberately duplicated for the same reason `hashOf` is
 * duplicated in that file — a check that agrees with itself checks nothing.
 *
 * So: prune here, verify there, and if the two ever disagree the test is the one
 * that is right.
 *
 * ## Tracked only
 *
 * The store is what git is tracking. `pnpm run runners` writes every piece's
 * current build into the same directory, so an unpublished piece's newest build
 * sits there untracked — build output, not store contents, and not this file's
 * business. Deleting it would delete exactly what a publish is about to commit.
 *
 * ```
 * pnpm run prune          delete tracked runners nothing names
 * pnpm run prune --list   name them and change nothing
 * ```
 */

import { execFileSync } from "node:child_process"
import { readFileSync, rmSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const store = resolve(root, "public/showcase/runners")

/** `<slug>.<12 hex>.js`, the shape `scripts/runners.ts` writes. */
const SHAPE = /\b[a-z0-9][a-z0-9-]*\.[0-9a-f]{12}\.js\b/g

/** Read as text; a binary that happens to contain the shape is not a reference. */
const BINARY = /\.(webp|jpe?g|png|gif|ico|woff2?|ttf|otf|mp4|webm|pdf|svg)$/i

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)}kb`

/**
 * Every runner name any tracked file mentions.
 *
 * **Prose counts**, which is the safe direction: a runner named in an ADR is one
 * this repo still talks about, and over-retaining it costs 22kb. The reverse
 * mistake deletes something a page needs.
 *
 * The store itself is excluded — a runner's own bytes are not a reference to it,
 * and one runner naming another would pin it for no reason.
 */
function referenced(): Set<string> {
  const names = new Set<string>()
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n")
  for (const path of tracked) {
    if (!path || path.startsWith("public/showcase/runners/") || BINARY.test(path)) continue
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
 * The runners git is tracking, which is what "the store" means.
 *
 * **Untracked ones are build output and are left alone.** `pnpm run runners`
 * writes every piece's current build into this directory whether or not anything
 * publishes it, so the newest build of a piece nobody has published sits here
 * untracked — and deleting what a publish is about to commit would be the
 * opposite of helpful. See
 * `src/experiments/docs/adr/20260912-the-store-holds-published-runners-only.md`.
 */
function tracked(): string[] {
  const listed = execFileSync("git", ["ls-files", "public/showcase/runners"], { cwd: root, encoding: "utf8" })
  return listed
    .split("\n")
    .filter((path) => path.endsWith(".js"))
    .map((path) => path.slice("public/showcase/runners/".length))
}

function main() {
  const list = process.argv.includes("--list")
  const committed = tracked()
  const names = referenced()

  /*
   * A scan that matches nothing would report every runner as unreferenced and,
   * without `--list`, delete the lot. The test file guards its own scan the same
   * way; this one cannot rely on that, because it runs on its own.
   */
  if (names.size === 0) {
    console.error("prune: no file in this repo names any runner, which cannot be right. Refusing to delete anything.")
    process.exit(1)
  }

  const dead = committed.filter((name) => !names.has(name))
  const bytes = dead.reduce((total, name) => total + statSync(resolve(store, name)).size, 0)

  if (dead.length === 0) {
    console.log(`prune: nothing to remove. ${committed.length} runners, all referenced.`)
    return
  }

  for (const name of dead)
    console.log(`${list ? "unpruned" : "removed "}  ${name.padEnd(32)} ${kb(statSync(resolve(store, name)).size)}`)

  if (list) {
    console.log(
      `prune: ${dead.length} of ${committed.length} runners unreferenced, ${kb(bytes)}. Run \`pnpm run prune\`.`,
    )
    return
  }

  for (const name of dead) rmSync(resolve(store, name))
  console.log(`prune: removed ${dead.length} of ${committed.length} runners, ${kb(bytes)} reclaimed.`)
  console.log("prune: git holds them if one is ever wanted back — `git checkout HEAD~1 -- public/showcase/runners/`.")
}

main()
