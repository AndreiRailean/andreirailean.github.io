# Experiments — shared notes

Each experiment is a full-page programmed graphic. They are deliberately not a
framework yet; see the last section.

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
API cannot produce a state a URL could not. These APIs are the natural first
thing to put under test when this repo gets a test runner.

## Verifying

There is no test runner. `npm run build` covers `astro check`, `npm run lint`
covers eslint, and neither sees anything visual.

- Use `/root/bin/webcheck` (see the machine's global notes) to load pages
  headless, capture stills, and catch console errors.
- **A 200 proves nothing about content.** Grep the response for text you expect;
  an empty collection renders a perfectly valid blank page.
- Pure logic can be imported straight into `node`, which strips TypeScript. The
  `@/` alias will not resolve there — copy to a temp dir and rewrite the import.

## Don't generalise yet

There is intentionally **no shared experiment layout, theme, or component**. Each
one owns its look, and each renders its own about page. The section will get a
theme of its own eventually, but not before a second and third experiment show
what is actually common. Resist extracting an abstraction from a sample of one.
