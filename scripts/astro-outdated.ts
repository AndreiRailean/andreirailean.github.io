/**
 * Whether Astro, or anything that has to move with it, has a newer release.
 *
 * Run monthly by `.github/workflows/astro-outdated.yml`, which turns a non-empty
 * answer into a `steward` issue. Andrei, 2026-10-18: "let's also make it a
 * steward task to check for new versions on a regular basis and suggest and
 * upgrade if available. doesn't have to be too frequent. once a month is
 * probably enough".
 *
 * **A clock and not a rule**, because the steward has none
 * (`docs/adr/20260901-prompting-is-the-stewards-trigger.md`): a session told
 * to check monthly is a session that forgets to, and the issue is what reaches
 * whichever steward runs next. How to do the upgrade the issue asks for is
 * `docs/agents/upgrading-astro.md`.
 *
 * `node scripts/astro-outdated.ts` prints the issue body, or nothing when
 * everything is current. **It reads what is installed from `pnpm-lock.yaml`,
 * not the range in `package.json`**: a range is only a floor, and the first
 * run against the ranges reported `astro-icon` 1.1.5 → 1.2.0 when the lockfile
 * already held 1.2.0.
 */

import { readFile } from "node:fs/promises"

/** Astro and the official integrations here first, then what has to support each new Astro. */
export const WATCHED = [
  "astro",
  "@astrojs/react",
  "@astrojs/check",
  "astro-icon",
  "astro-eslint-parser",
  "@tailwindcss/vite",
] as const

/** pnpm will not install anything younger (`minimumReleaseAge`), so it is not on offer yet. */
export const RELEASE_AGE_MS = 24 * 60 * 60 * 1000

export type Release = { latest: string; published: string }
export type Upgrade = { name: string; from: string; to: string; kind: "major" | "minor" | "patch" }

/**
 * The version the lockfile installs for each of the root project's own
 * dependencies, without its peer suffix: `7.4.0(@types/node@…)` → `7.4.0`.
 */
export function installedFrom(lockfile: string): Record<string, string> {
  const root = /\n {2}\.:\n([\s\S]*?)(?=\n {2}\S|\n\S|$)/.exec(lockfile)?.[1] ?? ""
  const installed: Record<string, string> = {}
  for (const match of root.matchAll(/^ {6}'?([^':\n]+)'?:\n {8}specifier: [^\n]+\n {8}version: ([^(\s]+)/gm))
    installed[match[1]!] = match[2]!
  return installed
}

const parts = (version: string) => version.split(/[.+-]/).slice(0, 3).map(Number)

export function kindOf(from: string, to: string): Upgrade["kind"] | null {
  const [a, b] = [parts(from), parts(to)]
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return null
  for (let i = 0; i < 3; i++) {
    if (b[i]! > a[i]!) return (["major", "minor", "patch"] as const)[i]!
    if (b[i]! < a[i]!) return null
  }
  return null
}

/**
 * Every watched package with a newer release that pnpm would install today.
 *
 * Pre-releases are not offered (`latest` never points at one), and a package
 * that is not declared is skipped rather than reported, so dropping one from
 * `package.json` does not file an issue about it forever.
 */
export function findUpgrades(
  installed: Record<string, string>,
  registry: Record<string, Release>,
  now: number,
): Upgrade[] {
  const upgrades: Upgrade[] = []
  for (const name of WATCHED) {
    const from = installed[name]
    const release = registry[name]
    if (!from || !release) continue
    const kind = kindOf(from, release.latest)
    if (!kind) continue
    if (now - Date.parse(release.published) < RELEASE_AGE_MS) continue
    upgrades.push({ name, from, to: release.latest, kind })
  }
  return upgrades
}

/** The issue body: what moved, and where the procedure is. */
export function issueBody(upgrades: readonly Upgrade[]): string {
  const rows = upgrades.map((u) => `| \`${u.name}\` | ${u.from} | ${u.to} | ${u.kind} |`)
  return [
    "Filed by `.github/workflows/astro-outdated.yml`, which checks monthly. Edited in place while it stays open.",
    "",
    "| package | installed | latest | kind |",
    "|---|---|---|---|",
    ...rows,
    "",
    "Upgrade by `docs/agents/upgrading-astro.md`. A major version of `astro` means reading its upgrade guide first. Every upgrade gets a preview for Andrei before merge, because Astro renders every page.",
  ].join("\n")
}

async function fetchRelease(name: string): Promise<Release> {
  const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`)
  if (!response.ok) throw new Error(`${name}: registry answered ${response.status}`)
  const body = (await response.json()) as { "dist-tags": { latest: string }; time: Record<string, string> }
  const latest = body["dist-tags"].latest
  return { latest, published: body.time[latest]! }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const installed = installedFrom(await readFile(new URL("../pnpm-lock.yaml", import.meta.url), "utf8"))
  const registry = Object.fromEntries(
    await Promise.all(WATCHED.filter((name) => installed[name]).map(async (name) => [name, await fetchRelease(name)])),
  )
  const upgrades = findUpgrades(installed, registry, Date.now())
  if (upgrades.length > 0) process.stdout.write(issueBody(upgrades) + "\n")
}
