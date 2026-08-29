# The third copy moves to the kit

**Status:** Accepted — 2026-08-29

## Context

ADR-0002 declined to extract anything shared out of the experiments until "a
second _and_ a third experiment exist and show what is actually common. Two data
points, not one." Its successor,
`20260828-the-piece-is-independent-the-gallery-is-not`, kept that rule for the
kit specifically: the kit is _offered_, and a part joins it because more than one
piece has independently wanted it, not because someone anticipated that they
might.

Flotsam is the third experiment. On the way in, `wakelock.ts` was about to become
its third byte-identical copy — Dangler's and Starry Night's differed only in a
comment saying that the duplication was deliberate evidence for ADR-0002. That
comment had done its job.

## Decision

`wakelock.ts` moves to `src/experiments/kit/wakelock.ts`, and all three pieces
import it from there. It joins `controls.ts`, `fullscreen.ts` and `copy.ts`,
which had already been hoisted on the same rule.

The condition ADR-0002 set is now met for this module and only this module. The
rule itself stands: nothing else gets hoisted before three pieces want it.

## Consequences

- A piece that wants a different wake-lock policy still writes its own. The kit
  is offered, not imposed; nothing about being in `kit/` makes it mandatory.
- The wake lock is now covered once rather than three times, and a bug in it is
  fixed once. The instruction "fix it in both copies" is gone from Dangler's
  `AGENTS.md`, because there are no copies left.
- Nothing shared reaches into a piece. The kit still knows nothing about any
  experiment, and lifting `kit/` out with one experiment still leaves it
  running.

## Not extracted, and why

`random.ts` now exists in two pieces — Dangler's and Flotsam's, the latter
trimmed rather than copied. Starry Night wants none of it, so this is still two
data points and the rule has not been met. It stays duplicated, on purpose, and
Flotsam's copy says so at the top.
