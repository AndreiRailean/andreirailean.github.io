import { describe, expect, it } from "vitest"
import type { Slot } from "@/experiments/address"
import type { Track } from "@/experiments/kit/controls"
import { clamp, namesANumber, onTracks, oneOf, packedAddress, reroller } from "@/experiments/settings-plumbing"

/**
 * The settings plumbing, tested once as a library rather than through twelve
 * pieces — `src/experiments/docs/adr/20261016-the-kit-is-tested-as-a-library.md`.
 * Each piece's own codec stays pinned by `experiments-address.test.ts` and
 * `experiments-urls.test.ts`; this file holds the options those pieces choose
 * between to what they say.
 */

type Scene = { size: number; seed: number; mode: "a" | "b" }

const TRACKS: Partial<Record<"size" | "seed", Track>> = { size: { min: 0, max: 10, step: 0.5 } }
const REGISTRY: readonly Slot[] = [
  { key: "size", kind: "num", grid: 0.5, origin: 0, bits: 5 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 10 },
  { key: "mode", kind: "enum", options: ["a", "b"] },
]
const DEFAULTS: Scene = { size: 2, seed: 7, mode: "a" }
const normalize = (patch: Partial<Scene>): Scene => {
  const merged = { ...DEFAULTS, ...patch }
  return { ...merged, size: clamp(merged.size, 0, 10), mode: oneOf(["a", "b"], merged.mode, DEFAULTS.mode) }
}

describe("clamp and oneOf", () => {
  it("clamp holds a value to its bounds", () => {
    expect([clamp(-1, 0, 1), clamp(0.5, 0, 1), clamp(2, 0, 1)]).toEqual([0, 0.5, 1])
  })

  it("oneOf passes a known option and falls back otherwise", () => {
    expect(oneOf(["a", "b"], "b", "a")).toBe("b")
    expect(oneOf(["a", "b"], "z", "a")).toBe("a")
    expect(oneOf(["a", "b"], undefined, "b")).toBe("b")
  })
})

describe("onTracks", () => {
  it("snaps a tracked key onto its track's grid", () => {
    const { snap, gridFor } = onTracks(TRACKS, { untracked: "keep" })
    expect(snap("size", 2.3)).toBe(2.5)
    expect(gridFor("size", 2.3)).toBe(0.5)
  })

  it("keeps or rounds a key with no track, as the piece says", () => {
    expect(onTracks(TRACKS, { untracked: "keep" }).snap("seed", 3.4)).toBe(3.4)
    expect(onTracks(TRACKS, { untracked: "round" }).snap("seed", 3.4)).toBe(3)
    expect(onTracks(TRACKS, { untracked: "round" }).gridFor("seed", 3.4)).toBe(0)
  })

  it("lets a finer grid undercut the track's step", () => {
    const { snap, gridFor } = onTracks(TRACKS, { finer: { size: 0.1 }, untracked: "keep" })
    expect(snap("size", 2.33)).toBe(2.3)
    expect(gridFor("size", 2.33)).toBe(0.1)
  })
})

describe("packedAddress", () => {
  const packedOnly = packedAddress<Scene>({ registry: REGISTRY, normalize })

  it("round-trips a scene through its own URL", () => {
    const scene: Scene = { size: 4.5, seed: 321, mode: "b" }
    const url = packedOnly.urlForSettings(scene, "/experiments/x/")
    expect(url.startsWith("/experiments/x/?s=")).toBe(true)
    const params = new URL(url, "https://example.test").searchParams
    expect(packedOnly.namesASetting(params)).toBe(true)
    expect(packedOnly.settingsFromQuery(params)).toEqual(scene)
  })

  it("lands on normalize({}) without a legacy reader, for no address and for a corrupt one", () => {
    for (const query of ["", "s=", "s=!!!", "size=3"]) {
      const params = new URLSearchParams(query)
      expect(packedOnly.settingsFromQuery(params), query).toEqual(DEFAULTS)
      expect(packedOnly.namesASetting(params), query).toBe(false)
    }
  })

  it("falls through to the legacy reader when there is no readable packed form", () => {
    const named = packedAddress<Scene>({
      registry: REGISTRY,
      normalize,
      legacy: {
        read: (params) => normalize({ size: Number(params.get("size") ?? DEFAULTS.size) }),
        names: (params) => namesANumber(params, { size: 0 }),
      },
    })
    expect(named.settingsFromQuery(new URLSearchParams("size=3")).size).toBe(3)
    expect(named.namesASetting(new URLSearchParams("size=3"))).toBe(true)
    expect(named.namesASetting(new URLSearchParams("size="))).toBe(false)
    expect(named.settingsFromQuery(new URLSearchParams("s=!!!&size=6")).size).toBe(6)
  })

  it("passes a decoded scene through upgrade before normalising it", () => {
    const upgraded = packedAddress<Scene>({
      registry: REGISTRY,
      normalize,
      upgrade: (scene) => ({ ...scene, mode: "b" }),
    })
    const params = packedOnly.settingsToQuery({ size: 1, seed: 1, mode: "a" })
    expect(upgraded.settingsFromQuery(params).mode).toBe("b")
  })
})

describe("namesANumber", () => {
  it("counts only a key carrying a finite number", () => {
    const bounds = { size: 0, seed: 0 }
    expect(namesANumber(new URLSearchParams("size=0"), bounds)).toBe(true)
    expect(namesANumber(new URLSearchParams("size=&seed=%20"), bounds)).toBe(false)
    expect(namesANumber(new URLSearchParams("size=big"), bounds)).toBe(false)
    expect(namesANumber(new URLSearchParams("other=3"), bounds)).toBe(false)
  })
})

describe("reroller", () => {
  const reroll = reroller(normalize, { max: 999 })

  it("applies a given seed and keeps everything else", () => {
    expect(reroll({ size: 4, seed: 1, mode: "b" }, 55)).toEqual({ size: 4, seed: 55, mode: "b" })
  })

  it("draws a whole seed within 0..max otherwise", () => {
    for (let i = 0; i < 200; i++) {
      const { seed } = reroll(DEFAULTS)
      expect(Number.isInteger(seed) && seed >= 0 && seed <= 999).toBe(true)
    }
  })
})
