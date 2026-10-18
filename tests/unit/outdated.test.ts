import { describe, expect, it } from "vitest"
import {
  RELEASE_AGE_MS,
  findUpgrades,
  installableRelease,
  installedFrom,
  issueBody,
  kindOf,
  type Installed,
} from "../../scripts/outdated.ts"

/**
 * The monthly dependency check, without the registry.
 *
 * What it must never do is stay quiet when there is something to upgrade, or
 * file a step as smaller than it is. The cases that would do either are the ones
 * tested: a range read as its own version, an ordering that compares strings, a
 * 0.x minor taken for a minor, a release young enough that pnpm refuses it, and
 * a dev tool whose output ships.
 */

const NOW = Date.parse("2026-11-01T06:00:00Z")
const OLD = new Date(NOW - 10 * RELEASE_AGE_MS).toISOString()
const dep = (version: string): Installed => ({ version, type: "dependencies" })
const dev = (version: string): Installed => ({ version, type: "devDependencies" })

const LOCKFILE = [
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
  "      esbuild:",
  "        specifier: ^0.28.2",
  "        version: 0.28.2",
  "      vitest:",
  "        specifier: ^4.1.11",
  "        version: 4.1.11(@types/node@26.4.0)",
  "",
  "  packages/other:",
  "    dependencies:",
  "      left-pad:",
  "        specifier: ^1.0.0",
  "        version: 1.3.0",
  "",
  "packages:",
  "",
  "  astro@6.0.0:",
  "    resolution: {integrity: sha512-x}",
].join("\n")

describe("installedFrom", () => {
  it("reads every root dependency the lockfile installs, with its section, and not the range", () => {
    expect(installedFrom(LOCKFILE)).toEqual({
      "@astrojs/react": dep("7.1.0"),
      "astro-icon": dep("1.2.0"),
      esbuild: dev("0.28.2"),
      vitest: dev("4.1.11"),
    })
  })
})

describe("kindOf", () => {
  it("compares numbers, not strings: 7.10 is newer than 7.9", () => {
    expect(kindOf("7.9.0", "7.10.0")).toBe("minor")
    expect(kindOf("7.10.0", "7.9.0")).toBeNull()
  })

  it("names each step", () => {
    expect(kindOf("5.9.3", "7.0.2")).toBe("major")
    expect(kindOf("7.4.0", "7.4.1")).toBe("patch")
    expect(kindOf("7.4.0", "7.4.0")).toBeNull()
  })

  it("takes a 0.x minor for the major it is, and a 0.x patch for a patch", () => {
    expect(kindOf("0.14.1", "0.15.0")).toBe("major")
    expect(kindOf("0.28.2", "0.28.3")).toBe("patch")
  })
})

describe("findUpgrades", () => {
  it("offers every package that is behind, and only those", () => {
    const upgrades = findUpgrades(
      { astro: dep("7.4.0"), vitest: dev("4.1.11"), prettier: dev("3.9.10") },
      {
        astro: { latest: "7.10.1", published: OLD },
        vitest: { latest: "5.0.5", published: OLD },
        prettier: { latest: "3.9.10", published: OLD },
      },
      NOW,
    )
    expect(upgrades).toEqual([
      { name: "astro", from: "7.4.0", to: "7.10.1", kind: "minor", type: "dependencies", site: true },
      { name: "vitest", from: "4.1.11", to: "5.0.5", kind: "major", type: "devDependencies", site: false },
    ])
  })

  it("counts esbuild as reaching the site, because it builds the runners", () => {
    const [upgrade] = findUpgrades({ esbuild: dev("0.28.2") }, { esbuild: { latest: "0.28.3", published: OLD } }, NOW)
    expect(upgrade?.site).toBe(true)
  })

  it("waits out pnpm's release age, and offers it once that has passed", () => {
    const young = new Date(NOW - RELEASE_AGE_MS / 2).toISOString()
    const registry = { astro: { latest: "7.5.0", published: young } }
    expect(findUpgrades({ astro: dep("7.4.0") }, registry, NOW)).toEqual([])
    expect(findUpgrades({ astro: dep("7.4.0") }, registry, NOW + RELEASE_AGE_MS)).toHaveLength(1)
  })

  it("skips a package the registry did not answer for, rather than reporting it", () => {
    expect(findUpgrades({ astro: dep("7.4.0") }, {}, NOW)).toEqual([])
  })
})

describe("installableRelease", () => {
  const hour = 60 * 60 * 1000
  const ago = (hours: number) => new Date(NOW - hours * hour).toISOString()

  it("falls back from a latest too young to install to the newest that is old enough", () => {
    // lucide-react on 2026-10-18: 1.59.0 eleven hours old, 1.58.0 two days.
    const time = { created: ago(9000), modified: ago(1), "1.57.0": ago(96), "1.58.0": ago(48), "1.59.0": ago(11) }
    expect(installableRelease("1.59.0", time, NOW)).toEqual({ latest: "1.58.0", published: ago(48) })
  })

  it("takes latest itself once it is old enough", () => {
    const time = { "1.58.0": ago(48), "1.59.0": ago(30) }
    expect(installableRelease("1.59.0", time, NOW)?.latest).toBe("1.59.0")
  })

  it("never offers a pre-release, or anything past latest", () => {
    const time = { "7.4.0": ago(100), "8.0.0-beta.1": ago(90), "7.5.0": ago(80) }
    expect(installableRelease("7.4.0", time, NOW)?.latest).toBe("7.4.0")
    // Below a latest too young to take, where only the pre-release rule stops it.
    const between = { "7.4.0": ago(100), "7.4.1-rc.0": ago(90), "7.5.0": ago(2) }
    expect(installableRelease("7.5.0", between, NOW)?.latest).toBe("7.4.0")
  })

  it("orders by version, not by publication: a backported patch is not newer", () => {
    const time = { "7.4.0": ago(100), "6.3.9": ago(50) }
    expect(installableRelease("7.4.0", time, NOW)?.latest).toBe("7.4.0")
  })
})

describe("issueBody", () => {
  const body = issueBody([
    { name: "react", from: "19.2.8", to: "19.3.1", kind: "minor", type: "dependencies", site: true },
    { name: "typescript", from: "5.9.3", to: "7.0.2", kind: "major", type: "devDependencies", site: false },
    { name: "prettier", from: "3.9.6", to: "3.9.10", kind: "patch", type: "devDependencies", site: false },
  ])

  it("groups by kind, majors first, each with its own table", () => {
    const major = body.indexOf("### Major")
    const minor = body.indexOf("### Minor")
    const patch = body.indexOf("### Patch")
    expect(major).toBeGreaterThan(-1)
    expect(minor).toBeGreaterThan(major)
    expect(patch).toBeGreaterThan(minor)
    expect(body.slice(major, minor)).toContain("| `typescript` | 5.9.3 | 7.0.2 | devDependencies | no |")
    expect(body.slice(minor, patch)).toContain("| `react` | 19.2.8 | 19.3.1 | dependencies | yes |")
    expect(body.slice(patch)).toContain("| `prettier` |")
  })

  it("leaves out a kind with nothing in it, and points at the procedure", () => {
    const only = issueBody([
      { name: "react", from: "19.2.8", to: "19.3.1", kind: "minor", type: "dependencies", site: true },
    ])
    expect(only).not.toContain("### Major")
    expect(only).not.toContain("### Patch")
    expect(only).toContain("docs/agents/upgrading-dependencies.md")
  })
})
