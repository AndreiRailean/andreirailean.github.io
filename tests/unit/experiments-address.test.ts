import { readdirSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { bitsOf, decodeScene, encodeScene, type Slot } from "@/experiments/address"

/**
 * The address registry is append-only, and that is the one thing this whole
 * scheme rests on.
 *
 * A packed address has no version field. It does not need one, because a slot is
 * immutable once allocated and the slot *index* is the version: adding a setting
 * is free, and changing a setting's resolution retires its slot and appends a
 * new one, so every address ever written keeps decoding. See
 * `src/experiments/docs/adr/20260906-an-address-is-packed-not-readable.md` and
 * the docblock on `src/experiments/address.ts`.
 *
 * All of that is true **only while nobody edits a slot in place.** Reordering,
 * deleting, or changing a `grid`, `origin`, `bits` or option list silently
 * changes what every older address means — not loudly, not with an error, just a
 * different scene for anyone holding a link. Nothing about the code makes that
 * hard to do by accident, so it is held here instead.
 *
 * The snapshot below is not a formality. **Update it only by appending**, and if
 * a diff shows an existing line changing, that is the check working.
 */

const EXPERIMENTS = "src/experiments"
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

async function registryOf(slug: string) {
  const module = (await import(`../../src/experiments/${slug}/settings.ts`)) as {
    REGISTRY: readonly Slot[]
    DEFAULT_SETTINGS: Record<string, unknown>
    PRESETS: { label: string; settings: Record<string, unknown> }[]
    normalizeSettings: (patch: Record<string, unknown>) => Record<string, unknown>
  }
  return module
}

/** A slot as one line, so a snapshot diff reads as a list rather than a blob. */
const line = (slot: Slot) =>
  [
    slot.key,
    slot.kind,
    slot.kind === "num" ? `grid=${slot.grid} origin=${slot.origin} bits=${slot.bits}` : "",
    slot.kind === "enum" || slot.kind === "set" ? slot.options.join("|") : "",
    slot.retired ? "RETIRED" : "",
  ]
    .filter(Boolean)
    .join(" ")

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  it("has not edited a slot in place", async () => {
    const { REGISTRY } = await registryOf(slug)
    // Appending shows up here as added lines at the end. Anything else — a
    // changed line, a removed one, a reordering — is an address quietly
    // changing meaning, and is what this exists to refuse.
    expect(REGISTRY.map(line)).toMatchSnapshot()
  })

  it("gives every setting exactly one live slot", async () => {
    const { REGISTRY, DEFAULT_SETTINGS } = await registryOf(slug)
    const live = REGISTRY.filter((slot) => !slot.retired).map((slot) => slot.key)

    expect(new Set(live).size, `${slug} has two live slots for one setting`).toBe(live.length)
    expect([...live].sort(), `${slug}'s live slots do not match its settings`).toEqual(
      Object.keys(DEFAULT_SETTINGS).sort(),
    )
  })

  it("gives every value enough bits to come back unchanged", async () => {
    const { REGISTRY, PRESETS, normalizeSettings } = await registryOf(slug)
    for (const preset of PRESETS) {
      const scene = normalizeSettings(preset.settings)
      const back = decodeScene(REGISTRY, encodeScene(REGISTRY, scene))
      expect(back, `${slug}'s "${preset.label}" does not decode at all`).not.toBeNull()
      expect(back, `${slug}'s "${preset.label}" loses something in its address`).toEqual(scene)
    }
  })

  it("writes an address short enough to be worth the opacity", async () => {
    const { REGISTRY, PRESETS, normalizeSettings } = await registryOf(slug)
    const text = encodeScene(REGISTRY, normalizeSettings(PRESETS[0]!.settings))
    const address = `/experiments/${slug}/?s=${text}`.length
    // Not a budget anyone should tune to — it is here so a slot allocated with
    // a careless `bits` shows up as a number rather than as nobody noticing.
    expect(address, `${slug}'s address is ${address} characters`).toBeLessThan(140)
  })
})

/**
 * The codec, against cases no piece happens to contain.
 *
 * Every one of these is a property the registry rules depend on, so they are
 * asserted directly rather than inferred from a piece happening to work.
 */
describe("the codec", () => {
  const registry: Slot[] = [
    { key: "count", kind: "num", grid: 1, origin: 0, bits: 6 },
    { key: "on", kind: "bool" },
    { key: "mode", kind: "enum", options: ["a", "b", "c"] },
    { key: "marks", kind: "set", options: ["x", "y", "z"] },
  ]

  it("round-trips every kind", () => {
    const scene = { count: 41, on: true, mode: "c", marks: ["x", "z"] }
    expect(decodeScene(registry, encodeScene(registry, scene))).toEqual(scene)
  })

  /**
   * **Adding a setting must not disturb an address written before it.** This is
   * the property that replaces a schema version, so it is asserted rather than
   * argued: the older address is simply silent about the new slot, and its
   * caller fills that from the piece's defaults.
   */
  it("reads an older address against a longer registry", () => {
    const scene = { count: 41, on: true, mode: "c", marks: ["x", "z"] }
    const written = encodeScene(registry, scene)

    const later: Slot[] = [...registry, { key: "chop", kind: "num", grid: 0.01, origin: 0, bits: 7 }]
    const read = decodeScene(later, written)

    expect(read).toEqual(scene)
    expect(read && "chop" in read, "a setting that did not exist yet came back as something").toBe(false)
  })

  /**
   * **Retiring a slot and appending its replacement keeps the old address
   * readable**, which is what lets a setting's resolution change with no
   * migration. The later slot wins when both are present.
   */
  it("keeps a retired slot readable and lets its replacement win", () => {
    const scene = { count: 41, on: true, mode: "c", marks: ["x", "z"] }
    const written = encodeScene(registry, scene)

    const recut: Slot[] = [
      { ...registry[0]!, retired: true },
      ...registry.slice(1),
      { key: "count", kind: "num", grid: 0.5, origin: 0, bits: 8 },
    ]

    // The old address still says 41, through the retired slot.
    expect(decodeScene(recut, written)).toMatchObject({ count: 41 })

    // A new address uses the finer slot, and reaches a value the old one could
    // not hold.
    const finer = { ...scene, count: 41.5 }
    expect(decodeScene(recut, encodeScene(recut, finer))).toMatchObject({ count: 41.5 })
  })

  it("refuses a corrupt address rather than inventing a scene", () => {
    expect(decodeScene(registry, "!!!!")).toBeNull()
    expect(decodeScene(registry, "")).toBeNull()
    // A bitmap claiming another group that is not there.
    expect(decodeScene(registry, "_")).toBeNull()
  })

  it("clamps a value past the top of its slot rather than wrapping to the bottom", () => {
    // Wrapping would turn a too-large number into a small one silently, which
    // is the worst available failure: a plausible scene nobody chose.
    const packed = encodeScene(registry, { count: 999, on: false, mode: "a", marks: [] })
    expect(decodeScene(registry, packed)).toMatchObject({ count: 63 })
  })

  it("reports the bits a slot occupies, so a budget can be counted", () => {
    expect(bitsOf(registry[0]!)).toBe(6)
    expect(bitsOf(registry[1]!)).toBe(1)
    expect(bitsOf(registry[2]!)).toBe(2)
    expect(bitsOf(registry[3]!)).toBe(3)
  })
})
