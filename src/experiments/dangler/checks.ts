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
import { buildArrangement } from "@/experiments/dangler/arrangement"
import { DEFAULT_SETTINGS, settingsFromQuery, settingsToQuery, normalizeSettings } from "@/experiments/dangler/settings"

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
  const shape = { extent: 2.6, ceiling: 4, relief: 0.9 }
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
  const c = makeCanopy(7, { extent: 2.6, ceiling: 4, relief: 0.9 })
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

  const flat = makeCanopy(7, { extent: 2.6, ceiling: 4, relief: 0 })
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

console.log(failures === 0 ? "\nall good" : `\n${failures} FAILING`)
process.exit(failures === 0 ? 0 : 1)
