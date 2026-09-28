---
type: ADR
status: accepted
date: 2026-09-28
summary: A panel row that can do nothing in the current scene is drawn dimmed and disabled in place, never hidden, because hiding rows made the bottom-anchored panel jump whenever a layer was switched.
---

# An inert control is disabled, not hidden

## Context

Crowd's panel grew to 45 rows, and #242 split it into layers — a core, the
crowd, and ground, boulders and chase — so that a scene would show only what it
used. The kit's governed groups (#248) did that by **hiding** a group's rows
while the control in its heading held its off value.

The panel is anchored to the bottom of the frame. Hiding a dozen rows shortened
it, so every switch of a layer moved the whole panel, and every row still in
view moved with it. Andrei: "ground slider makes the whole pannel jump… we can
disable unused controls without hiding them." He also named the confusion
behind it: hiding tried to do two things at once, marking what does not matter
and making the panel smaller.

## Decision

A kit control may declare `inert(settings)`, and a governed group makes every
row under its governor inert while the governor is off. An inert row is **drawn
in place**, dimmed (`data-inert="true"`, `aria-disabled`) and with its inputs
disabled. Nothing is removed, so the panel keeps its shape: measured on crowd,
its top and height do not move across open ground, a way and a loop (58 px and
980 px each time).

Only the kit disables. Making an inert setting's value canonical, so that two
scenes that look alike match the same preset, is the piece's `normalizeSettings`
job. Crowd holds its rules in one `INERT` table that both marks the rows and
resets the values, and `src/experiments/crowd/tests/layers.test.ts` holds that
each reset is the identity.

## Considered Options

- **Hiding the rows** — built in #248 and replaced by this. It does shorten the
  panel, which is a real goal, but it moves every row under the pointer.
- **Collapsing a group on request**, a heading the viewer clicks. Not built: it
  meets the size goal without moving anything the viewer did not touch, and it
  is the thing to reach for if a long panel becomes the complaint.

## Consequences

A long panel stays long. The size goal is not met by this, and was not meant to
be; it is the collapsing option above if it matters.
