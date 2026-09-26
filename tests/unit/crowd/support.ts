import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { normalizeSettings, PRESETS, type Settings } from "@/experiments/crowd/settings"

/**
 * What the crowd's long unit checks share, so they can live in several files.
 *
 * **Several files because vitest runs one file on one worker, start to finish.**
 * `stroll.test.ts` and `throng.test.ts` were a single file each and between
 * them took most of the unit job's wall clock, however many workers the runner
 * had — see "Why the crowd's checks are split" in `tests/AGENTS.md`. Not a
 * `.test.ts`, so neither runner collects it.
 */

/**
 * The market, by name. These checks were written against it when it was the
 * primary, and a primary moves — "catch me" took the place on 2026-09-26 —
 * so they say which scene they mean rather than which position.
 */
export const MARKET = PRESETS.find((preset) => preset.label === "market")!

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

/**
 * Milliseconds, on every test here that simulates.
 *
 * **Not because they are slow — because this box is shared.** Each of these runs
 * in ten to twenty-five seconds alone and the suite's default allowance is
 * thirty, so under a full run against other sessions' work they sit either side
 * of the line and fail on whichever one happens to be unlucky. That is
 * flakiness, and it read as a failing check twice before it read as a slow one.
 * `tests/AGENTS.md` has the numbers on how far a single timing moves here.
 */
export const PATIENT = 180_000

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

/** Where everybody is relative to the observer's own line of travel. */
export function relative(crowd: ReturnType<typeof createThrong>, me: ReturnType<typeof createStroll>) {
  const cos = Math.cos(me.course)
  const sin = Math.sin(me.course)
  return crowd.people.map((person) => {
    const dx = person.x - me.x
    const dy = person.y - me.y
    return { ahead: dx * cos + dy * sin, beside: dx * sin - dy * cos, person }
  })
}
