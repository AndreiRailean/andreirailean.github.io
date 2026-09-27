---
type: ADR
status: superseded
superseded_by: 20260927-a-piece-is-served-by-the-gallerys-page
date: 2026-09-27
summary: A piece's note opens as an overlay on the running piece rather than as a page of its own, and the kit's split layout separates the presets from the rest of the chrome; both land on crowd first.
---

# A note is read over its piece

## Context

Crowd reached sixteen presets, and the kit's single bar — presets, then the
actions, then `adjust`, then `about` — buried everything that was not a preset
at the far end of a row of scenes (#223).

The same review found a worse problem with `about` itself. It looked like
every other button on the piece and was the only one that left it. Getting back
meant finding "open the piece" at the top of a long page, and that came back to
the primary rather than to the scene that had been on screen. Andrei's words:
it "navigates away from the piece while looking like you're still in it".

## Decision

**The note is an overlay on the running piece.** From the piece, `about` opens
it in place and pushes the note's address, so Back closes it. A click outside
the text column, Escape, and "view the piece" close it too. Every way out
leaves the piece on the scene it was showing, because the piece never stopped.
While the note is open, the piece hears no keys.

**The note's own address is the piece with the overlay already open**, on the
primary, since there is no earlier scene to return to. A link to a note from
the index or from outside still lands on the note, and closing it rewrites the
address to the piece's.

**The kit gains `layout: "split"`.** Presets run down the left edge in columns
of five. The actions and `adjust` sit top right, with the panel opening
beneath them, and `about` has the bottom-right corner to itself. It uses the
same buttons, class names and state; only the containers differ.

Both are opt-in, and only crowd has opted in so far. The note's column is
`gallery/NoteSheet.astro`, shared by the page and the overlay so they cannot
drift. The behaviour is in `gallery/note-overlay.ts`. Crowd's two routes render
one `crowd/Piece.astro`.

## Consequences

- **A piece that adopts the overlay renders both of its routes from one
  component**, as crowd does. The checks that read a route — the page-boot rule
  in `tests/unit/experiments-pages.test.ts` and the note-accent rule in
  `tests/unit/experiments-presets.test.ts` — follow a route into
  `src/experiments/<slug>/Piece.astro` rather than exempting it.
- **The seven other pieces still open their notes as pages**, with their own
  turned-down backdrop, until each moves. Moving one is mechanical, but it
  changes what a visitor sees, so each is a review rather than a sweep.
- **Under the split layout the panel opens downward**, the opposite of every
  other piece, and `tests/kit.spec.ts` asserts each layout's own contract so
  neither drifts into the other.
