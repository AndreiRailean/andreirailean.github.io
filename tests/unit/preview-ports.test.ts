import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { reviewPort } from "../support/review-port.ts"

/**
 * Two ports, and the check that stops them being collapsed into one.
 *
 * The **review port** is derived from the worktree's path, so every checkout
 * gets its own by construction and several pieces can be on screen at once,
 * each on an address that does not move. The **suite** names no port at all: it
 * builds, starts or adopts a preview, and reads `.astro/preview.json` to learn
 * where Astro settled.
 *
 * That asymmetry looks like duplication, and the tidy-up that removes it fails
 * in the worst available way. `docs/adr/20260828-a-derived-port-per-worktree.md`
 * records what happened when the *suite* had a port of its own: it insisted on
 * it, Astro reports the running server rather than starting a second, and the
 * run hung for the full timeout. Its sibling failure was adopting whatever
 * answered on a fixed number — a run drove **another worktree's branch** for its
 * whole length, passing, with nothing in the output saying so, and the posters
 * captured in the same run were stills of the wrong code.
 *
 * The same derivation is safe for review and unsafe for the suite, which is
 * exactly the kind of distinction that gets flattened by someone meaning well.
 * What makes it safe is that `scripts/preview.ts` never waits for a port and
 * never adopts a stranger: it stops its *own* worktree's preview, takes the
 * slot, and then believes `.astro/preview.json` about where it landed.
 *
 * Prose has not been enough here before. The repo's own `AGENTS.md` lists "a
 * rule that depends on being remembered" as a defect to fix, so the rule is
 * asserted rather than written down and hoped for.
 *
 * ## Why there are positive assertions too
 *
 * A check that only asserts an **absence** passes when the thing it guards has
 * been renamed or deleted — the grep finds nothing, and finding nothing is what
 * success looks like. That is the vacuity this repo has already shipped once, in
 * the first version of `tests/unit/browser-suite.test.ts`, and again in the first
 * version of the analytics check in `tests/harness.spec.ts`.
 *
 * So each absence is paired with a presence. "The suite asks for no port" is
 * only meaningful alongside "the suite discovers one from Astro's own record",
 * which fails if the helper stops choosing a port by any means at all.
 */

const SUITE = "tests/support/preview-server.ts"
const REVIEW = "tests/support/review-port.ts"
const SCRIPT = "scripts/preview.ts"

/**
 * A file with its comments removed.
 *
 * The docblocks in these files discuss `--port` and the review port at length —
 * that is their job, and a check reading raw text would be tripped by the very
 * prose explaining the rule. Coarse, like the text checks in
 * `tests/unit/browser-suite.test.ts`, and allowed to be: it reads real source
 * either way, and the failure it guards against is a line of code.
 */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

describe("the review port and the suite's port stay separate", () => {
  it("finds all three files at all", () => {
    // Renaming any of these must fail this check rather than silently satisfy
    // it, which is what an absence-only assertion would do.
    for (const path of [SUITE, REVIEW, SCRIPT]) {
      expect(code(path).length, `${path} is missing or empty`).toBeGreaterThan(200)
    }
  })

  it("derives the review port rather than fixing it", () => {
    const source = code(REVIEW)

    // A single fixed number gives one bookmark in total, so a second worktree
    // wanting to be on screen has to take the port off the first. Fine for
    // reviewing one thing; useless for reviewing three.
    expect(source).toMatch(/export function reviewPort\s*\(/)
    expect(source, "the port must be a function of the checkout path").toMatch(/process\.cwd\s*\(/)
    expect(source, "hashed, so two worktrees differ by construction rather than by noticing").toMatch(/Math\.imul/)
    expect(source).toMatch(/const PORT_BASE = \d{4}\b/)
    expect(source).toMatch(/const PORT_SPAN = \d+/)
  })

  it("gives every worktree its own port, and the same one every time", () => {
    // Imported rather than re-implemented: a copy of the derivation here would
    // keep passing while the real one drifted.
    const alpha = reviewPort("/root/.herdr/worktrees/andrei.md/alpha")
    const beta = reviewPort("/root/.herdr/worktrees/andrei.md/beta")

    expect(alpha, "the same checkout must get the same port every time").toBe(
      reviewPort("/root/.herdr/worktrees/andrei.md/alpha"),
    )
    expect(alpha, "two checkouts must not collide by design").not.toBe(beta)
    for (const port of [alpha, beta]) {
      expect(port).toBeGreaterThanOrEqual(4400)
      expect(port).toBeLessThan(4800)
    }
  })

  it("keeps the suite from asking for a port", () => {
    expect(
      /["']--port["']/.test(code(SUITE)),
      `${SUITE} passes --port to astro. Astro reports the running server instead of ` +
        `starting a second, so insisting on a port hangs for the full timeout whenever ` +
        `one is already up — and adopting whatever answers on a chosen number is how a run ` +
        `drove another worktree's branch. See docs/adr/20260828-a-derived-port-per-worktree.md.`,
    ).toBe(false)

    expect(code(SUITE), "the suite must not reach for the review port either").not.toMatch(/\breviewPort\b/)
  })

  it("makes the suite discover its port from Astro's own record", () => {
    const source = code(SUITE)

    // The pairing for the absence above. Without this, deleting the discovery
    // entirely would pass "asks for no port" and check nothing.
    expect(
      source,
      `${SUITE} must read the port from .astro/preview.json via previewState(). That file ` +
        `lives inside the worktree and so cannot name another branch's server, which is the ` +
        `property a port number does not have.`,
    ).toMatch(/previewState\s*\(/)

    // A state file can name a server that has since died, so the port it gives
    // is believed only once something answers on it.
    expect(source, `${SUITE} must confirm the port answers, not just that the file names one.`).toMatch(/fetch\s*\(/)
  })

  it("lets the review script — and only it — ask for a port", () => {
    const source = code(SCRIPT)
    expect(source).toMatch(/\breviewPort\s*\(/)
    expect(source).toMatch(/["']--port["']/)
  })

  it("derives 'someone is reviewing' from a live server rather than a declared flag", () => {
    const source = code(REVIEW)

    // A flag anybody writes is a flag a dying session leaves behind, and every
    // later build then refuses citing a reviewer who left hours ago. The remedy
    // becomes "delete the flag", and that reflex is indistinguishable from
    // overriding a live one. So the assertion has to be the observation.
    expect(source, "the review check must confirm the process is alive").toMatch(/process\.kill\s*\(/)
    expect(source, "a pid can be inherited, so the port must also be asked to answer").toMatch(/fetch\s*\(/)
    expect(
      /readFileSync\([^)]*\b(flag|reviewing|claim|lock)\b/i.test(source),
      "nothing here should read a flag file somebody has to write or clear",
    ).toBe(false)
  })
})
