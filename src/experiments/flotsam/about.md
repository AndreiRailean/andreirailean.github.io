---
slug: flotsam
title: Flotsam
summary: Specks on dark water, seen from above, shaken by waves that never take them anywhere.
started: 2026-08-29
updated: 2026-08-29
poster: ./poster.webp
tags:
  - canvas
  - generative
  - simulation
---

Look straight down at dark water with things floating on it. Nothing else is in
the picture — there is no surface, no crests, no shading. The water is never
drawn at all. Everything you can tell about it, you are reading off the specks.

## The idea

Throw a leaf into the sea and watch what the next wave does with it. It rises,
it goes forward, it comes down, it goes back, and when the wave has left it is
almost exactly where it started. The wave travelled; the leaf did not go with it.

That is not a curiosity, it is what a wave _is_. What moves across the water is
the shape, not the water. Each parcel of water traces a small circle in place and
hands the disturbance to the next one. So the whole piece is built on a form that
describes the motion of the water rather than the height of it — a **trochoidal
wave**, in which a parcel starting at `p₀` is carried to

```
p = p₀ − d·A·sin(k(d·p₀) − ωt)
```

and comes back. Not approximately: the displacement is a closed form recomputed
from the resting position on every frame, so nothing accumulates and there is
nothing for a rounding error to creep into. A sea of any violence you can set
here leaves the flotsam exactly, measurably, where it found it.

Two things fall out of that one formula, and both of them are why this looks like
water instead of like dots on a sine wave.

**The flotsam gathers itself into lines.** The map from where a parcel rests to
where it is now is compressive: water is squeezed together toward the crests and
pulled apart in the troughs. Nothing seeds those lines and nothing draws them —
turn the steepness up and floating things collect along the crests on their own,
in exactly the drifting bands a real sea shows. It is measurable as well as
visible: a uniform scatter has an index of dispersion of 1, and one steep swell
takes it past 4 in a few seconds.

**And steepness has a hard limit.** At a certain point the crest comes to a
point, and past it the map folds over itself and the water turns inside out. That
limit is a real number, it is where waves break, and the steepness control stops
just short of it.

## Speed is not a control, and that is the piece

In deep water a long wave travels faster than a short one — the relation is
`ω = √(gk)`, with real gravity — so there is nothing to choose. A forty-metre
ocean swell moves at eight metres a second. A half-metre ripple moves at under
one.

Which means the **span** control, which just decides how much water is in frame,
is not a magnification. A frame full of centimetre ripples is frantic; the same
settings on a frame two hundred metres across are glacial. Small water is
_quick_, and that is the thing about it people find surprising — a puddle
shivers where an ocean heaves, and it is the same equation doing both. A tempo
slider would have flattened all of that into one look, and would have been a lie
about the water.

## A sea has one wave in it, mostly

The first version shared the sea's steepness equally between its wave trains,
which sounds fair and is wrong. How hard a train gathers flotsam depends on _its
own_ steepness, so an even split forces a choice: two trains gather hard and
arrive on a metronome, and nine are pleasantly irregular and gather nothing.
There is no setting that is both, and the crest spacing gives it away
immediately — evenly spaced lines read as a mechanism no matter how pretty they
are.

Real water is not like that. Almost all of a sea's energy sits near one
wavelength, with a skirt of weaker components either side, and the irregularity
everybody recognises — the uneven spacing, the occasional larger set — is those
neighbours beating against the dominant one. **peak** is how sharp that
concentration is, and with it the train count stops being a trade: eight trains
with the energy piled on the middle one gives lines that are strong _and_ never
evenly spaced.

It quietly fixes the directions too. A train's share of the energy and its place
in the fan both come from where it sits in the spectrum, so the dominant train
runs along the heading and the weak ones spread out either side of it. That is
the shape a real directional spectrum has, and it arrived for free.

## Wind does not blow at one strength from one quarter

**gusts** is the weather. The chop gets up and lies down again over half a
minute, and the whole sea comes round a few degrees over a couple of minutes, so
the crest spacing you were looking at is not the crest spacing a minute later.

A gust moves energy between the trains rather than adding any. The total
steepness stays exactly what the slider says, which keeps the control honest and
means the sea cannot gust its way past breaking — what changes is the
_distribution_, so the short waves come up over the swell and fall back again,
and the apparent period wanders with them.

One consequence, and it is why the presets all run diagonally: crests are square
to the heading, so a sea travelling along a screen axis lays its lines along the
other one. On a wide window that is six or seven parallel rules across the
picture, which reads as ruling however irregular their spacing is. Diagonally
there are three or four and they leave at the corners.

## What the light is doing

Flotsam lies flat and turns with the surface under it, which makes every speck a
tiny mirror. Where the water tilts toward the light, a band of them comes round
to the mirror angle together and flares together — so the waves themselves become
visible as brightness sweeping across a frame in which no water was ever
rendered. That is the same effect as the glitter path a low sun lays across the
sea, and it behaves the same way: bring the light down toward the horizon and the
band narrows, then fades out entirely, because the water is no longer steep
enough anywhere to reflect it back at you. A low light needs a rough sea to show
anything at all.

**shade** reads the same waves a quarter of a cycle out of step, by height rather
than by tilt. Turning one down and the other up moves the bright bands without
touching the sea.

## Size is not only how big a dot looks

A speck far smaller than a wave rides it exactly. A raft that spans several
wavelengths sits across crests and troughs at once and hardly moves — it averages
the surface over its own footprint. So widening the **size** range visibly pulls
the population apart: the fine stuff traces every ripple while the large pieces
beside it heave only on the swell and ignore the chop entirely.

Which is why sizes are drawn from a **power law** rather than evenly. That was
the second attempt. Spreading them evenly across the octaves sounds reasonable
for a range covering a factor of three hundred, and it puts a sixth of everything
in the largest octave — nine thousand pieces becomes fifteen hundred fat white
discs, and the fine haze the gathering is legible in disappears underneath them.
A power law is what broken-up things actually follow, gravel and ice floes
included, and it puts nine in ten pieces in the bottom tenth of the range. A sea
with debris in it, rather than a sea of debris.

## Currents, which are the only things that go anywhere

There is a **drift** and a **set** — how fast the water is moving and which way,
in the old sense sailors use. And there are **eddies**, a slowly turning field so
that different corners of the frame genuinely disagree about which way is
downstream.

The eddies are built as a stream function and read as its perpendicular gradient,
which makes the field incompressible to machine precision. That is not
housekeeping. A field of sines used directly as a velocity has places the water
flows out of and places it flows into, and floating things pile up at the second
kind and never leave; within a minute the piece is a few permanent clots on an
empty sea. Real water cannot do that. Keeping the eddies unable to gather
anything is precisely what makes the gathering you _can_ see legible, because
then it can only have been the waves.

And there is **wave drift**, which is the honest exception to everything above.
The orbits are not quite closed. A float ends each circle a shade downwind of
where it began, and the amount comes out as the steepness _squared_ times the
wave's own speed. So how far a wave carries things depends almost entirely on how
steep it is and hardly at all on how big or how fast: a real ocean swell drifts
at a four-hundredth of its own speed, a couple of centimetres a second under a
crest doing eight metres, and a near-breaking one at a quarter of it. Both are
the same equation, and the second is most of what breaking is. On any single
frame it is invisible either way. You find out a sea has it by leaving the piece
running and noticing the flotsam has quietly ended up somewhere.

## Playing with it

Move the mouse and a small bar appears; the pointer and the controls disappear
together after a couple of seconds of stillness, like video chrome. Keys `1` to
`5` load presets, `r` rolls a fresh sea and a fresh scattering, `c` opens the
panel, `Escape` closes it, and `f` goes fullscreen. Every control has a tooltip,
and the whole scene — the seed included — lives in the address bar, so anything
worth keeping can be copied or shared.

The controls worth reaching for first: **span**, because it changes what kind of
water this is rather than how close you are to it. **trains**, which is a trade
rather than a quality knob — the steepness is shared out among them, so one train
gives a single hard swell that draws itself in flotsam, and nine give a rich
confused sea that barely gathers at all. And **steepness**, which is the one
number that decides how violent the water is, how hard it collects things, and
how far it carries them.

Six of the sliders are logarithmic, which is new to this section. Their ranges
cover orders of magnitude, and on a linear track the entire small end of each
would sit in the first per cent.

While it is on screen it holds the display awake, the way a video does, since the
point is to leave it running. Browsers only allow that on a secure connection, so
opening the page over plain http from another machine gets the water but not the
wake lock.

## What went wrong, and what it taught

Almost none of this was visible on screen. Flotsam that has gathered correctly
and flotsam that has gathered for the wrong reason look identical, which turns
out to be the most dangerous failure mode a piece like this has.

- **The best-looking result in the whole build was a bug.** With a strong
  swirling current the flotsam swept itself into a few dense clots on an
  otherwise empty sea, spectacularly — an index of dispersion of 134 against a
  baseline of 1, with the waves compressing the water by barely a factor of two.
  The eddies were doing it, and the eddies are provably incompressible. The
  missing half is that the specks live on a **wrapped patch** so the frame never
  runs out, and a uniform density is only carried around a torus by a flow that
  is periodic _on that torus_ — otherwise the flow stretches the patch and it is
  folded back onto itself unevenly. Quantising every eddy to a whole number of
  cycles across the patch took it from 134 back to 0.96. The piece looked worse
  afterwards, and was right.
- **Then the integrator turned out to be doing a smaller version of the same
  thing.** A forward Euler step lands just outside the true arc on a turning
  flow, and the error compounds into a slow drift away from each gyre: 1.08 after
  a minute where a midpoint step gives 0.96. Trivial next to the first problem
  and worth fixing anyway, because a piece whose subject is what gathers flotsam
  cannot have an integrator that gathers it.
- **The scatter had a pattern in it that nobody put there.** Positions came from
  a low-discrepancy sequence, copied from the previous experiment in this
  section, where it exists to stop eighty points clumping into accidental pairs.
  At nine thousand points a pixel or two across it does something quite
  different: its evenness reads as a faint diagonal ruling across the whole
  frame. Every structure on this water has to be the waves' doing, and that was
  structure the scatter arrived with. Uniform random, which is what it was
  supposed to be an improvement on, is correct here — and it hands the dispersion
  measurement a baseline of exactly 1 for free.
- **The first version was a starfield.** Two thousand soft blobs about twenty
  pixels apart, each with a halo nearly as wide as the gap. The gathering was
  measurably happening the whole time and there was no way to see it, because
  density can only read as texture in a population dense and fine enough for
  texture to exist. Ten times as many pieces, a tenth the size.
- **A comment claimed wave drift was "a few centimetres a second".** True of a
  real sea and false of this one, which runs at steepnesses the ocean only
  reaches just before it breaks. Writing the same quantity in the units the piece
  actually controls — steepness squared times phase speed — turned a wrong
  sentence into the most interesting true one in the file.
- **The sea was too regular, and the fix was to stop being fair.** Sharing the
  steepness equally between components is the obvious thing to do and it makes
  the trade above unavoidable. Concentrating it on one, the way a real spectrum
  does, was fewer lines of code than the version it replaced and removed the
  most-noticed flaw in the piece.
- **Half of every range control had never worked, in this piece or its
  neighbour.** A bound pair is two sliders laid over one track with the selected
  interval painted between them, and that painted bar is a pseudo-element — which
  makes it the _last_ thing in the row, drawn on top of both sliders. Its left
  edge falls exactly on the lower handle, so that handle could not be picked up
  at all, while the upper one sits a pixel outside the bar's right edge and
  worked perfectly. A row that is half draggable does not look broken; it looks
  like there is a knack to it. It had been shipped for as long as the control had
  existed, and nothing but a real mouse press could have found it — a test that
  measured the layout would have passed on it, and did.
- **A setting called `span` collided with a stylesheet.** The chrome names the
  parts of a settings row so a piece can paint them — and it also put each
  slider's own key on it as a class. This piece has a control named `span`,
  which is the name of the two-handled row a bound pair renders as, so the
  plain span slider quietly picked up the rules for a range and came out lit on
  both sides of its knob. The key is a data attribute now, which closes the same
  hole for every other name at once. Nothing had ever selected on that class,
  which is exactly why nobody had noticed it was a shared namespace.
- **A test read a real four-to-one compression as almost nothing.** The gathering
  is measured by counting pieces in a grid of cells, and the wave under test was
  shorter than a cell. The instrument has a resolution, and a number from it
  means nothing until you know the number is above it.

## How it is built

Plain canvas 2D, no libraries. Every piece of flotsam lives in flat arrays, and
each one's size, colour and home are drawn from generators salted with its own
index — so piece seven is the same piece whether there are a hundred or nine
thousand, and raising the count adds to the water instead of restirring it.
Specks are pre-rendered sprites cached by colour and composited additively,
which is both how light behaves and order-independent, so nothing here ever
sorts anything.

How much of each wave a piece feels is a table, since it depends only on a radius
and a wavelength and neither changes between frames. So does its wave drift,
which in deep water is one constant vector per piece. What is left for the inner
loop is a sine and a cosine per piece per wave train.

Reduced-motion preferences get a still frame with all the shape and gathering
intact — the clock simply stops rather than the sea being flattened, which is the
one place this piece cannot do what its neighbour does, since the waves have no
speed setting to turn down.
