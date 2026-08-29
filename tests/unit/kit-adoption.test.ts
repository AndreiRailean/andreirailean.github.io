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

/** A module a piece must not carry its own copy of. */
const KIT_MODULES = ["controls.ts", "fullscreen.ts", "copy.ts", "wakelock.ts"]

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

  it.each(KIT_MODULES)("keeps no copy of kit/%s", (module) => {
    const own = read(`${EXPERIMENTS}/${slug}/${module}`)
    if (own === null) return
    expect(
      own.includes(OPT_OUT),
      `${slug}/${module} duplicates a kit module. Import it from @/experiments/kit/, ` +
        `or say why not with a "${OPT_OUT} <reason>" comment.`,
    ).toBe(true)
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
