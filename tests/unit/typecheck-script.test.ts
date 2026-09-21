import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Whether the command named `typecheck` actually types everything.
 *
 * **It did not, for a long time, and the name is what made that expensive.**
 * `pnpm run typecheck` was `tsc --noEmit`, which does not type `.astro` files
 * at all — so the script a person reaches for by habit, and the CI step headed
 * "Typecheck all code", both passed cleanly on a type error in a page. That is
 * the shape the root `AGENTS.md` lists first: a check that cannot see what it
 * is meant to check, wearing a reassuring name.
 *
 * Measured by injecting one error in each of four places. `tsc` exited 0 on an
 * `.astro` frontmatter error and 2 on the other three; `astro check` exited 1
 * on all four. So it is a strict superset here, and the swap lost nothing —
 * `tests/AGENTS.md` carries the table.
 *
 * **Why a test and not a note.** The old value is the one somebody will reach
 * for again: `tsc --noEmit` is what every other repo uses, it is seven seconds
 * faster, and reverting to it produces no failure anywhere — the build's own
 * `astro check` would still cover CI, so only the fast feedback a person
 * actually uses would go quietly blind. Nothing about that reads as a
 * regression, which is exactly why it needs a check rather than a memory.
 */

const scripts = (): Record<string, string> =>
  (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts

describe("the typecheck script types what its name claims", () => {
  it("exists at all, so the assertions below cannot pass by vacuity", () => {
    expect(scripts().typecheck, "package.json has no `typecheck` script").toBeDefined()
  })

  it("runs astro check, which is the only thing here that types .astro files", () => {
    expect(
      scripts().typecheck,
      "`pnpm run typecheck` must run `astro check`. `tsc --noEmit` does not type `.astro` files, " +
        "so a type error in a page passes it — verified, exit 0 — while the script and the CI step " +
        "named after typechecking both report success. See tests/AGENTS.md and #209.",
    ).toContain("astro check")
  })

  it("is what CI's typecheck step runs, so the two cannot drift apart", () => {
    const workflow = readFileSync(".github/workflows/lint.yml", "utf8")

    // Guard the guard: if the step is renamed or removed, matching nothing
    // would leave this file asserting a property of a workflow that no longer
    // has it — the vacuous case, not a pass.
    expect(
      workflow.includes("pnpm run typecheck"),
      "lint.yml no longer runs `pnpm run typecheck`, so fixing that script no longer fixes CI",
    ).toBe(true)
  })
})
