# tests — notes for agents

Two runners, split by **what a check needs** rather than by how fast it is.

| Runner     | Files                     | Command                | For                                          |
| ---------- | ------------------------- | ---------------------- | -------------------------------------------- |
| Vitest     | `tests/unit/**/*.test.ts` | `npm run test:unit`    | A function and a number. No DOM.             |
| Playwright | `tests/*.spec.ts`         | `npm run test:browser` | A real page: canvas, layout, the console API |

`npm test` runs both. The extensions are load-bearing — each runner is
configured to collect only its own, or they collect each other's files and fail
on the other's imports.

Mid-change, run one module: `npx vitest rope`, `npx vitest run settings`, or
`npx vitest` to watch. That is the whole reason the unit runner exists; the
browser suite takes seconds and a cold dev server, and answering "did I break the
solver" should not.

## The principle

**Assert on numbers. Do not compare pixels.**

Almost nothing that goes wrong in an experiment can be seen. A stretched wire, a
wire that has quietly straightened, a frame that flipped, an arrangement that
reshuffled itself when the count changed, a rate in the wrong units — all of them
look like a plausible scatter of dots in a screenshot. Read the traps list in
`src/experiments/dangler/AGENTS.md`: nearly every entry ends with a note that it
was invisible on screen. Numbers are the only way to tell.

So stills are captured, into `.scratch/shots/`, as evidence for a human to look
at — and nothing compares them. A baseline over an additively blended canvas
rendered without a GPU would fail for reasons nobody can read, and we would learn
to ignore it. The one visual assertion worth making is coarse and robust: that
there are canvas pixels brighter than the ground at all.

## Writing a check for a new experiment

1. **Unit first.** Anything expressible as a function of numbers goes in
   `tests/unit/<slug>/`, one file per module of the piece, named after it. The
   `@/` alias resolves, so import the module by the path the piece itself uses.
2. **Then the page**, in `tests/<slug>.spec.ts`, via `openExperiment` from
   `tests/support/experiment.ts`. It waits for `window.experiment`, fails the
   test on any console error, and hands back a handle typed with that piece's own
   `ExperimentApi`.
3. **Anything the piece exposes only through the pointer needs a console API
   first.** See the Console API section of `src/experiments/AGENTS.md`; a control
   that cannot be driven from `window.experiment` cannot be tested at all.
4. **Assert the property, not the current output.** Every test in
   `tests/unit/dangler/` corresponds to a bug that actually happened, and each
   one names it. A test that would pass on a broken implementation is worse than
   no test, so break the code and watch it fail before trusting it.

Callbacks handed to `experiment.api()` run inside the page: nothing from the
test's scope travels with them. Values go through the second argument — the
signature destructures `{ api, arg }` to keep that boundary visible.
