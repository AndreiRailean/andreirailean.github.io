import { describe, expect, it } from "vitest"

import { pieceHref } from "@/experiments/gallery/reel"

/**
 * The address arithmetic of the interactive view. The gestures and the DOM need
 * a real browser and are in `tests/reel.spec.ts`; this is the half that is a
 * string in and a string out.
 */

describe("pieceHref", () => {
  it("is the piece's own bare address when nothing describes the view", () => {
    expect(pieceHref("flotsam")).toBe("/experiments/flotsam/")
  })

  it("carries how the view is being looked at across to the next piece", () => {
    // Without this the next piece comes up with a bar of controls on it, one
    // swipe into a desktop check.
    expect(pieceHref("psyxels", "?reel=1")).toBe("/experiments/psyxels/?reel=1")
  })

  it("leaves a scene behind rather than carrying it onto a different piece", () => {
    // Settings are the piece's own vocabulary. Flotsam's `span` means nothing to
    // Psyxels, and handing it over would land on a scene neither piece chose.
    expect(pieceHref("psyxels", "?reel=1&span=40&hue=202")).toBe("/experiments/psyxels/?reel=1")
  })
})
