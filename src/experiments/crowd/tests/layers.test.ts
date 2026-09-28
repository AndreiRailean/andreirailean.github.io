import { describe, expect, it } from "vitest"
import { makeCamera, horizonFor } from "@/experiments/crowd/camera"
import { drawFrame, makeScratch } from "@/experiments/crowd/draw"
import { PRESETS } from "@/experiments/crowd/presets"
import { encodeScene } from "@/experiments/address"
import {
  normalizeSettings,
  OFF,
  reconcile,
  REGISTRY,
  settingsFromQuery,
  type Settings,
} from "@/experiments/crowd/settings"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import type { Boulder } from "@/experiments/crowd/boulders"

/**
 * **Off is the identity, layer by layer** (#242). `normalizeSettings` resets a
 * layer's settings to `OFF` whenever the layer is off or the chosen ground does
 * not use them, so that two scenes which look the same are the same scene. That
 * is only safe if those settings do nothing while hidden — which is what this
 * holds: a short seeded walk with a hidden setting moved is numerically
 * identical, people and picture both, to the walk with it at its off value.
 *
 * The settings are built raw rather than normalized, because normalizing would
 * reset the very value being tested.
 */

const STEP = 1 / 120
const noop = () => {}
const glass = new Proxy({}, { get: () => noop, set: () => true }) as unknown as CanvasRenderingContext2D

/** Everything a walk decides, as numbers: where everybody is, where I am and what I see. */
function fingerprint(settings: Settings): number[] {
  const me = createStroll(settings, settings.seed)
  const crowd = createThrong(settings, me)
  for (let t = 0; t < 2; t += STEP) {
    me.step(STEP, crowd)
    crowd.step(STEP)
  }
  const at = me.stats()
  const camera = makeCamera(at.x, at.y, 1.6, at.yaw, me.pitch, settings.fov, settings.fade, 800, 500)
  const nearby: Boulder[] = []
  crowd.boulders.within(at.x, at.y, horizonFor(settings.fade), nearby)
  const frame = drawFrame(glass, {
    people: crowd.people,
    camera,
    ground: crowd.path.ground,
    settings,
    width: 800,
    height: 500,
    scratch: makeScratch(),
    boulders: nearby,
  })
  let sum = 0
  for (const person of crowd.people) sum += person.x * 1.3 + person.y * 0.7
  return [crowd.people.length, sum, at.x, at.y, at.yaw, frame.drawn, frame.hidden, frame.rocks, frame.fills]
}

const scene = (label: string, patch: Partial<Settings> = {}): Settings => {
  const preset = PRESETS.find((p) => p.label === label)
  if (!preset) throw new Error(`no preset ${label}`)
  // Small, so a dozen walks stay a second or two each.
  return { ...normalizeSettings({ ...preset.settings, density: 10, reach: 30 }), ...patch }
}

/** Each layer: a scene with it off or unused, and the hidden settings to move, one at a time. */
const CASES: { name: string; base: Settings; moved: Partial<Settings>[] }[] = [
  {
    name: "boulders off",
    base: scene("market"),
    moved: [{ boulder: 14 }, { layout: 2 }, { passage: 7 }, { shade: 1 }],
  },
  { name: "chase off", base: scene("market"), moved: [{ flee: 1.5 }] },
  { name: "stalls off", base: scene("market"), moved: [{ aisle: 7 }] },
  {
    name: "open ground",
    base: scene("market"),
    moved: [
      { lining: 4 },
      { watchers: 100 },
      { meander: 120 },
      { hills: 100 },
      { effort: 1 },
      { corners: 0.8 },
      { keep: 0.6 },
      { line: 0.5 },
      { hold: 0.8 },
    ],
  },
  {
    name: "a street",
    base: scene("the street"),
    moved: [{ meander: 120 }, { corners: 0.8 }, { watchers: 80 }, { hills: 100 }, { effort: 1 }, { line: 0.6 }],
  },
  {
    name: "scattered boulders",
    base: scene("boulders"),
    moved: [{ passage: 7 }],
  },
  { name: "a trail", base: scene("the trail"), moved: [{ corners: 0.8 }] },
  { name: "a loop", base: scene("loop run"), moved: [{ bend: 30 }, { meander: 120 }] },
]

describe("a layer that is off", () => {
  for (const { name, base, moved } of CASES) {
    it(`does nothing, whatever its hidden settings say: ${name}`, () => {
      const reference = fingerprint(base)
      // Paired with a presence: the scene is a real walk, not an empty one
      // that any two settings would agree on.
      expect(reference[0]).toBeGreaterThan(20)
      expect(reference[5]).toBeGreaterThan(5)
      for (const patch of moved) {
        expect(fingerprint({ ...base, ...patch }), JSON.stringify(patch)).toEqual(reference)
      }
    }, 60_000)
  }

  it("is told apart from one that is on, so the check can fail", () => {
    // The control: the same comparison with the layer switched on does move.
    const base = scene("market")
    expect(fingerprint({ ...base, boulders: 0.2, layout: 2, passage: 6, boulder: 3 })).not.toEqual(fingerprint(base))
    expect(fingerprint({ ...base, chase: 1 })).not.toEqual(fingerprint(base))
  }, 60_000)
})

describe("normalizing", () => {
  it("resets every setting the scene does not use to its off value", () => {
    const leftover = normalizeSettings({ ...scene("market"), bend: 30, loop: 0, lining: 3, boulder: 12, flee: 1.4 })
    expect(leftover.bend).toBe(OFF.bend)
    expect(leftover.lining).toBe(OFF.lining)
    expect(leftover.boulder).toBe(OFF.boulder)
    expect(leftover.flee).toBe(OFF.flee)
    // And keeps what the scene does use.
    const trail = normalizeSettings({ ...scene("the trail"), bend: 30 })
    expect(trail.bend).toBe(30)
  })

  it("leaves every preset exactly as written", () => {
    for (const preset of PRESETS) expect(normalizeSettings(preset.settings), preset.label).toEqual(preset.settings)
  })
})

describe("a way", () => {
  const drag = (key: keyof Settings, value: number, from: Settings) =>
    normalizeSettings(reconcile({ ...from, [key]: value }, key))

  it("chosen on open ground gets a street's width, and dragging its width to the end does not snap back", () => {
    const chosen = drag("way", 1, scene("market"))
    expect(chosen.width).toBeLessThan(20)
    expect(drag("width", 250, scene("the street")).width).toBeGreaterThan(200)
  })

  it("resets what the rest of it makes inert, and keeps what it uses", () => {
    const loop = normalizeSettings({ ...scene("loop run"), bend: 30, corners: 0.4 })
    expect(loop.bend).toBe(OFF.bend)
    expect(loop.corners).toBe(0.4)
    const trail = normalizeSettings({ ...scene("the trail"), corners: 0.4, bend: 30 })
    expect(trail.corners).toBe(OFF.corners)
    expect(trail.bend).toBe(30)
  })
})

describe("an address from before the way", () => {
  /**
   * Addresses from #250 carry `ground` (0 open, 1–3 street, trail, loop), now
   * retired; older ones carry neither and meant a way whenever `width` was
   * under the top of its track. Both open onto the scene they described.
   */
  const withGround = REGISTRY.map((slot) => (slot.key === "ground" ? { ...slot, retired: undefined } : slot))
  const open = (scene: Record<string, number>, registry: readonly unknown[] = withGround) =>
    settingsFromQuery(new URLSearchParams({ s: encodeScene(registry as never, scene) }))

  it("reads a trail written with ground as a way, and open ground as open", () => {
    expect(open({ ground: 2, width: 3.5, bend: 30 }).way).toBe(1)
    expect(open({ ground: 2, width: 3.5, bend: 30 }).bend).toBe(30)
    expect(open({ ground: 0, width: 250 }).way).toBe(0)
  })

  it("reads an address with only a width as a way when the width has sides", () => {
    expect(open({ width: 7 }, REGISTRY).way).toBe(1)
    expect(open({ width: 250 }, REGISTRY).way).toBe(0)
  })
})
