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

/**
 * The settings a preset block names, read as text rather than by importing.
 *
 * Importing a piece's `settings.ts` would work and is worse: it runs the module,
 * it ties this file to every piece's export shape, and it cannot tell a preset
 * that *states* a value from one that inherits it — which is the whole question.
 * The keys are what is on the page.
 */
function presetBlocks(source: string): { label: string; body: string }[] {
  const found: { label: string; body: string }[] = []
  // Anchored on the settings block and reading *backwards* for the nearest
  // label. Anchoring on the label instead pairs a control's label with a later
  // preset's settings, because a piece's `CONTROLS` array comes first and the
  // labels there look identical.
  const pattern = /settings:\s*\{([\s\S]*?)\n {4}\},/g
  for (const match of source.matchAll(pattern)) {
    const before = source.slice(Math.max(0, match.index - 300), match.index)
    const labels = [...before.matchAll(/label:\s*"([^"]+)"/g)]
    found.push({ label: labels.at(-1)?.[1] ?? "?", body: match[1]! })
  }
  return found
}

const KEY = /^\s*(\w+):/gm

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
        // The label carries the folder, because the two shared layers are not
        // interchangeable and the message used to send every reader to `kit/`.
        // A clash with `random.ts` or `poster.ts` is a clash with a *section
        // level* module, deliberately not in the kit —
        // `docs/adr/20260829-a-third-copy-of-the-generators-moves-to-the-section.md`
        // exists to draw that line, and the hint was rubbing it out.
        if (where) {
          const from = `@/experiments/${where.replace(/\.ts$/, "")}`
          clashes.push(`${slug}/${file} defines \`${symbol}\`, which ${where} already does — import it from ${from}`)
        }
      }
    }
    expect(
      clashes,
      `${clashes.join("; ")}. Import it, or say why not with a ` +
        `"${OPT_OUT} <reason>" comment in that file.`,
    ).toEqual([])
  })

  /**
   * The console API's chrome half, which the kit now supplies.
   *
   * This is the check that was missing when four pieces each wrote `get`, `set`,
   * `preset`, `presets`, `panel`, `pause`, `idle`, `url`, `fullscreen` and
   * `awake` out by hand, byte-identically. The symbol-clash check above could
   * not see any of it: those are methods on an object literal, not `export`ed
   * definitions, so there was nothing for it to clash with — and #85 was a
   * divergence inside that invisible region, which cost a real assertion.
   *
   * Written as **a piece must not reach into the chrome from its `api.ts`**
   * rather than as a search for the ten method names, because the names are
   * ordinary words and the calls are not. `controls.apply`, `controls.setIdle`,
   * `controls.setPanelOpen` and `wakeLock.held` appear nowhere else in a piece
   * once `createBaseApi` is composed, and each one is the kit's own handle being
   * driven by hand.
   *
   * Scoped to `api.ts` deliberately. A piece's `reroll.ts` legitimately calls
   * `controls.apply` — it is applying a patch through the piece's own validator,
   * which is a different act from re-implementing the handle.
   *
   * Offered, not imposed, like everything else here: a piece needing a different
   * console handle writes one and says so in a line.
   */
  const CHROME_REACHES = ["controls.apply(", "controls.setPanelOpen(", "controls.setIdle(", "wakeLock.held("]

  it("takes the console API's chrome half from the kit", () => {
    const api = read(`${EXPERIMENTS}/${slug}/api.ts`)
    if (api === null || api.includes(OPT_OUT)) return

    const reaches = CHROME_REACHES.filter((call) => api.includes(call))
    expect(
      reaches,
      `${slug}/api.ts drives the chrome by hand (${reaches.join(", ")}), which kit/api.ts's ` +
        `createBaseApi already does. Four pieces wrote this out identically before it was ` +
        `hoisted, and #85 was a divergence inside it. Spread createBaseApi instead, or say why ` +
        `not with a "${OPT_OUT} <reason>" comment in that file.`,
    ).toEqual([])

    // The **call**, not the identifier. Checking for the bare name passed on a
    // piece that had been gutted back to hand-written methods and still carried
    // the import — caught by breaking this check deliberately, which is the
    // only reason it is written this way.
    expect(
      api.includes("createBaseApi("),
      `${slug}/api.ts exposes a console API without calling the kit's base handle. Spread ` +
        `createBaseApi from @/experiments/kit/api, or say why not with a ` +
        `"${OPT_OUT} <reason>" comment in that file.`,
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

/**
 * **A preset states every setting, and inherits from nothing.**
 *
 * Recorded in `src/experiments/docs/adr/20260830-a-preset-inherits-from-nothing.md`,
 * and here because it is the kind of rule that is kept by accident until the day
 * it is not. Writing a preset as `{ ...DEFAULT_SETTINGS, hue: 318 }` reads as
 * tidy and quietly hands every scene's unnamed settings to whatever the defaults
 * become. Psyxels lost four of its six scenes to a quarter-speed playback that
 * way, in a change that touched none of them; Flotsam had already stated the
 * rule in its own `settings.ts` and Psyxels did not find it there.
 *
 * A piece whose presets genuinely are not full settings bundles says so with an
 * opt-out, as everywhere else in this file. Silence is what is ruled out.
 */
describe.each(slugs)("%s presets", (slug) => {
  const source = read(`${EXPERIMENTS}/${slug}/settings.ts`)

  it("states every setting in every preset, rather than inheriting them", () => {
    if (source === null || source.includes(OPT_OUT)) return

    const presets = presetBlocks(source)
    if (presets.length === 0) return

    // The longest block is taken as the full set: a piece may legitimately gain
    // a setting between one preset being recorded and the next, and the answer
    // to that is to add it everywhere rather than to fail on the first.
    const keysOf = (body: string) => [...body.matchAll(KEY)].map((match) => match[1]!)
    const widest = presets.reduce((best, preset) =>
      keysOf(preset.body).length > keysOf(best.body).length ? preset : best,
    )
    const expected = new Set(keysOf(widest.body))
    expect(expected.size).toBeGreaterThan(3)

    for (const preset of presets) {
      const named = new Set(keysOf(preset.body))
      const missing = [...expected].filter((key) => !named.has(key))
      expect(
        missing,
        `${slug}'s "${preset.label}" preset does not state ${missing.join(", ")}, so it takes ` +
          `whatever another scene decides. Write every setting out, or say why not with a ` +
          `"${OPT_OUT} <reason>" comment in settings.ts.`,
      ).toEqual([])
      expect(
        preset.body.includes("...") ? preset.label : "",
        `${slug}'s "${preset.label}" preset spreads another object into itself, so it inherits. ` +
          `Write every setting out, or say why not with a "${OPT_OUT} <reason>" comment.`,
      ).toBe("")
    }
  })
})
