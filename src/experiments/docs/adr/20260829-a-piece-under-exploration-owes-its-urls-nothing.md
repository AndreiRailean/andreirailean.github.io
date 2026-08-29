---
type: ADR
status: accepted
date: 2026-08-29
summary: While a piece is still being explored, its presets, defaults and already-shared URLs are not to be preserved — compatibility is a constraint nobody asked for and it costs solution space.
---

# A piece under exploration owes its URLs nothing

## Context

Settings round-trip through the query string, which makes a URL the unit of
sharing in this section. That is worth having, and it quietly grew into
something else: a belief that a URL, once shared, must keep meaning what it
meant.

Nothing had decided that. It accumulated. Dangler's `AGENTS.md` notes that
replacing its defaults "invalidates the length of every URL already shared; that
was accepted once, knowingly", which reads as a cost to be paid rarely. Flotsam's
settings then carried the same language, and its author found several changes
being shaped around it: two new controls given defaults that were exact no-ops so
that existing scenes would render identically, and a size distribution left as a
constant partly because moving it would change what a shared link showed.

The last of those was a real cost. The exponent of the size distribution had a
comment saying it was "a distribution, not a knob". It became a knob the moment
someone tried to make a scene dimmer and found that every other lever — the
count, the size range, the halo — also changed _what was floating on the water_.
The constraint had hidden the control that was actually needed.

Stated by the piece's author, in those words: do not worry about breaking
existing presets, that is a constraint that may be hard to hold and may reduce
solution space, nothing about this experiment is final.

## Decision

**While a piece is under active exploration, its presets, its defaults and its
already-shared URLs are not things to be preserved.** A better rendering, a
better control or a better scene beats a link that still resolves.

This is not licence to be careless. What it does not cover:

- Changing what a control _means_ while leaving its name and range alone. Rename
  it, retune the presets around it, and say so in the commit message.
- Moving a recorded scene without saying which and why.
- The invariants in a piece's `AGENTS.md`, which are a different kind of thing
  entirely: properties the piece needs in order to work at all, every one of them
  learned by breaking it.

A piece may later declare itself settled, at which point this stops applying to
it and the ordinary care about shared links resumes. None has yet.

## Consequences

- `settingsToQuery` still diffs against the defaults, so moving a default still
  changes the shape of every URL. That is now a fact about the section rather
  than an argument against moving one.
- The `settingsForLanding` indirection stays, and its value is unchanged: it lets
  the featured scene change without a bare URL coming to mean something else.
  That is about _which_ scene is featured, not about freezing any of them.
- Dangler's note that its defaults were "accepted once, knowingly" is left
  as written. It is a true account of what happened at the time; this record is
  what supersedes the caution in it.
