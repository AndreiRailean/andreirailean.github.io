/**
 * Builds each piece that has a runner. It does not publish anything.
 *
 * Two jobs that were always meant to be far apart, and now are:
 *
 * 1. **Building a runner** — bundling `src/experiments/<slug>/runner.ts` into
 *    one self-contained module. Happens when a piece's *code* changes. Slow
 *    would be fine; it is not slow.
 * 2. **Publishing one** — something naming a runner, so that a page runs those
 *    exact bytes forever. Happens whenever somebody likes a scene. No build, no
 *    test, no wait: it is an edit to `src/showcase/wall.ts` or a page.
 *
 * This file does the first and knows nothing about the second, which is why
 * publishing can feel like pressing save. Nearly every publish names a runner
 * that already exists.
 *
 * ## Naming
 *
 * A runner's filename carries a **content hash**, not a commit hash. Two
 * properties fall out that a commit hash cannot give:
 *
 * - A rebuild that changes nothing produces the same name and publishes
 *   nothing, so "runners only change when the piece changes" is a fact rather
 *   than a convention.
 * - A published artefact keeps pointing at the bytes it was published against,
 *   whatever happens to the piece afterwards.
 *
 * A commit hash is also the harder number to be honest about: a runner bundles a
 * piece *and* whatever section-level code it imports, so no single commit
 * describes it. There is no commit field anywhere any more — it lived in a
 * manifest that has been dropped, and by the end it was recording the commit at
 * which somebody last started a dev server. #163, and now
 * `docs/adr/20260912-the-store-holds-published-runners-only.md`.
 *
 * ## Output, and which of it is committed
 *
 * ```
 * .runners/<slug>.<hash>.js                  every build. Gitignored, disposable.
 * public/showcase/runners/<slug>.<hash>.js   the store: only what something names.
 * public/showcase/embed.js                   generated. The mutable loader.
 * ```
 *
 * **Building a runner does not publish it.** Every piece's current build goes
 * to `.runners/`, which nothing serves and anything may delete. A runner is
 * published by something naming it — a wall entry, a page — and after the
 * builds, `scripts/runner-store.ts` copies each named build the store lacks into
 * the store, to be committed with the edit that names it.
 *
 * Builds went into the store directory itself until 2026-11-06, told apart from
 * published runners only by whether git tracked them. Clearing them meant
 * deleting by pattern in a directory where the same pattern matched published
 * files, and a session did exactly that.
 * `src/experiments/docs/adr/20261106-runner-builds-live-outside-the-store.md`.
 * Committing every build, before that, produced one new committed file per
 * rebuild forever — three for `embers` on the day it shipped, two of them dead
 * before anything published against them.
 *
 * A published runner is never edited: it is named by the hash of its own bytes,
 * so `tests/unit/showcase-runners.test.ts` catches a changed one, and the
 * `Runner store` workflow catches a modified, renamed or type-changed one.
 */

import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

import { BUILDS, STORE, namedRunners, publishNamed } from "./runner-store.ts"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const experiments = resolve(root, "src/experiments")
const out = resolve(root, "public/showcase")
const builds = resolve(root, BUILDS)
const store = resolve(root, STORE)

const shared = {
  bundle: true,
  format: "esm" as const,
  target: "es2022",
  minify: true,
  // The site's `@/*`. A runner pulls in whatever the piece imports and comes out
  // self-contained, which is what makes it freezable at all.
  alias: { "@": resolve(root, "src") },
  write: false as const,
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)}kb`

/** A piece opts in by having a `runner.ts`. Nothing looks for one that does not. */
async function piecesWithRunners(): Promise<string[]> {
  const entries = await readdir(experiments, { withFileTypes: true })
  const slugs: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      await readFile(resolve(experiments, entry.name, "runner.ts"))
      slugs.push(entry.name)
    } catch {
      // No runner. Not an error: most pieces will not have one for a while.
    }
  }
  return slugs.sort()
}

async function main() {
  // **Nothing is deleted here, ever.** This writes every piece's current build
  // to `.runners/`; which of them belong in the store is decided by what names
  // them, below.
  await mkdir(builds, { recursive: true })
  await mkdir(store, { recursive: true })
  const current = new Map<string, string>()

  for (const slug of await piecesWithRunners()) {
    const built = await build({ ...shared, entryPoints: [resolve(experiments, slug, "runner.ts")] })
    const code = built.outputFiles[0]!.contents
    const hash = createHash("sha256").update(code).digest("hex").slice(0, 12)
    const name = `${slug}.${hash}.js`
    await writeFile(resolve(builds, name), code)
    console.log(`runner    ${slug.padEnd(14)} ${name}  ${kb(code.byteLength)}`)
    current.set(slug, name)
  }

  const loader = await build({ ...shared, entryPoints: [resolve(experiments, "gallery/embed.ts")] })
  await writeFile(resolve(out, "embed.js"), loader.outputFiles[0]!.contents)
  console.log(`loader    ${"embed.js".padEnd(14)} ${kb(loader.outputFiles[0]!.contents.byteLength)}`)

  for (const name of publishNamed(namedRunners(root), builds, store)) {
    console.log(`published ${name} into ${STORE}/, because something names it: commit it with that edit`)
  }

  // A piece whose current build is not in the store has changed since it was
  // last published. Building used to leave that build untracked in the store,
  // where `git status` showed it; now it says so here. Whether published
  // scenes move onto it is a question, and usually the answer is no:
  // `src/showcase/AGENTS.md`, "Publishing a runner is part of changing a piece".
  const stored = await readdir(store)
  const moved = [...current].filter(([slug, name]) => {
    const published = stored.filter((file) => file.startsWith(`${slug}.`))
    return published.length > 0 && !published.includes(name)
  })
  if (moved.length > 0) {
    console.log(
      `moved     ${moved.map(([slug]) => slug).join(", ")}: changed since last published. ` +
        `Whether published scenes move is a question, usually answered no: src/showcase/AGENTS.md`,
    )
  }
}

await main()
