---
type: ADR
status: accepted
date: 2026-08-27
summary: Vitest joins Playwright as a second runner, and dangler's checks.ts script is split into per-module unit tests under tests/unit/dangler/.
supersedes_open_question_in: 20260827-playwright-drives-the-experiments
---

# A unit runner alongside the browser one

## Context

`20260827-playwright-drives-the-experiments` deliberately left one thing open:
whether `dangler/checks.ts` — 746 lines and 78 assertions, run by hand through a
`mktemp` and `sed` dance — became part of the runner. It also argued that a unit
runner was redundant, because Playwright resolves the `@/` alias and could host
that file itself.

That argument was about the alias, and the alias was the least of it. Two things
it missed:

- **Speed changes what gets run.** The browser suite needs a dev server and takes
  seconds. "Did I just break the solver" is a question worth asking on every
  edit, and it only gets asked if the answer is instant. The unit suite answers
  in ~300ms, and one module in well under that.
- **More experiments are coming, and each will need tests.** A single script per
  piece, run by hand, does not compose into anything. A layout does.

## Decision

Vitest for anything that is a function and a number; Playwright for anything that
needs a real page. `tests/AGENTS.md` is the contract, and the split is by what a
check needs rather than by how fast it happens to be.

`checks.ts` is gone, its 78 assertions split across nine files in
`tests/unit/dangler/`, one per module of the piece — `rope`, `frame`, `wind`,
`sway`, `canopy`, `arrangement`, `camera`, `random`, `settings`. Each file opens
with why the module's failures are invisible, and each test names the bug it
corresponds to.

The extensions carry the split: `.test.ts` is Vitest's, `.spec.ts` is
Playwright's, and each runner is configured to collect only its own. Left to
their defaults both collect `*.test.ts` and each fails on the other's imports.

## Consequences

- `npx vitest rope` while editing the solver; `npm test` runs both suites.
- Assertions gained their values. `ok(name, boolean, "detail string")` became
  `expect(worst).toBeLessThan(0.01)`, so a failure prints the number instead of a
  hand-formatted string that only appeared when someone looked.
- The conversion was audited assertion by assertion against the original 78, and
  spot-checked by mutation: `SOLVER_ITERATIONS = 0` fails three tests, dropping a
  key from `settingsToQuery` fails three more.
- One faithfulness bug surfaced in the port. `ok("tremble 0 is perfectly still",
out.x === 0 && …)` passes for `-0`; `toEqual({ x: 0 })` does not, because it
  compares with `Object.is`. The tests assert magnitudes, and say why.
- `@types/node` is still needed for the Playwright side; nothing here changed
  that.

## Considered Options

**One `checks.test.ts`, keeping the file's existing order.** Lower risk in the
move and a smaller diff. Rejected because it would not have given the
per-module filtering that makes the runner worth having mid-change, and the next
experiment would have had no shape to copy.

**Leave `checks.ts` as a script and use Vitest only for new work.** Rejected: it
would have left the piece with the most invisible failure modes outside the
runner indefinitely, which is exactly backwards.
