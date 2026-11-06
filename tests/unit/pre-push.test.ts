import { statSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * The pre-push hook is wired, and runs scripts that exist.
 *
 * `.githooks/pre-push` runs the cheap half of CI before a push leaves the
 * machine, and its header says why. It only fires if git is pointed at it, and
 * that pointing is the part nobody sees break: a hook that is not installed
 * reads exactly like a branch with nothing wrong in it. So the wiring is held
 * here rather than left to the next edit of `package.json`.
 */
const hook = ".githooks/pre-push"
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }

describe("the pre-push hook", () => {
  it("is installed by pnpm install, which points core.hooksPath at its directory", () => {
    // `prepare` runs on every `pnpm install`, which every worktree runs.
    expect(pkg.scripts.prepare).toContain("git config core.hooksPath .githooks")
  })

  it("is executable, or git skips it without a word", () => {
    expect(statSync(hook).mode & 0o111).not.toBe(0)
  })

  it("runs only scripts package.json defines", () => {
    const body = readFileSync(hook, "utf8")
    const run = [...body.matchAll(/^pnpm run --silent ([\w:-]+)/gm)].map((match) => match[1]!)
    // The presence half: a hook whose commands stopped matching this pattern
    // would otherwise pass with nothing checked.
    expect(run).toEqual(["prettier", "lint", "test:affected"])
    for (const script of run) expect(pkg.scripts, `${hook} runs a missing script`).toHaveProperty([script])
  })
})
