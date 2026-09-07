import { readdirSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { reportControls, type ControlReport } from "@/experiments/kit/api"
import type { Control } from "@/experiments/kit/controls"

/**
 * **A control reports the bound it has, and nothing where it has none.**
 *
 * `controls()` is a cross-piece contract — `tests/kit.spec.ts` holds all five
 * pieces to it — and until #130 its *shape* lived nowhere, as five hand-written
 * records. It produced the same class of fault three times:
 *
 * - **#85**: three shapes, no stated contract, and generic code reading `.key`
 *   off a range entry got `undefined`, wrote its patch to a setting no piece
 *   has, and passed because nothing had moved.
 * - **#127**: a `default:` branch reading `control.min` off a control with no
 *   `min`, so the field was present-and-`undefined` and every consumer's
 *   arithmetic came out `NaN`.
 * - **#130**: Psyxels' flat type *required* `min` and `max`, so its `glyphs`
 *   set — whose value is a list of five glyph names — reported `min: 0,
 *   max: 0`. That is what this file is named for.
 *
 * ### Why this is a unit check and not a tighter assertion in `kit.spec.ts`
 *
 * `kit.spec.ts` asserts the narrow thing it can: a bound that is reported must
 * be a number. Its own docblock says why that could not reach #130 — a piece
 * forced to fill the field can put a *plausible* number in it, and `0` is a
 * perfectly good number. The fault is not a bad value but a **field that should
 * not be there at all**, so the assertion has to be about presence.
 *
 * That assertion needs no browser. `reportControls` is a pure function of a
 * control list, so this runs in milliseconds against every piece's real
 * `CONTROLS` — and a piece adding a trackless row learns about it from
 * `pnpm run test:unit` rather than from an eight-minute browser job.
 *
 * ### What it is not
 *
 * It is not a claim that a piece must use `reportControls`. The kit is offered:
 * a piece may build its own report and say why in a `kit-opt-out:` line, and
 * `kit.spec.ts` is what holds whatever it actually returns at runtime. This
 * checks the shared mapping and the control lists it is given — which is where
 * all three faults above were, and where the next one would be.
 */

const EXPERIMENTS = "src/experiments"

/** Not pieces: shared code, and the section's own docs. */
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

/**
 * The kinds that own a track, which is where a bound may come from.
 *
 * Written out rather than inferred from whether `min` happens to be present,
 * because the whole question is which kinds *should* have it. A check that reads
 * the answer off the thing under test asserts nothing.
 */
const TRACKED = new Set(["slider", "range"])
const OPTIONED = new Set(["choice", "set"])

async function controlsOf(slug: string): Promise<Control<string>[]> {
  const module = (await import(`../../src/experiments/${slug}/settings.ts`)) as {
    CONTROLS: Control<string>[]
  }
  return module.CONTROLS
}

const has = (entry: ControlReport, field: string) => field in entry

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  it("reports a bound only for a control that has a track", async () => {
    const report = reportControls(await controlsOf(slug))
    expect(report.length, `${slug} reports no controls`).toBeGreaterThan(0)

    const wrong = report.filter(
      (entry) => has(entry, "min") !== TRACKED.has(entry.kind) || has(entry, "max") !== TRACKED.has(entry.kind),
    )

    expect(
      wrong.map((entry) => JSON.stringify(entry)),
      `${slug}: a control with no track must not report \`min\` or \`max\`, and one with a track ` +
        `must report both. Psyxels' \`glyphs\` set reported \`min: 0, max: 0\` for a setting whose ` +
        `value is a list of names — a valid number and no information, which is why no tightening ` +
        `of kit.spec.ts's "a bound has to be a number" could reach it. See #130.`,
    ).toEqual([])
  })

  it("reports an options list only for a control that has options", async () => {
    const report = reportControls(await controlsOf(slug))

    const wrong = report.filter((entry) => has(entry, "options") !== OPTIONED.has(entry.kind))

    expect(
      wrong.map((entry) => JSON.stringify(entry)),
      `${slug}: a choice or set must report its \`options\`, and nothing else may. It is the ` +
        `counterpart of the bound: a sweep that cannot see the legal values writes a number into ` +
        `a setting the validator rejects, and passes having moved nothing.`,
    ).toEqual([])
  })

  it("reports a real key for every entry, including both ends of a range", async () => {
    const controls = await controlsOf(slug)
    const report = reportControls(controls)

    // One entry per settings **key**, so a range contributes two. #85 was a
    // piece mapping `control.key` straight through: a range carries `keys` and
    // no `key`, and the entry reported `undefined` for it.
    const keys = controls.flatMap((control) => (control.kind === "range" ? control.keys : [control.key]))
    expect(report.map((entry) => entry.key)).toEqual(keys)

    const nameless = report.filter((entry) => typeof entry.key !== "string" || entry.key.length === 0)
    expect(nameless.map((entry) => JSON.stringify(entry))).toEqual([])
  })

  it("never reports a field as present-and-undefined", async () => {
    const report = reportControls(await controlsOf(slug))

    // The signature of #127, and the reason `group` is spread in conditionally
    // rather than written as `group: control.group`. A present key holding
    // `undefined` types as a value and behaves as an absence, which is the
    // combination nothing catches: `"min" in entry` says yes and the arithmetic
    // says `NaN`.
    const undef = report.flatMap((entry) =>
      Object.entries(entry)
        .filter(([, value]) => value === undefined)
        .map(([field]) => `${entry.key}.${field}`),
    )

    expect(undef).toEqual([])
  })
})
