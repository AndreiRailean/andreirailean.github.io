# Dangler — design

**Date:** 2026-08-24
**Status:** Approved to build, expected to move

Strings of lights hanging from an unseen organic object overhead, seen from
directly below. Nothing is visible but the lights.

This is the second experiment in `src/experiments/`. It follows the section's
conventions (`src/experiments/AGENTS.md`) and inherits none of Starry Night's
look, per ADR-0002.

The brief was explicit that the destination is not the first version: more
wires will be added to the scene later, and a light breeze after that. The
design below is shaped by both, and says where it is deliberately building for
a scale it does not yet have.

## The piece

A dozen beads per wire, three wires to begin with, hanging from anchors fixed
to an invisible uneven object above. The wire is flexible but has rigidity, so
it hangs with a slight bend rather than falling into a plumb line, and the
beads protrude from its sides like LEDs on a light string.

Because the camera looks straight up, a bead descending toward the viewer grows
*and* slides outward from the vanishing point — one number driving both, which
is what makes it read as depth rather than as scaling.

### Space and camera

Camera at the world origin looking along +Z, which is up. A bead at
`(X, Y, Z)` projects to `(f·X/Z, f·Y/Z)`, with `f = (0.5 · min(viewport)) /
tan(fov/2)`.

A wire hanging dead overhead collapses to a point under this projection, so
anchor scatter is not decoration — it is what makes a wire legible at all.

The ratio governing the whole composition is **hang length over anchor
height**. Two metres of wire under an eight-metre anchor gives a 33% size ramp
and a tame splay; three metres under six gives 2× and a wide fan. Both are
controls; the default is to be tuned by looking at it.

Beads closer than a near clip are faded out rather than allowed to explode in
projected size.

### The canopy

Anchors are **not** independently scattered. They are pinned to one object, so
their heights are correlated — neighbouring wires hang from similar heights
because the thing above them is a surface, not noise. Independent scatter is
wrong in a way that would be invisible at three wires and obvious at thirty.

First cut: a seeded two-octave height field over a disc.
`Z = ceiling + relief · noise(X, Y)`. Anchor XY comes from a low-discrepancy
sequence (R2), Z is read off the field.

Two properties this must keep:

- **Anchor `i` is a pure function of `(seed, i)`, independent of wire count.**
  Raising the count adds wires; it never reshuffles the ones already on screen.
  This is the same failure mode as Starry Night's "never reset a layer's phase":
  the piece jumping under you while you drag a slider.
- **`canopy.anchorFor(i)` is the seam.** If a height field reads too smooth and
  the object wants actual branches — anchors clumping along lines, the way real
  lights get slung — that is a replacement behind the seam, not a rework.

### The wire

A Verlet chain: ~40 particles, distance constraints, and a bend constraint on
each consecutive triple resisting curvature. Gravity pulls down; Gauss–Seidel
passes relax it.

Chosen over an analytic curve because a wire fixed at **one** end with a free
end is not a catenary — a catenary needs both ends fixed. What is described is
an elastic rod whose shape comes from bending stiffness fighting gravity, which
a bend constraint reproduces directly and a formula has to fake. The other half
of the reason is motion: with a chain, wind is a force term, and the sway is
coherent — a gust travels down the wire, the free end lags and overshoots, the
anchored end barely moves. A spline animated by its control points moves all in
step, and that tell is exactly what a light breeze is made of.

Settled at construction with a few hundred silent iterations, so the piece opens
at rest instead of visibly dropping.

Per-wire imperfection comes from a **set** — a small permanent bend baked into
the rest angles, the wire remembering having been coiled — plus scatter in
stiffness and length.

### The beads

Each bead has a position along the arc and an angle around the wire's axis,
advancing by a twist rate. Placing them needs a **rotation-minimising frame**
along the chain; a naive Frenet frame flips at inflection points and would make
beads jump.

Two consequences are wanted, not incidental: beads never sit exactly on the
projected centreline, and when the wire sways they rotate slightly rather than
only translating.

An LED protruding sideways throws its light sideways, so **bead brightness
follows how squarely it faces the camera** — one dot product. This is
physically why a real light string shimmers as you walk under it, and it is the
cheapest character in the piece.

### Drawing

A cache of pre-rendered sprites: white-hot core, hue in the halo, transparent at
the edge. Keyed on quantised hue **and** quantised saturation — roughly 24 × 4
buckets at 64px, about a hundred small sprites — with per-bead brightness
applied as `globalAlpha` so it costs no cache entry.

Drawn with `globalCompositeOperation = "lighter"`, so overlapping halos add and
a cluster genuinely glows. Additive blending is **order-independent**, so there
is no depth sort for beads at any wire count.

Below ~0.7 css px a sprite trades size for alpha rather than shrinking further.
That is Starry Night's sub-pixel lesson: antialiasing spreads a sub-pixel dot's
area, so it can never reach its nominal alpha and the whole tier silently
contributes nothing.

Distance dimming applies on top.

### Colour

Three kinds of variability, kept distinct so each can be reasoned about alone:

| | source | changes over time |
| --- | --- | --- |
| `variance` | manufacturing — per-wire, then per-bead | no, baked at build |
| `facing` | which way the LED points at the camera | only when the wire sways |
| `flicker` | slow per-bead drift, defaults 0 | yes |

**`hue spread`** is the deliberate axis: a Gaussian σ in degrees around the base
hue. One control covers both readings honestly — at σ≈4° bulbs are nominally
the same colour and measurably are not; at σ≈60° it is a festive scatter; and at
every scale most beads sit near the base with the occasional outlier.

**`variance`** owns brightness and saturation rather than hue, so the two do not
overlap. Real bulbs from one batch differ in output and purity as much as in
colour, and those co-vary — three sliders for this would be three sliders nobody
can tell apart.

Variation is **two-level: per-wire, then per-bead.** A string is one batch, so
each wire draws its own small offset and each bead deviates around *its wire's*
offset rather than the global base. One string then reads a touch warmer or
dimmer than its neighbour while its own bulbs still differ among themselves.
This costs one extra PRNG draw and is the difference between "randomised" and
"these came out of different boxes".

### Ground and scheme

Near-black with a faint vignette. **No `invert`.**

A light-ground version of a piece whose entire subject is emitted light inverts
into dark dots on white, which is a different piece. Starry Night's `invert` is
Starry Night's — ADR-0002 says each experiment owns its look, and this is the
first place the section's only precedent gets declined.

### Determinism

`seed` is a setting. Every arrangement choice draws from a small seeded PRNG, so
an arrangement is a pure function of seed plus geometry, survives a URL, and
re-rolls on a key.

Live parameter changes feed the solver directly rather than rebuilding, so the
chain visibly relaxes into its new shape instead of teleporting. Only `seed`,
`wires`, `beads` and `segments` force a rebuild.

## Built for the crowd

The brief says more wires are coming. These are cheap now and expensive to
retrofit:

- Particles live in flat `Float32Array`s for the whole scene, with per-wire index
  ranges — not arrays of per-wire objects. At three wires it is a wash; at a
  hundred wires × forty particles it is the difference between a number changing
  and a rewrite.
- The solver runs on a **fixed timestep with an accumulator**, decoupled from
  render rate. With many wires the frame rate moves, and variable-`dt` Verlet
  changes the *character* of the sway as it does — the breeze would get springier
  when the machine got busier.
- `segmentCount` is per-wire rather than global, so distance-based LOD later is a
  value change rather than a restructure. LOD is **not** being built now.
- Solver iterations are a quality knob, to be spent as wire count rises.

The cost model is **fill rate** — the summed area of the sprites, dominated by a
few big near beads with big halos — not bead count. That is what `stats()`
reports.

## Settings

Twenty-two, grouped. More than Starry Night's twelve, which is a panel problem
before it is a design problem.

| group | controls | notes |
| --- | --- | --- |
| arrangement | `seed`, `wires`, `beads`, `segments` | the only four forcing a rebuild |
| canopy | `extent`, `ceiling`, `relief` | live — an anchor is a pinned particle, so dragging `relief` makes the scene sag and settle |
| wire | `length`, `stiffness`, `set`, `twist`, `irregularity` | live; `irregularity` is one control for per-wire scatter in length, stiffness and set together |
| camera | `fieldOfView`, `pitch` | default pitch 0 — straight up |
| light | `hue`, `hueSpread`, `variance`, `size`, `bloom`, `facing`, `falloff`, `flicker` | |
| motion | `breeze` | defaults 0 |

`segments` is in the panel deliberately: at sixty wires it is the knob to reach
for.

Everything round-trips through the query string. Anything added to `Settings`
needs handling in `settingsFromQuery` and `settingsToQuery` and a `hint` if it
is a `Control`, or the panel and shared URLs quietly disagree.

### Panel

Grouped under small headings, `max-height` around 70vh with internal scroll.

Not collapsible: collapse is UI state that must be remembered, decided about on
load, and kept out of the shareable URL. Not worth buying until twenty-two rows
prove unusable on a phone.

Otherwise as Starry Night: chrome on input, idle after 2.5s, a tooltip per row,
copy-link, and a placard to the note. Keys `1`–`3` presets, `c` panel, `Escape`
close, `f` fullscreen, `r` re-roll.

### Presets

Three, on keys 1–3, placeholders to be re-baked from exploration once there is
something to look at — the section's convention is that presets are recorded,
not designed. Intent: the default; one at scale to see the crowd; one festive
with the hue spread open.

### Console API

The required surface — `get`, `set`, `preset`, `presets`, `controls`, `panel`,
`idle`, `url`, `fullscreen`, `awake`, `stats` — plus two this piece needs:

- **`reroll(seed?)`** → the new seed.
- **`settle(iterations?)`** → runs the solver to rest. Load-bearing for
  verification: a headless still taken mid-relaxation shows a shape the piece
  never actually holds, and a screenshot cannot reveal that.

`stats()` returns `{ wires, beads, particles, drawnBeads, fillPx,
maxConstraintError, fps, running }`. `fillPx` because the cost model is fill
rate. `maxConstraintError` because it is the only way a headless check can
assert the scene settled — AGENTS.md's point that a convergence regression stays
invisible until the counts are readable applies exactly here.

### Query escapes

None of these are settings, so none appear in a shared URL:

- `?panel=1` — open the panel on load
- `?idle=0` — stop the chrome hiding itself
- `?settle=1` — reach rest before first paint
- `?wires=1` — debug overlay: centrelines, anchors, canopy

The last one is the difference between debugging the solver and guessing at it.
With only the beads visible, a broken frame and a broken constraint look
identical.

### Reduced motion

Falls out for free. With `breeze` and `flicker` both 0 the loop parks itself
after settling, so `prefers-reduced-motion` pins those to 0 and takes the same
path — a still frame and no RAF loop, as the section requires, with no special
case.

## Files

```
src/experiments/dangler/
  AGENTS.md        traps and invariants for this piece
  about.md         the note; frontmatter feeds /experiments/
  settings.ts      Settings, CONTROLS spec, presets, query parsing, needsRebuild
  random.ts        seeded PRNG, gaussian draw, R2 sequence
  canopy.ts        seed -> anchorFor(i); the invisible object
  arrangement.ts   seed -> wires, bead placement, per-wire colour offsets
  rope.ts          flat Float32Array chains, constraints, settle, fixed step
  frame.ts         rotation-minimising frame -> bead world positions
  camera.ts        projection, fov/pitch
  beads.ts         sprite cache, drawing
  palette.ts       ground, bead colour ramp
  dangler.ts       the engine: canvas, DPR, loop
  controls.ts      panel, idle, URL sync
  api.ts           window.experiment
  fullscreen.ts    copied
  wakelock.ts      copied

src/pages/experiments/dangler/
  index.astro      the piece
  about.astro      the note
```

`.ts` must never go under `src/pages/` — Astro turns it into an API endpoint.

`about.md` frontmatter matches the collection schema: `slug`, `title`,
`summary`, `started`, `updated`, `tags`. **The dev server needs a restart once
it exists**, or `/experiments/` silently renders its empty state and the about
route 500s.

### Knowingly duplicated

`wakelock.ts`, `fullscreen.ts` and `copyText` from `controls.ts` are copied
verbatim from Starry Night.

ADR-0002 defers extraction until a **second and third** experiment exist. This
is the second. The right move is to copy, note it in Dangler's `AGENTS.md`, and
let the duplication accumulate as the evidence, rather than pre-empt the
decision from a sample of two.

## Verifying

There is no test runner. `npm run build` covers `astro check` and `npm run lint`
covers eslint; neither sees anything visual.

Node-importable pure logic, each worth checking directly (Node strips
TypeScript; the `@/` alias will not resolve there, so copy to a temp dir and
rewrite the import):

- anchor `i` is unchanged as `wires` goes 3 → 30 — the "don't reshuffle under
  you" invariant
- PRNG determinism, and settings query round-trip
- projection maths
- `settle` converges: `maxConstraintError` → ~0
- the rotation-minimising frame does not flip across an inflection

Visually: `/root/bin/webcheck` for stills across several query states, including
`?wires=1`. A 200 proves nothing about content — grep for expected text.

The console API needs a small CDP harness, since webcheck cannot evaluate JS:
launch chromium with `--remote-debugging-port=0`, read the port from
`DevToolsActivePort`, then `Runtime.evaluate` with `awaitPromise`.

Fill rate at high wire counts is read off `stats()`. Headless runs without a
GPU, so trust the ratios between configurations, not the absolute numbers.

## Deferred, deliberately

- **Wind** exists as a force term and a `breeze` control defaulting to 0. The
  piece opens still, as briefed; the machinery is present so it can be judged in
  the same sitting.
- **Branch-shaped canopy**, behind `canopy.anchorFor(i)`.
- **Distance LOD**, enabled by per-wire `segmentCount`.
- **Extracting the shared utilities**, per ADR-0002, until the third experiment.
