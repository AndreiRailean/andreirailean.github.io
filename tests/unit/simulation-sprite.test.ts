import { afterEach, describe, expect, it, vi } from "vitest"
import { wrapHue } from "@/experiments/simulation/colour"
import { ditherAlpha, radialSprite } from "@/experiments/simulation/sprite"

/**
 * The shared glow sprite, dither and hue fold, as a library. The canvas is a
 * recording fake: what matters for the four pieces that adopted
 * `radialSprite` is that it issues the calls they issued, in that order.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("wrapHue", () => {
  it("folds any hue into [0, 360)", () => {
    expect([wrapHue(0), wrapHue(359.5), wrapHue(360), wrapHue(725), wrapHue(-30), wrapHue(-720)]).toEqual([
      0, 359.5, 0, 5, 330, 0,
    ])
  })
})

describe("radialSprite", () => {
  function recordingDocument(calls: unknown[][]) {
    const context = {
      createRadialGradient: (...args: number[]) => {
        calls.push(["createRadialGradient", ...args])
        return { addColorStop: (...stop: unknown[]) => calls.push(["addColorStop", ...stop]) }
      },
      set fillStyle(_: unknown) {
        calls.push(["fillStyle"])
      },
      fillRect: (...args: number[]) => calls.push(["fillRect", ...args]),
    }
    return { createElement: () => ({ width: 0, height: 0, getContext: () => context }) }
  }

  it("fills a square with a centred gradient through the given stops, in order", () => {
    const calls: unknown[][] = []
    vi.stubGlobal("document", recordingDocument(calls))
    const canvas = radialSprite(32, [
      [0, "white"],
      [0.5, "grey"],
      [1, "transparent"],
    ])
    expect([canvas.width, canvas.height]).toEqual([32, 32])
    expect(calls).toEqual([
      ["createRadialGradient", 16, 16, 0, 16, 16, 16],
      ["addColorStop", 0, "white"],
      ["addColorStop", 0.5, "grey"],
      ["addColorStop", 1, "transparent"],
      ["fillStyle"],
      ["fillRect", 0, 0, 32, 32],
    ])
  })
})

describe("ditherAlpha", () => {
  function contextWith(alphas: number[]) {
    const data = new Uint8ClampedArray(alphas.flatMap((a) => [10, 20, 30, a]))
    let put: Uint8ClampedArray | null = null
    const context = {
      getImageData: () => ({ data }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        put = image.data
      },
    } as unknown as CanvasRenderingContext2D
    return { context, written: () => put }
  }

  it("moves only visible alpha, by at most the amplitude, and leaves colour alone", () => {
    const alphas = Array.from({ length: 400 }, (_, i) => (i % 4 === 0 ? 0 : 128))
    const { context, written } = contextWith(alphas)
    ditherAlpha(context, 20, 20, 1.5)
    const data = written()!
    let moved = 0
    for (let i = 0; i < alphas.length; i++) {
      expect([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]).toEqual([10, 20, 30])
      const alpha = data[i * 4 + 3]!
      if (alphas[i] === 0) expect(alpha).toBe(0)
      else {
        expect(Math.abs(alpha - 128)).toBeLessThanOrEqual(2)
        if (alpha !== 128) moved++
      }
    }
    expect(moved).toBeGreaterThan(0)
  })
})
