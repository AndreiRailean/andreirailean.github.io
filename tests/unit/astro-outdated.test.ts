import { describe, expect, it } from "vitest"
import { RELEASE_AGE_MS, findUpgrades, installedFrom, issueBody, kindOf } from "../../scripts/astro-outdated.ts"

/**
 * The monthly Astro check, without the registry.
 *
 * What it must never do is stay quiet when there is something to upgrade, and
 * the cases that would make it quiet are the ones tested: a range read as its
 * own version, an ordering that compares strings, and a release young enough
 * that pnpm refuses it.
 */

const NOW = Date.parse("2026-11-01T06:00:00Z")
const OLD = new Date(NOW - 10 * RELEASE_AGE_MS).toISOString()

describe("findUpgrades", () => {
  it("offers a newer astro, and says what kind of upgrade it is", () => {
    const upgrades = findUpgrades({ astro: "7.4.0" }, { astro: { latest: "7.10.1", published: OLD } }, NOW)
    expect(upgrades).toEqual([{ name: "astro", from: "7.4.0", to: "7.10.1", kind: "minor" }])
  })

  it("compares numbers, not strings: 7.10 is newer than 7.9", () => {
    expect(kindOf("7.9.0", "7.10.0")).toBe("minor")
    expect(kindOf("7.10.0", "7.9.0")).toBeNull()
  })

  it("names a major, which is the one that needs the upgrade guide", () => {
    expect(kindOf("7.4.0", "8.0.0")).toBe("major")
    expect(kindOf("7.4.0", "7.4.1")).toBe("patch")
  })

  it("is quiet when everything is current", () => {
    expect(findUpgrades({ astro: "7.4.0" }, { astro: { latest: "7.4.0", published: OLD } }, NOW)).toEqual([])
  })

  it("waits out pnpm's release age, and offers it once that has passed", () => {
    const young = new Date(NOW - RELEASE_AGE_MS / 2).toISOString()
    expect(findUpgrades({ astro: "7.4.0" }, { astro: { latest: "7.5.0", published: young } }, NOW)).toEqual([])
    expect(
      findUpgrades({ astro: "7.4.0" }, { astro: { latest: "7.5.0", published: young } }, NOW + RELEASE_AGE_MS),
    ).toHaveLength(1)
  })

  it("skips a package that is no longer declared, rather than reporting it every month", () => {
    expect(findUpgrades({}, { "astro-icon": { latest: "9.0.0", published: OLD } }, NOW)).toEqual([])
  })

  it("reads what the lockfile installs, not the range, and only for the root project", () => {
    const lockfile = [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .:",
      "    dependencies:",
      "      '@astrojs/react':",
      "        specifier: ^7.1.0",
      "        version: 7.1.0(@types/node@26.4.0)(react@19.2.8)",
      "      astro-icon:",
      "        specifier: ^1.1.5",
      "        version: 1.2.0",
      "    devDependencies:",
      "      astro-eslint-parser:",
      "        specifier: ^3.1.0",
      "        version: 3.1.0(supports-color@7.2.0)",
      "",
      "packages:",
      "",
      "  astro@6.0.0:",
      "    resolution: {integrity: sha512-x}",
    ].join("\n")
    expect(installedFrom(lockfile)).toEqual({
      "@astrojs/react": "7.1.0",
      "astro-icon": "1.2.0",
      "astro-eslint-parser": "3.1.0",
    })
  })
})

describe("issueBody", () => {
  it("lists each upgrade and points at the procedure", () => {
    const body = issueBody([{ name: "astro", from: "7.4.0", to: "8.0.0", kind: "major" }])
    expect(body).toContain("| `astro` | 7.4.0 | 8.0.0 | major |")
    expect(body).toContain("docs/agents/upgrading-astro.md")
  })
})
