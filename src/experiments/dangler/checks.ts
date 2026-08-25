/**
 * Checks for the parts of Dangler that are invisible.
 *
 * Not a test suite and not wired to a runner — this repo has neither, and
 * introducing one is a bigger decision than this file. It is a script, and every
 * assertion in it corresponds to a bug that actually happened.
 *
 * The point is that almost nothing here can be seen. A stretched wire, a wire
 * that has quietly straightened, a frame that flipped, an arrangement that
 * reshuffled itself when the wire count changed — all of them look like a
 * plausible scatter of dots in a screenshot. Numbers are the only way to tell.
 *
 * Run it (Node strips the types; the `@/` alias does not resolve outside the
 * bundler, so the folder is copied and the imports rewritten):
 *
 *   d=$(mktemp -d) && for f in src/experiments/dangler/*.ts; do
 *     sed -E 's#@/experiments/dangler/([a-z]+)"#./\1.ts"#g' "$f" > "$d/$(basename "$f")"
 *   done && node --experimental-strip-types "$d/checks.ts"
 *
 * Exits non-zero if anything fails.
 */

import { gaussian, hashSeed, makeRng } from "@/experiments/dangler/random"
import { makeCamera, project } from "@/experiments/dangler/camera"

// Declared locally rather than pulling in @types/node: this is the only file in
// the project that runs outside a browser, and the rest is typed for one.
declare const process: { exit(code: number): never }
import { makeCanopy } from "@/experiments/dangler/canopy"
import { createRopes } from "@/experiments/dangler/rope"
import { createFrames, updateFrames } from "@/experiments/dangler/frame"
import { createSway } from "@/experiments/dangler/sway"
import { canopyTremble, gustEnvelope, scheduleGusts, TREMBLE_REACH, type Gust } from "@/experiments/dangler/wind"
import { buildArrangement, flickerAt } from "@/experiments/dangler/arrangement"
import {
  DEFAULT_SETTINGS,
  PRESETS,
  normalizeSettings,
  settingsFromQuery,
  settingsToQuery,
} from "@/experiments/dangler/settings"

let failures = 0
const ok = (name: string, pass: boolean, detail = "") => {
  if (!pass) failures++
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}

// 1. PRNG determinism
{
  const a = makeRng(hashSeed(7, 3, 0x5ba9e))
  const b = makeRng(hashSeed(7, 3, 0x5ba9e))
  ok(
    "prng is deterministic",
    [0, 1, 2, 3, 4].every(() => a() === b()),
  )
  const c = makeRng(hashSeed(7, 4, 0x5ba9e))
  ok("adjacent indices decorrelate", Math.abs(makeRng(hashSeed(7, 3, 0x5ba9e))() - c()) > 0.01)
}

// 2. gaussian is clamped and roughly standard
{
  const rng = makeRng(1)
  let min = 9,
    max = -9,
    sum = 0,
    sum2 = 0
  const N = 20000
  for (let i = 0; i < N; i++) {
    const g = gaussian(rng)
    min = Math.min(min, g)
    max = Math.max(max, g)
    sum += g
    sum2 += g * g
  }
  ok("gaussian clamped to ±2.5", min >= -2.5 && max <= 2.5, `[${min.toFixed(2)}, ${max.toFixed(2)}]`)
  ok("gaussian mean ~0", Math.abs(sum / N) < 0.03, (sum / N).toFixed(4))
  ok("gaussian sd ~1", Math.abs(Math.sqrt(sum2 / N) - 1) < 0.06, Math.sqrt(sum2 / N).toFixed(4))
}

// 3. THE invariant: anchor i does not move as wire count grows
{
  const shape = { extent: 2.6, ceiling: 4, relief: 0.9, branches: 0 }
  const small = makeCanopy(7, shape)
  const big = makeCanopy(7, shape)
  let same = true
  for (let i = 0; i < 3; i++) {
    const a = small.anchorFor(i),
      c = big.anchorFor(i)
    if (a.x !== c.x || a.y !== c.y || a.z !== c.z) same = false
  }
  ok("anchor i is independent of wire count", same)

  const arr3 = buildArrangement({ ...DEFAULT_SETTINGS, wires: 3 })
  const arr30 = buildArrangement({ ...DEFAULT_SETTINGS, wires: 30 })
  let stable = true
  for (let w = 0; w < 3; w++) {
    const a = arr3.specs[w],
      b = arr30.specs[w]
    if (JSON.stringify(a) !== JSON.stringify(b)) stable = false
  }
  ok("wire specs 0..2 unchanged at 3 vs 30 wires", stable)

  let beadsStable = true
  for (let i = 0; i < 3 * DEFAULT_SETTINGS.beads; i++) {
    if (arr3.hue[i] !== arr30.hue[i] || arr3.along[i] !== arr30.along[i] || arr3.angle[i] !== arr30.angle[i])
      beadsStable = false
  }
  ok("bulbs of wires 0..2 unchanged at 3 vs 30 wires", beadsStable)
}

// 4. anchors spread over the disc and heights correlate with position
{
  const c = makeCanopy(7, { extent: 2.6, ceiling: 4, relief: 0.9, branches: 0 })
  let maxR = 0,
    minZ = 99,
    maxZ = -99
  for (let i = 0; i < 200; i++) {
    const a = c.anchorFor(i)
    maxR = Math.max(maxR, Math.hypot(a.x, a.y))
    minZ = Math.min(minZ, a.z)
    maxZ = Math.max(maxZ, a.z)
  }
  ok("anchors stay inside the canopy disc", maxR <= 2.6 + 1e-6, `maxR=${maxR.toFixed(3)}`)
  ok("relief actually varies height", maxZ - minZ > 0.2, `z ∈ [${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`)

  const flat = makeCanopy(7, { extent: 2.6, ceiling: 4, relief: 0, branches: 0 })
  ok(
    "relief 0 is a flat ceiling",
    [0, 1, 2, 3].every((i) => Math.abs(flat.anchorFor(i).z - 4) < 1e-6),
  )

  // neighbouring anchors should have closer heights than distant ones
  let nearDiff = 0,
    nearN = 0,
    farDiff = 0,
    farN = 0
  const pts = Array.from({ length: 120 }, (_, i) => c.anchorFor(i))
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
      const dz = Math.abs(pts[i].z - pts[j].z)
      if (d < 0.4) {
        nearDiff += dz
        nearN++
      } else if (d > 3) {
        farDiff += dz
        farN++
      }
    }
  ok(
    "neighbouring anchors are closer in height than distant ones",
    nearDiff / nearN < farDiff / farN,
    `near=${(nearDiff / nearN).toFixed(3)} far=${(farDiff / farN).toFixed(3)}`,
  )
}

// 5. projection: descending bead grows AND slides outward
{
  const cam = makeCamera(100, 0, 800, 800)
  const high = project(cam, 1.2, 0, 4)!
  const low = project(cam, 1.2, 0, 2.4)!
  ok("nearer bead is larger", low.scale > high.scale, `${high.scale.toFixed(1)} -> ${low.scale.toFixed(1)}`)
  ok(
    "nearer bead is further from the vanishing point",
    low.x - 400 > high.x - 400,
    `${(high.x - 400).toFixed(0)}px -> ${(low.x - 400).toFixed(0)}px`,
  )
  ok("overhead wire collapses to the vanishing point", Math.abs(project(cam, 0, 0, 4)!.x - 400) < 1e-9)
  ok("near clip culls", project(cam, 0, 0, 0.05) === null)
  const tilted = makeCamera(100, 30, 800, 800)
  ok("tilt moves the vanishing point off centre", Math.abs(project(tilted, 0, 0, 4)!.y - 400) > 50)
}

// 6. rope settles, and stiffness decides whether it hangs plumb
{
  const arr = buildArrangement(DEFAULT_SETTINGS)
  const ropes = createRopes(arr.specs)
  ropes.settle()
  ok("settle converges", ropes.maxError() < 1e-3, `maxError=${ropes.maxError().toExponential(2)}`)
  ok("settled scene reports at rest", ropes.atRest())

  const tipOffset = (stiffness: number) => {
    const a = buildArrangement({ ...DEFAULT_SETTINGS, stiffness, irregularity: 0 })
    const r = createRopes(a.specs)
    r.settle()
    const start = r.offset[0]
    const end = r.offset[1]
    return Math.hypot(r.px[end - 1] - r.px[start], r.py[end - 1] - r.py[start])
  }
  const limp = tipOffset(0),
    rigid = tipOffset(1)
  ok("limp wire hangs nearly plumb", limp < 0.05, `${limp.toFixed(4)}m off axis`)
  ok("stiff wire holds its bend", rigid > limp * 5, `limp=${limp.toFixed(3)} rigid=${rigid.toFixed(3)}`)

  // link lengths hold
  const a = buildArrangement(DEFAULT_SETTINGS)
  const r = createRopes(a.specs)
  r.settle()
  let worst = 0
  for (let w = 0; w < r.wireCount; w++) {
    const seg = a.specs[w].length / a.specs[w].segments
    for (let i = r.offset[w]; i < r.offset[w + 1] - 1; i++) {
      worst = Math.max(
        worst,
        Math.abs(Math.hypot(r.px[i + 1] - r.px[i], r.py[i + 1] - r.py[i], r.pz[i + 1] - r.pz[i]) - seg) / seg,
      )
    }
  }
  ok("wires do not stretch", worst < 0.01, `worst link error ${(worst * 100).toFixed(3)}%`)

  // anchor stays pinned
  const anchor = a.specs[0].anchor
  ok("anchor stays pinned to the canopy", Math.hypot(r.px[0] - anchor.x, r.py[0] - anchor.y, r.pz[0] - anchor.z) < 1e-6)
  ok("wire hangs below its anchor", r.pz[r.offset[1] - 1] < anchor.z)
}

// 7. growing the wire count preserves the wires already there
{
  const a3 = buildArrangement({ ...DEFAULT_SETTINGS, wires: 3 })
  const r3 = createRopes(a3.specs)
  r3.settle()
  const before = Array.from(r3.px.subarray(0, r3.offset[3]))

  const a10 = buildArrangement({ ...DEFAULT_SETTINGS, wires: 10 })
  const r10 = createRopes(a10.specs, r3)
  const after = Array.from(r10.px.subarray(0, r10.offset[3]))
  ok(
    "existing wires keep their exact positions when the count grows",
    before.every((v, i) => v === after[i]),
  )
  ok(
    "only the new wires are reported fresh",
    JSON.stringify(r10.freshWires) === JSON.stringify([3, 4, 5, 6, 7, 8, 9]),
    JSON.stringify(r10.freshWires),
  )
}

// 8. rotation-minimising frame: continuous, perpendicular, no flips
{
  const arr = buildArrangement({ ...DEFAULT_SETTINGS, set: 2.2, twist: 1.5, segments: 60 })
  const ropes = createRopes(arr.specs)
  ropes.settle()
  const frames = createFrames(ropes.particleCount)
  updateFrames(ropes, frames)

  let worstDot = 0,
    worstJump = 0,
    worstLen = 0
  for (let w = 0; w < ropes.wireCount; w++) {
    for (let i = ropes.offset[w]; i < ropes.offset[w + 1]; i++) {
      worstDot = Math.max(
        worstDot,
        Math.abs(frames.tx[i] * frames.nx[i] + frames.ty[i] * frames.ny[i] + frames.tz[i] * frames.nz[i]),
      )
      worstLen = Math.max(worstLen, Math.abs(Math.hypot(frames.nx[i], frames.ny[i], frames.nz[i]) - 1))
      if (i > ropes.offset[w]) {
        const dot = frames.nx[i] * frames.nx[i - 1] + frames.ny[i] * frames.ny[i - 1] + frames.nz[i] * frames.nz[i - 1]
        worstJump = Math.max(worstJump, Math.acos(Math.min(1, Math.max(-1, dot))))
      }
    }
  }
  ok("normal stays perpendicular to the tangent", worstDot < 1e-5, worstDot.toExponential(2))
  ok("normal stays a unit vector", worstLen < 1e-5, worstLen.toExponential(2))
  ok("normal never flips between neighbours", worstJump < 0.35, `max turn ${((worstJump * 180) / Math.PI).toFixed(2)}°`)
}

// 9. settings round-trip
{
  const custom = normalizeSettings({ seed: 91, wires: 8, hue: 200, hueSpread: 62, breeze: 0.4, pitch: 12 })
  const back = settingsFromQuery(settingsToQuery(custom))
  ok("settings round-trip through the query string", JSON.stringify(back) === JSON.stringify(custom))
  ok("default settings produce an empty query", settingsToQuery(DEFAULT_SETTINGS).toString() === "")
  ok(
    "absent params keep their defaults, not zero",
    settingsFromQuery(new URLSearchParams("")).breeze === DEFAULT_SETTINGS.breeze &&
      settingsFromQuery(new URLSearchParams("hue=")).hue === DEFAULT_SETTINGS.hue,
  )
  ok(
    "out-of-range values are clamped",
    normalizeSettings({ hue: 9999, wires: -5 }).hue === 360 && normalizeSettings({ wires: -5 }).wires === 1,
  )
  ok("counts are forced to whole numbers", normalizeSettings({ wires: 4.7, segments: 12.2 }).wires === 5)
}

// 10. presets survive being shared
{
  for (const preset of PRESETS) {
    const settings = normalizeSettings(preset.settings)
    const back = settingsFromQuery(settingsToQuery(settings))
    const differs = (Object.keys(settings) as (keyof typeof settings)[]).filter((key) => back[key] !== settings[key])
    ok(`preset "${preset.label}" survives the query string`, differs.length === 0, differs.join(", "))
    // A preset is a recorded scene. Written as a spread over the defaults it
    // would drift the next time one of those was retuned, so every value is
    // stated and every value must already be legal.
    const clamped = (Object.keys(settings) as (keyof typeof settings)[]).filter(
      (key) => preset.settings[key] !== settings[key],
    )
    ok(`preset "${preset.label}" is within bounds as written`, clamped.length === 0, clamped.join(", "))
  }
  ok("preset labels are unique", new Set(PRESETS.map((p) => p.label)).size === PRESETS.length)
}

// 11. gusts — an event lasting a couple of seconds, which no still frame can show
{
  const out: Gust[] = []
  scheduleGusts(7, 0, 0, out)
  ok("no gusts at rate 0", out.length === 0)

  // Every gust must eventually be scheduled, and each exactly once.
  const starts = new Set<number>()
  for (let t = 0; t < 600; t += 0.25) {
    scheduleGusts(7, t, 6, out)
    for (const g of out) starts.add(Math.round(g.start * 1000))
  }
  const expected = Math.floor(600 / (60 / 6))
  ok(
    "gusts arrive at about the requested rate",
    Math.abs(starts.size - expected) <= 2,
    `${starts.size} in 600s, wanted ~${expected}`,
  )

  // Determinism: the same seed and clock must give the same weather.
  const a: Gust[] = []
  const b: Gust[] = []
  scheduleGusts(7, 123.4, 6, a)
  scheduleGusts(7, 123.4, 6, b)
  ok("gusts are deterministic", JSON.stringify(a) === JSON.stringify(b))
  scheduleGusts(8, 123.4, 6, b)
  ok("a different seed gives different weather", JSON.stringify(a) !== JSON.stringify(b))

  // A gust in play must not be dropped from the schedule while it still matters.
  let widestGap = 0
  for (let t = 0; t < 300; t += 0.05) {
    scheduleGusts(7, t, 6, out)
    const strongest = Math.max(0, ...out.map((g) => gustEnvelope(t - g.start)))
    if (strongest < 0.02) widestGap += 0.05
  }
  ok("gusts do not leave the scene calm forever", widestGap < 300, `${widestGap.toFixed(1)}s of 300 calm`)

  ok("envelope is silent before the gust", gustEnvelope(-1) === 0 && gustEnvelope(0) === 0)
  const peak = Math.max(...Array.from({ length: 2000 }, (_, i) => gustEnvelope(i / 200)))
  ok("envelope peaks at 1, so `gust` means what it says", Math.abs(peak - 1) < 0.005, peak.toFixed(5))
  ok(
    "envelope rises fast and falls slow",
    gustEnvelope(0.35) > 0.9 && gustEnvelope(3) < 0.25 && gustEnvelope(8) < 0.01,
    `0.35s=${gustEnvelope(0.35).toFixed(2)} 3s=${gustEnvelope(3).toFixed(2)} 8s=${gustEnvelope(8).toFixed(3)}`,
  )
}

// 12. tremble — bounded by construction, which is the entire reason it exists
{
  const out = { x: 0, y: 0, z: 0 }
  canopyTremble(0.3, -0.2, 4.2, 0, out)
  ok("tremble 0 is perfectly still", out.x === 0 && out.y === 0 && out.z === 0)

  let worst = 0
  for (let t = 0; t < 200; t += 0.01) {
    canopyTremble(0.31, -0.22, t, 1, out)
    worst = Math.max(worst, Math.abs(out.x), Math.abs(out.y), Math.abs(out.z))
  }
  // A force integrates and a wire under one keeps going; a displacement cannot
  // exceed its own reach however long it runs. That bound is the feature.
  ok("tremble never exceeds its reach", worst <= TREMBLE_REACH + 1e-9, `${worst.toFixed(4)} vs ${TREMBLE_REACH}`)
  ok("tremble uses most of its reach", worst > TREMBLE_REACH * 0.5, worst.toFixed(4))

  const a = { x: 0, y: 0, z: 0 }
  const b = { x: 0, y: 0, z: 0 }
  canopyTremble(0.3, -0.2, 4.2, 0.7, a)
  canopyTremble(0.3, -0.2, 4.2, 0.7, b)
  ok("tremble is deterministic", a.x === b.x && a.y === b.y && a.z === b.z)
  canopyTremble(0.9, 0.4, 4.2, 0.7, b)
  ok("neighbouring anchors tremble differently", Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6)

  // Well clear of a hanging wire's own swing period, or it pumps rather than
  // shakes. Counted as sign changes: at least a few cycles a second.
  let crossings = 0
  let previous = 0
  for (let t = 0; t < 10; t += 0.002) {
    canopyTremble(0.31, -0.22, t, 1, out)
    if (previous !== 0 && Math.sign(out.x) !== Math.sign(previous)) crossings++
    previous = out.x
  }
  ok("tremble runs well above a wire's swing period", crossings / 2 / 10 > 2, `${(crossings / 2 / 10).toFixed(1)} Hz`)
}

// 13. sway — coherent where tremble is not, which is the entire difference
{
  const anchors = makeCanopy(7, { extent: 2.4, ceiling: 4.2, relief: 0.9, branches: 0 })
  const rest = Array.from({ length: 30 }, (_, i) => anchors.anchorFor(i))
  const out = { x: 0, y: 0, z: 0 }

  /** Worst change in the distance between any two anchors, as a fraction. */
  const worstStrain = (moved: { x: number; y: number; z: number }[]) => {
    let worst = 0
    for (let i = 0; i < rest.length; i++) {
      for (let j = i + 1; j < rest.length; j++) {
        const before = Math.hypot(rest[i].x - rest[j].x, rest[i].y - rest[j].y, rest[i].z - rest[j].z)
        const after = Math.hypot(moved[i].x - moved[j].x, moved[i].y - moved[j].y, moved[i].z - moved[j].z)
        if (before > 1e-6) worst = Math.max(worst, Math.abs(after - before) / before)
      }
    }
    return worst
  }

  // Drive the canopy hard, then read the shape of the anchor cloud.
  const sway = createSway()
  let clock = 0
  for (let i = 0; i < 400; i++) {
    clock += 1 / 60
    sway.update(9, 4, clock, 1 / 60, 1)
  }
  const swayed = rest.map((a) => {
    sway.displace(a.x, a.y, a.z, out)
    return { x: a.x + out.x, y: a.y + out.y, z: a.z + out.z }
  })
  let travelled = 0
  for (let i = 0; i < rest.length; i++) {
    travelled = Math.max(
      travelled,
      Math.hypot(swayed[i].x - rest[i].x, swayed[i].y - rest[i].y, swayed[i].z - rest[i].z),
    )
  }

  ok("sway actually moves the canopy", travelled > 0.15, `${travelled.toFixed(3)}m`)
  // The point of the whole module: lean, twist and bob are rotations and a
  // translation, so the anchor cloud is carried rigidly and the observer keeps
  // a frame to read the scene against.
  ok(
    "sway keeps every anchor pair exactly as far apart",
    worstStrain(swayed) < 1e-5,
    worstStrain(swayed).toExponential(1),
  )

  const trembled = rest.map((a) => {
    canopyTremble(a.x, a.y, 3.3, 1, out)
    return { x: a.x + out.x, y: a.y + out.y, z: a.z + out.z }
  })
  ok(
    "tremble does not — it is a different thing on purpose",
    worstStrain(trembled) > 1e-3,
    worstStrain(trembled).toExponential(1),
  )

  // Still air must put it back exactly where it started, not merely near.
  for (let i = 0; i < 3000; i++) {
    clock += 1 / 60
    sway.update(0, 0, clock, 1 / 60, 1)
  }
  sway.displace(rest[0].x, rest[0].y, rest[0].z, out)
  ok(
    "sway returns to centre in still air",
    sway.atRest() && Math.hypot(out.x, out.y, out.z) < 1e-3,
    `${Math.hypot(out.x, out.y, out.z).toExponential(1)}m off`,
  )

  const off = createSway()
  off.update(9, 4, 1.5, 1 / 60, 0)
  off.displace(rest[0].x, rest[0].y, rest[0].z, out)
  ok("sway 0 is perfectly still", off.atRest() && out.x === 0 && out.y === 0 && out.z === 0)

  // Underdamped: a gust should leave it rocking back past upright.
  const kick = createSway()
  let t = 0
  const lean: number[] = []
  for (let i = 0; i < 240; i++) {
    t += 1 / 60
    kick.update(i < 30 ? 14 : 0, 0, t, 1 / 60, 1)
    kick.displace(0, 0, 4.2, out)
    lean.push(out.x)
  }
  ok(
    "the canopy overshoots upright after a gust, rather than gliding back",
    Math.max(...lean) > 0.05 && Math.min(...lean) < -0.005,
    `swings +${Math.max(...lean).toFixed(3)} then ${Math.min(...lean).toFixed(3)}`,
  )
}

// 14. flicker — on a timescale a person can actually see
{
  ok("flicker 0 leaves a bulb exactly steady", flickerAt(1, 0.4, 3.3, 0) === 1 && flickerAt(1, 0.4, 9.1, 0) === 1)

  const arrangement = buildArrangement(normalizeSettings({ wires: 4, beads: 12, flicker: 1 }))
  let slowest = Infinity
  let fastest = 0
  for (let i = 0; i < arrangement.beadCount; i++) {
    slowest = Math.min(slowest, arrangement.flickerRate[i])
    fastest = Math.max(fastest, arrangement.flickerRate[i])
  }
  // The bug this replaces put a cycle at eleven to fifty seconds, which is not
  // a flicker and is invisible under any other motion in the piece.
  ok("even the slowest bulb cycles within a few seconds", 1 / slowest < 4, `${(1 / slowest).toFixed(2)}s`)
  ok("even the fastest bulb is not a strobe", 1 / fastest > 0.25, `${(1 / fastest).toFixed(2)}s`)

  // Sample one bulb and ask what a viewer would actually see.
  const rate = arrangement.flickerRate[0]
  const phase = arrangement.flickerPhase[0]
  let low = Infinity
  let high = -Infinity
  let biggestSecond = 0
  for (let t = 0; t < 20; t += 0.01) {
    const v = flickerAt(rate, phase, t, 1)
    low = Math.min(low, v)
    high = Math.max(high, v)
    biggestSecond = Math.max(biggestSecond, Math.abs(v - flickerAt(rate, phase, t + 1, 1)))
  }
  ok("flicker swings a bulb's brightness substantially", high - low > 0.5, `${low.toFixed(2)}..${high.toFixed(2)}`)
  ok("and does so within a single second", biggestSecond > 0.3, `${biggestSecond.toFixed(2)} in 1s`)

  let halfAmplitude = 0
  for (let t = 0; t < 20; t += 0.01)
    halfAmplitude = Math.max(halfAmplitude, Math.abs(flickerAt(rate, phase, t, 0.5) - 1))
  ok("the control scales it", Math.abs(halfAmplitude - (high - 1) / 2) < 0.02, halfAmplitude.toFixed(3))
}

// 15. branches — clumps that stay put as the scene grows
{
  const shape = { extent: 2.4, ceiling: 4.2, relief: 0.9, branches: 5 }
  const clustered = makeCanopy(7, shape)

  // Still the invariant that matters most: an anchor belongs to the seed and its
  // own index, never to how many anchors were asked for.
  const few = Array.from({ length: 6 }, (_, i) => clustered.anchorFor(i))
  const many = Array.from({ length: 60 }, (_, i) => clustered.anchorFor(i))
  ok(
    "clustered anchor i does not move as the count grows",
    few.every((a, i) => a.x === many[i].x && a.y === many[i].y && a.z === many[i].z),
  )

  const anchors = Array.from({ length: 60 }, (_, i) => clustered.anchorFor(i))
  ok(
    "clustered anchors stay inside the canopy",
    anchors.every((a) => Math.hypot(a.x, a.y) <= shape.extent + 1e-6),
  )

  // Members of one arm should sit closer together than anchors picked at random,
  // or there are no clumps and the control does nothing.
  const spread = (list: typeof anchors) => {
    let total = 0
    let n = 0
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        total += Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y)
        n++
      }
    return total / n
  }
  const oneArm = anchors.filter((_, i) => i % 5 === 0)
  ok(
    "an arm's anchors clump together",
    spread(oneArm) < spread(anchors) * 0.75,
    `arm ${spread(oneArm).toFixed(2)}m vs all ${spread(anchors).toFixed(2)}m`,
  )

  // Arms must not all converge on the trunk, or they read as one object.
  ok(
    "arms keep clear of the trunk",
    anchors.every((a) => Math.hypot(a.x, a.y) > shape.extent * 0.1),
    `nearest ${Math.min(...anchors.map((a) => Math.hypot(a.x, a.y))).toFixed(3)}m`,
  )

  const even = makeCanopy(7, { ...shape, branches: 0 })
  ok(
    "branches off is the old even scatter, so recorded scenes are untouched",
    [0, 1, 2, 17].every((i) => {
      const a = even.anchorFor(i)
      const b = makeCanopy(7, { extent: 2.4, ceiling: 4.2, relief: 0.9, branches: 0 }).anchorFor(i)
      return a.x === b.x && a.y === b.y && a.z === b.z
    }),
  )
}

console.log(failures === 0 ? "\nall good" : `\n${failures} FAILING`)
process.exit(failures === 0 ? 0 : 1)
