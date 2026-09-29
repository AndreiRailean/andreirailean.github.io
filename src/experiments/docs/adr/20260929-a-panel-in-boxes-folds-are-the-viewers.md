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

## Considered Options

- **Tabs inside the panel**, Photoshop's answer. Not taken: they put groups out
  of sight, which makes them hard to discover.
- **Folds in the address.** Possible, and the address is opaque enough to hide
  them, but a fold describes how one person likes their panel, not the scene.

## Consequences

The boxes take width from the scene. At 1280×800 crowd needs three columns, and
the second and third cover the preset buttons at the top left; folding two
boxes brings it to two, which still covers some of them. That is open.
