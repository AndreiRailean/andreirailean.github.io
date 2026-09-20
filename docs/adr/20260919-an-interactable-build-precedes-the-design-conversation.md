---
type: ADR
status: accepted
date: 2026-09-19
summary: For an experiment, the first interactable build comes before any spec, plan or design approval, because all of Andrei's feedback follows interaction; a general-purpose design-first process is explicitly overridden for pieces.
---

# An interactable build precedes the design conversation

## Context

`20260919-the-experiment-writer-is-the-third-gate.md` gave building a piece an
owner. It did not say what that owner should do first, and the first session to
run under it showed why that mattered.

**Andrei's feedback follows interaction, without exception.** He drags a slider
and says what he sees. He does not review a description, a plan, or a still. So
the artefact that unblocks him is not a correct piece but an _interactable_ one,
however thin.

Two things compete with that, and both are reasonable on their face.

**A general-purpose process skill prescribes design-first.** Explore, ask
clarifying questions, propose options, write a design document, get it approved,
then implement. That is a good default for work whose requirements exist before
the work does. A piece's do not: Andrei starts from imagination, and he cannot
say whether a crowd should read as a shoal or a queue until he is watching one
move. A spec extracts decisions from him that he makes better and faster by
dragging a handle.

It happened once here. `docs/superpowers/specs/2026-08-24-dangler-design.md` is
342 lines, committed 2026-08-24 12:47. Dangler's first code landed at 13:16 and
the first commit that actually **drew** anything at 13:39 — 52 minutes with
nothing to react to. Every piece since has skipped the document and embers, the
newest, has none. The practice had drifted the right way; nothing held it there,
and nothing in any agent doc mentioned the question at all.

**Bottom-up construction is the other, and it is the stronger pull**, because it
is how one would sensibly build a simulation: model the bodies, then the forces,
then the camera, and wire up a page once there is something worth looking at.

Observed directly on `crowd`, the first session to run with the role doc in
place. `body.ts`, `camera.ts` and `steering.ts` were written first and
`settings.ts` fourth; at sixteen minutes there was no route, no panel, no preview
server and nothing anyone could look at. The role doc already said "the smallest
thing that renders, then show him" and that did not hold, for two reasons worth
separating:

- it read as an item in a checklist rather than as a **stopping condition**; and
- the list put the page route _after_ it, so the step that said "show him" came
  before the step that made showing possible.

**The sizes were not the signal.** Embers' `settings.ts` was 31,689 bytes in its
own first commit, larger than crowd's at the point of observation. Only the order
was wrong, and a reading of this record that discourages thorough work would be
the wrong lesson from it.

## Decision

**The first interactable build is a gate, not a step.** Until the piece renders
in a browser and its controls move, nothing else is the most valuable next thing.
Concretely, for a new piece: `settings.ts`, the smallest thing that draws, the
page route, the kit's panel — then show him and stop.

**The panel ships with the first render.** A piece with no chrome cannot be
interacted with, so it cannot be reviewed. `CONTROLS` generates it, so two
settings are enough.

**No spec and no plan document is written for a piece**, and a design-first
process skill is overridden for this work. `using-superpowers` already yields to
repo conventions and direct user instruction; this record is that instruction,
written down so it does not depend on a session remembering it.

**Questions are asked through the work, not before it.** One that could have been
answered with ten minutes and a slider is not worth his attention.

**Reading is staged rather than done upfront.** The content governing a piece
runs to about 100KB, and reading all of it before writing anything costs the
first build its whole head start. The role doc names the two sections needed to
reach the gate and defers the rest to the area that needs it — with the piece's
own `AGENTS.md` explicitly not deferrable when changing an existing piece.

## Consequences

- **The gate is stated as a stopping condition and placed after the route**, so
  the failure mode that produced this record cannot be read as compliance.
- **This cost one session to learn and should not cost a second.** The role doc's
  first version contained the right instruction and lost to a stronger instinct,
  which is the evidence that a checklist item is not a gate.
- A piece will be shown to Andrei uglier and earlier than a session would choose.
  That is the intent: what he returns from an interactable build is a setting, a
  number and a direction, where a description returns an impression.
- **Dangler's spec stays where it is.** Records are append-only and it is
  accurate history; this decides what happens next, not what happened.
- The claim that reading is staged has no check behind it and cannot easily get
  one — it is a judgement about sequencing inside a session. It will be worth
  revisiting if a second session reaches the gate slowly for the same reason.
