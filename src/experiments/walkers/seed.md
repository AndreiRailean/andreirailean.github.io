# Walkers — the seed, and what he said after

Andrei's own words, verbatim. Written by the session, never by him. See
`docs/agents/experiment-writer.md` for why this exists: a transcript dies with
its session, and the prose below exists nowhere else — not in the code, not in
the commits, not in `about.md`.

**This file is a backfill**, written on 2026-09-22 from the session transcripts
of 2026-09-03/05, long after the piece was built (#204). It was transcribed in
one sitting rather than appended as it came, which is not what the rule asks
for; a piece started today gets one from minute zero.

**#204 expected this one to be unrecoverable** — the piece was built across two
sessions and the second opens with `read this
/tmp/walkers-handoff-2026-09-04.md`, a temp file that is indeed gone. The seed
survived anyway, because the _originating_ session's transcript is still on
disk under the same worktree slug. The handoff was never the only copy.

**Long preset URLs are replaced with `[preset URL]`**, and housekeeping is left
out as incidental. Nothing else is altered, trimmed or tidied.

---

## The seed — 2026-09-03

> new experiment. code name "walkers". again dots. we're looking down from
> above. the dots we see are relatively big (not single pixel lights). each dot
> is moving. dots (or circles), we'll call them walkers. they walk because
> they're heads and they're attached to a body and we can't see the bodies, we
> can only see the circular head from above. they're men, women and children.
> they walk alone or in families and groups. some run. they don't run into each
> other, just like people don't run into each other and don't walk through.
> they walk around each other and stay together as groups. walkers are
> different sizes just like people are different. adults are bigger, children
> are smaller. adults walk differently to children. children play, jump, fall,
> chase each other and play hide and seek among other things. and we're
> observing this from above. as people walk, they bop their heads, they look
> around, up, down. we can start on open terrain, but we'll soon add some
> obstacles that mean that people cannot just go across. people show up from
> the side of the screen and do their walking or standing, sitting - whatever
> they choose. they could be on a picnic or taking a jog in the park. I'm
> imagining pastel colours. Whether they indicate group affinity or individual
> stilistic preferences I do not know yet. If it's a concert, they all could
> "wear" band colours, or sport colours.
>
> as with all other experiments, build independently. see how much you can
> build without my involvement. i'll review when you have something to show.
> i'm not going to micro-manage your decisions. when I come back to interact
> you can present me with options that you considered. if some options are
> wildly different from the others either build them as separate presets or
> experiments for review.
>
> do not open a PR until i have viewed the experiment in the browser, we have
> iterated on it and I have given you a go ahead. if you discover any bugs that
> you don't want to fix right away, feel free to file them as GH issues. if
> they are about all experiments and the gallery, label them with 'kit' so that
> steward can step in. feel free to get feedback from the steward, but do not
> get distracted and dragged into its matters. you have your own objective - to
> build a "walker" experiment.
>
> begin your implementation

The `kit` label he names here was renamed `steward` on 2026-09-12, for reasons
in `docs/agents/issue-tracker.md`.

---

## 2026-09-03 — reaching for stars, getting bacteria

> great start. i can't open locahost links because you're on a vm.
>
> playing with controls, i'm trying to adjust it so it, like others, can become
> a set of stars on a dark background. this is as close as I can get it. looks
> like bacteria [preset URL]

## 2026-09-04 — chalky, and a spawn that gives itself away

> i'm still not able to achieve a contrasting black background with white
> lines. all colours are tame. here's the config i'm playing with. one thing
> that looks like a bug at this config is that initial population spawns in a
> rectangle in the middle of the screen with roughly 1/4 of screen being empty.
> then they start walking around. it takes a long time for traces to hide that
> fact as initial traces only preserve the origins. call this preset "chalky"
> [preset URL]

## 2026-09-04 — the permanent grey trace

> i've got this version of chalky that i'm working with. what i'm trying to
> understand is how traces are expected to behave. i see the bright white trace
> fading, but it leaves a permanent grey trace behind and I'm not sure how to
> control it. [preset URL]

## 2026-09-04 — trimming the light presets

> poster is green when chalky has dark background. i may be looking at the
> wrong thing. remove presets 4 and up. white balls on light backgrounds don't
> look good.

An instance of narrowing a piece by deleting what argues with the finding.

## 2026-09-04 — what did we learn

> looking good. i think walkers is good to release. did we learn anything new
> in this experiment? you don't have access to the old session, so whatever
> knowledge was there was already captured in ADRs or text

---

## 2026-09-04 — the suite is too expensive, and where that led

This exchange is the origin of the browser/unit split work and of #133.

> we're really taxing GitHub with those tests, aren't we? is it neccessary to
> perform so much visual testing? it's been running for 8+ min now

> close the server. if some tests can be moved off chromium (expensive) to
> vitest (cheap) why do we write them for chromium first?

> "heads lean outward" is that even needed anymore after we moved to circles?
> what is url round-tripping?
> landing rewrite sounds like a universal property. i guess this is hinting at
> the cost of each experiement being standalone.]

> i think it's reasonable for this kind of liberal expansion. we just need a
> gate that causes us to stop to think if a browser test needs to be reworked
> as a vitest.

> capture a ticket for steward to analyse tests, decide which ones need moving
> out of browser space and see what kind of project-wide config could help
> speed up testing and reasoning about writing tests. do that only after you
> finish the harness so the steward doesn't rederive this. i wrote this hours
> ago. does 131 deal with this already?
