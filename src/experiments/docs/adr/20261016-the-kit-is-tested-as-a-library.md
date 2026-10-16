---
type: ADR
status: accepted
date: 2026-10-16
summary: The kit is tested once, against a synthetic piece served from outside the site build, and never per piece; each piece keeps one browser test that it boots, exposes the console API and draws, and the note is tested on one host. Shared-spec test time went from 946 s to 92 s locally.
---

# The kit is tested as a library

## Context

`tests/kit.spec.ts` ran every chrome assertion against every piece: 20 tests
times 11 pieces, 522 of the browser suite's 1,233 seconds on CI (2026-10-15).
`tests/experiments-notes.spec.ts` did the same for the note, at 163 seconds.
Every piece now boots through one `gallery/boot.ts` and draws its chrome with
one `createControls`, so most of that time re-proved one code path eleven
times. #287 measured it and asked which tests could go.

Andrei, 2026-10-16:

> most of the kit needs to be tested independently of the experiments. if a
> slider doesn't work, it's all we need to know. we don't want to make sure that
> a slider works in every experiment. that's not a good kit, if it works like
> that. testing experiments is to be done without a kit. all the chrome is just
> overlay on top of experiments that operates via experiment API. so at most we
> need to make sure that experiment api is correctly wired up. we don't need kit
> tests that are dependent on a specific configuration of a particular
> experiment. kit needs to be tested like a generic library would be.

## Decision

- **The kit has a synthetic piece of its own**, `tests/kit/`, holding one of
  everything the kit offers: a linear and a log slider, a bound pair, a choice
  in a row and one stacked, a toggle, a set with a floor, text, a governed
  group, actions, reroll, an escape hatch, a theme, and twelve presets, so both
  sides of the nine-key limit exist. It boots through the real `boot()`.
  `tests/kit.spec.ts` drives it, with each test run once, or once per layout
  where boxed and column differ.
- **It is never published.** esbuild bundles `tests/kit/entry.ts` in the test
  worker, and `page.route` serves it from `http://kit.test`, an origin that does
  not exist (`tests/support/kit-fixture.ts`). Rejected: a route gated by an
  environment variable, which is one misconfigured build from going live; a
  second Astro build, which doubles `globalSetup`; and Vitest browser mode,
  which needs a new dependency and that is the owner's call.
- **Each piece keeps one browser test**, `tests/experiments-wiring.spec.ts`. It
  checks that the page boots, `window.experiment` carries the whole surface
  `boot()` promises, the chrome mounts with rows, and the canvas lights. Pieces
  are read off the disk, so a new one needs registering nowhere. For bubbles,
  dotfield, hexgrid and streakers, which have no spec of their own, it is the
  only check that the canvas is not black.
- **The note is tested on one host**, Starry Night, the lightest piece to keep
  running. `NoteOverlay` and `PiecePage` are shared. The index spec now asserts
  each plate's note link, which the per-note walk used to cover.
- **A piece's data is checked as data.** "Every reported key names a real
  setting" and "every control has a label and a hint" moved to
  `tests/unit/experiments-controls-report.test.ts`.
- **`scripts/affected.ts` selects a piece's wiring test** where it selected its
  kit slice, and fails a selection that lists none. The kit, the fixture and
  the gallery are not a piece's, so a change to any of them selects everything.

|                            | before           | after          |
| -------------------------- | ---------------- | -------------- |
| kit.spec.ts                | 220 tests, 763 s | 26 tests, 33 s |
| experiments-notes.spec.ts  | 56 tests, 183 s  | 5 tests, 11 s  |
| experiments-wiring.spec.ts | —                | 12 tests, 48 s |

The figures are test time on this box, both arms in one session, each run over
the same specs.

## Consequences

**What was dropped, and that it is a real loss.** `kit.spec.ts` checked that
every row of every boxed piece fits its box at every preset. That is how #257
found psyxels' subject choices running 86 px past the edge, and walkers' "to a
spot" breaking in two. The check depended on each piece's labels and values,
which Andrei's rule excludes. The kit's own guarantee, that a value is one line
and stays inside, is now tested on the fixture. A choice label too wide for a
box is not something the kit prevents, so nothing will report it now. Bringing
it back means a per-piece data check, or making the kit wrap or shrink
options; both are visible, so it is Andrei's call.

**A box taller than the window still scrolls the panel.** The fixture shows
this at 420 px tall: one box cannot wrap, so the column scrolls. It is a limit
of boxes, not a regression. It belongs with the small-screen question in #258.

**Every test here was broken once and seen to fail**: the log-track arrow
stall, the nine-key titles, the preset clamp, the value's `nowrap`, inert rows,
`data-preset` going absent, folds surviving a reload, typing that is not a
shortcut, the bound pair's covered thumb, a missing console verb, and a canvas
that never starts.
