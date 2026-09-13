---
type: ADR
status: accepted
date: 2026-09-13
summary: The showcase may import the section's pure arithmetic and never a piece's behaviour, so "the one import from their side" becomes a shape rather than a count.
---

# The showcase imports the section's arithmetic, not a piece's behaviour

## Context

`20260828-the-piece-is-independent-the-gallery-is-not` sets the direction of the
dependency, and `src/showcase/AGENTS.md` stated the showcase's half of it twice:
as a rule — "**Nothing here imports a piece.** Not `src/experiments/<slug>/anything`,
not even a type" — and as a count — "**The one import from their side is
`gallery/gesture.ts`** … If that ever needs to change, it is a conversation, not
an edit."

Autoplay gained a shuffled order (`?shuffle`), which needs a seeded generator:
seeded rather than `Math.random`, for the reason `playwright.config.ts` gives
about the pieces — a failure has to be a real difference and not weather.

`hashSeed` and `makeRng` already exist at `src/experiments/random.ts`. They are
there because of
[`20260829-a-third-copy-of-the-generators-moves-to-the-section`](20260829-a-third-copy-of-the-generators-moves-to-the-section.md),
which hoisted them out of Dangler, Flotsam and Psyxels on the third
byte-identical copy, and placed them at the section level rather than in `kit/`
precisely because they travel alone and need no browser.

So the count said no and the rule the count was serving said yes. The showcase
was about to become the fourth place in this repo to write mulberry32, and the
ADR that prevented the third exists two directories away.

## Decision

The line is the **shape** of what is imported, not how many things are:

> The showcase may import the section's arithmetic, and never a piece's
> behaviour.

Something qualifies when it is pure, touches no DOM, knows nothing about what a
scene means, and is tested in the node suite. Two things qualify today:

- `gallery/gesture.ts` — the swipe thresholds, so the wall and the interactive
  view cannot drift apart by accident.
- `experiments/random.ts` — `hashSeed` and `makeRng`, for the shuffled lap.

The count is expected to stay small, and **adding a third is still a
conversation rather than an edit**, as is changing either of these two. What has
changed is that the conversation is now about whether a candidate has the shape,
instead of about a number that was only ever a description of how many things
happened to qualify so far.

## Considered options

**Copy the generators into `src/showcase/`.** Honours the letter of "nothing
here imports a piece" and would have been four lines. Rejected because it breaks
the rule that clause exists to serve: the clause is about a piece's _behaviour_
leaking into a consumer that must not depend on it — a packed scene is
positional, a runner is frozen bytes, and the showcase must not learn to read
either. A pure PRNG carries none of that. The repo already paid for this lesson
three times and wrote it down; taking the fourth copy in order to obey a
sentence would be reading the sentence instead of the reason.

**Re-hoist the generators somewhere neutral** — a package, or the repo root —
so neither side imports the other. Rejected as premature: it would move code
that three pieces and one consumer use to a location nothing else occupies, to
resolve a tension that a sentence resolves. If the showcase is ever lifted out
of this repo, `gesture.ts` and `random.ts` travel with it, and that is when the
question becomes real.

## Consequences

`src/showcase/AGENTS.md` states both the rule and the two imports, and the
"Nothing here imports a piece" bullet now points at the boundary section rather
than reading as an absolute.

**The exposure is real and bounded**: a change to `random.ts` can now alter the
showcase's play order, where before it could only alter how pieces look. It
cannot alter a published scene — those are pinned bytes — and the order is not
something an entry's pin protects. A seed pinned with `?seed=` reproduces a
sequence against a given `random.ts`, not across a change to it.

This does not widen the rule for anything stateful. The idle-hiding in
`viewer.ts` remains a deliberate second copy of the kit's rather than an import,
because `kit/controls.ts` is the control surface, holds DOM and state, and fails
every part of the test above.
