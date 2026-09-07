---
type: ADR
status: accepted
date: 2026-09-07
summary: The controls() report shape and the mapping that builds it move into kit/api.ts, on the third copy and the third fault of the same class.
---

# The `controls()` report is the kit's

## Context

`window.experiment.controls()` is a **cross-piece contract**. `tests/kit.spec.ts`
holds all five pieces to it — `reports one entry per settings key` and `reports a
real bound, or none at all` — and generic code across the browser suite sweeps a
piece by walking it.

Its shape lived nowhere. Five pieces each declared their own:

| piece                     | shape                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| walkers                   | a `ControlReport` union, plus `group?: string`                   |
| starry-night              | the same union, **without** `group`                              |
| dangler, flotsam, psyxels | a flat `{ key; group; label; min: number; max: number; hint }[]` |

That is not five designs converging. It is **one design written twice** — the two
unions differ by a single optional field and nothing else — and **one flat type
written three times**, which is the one that cannot tell the truth about a
control with no track.

And it had already cost three times, always the same way: a field that claims to
be a number and is not one.

- **#85.** Three pieces reported three ways and nothing said which was the
  contract. Starry Night reported one entry per _control_ with a `keys` array, so
  generic code reading `.key` got `undefined`, wrote its patch to a setting no
  piece has, and passed because nothing had moved.
- **#127.** Two pieces built the report with a `switch` on the control's kind and
  a `default:` for the rest, so the default read `control.min` off a control with
  no `min`. The field was **present and `undefined`**: the type said `number`,
  and every consumer's arithmetic came out `NaN`.
- **#130.** Psyxels' flat type _requires_ `min` and `max`, so its `glyphs` set —
  a setting whose value is a list of five glyph names — reported
  `min: 0, max: 0`. A valid number and a complete untruth. Point either of the
  existing arithmetic sweeps at it and it writes `glyphs: 0`, a number into a
  setting that holds a list.

**#130 is why tightening the existing check was not the answer.** `kit.spec.ts`
asserts that a reported bound must be a number, which reaches #127's
present-and-`undefined` and cannot reach a plausible `0`. The fault is not a bad
value; it is a field that should not exist. That is an assertion about
_presence_, and presence is not something a flat type can express.

## Decision

**`ControlReport` and `reportControls` live in `src/experiments/kit/api.ts`.**
Every piece's `controls()` becomes `reportControls(CONTROLS)`.

- The report is a **discriminated union**: `slider | range` carry `min`/`max`,
  `choice | set` carry `options`, `toggle` carries neither. A caller switches on
  `kind` before reading and TypeScript stops it doing anything else.
- `group` is **optional**. Three pieces file their rows under headings and two do
  not; that is the only difference between the five shapes that was ever real.
- `kind` is now **required** on every entry, where `src/experiments/AGENTS.md`
  previously blessed it as one piece's extra field. Without it there is nothing
  to narrow on, so the union is unusable and the check below cannot be written.

**The mapping is hoisted, not only the type**, and its switch is **exhaustive
with no `default:` branch**. This is the part with mechanical value. Every
previous instance of the fault came out of a `default:` reading `min` and `max`
off whatever fell through it, and `kit.spec.ts` had already written down the next
one: _"the day the kit gains a kind that has no track, the default hands back
`min: control.min` off a control with no `min`"_. One exhaustive switch makes that
day **a compile error in one file** instead of five silent untruths in the pieces.

`tests/unit/experiments-controls-report.test.ts` asserts the presence rule
against every piece's real `CONTROLS`: a bound is reported exactly when the kind
has a track, an `options` list exactly when the kind has options, one entry per
settings key including both ends of a range, and no field ever
present-and-`undefined`. It is a **unit** check because `reportControls` is a
pure function of a control list — so a piece adding a trackless row hears about
it in milliseconds rather than from an eight-minute browser job.

### Why `kit/` and not the section level

On the discriminating test from
`20260828-the-piece-is-independent-the-gallery-is-not.md`: **could a piece take
this without taking the chrome?** No. The union is written in terms of the kit's
own control kinds — `slider`, `range`, `choice`, `toggle`, `set` — and the
mapping consumes the kit's `Control` type and its `keysOf`. Taking it means
taking the kit's control vocabulary. Unlike the generators, it does not travel
alone.

### What this contradicts, said out loud

`kit/api.ts` stated the opposite, in a docblock: _"`controls()` is **not** here on
purpose. The pieces legitimately disagree about its fields."_ That is reversed
here, and the census above is why — the disagreement it protected was two copies
of one union and three copies of one type, not five considered positions. The
docblock is rewritten in place rather than deleted, so a reader who remembers the
old claim finds out what happened to it.

The half of it that survives: `controls()` is still **not a method on
`BaseApi`**, and `createBaseApi` does not supply it. It cannot — building the
report needs the piece's `CONTROLS` array, and the base handle is given a
validator and a scene. A piece calls `reportControls` itself.

**Still offered**, like the rest of the kit. A piece needing a different report
writes one and says why in a `kit-opt-out:` line, and `kit.spec.ts` holds
whatever it returns at runtime either way.

## Consequences

- Psyxels' `glyphs` row reports `{ kind: "set", options: [...] }` and no bounds,
  which closes #130. Its `isTrackedControl` stays, still used by its own unit
  test.
- **A sweep must now narrow before reading a bound**, which is the point.
  `tests/dangler.spec.ts` was the only one that did not, and it was correct only
  because every Dangler row happens to be a slider. It now collects what it
  skipped and **fails if that list is non-empty** — narrowing and moving on is
  the shape that quietly stops covering a new row, which is #130's own lesson
  one layer up.
- `tests/reel.spec.ts` named a sixth copy of the shape, `{ key; min; max }[]`,
  in a type it never actually called. It names `ControlReport` now.
- The next control kind the kit gains breaks the build in `kit/api.ts` and
  nowhere else.

## Considered options

- **Hoist only the type, and let each piece keep its own switch.** What #130
  literally proposed, and rejected on re-reading: the switch _is_ the divergence
  surface. All three faults were in the mapping rather than in the declaration,
  and five copies of a `default:` branch would have survived the hoist intact.
- **Hoist nothing; make the bounds optional in the three flat types.** #130's
  smaller alternative. It fixes the untruth and leaves five shapes, so the
  fourth instance of the fault arrives on schedule. It also cannot support the
  presence check, which needs one shape to check.
- **Put `controls()` on `BaseApi` and have `createBaseApi` return it.** Rejected
  as infeasible rather than unwanted: the base handle is not given a control
  list, and passing one in would put every piece's labels, hints and `format`
  closures on the path from `createBaseApi` — the exact reachability that
  `20260906-a-runner-sheds-the-panel.md` measured at 28% of starry-night's
  bundle.
- **Tighten `kit.spec.ts` instead of adding a check.** Rejected because it
  cannot reach this: `min: 0` satisfies "a bound has to be a number". That spec's
  own docblock said so and pointed at #130.
