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

Hexagons stand apart on black, each lit from its edge inward round a small dark
hole. A few hexes are darker still: centres, and every other hex belongs to the
nearest one. The colour grows out of the centres unevenly, quicker through some
hexes than others, and each hex takes a faint outline once its colour is full;
then the colour leaves the way it came, taking the outline with it, while the
next pattern is already growing. Each time it
goes, a new pattern is drawn: new centres, new hues. Every coloured hex shares
one lightness and one saturation and differs from its neighbours only in hue.
