import { it } from "vitest"
import { appendFileSync } from "node:fs"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { settingsFromQuery } from "@/experiments/crowd/settings"
import { drawFrame, makeScratch } from "@/experiments/crowd/draw"
import { makeCamera, horizonFor, toEye, sightSphere, type SphereSight } from "@/experiments/crowd/camera"
import type { Boulder } from "@/experiments/crowd/boulders"

const OUT =
  "/tmp/claude-0/-root--herdr-worktrees-andrei-md-occlusion/6269645f-a502-499e-b9f6-6a417bcf9a2b/scratchpad/miss.txt"
const noop = () => {}
const ctx = new Proxy({}, { get: () => noop, set: () => true }) as unknown as CanvasRenderingContext2D
const STEP = 1 / 120

it("miss", () => {
  const settings = settingsFromQuery(
    new URLSearchParams("s=_-__7___fF8syctZLJ4JCqihtGAAAo-hVSe4AABoAAkABQ6oCkAAACxQR8"),
  )
  const me = createStroll(settings, settings.seed)
  const crowd = createThrong(settings, me)
  const scratch = makeScratch()
  const nearby: Boulder[] = []
  const W = 1400,
    H = 850
  for (let t = 0; t < 12; t += STEP) {
    me.step(STEP, crowd)
    crowd.step(STEP)
    if (t < 5 || Math.round(t / STEP) % 240 !== 0) continue
    const s = me.stats()
    const eye = me.eye()
    const camera = makeCamera(
      s.x,
      s.y,
      eye.z + crowd.path.ground(s.x),
      s.yaw,
      me.pitch,
      settings.fov,
      settings.fade,
      W,
      H,
    )
    crowd.boulders.within(s.x, s.y, horizonFor(settings.fade), nearby)
    const f = drawFrame(ctx, {
      people: crowd.people,
      camera,
      ground: crowd.path.ground,
      settings,
      width: W,
      height: H,
      scratch,
      boulders: nearby,
    })
    const listed = new Set(scratch.rocks.slice(0, f.rocks).map((r) => r.at))
    let behind = 0,
      blockerUnlisted = 0
    const why: Record<string, number> = {}
    const e = [0, 0, 0]
    for (const head of scratch.order) {
      const hz = head.depth,
        hx = ((head.sx - W / 2) * hz) / camera.focal,
        hy = (-(head.sy - H / 2) * hz) / camera.focal
      const L = Math.hypot(hx, hy, hz)
      for (const b of nearby) {
        toEye(camera, b.x, b.y, crowd.path.ground(b.x), e)
        const [cx, cy, cz] = e as [number, number, number]
        const bp = (cx * hx + cy * hy + cz * hz) / L
        const d2 = cx * cx + cy * cy + cz * cz - bp * bp
        if (d2 >= b.r * b.r) continue
        const t1 = bp - Math.sqrt(b.r * b.r - d2)
        if (!(t1 > 0 && t1 < L)) continue
        behind++
        const slot = scratch.rocks.slice(0, f.rocks).find((r) => r.at === b)
        if (slot && !(why as Record<string, unknown>).cmp) {
          const D = Math.hypot(cx, cy, cz)
          ;(why as Record<string, unknown>).cmp = {
            mine: {
              wx: +(cx / D).toFixed(4),
              wy: +(cy / D).toFixed(4),
              wz: +(cz / D).toFixed(4),
              D: +D.toFixed(2),
              sin: +(b.r / D).toFixed(4),
            },
            slot: {
              wx: +slot.wx.toFixed(4),
              wy: +slot.wy.toFixed(4),
              wz: +slot.wz.toFixed(4),
              D: +slot.distance.toFixed(2),
              sin: +slot.sin.toFixed(4),
            },
            head: { L: +L.toFixed(2), t1: +t1.toFixed(2), under: head.under },
          }
        }
        if (!listed.has(b)) {
          blockerUnlisted++
          const probe: SphereSight = { wx: 0, wy: 0, wz: 1, distance: 1, sin: 0, cos: 1, outline: [] }
          const ok = sightSphere(camera, b.x, b.y, crowd.path.ground(b.x), b.r, probe)
          const key = !ok
            ? "sightSphere false"
            : probe.outline.length < 6
              ? "short outline"
              : probe.distance - b.r > horizonFor(settings.fade)
                ? "past horizon"
                : "listed-elsewhere?"
          why[key] = (why[key] ?? 0) + 1
          if (key === "sightSphere false" && !why.example) {
            ;(why as Record<string, unknown>).example = {
              D: +Math.hypot(cx, cy, cz).toFixed(1),
              r: b.r,
              cz: +cz.toFixed(1),
              head: [+head.sx.toFixed(0), +head.sy.toFixed(0)],
              nOutline: probe.outline.length / 2,
            }
          }
        }
        break
      }
    }
    appendFileSync(
      OUT,
      JSON.stringify({
        t: Math.round(t),
        drawn: f.drawn,
        rocksListed: f.rocks,
        nearby: nearby.length,
        behind,
        blockerUnlisted,
        why,
      }) + "\n",
    )
  }
}, 120_000)
