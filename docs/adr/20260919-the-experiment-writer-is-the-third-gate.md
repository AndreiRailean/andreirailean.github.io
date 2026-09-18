---
type: ADR
status: accepted
date: 2026-09-19
summary: Building a piece had no owner between the steward's invisible surface and Andrei's taste, so a third role takes that middle gate; per-experiment agent identities were the leading proposal and were rejected because the repo already refuses owner-reservations that outlive their owner.
---

# The experiment writer is the third gate

## Context

Andrei starts a piece with a statement of his imagination, and that starts a
build. He then finds himself pointing the session at the other pieces for
consistency: that position one in `PRESETS` is the primary, that a note reads
its backdrop and its furniture's hue off that preset, which four places outside
the folder know a slug. Every new piece cost him the same paragraph.

**All of it was already written, and most of it already had a test behind it.**
The primary-preset rule is `src/experiments/AGENTS.md:205`, held by
`tests/unit/experiments-presets.test.ts` with `kit-opt-out(primary)` and
`kit-opt-out(hue)` as the escape hatch. `## Adding a piece` names the four
registration points and the forced ordering between the poster capture and the
`poster:` line. He was hand-delivering a 45KB document that already existed,
because nothing delivered it — Claude Code loads `CLAUDE.md` and nothing else,
which is `20260912-claude-md-is-how-the-rules-arrive.md`, one layer deeper than
that record reached.

A second symptom pointed the same way. Tickets were being declined as belonging
to a specific piece, which read as evidence that pieces needed owners. Examined,
they were three different blockers wearing one label:

- **#117** was declined on 2026-09-04 as "the piece's rendering rather than the
  steward's". On 2026-09-12 `b7b02c2` added to `docs/agents/steward.md` — still
  at line 175 — that "an alpha floor that stops a fade reaching zero is the
  steward's". The doc now names that ticket as in scope. Nothing re-reads a
  refusal when the rule behind it moves, so the stale decline kept reading as
  current: the `AGENTS.md` shape "a declared fact nobody can clear".
- **#117 again**, on the evidence rather than the scope. Andrei looked and could
  not decide, because nothing reachable from the sliders isolates the mechanism:
  `afterglow` moves the trail length _and_ the quantisation floor, `playback`
  moves the erase alpha _and_ every other clock. Four statistics were tried and
  all four failed, one backwards — the "washed out" scene measured as _higher_
  local contrast.
- **#135** is genuine taste: a mark with organic sophistication to replace the
  flower. No role change touches that.

**What none of them was blocked on is knowledge of the piece.** #117's own
comment says what it needs — "a prototype of the fix, compared against current at
identical settings… it needs code rather than a URL". Nobody's job was to build
a thing for Andrei to judge.

## Decision

**A third standing role, scoped by a property like the steward's, which
partitions the far side of the steward's question rather than moving its line.**

| Would a visitor see the difference?                                    | Whose                       |
| ---------------------------------------------------------------------- | --------------------------- |
| No                                                                     | The steward's, unchanged    |
| Yes, and something has to be built or isolated before it can be judged | **The experiment writer's** |
| Yes, and the question is which of them is better                       | Andrei's                    |

It builds and never decides. `docs/agents/experiment-writer.md` is the role and
`/experiment-writer` enters it.

**The role ships as a skill because that is the only thing that delivers.**
Skills are listed to every session with their descriptions without anything
being read — verified again here, the skill appearing in the authoring session's
own list moments after the file was written, exactly as
`20260912-claude-md-is-how-the-rules-arrive.md` verified it. A role doc alone
would have been one more opt-in file, which is the problem rather than the fix.

**Consistency rules stay the steward's to change and the writer's to consume.**
They live in `src/experiments/AGENTS.md`, which is shared surface. That line is
what keeps the steward out of _starting_ experiments while leaving it the owner
of what makes the pieces consistent — the split Andrei asked for explicitly.

**The doc carries only what is written nowhere else**: the order of operations,
two edges of which are forced, and how he reviews. Everything else points. A
second rulebook drifts from the first and the drift is silent.

## Considered options

**Per-experiment agent identities — one role per piece, knowing how that piece
thinks.** This was the leading proposal and the reason the question was asked.
Rejected on three counts:

1. **The repo already refuses this shape.** `docs/agents/steward.md` records that
   an owned-surface exclusion **lapses when the owner does**, because a property
   scope cannot hold a reservation open on nobody's behalf. Seven standing
   per-piece identities are seven such reservations, and six are unattended at
   any moment.
2. **The artefact already exists.** Six pieces have their own `AGENTS.md`, 130 to
   459 lines, structured as exactly the grounding a per-piece agent would carry —
   "The one thing to understand first", "Traps that have already been hit",
   "Invariants worth preserving", "Verifying a change". The gap was delivery, not
   authorship.
3. **It would not have unblocked the tickets that motivated it**, which were
   blocked on a stale refusal, on missing evidence, and on taste.

**A grounding prompt per experiment**, the other candidate, is the same finding:
it is what those six files already are.

**Deciding by measurement first** — a control run giving fresh agents a real task
with and without the piece's `AGENTS.md`, the method `AGENTS.md` prescribes and
which a dotfiles session used to turn a prohibition into a clarification. Offered
and declined in favour of writing the role now. Recorded because it remains the
honest way to test whether this doc earns its length, and because declining it
means the content is judgement rather than evidence. The doc was written thin on
that account.

## Consequences

- The middle gate now has an owner, so #117 and #135 are buildable without a
  human saying a word that was never needed.
- **A fourth role would be a smell.** Three gates partition the question
  completely; a fourth would mean one of these boundaries is wrong rather than
  that a gap exists.
- The role doc is new and has been broken by nobody. The steward's is long
  because it accreted a failure per paragraph, and this one should grow the same
  way — from things that actually cost a session something — rather than by
  anticipation.
- `tests/unit/agent-docs.test.ts` now derives its list of `AGENTS.md` files from
  disk rather than naming three, and holds the section doc to instructing that a
  piece's own be read. That closes the gap
  `20260912-claude-md-is-how-the-rules-arrive.md` left open in its last
  consequence, and it found that the six per-piece files had no pointer at all.
