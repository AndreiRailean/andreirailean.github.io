/**
 * Which direct dependencies have a newer release than the lockfile installs.
 *
 * Run monthly by `.github/workflows/outdated.yml`, which turns a non-empty
 * answer into a `steward` issue. Andrei, 2026-10-18: "let's also make it a
 * steward task to check for new versions on a regular basis and suggest and
 * upgrade if available. doesn't have to be too frequent. once a month is
 * probably enough", and then, about everything rather than Astro alone, "i used
 * to do that by hand every few months. now that it's all agentic, I don't do
 * that anymore."
 *
 * **A clock and not a rule**, because the steward has none
 * (`docs/adr/20260901-prompting-is-the-stewards-trigger.md`): a session told
 * to check monthly is a session that forgets to, and the issue is what reaches
 * whichever steward runs next. How to do the upgrades the issue lists is
 * `docs/agents/upgrading-dependencies.md`.
 *
 * `node scripts/outdated.ts` prints the issue body, or nothing when everything
 * is current. **It reads what is installed from `pnpm-lock.yaml`, not the range
 * in `package.json`**: a range is only a floor, and the first version, which
 * read the ranges, reported `astro-icon` 1.1.5 → 1.2.0 when the lockfile already
 * held 1.2.0.
 */

import { readFile } from "node:fs/promises"

/** pnpm will not install anything younger (`minimumReleaseAge`), so it is not on offer yet. */
export const RELEASE_AGE_MS = 24 * 60 * 60 * 1000

export type DependencyType = "dependencies" | "devDependencies"
export type Installed = { version: string; type: DependencyType }
export type Release = { latest: string; published: string }
export type Kind = "major" | "minor" | "patch"
export type Upgrade = { name: string; from: string; to: string; kind: Kind; type: DependencyType; site: boolean }

/**
 * Dev tools whose output still reaches the site. esbuild builds the runners, and
 * a runner's name is the hash of its bytes, so a new esbuild can republish every
 * piece (`docs/agents/upgrading-dependencies.md`, "Special cases").
 */
export const REACHES_SITE_FROM_DEV = new Set(["esbuild"])

/**
 * The version the lockfile installs for each of the root project's own
 * dependencies, without its peer suffix (`7.4.0(@types/node@…)` → `7.4.0`), and
 * which section declares it. A workspace's other importers are not read.
 */
export function installedFrom(lockfile: string): Record<string, Installed> {
  const root = /\n {2}\.:\n([\s\S]*?)(?=\n {2}\S|\n\S|$)/.exec(lockfile)?.[1] ?? ""
  const installed: Record<string, Installed> = {}
  for (const section of root.matchAll(
    /^ {4}(dependencies|devDependencies):\n((?: {6}[\s\S]*?\n)+?)(?=^ {4}\S|(?![\s\S]))/gm,
  )) {
    const type = section[1] as DependencyType
    for (const match of section[2]!.matchAll(/^ {6}'?([^':\n]+)'?:\n {8}specifier: [^\n]+\n {8}version: ([^(\s]+)/gm))
      installed[match[1]!] = { version: match[2]!, type }
  }
  return installed
}

const parts = (version: string) => version.split(/[.+-]/).slice(0, 3).map(Number)

/**
 * How big a step `from` → `to` is, or null when `to` is not newer.
 *
 * **Below 1.0 a minor is a major**, which is also how the caret reads it: 0.14 →
 * 0.15 is breaking by semver's own rule, and `pnpm update` will not take it.
 */
export function kindOf(from: string, to: string): Kind | null {
  const [a, b] = [parts(from), parts(to)]
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return null
  for (let i = 0; i < 3; i++) {
    if (b[i]! > a[i]!) {
      if (i === 1 && a[0] === 0) return "major"
      return (["major", "minor", "patch"] as const)[i]!
    }
    if (b[i]! < a[i]!) return null
  }
  return null
}

/**
 * Every installed dependency with a newer release that pnpm would install today.
 *
 * Pre-releases are not offered (`latest` never points at one). A package with no
 * registry answer is skipped rather than reported.
 */
export function findUpgrades(
  installed: Record<string, Installed>,
  registry: Record<string, Release>,
  now: number,
): Upgrade[] {
  const upgrades: Upgrade[] = []
  for (const [name, { version: from, type }] of Object.entries(installed)) {
    const release = registry[name]
    if (!release) continue
    const kind = kindOf(from, release.latest)
    if (!kind) continue
    if (now - Date.parse(release.published) < RELEASE_AGE_MS) continue
    const site = type === "dependencies" || REACHES_SITE_FROM_DEV.has(name)
    upgrades.push({ name, from, to: release.latest, kind, type, site })
  }
  return upgrades
}

const KINDS: { kind: Kind; heading: string }[] = [
  { kind: "major", heading: "Major: one PR each, migration guide first" },
  { kind: "minor", heading: "Minor: together, with the patches, in one PR" },
  { kind: "patch", heading: "Patch" },
]

/** The issue body: what moved, grouped by how much it costs, and where the procedure is. */
export function issueBody(upgrades: readonly Upgrade[]): string {
  const lines = [
    "Filed by `.github/workflows/outdated.yml`, which checks monthly. Edited in place while it stays open.",
    "Upgrade by `docs/agents/upgrading-dependencies.md`. Anything that reaches the site gets a preview for Andrei before merge.",
  ]
  for (const { kind, heading } of KINDS) {
    const of = upgrades.filter((u) => u.kind === kind).sort((x, y) => x.name.localeCompare(y.name))
    if (of.length === 0) continue
    lines.push(
      "",
      `### ${heading}`,
      "",
      "| package | installed | latest | type | reaches the site |",
      "|---|---|---|---|---|",
    )
    for (const u of of) lines.push(`| \`${u.name}\` | ${u.from} | ${u.to} | ${u.type} | ${u.site ? "yes" : "no"} |`)
  }
  return lines.join("\n")
}

/**
 * The newest release pnpm would install today: not past `latest`, not a
 * pre-release, and at least `RELEASE_AGE_MS` old.
 *
 * **Not simply `latest`.** A package that publishes every few days usually has a
 * `latest` younger than a day, and reading only that hid an upgrade that was
 * available: `lucide-react` 1.59.0 was eleven hours old, so the package was
 * skipped while 1.58.0, two days old, would have installed.
 */
export function installableRelease(latest: string, time: Record<string, string>, now: number): Release | null {
  let best: Release | null = null
  for (const [version, published] of Object.entries(time)) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue
    if (now - Date.parse(published) < RELEASE_AGE_MS) continue
    if (version !== latest && kindOf(version, latest) === null) continue
    if (!best || kindOf(best.latest, version)) best = { latest: version, published }
  }
  return best
}

async function fetchRelease(name: string): Promise<Release | null> {
  const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`)
  if (!response.ok) throw new Error(`${name}: registry answered ${response.status}`)
  const body = (await response.json()) as { "dist-tags": { latest: string }; time: Record<string, string> }
  return installableRelease(body["dist-tags"].latest, body.time, Date.now())
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const installed = installedFrom(await readFile(new URL("../pnpm-lock.yaml", import.meta.url), "utf8"))
  const answers = await Promise.all(
    Object.keys(installed).map(async (name) => [name, await fetchRelease(name)] as const),
  )
  const registry: Record<string, Release> = {}
  for (const [name, release] of answers) if (release) registry[name] = release
  const upgrades = findUpgrades(installed, registry, Date.now())
  if (upgrades.length > 0) process.stdout.write(issueBody(upgrades) + "\n")
}
