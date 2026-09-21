# Context map

This repo holds three bounded contexts. They share a build, an origin and a
deployment, and deliberately nothing else.

| Context         | Lives in                                                              | Glossary                     | Decisions                                       |
| --------------- | --------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| **Site**        | `src/pages`, `src/components`, `src/layouts`, `src/styles`, `src/lib` | none yet                     | none yet                                        |
| **Experiments** | `src/experiments`, `src/pages/experiments`                            | `src/experiments/CONTEXT.md` | `src/experiments/docs/adr`                      |
| **Showcase**    | `src/showcase`, `src/pages/showcase`                                  | `src/showcase/AGENTS.md`     | `src/experiments/docs/adr` — see the note below |

Decisions that cut across all three — tooling, CI, repo conventions — live in
`docs/adr/` at the root.

The showcase has no ADR directory of its own: the records that govern it sit in
the experiments section's, because each one decides something about what a piece
must produce. `20260906-a-published-scene-is-settings-plus-a-frozen-runner.md`,
`20260907-runners-are-committed.md`,
`20260912-the-store-holds-published-runners-only.md` and
`20260913-the-showcase-imports-the-sections-arithmetic.md` are the set. That is
recorded rather than tidied, because moving them would put the decision about a
piece's output somewhere a piece's author does not read.

## Which way the dependencies run

Both boundaries are one-way, and they are not the same boundary.

**An experiment imports nothing from the site** — no layout, no stylesheet, no
component. The site may eventually link to an experiment; no experiment reaches
back. `eslint.config.mjs` enforces this and
`tests/unit/experiments-boundary.test.ts` asserts the enforcement still matches
something.

**The showcase consumes the experiments, and never the reverse.** It is a wall
of published scenes, each pinning a **frozen runner by content hash**. It may
import the section's _arithmetic_ — pure, no DOM, no knowledge of what a scene
means — and never a piece's behaviour;
`20260913-the-showcase-imports-the-sections-arithmetic.md` has the reasoning and
the two imports that exist. Nothing in the experiments section imports the
showcase.

**So changing a piece can oblige you to the showcase even though you never touch
it.** `src/showcase/AGENTS.md` heads a section _"Publishing a runner is part of
changing a piece"_, and that obligation lands on whoever changed the piece — it
is real on the amend path, where scenes already on the wall may need to move.
**A piece also needs `src/experiments/<slug>/runner.ts` before it can be
published at all**, and nothing fails if it has none; the piece is simply absent
from the wall.

This paragraph is on the map because the routing put it out of reach. Two
sessions built pieces without learning the showcase existed, having correctly
read the map, correctly picked the Experiments context, and found nothing
pointing onward — so the obligation was stated only in a document the obligated
party had no reason to open.

## Ownership

The **showcase is owned end to end by its own session**, which is why the
steward's remit excludes it — ownership, not geography, and the exclusion lapses
when nobody is tending it. `src/showcase/AGENTS.md` under _"The boundary, and who
owns what"_ is the authority, and `docs/agents/steward.md` carries the general
rule.

All three currently build as one Astro project. Whether that lasts is recorded
in `src/experiments/docs/adr/0001-experiments-inside-the-site-project.md`, which
predates the showcase and so argues the site/experiments half only.
