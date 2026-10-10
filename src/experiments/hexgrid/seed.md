# seed — hexgrid

What Andrei asked for, in his words, and each round of feedback as it arrives.
Verbatim. This file faces inward and records him; `about.md` faces outward and
describes the work.

## 2026-10-11 — the seed

> hexagonal grid. gaps between hexagons. hexagons have colour, but it's not
> flat - it's like a gradient that goes from a darker shade in the middle to
> the brigter shade towards the edge. somewhat like a gradient circle inside a
> hexagon. colouring of the grid is in a pattern with black or very dark
> hexagon forms a center of "flower" with coloured units around it. but the
> colour doesn't spread radially outward from the dark ones, i.e. a dark hex is
> not surrounded by hexes of the same colour, the surrounding ones have the
> same "feel", but not the same colour. so it's either the intensity or some
> other property of colour/lightness that keeps them looking harmonious. there
> are multiple dark centers on the piece, so the pattern does not all radiate
> from one location. there is colour motion. so a grid pulses. first there is
> no colour and only outlines of hexagons. then the colour radiates out from
> the few dark centers. then it settles and then it fades. and so it loops. the
> whole piece is alive, so it is not done in regions where one is faded and the
> other one is not. colour feel is "vivid dark" colours are not muted and the
> darkness of the background is never hidden. the darker centers of hexagons
> and gaps between them reinforce the "dark" with the inner gradients
> providing the "vivid" bright colours. maybe even a thin light or white edge
> around the hexagons, but it's very faint and only serves to bring out the
> separation without increasing the contrast.

## Questions I could not answer, and what I assumed

_Mine, not his. Each is a control or a preset where it could be, so it can be
answered by dragging._

- **What keeps neighbours "harmonious"?** The seed guesses "intensity or some
  other property of colour/lightness". I read it as perceptual lightness and
  chroma held equal while hue varies, in OKLCH. But no screen can show every
  hue equally saturated at one lightness, so **out of gamut** chooses which
  gives way: _keep light_ (one lightness, some hues greyer) or _keep vivid_
  (hard hues move up to 0.2 lighter or darker). The primary keeps vivid,
  because the seed says the colours are not muted.
- **Tiled or scattered centres?** "a black or very dark hexagon forms a center
  of 'flower'" reads as tiled — every seventh hex a centre, ringed by six
  petals, fitting together. "the colour radiates out from the few dark
  centers" reads as scattered — few centres, several rings to travel. Both
  are there (`centres`); the primary is scattered, `flowers` is tiled.
- **Does the colour arrive everywhere at once, or wave by wave?** Every centre
  starts together unless **stagger** is up. The fade is always global, which
  is the one part the seed states outright ("not done in regions").
- **Is a settled grid still?** "the whole piece is alive" may mean the loop
  alone, or movement inside the hold. **shimmer** adds a slow per-hex
  breathing; the primary has a little.
- **Where the gradient's dark sits.** The middle of each hex is darkened by a
  round gradient, so it reads as "a gradient circle inside a hexagon". The
  falloff shape is fixed; only its depth (**core**) is a control.
