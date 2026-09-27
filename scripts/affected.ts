/**
 * Runs the tests a change can affect, and every test when it cannot say.
 *
 * ```
 * pnpm run test:affected unit       # vitest over what the change touched
 * pnpm run test:affected browser    # playwright over what the change touched
 * pnpm run test:affected unit --base HEAD^1 --dry-run
 * ```
 *
 * **A piece is a library behind three files, and its folder is the unit of
 * change** — `src/experiments/docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 * So a change inside `src/experiments/<slug>/`, or to its routes, selects that
 * piece. A prose change selects nothing, as the browser workflow's
 * `paths-ignore` already had it. **Anything else selects everything**, so a path
 * nobody classified can only cost time, never coverage. That default is the
 * whole safety of this file; `tests/unit/affected.test.ts` holds it against
 * paths the repo does not contain.
 *
 * What a selection runs:
 *
 * - **unit** — the shared checks in `tests/unit/`, always, because they read
 *   every piece and a good deal of prose, plus each selected piece's
 *   `src/experiments/<slug>/tests/`. With nothing selected, the shared checks
 *   alone.
 * - **browser** — each selected piece's own spec, its slice of `kit.spec.ts` and
 *   `experiments-notes.spec.ts`, whose tests are all titled `<slug>: …`, and
 *   the index spec, which lists every piece. With nothing selected, nothing.
 *
 * **Playwright's `--grep` is matched against `project file title`**, as in
 * `chromium tests/kit.spec.ts walkers: presets run…`, so the slug is anchored on
 * a space rather than on `^`. `^walkers: ` was the obvious form, and it matches
 * nothing — the vacuous-check shape the root `AGENTS.md` lists first. So before
 * running, the selection is listed and a selected piece that matched no kit test
 * is an error rather than a quiet pass.
 *
 * The full suite still runs on every push to `main` — see the workflows — so a
 * mis-map fails one merge later and can be traced to it, rather than never.
 */
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

export type Selection = { everything: true; why: string } | { everything: false; pieces: string[] }

/** What a path is, for the purpose of choosing tests. */
export type Kind = { kind: "piece"; slug: string } | { kind: "prose" } | { kind: "shared-unit" } | { kind: "unknown" }

/**
 * Prose no test depends on being correct *code*: agent docs, ADRs, skills.
 *
 * The unit job's shared checks still read it — `adr-format` and `agent-docs` —
 * and they run on every selection, so classifying these as affecting no piece
 * costs nothing they cover. A piece's `about.md` is **not** here: it is content
 * the index and the notes render, and it sits in the piece's folder anyway.
 */
const PROSE = [
  /^docs\//,
  /^src\/experiments\/docs\//,
  /(^|\/)AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^\.claude\//,
  /^[^/]+\.md$/,
]

export function classify(path: string, pieces: readonly string[]): Kind {
  const inPiece = /^src\/experiments\/([^/]+)\//.exec(path) ?? /^src\/pages\/experiments\/([^/]+)\//.exec(path)
  // A piece's own agent notes are prose, and are read by the shared checks.
  if (PROSE.some((pattern) => pattern.test(path))) return { kind: "prose" }
  if (inPiece && pieces.includes(inPiece[1]!)) return { kind: "piece", slug: inPiece[1]! }
  if (/^tests\/unit\//.test(path)) return { kind: "shared-unit" }
  return { kind: "unknown" }
}

/** The pieces a set of changed paths selects, or everything with the first path that forced it. */
export function select(paths: readonly string[], pieces: readonly string[]): Selection {
  const chosen = new Set<string>()
  for (const path of paths) {
    const kind = classify(path, pieces)
    if (kind.kind === "unknown") return { everything: true, why: path }
    if (kind.kind === "piece") chosen.add(kind.slug)
  }
  return { everything: false, pieces: [...chosen].sort() }
}

/** A piece is a directory of `src/experiments/` holding a `runner.ts` — the same test the contract check applies. */
export function piecesOnDisk(): string[] {
  return readdirSync("src/experiments", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join("src/experiments", entry.name, "runner.ts")))
    .map((entry) => entry.name)
    .sort()
}

/** The vitest arguments for a selection: filters, or none for the whole suite. */
export function unitArgs(selection: Selection): string[] {
  if (selection.everything) return ["run"]
  return ["run", "tests/unit/", ...selection.pieces.map((slug) => `src/experiments/${slug}/tests/`)]
}

/** The playwright `--grep` for a selection, or null when the selection runs nothing in a browser. */
export function browserGrep(selection: Selection): string | null {
  if (selection.everything || selection.pieces.length === 0) return null
  const slugs = selection.pieces.map((slug) => slug.replace(/[-]/g, "\\-")).join("|")
  return `(^| )(${slugs}): |src/experiments/(${slugs})/tests/|tests/experiments-index\\.spec\\.ts`
}

/** Paths changed since `base`, committed or not. Untracked runner builds are build output, and are left out. */
function changedSince(base: string): string[] {
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean)
  const tracked = git("diff", "--name-only", "--no-renames", base)
  const untracked = git("ls-files", "--others", "--exclude-standard").filter(
    (path) => !path.startsWith("public/showcase/runners/"),
  )
  return [...new Set([...tracked, ...untracked])].sort()
}

function defaultBase(): string {
  return execFileSync("git", ["merge-base", "HEAD", "origin/main"], { encoding: "utf8" }).trim()
}

function run(command: string, args: string[]): number {
  console.log(`$ ${command} ${args.map((arg) => (/[\s|()^\\]/.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`)
  return spawnSync(command, args, { stdio: "inherit" }).status ?? 1
}

/** Lists what a grep selects and fails a selected piece whose kit slice came back empty. */
function checkBrowserSelection(grep: string, pieces: readonly string[]): void {
  const listed = execFileSync("pnpm", ["exec", "playwright", "test", "--list", "--grep", grep], { encoding: "utf8" })
  const lines = listed.split("\n")
  const missing = pieces.filter(
    (slug) => !lines.some((line) => line.includes("tests/kit.spec.ts:") && line.includes(`› ${slug}: `)),
  )
  if (missing.length > 0) {
    throw new Error(
      `--grep ${JSON.stringify(grep)} selected no kit test for ${missing.join(", ")}. ` +
        `A selection that matches nothing passes for ever; fix the pattern rather than this check.`,
    )
  }
}

function main(argv: string[]): number {
  const suite = argv[0]
  if (suite !== "unit" && suite !== "browser") {
    console.error("usage: node scripts/affected.ts <unit|browser> [--base <ref>] [--dry-run]")
    return 2
  }
  const at = argv.indexOf("--base")
  const base = at >= 0 ? argv[at + 1]! : defaultBase()
  const dry = argv.includes("--dry-run")

  const paths = changedSince(base)
  const selection = select(paths, piecesOnDisk())
  console.log(
    selection.everything
      ? `affected: everything, because of ${selection.why} (${paths.length} paths changed since ${base})`
      : `affected: ${selection.pieces.join(", ") || "no piece"} (${paths.length} paths changed since ${base})`,
  )

  if (suite === "unit") return dry ? 0 : run("pnpm", ["exec", "vitest", ...unitArgs(selection)])

  if (selection.everything) return dry ? 0 : run("pnpm", ["exec", "playwright", "test"])
  const grep = browserGrep(selection)
  if (grep === null) {
    console.log("affected: nothing a browser test covers")
    return 0
  }
  checkBrowserSelection(grep, selection.pieces)
  return dry ? 0 : run("pnpm", ["exec", "playwright", "test", "--grep", grep])
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
