---
slug: kaleidoscope
title: Kaleidoscope
summary: Lines grow and split inside one segment of a circle, and the segment repeats round the centre — mirrored like a kaleidoscope, or turned like a pinwheel, with lines that can stay in their segment or wander among the copies of each other.
started: 2026-11-17
updated: 2026-11-17
tags:
  - canvas
  - generative
---

One segment of the circle is grown. A line starts near the centre and grows
outward, deciding every so often whether to split, turn or carry on, and
every other segment is that same segment drawn again, turned or reflected.

Nothing is drawn and cut away: the segment's lines are stored once and
stroked once per copy.

A line ends at the first line it meets — and that includes its own copies.
Kept inside its segment, it meets its own reflection at the segment's edge,
which is what a kaleidoscope's mirror does. Let free, it can cross the edge
and grow on among the copies until it meets one, which makes a pattern that
repeats without reading as tiles.
