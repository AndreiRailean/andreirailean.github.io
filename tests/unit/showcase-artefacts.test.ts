import { readdirSync, readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * The static half of the showcase: what can be checked without building
 * anything.
 *
 * `pnpm run runners` turns each of these sources into a published artefact by
 * stamping in a runner's content hash. That build is not run here — the unit
 * suite must not need a bundler — so what is checked is the part that would
 * still be wrong if the build succeeded.
 */

const root = resolve(import.meta.dirname, "../..")
const sources = resolve(root, "src/showcase")

type Source = {
  piece: string
  defaultVariant: string
  variants: Record<string, Record<string, unknown>>
}

const files = readdirSync(sources).filter((name) => name.endsWith(".json"))
const read = (name: string) => JSON.parse(readFileSync(resolve(sources, name), "utf8")) as Source

describe("published artefact sources", () => {
  it("there is at least one, or this suite is passing vacuously", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  describe.each(files)("%s", (file) => {
    const source = read(file)

    /**
     * The build throws on this too, but only when it runs. A wrong slug should
     * fail in the two minutes the unit job takes, not in the browser job.
     */
    it("names a piece that has a runner", () => {
      expect(existsSync(resolve(root, "src/experiments", source.piece, "runner.ts"))).toBe(true)
    })

    it("names a default variant it actually has", () => {
      expect(Object.keys(source.variants)).toContain(source.defaultVariant)
    })

    /**
     * **Every variant states every setting**, which is
     * `20260830-a-preset-inherits-from-nothing` one layer out. A dark variant
     * written as "the light one but inverted" is a variant that changes the day
     * the light one does, silently, in whatever page has already pasted it.
     *
     * Compared against each other rather than against a piece's `Settings`
     * type, because an artefact is data and this file may not import a piece.
     */
    it("states the same complete set of settings in every variant", () => {
      const shapes = Object.entries(source.variants).map(
        ([name, settings]) => [name, Object.keys(settings).sort()] as const,
      )
      const [, reference] = shapes[0]!
      for (const [name, keys] of shapes) {
        expect(keys, `variant "${name}" does not state the same settings as "${shapes[0]![0]}"`).toEqual(reference)
      }
      expect(reference.length).toBeGreaterThan(0)
    })
  })
})

describe("the home page's background", () => {
  const page = readFileSync(resolve(root, "src/pages/index.astro"), "utf8")

  /**
   * The address is written by hand in the page, so nothing but this notices a
   * rename. A 404 here is not loud — the embed is built to fail into the site's
   * own dot pattern, which looks exactly like the background having been
   * removed on purpose.
   */
  it("points at an artefact source that exists", () => {
    const match = /data-showcase="\/showcase\/artefacts\/([\w.-]+)\.json"/.exec(page)
    expect(match, "no data-showcase attribute found in src/pages/index.astro").not.toBeNull()
    expect(files).toContain(`${match![1]}.json`)
  })

  /**
   * The site's own background is the embed's fallback, so removing it would
   * turn a failed embed from "unchanged page" into "blank page".
   */
  it("still has the CSS background it falls back to", () => {
    const globals = readFileSync(resolve(root, "src/styles/globals.css"), "utf8")
    expect(globals).toMatch(/bg-\[url\('\/bg\.svg'\)\]/)
    expect(globals).toMatch(/dark:bg-\[url\('\/bg-dark\.svg'\)\]/)
  })
})
