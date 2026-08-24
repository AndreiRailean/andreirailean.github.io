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
