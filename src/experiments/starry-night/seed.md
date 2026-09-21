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

**Long preset URLs are replaced with `[preset URL]`.** Nothing else is altered,
trimmed or tidied.

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

## 2026-08-22 — presets, and a pointer that will not hide

> the node had to restart, so server is now down. glimmer is looking good. i
> haven't played with the "per second" parameter. i think instead of 1,2,3
> being just the switches between layer config options, we want to have 1,2,3
> as shortcuts to various presets. it is better to have these parameters
> editable in an unobtrusive UI that goes out of sight when not needed. when
> previewing this experiment in chrome full screen mode, i notice that the
> mouse pointer is always on. would be good to let it hide if not used, similar
> to what happens when watching videos.

## 2026-08-23 — bigger dots, and clouds that are not static

> ok. make this url shortcut 2 and call it clay: [preset URL]
>
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
> hue control kinda solves it. one strangeness i notices as I was dragging the
> hue control - there's a point after which the right hand side of all sliders
> becomes dark (in light theme) and light (white) in dark theme. i don't think
> it's necessary to flip that as hue changes. it should always be muted dark on
> dark bg and light gray on white bg.

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
> obvious, they just kinda disappear. i don't think we have a control for how
> fast they fade in and fade out. for large stars it feels like current default
> is not good enough.

## 2026-08-23 — keep the computer awake

The origin of `kit/wakelock.ts`.

> i'm using fade of 0.1 and that should be the default for deep field preset.
>
> one thing i want to get is to stop the compputer from sleeping when the
> experiment is running. similar to how watching a video stops the computer
> from sleeping.

## 2026-08-23 — a setting should not make the scene jump

> is the cloud layer above or below the dots? is it possible to have another
> cloud-like layer but it will only add a "fade" layer, so everything under the
> cloud will be faded based on the "thickness" of the cloud. to make it feel
> like a cloud, it would be nicer a cloud was moving. so far everything is
> static, just fading in and out. motion is a whole new dimension. I'm not sure
> if motion would now be piling on so much that computer fans will start
> spinning. memory management seems fine.
>
> one thing that would make it easier to see the impact of a setting is if
> instead of a complete rerender whenever anything changes, the setting just
> took place from the moment it was changed, so it would apply to newly created
> layers and the new setting itself would slowly "fade in".
>
> on the fade-in, I'm feeling the need for an easing curve transition instead
> of a linear fade. what can we do about that. i feel it would add some
> realism.

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

## 2026-08-23 — one control with two handles

The origin of the kit's bound pair.

> i think life min/max should be a single control with two dots setting the
> min/max bounds on one time axis. even though now min/max are bounding each
> other, it is not reflected in the drag positions.
