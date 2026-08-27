---
type: ADR
status: accepted
date: 2026-08-27
summary: Playwright drives the experiments through their console APIs, using the machine's own Chromium and Astro's background dev server; it asserts on numbers and never on pixels.
---

# Playwright drives the experiments, and does not diff their pixels

## Context

The experiments are the only part of this repo that neither `astro check` nor
eslint can see anything of. `src/experiments/AGENTS.md` already said why every
piece exposes `window.experiment`: anything behind a click is invisible to a
headless check otherwise. What it did not have was anything to reach it with.

Three separate frictions had accumulated:

- `webcheck` loads pages, captures stills and catches console errors, but cannot
  evaluate JS. Everything behind the console API was out of reach.
- So each task that needed the API hand-rolled a CDP harness — launch chromium
  with `--remote-debugging-port=0`, read the port from `DevToolsActivePort`, then
  `Runtime.evaluate`. The instructions for doing this were written down twice, in
  two AGENTS.md files, which is the shape of a missing tool.
- `dangler/checks.ts` runs through a `mktemp` and `sed` dance because Node strips
  TypeScript but will not resolve the `@/` alias.

The obvious reading — "this repo needs a test runner" — is what
`checks.ts` itself predicted, and it points at the wrong problem. The expensive
friction was never running assertions; it was getting a browser to answer
questions. A unit runner would have solved the third item and none of the first
two.

## Decision

`@playwright/test`, in `tests/`, with `tests/support/experiment.ts` as the only
thing a spec needs: it opens an experiment, waits for `window.experiment`,
collects everything the page complains about, and hands back a handle typed with
that piece's own `ExperimentApi`.

Four choices inside that are not obvious.

**It asserts on numbers, not on pixels.** This is the important one and it goes
against the instinct for a repo full of programmed graphics. The evidence is in
`src/experiments/dangler/AGENTS.md`, where almost every recorded bug is followed
by a note that it was invisible on screen — a wrong wire and a right one both
look like a scatter of dots. The flicker units bug, the temporal frame roll, the
anchor reshuffle, the 295 m/s spin: all found by measurement. A pixel baseline
over an additively blended canvas rendered without a GPU would fail for reasons
nobody can read, and we would learn to ignore it. Stills are still captured, into
`.scratch/shots/`, as evidence for a human to look at; nothing compares them.

The one exception is deliberate and coarse: `tests/dangler.spec.ts` counts canvas
pixels brighter than the ground colour, and asserts only that there are some.
That is robust at any resolution, and it is what catches the documented bug where
a resize cleared the canvas while the loop was parked.

**The machine's own Chromium**, via `executablePath`, rather than Playwright's
download. One is installed everywhere this repo gets worked on and nothing here
needs a patched build. Playwright 1.62 has no install script, so its own browsers
arrive only from an explicit `npx playwright install` — using the system one means
a checkout is testable without that step. The lookup falls through to `undefined`
when no candidate exists, which produces Playwright's own "run npx playwright
install" message, better than anything invented here. CI wants the opposite,
though: `PW_USE_BUNDLED_CHROMIUM=1` forces the fallback so a runner that happens
to ship `/usr/bin/chromium` still tests against a known build.

**`globalSetup` rather than Playwright's `webServer`.** Astro 7 runs its dev
server as a daemon, and decides for itself whether to: `astro dev` detects an
agent environment (via `am-i-vibing`, which reads `CLAUDECODE` among others) and
daemonises, while staying in the foreground for a human at a terminal.
Playwright's `webServer` treats a command that returns as the server having
"exited early" and fails the run — so the harness worked for one of us and not
the other, which is the worst possible failure mode for shared tooling.
`ASTRO_DEV_BACKGROUND` cannot help: it can only force the daemon on.
`tests/support/dev-server.ts` therefore asks for `--background` explicitly and
waits for the port itself. The server outlives the run on purpose; repeat runs
skip a cold start, and `npx astro dev stop` ends it.

**Its own port, 4355.** Worktrees share a machine, so the 4354 in
`astro.config.mjs` usually already has a human's dev server on it, and reusing
that would silently test another branch's code.

## Consequences

- Every test in `tests/dangler.spec.ts` corresponds to a stated invariant or a
  bug that actually happened. Each was checked by breaking the source and
  confirming the test went red, which is the only evidence that a test written
  after the fact is testing anything.
- A console error, an uncaught exception or a failed request on the page fails
  the test that saw it, whether or not that test asked. A test that means to
  provoke one empties the array to say so.
- Callbacks handed to the API run inside the page, so nothing from the test's
  scope comes with them. The signature makes that boundary explicit — the
  callback destructures `{ api, arg }` — because the first version closed over a
  local and threw `ReferenceError` in the browser.
- `@types/node` is now a devDependency. The header of `dangler/checks.ts`
  explains that it was avoided because that file was the only one in the project
  running outside a browser. That is no longer true, and the reason has therefore
  expired rather than been overridden. Typecheck and lint were clean before and
  after; the codebase uses `window.setTimeout`, so no timer type changed meaning.
- Playwright's runner resolves the `@/` alias, including for a file that never
  opens a page. This removes the reason to add a second runner, and it means
  `checks.ts` could move into `tests/` and lose its `mktemp` dance.

**Left open deliberately:** whether `checks.ts` becomes a spec. It is 746 lines of
assertions with its own contract — it exits non-zero, it is meant to be run by
hand after touching the physics, and its header argues for being a script. Moving
it is a decision about that contract, not a mechanical port, and nothing here
depends on it.

Resolved the same day by `20260827-a-unit-runner-for-the-experiments`, which also
revisits the "no second runner" reasoning under Considered Options below: speed,
not the alias, turned out to be the argument that mattered.

## Considered Options

**Vitest, for the alias and a unit runner.** It would have fixed the
`mktemp`/`sed` dance and put the settings validators under test, which
`src/experiments/AGENTS.md` nominated as the first thing to test. It would not
have touched the two frictions that actually cost time. Playwright resolving the
alias made it redundant; if a unit runner is ever wanted for speed, that is a
separate decision with the browser harness already in place.

**Playwright's `toHaveScreenshot` baselines.** Rejected on the repo's own
evidence, above. If a baseline is ever wanted, the settings panel is the
deterministic DOM candidate — not the scene.

**Defeating Astro's agent detection** by clearing `CLAUDECODE` for the dev
server's environment, keeping Playwright's `webServer`. Rejected as a guess at
another package's internals that only covers one agent: the next person running
this from a different editor would hit the same failure with no clue why.
