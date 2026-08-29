---
type: ADR
status: rejected
date: 2026-08-29
summary: An incompressible flow advecting particles on a wrapped patch is not enough — a field that is not periodic on the patch concentrates them anyway, and it looks like a spectacular result rather than a bug.
---

# An incompressible field is not enough on a wrapped patch

## Context

Flotsam keeps its population on a **wrapped patch**: a piece carried off one edge
reappears at the other, so the frame never runs out and the density stays exactly
uniform without anything being culled or respawned. Anything in this section that
needs an unbounded field of moving things will reach for the same trick, because
the alternative — cull and respawn at an upstream edge — has a spawn edge, a
count and a density to keep consistent as the flow turns, and a visible advancing
front whenever one of them is wrong.

Flotsam also has a swirling current, and the piece's whole legibility rests on
that current being unable to gather anything: every clump on screen has to be
attributable to the waves, or the reader is looking at two effects at once and
can separate neither.

## What was tried

The eddy field was built as a stream function and read as its perpendicular
gradient, `u = (∂ψ/∂y, −∂ψ/∂x)`. That makes it **divergence-free to machine
precision**, at every point, for any number of terms — asserted numerically in
`tests/unit/flotsam/current.test.ts` and true. Incompressible water cannot
concentrate floating things, so the property looked settled and the reasoning was
written into the module's own comments.

## How it failed

With the waves switched off entirely and the eddies alone, one minute of
simulation took the index of dispersion **from 1 to 134**. It emptied most of the
frame and swept everything into a few dense clots.

It looked wonderful. It was reported as the most striking thing the piece did,
and it was investigated only because the number was impossible — the waves were
compressing the water by barely a factor of two, and nothing else was supposed to
be able to gather anything at all.

Divergence-free on the _plane_ does not carry a uniform density around a _torus_.
That needs the flow to be periodic on the torus as well: otherwise the flow
stretches the fundamental domain and it is folded back onto itself unevenly, and
the density piles up however incompressible the field was. The seam does the
gathering.

Quantising every eddy's wave vector to a whole number of cycles across the patch
took the same measurement from 134 back to 0.96.

A second, much smaller version of the same thing was found immediately after:
even periodic and incompressible, a forward Euler step lands outside the true arc
on a turning flow and compounds into a slow expansion away from each gyre — 1.08
after a minute where a midpoint step gives 0.96.

## What would make it viable

Nothing; it is structural. A field advecting particles on a wrapped patch has to
be periodic on that patch, and the cost has to be paid where it lands: the eddy
scale is quantised, a gyre asked to be wider than the patch comes back at the
patch, and the field depends on the patch and so is rebuilt when the span changes
or the window is resized.

Anything spatially _uniform_ is exempt and needs no treatment — a constant
current and the wave drift are translations, and translations commute with the
wrap. The rule bites only on fields that vary over space.
