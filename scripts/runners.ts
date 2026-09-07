/**
 * Freezes each piece that has a runner, and publishes the artefacts that name
 * them.
 *
 * Two jobs that will one day be far apart, and the distance is the point:
 *
 * 1. **Building a runner** — bundling `src/experiments/<slug>/runner.ts` into
 *    one self-contained module. Happens when a piece's *code* changes, which is
 *    a deploy anyway. Slow is fine.
 * 2. **Publishing an artefact** — stamping a settings blob with the runner hash
 *    it was published against. Happens whenever somebody likes a scene. No
 *    build, no test, no wait.
 *
 * They run together here only because nothing yet publishes on its own. Nearly
 * every publish reuses a runner that already exists, which is what will let
 * publishing feel like pressing save rather than like shipping.
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
 * describes it. The manifest records the commit anyway, for tracing a runner
 * back to a tree — **the commit at which these runners were built**, which is
 * why the manifest is rewritten only when a runner hash actually changes. It
 * used to be written unconditionally, and therefore recorded the commit at which
 * somebody last started a dev server. See `manifestUnchanged` below and #163.
 *
 * ## Output, and which half is committed
 *
 * ```
 * public/showcase/runners/<slug>.<hash>.js   COMMITTED. Frozen, accumulating.
 * public/showcase/manifest.json              COMMITTED. slug -> current runner.
 * public/showcase/embed.js                   generated. The mutable loader.
 * ```
 *
 * The split states the design: the immutable things are committed, so a page
 * that pinned one keeps finding it, and the one deliberately mutable thing is
 * rebuilt every time. The manifest is committed because it is what the Astro
 * build reads to know a piece's current runner — leaving it generated would put
 * a build-order dependency in front of `astro check`.
 *
 * Run it by hand after changing a piece and commit what it writes, the way
 * `pnpm run posters` works. Unlike a poster, a runner is byte-reproducible, so
 * `tests/unit/showcase-runners.test.ts` rebuilds and fails if what is committed
 * is not what the source produces.
 */

import { execFileSync } from "node:child_process"
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

function commit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    // A tarball or a shallow checkout. The hashes are what matter; this is a
    // convenience for tracing one back to a tree.
    return "unknown"
  }
}

type Manifest = { commit: string; runners: Record<string, string> }

/** What is committed, or `null` if there is nothing readable there yet. */
async function currentManifest(path: string): Promise<Manifest | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Manifest
    return parsed.runners && typeof parsed.runners === "object" ? parsed : null
  } catch {
    // Absent, or corrupt. Either way the right answer is to write a fresh one.
    return null
  }
}

/**
 * Whether the manifest on disk already names exactly these runners.
 *
 * **This is what stops `pnpm test` writing a tracked file**, and the field it
 * protects is `commit`. `pnpm run dev` is `pnpm run runners && astro dev`, so
 * the browser suite's `globalSetup` runs this script every time it starts a
 * server — and an unconditional write stamped HEAD into a committed file on
 * every run, leaving the tree dirty for a change nobody made.
 *
 * That is forbidden outright by `src/experiments/AGENTS.md` ("not `pnpm test`,
 * which must never write tracked files") and it made the field a lie besides:
 * `commit` is documented as being "for tracing a runner back to a tree", and
 * what it actually recorded was the commit at which somebody last started a dev
 * server. The two coincide only by luck. #163 is the case — the field moved two
 * commits while the runner hash beside it, `starry-night.490e5f9452c8.js`, did
 * not move at all.
 *
 * It also mattered more here than the churn suggests. `public/showcase/` is the
 * one directory where misreading `git status` is expensive: a runner is
 * committed *because* GitHub Pages keeps no history, and a session that saw a
 * stray modification in here was once on the point of gitignoring the lot.
 *
 * **Compared on the runners map alone**, deliberately. Comparing whole files
 * would include `commit` and so always differ, which is the bug.
 */
async function manifestUnchanged(path: string, runners: Record<string, string>): Promise<boolean> {
  const existing = await currentManifest(path)
  if (!existing) return false
  const same = (a: Record<string, string>, b: Record<string, string>) =>
    Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([slug, name]) => b[slug] === name)
  return same(existing.runners, runners)
}

async function main() {
  // **Nothing is deleted here, ever.** A runner's name is the hash of its own
  // bytes and a published page pins that name, so removing an old one breaks a
  // page that was promised it would not break — silently, because the loader
  // falls back to the host's own background. Runners accumulate in the repo and
  // GitHub Pages serves whatever is committed; see
  // `src/experiments/docs/adr/20260907-runners-are-committed.md`.
  await mkdir(resolve(out, "runners"), { recursive: true })

  const runners: Record<string, string> = {}
  for (const slug of await piecesWithRunners()) {
    const built = await build({ ...shared, entryPoints: [resolve(experiments, slug, "runner.ts")] })
    const code = built.outputFiles[0]!.contents
    const hash = createHash("sha256").update(code).digest("hex").slice(0, 12)
    const name = `${slug}.${hash}.js`
    await writeFile(resolve(out, "runners", name), code)
    runners[slug] = name
    console.log(`runner    ${slug.padEnd(14)} ${name}  ${kb(code.byteLength)}`)
  }

  const loader = await build({ ...shared, entryPoints: [resolve(experiments, "gallery/embed.ts")] })
  await writeFile(resolve(out, "embed.js"), loader.outputFiles[0]!.contents)
  console.log(`loader    ${"embed.js".padEnd(14)} ${kb(loader.outputFiles[0]!.contents.byteLength)}`)

  // **Written only when a runner actually changed**, which is what makes the
  // `commit` field mean what it claims. See `manifestUnchanged` above and #163.
  const path = resolve(out, "manifest.json")
  if (await manifestUnchanged(path, runners)) {
    console.log(`manifest  ${"unchanged".padEnd(14)} still built at ${(await currentManifest(path))?.commit ?? "?"}`)
    return
  }
  await writeFile(path, `${JSON.stringify({ commit: commit(), runners }, null, 2)}\n`)
  console.log(`manifest  ${"written".padEnd(14)} at ${commit()}`)
}

await main()
