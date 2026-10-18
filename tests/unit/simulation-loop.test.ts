import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MAX_SETTLE, parkingLoop, settleSeconds, steadyLoop, type Outcome } from "@/experiments/simulation/loop"
import { context2d, fitCanvas } from "@/experiments/simulation/canvas"

/**
 * The section's frame drivers, as a library — the pieces that use them are
 * tested without them, `docs/adr/20261016-the-kit-is-tested-as-a-library.md`.
 *
 * Frames are driven by hand: `requestAnimationFrame` is replaced with a queue
 * this file flushes at a chosen timestamp, so every elapsed time is exact.
 */

let queue = new Map<number, FrameRequestCallback>()
let nextId = 1

/** Run the one requested frame at `ms`, as the browser would. */
function frameAt(ms: number): void {
  const pending = [...queue.entries()]
  queue = new Map()
  for (const [, callback] of pending) callback(ms)
}

beforeEach(() => {
  queue = new Map()
  nextId = 1
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++
    queue.set(id, callback)
    return id
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queue.delete(id)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("parkingLoop", () => {
  function make(outcome: () => Outcome, onWake?: () => void) {
    const elapsed: number[] = []
    let draws = 0
    const loop = parkingLoop({
      clamp: 0.25,
      frame(seconds) {
        elapsed.push(seconds)
        return outcome()
      },
      draw: () => {
        draws++
      },
      ...(onWake ? { onWake } : {}),
    })
    return { loop, elapsed, draws: () => draws }
  }

  it("adds nothing on the first frame, then the wall time between frames", () => {
    const { loop, elapsed } = make(() => "moved")
    loop.wake()
    frameAt(1000)
    frameAt(1016)
    expect(elapsed[0]).toBe(0)
    expect(elapsed[1]).toBeCloseTo(0.016, 9)
  })

  it("never counts one frame for more than the clamp, however long the tab was away", () => {
    const { loop, elapsed } = make(() => "moved")
    loop.wake()
    frameAt(1000)
    frameAt(61_000)
    expect(elapsed[1]).toBe(0.25)
  })

  it("draws once for a repaint, then parks when nothing moves", () => {
    const { loop, draws } = make(() => "idle")
    loop.wake()
    frameAt(1000)
    expect(draws()).toBe(1)
    expect(loop.running()).toBe(true)
    frameAt(1016)
    expect(draws()).toBe(1)
    expect(loop.running()).toBe(false)
    expect(queue.size).toBe(0)
  })

  it("keeps requesting frames without drawing while the piece is waiting", () => {
    let outcome: Outcome = "waiting"
    const { loop, draws } = make(() => outcome)
    loop.wake()
    frameAt(1000) // the wake's repaint
    frameAt(1001)
    frameAt(1002)
    expect(draws()).toBe(1)
    expect(loop.running()).toBe(true)
    outcome = "idle"
    frameAt(1003)
    expect(loop.running()).toBe(false)
  })

  it("restarts from a fresh clock after parking, and runs onWake only then", () => {
    let wakes = 0
    const { loop, elapsed } = make(
      () => "idle",
      () => {
        wakes++
      },
    )
    loop.wake()
    loop.wake() // already running: no second start
    expect(wakes).toBe(1)
    frameAt(1000)
    frameAt(1016) // parks
    loop.wake()
    expect(wakes).toBe(2)
    frameAt(9000)
    expect(elapsed.at(-1)).toBe(0)
  })

  it("hold cancels the frame outright", () => {
    const { loop } = make(() => "moved")
    loop.wake()
    loop.hold()
    expect(queue.size).toBe(0)
    expect(loop.running()).toBe(false)
  })

  it("smooths fps toward the frame rate", () => {
    const { loop } = make(() => "moved")
    loop.wake()
    for (let i = 0; i <= 120; i++) frameAt(1000 + i * (1000 / 60))
    expect(loop.fps()).toBeGreaterThan(59)
    expect(loop.fps()).toBeLessThan(61)
  })
})

describe("steadyLoop", () => {
  function make() {
    const steps: number[] = []
    let draws = 0
    const loop = steadyLoop({
      clamp: 0.1,
      step: (dt) => steps.push(dt),
      draw: () => {
        draws++
      },
    })
    return { loop, steps, draws: () => draws }
  }

  it("steps by clamped wall time from a zero first frame, and draws every frame", () => {
    const { loop, steps, draws } = make()
    loop.start()
    frameAt(1000)
    frameAt(1016)
    frameAt(9000)
    expect(steps[0]).toBe(0)
    expect(steps[1]).toBeCloseTo(0.016, 9)
    expect(steps[2]).toBe(0.1)
    expect(draws()).toBe(3)
  })

  it("held skips the step and keeps drawing", () => {
    const { loop, steps, draws } = make()
    loop.start()
    loop.setHeld(true)
    frameAt(1000)
    frameAt(1016)
    expect(steps).toEqual([])
    expect(draws()).toBe(2)
    expect(loop.held()).toBe(true)
  })

  it("start is a no-op while running, and stop cancels", () => {
    const { loop } = make()
    loop.start()
    loop.start()
    expect(queue.size).toBe(1)
    loop.stop()
    expect(queue.size).toBe(0)
    expect(loop.running()).toBe(false)
  })

  it("seeds fps with the first measured frame, then smooths it", () => {
    const { loop } = make()
    loop.start()
    frameAt(1000)
    expect(loop.fps()).toBe(0)
    frameAt(1020)
    expect(loop.fps()).toBeCloseTo(50, 6)
  })
})

describe("canvas", () => {
  function fakeCanvas(width: number, height: number, context: unknown = {}) {
    return {
      clientWidth: width,
      clientHeight: height,
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement
  }

  beforeEach(() => {
    vi.stubGlobal("window", { devicePixelRatio: 3, innerWidth: 800, innerHeight: 600 })
  })

  it("sizes the backing store at a device-pixel ratio capped at 2", () => {
    const canvas = fakeCanvas(300, 200)
    expect(fitCanvas(canvas)).toEqual({ width: 300, height: 200, dpr: 2 })
    expect([canvas.width, canvas.height]).toEqual([600, 400])
  })

  it("falls back to the window before layout", () => {
    expect(fitCanvas(fakeCanvas(0, 0))).toEqual({ width: 800, height: 600, dpr: 2 })
  })

  it("leaves the canvas alone when nothing changed, since assigning width clears it", () => {
    const canvas = fakeCanvas(300, 200)
    const size = fitCanvas(canvas)
    canvas.width = 1 // a sentinel a second assignment would overwrite
    expect(fitCanvas(canvas, size)).toBeNull()
    expect(canvas.width).toBe(1)
  })

  it("names the piece when there is no 2d context", () => {
    expect(() => context2d(fakeCanvas(1, 1, null), "Crowd")).toThrow("Crowd: no 2d context")
  })
})

describe("settleSeconds", () => {
  it("passes a sane number and bounds the rest", () => {
    expect(settleSeconds(12.5)).toBe(12.5)
    expect(settleSeconds(-3)).toBe(0)
    expect(settleSeconds(1e9)).toBe(MAX_SETTLE)
    expect(settleSeconds("40")).toBe(40)
    expect(settleSeconds("lots")).toBe(0)
    expect(settleSeconds(undefined)).toBe(0)
  })
})
