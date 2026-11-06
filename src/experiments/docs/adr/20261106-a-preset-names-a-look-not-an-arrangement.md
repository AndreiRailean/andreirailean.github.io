---
type: ADR
status: accepted
date: 2026-11-06
summary: Every preset states its seed, a number to pin one arrangement or "roll" for a fresh one each time it is applied; the address still carries the seed in use.
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

**Every preset states its seed: a number, or `"roll"`** (`PresetSettings`, in
`kit/controls.ts`, and `ROLL` in `kit/preset.ts`). `"roll"` gets a fresh seed
every time the preset is applied, through one function, `sceneFromPreset` in
`piece.ts`, which every route goes through: the landing, the preset buttons,
the number and arrow keys, `experiment.preset()` and the index's plates. A
number pins that arrangement, for a preset whose point is one arrangement.

The seed is required rather than optional, so a preset that says neither does
not compile. Andrei, on the first version, where a preset rolled by leaving its
seed out: "perhaps the seed/no-seed preference should be explicit on
experiments. it may not always be desired to have all presets pick a random
seed. and there are times when pegging a seed is the desired state." A missing
key reads the same whether it was a decision or an oversight, and a scene saved
from the screen arrives with a seed in it, so leaving it out was the step
somebody had to remember.

Every preset rolls except where one arrangement is the point:

- **artdeco's `ziggurat` and `banded`** run `unison: "all"`, where a third of
  seeds stop at a few segments;
- **every melting preset**, because the lamp is a function of the moment and
  the seed alone, so two screens show the same lamp. That is the piece's
  premise, and `melting.spec.ts` holds it. It varies anyway, because every
  load is a different moment.

**The address still carries the seed in use**, so a copied link reproduces
the screen exactly. Only a preset stopped being an exact scene.

## How a rolled seed reaches the address

Andrei, after it was explained once: "i feel this 'roll' will come up again
and i'll be confused again." So, from the address's side:

- **`"roll"` never appears in an address.** It lives only in `presets.ts`. The
  one parameter that carries a scene, `s=`, always holds every setting with a
  concrete seed.
- **A bare address, which is what the index links to**, names no settings, so
  `settingsForLanding` in `piece.ts` takes the first preset through
  `sceneFromPreset`, which rolls its seed. The piece starts on that scene, and
  `gallery/boot.ts` then rewrites the address to it, seed included. A visitor
  lands on `/experiments/artdeco/` and the bar changes to `?s=…` at once.
- **A preset button, a number or arrow key, or `experiment.preset()`** goes
  through the same function, so a rolling preset gets its new seed at the
  moment it is applied, and the kit's address sync writes it into `s=`. That is
  why the address changes on every click, including a click on the preset
  already lit. A pinned preset takes the same route with its seed as written,
  so clicking it again leaves the address alone.
- **The address is replaced, not pushed**, so the back button does not step
  through rolls.
- **No address means "this preset, rolled".** A link is either bare, which is
  the first preset rolled, or one exact scene. A `?preset=<label>` going through
  `sceneFromPreset` at load would be that link; nothing has needed it.
- **Nothing on the page shows whether a preset rolls.** What is on screen is
  always one scene with a concrete seed, and a preset is only written in code,
  so the distinction would describe nothing the viewer can act on. Andrei:
  "since it's impossible to save a preset from the UI, it makes no sense to
  show if a preset used a fixed seed or not because when looking at one
  'scene' the seed is set."

## Considered Options

- **Rolling by leaving the seed out.** The first version. Replaced for the
  reason above.
- **One switch per piece**, rolling or pinned for all of its presets. Artdeco
  needs both in one list, and a per-preset value is that switch written out
  wherever it applies.

## Consequences

- **A piece with no seed setting can still repeat itself.** Embers drew its
  air, bed and jitter from a constant seed, and with a deterministic `settle`
  its plate was the same fire on every load. It draws them from a fresh stream
  on every start now. Melting's recipe stopped jumping to one fixed moment, so
  its plate is the lamp as it is now.
- **No poster capture is reproducible.** Each is a different arrangement of
  the same scene, as each plate and each landing is.
- **A preset button still lights for every arrangement it rolls**, because the
  kit matches a rolled seed as any seed.
- **Applying a rolling preset again rearranges it**, including clicking the
  one already lit: the button is a way to see the look afresh.
- **`pnpm run bridge state` prints a seed.** Saving a scene as a preset writes
  `seed: "roll"` in its place unless Andrei wants that arrangement kept.
- **Applying a rolling preset without a way to roll throws** rather than
  falling back to the validator's default seed, which would pin it silently.
- **A check that builds a world from a preset now gets a different world**
  unless it pins one. Crowd's checks were measured against particular worlds,
  so `crowd/tests/support.ts` pins the seeds its presets used to carry.
- `tests/unit/experiments-presets.test.ts` asks every piece whose primary
  rolls to land on more than one seed in three tries.
