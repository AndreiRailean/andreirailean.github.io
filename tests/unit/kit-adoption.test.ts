import { readdirSync, readFileSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Whether each piece is using the kit, or has said out loud that it is not.
 *
 * The kit is *offered*, not imposed —
 * `src/experiments/docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`.
 * So this cannot demand adoption. What it can demand is that divergence be
 * **deliberate and visible**, because every kit bug so far arrived the other
 * way: a piece hand-wrote or copied something the kit already owned, nobody
 * noticed the duplicate, and the fault then propagated to the next piece along
 * with the copy.
 *
 * A piece that genuinely needs its own version says so in the file itself:
 *
 *     // kit-opt-out: the panel is a radial dial, so none of the row CSS applies
 *
 * That keeps the escape hatch open and costs one line. Silence is the thing
 * being ruled out, not difference.
 *
 * This runs in the unit suite on purpose. It reads the filesystem and needs no
 * browser, so a new experiment learns about the kit in the seconds after
 * `npm run test:unit` rather than in review.
 */

const EXPERIMENTS = "src/experiments"
const PAGES = "src/pages/experiments"

/** Not pieces: shared code, and the section's own docs. */
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

/**
 * What the kit defines, by symbol rather than by filename.
 *
 * Filenames were the first rule and were wrong twice over. They missed a copy
 * saved under another name — `controls.ts` to `chrome.ts` and the check was
 * happy — and they were about to produce a false positive the other way:
 * `kit/random.ts` exports `hashSeed`, `makeRng` and `gaussian`, while
 * `dangler/random.ts` and `flotsam/random.ts` keep placement strategies that
 * share the filename and none of the contents. A placement is a choice about a
 * scale and deliberately did not travel.
 *
 * What actually matters is whether a piece has *reimplemented* something the kit
 * already has, and that is a question about definitions.
 */
const DEFINES = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_$]+)/gm

/** Only what a file defines itself. A re-export is not a copy. */
function definitions(source: string): string[] {
  return [...source.matchAll(DEFINES)].map((match) => match[1]!)
}

/**
 * Everything shared, which is two places rather than one.
 *
 * `kit/` is the control surface and only that. Shared code which is not the
 * control surface sits at the section level beside `poster.ts` and
 * `window.d.ts` — see the "What the kit is not" section of
 * `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`. Both are
 * things a piece must not quietly reimplement, so both are read here.
 */
const shared = [
  ...readdirSync(`${EXPERIMENTS}/kit`)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => [`kit/${name}`, `${EXPERIMENTS}/kit/${name}`] as const),
  ...readdirSync(EXPERIMENTS)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => [name, `${EXPERIMENTS}/${name}`] as const),
]

const kitSymbols = new Map<string, string>()
for (const [label, path] of shared) {
  for (const symbol of definitions(readFileSync(path, "utf8"))) kitSymbols.set(symbol, label)
}

/**
 * Selectors `kit/controls.css` owns. A piece redeclaring one is either fighting
 * the kit or has copied a block out of another piece — the second is how the
 * range-row faults spread.
 */
const KIT_SELECTORS = [
  "#ui",
  ".bar",
  ".panel",
  ".row",
  ".label",
  ".value",
  ".group",
  ".modes",
  ".mode",
  ".span",
  ".preset",
  ".copy",
  'input[type="range"]',
  'html[data-idle="true"]',
]

const OPT_OUT = "kit-opt-out:"

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

const read = (path: string) => {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return null
  }
}

/** The page's own stylesheet, which is the only place these selectors matter. */
function styleBlock(page: string): string {
  const open = page.indexOf("<style")
  const close = page.indexOf("</style>")
  return open === -1 || close === -1 ? "" : page.slice(open, close)
}

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  const page = read(`${PAGES}/${slug}/index.astro`)

  it("has a page", () => {
    expect(page, `${PAGES}/${slug}/index.astro`).not.toBeNull()
  })

  it("defines nothing the kit already defines", () => {
    const clashes: string[] = []
    for (const file of readdirSync(`${EXPERIMENTS}/${slug}`).filter((name) => name.endsWith(".ts"))) {
      const source = readFileSync(`${EXPERIMENTS}/${slug}/${file}`, "utf8")
      if (source.includes(OPT_OUT)) continue
      for (const symbol of definitions(source)) {
        const where = kitSymbols.get(symbol)
        if (where) clashes.push(`${slug}/${file} defines \`${symbol}\`, which ${where} already does`)
      }
    }
    expect(
      clashes,
      `${clashes.join("; ")}. Import it from @/experiments/kit/, or say why not with a ` +
        `"${OPT_OUT} <reason>" comment in that file.`,
    ).toEqual([])
  })

  it("imports the kit stylesheet if it renders the kit's chrome", () => {
    if (page === null) return
    const rendersChrome = page.includes("createControls") || page.includes('id="ui"')
    if (!rendersChrome) return
    expect(
      page.includes("kit/controls.css") || page.includes(OPT_OUT),
      `${slug} builds the kit's chrome but never imports kit/controls.css, so it will render ` +
        `unstyled. Add it to the frontmatter, or say why not with a "${OPT_OUT} <reason>" comment.`,
    ).toBe(true)
  })

  it.each(KIT_SELECTORS)("does not redeclare the kit's %s", (selector) => {
    if (page === null) return
    const style = styleBlock(page)
    if (style.includes(OPT_OUT)) return

    // A selector at the start of a rule: followed by `{`, a comma, or a
    // combinator. `.row.copy` and `.span::after` count; `--ui-row-gap` does not.
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(`(^|[\\n,])\\s*${escaped}(?=[\\s.,:>+~{[]|$)`, "m")
    expect(
      pattern.test(style),
      `${slug}'s stylesheet redeclares \`${selector}\`, which kit/controls.css owns. ` +
        `Set the tokens listed at the top of that file instead, or say why not with a ` +
        `"${OPT_OUT} <reason>" comment in the style block.`,
    ).toBe(false)
  })
})
