import { describe, expect, it } from "vitest"

import { playInterval } from "@/showcase/viewer"

/**
 * What `?play` asks for, as a number of milliseconds.
 *
 * A string in and a number out, so it lives here rather than in
 * `tests/showcase-autoplay.spec.ts` — which drives the wall itself and cannot
 * enumerate a dozen malformed values without costing a dozen page loads.
 *
 * The module imports cleanly under node because nothing in it touches a DOM
 * until `mountViewer` is called, which is also what lets the viewer be tested
 * at all.
 */

describe("playInterval", () => {
  it("is off when nobody asked", () => {
    // The default every shared link inherits. A wall that walked away from the
    // scene it was sent for would make every address on the site a lie.
    expect(playInterval(null)).toBe(0)
  })

  it("takes the default when `?play` carries no number", () => {
    expect(playInterval("")).toBe(30_000)
  })

  it("takes seconds, because that is the unit a room is described in", () => {
    expect(playInterval("45")).toBe(45_000)
    expect(playInterval("8")).toBe(8000)
  })

  it("is off when told so out loud", () => {
    // `?play=0` is how a kiosk's address gets autoplay switched off without
    // being rewritten, which is the only reason it is spelled at all.
    expect(playInterval("0")).toBe(0)
    expect(playInterval("-10")).toBe(0)
  })

  it("floors an interval too short to mount a piece in", () => {
    // Below this the wall is tearing down a canvas it has only just built, and
    // a prefetch that has not landed means every entry fails to load.
    expect(playInterval("0.01")).toBe(1000)
  })

  it("reads an unreadable number as on rather than off", () => {
    // The failure that matters is silent: a kiosk showing one frozen scene all
    // week looks exactly like a kiosk nobody configured. `?play=thirty` is
    // unambiguously somebody asking for autoplay, so give them autoplay.
    expect(playInterval("thirty")).toBe(30_000)
    expect(playInterval("   ")).toBe(30_000)
  })
})
