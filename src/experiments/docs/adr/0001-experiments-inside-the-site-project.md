# 0001 — Experiments live inside the site's Astro project

**Status:** Accepted — 2026-08-23

## Context

The site needed somewhere to put full-page programmed graphics: canvas pieces
that take the whole viewport, share no header or footer with the site, and are
iterated on constantly. Three homes were weighed.

**A. A bare Astro page.** A `.astro` file importing no layout, no `globals.css`
and no Tailwind, with its code beside it. Gets TypeScript, bundling and HMR from
the existing toolchain.

**B. Raw static files in `public/`.** Hand-written HTML and JS, copied verbatim
into the build. Total independence from Astro, at the cost of TypeScript,
bundling and the dev server.

**C. A nested sub-project with its own build.** An `experiments/` workspace with
its own Vite config, its output chained into the Astro build. Any toolchain per
experiment, at the cost of real machinery.

The concern behind the question was not wanting to be constrained by Astro. In
practice that concern does not bite: a page that imports no layout and no
stylesheet already _is_ a standalone document with a canvas in it. Only the
bundler and the dev server are being borrowed.

## Decision

**A.** Experiments are bare Astro pages in the site's single Astro project.

- Routes live in `src/pages/experiments/<slug>/`.
- Everything else — engine, settings, notes — lives in `src/experiments/<slug>/`.
- An experiment imports nothing from the rest of the site.

`.ts` files must never go under `src/pages/`: Astro turns any it finds there
into an API endpoint. That constraint is why the code and the route are split
across two directories rather than sitting together.

## Consequences

- TypeScript, bundling, HMR and `astro check` come free, and the deploy needs no
  changes at all — `withastro/action` picks the pages up.
- One origin is preserved, which matters for the links: `/experiments/…` URLs are
  already shared, and GitHub Pages cannot 301 them anywhere else. It does not
  matter for the wake lock or the clipboard — see the correction below.
- "Imports nothing from the site" is currently enforced by convention alone.
  Making it a build failure is tracked separately.
- Option C survives as the escape hatch for a single experiment that genuinely
  needs its own toolchain, without disturbing the others.

## Revisit when

An experiment needs a dependency the site should not carry, or its own build
configuration. **This is expected rather than hypothetical** — a WASM-based
experiment is intended, and that would qualify. The extraction is deliberately
not being done pre-emptively, and the next experiment is expected to share
Starry Night's toolchain, so it will not trigger this either.

What extraction would cost, so the trade is not re-derived from scratch: the
deploy action builds one project at the repo root, so two projects mean building
both and merging their output by hand; and a second GitHub Pages site means a
second origin, which breaks the already-shared `/experiments/…` URLs. Pages
cannot issue a 301, so those would need redirect stubs kept indefinitely.

## Correction — 2026-08-28

Two statements above originally said that a second origin would break the
secure-context APIs, and that a subdomain was needed to avoid it. That was
wrong. The wake lock and the clipboard need a _secure context_, and any HTTPS
origin is one — a second GitHub Pages site on a subdomain included. Both have
been rewritten to name what a second origin actually costs, which is the
already-shared `/experiments/…` links.

The decision is unaffected: the reasons to stay were the shared build and those
links, never those APIs. The error mattered because it made extraction look
dearer than it is, and the question kept being reopened against it. See
`docs/adr/20260828-experiments-stay-in-the-site-repo.md`.
