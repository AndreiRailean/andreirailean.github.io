---
type: ADR
status: accepted
date: 2026-09-27
summary: Every piece is served by the gallery's page — the document, the chrome's mount, and the note read over the piece — with the kit's split layout as the only layout; a piece supplies its stylesheet, canvas, boot and note colours.
supersedes: 20260927-a-note-is-read-over-its-piece
---

# A piece is served by the gallery's page

## Context

`20260927-a-note-is-read-over-its-piece` moved crowd's note onto the running
piece and split its chrome, both opt-in for crowd first. Andrei approved both
in review and asked for them everywhere. He also asked for more: the chrome and
the note should be "a global surface so just like experiments don't have to
roll their own controls, they don't have to roll their own preset renderer and
all that."

The eight piece pages were already nearly identical: a bare document, the
piece's stylesheet, one canvas, `Reel`, `#ui` and a boot call. The eight notes
differed only in colours and a turned-down backdrop copy of the piece.

## Decision

**`gallery/PiecePage.astro` is the page.** It owns the document, `#ui`, the
interactive view and the note overlay, and serves both of a piece's addresses:
`/experiments/<slug>/` with the note closed, and `/about/` with it open on the
primary. What a piece supplies is what is genuinely its own, in
`src/experiments/<slug>/Piece.astro`: its stylesheet, its canvas, its boot, and
its note's colours. Both routes are one line.

**Every note is read over its piece**, with the behaviour the earlier record
describes. `about` opens it in place. Outside-click, Escape, Back and "view
the piece" close it on the same scene. The turned-down backdrop copies go,
along with `Note.astro`. Each piece keeps its backdrop figure as the overlay's
scrim.

**The split layout is the kit's only layout**: presets down the left edge in
columns of five, the actions and `adjust` top right, the panel beneath them,
`about` bottom right. No piece used the one-corner bar, so it was deleted
rather than kept as a second path.

## Consequences

- `tests/unit/experiments-pages.test.ts` fails a route that does not render its
  `Piece.astro`, and a `Piece.astro` that writes its own document instead of
  rendering `PiecePage`. A new piece cannot quietly roll its own page.
- The route-reading checks — page boot, note accent — follow a route into
  `Piece.astro`.
- A piece that wants a different page still can, the way it can decline the
  kit, but it now has to break a check to do it. `kit-opt-out` does not cover
  this one; that would be a decision for Andrei, not a line in a file.
- Behind a note there is now the real piece at full activity rather than a
  calmer copy. On crowd, Andrei judged that the better trade.
