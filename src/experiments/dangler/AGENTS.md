# Dangler — notes for agents

Read `about.md` for what this is and why it looks the way it does, and
`../AGENTS.md` for conventions shared by every experiment. This file is only the
things about _this_ piece that will get broken by accident.

## The one thing to understand first

The camera is at the origin looking straight up, so a bulb at `(x, y, z)`
projects to `(f·x/z, f·y/z)`. Size and screen position both come from dividing
by depth, which is why descending bulbs grow and splay at once.

**A wire hanging directly overhead collapses to a point.** Its bulbs stack and it
vanishes. Anchor scatter (`extent`) and wire bend (`set` × `stiffness`) are the
only two things stopping that, so a change that quietly reduces either can make
the piece look broken for reasons that have nothing to do with the change.

## Traps that have already been hit

Every item below was a real bug here, and almost none of them was visible on
screen — a wrong wire and a right one both look like a scatter of dots.

- **Do not measure bending as the distance across two links.** It is
  second-order in the joint angle: at 28 segments a 0.9 rad set makes that chord
  differ from straight by 0.014%, well under the solver's own residual, so the
  constraint is noise and a rigid wire hangs as limp as a chain. Use the
  perpendicular standoff, which is first-order.
- **A bend constraint must fix direction, not just magnitude.** Constrain only
  how far a joint bends and gravity picks alternating sides, so the wire zigzags
  imperceptibly and hangs dead plumb — that is a lower centre of mass than any
  arc. `rotateArc` carries each link's rest direction onto the wire's current
  orientation for exactly this reason.
- **Do not raise `SOLVER_ITERATIONS` to buy accuracy; shorten `FIXED_DT`.**
  Measured at equal total work on one wire: 120Hz/18 passes left links 0.92%
  stretched, 240Hz/9 left 0.45%, 480Hz/5 left 0.20%. A positional solver's
  stiffness is capped by its pass count, so the chain reaches a _steady state_ —
  settling longer never improves it, and neither does iterating more.
- **`stiffness` scales rest curvature, not constraint strength.** Scaling the
  strength instead cannot hold an arc against gravity at all (the whole usable
  range fell between 0.85 and 1.0), and partial projections are unstable in a
  band of middling strengths on long chains — an 80-segment wire crumpled into
  90°-per-joint folds while the same wire was fine at both weaker and full
  strength. The projection is exact so it cannot overshoot, and therefore cannot
  pump energy in. **The cost is compliance**: a wire holds its shape and swings
  from its anchor as one piece rather than rippling. If the breeze ever needs
  more lag, that is the trade to revisit — not the exactness.
- **Never derive a frame from a direction inside a loop that walks a curve.**
  Picking two perpendiculars requires choosing a reference axis, and every choice
  flips somewhere on the sphere, folding the rest shape where the wire curls past
  it. Both `restDirections` and `frame.ts` transport a frame instead. Symptom:
  crumpling only on finely-segmented, strongly-curled wires.
- **Anything that changes the picture without moving a particle must set
  `dirty`.** The loop parks itself when nothing moves, and setting `canvas.width`
  on a resize clears the canvas — so a parked loop left the piece simply gone
  after a window resize or a screenshot. Hue, glow, the debug overlay and the
  camera are all in this category.
- **Anchor `i` must stay a pure function of `(seed, i)`.** It comes from an R2
  sequence indexed by `i`, never from successive draws, and each wire draws its
  shape and its colour from separately salted generators. Break this and raising
  the wire count reshuffles the wires already on screen — the same class of bug
  as Starry Night resetting every layer's phase on a settings change.
- **Never let a particle move more than a fraction of its segment in a step.**
  Verlet reads velocity from the change in position, so a teleporting anchor is
  indistinguishable from a cannon. Dragging the branch count moves anchors
  metres, which produced tip speeds of 295 m/s that then _stayed_ there —
  past about a segment per step the solver has no resolution left and the wire
  spins indefinitely rather than damping out. `MAX_STEP_FRACTION` in `rope.ts`
  caps it, well above any wind in the piece so legitimate motion is untouched.
  Anything new that moves particles discontinuously needs this to stay in place.
- **Never settle synchronously in response to a settings change.** It was tried,
  as the fix for anchors being dragged, and it froze the main thread for 3056ms
  on a single notch of the branches slider — a wire thrown a long way does not
  converge, so the settle ran to its cap every time. A settings change must stay
  in the low milliseconds; the sliders are the instrument, and one that stalls
  under the hand is unusable however good the scene is.
  - Anchors _relocated_ rather than nudged: `ropes.carry` moves the wire with
    them. A hanging wire's shape does not depend on where it hangs, so it
    arrives already settled. Keep `CARRY_ABOVE` above a nudge of the spread
    slider (about 0.05m) so that keeps its snap, and low enough that every wire
    clears it on a topology change — at 0.25 a few fell through and produced a
    46 m/s transient.
  - A changed segment count: `resample` redraws the wire's _current_ shape with
    the new particle count, by arc length. Laying out and settling instead costs
    106ms and discards whatever the wire was doing.
  - A changed **seed**: nothing carries. Every wire's length, stiffness, set and
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
- **Keep `tremble` well above a wire's swing period.** A hanging wire swings at
  well under 1Hz, and an anchor shaken near that pumps it instead of shivering
  it: at the rates first tried, 25mm of anchor travel produced 0.43m of tip
  travel. The rates in `canopyTremble` are deliberately several times higher, and
  `TREMBLE_REACH` is small to match. Retuning either without checking the tip
  response turns the control into a second, worse gust.
- **`anchorOffsets` is a displacement, never a force, and that is the point.** A
  force integrates, so a wire under one sweeps steadily outward; an anchor that
  moves drags its wire about by roughly its own travel and stops. That bound is
  what lets a crowd be agitated without being blown apart, and it is the only
  thing `gust` cannot do at any setting.
- **`ropes.settle()` after a rebuild must take `freshWires`.** Settling
  everything zeroes velocities, so adding one wire visibly calms every other wire
  in a breeze.

## Invariants worth preserving

- **Bulbs are drawn additively, so nothing is ever depth-sorted.** Keep it that
  way; a sort is the first thing that would stop the crowd being cheap.
- **Particles live in flat `Float32Array`s for the whole scene**, with per-wire
  index ranges. The scene is expected to grow to many wires.
- **Only `seed`, `wires` and `segments` rebuild.** Everything else is read live,
  so dragging it relaxes the scene instead of teleporting it. See `needsRebuild`.
- **`prefers-reduced-motion` gets a still frame and no RAF loop.** It needs no
  special path — pinning `breeze` and `flicker` to 0 makes the loop park itself.
- **Settings round-trip through the query string.** Anything added to `Settings`
  needs a `Control` (or explicit handling) or the panel and shared URLs quietly
  disagree.
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

| File             | Holds                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| `settings.ts`    | `Settings`, the `CONTROLS` spec, presets, query parsing, `needsRebuild` |
| `random.ts`      | seeded PRNG, clamped gaussian, the R2 sequence, disc mapping            |
| `canopy.ts`      | the invisible object overhead; `anchorFor(i)`                           |
| `arrangement.ts` | seed → wire specs and the bulb table, including per-wire colour batches |
| `rope.ts`        | the solver: flat arrays, links, directional bending, settling           |
| `frame.ts`       | rotation-minimising frames, so bulbs can sit off the centreline         |
| `camera.ts`      | projection, field of view, tilt, near clip                              |
| `beads.ts`       | sprite cache and additive drawing                                       |
| `palette.ts`     | the ground, and what a bulb is made of                                  |
| `dangler.ts`     | the engine: canvas, the clock, wind, drawing, stats                     |
| `controls.ts`    | the panel, idle hiding, URL sync                                        |
| `api.ts`         | `window.experiment`                                                     |

`fullscreen.ts` and `wakelock.ts`, and `copyText` in `controls.ts`, are copied
verbatim from Starry Night. ADR-0002 defers extracting anything shared until a
second _and_ a third experiment exist; this is the second, so the duplication is
the evidence for that decision rather than a shortcut around it. **Fix a bug in
either copy and fix it in both.**

## Verifying a change

`npm run build` covers `astro check` and `npm run lint` covers eslint. Neither
sees anything visual, and for this piece neither sees anything physical either.

**Screenshots lie about this piece unless you settle it first.** A still taken
while the scene is relaxing shows a shape it never actually holds, and nothing in
the image says so. Always pass `?settle=1`, and check
`experiment.stats().maxConstraintError` — it sits around 2e-4 settled, and
anything above about 1e-2 means the wires are stretching or crumpling.

- `?wires=1` draws the centrelines, anchors and canopy rim. With only bulbs
  visible, a broken frame, a broken constraint and a broken projection all look
  identical; this is the difference between debugging and guessing.
- `?panel=1` and `?idle=0` as elsewhere in the section.
- `webcheck` cannot evaluate JS, so use a small CDP harness for the API: launch
  chromium with `--remote-debugging-port=0`, read the port from
  `DevToolsActivePort`, then `Runtime.evaluate` with `awaitPromise`.

**`checks.ts` covers the physics, and you should run it after touching any of
it.** Every assertion in it is a bug that actually happened — anchor `i` moving
when the wire count changed, wires stretching, a stiff wire hanging as limp as a
chain, frames flipping through an inflection. It is a plain script rather than a
test suite, because the repo has no runner and adding one is a bigger decision
than that file:

```sh
d=$(mktemp -d) && for f in src/experiments/dangler/*.ts; do
  sed -E 's#@/experiments/dangler/([a-z]+)"#./\1.ts"#g' "$f" > "$d/$(basename "$f")"
done && node --experimental-strip-types "$d/checks.ts"
```

The copy-and-rewrite is because Node strips TypeScript happily but does not
resolve the `@/` alias.

Headless runs without a GPU, so trust ratios, not absolute frame rates. At 60
wires × 60 segments × 20 bulbs the solver and the fill cost about the same:
dropping `segments` to 14 and dropping `glow` to 2 each recovered roughly the
same amount. `glow` is usually the cheaper one to give up.
