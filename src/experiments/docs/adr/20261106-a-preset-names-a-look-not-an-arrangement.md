---
type: ADR
status: accepted
date: 2026-11-06
summary: A preset may leave its seed out, and then every load rolls a fresh arrangement of it; the address still carries the seed in use.
---

# A preset names a look, not an arrangement

## Context

Andrei, once the index drew its plates live: "i see that posters always look
exactly the same on each page load. is that because of the seed? what can we
do to make them look different on each load? i understand we need to adjust
the presets as well."

It was the seed. Eleven of the thirteen pieces take one, and all 122 of their
presets named it, so a bare landing, a preset button and an index plate always
drew the same arrangement. Embers and Starry Night take no seed and already
varied.

## Decision

**A preset's seed is optional** (`PresetSettings`, in `kit/controls.ts`). A
preset that names none gets a fresh seed every time it is applied, through one
function, `sceneFromPreset` in `piece.ts`, which every route goes through: the
landing, the preset buttons, the number and arrow keys, `experiment.preset()`
and the index's plates. A preset that names a seed keeps it, which is for a
preset whose point is one arrangement.

The seeds were removed from every preset except where one is the point:

- **artdeco's `ziggurat` and `banded`** run `unison: "all"`, where a third of
  seeds stop at a few segments;
- **every melting preset**, because the lamp is a function of the moment and
  the seed alone, so two screens show the same lamp. That is the piece's
  premise, and `melting.spec.ts` holds it. It varies anyway, because every
  load is a different moment.

**The address still carries the seed in use**, so a copied link reproduces
the screen exactly. Only a preset stopped being an exact scene.

## Consequences

- **A piece with no seed setting can still repeat itself.** Embers drew its
  air, bed and jitter from a constant seed, and with a deterministic `settle`
  its plate was the same fire on every load. It draws them from a fresh stream
  on every start now. Melting's recipe stopped jumping to one fixed moment, so
  its plate is the lamp as it is now.
- **No poster capture is reproducible.** Each is a different arrangement of
  the same scene, as each plate and each landing is.
- **A preset button still lights for every arrangement it rolls**, because the
  kit matches a preset over the keys it names.
- **`pnpm run bridge state` prints a seed.** Saving a scene as a preset leaves
  it out unless Andrei wants that arrangement kept.
- **A check that builds a world from a preset now gets a different world**
  unless it pins one. Crowd's checks were measured against particular worlds,
  so `crowd/tests/support.ts` pins the seeds its presets used to carry.
- `tests/unit/experiments-presets.test.ts` asks every piece that rerolls, with
  a primary that names no seed, to land on more than one seed in three tries.
