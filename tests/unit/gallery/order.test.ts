import { describe, expect, it } from "vitest"

import { neighbours, wallOrder, type WallEntry } from "@/experiments/gallery/order"

const entry = (slug: string, updated: string): WallEntry => ({ data: { slug, updated: new Date(updated) } })

describe("wallOrder", () => {
  it("puts the most recently touched piece first", () => {
    const order = wallOrder([entry("old", "2026-01-01"), entry("new", "2026-08-01"), entry("mid", "2026-04-01")])
    expect(order.map((one) => one.data.slug)).toEqual(["new", "mid", "old"])
  })

  it("breaks a tie on the slug rather than on the order it was handed", () => {
    const same = "2026-08-01"
    const forwards = wallOrder([entry("beta", same), entry("alpha", same)])
    const backwards = wallOrder([entry("alpha", same), entry("beta", same)])

    // The failure this guards is invisible: two pieces updated on the same day
    // left the sequence resting on the loader's glob order, so the index and the
    // interactive view could disagree with nothing to say why.
    expect(forwards.map((one) => one.data.slug)).toEqual(["alpha", "beta"])
    expect(backwards.map((one) => one.data.slug)).toEqual(forwards.map((one) => one.data.slug))
  })

  it("leaves the collection it was handed alone", () => {
    const entries = [entry("old", "2026-01-01"), entry("new", "2026-08-01")]
    wallOrder(entries)
    expect(entries.map((one) => one.data.slug)).toEqual(["old", "new"])
  })
})

describe("neighbours", () => {
  const slugs = ["dangler", "flotsam", "psyxels"]

  it("reports the pieces either side", () => {
    expect(neighbours(slugs, "flotsam")).toEqual({ previous: "dangler", next: "psyxels" })
  })

  it("ends rather than wraps", () => {
    expect(neighbours(slugs, "dangler").previous).toBeNull()
    expect(neighbours(slugs, "psyxels").next).toBeNull()
  })

  it("has no neighbours for a slug that is not on the wall", () => {
    expect(neighbours(slugs, "nothing")).toEqual({ previous: null, next: null })
  })
})
