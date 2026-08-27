# Experiments — shared notes

Each experiment is a full-page programmed graphic. They are deliberately not a
framework yet; see the last section.

`CONTEXT.md` beside this file is the section's glossary. `docs/adr/` holds the
decisions that shaped it — read the one covering an area before changing it, and
say so explicitly if your work contradicts one rather than quietly overriding
it. Vocabulary and decisions belonging to a single experiment stay in that
experiment's own folder.

## Layout

```
src/experiments/<slug>/        code, about.md, AGENTS.md
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

## Console API

Every experiment exposes `window.experiment` so its controls can be driven
without a pointer. Minimum surface: `get()`, `set(patch)`, `preset(n)`,
`panel(open)`, `idle(force)`. See an existing experiment for the shape.

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
- Use `/root/bin/webcheck` (see the machine's global notes) to sweep many pages
  at once for console errors and stills. It cannot evaluate JS; that is the one
  thing `npm test` adds.
- **A 200 proves nothing about content.** Grep the response for text you expect;
  an empty collection renders a perfectly valid blank page.
- Both runners resolve the `@/` alias, so a test imports a module by the path the
  piece itself uses. Reaching for bare `node --experimental-strip-types` on a
  module still does not — that is what the runners are for.

## Don't generalise yet

There is intentionally **no shared experiment layout, theme, or component**. Each
one owns its look, and each renders its own about page. The section will get a
theme of its own eventually, but not before a second and third experiment show
what is actually common. Resist extracting an abstraction from a sample of one.
