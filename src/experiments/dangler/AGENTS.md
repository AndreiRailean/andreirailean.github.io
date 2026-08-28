# Dangler — notes for agents

Read `about.md` for what this is and why it looks the way it does, and
`../AGENTS.md` for conventions shared by every experiment. This file is only the
things about _this_ piece that will get broken by accident.

## The one thing to understand first

The camera is at the origin looking straight up, so a bulb at `(x, y, z)`
projects to `(f·x/z, f·y/z)`. Size and screen position both come from dividing
by depth, which is why descending bulbs grow and splay at once.

**A strand hanging directly overhead collapses to a point.** Its bulbs stack and it
vanishes. Anchor scatter (`extent`) and strand bend (`set` × `stiffness`) are the
only two things stopping that, so a change that quietly reduces either can make
the piece look broken for reasons that have nothing to do with the change.

## Traps that have already been hit

Every item below was a real bug here, and almost none of them was visible on
screen — a wrong strand and a right one both look like a scatter of dots.

- **Do not measure bending as the distance across two links.** It is
  second-order in the joint angle: at 28 segments a 0.9 rad set makes that chord
  differ from straight by 0.014%, well under the solver's own residual, so the
  constraint is noise and a rigid strand hangs as limp as a chain. Use the
  perpendicular standoff, which is first-order.
- **A bend constraint must fix direction, not just magnitude.** Constrain only
  how far a joint bends and gravity picks alternating sides, so the strand zigzags
  imperceptibly and hangs dead plumb — that is a lower centre of mass than any
  arc. `rotateArc` carries each link's rest direction onto the strand's current
  orientation for exactly this reason.
- **Do not raise `SOLVER_ITERATIONS` to buy accuracy; shorten `FIXED_DT`.**
  Measured at equal total work on one strand: 120Hz/18 passes left links 0.92%
  stretched, 240Hz/9 left 0.45%, 480Hz/5 left 0.20%. A positional solver's
  stiffness is capped by its pass count, so the chain reaches a _steady state_ —
  settling longer never improves it, and neither does iterating more.
- **`stiffness` scales rest curvature, not constraint strength.** Scaling the
  strength instead cannot hold an arc against gravity at all (the whole usable
  range fell between 0.85 and 1.0), and partial projections are unstable in a
  band of middling strengths on long chains — an 80-segment strand crumpled into
  90°-per-joint folds while the same strand was fine at both weaker and full
  strength. The projection is exact so it cannot overshoot, and therefore cannot
  pump energy in. **The cost is compliance**: a strand holds its shape and swings
  from its anchor as one piece rather than rippling. If the breeze ever needs
  more lag, that is the trade to revisit — not the exactness.
- **A frame must be carried through time, not only along the strand.** A
  rotation-minimising frame is minimal along the _curve_; nothing about that
  makes it steady between rendered frames, and re-propagating it from the strand's
  start each frame lets any change of shape accumulate into a large roll at the
  free end. Bulbs ride that frame, so they visibly turn on their strings — and
  the tip bulbs are the near, large ones. Every other frame check passed
  throughout: perpendicular, unit, no flips _along_ the strand. `checks.ts` now
  asserts the temporal property too, which is the only one that catches it.
- **Never derive a frame from a direction inside a loop that walks a curve.**
  Picking two perpendiculars requires choosing a reference axis, and every choice
  flips somewhere on the sphere, folding the rest shape where the strand curls past
  it. Both `restDirections` and `frame.ts` transport a frame instead. Symptom:
  crumpling only on finely-segmented, strongly-curled strands.
- **A tick that advanced nothing is not a scene with nothing left to do.**
  `advance` only steps once the accumulator reaches `FIXED_DT`, so a frame
  shorter than 1/480s does no substep quite legitimately — and the loop used to
  park there, stranding an animated scene with nothing left to wake it. It then
  sat frozen on whatever the last frame drew, at any settings, until an input
  woke it. Chrome's headless shell delivers its first frames microseconds apart
  and parked the piece on load; a fast enough display would do the same thing to
  a person. Parking now requires `!isAnimated()` and `ropes.atRest()` as well.
  Found only because the browser suite was run against Playwright's bundled
  browser as well as the system one — worth remembering when a check passes
  locally and nowhere else.
- **Anything that changes the picture without moving a particle must set
  `dirty`.** The loop parks itself when nothing moves, and setting `canvas.width`
  on a resize clears the canvas — so a parked loop left the piece simply gone
  after a window resize or a screenshot. Hue, glow, the debug overlay and the
  camera are all in this category.
- **Anchor `i` must stay a pure function of `(seed, i)`.** It comes from an R2
  sequence indexed by `i`, never from successive draws, and each strand draws its
  shape and its colour from separately salted generators. Break this and raising
  the strand count reshuffles the strands already on screen — the same class of bug
  as Starry Night resetting every layer's phase on a settings change.
- **Never let a particle move more than a fraction of its segment in a step.**
  Verlet reads velocity from the change in position, so a teleporting anchor is
  indistinguishable from a cannon. Dragging the branch count moves anchors
  metres, which produced tip speeds of 295 m/s that then _stayed_ there —
  past about a segment per step the solver has no resolution left and the strand
  spins indefinitely rather than damping out. `MAX_STEP_FRACTION` in `rope.ts`
  caps it, well above any wind in the piece so legitimate motion is untouched.
  Anything new that moves particles discontinuously needs this to stay in place.
- **Never settle synchronously in response to a settings change.** It was tried,
  as the fix for anchors being dragged, and it froze the main thread for 3056ms
  on a single notch of the branches slider — a strand thrown a long way does not
  converge, so the settle ran to its cap every time. A settings change must stay
  in the low milliseconds; the sliders are the instrument, and one that stalls
  under the hand is unusable however good the scene is.
  - Anchors _relocated_ rather than nudged: `ropes.carry` moves the strand with
    them. A hanging strand's shape does not depend on where it hangs, so it
    arrives already settled. Keep `CARRY_ABOVE` above a nudge of the spread
    slider (about 0.05m) so that keeps its snap, and low enough that every strand
    clears it on a topology change — at 0.25 a few fell through and produced a
    46 m/s transient.
  - A changed segment count: `resample` redraws the strand's _current_ shape with
    the new particle count, by arc length. Laying out and settling instead costs
    106ms and discards whatever the strand was doing.
  - A changed **seed**: nothing carries. Every strand's length, stiffness, set and
    twist are redrawn too, so a carried shape contradicts its own new
    constraints and the solver resolves it at 139 m/s. `createRopes` is called
    without a previous scene, and the whole thing is laid out fresh — about
    37ms, which is fine for a keypress and not for a drag.
- **Arms must span the radius, not the outer part of it.** Their first version
  held them back to the outer two thirds so they would read as separate clumps,
  but that gap scales with `spread`, so widening the canopy grew a bare disc in
  the middle and drove every bulb toward the edge of the frame. Separation comes
  from `sweep` instead, which costs no coverage. `checks.ts` asserts the span at
  two arms, which is the hard case.
- **Anything with a rate needs its units asserted, not eyeballed.** `flicker`
  drew a rate in hertz and used it as radians per second, so every bulb wavered
  with a period of eleven to fifty seconds. The control was live, the maths was
  fine, and it was invisible — a whole class of bug that neither a type checker
  nor a screenshot can reach. `checks.ts` now asserts the _timescale_ a viewer
  would experience, which is the only thing that would have caught it.
- **Anchor motion must be coherent, or the piece makes people queasy.** This is
  the one failure here that was found by a human rather than by measurement.
  `tremble` moves each anchor independently and reads as the _observer_ being
  jostled, not the scene moving — the canopy stops being an object and there is
  no stable frame left to read against. Gentler does not fix it; only coherence
  does. `sway` carries the whole canopy rigidly, so anchor separations are
  preserved to machine precision, and that check is in `checks.ts` precisely
  because it is the property the module exists for. Anything new that moves
  anchors must state which of the two it is being.
- **Keep `tremble` well above a strand's swing period.** A hanging strand swings at
  well under 1Hz, and an anchor shaken near that pumps it instead of shivering
  it: at the rates first tried, 25mm of anchor travel produced 0.43m of tip
  travel. The rates in `canopyTremble` are deliberately several times higher, and
  `TREMBLE_REACH` is small to match. Retuning either without checking the tip
  response turns the control into a second, worse gust.
- **`anchorOffsets` is a displacement, never a force, and that is the point.** A
  force integrates, so a strand under one sweeps steadily outward; an anchor that
  moves drags its strand about by roughly its own travel and stops. That bound is
  what lets a crowd be agitated without being blown apart, and it is the only
  thing `gust` cannot do at any setting.
- **`ropes.settle()` after a rebuild must take `freshStrands`.** Settling
  everything zeroes velocities, so adding one strand visibly calms every other strand
  in a breeze.

## Invariants worth preserving

- **Bulbs are drawn additively, so nothing is ever depth-sorted.** Keep it that
  way; a sort is the first thing that would stop the crowd being cheap.
- **Particles live in flat `Float32Array`s for the whole scene**, with per-strand
  index ranges. The scene is expected to grow to many strands.
- **Only `seed`, `strands` and `segments` rebuild.** Everything else is read live,
  so dragging it relaxes the scene instead of teleporting it. See `needsRebuild`.
- **`prefers-reduced-motion` gets a still frame and no RAF loop.** It needs no
  special path — pinning `breeze` and `flicker` to 0 makes the loop park itself.
- **Settings round-trip through the query string.** Anything added to `Settings`
  needs a `Control` (or explicit handling) or the panel and shared URLs quietly
  disagree.
- **`DEFAULT_SETTINGS` is the vocabulary, not the scene anyone lands on.** A bare
  URL gets `PRESETS[0]` and the address is rewritten to match; see
  `settingsForLanding`. Do not "fix" the dull landing scene by moving the
  defaults — they are the base `normalizeSettings` falls back to and the thing
  `settingsToQuery` diffs against, so changing them rewrites what every URL
  already shared means. The poster names no preset for the same reason: it
  photographs whatever a bare URL lands on, so the two cannot drift apart.
- **Core radii stay at or above `MIN_CORE_PX`**, trading size for alpha below it.
  Starry Night's sub-pixel lesson applies here unchanged.
- **The wind stays pure.** Gusts are derived from the clock and the seed rather
  than accumulated, which is what makes them reproducible and checkable outside a
  browser. A burst lasts about two seconds; no still frame can tell you one was
  ever scheduled, so `checks.ts` covers the rate, the determinism and the
  envelope instead. Note `GUST_PEAK` is sampled from the envelope at load rather
  than written down — retuning the attack or decay must not silently rescale what
  the `gust` slider means.

## Shape of the code

| File             | Holds                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| `settings.ts`    | `Settings`, the `CONTROLS` spec, presets, query parsing, `needsRebuild`     |
| `random.ts`      | seeded PRNG, clamped gaussian, the R2 sequence, disc mapping                |
| `canopy.ts`      | the invisible object overhead; `anchorFor(i)`                               |
| `arrangement.ts` | seed → strand specs and the bulb table, including per-strand colour batches |
| `rope.ts`        | the solver: flat arrays, links, directional bending, settling               |
| `frame.ts`       | rotation-minimising frames, so bulbs can sit off the centreline             |
| `camera.ts`      | projection, field of view, tilt, near clip                                  |
| `beads.ts`       | sprite cache and additive drawing                                           |
| `palette.ts`     | the ground, and what a bulb is made of                                      |
| `dangler.ts`     | the engine: canvas, the clock, wind, drawing, stats                         |
| `controls.ts`    | the panel, idle hiding, URL sync                                            |
| `api.ts`         | `window.experiment`                                                         |

`fullscreen.ts` and `wakelock.ts`, and `copyText` in `controls.ts`, are copied
verbatim from Starry Night. ADR-0002 defers extracting anything shared until a
second _and_ a third experiment exist; this is the second, so the duplication is
the evidence for that decision rather than a shortcut around it. **Fix a bug in
either copy and fix it in both.**

## Known, not fixed

**A tightly coiled strand in wind can still fold.** At `stiffness` 1 with `set`
near its maximum, a few strands in a large scene buckle to 90°-plus at a joint
whose rest angle is under 6°, and their frames re-seed when that happens —
measured, four strands in eighty. The bend constraint transports each link's rest
direction from _world space_, which leaves the strand's torsion unconstrained and
ill-conditioned when a link swings far from where it started.

The principled fix is to carry a frame along the strand inside the solver and
express each rest turn in it, so the constraint depends only on the strand's local
geometry and never on its orientation. That is a rework of the core constraint
and has not been done. A maximum-curvature constraint was tried as a cheaper
substitute and is not worth keeping: it moved the worst joint turn from 174° to
166°, because the link pass that follows simply undoes it.

## Verifying a change

`npm run build` covers `astro check` and `npm run lint` covers eslint. Neither
sees anything visual, and for this piece neither sees anything physical either.

**Screenshots lie about this piece unless you settle it first.** A still taken
while the scene is relaxing shows a shape it never actually holds, and nothing in
the image says so. Always pass `?settle=1`, and check
`experiment.stats().maxConstraintError` — it sits around 2e-4 settled, and
anything above about 1e-2 means the strands are stretching or crumpling.

- `?debug=1` draws the centrelines, anchors and canopy rim. With only bulbs
  visible, a broken frame, a broken constraint and a broken projection all look
  identical; this is the difference between debugging and guessing.
- `?panel=1` and `?idle=0` as elsewhere in the section.
- **`tests/dangler.spec.ts` drives the API under `npm test`**, and every test in
  it is one of the traps above. Add to it rather than reaching for `webcheck`,
  which cannot evaluate JS. It asserts the settled constraint error rather than
  trusting a still, so the rule above is enforced there rather than remembered.

**`tests/unit/dangler/` covers the physics, and you should run it after touching
any of it** — `npx vitest run` for all of it, `npx vitest rope` while editing the
solver. One file per module, and every assertion in them is a bug that actually
happened: anchor `i` moving when the strand count changed, strands stretching, a
stiff strand hanging as limp as a chain, frames flipping through an inflection, a
rate in the wrong units. Almost none of it can be seen, which is why it is
measured.

These began as `checks.ts`, a standalone script beside the code, and the
assertions carried over unchanged. See the repo root's
`docs/adr/20260827-a-unit-runner-for-the-experiments.md`.

Headless runs without a GPU, so trust ratios, not absolute frame rates. At 60
strands × 60 segments × 20 bulbs the solver and the fill cost about the same:
dropping `segments` to 14 and dropping `glow` to 2 each recovered roughly the
same amount. `glow` is usually the cheaper one to give up.
