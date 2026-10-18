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

## 2026-10-11 — second round

> hm, the white outline gets in the way. it's the first thing that appears out
> of the darkness. i feel it should be one of the last. it should add a
> finishing touch to a pattern that already emerged. there pulsing of the
> whole sceene appears with a stagger: white outlines fade in. nothing happens
> for a little bit. colours start appearing. it sits for a tiny bit, then it
> fades out into darkness. then outlines appear. fading out appears to be the
> most pleasant part because it's the most random. fading in appears to
> radiate equally from the centers and it would be better if not all the
> hexes around the black appeared at the same time, but grew. if outline is
> turned off, the dark stays too long.
>
> gradients in each hex also need a bit more tightening. the center should be
> darker and a little sharper - as if we're looking into a small hole with
> coloured water falling in from a great height. so the brigh region takes up
> more space and the darker center is darker and the transition between them
> is "faster"
>
> additionally if we could make the corners of the hexagons a little smoother

## 2026-10-11 — third round

> smaller centers of each hex. perhaps we need a slider for center size and
> gradient function. i don't think it's a linear (circular) gradient, but is an
> s-curve

## 2026-10-11 — fourth round

> i'm looking at this. can you give me a preset where fading in takes the same
> amount of time as fading out.
> /experiments/hexgrid/?s=v____H8Z5d1SwjuQHohBYQMCAQAAHgMEJPCWAym0I
>
> and another where fading in and out feels like a breath with fading in being
> the inhale and fading out being the exhale

## 2026-10-11 — fifth round

> i wonder if it's possible to fade out the hexagon by growing it's inner hole
> and when it reaches the boundaary we fade it out completely.

## 2026-10-11 — sixth round

> nice. thanks for adding the fading in, though I think we'd need to reverse.
> the idea there is more of a hole being always there but the light is now
> starting to come out of it and the gradient grows to the edges. or maybe we
> have colour appearing in the middle and then it grows and forms a hole in
> the middle. so the hex is cycling through the gradient from colour to
> darkness. i'm looking at this:
> /experiments/hexgrid/?s=v____P9gGeXGUsI7kB6IQUTMgEpAAB4DBCTwlhABtCM

## 2026-10-11 — seventh round

> [screenshot: the fade in by and fade out by rows, their buttons wrapping to
> four lines and running off the panel's right edge]
>
> fade and out controls are somewhat broken. we need to find another way to
> allow selection from descriptive options
>
> change embers to this and move it to first place/primary
> /experiments/hexgrid/?s=v____P8YSMFHCg8MlCiAweHFh4nAABR5SCTwVgZFqVd
>
> explain the difference between eased and s-curve. both appear to be doing the
> same just with a slight growth parameter difference

## 2026-10-11 — eighth round

> hard to tell where fade-in options end and fade-out options begin. file a
> ticket with steward to find a general solution. [screenshot: the stacked
> fade in by and fade out by lists, one running straight into the other]
>
> get ready to merge into main. we're publishing all presets to showcase

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
- **Wave fade against "not done in regions".** The seed asked that the fade not
  leave one region faded and another not; the first round asked that the fade
  "follow the same rhythm as the growth". I read the second as superseding:
  the default fade is now a wave, each hex leaving in the order it came, every
  hex lit for the same time. The global fade is still there as
  **fade: together**, with its length now set by the bloom's, not the other
  way round.
- **Does the colour arrive everywhere at once, or wave by wave?** Every centre
  starts together unless **stagger** is up. The fade is always global, which
  is the one part the seed states outright ("not done in regions").
- **"grew" rather than radiated.** I read it as first-passage growth: each hex
  is slower or quicker to cross at random, and the colour takes the cheapest
  way out, so the six round a centre light at different times and the front
  reaches out unevenly. **ragged** sets how much; 0 is the old clean rings.
  Another reading would be per-hex jitter on clean rings, which leaves the
  front round — not built.
- **"the dark stays too long".** I took it as the gap between patterns, and
  made the next pattern start while the last is still fading (**overlap**).
  Where two meet, their colours cross-fade. At 0 the screen was nearly dark
  38% of the time; at 0.4, 3%.
- **The hole as the way out, and in.** Fifth round asked for a fade by the hole
  growing until it reaches the edge, then a full fade. That is **fade out by:
  hole growing**; the colour holds while the hole widens and fades only in the
  last 15%. I added the mirror unasked, **fade in by: hole closing** (a bright
  rim whose hole shrinks to rest), since it costs nothing and breath may want
  it. Presets: _swallow_ (even, hole out) and _swallow breath_ (both).
- **"we'd need to reverse" — which of his two readings?** He offered two: the
  hole always there with the light coming out of it (**fade in by: light from
  the hole**, preset _glow_), or colour appearing in the middle, growing, then
  a hole forming (**bloom, then hole**, preset _bloom_, which with the hole
  growing out is the full cycle "from colour to darkness"). Both are built on
  his scene; hole closing is kept as an option rather than removed. Unasked,
  their mirrors on the way out: **light into the hole** (preset _ebb_, in and
  out through the hole) and **hole, then shrink**.
- **Eased and S-curve look alike — they are.** Both are S-shapes. S-curve is a
  logistic: at a given softness its 10–90% fall is the softness wide, with long
  tails at both ends. Eased is smoothstep: the same S drawn as a polynomial that
  starts and stops exactly, and about 1.6× steeper at the same softness
  (measured 0.15 against 0.25 wide at hole 0.27, softness 0.25). Once softness
  is wider than the hex, as in his embers (1.5), each shows only the gentle
  middle of its S and the two differ by a few hundredths. Answered rather than
  changed: he asked for the difference, not for a third shape.
- **Fade in and out as a stacked list.** Four phrases in a row of buttons
  wrapped and ran off the panel. The kit's choice took an opt-in `stacked`, one
  option per line, rather than a dropdown, so every option stays visible.
- **Is a settled grid still?** "the whole piece is alive" may mean the loop
  alone, or movement inside the hold. **shimmer** adds a slow per-hex
  breathing; the primary has a little.
- **Where the gradient's dark sits, and its shape.** The middle of each hex is
  darkened by a round gradient, so it reads as "a gradient circle inside a
  hexagon". Since the third round its size (**hole size**, the half-dark
  radius), its width (**softness**) and its shape (**gradient**: S-curve,
  eased, linear) are all controls; the S-curve is the default because he
  named it. "smaller centers" I took as the hole: 0.35 became 0.2.

## 2026-10-11 — first round

> when it fades, we want the outlines to fade as well.
> i feel that fade needs to follow the same rhythm as the growth - currently
> it stays dark for longer. so if stagger of travel is low, fade is low.
> after fading, we need to draw a completely new pattern, not the same one. so
> it doesn't loop and colours are not the same.
>
> i'm playing with this.
> /experiments/hexgrid/?s=____QMD0dilhHcgPRECxAYEAgAAPAYA
>
> i'm playing with spacing, but i don't think i want to have a grid. black
> centers can be placed randomly
