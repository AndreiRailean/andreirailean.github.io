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
 * back to a tree.
 *
 * ## Output
 *
 * ```
 * public/showcase/embed.js                     the loader. One URL, unversioned.
 * public/showcase/runners/<slug>.<hash>.js     frozen. Never edited again.
 * public/showcase/artefacts/<name>.json        settings + the runner they name.
 * public/showcase/manifest.json                slug -> current runner, plus the commit.
 * ```
 *
 * All of it is build output and none of it is committed; `pnpm run runners`
 * regenerates it, and `dev` and `build` both run it first.
 */

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const experiments = resolve(root, "src/experiments")
const sources = resolve(root, "src/showcase")
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

async function main() {
  // Files are pruned individually rather than removing the directories. A
  // directory under `public/` that is deleted and recreated makes a running dev
  // server 404 everything inside it until restarted, which looks exactly like
  // the build having failed.
  await mkdir(resolve(out, "runners"), { recursive: true })
  await mkdir(resolve(out, "artefacts"), { recursive: true })
  for (const dir of ["runners", "artefacts"]) {
    for (const name of await readdir(resolve(out, dir))) {
      await rm(resolve(out, dir, name), { force: true })
    }
  }

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

  const artefacts = (await readdir(sources)).filter((name) => name.endsWith(".json"))
  for (const file of artefacts) {
    const source = JSON.parse(await readFile(resolve(sources, file), "utf8")) as {
      piece: string
      variants: Record<string, unknown>
      defaultVariant: string
    }
    const runner = runners[source.piece]
    if (!runner) {
      throw new Error(
        `src/showcase/${file} names piece "${source.piece}", which has no ` +
          `src/experiments/${source.piece}/runner.ts. Known: ${Object.keys(runners).join(", ") || "none"}.`,
      )
    }
    const id = file.replace(/\.json$/, "")
    await writeFile(
      resolve(out, "artefacts", file),
      `${JSON.stringify({ id, runner: `../runners/${runner}`, defaultVariant: source.defaultVariant, variants: source.variants }, null, 2)}\n`,
    )
    console.log(`artefact  ${id.padEnd(14)} -> ${runner}`)
  }

  const loader = await build({ ...shared, entryPoints: [resolve(experiments, "gallery/embed.ts")] })
  await writeFile(resolve(out, "embed.js"), loader.outputFiles[0]!.contents)
  console.log(`loader    ${"embed.js".padEnd(14)} ${kb(loader.outputFiles[0]!.contents.byteLength)}`)

  await writeFile(resolve(out, "manifest.json"), `${JSON.stringify({ commit: commit(), runners }, null, 2)}\n`)
}

await main()
