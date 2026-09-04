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

/**
 * The draw-time fields a particular `stats()` read is actually used for.
 *
 * Two shapes, because specs write both. A field taken on the spot —
 * `(await …stats()).colours` — is answered by the line itself. A read bound to
 * a name is answered by following that name: `const before = await …stats()`
 * then `before.light` wherever it appears, to the end of the enclosing test.
 *
 * Anything else — a read whose value is passed straight to an assertion, say —
 * reports nothing, which is the safe direction for a check that would otherwise
 * guess.
 */
function fieldsRead(readLine: string, after: readonly string[]): string[] {
  const onTheSpot = DRAW_TIME.filter((field) => new RegExp(`\\)\\s*\\)?\\s*\\.${field}\\b`).test(readLine))
  if (onTheSpot.length > 0) return onTheSpot

  const bound = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/.exec(readLine)?.[1]
  if (bound === undefined) return []

  // To the end of the test this read sits in; a later test cannot see the name.
  const end = after.findIndex((line) => /^(test|test\.describe)\s*[(.]/.test(line))
  const body = after.slice(0, end === -1 ? undefined : end).join("\n")
  const escaped = bound.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return DRAW_TIME.filter((field) => new RegExp(`\\b${escaped}\\.${field}\\b`).test(body))
}

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

      /*
       * **Which fields that read is used for, rather than which appear nearby.**
       *
       * The first version searched the next dozen lines for a draw-time name,
       * which is wrong in both directions and was wrong in both here: it missed
       * a stale read whose field was used further down, and — once the window
       * was widened to compensate — it blamed `portrait`, which only reads
       * `byDepth`, for a `colours` taken from a different `stats()` call later
       * in the same test. Tying the field to the variable removes both.
       */
      const uses = fieldsRead(window[readAt]!, lines.slice(index + 1 + readAt))
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
