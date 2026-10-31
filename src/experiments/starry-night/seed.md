# Starry Night — the seed, and what he said after

Andrei's own words, verbatim. Written by the session, never by him. See
`docs/agents/experiment-writer.md` for why this exists: a transcript dies with
its session, and the prose below exists nowhere else — not in the code, not in
the commits, not in `about.md`.

**This file is a backfill**, written on 2026-09-22 from the session transcript
of 2026-08-20/23, long after the piece was built (#204). It was transcribed in
one sitting rather than appended as it came, which is not what the rule asks
for; a piece started today gets one from minute zero.

**This is the first piece, so its seed is also the section's.** The session ran
in the `visual-experiments-section` worktree, which is why #204 could not find
it under a piece name. The same conversation produced the first
`src/experiments/AGENTS.md` and the console API, and messages about those are
left out here — they are the section's history rather than this piece's.

**Long preset URLs are replaced with `[preset URL]`.** Since #320 it holds his
artistic direction only: bug reports, feedback on the implementation, his
questions and preset or control requests were removed by whole sentences, and
no surviving sentence is reworded.

---

## The seed — 2026-08-20

> i want to build a visual experiment. i think i may end up with a bunch of
> these. kind of like a blog, but instead of writing it will be a programmed
> graphic. i don't want to be constrained by astro and at this stage don't want
> to link to the experiments from the front page. i want each experiment to
> take up the full browser page and not have any common chrome (yet). my first
> experiment is a "starry night" kind of thing where on a dark background
> layers of randomly placed dots fade in and out of existence. so a layer of
> dots starts faded out, fades in and fades out. while that is happening. there
> are multiple layers and each is running on its own clock and they're all out
> of sync. when a layer fades out, it disappears and a new one is created. we
> can start with 3 layers. is this something you can help me build? does it
> make sense to build it as part of this astro system or should it be done as a
> standalone project? can a standalone project co-exist with astro in the same
> repo and be deployed to gh pages?

> let's build all three so we can compare which one feels best

---

## 2026-08-20 — out of sync, sparser, and a glimmer

> we need more layers and the clock seems synched up enough to result in a
> blank screen when all layers fade out and haven't respawned yet

> we need more, but sparser layers, each layer with different random life span.

> i like the fact that layers are harder to detect. i feel like we need an
> occasional star glimmer - like a fast one-star bringness spike

## 2026-08-23 — bigger dots, and clouds that are not static

> what i'd like to add here is ability to have bigger dots, but only a few,
> though as they get bigger, i feel we'll need to move away from perfect
> circular geometry. also on light backgrounds (and thinking about clay),
> what's being called for is for background to be not so uniform in colour. i'm
> guessing if we think about invertible coloration, then I'm thinking of
> something like a layer of clouds, but there, too, i don't want them to be
> static and instead fade in like the stars.

## 2026-08-23 — invert is the wrong approach

This is the observation behind
`docs/adr/0003-colour-schemes-are-inversions-for-now.md`.

> thinking about it, i'm not sure if "invert" is the right approach. it forces
> a certain colour selection that is invertible, but that is an unnecessary
> constraint. almost like we need colour themes and "dark" and "light" would be
> just presets, but not inversions of each other. i wrote that before you were
> finished, but am keeping it just as an observation for your consideration.

## 2026-08-23 — the big star gives away the whole game

The most reused observation in the section — it comes back in psyxels and
flotsam almost word for word, and is why large units are treated as a hazard
rather than a feature.

> one thing that is noticeable with big stars is that when they're big enough,
> they break the illusion by fading away together. so it feels like there
> should be either a limit to them per layer or their proximity on a layer
> should be controlled so they're never too close together. i almost want to
> suggest that different sizes go on different layers, i.e. big stars never
> appear on same layer with little stars or there cannot be more than X of them
> per layer. big stars give away the whole game and allow the pattern to be
> seen for smaller stars (on the same layer). the bigger the star the more it
> breaks the illusion. so feels like that monotonic function needs to come in
> again or something like it. also, the fading function is such that big stars
> are easy to see fade in and out. for smaller stars the transition is not as
> obvious, they just kinda disappear.

## 2026-08-23 — a setting should not make the scene jump

> is it possible to have another cloud-like layer but it will only add a
> "fade" layer, so everything under the cloud will be faded based on the
> "thickness" of the cloud. to make it feel like a cloud, it would be nicer a
> cloud was moving. so far everything is static, just fading in and out.
> motion is a whole new dimension.
>
> one thing that would make it easier to see the impact of a setting is if
> instead of a complete rerender whenever anything changes, the setting just
> took place from the moment it was changed, so it would apply to newly created
> layers and the new setting itself would slowly "fade in".
>
> on the fade-in, I'm feeling the need for an easing curve transition instead
> of a linear fade. i feel it would add some realism.

## 2026-08-23 — layers are an optimisation, not the model

> just a thought. don't want to distract you... i understand that we're
> essentially building an animation and eventually, the idea of layers has to
> "flatten out" and we're dealing with items with lifecycles that a central
> loop that stages them for rendering on screen. having layers was just an
> optimisation to track state for a bunch of items at once. for small stars it
> still makes sense.
>
> even density, max size and size mix shouldn't require rebuild because if they
> take effect on next layer spawn, then there's no need for dots to jump
> around. although jumping around does provide a clue about the impact of a
> setting - having to wait for other layers to fade away is not as instant.
>
> let's build the settings to be as smooth as possible without losing
> responsiveness
