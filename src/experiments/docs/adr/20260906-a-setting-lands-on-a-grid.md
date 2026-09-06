---
type: ADR
status: accepted
date: 2026-09-06
summary: Every numeric setting is snapped to a declared grid in normalizeSettings, so the console API and the query string land where a dragged handle does; the grid is the registry's, not the control's step.
---

# A setting lands on a grid, whichever way it arrived

## Context

The section already quantised, in exactly one place and for one reason.
`kit/controls.ts` cut a log track's value to three significant figures, and said
why in its own comment: _"without it a snapped value arrives as
0.30000000000000004 and goes into a shared URL that way"_.

That lived inside `valueAtPosition`, which is only reached when a handle is
dragged on a log row. Every other route into a piece's settings kept whatever
precision it arrived with — `normalizeSettings` clamped to bounds and rounded
integer keys and did nothing else. So a value set through `experiment.set()`, or
arriving in a query string, was left alone.

**The same scene therefore had two spellings depending on how it was reached.**
That is a fault on its own terms, independent of anything else: the validator is
documented as the one place every outside route passes through, precisely so the
routes cannot disagree, and on this question they did.

It surfaced while designing a packed address
(`20260906-an-address-is-packed-not-readable.md`), which needs values on a known
grid to encode them in a fixed number of bits. Landing the grid separately was
Andrei's call and is the right order: the rule is about the settings model rather
than about URLs, it fixes the inconsistency above whether or not the encoder ever
ships, and it turns that encoder into a pure representation change.

## Decision

**`normalizeSettings` snaps every numeric setting to a declared grid.**

`kit/controls.ts` owns the rule — `gridAt` and `snapToGrid` — and
`valueAtPosition` is rewritten in terms of them, so the drag path and the
validator cannot drift apart. Each piece publishes `TRACKS` and `gridFor` and
snaps inside the loop that already clamps.

### The grid is not the control's `step`

This is the whole care in the decision. **`step` is how far an arrow key moves a
handle. It has never been a claim about which values a setting can hold**, and
the section's own code already said so — `step` is documented as a _floor_ in
`valueAtPosition`, not as the grid.

- A **linear** track's grid is its `step`.
- A **log** track's grid is three significant figures, floored at `step`, because
  one uniform spacing cannot serve a track that wants hundredths at 0.15 and
  tenths at 40.
- A piece may declare something **finer** per setting, and may never declare
  anything coarser.

Three settings were recorded before their control was cut as it is now and sit
between the stops it offers today, so each declares its own resolution: flotsam
`drift` at 0.005, starry-night `clouds` at 0.01, walkers `settling` at 0.01.

**Quantising to `step` instead would have moved shipped scenes** — `pond.drift`
doubled from 0.005 to 0.01, and `busy.settling` went from 0.02 to **zero**, a
setting switched off rather than nudged. Fitting each grid instead moves nothing,
and in the packed encoding it was measured to cost nothing: three slots widen by
two or three bits and the addresses come out the same length.

## Consequences

- **A value from outside is now cut to the grid.** Exploring through the console
  API with a value between two stops is no longer possible; the answer is to
  declare a finer grid for that setting, which costs nothing.
- **No scene moves**, asserted across every piece and every preset in
  `tests/unit/experiments-grid.test.ts`, along with idempotence and the grid
  agreeing with the slider rather than merely coexisting with it.
- **A future setting recorded off its grid fails loudly** instead of being
  silently snapped, which is what makes the rule safe rather than hopeful.
- **`gridFor` is exported per piece.** A check that a value is on its grid has to
  read the grid from the piece rather than re-derive it. It is also the column a
  slot registry needs if the address ever stops being readable.

## Considered Options

**Snapping to each control's `step` and letting the three off-grid presets
move.** Simpler, one fewer concept, and rejected because two of the three moves
are not the hair's-width kind: a doubling and a setting turned off. There are no
visitors and no link to protect, so the objection is not compatibility — it is
that a scene someone chose by dragging should stay the scene they chose, which is
the same principle `20260830-a-preset-inherits-from-nothing.md` rests on.

**Re-recording those three presets on their current grid.** Legitimate, and still
open. It is a change to a picture, which is Andrei's rather than a validator's,
and the `FINER_GRID` entries can be deleted the day it happens.

**Snapping in the query-string parser instead of in `normalizeSettings`.**
Rejected on the same ground the parser exists: the console API would still be
unquantised, and the two routes disagreeing is the fault being fixed.
