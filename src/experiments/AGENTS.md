# Experiments — shared notes

Each experiment is a full-page programmed graphic. They are deliberately not a
framework yet; see the last section.

`CONTEXT.md` beside this file is the section's glossary. `docs/adr/` holds the
decisions that shaped it — read the one covering an area before changing it, and
say so explicitly if your work contradicts one rather than quietly overriding
it. Vocabulary and decisions belonging to a single experiment stay in that
experiment's own folder.

Three of those records are rules you will otherwise rediscover the hard way:

- **A piece under exploration owes its URLs nothing.** Presets, defaults and
  already-shared links are not things to preserve while a piece is still being
  found; shaping a change to be a no-op on existing scenes costs solution space
  and nobody asked for it. What that does _not_ cover, and a piece's invariants,
  are in `docs/adr/20260829-a-piece-under-exploration-owes-its-urls-nothing.md`.
- **A field advecting things on a wrapped patch must be periodic on that patch.**
  Incompressible is not enough — the seam gathers, and it does it so
  convincingly that it reads as a result rather than a bug. Measured at an index
  of dispersion of 134 against a baseline of 1, in
  `docs/adr/20260829-a-wrapped-patch-needs-a-periodic-field.md`.
- **A placement strategy is a choice about a scale, and does not travel with the
  file it is written in.** Dangler's R2 sequence is right for eighty anchors and
  comes out as a visible lattice at nine thousand specks; `random.ts` is
  duplicated, so copying it copies the choice. See
  `docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`.

## Layout

```
src/experiments/<slug>/        code, about.md, poster.ts, AGENTS.md
src/experiments/gallery/       imposed: the index, the notes, the way out
src/experiments/kit/           offered: parts a piece builds its chrome from
src/pages/experiments/<slug>/  index.astro (the piece), about.astro (the note)
```

- **Never put `.ts` under `src/pages/`.** Astro turns it into an API endpoint.
  Experiment code lives in `src/experiments/<slug>/`; only routes go in `pages`.
- An experiment page **imports nothing from the rest of the site** — no
  `Layout.astro`, no `globals.css`, no Tailwind. It is a bare document.
- Pages are indexable but nothing links to them yet. A link from the front page
  is expected later.

## The `about.md` collection

`src/content.config.ts` globs `src/experiments/*/about.md` and validates the
frontmatter. `/experiments/` is generated from it.

- **Restart the dev server after adding or renaming an `about.md`.** Astro builds
  its content store at startup, so a new file 500s the about page and silently
  renders the index's empty state until you do. `npm run build` is unaffected.
- Keep `updated` current when changing an experiment; they are evergreen, not
  dated posts.

## Posters

`/experiments/` shows a still of each piece above its entry. It is captured, not
drawn, and it is committed — see
`docs/adr/20260828-posters-are-captured-by-hand.md` for why not at build time.

```
src/experiments/<slug>/poster.ts     the recipe: which moment is worth shooting
src/experiments/<slug>/poster.webp   the result, referenced from about.md
```

- **`npm run posters` captures them; nothing else does.** Not the build, which
  stays browserless, and not `npm test`, which must never write tracked files.
  Name a slug — `npm run posters -- dangler` — to leave the others alone.
- **A recipe is per-piece knowledge and stays with the piece.** Which preset,
  what has to happen before the shutter, how long to wait. Dangler loads a
  seeded preset and calls `settle()` twice, because a frame caught mid-relaxation
  shows a shape it never holds. Starry Night needs none of that — its layers are
  seeded out of phase, so frame one is already a sky — but takes the brightest of
  twelve tries, since its glimmers are too brief to catch on purpose.
- **No poster is byte-reproducible, for two different reasons.** Starry Night
  takes no seed at all, so a re-capture is a different sky. Dangler's landing
  preset does carry one, which fixes the arrangement — but its wind is derived
  from the clock too, so the shutter catches the same strands at a different
  point in the same breeze. Both look unchanged to a person and both churn the
  file. Hence the slug filter: re-capture the piece you actually changed.
- `scripts/posters.ts` is generic and knows nothing about any piece; the shared
  contract is the types in `src/experiments/poster.ts`. Per ADR-0002 that is all
  it is allowed to be — a shape, not a base class.
- `poster` is optional in the collection schema. A piece may exist before anyone
  has decided what one frame of it looks like, and the index falls back to a
  text-only entry.

## Console API

Every experiment exposes `window.experiment` so its controls can be driven
without a pointer. Minimum surface: `get()`, `set(patch)`, `preset(n)`,
`panel(open)`, `idle(force)`. See an existing experiment for the shape.

The global is declared **once for the section**, as `unknown`, in `window.d.ts`;
each piece keeps its own typed reference rather than widening it. Do not add a
second declaration — see
`docs/adr/20260824-one-window-experiment-declaration.md`.

**Reach for it whenever something is only verifiable through interaction.**
Anything behind a click is invisible to a headless check otherwise — a panel that
silently rendered unstyled, and a slider track that flipped colour at certain
hues, both went unnoticed until the API could open them. Where a tool cannot
evaluate JS at all, give the API a query-string trigger (`?panel=1`) rather than
leaving the state unreachable.

Route external input through one validator shared with the query string, so the
API cannot produce a state a URL could not. `npm test` drives these APIs
directly; see **Verifying** below.

Expose a `stats()`-style read of internal counts too. Without one there is no
way to tell whether a transition converged or a population was rebuilt, and a
screenshot cannot show it — one real regression here was invisible until the
counts were readable.

`webcheck` cannot evaluate JS. Reaching the API headlessly is what `npm test` is
for: `tests/support/experiment.ts` opens a piece, waits for `window.experiment`
and hands back a typed handle on it, so nothing needs to hand-roll a CDP harness
any more. Note that headless runs without a GPU, so absolute frame times are
pessimistic — trust the ratios between configurations, not the numbers.

## Verifying

`npm run build` covers `astro check`, `npm run lint` covers eslint, and neither
sees anything visual.

- **`npm test` is two runners, and `tests/AGENTS.md` is the contract.** Vitest
  over `tests/unit/**/*.test.ts` for anything that is a function and a number;
  Playwright over `tests/*.spec.ts` for anything needing a real page. Both assert
  on _numbers_ rather than comparing pixels — almost every bug in this section was
  invisible in a screenshot. Stills land in `.scratch/shots/` for a human to look
  at and nothing diffs them.
- **Reach for the unit runner while working.** `npx vitest rope` answers in
  milliseconds where the browser suite needs seconds and a dev server.
- **Do not give the browser suite a fixed port, or one derived per worktree.**
  Both fail, the first silently — see the dev-server section of
  `tests/AGENTS.md`.
- Use `/root/bin/webcheck` (see the machine's global notes) to sweep many pages
  at once for console errors and stills. It cannot evaluate JS; that is the one
  thing `npm test` adds.
- **A 200 proves nothing about content.** Grep the response for text you expect;
  an empty collection renders a perfectly valid blank page.
- Both runners resolve the `@/` alias, so a test imports a module by the path the
  piece itself uses. Reaching for bare `node --experimental-strip-types` on a
  module still does not — that is what the runners are for.

## Three layers: the piece, the gallery, the kit

Recorded in `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`,
which supersedes ADR-0002's blanket "no shared anything". What separates the two
shared layers is **who is spared the relearning**.

- **The piece owns its rendering, completely.** Palette, motion, geometry, what
  it draws, its settings and presets. Nothing shared reaches inside that, and it
  is not up for revisiting — it is the half of ADR-0002 that survives.
- **`gallery/` is imposed.** The index, the notes, the way out — what a visitor
  crosses _between_ pieces. `gallery/Note.astro` renders every note: an
  experiment passes a `NoteTheme` and a script booting its own piece behind the
  sheet, and chooses nothing else. It does not get to move the exit, because a
  visitor should not have to find it twice.
- **`kit/` is offered.** Parts a piece builds its _own_ chrome from:
  `controls.ts`, `fullscreen.ts`, `copy.ts`, `wakelock.ts`. Compose them because
  they are already learned; ignore them if the piece needs a different control
  structure. The art ends at the console API, so controls sit outside that
  boundary. Using the kit is never a reason to refuse a piece something; quietly
  re-implementing what it already does well is the thing to avoid.
- **Neither imports from a piece.** Lift `kit/` out with an experiment and the
  experiment still runs.

### What joins the kit, and when

**A part is hoisted when a third piece wants it, not when a second does.** That
is ADR-0002's rule, kept deliberately by its successor, and it has now been
exercised in both directions:

- `wakelock.ts` moved in when Flotsam was about to make it a third byte-identical
  copy — `docs/adr/20260829-the-third-copy-moves-to-the-kit.md`.
- `random.ts` did **not**, and stays duplicated on purpose. Two pieces have it and
  Starry Night wants none of it. Copying it copies a choice about scale that does
  not travel: Dangler's R2 sequence is right for eighty anchors and is a visible
  lattice at nine thousand specks —
  `docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`.

### The kit renders DOM, not appearance

The class names are the contract with each piece's stylesheet: `.bar`, `.panel`,
`.group`, `.row`, `.label`, `.value`, `.span`, `.modes`, `.mode`, `.preset`,
`.toggle`, `.copy`, `.about`. **Those names are the kit's**, and a setting key
must not be able to land in the same namespace — a slider carries its key as
`data-key`, not as a class, because Flotsam has a setting called `span` and a
class of that name pulled the two-handled-track rules onto a plain slider.

**The chrome CSS is still per-piece, and it is where every kit bug so far has
come from.** Around 460 near-identical lines across three pages. Both slider
faults were CSS, and each failed in a way tests of geometry could not see: the
range row's filled bar took pointer events and made its lower handle
un-grabbable — shipped in Starry Night from the day it had a range control, then
inherited by Flotsam along with the copied rules — and Flotsam's own `.span`
stacked two tracks instead of overlaying one. `tests/kit.spec.ts` presses a real
mouse on both handles of every piece that has a bound pair, because that is the
only thing that catches it. By the third-copy rule above, the structural half of
this CSS is now due to move.

- **A piece using a control kind it has no CSS for renders it unstyled and
  nothing says so.** That has happened twice. Dangler still has no `.modes`
  rules, because it has no choice or toggle row.
