---
type: ADR
status: accepted
date: 2026-10-18
summary: A piece's seed.md keeps Andrei's artistic direction verbatim and leaves out what the work answers — bug reports, implementation feedback, his questions, requests to save a preset or move a control — and a pasted address keeps its path and scene but not its host.
---

# A seed records direction, not everything he typed

## Context

`20260920-the-experiment-writer-never-blocks.md` made `seed.md` hold his seed
instruction verbatim, "then each round of corrective feedback". Followed
literally, that records every message he sends while a piece is being built,
and many of those are not about what the piece should be: "the circles that
appear on the border are cut off", "i wouldn't put the frame box as the first
control", "save it as frame of progress". Each is answered by the work — a fix
and its commit, a trap in the piece's `AGENTS.md`, a preset with its label and
hint — and once answered it is noise beside the direction that matters.

He also pastes the preview address he has open. Its host names the machines he
works from, which he did not want in a record this long; 26 lines across seven
seeds carried one.

## Decision

Andrei, on 2026-10-18: "sometimes i provide instructions for artistic
direction - those belong in seed. sometimes i ask questions and provide
feedback on implementation and bugs or ask for specific presets to be saved. i
don't think that last part is worth recording."

- **What goes in is artistic direction**: what the piece should look like, feel
  like or become, still verbatim.
- **The test is per sentence: would it still matter if the piece were rebuilt
  from nothing?** A message that mixes the two has its direction quoted and the
  rest left out, by whole sentences; a quoted sentence is never reworded.
- **A pasted address keeps `/experiments/<slug>/?s=…` and drops the scheme and
  host.** That is the one edit inside a quoted sentence.
  `tests/unit/experiments-seeds.test.ts` holds it; the direction rule has no
  check, because telling direction from a bug report needs reading.

## Consequences

Existing seeds keep what they already hold; this governs what is added. The
hosts stay in git history — this removes them from the record as it stands,
not from the past.

The rule is in `docs/agents/experiment-writer.md` under `seed.md`, the
experiment-writer skill, and the root `AGENTS.md`, which is where a session
building a piece reads it.
