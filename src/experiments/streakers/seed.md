# seed — streakers

What Andrei asked for, in his words, and each round of feedback as it arrives.
Verbatim. This file faces inward and records him; `about.md` faces outward and
describes the work.

## 2026-10-05 — the seed

> We're dealing with dots again. I imagine a lines of dots emerging from an edge
> of the screen. Easiest to imagine is, say, 10 random poiints at the left edge
> of the screen. Each point is an "emitter" - it produces dots that come out of
> it and stream in a straight line across the screen. I'm seeing dots as being
> the same size, but coming out at random intervals so don't form a uniform
> grid. All dots in a line move at the same speed. Each line has own speed.
> Eventually, i imagine dots in a line may become different in size, so we can
> control that at the start, but I want to see the same size dots first. The
> visual effect will come from many lines moivng in the same direction at
> different speeds, with dots at different sizes and with random intervals.
> While initially they come out from the left side of the screen, I'm keen to
> see them move diagonally from across the screen. these lines can come from any
> side of the screen. next level will be having these lines come out of all
> sides and having a more complex origin geometry: for example if emitters are
> placed in a circle, off screen, centered in the middle of the screen they
> would forma a star-like pattern. they can be equidistant on the circumference
> or they can be randomly placed. this produces different kinds of pattern. they
> can go throught middle of the circle or all follow the same or random angles.
> Each of these combinations would form a pattern. The key, I think is
> maintaining a "live line" characteristic - lines are easily visible but they
> don't appear permanent in structure on close inspection.
> A particular variant I want to see is a screen filled with many such lines, so
> it appears full and moving.

## 2026-10-06 — first round

> looking good. hue, line sizes and dot sizes don't appear to be doing much. i
> like this one.
> http://100.117.55.104:4573/experiments/streakers/?s=__94CZR5aALAID4IDAhgO0AAH

> call that one "saturn"

## Questions I could not answer, and what I assumed

- ~~Should saturn be the primary?~~ Answered 2026-10-06: "full", renamed
  "dimensions", is the primary; saturn stays second.
- **"Hue doesn't do much"** — it only tinted the controls. I took that as
  wanting colour in the dots, so `tint` (0 stays white) and `hue spread` (per
  line) were added rather than repurposing hue. Every preset but star,
  rosette and weave keeps white dots.
- **Ring with parallel aim wastes most emitters**: those on the downstream arc
  point away from the screen (from all round: 23 of 160 cross). Kept as is;
  placing parallel emitters on the upstream arc only is the alternative.

## 2026-10-06 — second round

> make 4 "full" the first and primary preset but name it "dimensions". saturn
> should stay number 2. "rosette" number 3.
>
> i don't understand the question about ring and emitters
