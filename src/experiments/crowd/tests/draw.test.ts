import { describe, expect, it } from "vitest"
import { makeCamera, horizonFor } from "@/experiments/crowd/camera"
import { drawFrame, makeScratch } from "@/experiments/crowd/draw"
import { normalizeSettings } from "@/experiments/crowd/settings"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import type { Boulder } from "@/experiments/crowd/boulders"
import { MARKET } from "./support"

/**
 * The projection and the batching, on a frame built for the purpose.
 *
 * **This was a browser test that walked for forty seconds** (31 s on CI) so
 * that somebody would happen to come close to the camera — "a crowd that has
 * not moved has nobody near the camera". Nobody needs to happen to: the scene
 * puts somebody two metres in front of me and draws one frame, through the
 * same `drawFrame` the piece paints with, into a context that records nothing
 * (#287). The paint time stays in `crowd.spec.ts`, because only a browser has
 * one.
 */

const noop = () => {}
const glass = new Proxy({}, { get: () => noop, set: () => true }) as unknown as CanvasRenderingContext2D

function frame(nearest: number) {
  const settings = normalizeSettings({ ...MARKET.settings, density: 45, fade: 15, reach: 30 })
  const me = createStroll(settings, settings.seed)
  const crowd = createThrong(settings, me)
  const at = me.stats()
  // Somebody straight ahead of me, `nearest` metres off, and nobody nearer:
  // everybody inside that is pushed straight out from me, past it.
  for (const person of crowd.people) {
    const dx = person.x - at.x
    const dy = person.y - at.y
    const d = Math.hypot(dx, dy)
    if (d < nearest + 0.5) {
      const out = (nearest + 1 + d) / Math.max(d, 1e-6)
      person.x = at.x + dx * out
      person.y = at.y + dy * out
    }
  }
  const close = crowd.people[0]!
  close.x = at.x + Math.cos(at.yaw) * nearest
  close.y = at.y + Math.sin(at.yaw) * nearest
  const camera = makeCamera(at.x, at.y, me.eye().z, at.yaw, me.pitch, settings.fov, settings.fade, 1280, 720)
  const nearby: Boulder[] = []
  crowd.boulders.within(at.x, at.y, horizonFor(settings.fade), nearby)
  return drawFrame(glass, {
    people: crowd.people,
    camera,
    ground: crowd.path.ground,
    settings,
    width: 1280,
    height: 720,
    scratch: makeScratch(),
    boulders: nearby,
  })
}

describe("a frame of the crowd", () => {
  it("draws a head passing close large, and the heads at the back as specks", () => {
    const near = frame(2)
    const far = frame(12)
    // Somebody within a few metres, drawn tens of pixels across.
    expect(near.largest).toBeGreaterThan(12)
    // Size falls with distance: the same person six times further off.
    expect(far.largest).toBeLessThan(near.largest / 3)
    // And far more heads than that reaching the glass, which are the far ones.
    expect(near.drawn).toBeGreaterThan(120)
  })

  it("batches the heads into one fill per brightness, not one per head", () => {
    // **Against a ratio a per-head fill cannot reach.** Unbatched, `fills` is
    // at least `drawn`. Worth 1.50 ms to 1.09 at a market's head count, which
    // is real and is not what makes the piece affordable — see `draw.ts`.
    const near = frame(2)
    expect(near.fills).toBeLessThan(near.drawn * 0.6)
  })
})
