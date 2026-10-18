---
type: ADR
status: accepted
date: 2026-10-18
summary: The kit provides one speed control to every piece — key `timescale`, a log track from 0.1× to 10× — where 1× is each piece's natural rate (`CLOCK_RATE`), not the wall clock; per-piece `playback` is retired, there is no 0, and holding the scene is pause's.
---

# Speed is the kit's, and 1× is the piece's

## Context

Six pieces had written a `playback` control each, and by #312 they disagreed on
the label ("speed" in Bubbles), the range, whether the track was log, and what
0 meant — held in two, forbidden in two. Crowd and Walkers stuttered below half
speed because they step in whole 1/120 s ticks. The other six pieces had no
speed at all. #313 had just given every piece a pause button and Space, through
the kit.

Andrei, 2026-10-18:

> yes, playback is a control for the kit to provide. we don't have a single
> experiment yet that is not pausable. they may pause differently, but they all
> pause. as a control and its expected action pause button should be moved up
> to kit level if possible so we don't make mistakes when reimplementing.
>
> crowd/walkers don't make much sense at very low speeds. to avoid the stutter,
> we can just increase the lower bound. now that we have pausing, we don't need
> a gradual decrease to 0 on those and any other experiments.

And, asked where a floor should sit:

> when given a slider, i drag it until i make the piece look the way i like it.
> [...] on pieces where the presets are mostly at the lowest end of the range,
> it's an indication that there's nothing interesting at the high end for the
> experiment and the scale can be adjusted for finer adjustments within the
> interesting range rather than having a generic multiplier. for flotsam, the
> 0.2 is probably the 100% speed that we're interested.

## Decision

- **One control, `src/experiments/kit/speed.ts`**: label "speed", key
  `timescale`, a log track from 0.1× to 10×, one address slot. A piece may
  narrow the track and nothing else.
- **1× is the piece's natural rate.** Each piece exports `CLOCK_RATE`, the clock
  rate its 1× stands for: Flotsam 0.2, Embers 0.5 (so its presets stay round),
  the rest 1. The fine half of a log slider then sits where the presets were.
- **No 0.** Holding the scene is pause's, and pausing moves no setting.
- **Narrowed where the stepping cannot follow**: Crowd and Walkers 0.5×–2×
  (whole-tick stepping stutters below a half and caps catch-up near 2×),
  Bubbles to 4× and Embers to 8× (four substeps a frame), Dangler to 1.5×
  (twelve 1/480 s substeps).
- **The key changed with the meaning.** An address cannot tell two meanings of
  one key apart, so `playback` is retired in every piece that had it, and an
  old address converts once, through `fromPlayback`, by dividing by
  `CLOCK_RATE`. The named-parameter form's `playback=` is not converted.
- **Two existing labels moved** so no panel has two "speed" rows: Artdeco's
  growth `speed` is labelled "rate", Streakers' line-speed range "line speeds".
  Their keys are unchanged.

`tests/unit/experiments-speed.test.ts` holds every piece to the kit's control,
track and slot, its presets to its range, and an address written with
`playback` to the rate it described.

## Consequences

The control is one function call, and **the call must carry
`/* @__PURE__ */`**: `CONTROLS` is built at module scope, and a call the bundler
cannot prove pure pins the whole panel into every showcase runner (#243).
esbuild 0.28 ignores `@__NO_SIDE_EFFECTS__` on the declaration across modules,
and a spread of a shared object pins it the same way. `runner-bundle.test.ts`
fails a piece that forgets.
