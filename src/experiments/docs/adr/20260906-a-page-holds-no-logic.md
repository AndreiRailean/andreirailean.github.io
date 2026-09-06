---
type: ADR
status: accepted
date: 2026-09-06
summary: A piece's page holds markup and calls boot(); its script moves to src/experiments/<slug>/page.ts, because code in an .astro file is invisible to a grep of the section and to every check that reads .ts.
---

# A page holds no logic

## Context

`AGENTS.md` has always said **never put `.ts` under `src/pages/`** — Astro turns
it into an API endpoint. Nobody wrote down the other half, and the other half is
the one that cost anything: about **115 lines per page**, more than half of each
`src/pages/experiments/<slug>/index.astro`, sat in a `<script>` block. Reading
elements, building the chrome, wiring the console handle, rewriting the address.
Section code, living outside `src/experiments/`.

Two consequences, and only one of them is inconvenience.

**A grep of the section never reaches it.** A refactor across `src/experiments/`
misses call sites it cannot see. `copyLabel` was removed with three live callers
in exactly those files; `astro check`, inside the lint job, is the only thing in
this repo that types `.astro` at all, and it was what caught it. That has come up
repeatedly and is what prompted this.

**The worse one: the checks cannot read it either.**
`tests/unit/kit-adoption.test.ts` scans `.ts` files, so the check written to
catch a piece reimplementing shared code was structurally blind to a sixth of the
section. Five byte-identical copies of `requireElement` sat in those pages,
differing only in the piece's name inside an error string — well past the
third-copy rule that moved `wakelock.ts` into the kit — and nothing could have
noticed. The duplication was not missed by a reviewer; it was outside the
instrument.

## Decision

**A piece's page is markup, a `<style>` block, and two lines of script:**

```astro
<script>
  import { boot } from "@/experiments/<slug>/page"

  boot()
</script>
```

Everything else moves to `src/experiments/<slug>/page.ts`, exporting `boot()`.
`requireElement` is hoisted to `src/experiments/element.ts` — section level, not
`kit/`, since a piece could take it without taking the chrome.

`tests/unit/experiments-pages.test.ts` holds a page to an import and a call.

**Framework was considered and is not the problem.** The question that raised
this asked whether Astro needs special agent instructions or whether the code
should be structured differently. It is the second, and it is not Astro's fault:
any templating language that lets logic live inside a page file would produce the
same blind spot, because the blind spot is _where the code is_, not what parses
it. Moving frameworks would cost everything and fix nothing that this does not.

## Consequences

- **One grep of `src/experiments/` now finds every reference in the section.**
  That is the whole point.
- **`kit-adoption.test.ts` can see the pages' code**, and did immediately: the
  hoist of `requireElement` is the first thing it would have flagged.
- **`tsc` types it**, so a broken reference no longer waits for `astro check` in
  the lint job to be the only witness.
- **A page diff is now legible as a design change.** Styles and structure, with
  no behaviour mixed in.
- The pages went from ~200 lines each to ~95.

## Considered Options

**Document the trap and move on.** A rule in `AGENTS.md` saying "grep
`src/pages/experiments/` too". Rejected on this section's own standard: a rule
someone has to remember is the weakest place to put a correctness requirement,
and this one had already been rediscovered more than once. It also leaves
`kit-adoption` blind, which documentation cannot fix.

**Teach the checks to read `.astro`.** Extend `kit-adoption.test.ts` and the
others to parse script blocks out of pages. Rejected as the more expensive half
of a worse fix: it needs every check to learn a second file format and keeps the
code somewhere a grep still misses. Moving the code fixes both at once and
subtracts a format instead of adding one.

**Change framework.** Costs everything, fixes nothing here — see above.
