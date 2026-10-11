---
slug: hexgrid
title: Hexgrid
summary: A dark hexagonal grid that blooms from a few black centres, each hex lit from a point in its middle until a dark hole opens there and swallows it — neighbours alike in lightness and apart in hue.
started: 2026-10-11
updated: 2026-10-11
poster: ./poster.webp
tags:
  - canvas
  - generative
---

Hexagons stand apart on black. Each comes in as a point of colour in its middle
that spreads to its edges, and then a soft dark hole opens where the colour began;
it goes by that hole widening until it swallows the hex. A few hexes are darker still: centres, and every other hex belongs to the
nearest one. The colour grows out of the centres unevenly, quicker through some
hexes than others, and each hex takes a faint outline once its colour is full;
then the colour leaves the way it came, taking the outline with it, while the
next pattern is already growing. Each time it
goes, a new pattern is drawn: new centres, new hues. Every coloured hex shares
one lightness and one saturation and differs from its neighbours only in hue.
