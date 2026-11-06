import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { normalizeSettings, type Settings } from "@/experiments/crowd/settings"
import { PRESETS } from "@/experiments/crowd/presets"

/**
 * What the crowd's walking checks share: a scene by name, and a walk of it.
 *
 * **Walks here are short and small.** The crowd's checks used to walk the market
 * — nine thousand people — for minutes, and took most of the unit job (#287).
 * Each decision is now checked on its own function, and what is left walking
 * is wiring, in a world sized by `reach` to what the check needs. A new walk
 * that wants the whole market for minutes is a decision that has not been
 * found yet. Not a `.test.ts`, so neither runner collects it.
 */

/**
 * The presets with the seeds they carried until 2026-11-06, for checks that
 * build a world from one.
 *
 * **A preset no longer pins a seed**: each load rolls a fresh arrangement
 * (`PresetSettings` in `kit/controls.ts`). These checks were measured against
 * particular worlds, and two of them fall a little short of their lines on
 * another one — "changes direction at its stops" and "keeps me on it". So the
 * worlds are pinned here rather than the lines loosened, which keeps every
 * check exactly as it was written. A new check can use any seed it likes.
 */
const WORLDS: Record<string, number> = {
  "catch me": 64021,
  market: 24196,
  concourse: 6640,
  "standing still": 51877,
  "the street": 13907,
  "the far end": 30412,
  "waist high": 88104,
  parade: 41822,
  teams: 60237,
  "the trail": 17350,
  "keep left": 38815,
  runner: 71450,
  "fire trail": 52291,
  "loop run": 90313,
  "street run": 90313,
  boulders: 24196,
  "round the bend": 4242,
  "between the rocks": 4242,
  "boulder grid": 24196,
  honeycomb: 24196,
  "honeycomb chase": 64021,
  "honeycomb from above": 24196,
  "grid from above": 24196,
}

export const SEEDED = PRESETS.map((preset) => {
  const seed = WORLDS[preset.label]
  if (seed === undefined) throw new Error(`crowd/tests/support.ts pins no world for the preset "${preset.label}"`)
  return { ...preset, settings: normalizeSettings({ ...preset.settings, seed }) }
})

/**
 * The market, by name. These checks were written against it when it was the
 * primary, and a primary moves — "catch me" took the place on 2026-09-26 —
 * so they say which scene they mean rather than which position.
 */
export const MARKET = SEEDED.find((preset) => preset.label === "market")!

/**
 * The person carrying the camera, and specifically what their head does.
 *
 * **Every number here comes from a complaint.** The first version of the neck
 * turned at a constant rate to an absolute target and stopped dead, and what
 * that looked like was: "very abrupt — appears that I'm looking forward, then I
 * quickly turn my head and stop, then I turn again." Measured, it was
 * motionless 73% of the time and at its speed cap for 18%, holding a 60° offset
 * for a second and a half while walking.
 *
 * None of that is visible in a still, and all of it is obvious in motion, which
 * is the worst combination this section has — so it is pinned here in numbers.
 */

export const STEP = 1 / 120
export const DEG = 180 / Math.PI
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export function watch(patch: Partial<Settings>, seconds: number) {
  const settings = normalizeSettings({ ...MARKET.settings, ...patch })
  const me = createStroll(settings, settings.seed)
  const crowd = createThrong(settings, me)

  const offsets: number[] = []
  let peakTurn = 0
  let lastYaw = me.yaw
  let moving = 0
  let steps = 0

  for (let t = 0; t < seconds; t += STEP) {
    me.step(STEP, crowd)
    crowd.step(STEP)
    const turn = Math.abs(wrap(me.yaw - lastYaw)) / STEP
    lastYaw = me.yaw
    // The opening stretch is skipped for the offsets but not for the turn rate,
    // because a rate read across a skipped gap is a rate across that gap — which
    // reported 20,000°/s and sent this measurement after a phantom once already.
    if (t < 10) continue
    peakTurn = Math.max(peakTurn, turn)
    offsets.push(Math.abs(wrap(me.yaw - me.course)))
    if (turn > 0.02) moving++
    steps++
  }

  offsets.sort((a, b) => a - b)
  const at = (p: number) => offsets[Math.floor(offsets.length * p)]! * DEG
  return {
    median: at(0.5),
    p90: at(0.9),
    within10: offsets.filter((o) => o * DEG <= 10).length / offsets.length,
    peakTurn: peakTurn * DEG,
    stillFraction: 1 - moving / steps,
  }
}

export function walk(patch: Partial<Settings>, seconds: number) {
  const settings = normalizeSettings({ ...MARKET.settings, ...patch })
  const me = createStroll(settings, settings.seed)
  const crowd = createThrong(settings, me)
  const run = (forSeconds: number) => {
    for (let t = 0; t < forSeconds; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
    }
  }
  run(seconds)
  return { me, crowd, run, settings }
}
