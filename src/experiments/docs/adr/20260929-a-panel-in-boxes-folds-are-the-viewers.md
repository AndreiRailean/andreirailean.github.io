---
type: ADR
status: accepted
date: 2026-09-29
summary: A piece may lay its panel out as a box per group stacked down the right edge, with no scrolling, and a folded box is remembered in the viewer's browser rather than in the address.
---

# A panel in boxes, and folds are the viewer's

## Context

Crowd's panel reached 46 rows in seven groups and scrolled. Andrei: "each
section could be a box and those boxes stack along the right side of the screen
masonry grid style. this would eliminate the scroll inside controller panel and
would provide better anchoring of section."

## Decision

`boxes` in a piece's `CHROME` gives each group a box of its own. The boxes stack
down the right edge and wrap into further columns to the left as the height runs
out, so nothing scrolls and every group stays in view. A box's heading folds it
to the heading alone.

**A fold is the viewer's, not the scene's.** It is kept per piece in
`localStorage`, under `kit:folds:<slug>`, with every access guarded so blocked
storage just means nothing is folded. It is never written into the address,
although the packed address could carry it unnoticed: "that is not something we
want to encode in the URL… though i'd avoid that as long as I can". A shared
link opens with every box unfolded.

**A toggle that governs a box sits in its heading**, because it switches the
whole section rather than one control inside it: "it's the whole section
that's being turned on and off". A governor with a range of values stays a row.

## Considered Options

- **Tabs inside the panel**, Photoshop's answer. Not taken: they put groups out
  of sight, which makes them hard to discover.
- **Folds in the address.** Possible, and the address is opaque enough to hide
  them, but a fold describes how one person likes their panel, not the scene.

## Consequences

The boxes take width from the scene. At 1280×800 crowd needs three columns, and
the second and third cover the preset buttons at the top left; folding two
boxes brings it to two, which still covers some of them. That is open.

**A box is exactly `--ui-panel-min` wide, and the unboxed panel was not.** The
unboxed panel took that value as its minimum content width and grew to fit its
widest row. A box is fixed at the value, border-box. So a piece that moves to
boxes loses about 1.8rem of content width, and a row that is wider than what is
left clips at the box's edge or wraps a button. When #257 boxed six more pieces,
three of them needed a wider `--ui-panel-min`: psyxels, embers and walkers.
`tests/kit.spec.ts` now checks every row of every boxed piece against its box, at
every preset, so a piece that gains a wider row fails there rather than on screen.
Crowd was tuned under the boxed rule, which is why the rule stays as it is.
