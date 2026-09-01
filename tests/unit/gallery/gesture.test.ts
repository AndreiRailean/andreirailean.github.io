import { describe, expect, it } from "vitest"

import { AXIS_LOCK, axisOf, COMMIT_SPEED, COMMIT_TRAVEL, commits } from "@/experiments/gallery/gesture"

describe("axisOf", () => {
  it("says nothing until the movement is bigger than the lock", () => {
    expect(axisOf(AXIS_LOCK - 1, 0)).toBeNull()
    expect(axisOf(0, AXIS_LOCK - 1)).toBeNull()
    expect(axisOf(AXIS_LOCK, 0)).toBe("x")
  })

  it("resolves a diagonal to exactly one axis", () => {
    // Both axes firing on one swipe would change the scene *and* leave the
    // piece, and neither half of that is undoable.
    expect(axisOf(40, 30)).toBe("x")
    expect(axisOf(30, 40)).toBe("y")
    expect(axisOf(-40, 30)).toBe("x")
  })
})

describe("commits", () => {
  it("takes a slow drag that goes far enough", () => {
    expect(commits(COMMIT_TRAVEL, 2000)).toBe(true)
    expect(commits(COMMIT_TRAVEL - 1, 2000)).toBe(false)
  })

  it("takes a short flick that is fast enough", () => {
    const travel = AXIS_LOCK + 8
    expect(commits(travel, travel / COMMIT_SPEED - 1)).toBe(true)
    expect(commits(travel, travel / COMMIT_SPEED + 10)).toBe(false)
  })

  it("refuses a twitch however fast it was", () => {
    // A tap with a pixel of wobble arrives as an enormous speed over a
    // millisecond, and must not move the visitor anywhere.
    expect(commits(3, 1)).toBe(false)
  })

  it("reads a gesture the same in both directions", () => {
    expect(commits(-COMMIT_TRAVEL, 2000)).toBe(commits(COMMIT_TRAVEL, 2000))
  })
})
