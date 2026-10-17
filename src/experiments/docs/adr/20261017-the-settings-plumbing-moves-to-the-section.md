---
type: ADR
status: accepted
date: 2026-10-17
summary: The settings plumbing every piece copied — clamping, snapping onto tracks, the packed address, reroll — moves to src/experiments/settings-plumbing.ts, with each copy's variant as an option; normalizeSettings and legacy readers stay with the piece.
---

# The settings plumbing moves to the section level

## Context

A scan of every piece for shared code, asked for directly, found the seeded
generators already hoisted (`20260829-a-third-copy-of-the-generators-moves-to-the-section.md`)
and something much larger that was not: every one of the twelve pieces'
`settings.ts` carried the same plumbing.

- `settingsToQuery` byte-identical in 12, `urlForSettings` in two forms with the
  same output, `settingsFromQuery` and `namesASetting` in a packed-only form
  (4 pieces, born after the named form stopped being written) and a packed-plus-
  legacy form (8).
- `gridFor` and `snap` in three variants — with or without a per-key
  `FINER_GRID`, and leaving or rounding a key with no track.
- `clamp` in 13 places, `oneOf` in 4, and `reroll` identical in 9.

It went unnoticed because `tests/unit/kit-adoption.test.ts` compared what a
piece _exports_ against what the shared layers export. `snap`, `clamp` and
`oneOf` were never exported, so every copy was invisible to the check.

## Decision

The plumbing moves to `src/experiments/settings-plumbing.ts`, beside `random.ts`
and `address.ts` — section level, because a piece can take it without taking the
chrome. Every variant becomes an option rather than a fork, and each piece keeps
its exact output:

- `onTracks(TRACKS, { finer?, untracked: "keep" | "round" })` gives `gridFor` and
  `snap`.
- `packedAddress({ registry, normalize, upgrade?, legacy? })` gives the four
  address functions; `legacy` is the piece's named-parameter reader and its
  `names` predicate, and `namesANumber` is the shared half of that predicate.
- `reroller(normalize, SEED_BOUNDS)`. Bubbles keeps its own `reroll`, which
  draws over a different range; Embers and Starry Night have none.

**What stays with the piece**: `normalizeSettings`, which is that piece's own
rules, and the legacy reader, which is that piece's history. Both are handed in.

`kit-adoption.test.ts` now reads a piece's top-level definitions whether or not
they are exported, which found one more copy (`walkers/palette.ts`'s `clamp`)
the moment it ran.

## Considered

- **Leaving the named form's per-piece prelude inline in `namesASetting`.** Done
  instead as a piece-local `namesALegacySetting` passed as `legacy.names`, so the
  packed check is written once and cannot drift between pieces.
- **Folding noise in as well.** Rejected: the five noise functions are five
  different algorithms, and making them one changes pixels — a visual question.

## Verified

The address snapshot and `experiments-urls.test.ts` pin every piece's codec and
pass unchanged. A fake-clock, seeded-`Math.random` fingerprint of every preset of
every piece matched `origin/main` on all 120 stats hashes; the screenshots that
differed also differed between two runs of `main`.
