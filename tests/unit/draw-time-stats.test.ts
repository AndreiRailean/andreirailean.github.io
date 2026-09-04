import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * **A `stats()` read straight after a `set()` gets the previous frame.**
 *
 * `set()` marks the scene dirty and asks for one animation frame; it does not
 * draw. So any field a piece accumulates *while drawing* is still the last
 * frame's until that frame runs, and it comes back as an ordinary plausible
 * number rather than as an obviously old one. `tests/AGENTS.md` has the rule and
 * what it cost.
 *
 * This check exists because the rule kept being broken **in the file that
 * documents it**. Three instances now:
 *
 * - #65, flotsam's exposure spec, which passed locally and on three CI runs
 *   before failing the fourth and took two sessions and three disproved
 *   hypotheses;
 * - #107, flotsam's `transport`, where a frame wait was not even enough because
 *   the field is written during integration rather than during draw;
 * - "the size mix thins the large pieces", which was written without the fix its
 *   own neighbour had already received and passed for weeks on luck, then failed
 *   CI on a documentation-only pull request.
 *
 * All three share a signature worth knowing: the changed reading comes back
 * **equal to the unchanged one**, because the scenes worth taking a reading on
 * are the still ones, and a stale frame on a still scene is byte-identical.
 *
 * **Text, not types.** What is wanted is "did the author put a wait between
 * these two lines", which is a question about the spec as written. The same
 * reasoning as `kit-adoption.test.ts`, and the same escape hatch: a read that
 * genuinely needs no frame says so on the spot.
 */

const SPECS = "tests"

/** Fields a piece fills in while drawing. Reading one without a frame is the bug. */
const DRAW_TIME = ["light", "fillPx", "drawnDots", "dimmedDots", "drawn", "fill", "colours", "drawMs", "fps"]

/**
 * What counts as having waited.
 *
 * `painted()` is the frame wait. `run()` and `settle()` are better where a piece
 * offers them, because they draw synchronously rather than racing whichever
 * animation frame comes next — and `run()` is the only answer for a field
 * written during integration, which no frame wait fixes (#107).
 */
const WAITED = /\b(painted\s*\(|api\.run\s*\(|api\.settle\s*\(|\.run\s*\(|\.settle\s*\()/

const OPT_OUT = "stale-ok:"

const specs = readdirSync(SPECS).filter((name) => name.endsWith(".spec.ts"))

it("finds the browser specs, so an empty run cannot pass for a clean one", () => {
  expect(specs.length).toBeGreaterThan(0)
})

describe.each(specs)("%s", (file) => {
  const source = readFileSync(`${SPECS}/${file}`, "utf8")
  const lines = source.split("\n")

  it("waits for a frame between a set() and a draw-time stat", () => {
    const offences: string[] = []

    lines.forEach((line, index) => {
      if (!/api\.set\s*\(/.test(line)) return

      // Everything up to the next `set()`, which is where this read would be.
      const rest = lines.slice(index + 1, index + 12)
      const stop = rest.findIndex((next) => /api\.set\s*\(/.test(next))
      const window = rest.slice(0, stop === -1 ? undefined : stop)

      const readAt = window.findIndex((next) => /\bapi\.stats\s*\(/.test(next))
      if (readAt === -1) return

      const between = window.slice(0, readAt + 1).join("\n")
      if (WAITED.test(between) || between.includes(OPT_OUT)) return

      // Only a *draw-time* field matters. A count computed inside `stats()` is
      // fine to read immediately, which is why psyxels added `live`.
      const uses = DRAW_TIME.filter((field) => new RegExp(`\\.${field}\\b`).test(window.join("\n")))
      if (uses.length === 0) return

      offences.push(`${file}:${index + 1} reads ${uses.join(", ")} after a set() with no frame between`)
    })

    expect(
      offences,
      `${offences.join("; ")}. Those fields are summed while drawing, so this reads the previous ` +
        `frame — and on a still scene it comes back identical rather than obviously old. Add ` +
        `\`await painted(page)\`, or prefer the piece's own \`run()\`, or say why not with a ` +
        `"${OPT_OUT} <reason>" comment.`,
    ).toEqual([])
  })
})
