import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { build } from "esbuild"
import { describe, expect, it } from "vitest"

/**
 * What must be true about the runners that are committed.
 *
 * A published page pins a runner by content hash, which buys the property the
 * whole arrangement rests on — a scene keeps running the bytes it was published
 * against — and costs the one this file exists to cover: **the failures are
 * silent.** A page naming a runner that was never committed, or a piece changed
 * without republishing, both end with the loader emptying its container and the
 * host's own background showing. It looks deliberate.
 *
 * Unlike a poster, a runner *is* byte-reproducible, so these can be checked
 * rather than merely hoped for. See
 * `src/experiments/docs/adr/20260907-runners-are-committed.md`.
 */

const root = resolve(import.meta.dirname, "../..")
const runners = resolve(root, "public/showcase/runners")
const experiments = resolve(root, "src/experiments")

const committed = readdirSync(runners).filter((name) => name.endsWith(".js"))
const manifest = JSON.parse(readFileSync(resolve(root, "public/showcase/manifest.json"), "utf8")) as {
  commit: string
  runners: Record<string, string>
}

/** The same recipe `scripts/runners.ts` uses. Deliberately duplicated: a check
 * that imported the script would pass by agreeing with itself. */
async function hashOf(slug: string): Promise<string> {
  const built = await build({
    entryPoints: [resolve(experiments, slug, "runner.ts")],
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: true,
    alias: { "@": resolve(root, "src") },
    write: false,
  })
  return createHash("sha256").update(built.outputFiles[0]!.contents).digest("hex").slice(0, 12)
}

describe("committed runners", () => {
  it("there is at least one, or every check here passes vacuously", () => {
    expect(committed.length).toBeGreaterThan(0)
  })

  it("the manifest names files that are committed", () => {
    for (const [slug, name] of Object.entries(manifest.runners)) {
      expect(committed, `manifest names ${name} for ${slug}`).toContain(name)
    }
  })

  /**
   * The one that catches "changed the piece, forgot to publish".
   *
   * Rebuilds from source and insists the current bytes are already committed
   * under their own name. **A failure here is not a broken test** — it means
   * `pnpm run runners` needs running and its output committing.
   */
  describe.each(Object.keys(manifest.runners))("%s", (slug) => {
    it("is committed at the hash its source currently produces", async () => {
      const hash = await hashOf(slug)
      expect(
        committed,
        `${slug}/runner.ts now builds to ${slug}.${hash}.js, which is not committed. ` +
          `Run \`pnpm run runners\` and commit what it writes.`,
      ).toContain(`${slug}.${hash}.js`)
      expect(manifest.runners[slug], `the manifest still names an older runner for ${slug}`).toBe(`${slug}.${hash}.js`)
    })
  })
})

describe("the home page's embed", () => {
  const page = readFileSync(resolve(root, "src/pages/index.astro"), "utf8")

  /**
   * The block Andrei asked for. A pinned hash is a promise, and this is the only
   * thing that notices when the promise names a file nobody published.
   */
  it("pins a runner that is committed", () => {
    const match = /data-showcase-runner="\/showcase\/runners\/([\w.-]+\.js)"/.exec(page)
    expect(match, "no data-showcase-runner found in src/pages/index.astro").not.toBeNull()
    expect(existsSync(resolve(runners, match![1]!)), `${match![1]} is pinned but not committed`).toBe(true)
  })

  it("carries its scenes inline, rather than fetching them", () => {
    expect(page).toMatch(/data-showcase-scene="[\w-]+"/)
    // The artefact-file indirection is gone on purpose — see the correction in
    // `docs/adr/20260906-a-published-scene-is-settings-plus-a-frozen-runner.md`.
    // `src/showcase/README.md` used to say so and no longer exists.
    expect(page).not.toMatch(/data-showcase="/)
  })

  /**
   * The site's own background is the embed's fallback, so removing it would turn
   * a failed embed from "unchanged page" into "blank page".
   */
  it("still has the CSS background it falls back to", () => {
    const globals = readFileSync(resolve(root, "src/styles/globals.css"), "utf8")
    expect(globals).toMatch(/bg-\[url\('\/bg\.svg'\)\]/)
    expect(globals).toMatch(/dark:bg-\[url\('\/bg-dark\.svg'\)\]/)
  })
})
