/**
 * The frame drivers pieces wrote out for themselves, in the two shapes they
 * actually take.
 *
 * **What is here is the clock, not the simulation.** Requesting frames,
 * turning timestamps into a clamped `elapsed`, measuring fps, parking and
 * waking, holding. **What is not here is stepping** — how a frame's seconds
 * become simulation steps. Five schemes are in use (a dropped accumulator, an
 * uncapped one, equal substeps, greedy-then-remainder, raw variable dt) and
 * each draws a different sequence, so choosing one is a visual question and
 * every piece hands its own in. The clamp is an option for the same reason:
 * 0.25 s in one family and 0.1 s in the other, and a long frame steps
 * differently under each.
 *
 * - **`parkingLoop`** stops requesting frames once nothing moves and nothing
 *   needs repainting, and `wake()` starts it again. Crowd, Dangler, Embers,
 *   Flotsam and Walkers. Holding cancels the frame outright.
 * - **`steadyLoop`** runs from `start()` to `stop()` and draws every frame;
 *   holding skips the step and keeps drawing. Dotfield, Hexgrid and
 *   Streakers.
 *
 * Section level, beside `random.ts`: a piece takes it without taking the
 * chrome, and it is the scene's clock rather than anything a visitor drives.
 */

/**
 * What one frame of a parking loop did, as the piece reports it.
 *
 * - `"moved"` — the scene changed; draw it.
 * - `"waiting"` — nothing changed yet but something will, so keep the frames
 *   coming without drawing. Dangler's ropes, when a frame was shorter than one
 *   substep.
 * - `"idle"` — nothing is moving; draw if something asked to be repainted,
 *   otherwise park.
 */
export type Outcome = "moved" | "waiting" | "idle"

export type ParkingLoop = {
  /**
   * Repaint on the next frame, starting the loop if it has parked.
   *
   * Everything that changes the picture without moving anything — a resize, a
   * colour, an overlay — comes through here. Without it the loop parks and the
   * canvas keeps whatever was last on it, and setting `canvas.width` on a resize
   * clears it, so a piece simply vanished when its window changed size.
   */
  wake: () => void
  /** Cancel the frame and park. Pause and teardown both; `wake()` resumes. */
  hold: () => void
  /** Frames per second, smoothed. */
  fps: () => number
  /** Whether a frame is currently requested. */
  running: () => boolean
}

export function parkingLoop(options: {
  /** The longest frame honoured, in seconds. A tab returning resumes rather than fast-forwarding. */
  clamp: number
  /** Advance the scene by `elapsed` real seconds, if it is moving, and say what happened. */
  frame: (elapsed: number) => Outcome
  draw: () => void
  /** Run as a parked loop starts again, for state that must not carry across the gap. */
  onWake?: () => void
}): ParkingLoop {
  const { clamp, frame: advance, draw, onWake } = options
  let frame = 0
  let running = false
  let previous = 0
  let fps = 0
  let dirty = true

  function tick(now: number): void {
    frame = requestAnimationFrame(tick)

    const elapsed = previous === 0 ? 0 : Math.min(clamp, (now - previous) / 1000)
    previous = now
    if (elapsed > 0) fps += (1 / elapsed - fps) * 0.1

    const outcome = advance(elapsed)
    if (outcome === "moved" || dirty) {
      dirty = false
      draw()
      return
    }
    if (outcome === "waiting") return

    cancelAnimationFrame(frame)
    frame = 0
    running = false
  }

  function hold(): void {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    running = false
  }

  return {
    wake() {
      dirty = true
      if (running) return
      running = true
      previous = 0
      onWake?.()
      frame = requestAnimationFrame(tick)
    },
    hold,
    fps: () => fps,
    running: () => running,
  }
}

export type SteadyLoop = {
  /** Start requesting frames, from a fresh clock. A no-op while running. */
  start: () => void
  stop: () => void
  /** Hold the scene where it is; frames keep being drawn. */
  setHeld: (held: boolean) => void
  held: () => boolean
  /** Frames per second, smoothed; 0 until the first measured frame. */
  fps: () => number
  running: () => boolean
}

export function steadyLoop(options: {
  /** The longest frame honoured, in seconds. */
  clamp: number
  /** Advance the scene by `dt` seconds. Not called while held. */
  step: (dt: number) => void
  draw: () => void
}): SteadyLoop {
  const { clamp, step, draw } = options
  let frame = 0
  let running = false
  let held = false
  let last = 0
  let fps = 0

  function tick(time: number): void {
    frame = requestAnimationFrame(tick)
    const dt = last ? Math.min(clamp, (time - last) / 1000) : 0
    last = time
    if (dt > 0) fps = fps ? fps * 0.95 + (1 / dt) * 0.05 : 1 / dt
    if (!held) step(dt)
    draw()
  }

  return {
    start() {
      if (running) return
      running = true
      last = 0
      frame = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      cancelAnimationFrame(frame)
    },
    setHeld(on) {
      held = on
    },
    held: () => held,
    fps: () => fps,
    running: () => running,
  }
}

/** The longest any one `settle` will run, in seconds of scene. */
export const MAX_SETTLE = 600

/**
 * A `settle(seconds)` argument made safe to step through: a number, 0 to
 * `MAX_SETTLE`. It arrives from the console and from scripts, so it may be
 * anything — and a settle loop handed `1e9` hangs the tab rather than failing.
 */
export function settleSeconds(seconds: unknown): number {
  return Math.max(0, Math.min(MAX_SETTLE, Number(seconds) || 0))
}
