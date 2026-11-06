import { execFileSync, spawnSync } from "node:child_process"
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, describe, expect, it } from "vitest"

/**
 * The pre-push hook refuses what it should, and is installed.
 *
 * `.githooks/pre-push` runs the cheap half of CI before a push leaves the
 * machine; its header says why. Both of its failures are quiet: a hook that
 * carries on past a failing step, or one git was never pointed at, reads
 * exactly like a branch with nothing wrong in it. A first version of this file
 * read the hook's text and passed with `|| exit 1` deleted, with the whole hook
 * replaced by `exit 0`, and with the install made a no-op. So this runs the
 * hook, in a scratch repository, against a stub `pnpm` that records what it was
 * asked to run and fails the script it is told to.
 */
const root = resolve(import.meta.dirname, "../..")
const hook = resolve(root, ".githooks/pre-push")
const install = resolve(root, ".githooks/install")

const scratch = mkdtempSync(join(tmpdir(), "pre-push-"))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

// Git exports GIT_DIR and friends to a hook, and this file runs inside one on
// every push. Left in, they would point the scratch repository's git at this
// one.
const env: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
)
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, env, encoding: "utf8" }).trim()

const bin = join(scratch, "bin")
const calls = join(scratch, "calls")
execFileSync("mkdir", ["-p", bin])
writeFileSync(join(bin, "pnpm"), `#!/bin/sh\nshift 2\necho "$*" >> "${calls}"\n[ "$1" = "$FAIL" ] && exit 1\nexit 0\n`)
chmodSync(join(bin, "pnpm"), 0o755)

const repo = join(scratch, "repo")
execFileSync("mkdir", ["-p", repo])
git(repo, "init", "-q")
writeFileSync(join(repo, "file"), "one\n")
git(repo, "add", "file")
git(repo, "commit", "-qm", "one")
const head = git(repo, "rev-parse", "HEAD")

const ZERO = "0".repeat(40)

function push(line: string, fail = "") {
  rmSync(calls, { force: true })
  const run = spawnSync("sh", [hook], {
    cwd: repo,
    input: `${line}\n`,
    env: { ...env, PATH: `${bin}:${env.PATH}`, FAIL: fail },
    encoding: "utf8",
  })
  let ran: string[] = []
  try {
    ran = readFileSync(calls, "utf8").trim().split("\n")
  } catch {
    // No call at all.
  }
  return { status: run.status, ran, stderr: run.stderr }
}

const sending = `refs/heads/b ${head} refs/heads/b ${ZERO}`
const ALL = ["prettier", "lint", "test:affected unit"]

describe("the pre-push hook", () => {
  it("runs prettier, eslint and the affected unit tests, and passes when they do", () => {
    expect(push(sending)).toMatchObject({ status: 0, ran: ALL })
  })

  it.each(["prettier", "lint", "test:affected"])("refuses the push when %s fails, and stops there", (script) => {
    const result = push(sending, script)
    expect(result.status).not.toBe(0)
    expect(result.ran).toEqual(ALL.slice(0, ALL.findIndex((call) => call.startsWith(script)) + 1))
  })

  it("checks nothing for a push that only deletes", () => {
    expect(push(`(delete) ${ZERO} refs/heads/b ${head}`)).toMatchObject({ status: 0, ran: [] })
  })

  it("refuses a push of a commit other than HEAD, which the working tree does not hold", () => {
    const result = push(`refs/heads/other ${"1".repeat(40)} refs/heads/other ${ZERO}`)
    expect(result).toMatchObject({ status: 1, ran: [] })
    expect(result.stderr).toContain("not HEAD")
  })

  it("refuses a push from a tree with uncommitted changes, which the checks would see instead", () => {
    writeFileSync(join(repo, "file"), "two\n")
    try {
      expect(push(sending)).toMatchObject({ status: 1, ran: [] })
    } finally {
      git(repo, "checkout", "--", "file")
    }
  })
})

describe("installing it", () => {
  it("is what pnpm install runs", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { scripts: Record<string, string> }
    expect(pkg.scripts.prepare).toBe("sh .githooks/install")
  })

  it("points core.hooksPath at .githooks", () => {
    const fresh = join(scratch, "fresh")
    execFileSync("mkdir", ["-p", fresh])
    git(fresh, "init", "-q")
    execFileSync("sh", [install], { cwd: fresh, env })
    expect(git(fresh, "config", "--get", "core.hooksPath")).toBe(".githooks")
  })

  it("does nothing, and does not fail, outside a git work tree", () => {
    const bare = join(scratch, "not-a-repo")
    execFileSync("mkdir", ["-p", bare])
    expect(spawnSync("sh", [install], { cwd: bare, env: { ...env, GIT_CEILING_DIRECTORIES: scratch } }).status).toBe(0)
  })

  it("has run in this checkout", () => {
    // pnpm runs `prepare` on a fresh or changed install only, so a checkout can
    // miss it and nothing says so. CI installs fresh, so there this checks what
    // the install actually did.
    expect(
      git(root, "config", "--get", "core.hooksPath"),
      "git is not pointed at .githooks here, so pushes skip the pre-push checks. Run `pnpm run prepare`.",
    ).toBe(".githooks")
  })

  it("leaves both scripts executable, or git skips the hook without a word", () => {
    for (const file of [hook, install]) expect(statSync(file).mode & 0o111, file).not.toBe(0)
  })
})
