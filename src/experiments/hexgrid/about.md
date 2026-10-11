---
slug: hexgrid
title: Hexgrid
summary: A dark hexagonal grid that blooms from a few black centres, colour travelling out ring by ring, holding, and fading everywhere at once — neighbours alike in lightness and apart in hue.
started: 2026-10-11
updated: 2026-10-11
poster: ./poster.webp
tags:
  - canvas
  - generative
---

Hexagons stand apart on black, each lit from its edge inward so its middle stays
dark. A few hexes are darker still: centres, and every other hex belongs to the
nearest one and sits some number of rings out from it. The outlines come up
first, then the colour starts at the centres and travels outward a ring at a
time, and leaves the way it came, taking the outlines with it. Each time it
goes, a new pattern is drawn: new centres, new hues. Every coloured hex shares
one lightness and one saturation and differs from its neighbours only in hue.
