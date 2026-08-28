---
type: ADR
status: accepted
date: 2026-08-28
summary: Three layers — the piece owns its rendering, the gallery is imposed and uniform, the kit is offered and declinable.
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

Three layers, distinguished by **who is spared the relearning**.

- **The piece** — what it draws. Palette, motion, geometry, settings, presets. No
  shared anything reaches inside a piece's rendering. This is the half of
  ADR-0002 that survives intact and is not up for revisiting.
- **The gallery** — the surfaces a visitor crosses _between_ pieces: the index,
  the notes, the way out. **Imposed and uniform**, one implementation each
  experiment tints. The beneficiary is the visitor, and the test is whether they
  would be confused to find it working differently in the next room. An
  experiment does not get to move the exit. Lives in `src/experiments/gallery/`.
- **The kit** — shared parts for building a piece's own chrome: a panel that
  opens above its trigger, preset management, the idle behaviour. **Offered, not
  imposed.** A piece composes them because it is convenient, and may build
  something else entirely if what it does needs a different control structure.
  The beneficiary is whoever is building or testing, not the visitor. Lives in
  `src/experiments/kit/`.

The chrome is kit, not gallery. An earlier draft of this record said "everything
you can click is gallery", which was wrong, and wrong in the direction that does
damage: it would have made the control layout a rule rather than a convenience,
and a piece that genuinely needed different controls would have had to argue
with an ADR to get them.

The section already runs this pattern one level down and it works. `AGENTS.md`
requires every piece to expose `window.experiment` with a minimum surface —
`get`, `set`, `preset`, `panel`, `idle` — and says nothing about how any of it is
implemented. A shared contract with a free implementation. The kit is the same
bargain with the parts supplied.

Nothing in `gallery/` or `kit/` imports from a piece. The dependency runs one
way, as the section's does with the site.

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
- **Unify notes and chrome in one change.** The larger payoff, and rejected on
  reviewability — the chrome is what every existing browser test drives, and a
  diff that moves the notes and the instrument at once is hard to judge. Also
  rejected because the two are not the same kind of sharing, which only became
  clear once they were separated.
- **Treat the chrome as gallery**, uniform across pieces the way the notes are.
  Rejected: it reads the convenience as a mandate. Two pieces converging on one
  control layout is evidence that the layout is good, not that the next piece
  owes it anything.
- **A full section theme** — one type scale and palette structure across index,
  notes and chrome. Deferred rather than rejected. It is the thing ADR-0002 was
  most right to fear, and there is not yet evidence that the pieces want a
  common type scale, only a common structure.
