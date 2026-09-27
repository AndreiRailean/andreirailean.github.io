---
type: ADR
status: accepted
date: 2026-09-28
summary: The frame is common and a piece is a library behind three files — settings.ts (what is allowed), presets.ts (which points are named), runner.ts (how a point becomes pixels) — with its tests beside it and CI running only what a change affects.
supersedes: 0002-experiments-are-not-generalised, 20260828-the-piece-is-independent-the-gallery-is-not
---

# A piece is a library behind three files

## Context

The section began on the claim that a piece may build its own page structure
and should not be folded into common boilerplate. ADR-0002 said so outright,
and `20260828-the-piece-is-independent-the-gallery-is-not` kept the claim for
everything but the gallery: the kit was _offered_ and declinable, and a piece
wrote its own boot.

In practice every piece has its own rendering and the same controls. By
2026-09-28 eight `page.ts` files were one function with different names in it:
read the landing scene, tint the document, create the scene, hand the kit the
piece's tables, build `window.experiment`, honour `?panel`, `?idle` and one or
two verbs, rewrite a bare address. Eight `api.ts` files spread
`createBaseApi` and forwarded the same four verbs. Five `reroll.ts` files were
byte-identical. `20260927-a-piece-is-served-by-the-gallerys-page` had already
made the page common; the boot was what was left.

Meanwhile a piece had two ways in. The page imported its constructor, its
console API, its reroll and its settings tables directly. The showcase reached
the same piece only through `runner.ts` and `mount(canvas, scene)`. So there were
two contracts to keep straight, and a change to a piece could not say which
consumers it touched.

The tests lived in a parallel tree — `tests/unit/<slug>/` and
`tests/<slug>.spec.ts` — so a one-piece change ran every piece's tests. On the
2026-09-27 profile a flotsam-only change needed about 245s of browser time and
5s of unit time, and ran about 1,130s and 1,090s. Issue #238 has the rest.

## Decision

**The frame is common. Independence stays for what a piece draws.** Palette,
motion, geometry, the simulation and the drawing are the piece's, completely,
and nothing shared reaches inside them. That is the half of ADR-0002 that has
survived every revision and survives this one. The page, the chrome, the boot
and the console handle are one implementation that every piece is wired into.

**A piece's contract is three files, each answering one question:**

| File          | Answers                                                                                                                               | Consumed by                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `settings.ts` | what parameters are allowed: the schema, ranges, `normalizeSettings`, `CONTROLS`/`GROUPS`, the URL codec and `REGISTRY`, and `CHROME` | the runner, the chrome, URL sync                                  |
| `presets.ts`  | which points in that space are named                                                                                                  | the gallery (bar, landing, poster, note accent), showcase seeding |
| `runner.ts`   | how a point becomes pixels: `start` for a live page, `mount` for a frozen one                                                         | the gallery's page, the showcase                                  |

**Presets get their own file** because they change for a different reason
(curation, which churns — crowd went from six to sixteen), under a different
gate (visible, so Andrei's), for different consumers. The runner needs none of
them: `runner.ts` imports `normalizeSettings` and `REGISTRY` and never
`PRESETS`. In crowd the presets were 754 of `settings.ts`'s 1,717 lines. A
presets-only change can then be checked by the preset checks and one rendering
per preset rather than the simulation suite.

**`runner.ts` exports `start(canvas, settings)`**, returning the live scene the
page drives: `setSettings`, `setPaused`, `stats`, `destroy` and the piece's own
`verbs` — `settle`, `run`, `clear`, `burst`, `debug`, whichever it has.
**`mount(canvas, scene)` stays exactly the showcase's contract** and is written
in terms of `start`, so there is one way a point becomes pixels. A published
runner is frozen and never rebuilt, so `mount`'s signature cannot change; the
new export only adds to what a new build contains.

**`CHROME` lives in `settings.ts`** and is data: the piece's name and canvas,
how a setting tints the document, which bar actions call which verb, which verbs
the console announces, and which query parameters reach a verb. It sits there
rather than in `runner.ts` because `runner.ts` is what a frozen bundle is built
from and every export of an entry point ships. From `settings.ts` it is
tree-shaken out of a runner the way `CONTROLS` is, and
`tests/unit/experiments-runner-weight.test.ts` holds it to the same rule.

**`gallery/boot.ts` is the boot**, and it is handed the three modules rather
than importing them. So the gallery still imports no piece. A piece's
`Piece.astro` makes the three imports and one call, and it is the only
wiring a piece has. `page.ts`, `api.ts` and `reroll.ts` are deleted rather
than moved, and `page/` never comes into existence. A rerollable piece exports
a pure `reroll(settings, seed?)` from `settings.ts`, and its settings carry a
`seed`, which is the one setting name the gallery knows.

**The kit stops being declinable for the frame.** Its modules are what
`gallery/boot.ts` composes, so a piece takes them by being a piece. What a
piece may still decline is anything inside its own drawing, and a
`kit-opt-out:` line still answers the checks that read a piece's files.

**Nothing outside a piece imports past the three files**, and `runner.ts`
never imports `presets.ts`. Both are lint rules with a structural test that
keeps them matching something. Inside the piece, anything goes.

**A piece's tests live in `src/experiments/<slug>/tests/`**: its unit tests and
its browser spec. `tests/` at the root keeps only what spans pieces: the
support code, the structural checks, and the kit, notes, index and showcase
specs.

**CI runs what a change can affect.** A change inside one piece's folder or its
routes selects that piece. Anything not recognised as one piece's selects
everything, so an unknown path can cost time and never coverage. Selection
happens inside the jobs, because a required check that path-filtering skips
reports as missing. The full suite runs on every push to `main`, so a mis-map
fails one merge later and can be traced to that merge, rather than never
failing at all.

## Considered Options

- **A pnpm workspace package per piece.** Rejected: a `package.json` and build
  config per piece is real weight for nothing today, since the runner build
  already treats each piece as its own entry point.
- **A test beside each module.** Rejected: a piece folder already holds about
  twenty files.
- **`CHROME` in `runner.ts`.** Rejected: it would ship in every frozen runner,
  which draws none of it. See `20260906-a-runner-sheds-the-panel.md`.
- **A fourth file per piece for the chrome description.** Rejected: the table
  above would then have a row whose only consumer is the chrome, which is
  already `settings.ts`'s consumer for `CONTROLS` and `GROUPS`.
- **Loading the piece by glob from a generic script.** Rejected: an
  `import.meta.glob` in `gallery/` would make the gallery import every piece, and
  it adds an async hop before boot that static imports in `Piece.astro` do not.

## Consequences

- ADR-0002 and `20260828-the-piece-is-independent-the-gallery-is-not` are
  superseded. The "three layers" section of `../AGENTS.md` now describes the
  piece, the frame, and the kit the frame is built from.
- `20260906-a-page-holds-no-logic.md` still holds for the `.astro`. Its
  `page.ts` half is replaced by `gallery/boot.ts`.
- Adding a piece means writing `settings.ts`, `presets.ts`, `runner.ts`, the
  drawing and `Piece.astro`. There is no boot or API to write.
- A piece's console handle differs from another's only by its verbs, and the
  type specs use is derived from `runner.ts` rather than written out.
- Every structural check that built `tests/unit/${slug}` or `tests/${slug}.spec.ts`
  is repointed, and each is broken after the move to show it can still fail.
