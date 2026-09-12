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
 * public/showcase/runners/<slug>.<hash>.js   tracked once something names it.
 * public/showcase/embed.js                   generated. The mutable loader.
 * ```
 *
 * **Building a runner does not publish it.** This writes every piece's current
 * build into the runners directory on every run, and says nothing about which of
 * them belong in the store. A runner is published by something naming it — a
 * wall entry, a page — and that edit is what commits it.
 *
 * So the directory is self-describing: **tracked is published, untracked is
 * build output.** `pnpm run prune` removes tracked runners nothing names and
 * leaves untracked ones alone. Committing every build is what this used to do,
 * and it produced one new committed file per rebuild forever — three for
 * `embers` on the day it shipped, two of them dead before anything published
 * against them.
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const experiments = resolve(root, "src/experiments")
const out = resolve(root, "public/showcase")

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
  // **Nothing is deleted here, ever**, and nothing is published here either.
  // This writes every piece's current build; which of them belong in the store
  // is decided by what names them. See
  // `src/experiments/docs/adr/20260912-the-store-holds-published-runners-only.md`.
  await mkdir(resolve(out, "runners"), { recursive: true })

  for (const slug of await piecesWithRunners()) {
    const built = await build({ ...shared, entryPoints: [resolve(experiments, slug, "runner.ts")] })
    const code = built.outputFiles[0]!.contents
    const hash = createHash("sha256").update(code).digest("hex").slice(0, 12)
    const name = `${slug}.${hash}.js`
    await writeFile(resolve(out, "runners", name), code)
    console.log(`runner    ${slug.padEnd(14)} ${name}  ${kb(code.byteLength)}`)
  }

  const loader = await build({ ...shared, entryPoints: [resolve(experiments, "gallery/embed.ts")] })
  await writeFile(resolve(out, "embed.js"), loader.outputFiles[0]!.contents)
  console.log(`loader    ${"embed.js".padEnd(14)} ${kb(loader.outputFiles[0]!.contents.byteLength)}`)
}

await main()
