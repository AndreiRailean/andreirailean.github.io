import { readdirSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { positionOf, snapToGrid, valueAtPosition, type Track } from "@/experiments/kit/controls"

/**
 * Every numeric setting lives on a grid, whichever way it was reached.
 *
 * The section already quantised, in one place and for one reason: `kit/controls.ts`
 * cut a log track's value to three significant figures because *"without it a
 * snapped value arrives as 0.30000000000000004 and goes into a shared URL that
 * way"*. That was confined to the path running through a slider, so the same
 * scene had two spellings — dragged, it was cut to the grid; arriving from the
 * console API or a query string, it was not.
 *
 * `normalizeSettings` now snaps too, which closes that. These checks are what
 * make it a rule rather than an implementation detail, and they are written
 * across every piece rather than in each piece's own file, because the per-piece
 * version of a section-wide invariant is four pieces nobody checked — the hole
 * #128 came out of.
 *
 * The grid is the control's `step` for a linear track and three significant
 * figures for a log one, with a piece free to declare something finer per
 * setting. `step` is how far an arrow key moves a handle and has never been a
 * claim about which values a setting can hold; three settings in the section
 * were recorded before their control was cut as it is now.
 */

const EXPERIMENTS = "src/experiments"
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

type Settings = Record<string, unknown>

async function settingsModule(slug: string) {
  return (await import(`../../src/experiments/${slug}/settings.ts`)) as {
    DEFAULT_SETTINGS: Settings
    PRESETS: { label: string; settings: Settings }[]
    TRACKS: Partial<Record<string, Track>>
    gridFor: (key: string, value: number) => number
    normalizeSettings: (patch: Partial<Settings>) => Settings
  }
}

/**
 * Whether a value sits exactly where its own setting's grid would put it.
 *
 * Read off the piece's `gridFor` rather than re-derived from the track, because
 * a piece may store a setting finer than its slider steps — and a check that
 * re-derives the rule is a check asserting its own copy of it. That mistake was
 * made here first: this compared against the track's `step` and failed three
 * pieces that were behaving correctly.
 */
const onGrid = (grid: number, value: number) => grid <= 0 || Math.abs(value / grid - Math.round(value / grid)) < 1e-9

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  /**
   * **The literals have to agree with the controls, or nothing else here means
   * anything.**
   *
   * `TRACKS` was derived from `CONTROLS` until #151, which made the whole control
   * list reachable from `normalizeSettings` and therefore from a runner that
   * draws none of it — labels, hints, `format` closures and option lists, 30% of
   * starry-night's bundle. Declaring the numbers instead lets the rest shake
   * out, and buys a way for them to disagree.
   *
   * This is what pays for that. It is the same trade the address registry makes:
   * the thing that must not drift silently gets a check rather than a
   * computation.
   */
  it("declares tracks that match the controls they describe", async () => {
    const { TRACKS, CONTROLS } = (await settingsModule(slug)) as Awaited<ReturnType<typeof settingsModule>> & {
      CONTROLS: {
        kind: string
        key?: string
        keys?: string[]
        min?: number
        max?: number
        step?: number
        scale?: string
      }[]
    }

    const fromControls: Record<string, Track> = {}
    for (const control of CONTROLS) {
      if (typeof control.step !== "number") continue
      for (const key of control.keys ?? (control.key ? [control.key] : [])) {
        fromControls[key] = {
          min: control.min!,
          max: control.max!,
          step: control.step,
          ...(control.scale === "log" ? { scale: "log" as const } : {}),
        }
      }
    }

    expect(
      Object.keys(TRACKS).sort(),
      `${slug}'s TRACKS and its sliders disagree about which settings have a track`,
    ).toEqual(Object.keys(fromControls).sort())

    for (const [key, declared] of Object.entries(TRACKS)) {
      expect(
        declared,
        `${slug}.${key}: the declared track and its control disagree. Update the literal in ` +
          `settings.ts — it is written out on purpose so a runner does not carry the panel's prose.`,
      ).toEqual(fromControls[key])
    }
  })

  it("publishes a track for every setting a slider owns", async () => {
    const { TRACKS } = await settingsModule(slug)
    const tracked = Object.keys(TRACKS)
    expect(tracked.length, `${slug} publishes no TRACKS, so nothing here can check anything`).toBeGreaterThan(0)
  })

  /**
   * The check that would have caught the mistake this change was nearly built
   * on: quantising to each control's `step` rather than to a fitted grid would
   * have taken walkers' `busy.settling` from 0.02 to zero — a setting switched
   * off rather than nudged — and moved two other shipped scenes.
   */
  it("leaves every shipped scene exactly where it was found", async () => {
    const { PRESETS, DEFAULT_SETTINGS, normalizeSettings } = await settingsModule(slug)

    for (const { label, settings } of [{ label: "defaults", settings: DEFAULT_SETTINGS }, ...PRESETS]) {
      const moved = Object.keys(settings).filter(
        (key) => JSON.stringify(normalizeSettings(settings)[key]) !== JSON.stringify(settings[key]),
      )
      expect(
        moved,
        `${slug}'s "${label}" does not survive normalizeSettings: ${moved.join(", ")} moved. A scene ` +
          `recorded before its control was cut as it is now needs its own grid declaring — see ` +
          `FINER_GRID in that piece's settings.ts — rather than being snapped onto the current step.`,
      ).toEqual([])
    }
  })

  /**
   * The route that was not quantised before, which is the whole point.
   *
   * A value arriving from the console API or a query string used to keep
   * whatever precision it came with. Nudging each setting off its grid by a
   * third of a grid step and asking for it back is the direct test of that.
   */
  it("puts a value from outside onto the grid, the way a dragged handle would", async () => {
    const { DEFAULT_SETTINGS, TRACKS, gridFor, normalizeSettings } = await settingsModule(slug)

    for (const [key, track] of Object.entries(TRACKS) as [string, Track][]) {
      const from = Number(DEFAULT_SETTINGS[key])
      if (!Number.isFinite(from)) continue

      // A third of a step up, kept inside the track so the clamp is not what is
      // being measured.
      const nudged = Math.min(track.max, from + track.step / 3)
      const back = Number(normalizeSettings({ [key]: nudged })[key])

      expect(
        onGrid(gridFor(key, back), back),
        `${slug}.${key}: ${nudged} normalised to ${back}, which is off its grid of ${gridFor(key, back)}`,
      ).toBe(true)
    }
  })

  /**
   * The declared grid has to *agree with* the slider, not merely coexist.
   *
   * Without this the two could drift apart silently: a piece could declare a
   * grid its own handle cannot land on, and every drag would then be re-snapped
   * to somewhere the visitor did not put it. Read off `valueAtPosition`, which
   * is what a drag actually produces.
   */
  it("declares a grid its own slider can land on", async () => {
    const { TRACKS, gridFor } = await settingsModule(slug)

    // **A linear track and a log track produce values by different routes, and
    // this has to follow both.** A log row holds a *position* and asks
    // `valueAtPosition` for the value, which snaps. A linear row is an
    // `<input type=range>` with its own `step`, so the element produces
    // `min + n * step` and `valueAtPosition` is never called for it — asserting
    // on that function for a linear track measures a path no drag takes, which
    // is what this test did first and why it failed every piece.
    for (const [key, track] of Object.entries(TRACKS) as [string, Track][]) {
      if (track.scale === "log") {
        for (const position of [0, 0.137, 0.5, 0.618, 1]) {
          const dragged = valueAtPosition(track, position)
          expect(
            onGrid(gridFor(key, dragged), dragged),
            `${slug}.${key}: dragging to ${dragged} lands off the declared grid of ${gridFor(key, dragged)}`,
          ).toBe(true)
        }
        continue
      }

      // Everything the element can emit is on the grid exactly when the grid
      // divides the step and the track starts on it.
      const grid = gridFor(key, track.min)
      expect(onGrid(grid, track.min), `${slug}.${key}: the track starts at ${track.min}, off its own grid`).toBe(true)
      expect(
        Math.abs(track.step / grid - Math.round(track.step / grid)) < 1e-9,
        `${slug}.${key}: a step of ${track.step} is not a whole number of ${grid} grid units, so a ` +
          `dragged handle would be re-snapped somewhere the visitor did not put it.`,
      ).toBe(true)
    }
  })

  /** Snapping twice must not move anything the first pass already placed. */
  it("is idempotent, so a scene does not creep by being read", async () => {
    const { PRESETS, normalizeSettings } = await settingsModule(slug)
    for (const { label, settings } of PRESETS) {
      const once = normalizeSettings(settings)
      expect(normalizeSettings(once), `${slug}'s "${label}" moves on a second normalise`).toEqual(once)
    }
  })
})

/**
 * The kit's own rule, against cases no piece happens to contain.
 *
 * `positionOf` is imported to keep this honest about what a track is: these are
 * the same objects the sliders are built from, not a shape invented here.
 */
describe("the grid rule itself", () => {
  const linear: Track = { min: 0, max: 1, step: 0.05 }
  const log: Track = { min: 0.15, max: 40, step: 0.01, scale: "log" }

  it("cuts a linear track at its step", () => {
    expect(snapToGrid(linear, 0.22)).toBe(0.2)
    expect(snapToGrid(linear, 0.02)).toBe(0)
  })

  it("cuts a log track by magnitude, with its step as the floor", () => {
    // The whole reason a log track needs its own rule: this track wants
    // hundredths at the bottom and tenths near the top, and one uniform step
    // cannot give both. `step` is the floor, so 0.157 is not reachable here —
    // that is the rule working, not failing. This test asserted 0.157 first.
    expect(snapToGrid(log, 0.15734)).toBe(0.16)
    expect(snapToGrid(log, 37.418)).toBe(37.4)
    // Drop the floor and the fine end opens up.
    expect(snapToGrid({ ...log, step: 0.0001 }, 0.15734)).toBe(0.157)
  })

  it("honours a finer grid where a piece declares one", () => {
    expect(snapToGrid(linear, 0.02)).toBe(0)
    expect(snapToGrid(linear, 0.02, 0.01)).toBe(0.02)
  })

  it("never coarsens past the track's own step", () => {
    // `finer` may only refine. A piece cannot use it to store less than its
    // slider can express.
    expect(snapToGrid(linear, 0.15, 0.5)).toBe(0.15)
  })

  it("leaves a non-finite value alone rather than turning it into NaN arithmetic", () => {
    expect(snapToGrid(linear, Number.NaN)).toBeNaN()
  })

  it("agrees with the slider at every position on a log track", () => {
    for (const position of [0, 0.25, 0.5, 0.75, 1]) {
      const value = valueAtPosition(log, position)
      expect(snapToGrid(log, value)).toBe(value)
      expect(positionOf(log, value)).toBeGreaterThanOrEqual(0)
    }
  })
})
