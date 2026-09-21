# Flotsam — the seed, and what he said after

Andrei's own words, verbatim. Written by the session, never by him. See
`docs/agents/experiment-writer.md` for why this exists: a transcript dies with
its session, and the prose below exists nowhere else — not in the code, not in
the commits, not in `about.md`.

**This file is a backfill**, written on 2026-09-22 from the session transcript
of 2026-08-29, long after the piece was built (#204). It was transcribed in one
sitting rather than appended as it came, which is not what the rule asks for; a
piece started today gets one from minute zero.

The session's worktree was `exp-wave-reflection`, which is why this took
finding — the slug does not match the piece.

**Long preset URLs are replaced with `[preset URL]`.** They are machine data
rather than his phrasing, and the scenes they name are in `settings.ts`.
Nothing else is altered, trimmed or tidied.

---

## The seed — 2026-08-29

> starting another experiment. again darkness, again dots, again motion. this
> time we have dots on the water. we're looking from above and dots of
> different sizes are floating on top and are being displaced by the waves.
> waves of different sizes with currents coming from different directions. all
> controllable. i'll be away for a while - make decisions on your own. we'll
> review the first drafts.

---

## 2026-08-29 — wind comes in gusts

The complaint that a mechanical look is a _mechanism_ to find rather than a
number to tune, stated as plainly as it ever gets here.

> this is an excellent start. thank you. the moving diagonals are appearing a
> little too mechanical. what gives it away is the very even looking wave
> period, so some variability there would be great if the algorithm allows.
> also wave direction - they all come from the same exact direction. waves are
> usually caused by wind and wind comes in gusts and with direction changes. i
> don't want to cause major algorithmic rework as what we have here appears
> mesmerising as is.

## 2026-08-29 — a broken control

> wavelength control is broken. i can't slide it and it appears to be pegged to
> the lower value of the range.

## 2026-08-29 — a more alive starry night

> this setting looks like a more "alive" starry night. Because dominant stars
> keep their position, it appears very organic. let's save this one as well.
> [preset URL] call it simmer

## 2026-08-29 — thinking aloud about brightness

Worth keeping whole: it is the clearest example of him reasoning toward
something he cannot yet name, and the answer turned out to be a control that
did not exist yet.

> i'm trying to understand how to reduce the brightness of the scene. i'm
> looking at migration and it appears that the only controls are the size and
> number of pieces and neither combination of those produces the effect I feel
> I want. The lights do fade a little bit (i'm loooking at "migration"), but
> overall they appear at a static level even when followed individually. i'm
> not sure what i'm after, so cannot articulate it easily. perhaps i'm trying
> to reach for the same monotonic distribution of lights as in starry night.
> when i reduce the number of lights, it appears sparse with the same
> proportional distribution of sizes. so it becomes emptier and the big lights
> still stick out. when i reduce the upper size bound, it ends up looking more
> uniform and not as bright, but now it's more boring because it lacks size
> variability. if I increase the min size it becomes even brighter and even
> more boring with everything being big. so I feel i'm looking for a
> size/density balance and am evaluating on the intensity of overall light the
> scene produces. i'm looking at this as I write. [preset URL]

## 2026-08-29 — the halo on the largest pieces

> Yes, size mix is what i was after. now that I can have only a few large
> pieces I'm noticing that the large the shiny object the fuzzier it is. They
> appear as a tiny solid dot in the middle with a thick halo around. i thought
> it was gleam, but no, increasing gleam gives all smaller staars a halo, but
> the big one don't get one and their gleam happens around the tiny center dot
> and is almost fully covered by the white semi-transparent halo. Also, it
> looks like the largest dots are not subject to colour spread. It appears that
> the dot is composed of layers: small dots that vary in colour, the the gleam
> of that tiny dot of the same colour, then a white halo that changes in size
> based on "max size" control. It is quite obvious here when looking at bigger
> pieces [preset URL]

## 2026-08-29 — proving it with a scene of only large pieces

> ok. this change give a more even colour. but there's a sharp edge between
> smaller and bigger pieces with biger having a sharp boundary while smaller
> ones are fuzzy gleam is increased. this forces the choice of smaller sizes to
> keep the scene smooth.
>
> to prove that large pieces are never fuzzy, i built a scene with only large
> piece. and it has its own charm and is beginning to look like a bokeh, though
> with pulsing jagged row resolution halos. [preset URL]

## 2026-08-29 — slower is more real

> change speeds: offing - 0.2, windrows - 0.3, crossing - 0.75, riptide - 0.2,
> pond - 0.6, migration - 0.2, dream - 0.6
>
> slower speed gives it a more cinematic look and increases realism because the
> patterns aren't as easily detectable. also, if you fly over an ocean on a
> plane - about 1km above - you'd see wave bands moving vey slowly, almost like
> a standing pattern.

## 2026-08-29 — closing

> ok. we're done here. thank you. you're doing excellent work. i am happy with
> the level of research you do and how you interpret and adopt my realism
> requirements. keep it up!
