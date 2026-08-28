---
type: ADR
status: accepted
date: 2026-08-28
summary: Independence belongs to what a piece draws, not to the chrome around it; notes and index become one themed gallery.
supersedes: 0002-experiments-are-not-generalised
---

# The piece is independent, the gallery is not

## Context

ADR-0002 refused a shared layout, theme or component across experiments. Its
reasoning was sample size, stated plainly: "with exactly one experiment, any
shared layout encodes the first one's choices as everyone's defaults." It set
its own revisit condition — a second experiment, showing what is actually
common — and accepted duplication between about pages knowingly in the
meantime.

A second experiment now exists, the index has become a gallery with posters and
placards, and what the two pieces have in common is measurable rather than
speculative.

**The notes converged.** Both are the same three things: a full-bleed `<canvas>`
running the piece behind, a blurred translucent sheet over it, prose inside.
About 53% of the two files is byte-identical, and most of the remainder is the
same rules holding different values — seven colour tokens, `0.55` against `0.5`
opacity, `0.75rem` against `0.5rem` radius. That is one layout with two
palettes, not two visual languages.

**The chrome converged harder.** The two pieces independently arrived at the
same class vocabulary: `#ui`, `.bar`, `.panel`, `.row`, `.label`, `.value`,
`a.about`, `button[data-active]`. Two `controls.ts` files totalling 752 lines
build the same instrument twice.

**The duplication bought drift, not independence.** The two notes have different
ways out — Starry Night renders a `<nav>`, Dangler a `.back` link. Nobody chose
that. Freedom to look different was spent on being accidentally inconsistent
about the one thing a reader needs to work identically everywhere.

ADR-0002's fear is answered on its own terms. The shared structure is not the
first experiment's taste imposed on the second; both reached it separately, which
is what "shows what is actually common" was asking for.

## Decision

Independence is scoped to the piece, not to the section.

**The artwork is what is on the canvas. Everything you can click is gallery.**

- **The piece stays wholly its own.** What it draws, its palette, its motion, its
  geometry, its settings and its presets. No shared anything reaches inside a
  piece's rendering. This half of ADR-0002 survives intact and is not up for
  revisiting.
- **The gallery is one thing, themed per piece.** The index, the note pages, the
  placard, and the way out. A single implementation that each experiment tints
  by supplying tokens, so Starry Night's note stays blue-black and Dangler's
  stays warm while the furniture is identical.

Shared gallery code lives in `src/experiments/gallery/`. A piece imports from it;
nothing in `gallery/` imports from a piece.

Doing the notes first and the chrome second is sequencing, not scope. Both are
gallery.

## Consequences

- An experiment can no longer give its note a different structure. It chooses
  colour, and the piece behind the sheet; it does not choose where the way out
  goes. That is the point — a gallery does not make you relearn the light switch
  in each room.
- A third experiment inherits the note and, later, the chrome. This is the
  argument for acting on two data points rather than three: waiting means
  writing `controls.ts` a third time in order to delete it.
- The boundary has to be defended in review. "Gallery" is not a licence to hoist
  anything two pieces happen to share — a shared _rendering_ concern is still a
  violation. The test is whether a visitor would be confused to find it working
  differently in the next room.
- `CONTEXT.md` gains **gallery** as a term, since the section now has a word for
  the half that is common.

## Considered options

- **Wait for a third experiment**, as ADR-0002 literally says. Rejected because
  the third experiment is the reason to act now, not the reason to wait: it
  would otherwise arrive by copying a note and a chrome that are already known
  to be duplicates.
- **Unify notes and chrome in one change.** The larger payoff, and rejected only
  on reviewability — the chrome is what every existing browser test drives, and
  a diff that moves the notes and the instrument at once is hard to judge.
- **A full section theme** — one type scale and palette structure across index,
  notes and chrome. Deferred rather than rejected. It is the thing ADR-0002 was
  most right to fear, and there is not yet evidence that the pieces want a
  common type scale, only a common structure.
