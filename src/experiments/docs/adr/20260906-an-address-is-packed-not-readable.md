---
type: ADR
status: accepted
date: 2026-09-06
summary: A scene's address becomes an opaque packed string over an append-only per-piece slot registry; readability moves to the panel and a console decoder, and the slot index replaces a schema version.
---

# An address is packed, not readable

Built. `src/experiments/address.ts` is the codec, each piece's `settings.ts`
holds its `REGISTRY`, and `src/experiments/AGENTS.md` carries the procedure for
adding, removing or re-cutting a setting. Issue #141 carries the working.

**Measured on the built thing rather than estimated**, across every preset of
every piece rather than the primary alone: 48 characters for starry-night, 54
walkers, 65 dangler, 77 psyxels, 78 flotsam. Against the 46 to 81 predicted from
bit budgets, which is closer than it had any right to be.

One simplification survived into the build. A log slot is stored on a uniform
grid at its _finest_ resolution rather than by significant figures, which
over-allocates a few bits per log control — flotsam and walkers have five each,
psyxels three. It was left alone: it keeps a slot to five numbers a reader can
check by eye, and buying those bits back would make `grid` mean something
different for two kinds of track.

## Context

`20260905-a-shared-address-states-the-whole-scene.md` made every piece write all
of its settings into the query string, so that a link cannot change meaning when
a default moves. It bought that at a stated price: addresses run from 214 to 489
characters.

The compaction question was then opened, and the constraint that had been
assumed — that an address stays readable and hand-editable — turned out not to
hold. Nobody types these. The parameter names are a side effect of how the pieces
grew rather than a chosen interface, and several were never deliberately named.
Where a name has to be understandable is the **panel**, and nothing here touches
that.

Removing that constraint removes the objection to an opaque encoding, and the
measurements then point one way. Costed across all five pieces:

| scheme                         | flotsam | psyxels | starry-night |
| ------------------------------ | ------- | ------- | ------------ |
| today, named parameters        | 355     | 489     | 217          |
| short text keys, base36 values | 203     | 230     | 106          |
| positional, packed             | 79      | 77      | 47           |
| **id-bitmap, packed**          | **81**  | **80**  | **46**       |
| id-pairs, packed               | 109     | 113     | 62           |

Two findings decided the shape:

- **Positional packing is only a character or two shorter than an encoding that
  is position-stable by construction.** At that price it is not worth having: a
  positional layout needs a version bump and a frozen table retained forever for
  _every setting added_, and settings are added here constantly —
  `20260829-a-piece-under-exploration-owes-its-urls-nothing.md`.
- **A bitmap beats id-pairs by a factor of six on overhead.** Emitting `(id,
value)` costs six bits of id per setting, 22 to 36 characters. One bit per slot
  saying whether it is present costs a seventh of that.

## Decision

**An address is an opaque packed string, and readability moves elsewhere.**

### The encoding

One query parameter carrying base64url text: a bitmap of which slots are
present, in seven-bit groups with a continuation bit so it stays self-describing
as the registry grows, followed by the present values packed in slot order.

### The registry

Each piece owns an **append-only registry**. A slot is `(key, kind, grid, origin,
bits)`, allocated once and **immutable thereafter**. Anything that would change
one of those retires the slot and appends a new one; the reader maps both to the
same setting.

**The slot index is therefore the version, and there is no version field.**
Versioning per parameter rather than per schema is what removes it: a resolution
change is an append, and adding a setting is free, because an address written
before that slot existed simply has a shorter bitmap and is silent about it.
Silence falls back to `DEFAULT_SETTINGS`, which is consistent with the previous
record rather than in tension with it — an address that never named a setting is
an old bookmark, and an old bookmark was never promised a picture it could not
describe.

Retiring a slot costs one bit. A piece could retire a setting a month for a
decade and pay about seventeen characters.

### A slot's range is not its control's bounds

Found by the round-trip check rather than by review, and worth stating because
it looks like a detail and is not: walkers' `traces` has an **off** value of 0
sitting _below_ its log track's bottom stop of 0.05. A slot sized from
`BOUNDS` alone could not hold it, and 0 decoded as 0.05 — a piece's "no traces"
scene silently acquiring traces. Each slot's `origin` and `bits` therefore cover
every value the setting can legally hold, which is the union of its bounds and
what its scenes actually contain.

### The grid, which is the registry's and not the control's

**A slot's grid is chosen to be fine enough that every scene the piece ships
lands on it.** A control's `step` is the starting guess and nothing more — it is
how far an arrow key moves a handle, not a claim about what values the setting
can hold. Conflating the two is a mistake this record's own research made, and
`tests/unit/experiments-urls.test.ts` would have caught it: three pieces ship
presets sitting off their control's step, and quantising to `step` would have
moved `flotsam`'s `pond.drift` from 0.005 to 0.01, `starry-night`'s
`alive.clouds` from 0.22 to 0.2, and `walkers`' `busy.settling` from 0.02 to
**zero** — a setting switched off rather than nudged.

Fitting the grid per slot instead costs **nothing measurable**: three slots widen
by two or three bits and the addresses come out the same length, because the
difference vanishes into base64 rounding.

Values are encoded as an integer count of grid steps **from a fixed origin, not
from `min`**, and bit width comes from the registry. A control's bounds can then
move freely without touching any address ever written; `normalizeSettings` clamps
on read, which is where clamping belongs.

### Where readability goes

- **The panel keeps human-readable labels and hints.** Untouched.
- **The console API keeps human-readable keys.** `experiment.set({ steepness:
0.9 })` is unchanged, and the resulting address is packed like any other.
- **A decoder on the console handle** expands an address back to a plain object
  for inspection. This is not optional garnish: it is the only way to answer
  "what scene is this link" once addresses are opaque, and the first confusing
  report without it costs an afternoon.

### Compatibility

Both readers coexist. **The named-parameter form becomes read-only** — parsed
forever, never written again. On arrival, an address is rewritten to the packed
form **only when `decode(encode(scene))` equals `scene`**, and left exactly as it
arrived otherwise, so a link carrying something the registry cannot represent
keeps rendering what it says. The same guard applies to the chrome's rewrite:
dragging one slider must not quantise an off-grid value elsewhere in the scene.

There is no server — this is a static build — so "redirect" can only ever mean
`history.replaceState` from inside the page, which is the mechanism the landing
rewrite already uses.

### Placement

The codec is **section level**, beside `poster.ts` and `random.ts`, not in
`kit/`. It passes the test the layers ADR sets: a piece could take it without
taking the chrome. The registries are per piece, with that piece's settings.

## Consequences

- **Addresses stop being readable, deliberately.** 46 to 81 characters against
  214 to 489.
- **A test that the registry is append-only is load-bearing**, and is the one
  thing the whole scheme rests on: slots unique, never reused, and an existing
  slot's parameters identical to a checked-in snapshot. It gets written before
  the encoder and gets broken deliberately to prove it fails.
- **A test that every preset lands on its slot's grid**, so a scene recorded
  through the console API off-grid fails loudly instead of being silently
  snapped.
- **Resolution can be changed later in either direction, per slot**, with no
  migration and no version bump. Demonstrated in #141 against an address written
  before the change.
- **Piece versioning is not bought by this and is out of scope.** The address
  carries settings; the renderer is whatever is deployed. What _is_ bought is
  versioning of the settings interface: the registry becomes an append-only
  history of every setting that ever existed, and an old address becomes
  distinguishable from one that chose the defaults — which it is not today.

## Considered Options

**Rounding values to each control's `step`.** The obvious first move, since the
bounds already declare a resolution. Worth one to two characters per piece and
discarded on the measurement: the values are already short, because the presets
were recorded by dragging sliders that step.

**Short text keys with the long form still read.** Around 43% off, keeps
addresses debuggable by eye, no bit handling. Rejected only because the
readability it preserves turned out not to be wanted; it remains the fallback if
the packed scheme proves awkward in practice.

**Diffing against the named preset a scene came from** — `?p=offing&steepness=0.5`.
Tempting, and it has exactly the fault the previous record removed: a preset can
be retuned, so the baseline moves and the link changes meaning. It would work
only if published presets were frozen, which is a larger decision than this one.

**A global schema version with migrations.** The conventional answer, and
strictly worse here once versioning is done per slot: it needs a migration
function for every encoding change and a bumped version plus a frozen table for
every setting added, where per-slot versioning makes the first an append and the
second free.
