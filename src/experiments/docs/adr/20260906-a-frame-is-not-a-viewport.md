---
type: ADR
status: accepted
date: 2026-09-06
summary: Every piece renders into any box but is tuned for a viewport, and the two families break that assumption in opposite directions, so whatever renders a piece at another size owns choosing its settings.
---

# A frame is not a viewport

## Context

Every piece already sizes itself from its canvas rather than from the window:
all five read `canvas.clientWidth`/`clientHeight` and fall back to
`window.innerWidth` only when the canvas has not been laid out. Psyxels goes
further and carries a `ResizeObserver`. So a piece will render into any box it
is given, at any aspect ratio, today.

That makes it tempting to conclude a piece is portable to any frame. It is not,
and the reason is that **sizing against a box and being tuned for a viewport are
different things**. A piece's numbers were chosen while looking at it full
screen, and some of them encode an assumption about how far away the viewer is.

Starry Night states its assumption outright, in `character.ts`:

```
Count grows with area^0.75 rather than with area itself. A phone is held far
closer than a desktop monitor, so matching dots-per-area leaves small screens
looking empty; the exponent compresses that spread.
```

That is right for a viewport, where a smaller frame really does mean a closer
viewer. It is wrong for a frame inside a page, where the box shrank and the
person did not move.

## What it costs, measured

Starry Night on its `clay` preset, rendered at three frame sizes on one desktop
display. "Widest unit" is the longest horizontal run of ink, a proxy for the
largest star; "ink" is the share of pixels covered.

| frame    | dots | dots per Mpx | widest unit | ink  |
| -------- | ---- | ------------ | ----------- | ---- |
| 1280×800 | 1619 | 1581         | 28 css px   | 2.5% |
| 640×400  | 572  | 2234         | 33 css px   | 4.0% |
| 320×200  | 206  | 3219         | 21 css px   | 5.2% |

Two things move and one does not. Unit size **does not** change — `nearRadius`
is in css px and a star stays the size it was. Relative density **doubles**, and
coverage doubles with it. A sixteenth of the area is not a sixteenth of the
scene; it is a heavier, coarser version of it.

**The other family fails the opposite way.** Flotsam maps a fixed span across
the shorter side (`metresPerPx = span / shortSide`) and Dangler projects through
a field of view. For those, shrinking the frame shrinks every unit toward
sub-pixel — the scene stays whole and gets finer, rather than staying the same
size and getting crowded. Both are wrong at a small size; they are wrong in
opposite directions, so there is no single correction.

This is the sibling of `20260830-large-units-demand-attention.md`. That one is
about a unit being too big for what it stands for. This one is about the frame
moving underneath a unit whose size was already settled.

## Decision

**A piece stays tuned to a viewport, and the exponent stays.** Nothing here is a
bug to fix: `area^0.75` is correct for the case it was written for, and the
pieces that scale a world are correct for theirs.

**Whatever renders a piece at a size it was not tuned for owns choosing settings
for it.** A scene found full screen is not the same scene at a quarter of the
width, and the fix is a different set of numbers rather than different code.

## Considered and rejected

**Teach pieces a viewing-distance or physical-size hint.** A piece could take
the frame's real size and correct its own density. It would need a number
nothing can supply — CSS pixels say nothing about how far away a screen is —
and it would put a second, invisible input in front of every setting a person
had already chosen. Rejected: it replaces a knowable problem with an
unknowable one.

**Normalise every piece to one convention**, either all-pixel or all-world.
Rejected as a solution looking for a problem: the two conventions are each right
for the piece that chose them, and Flotsam's note about a phone and a monitor
seeing water of the same size is a deliberate property, not an accident.

## Consequences

- The gallery's interactive view, which renders pieces at phone sizes, is
  already relying on the tuned-for-a-viewport case and is fine. Its own record,
  `20260901-the-gallery-presents-a-piece-on-a-phone.md`, states the assumption
  more broadly than this one supports — "a narrow viewport is just another aspect
  ratio" — and now carries a note pointing here, because a session designing a
  page-sized frame read it as a deliberate choice about full-bleed that it would
  be contradicting.
- **Aspect ratio is not the variable.** Worth saying because pinning one is the
  obvious first move for anything presenting a scene across devices, and it does
  not address this: 1280×800 and 320×200 in the table above are both 8:5, and the
  density between them doubles. Fixing the shape fixes the crop and leaves the
  picture to be chosen.
- A poster captured at one size is not a preview of the piece at another.
- Anything that ever renders a piece into a page-sized region rather than a
  viewport should expect to want its own settings, and should not read that as
  the piece being broken.
