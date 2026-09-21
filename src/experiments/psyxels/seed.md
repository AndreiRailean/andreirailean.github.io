# Psyxels — the seed, and what he said after

Andrei's own words, verbatim. Written by the session, never by him. See
`docs/agents/experiment-writer.md` for why this exists: a transcript dies with
its session, and the prose below exists nowhere else — not in the code, not in
the commits, not in `about.md`.

**This file is a backfill**, written on 2026-09-22 from the session transcript
of 2026-08-29/30, long after the piece was built (#204). It was transcribed in
one sitting rather than appended as it came, which is not what the rule asks
for; a piece started today gets one from minute zero.

**Long preset URLs are replaced with `[preset URL]`.** They are machine data
rather than his phrasing, they ran to four hundred characters each, and the
scenes they name are in `settings.ts`. Nothing else is altered, trimmed or
tidied.

---

## The seed — 2026-08-29

> new experiment. different from the others. I'm seeing a static image - a
> portrait, typographic arrangement, a flower. It is "pixellated", but that
> pixellation is not of the usual kind. Pixels are varying in size and are
> "alive". Pixels appear like a pulsing field and each pixel is a looping or
> small images of different colours. Well, it's less of a loop and more of a
> random selection of frame from a finite set of possibilities. Each pixel
> pulses, changes colour as it shifts through frames. Pixel frames consist of
> elements like: plus sign, minus sign, plus sign in a circle, minus sign in a
> circle. Pixels can be of different sizes and don't have to occupy the space
> forever. So on a say 100x100 image, the top right corner may be occupied by a
> pixel of size 10x10, 20x20, etc. The rest of the pixels are also randomly
> picked and pack out the rest of the space. At random pixels change size and
> pack out the space again.
>
> If we start with letter A drawn to fill the height of the screen. We begin
> simple with a white letter on black background. Only the white (non-black)
> parts of the letter are pixellated and pulsing. Black background stays as is.
> Pixels are allowed to go outside the boundary of the letter, but not so that
> it becomes unrecognisible.
>
> As with previous experiments, see how far you can take it without my
> involvement. I'll come in when there's something look at and we'll adjust in
> flight. There's no need for too much requirements gathering.
>
> I see the pixels as having a mind of their own. They decide which frame to
> show next and how to colour it. While the text of letter A may be white,
> pixels give it a psychodelic feel by pulsing with colour variation. In other
> experiments we have "colour spread" control. So a pixel is a mini-animation
> that makes the static image alive.
>
> If you need a second image to play with, use my avatar in this repo and see
> what you can make of it.

---

## 2026-08-30 — easing between frames, and where the realism will live

> wow, this is nice. make transitions between frames a little smoother so they
> ease in and out. i see the pixels themselves are pulsing, but the transition
> between frames is abrupt. i suspect a lot of the realism in this piece will be
> in the frames themselves: the content, transitions and refinement of detail.
>
> let's set this for the portrait. [preset URL]
>
> next we'll want to play with edge detection and try to accent the edges
> through size of the pixel

## 2026-08-30 — all or nothing, and the life of a large unit

> ok, if you already have a size accent solution, perhaps we can give edges a
> colour profile that makes them stand out a bit more. increasing the size of
> pixels (what should we call them???) doesn't seem reasonable for edges.
>
> on animations: i don't like the + when it grows its lines on bigger pieces.
> i'd much rather see it fade in and grow in size than have it's lines change
> and turn to lines sometimes. also not a fan of circumference materialising as
> an arc. with circles it should be all or nothing and only
> fading/colour/thickness transitions, but no partial presense.
>
> looking at the size distribution, it appears that larger units have a much
> longer "life" and they stick to one place a lot longer than the smaller ones.
> or maybe it only appears that way. again, like in other experiments, larger
> pieces are more "in your face" and so they capture the attention. In this
> experiment it would be better if their life/position wasn't as prominent in
> same location. if we're dealing with a packing algorithm where the probability
> of a bigger pixel finding an empty spot is reduced to other pixels of same
> size, then we can allow overlap and having pixels appearing on top of others
> and forcing an eviction if they're old enough. not sure how it's done in code
> so i'm just spitballing an approach.
>
> on edges, and it's most visible with letter A, it's clear that we need to
> allow for fuzziness. Currently we don't allow any pixels outside of the
> boundary of the artwork being pixellated. I think that rule needs to be
> relaxed by perhaps saying that either the center or any part of the pixel cn
> fall on the artwork to be allowed, i.e. doesn't have to be fully enclosed by
> it.

## 2026-08-30 — the black box, and the theme of every experiment

**This is where _organic change_ is named**, and `src/experiments/CONTEXT.md`
records it as the section's aim.

> what looks odd is when mostly round pixels occupy square space and so large
> ones have a huge black hole behind them. when pixels are allowed to deviate
> off their center, the square box stays put, which makes it even weirder. it's
> an interesting effect overall, but the gaps only highlight the bigger pixels
> more. as in previous experiments and perhaps this is something to capture,
> bigger units: stars, pixels demand more attention and break the illusion of
> natural flow. in this piece it's not as big because we're not necessarily
> looking for "natural flow", but nevertheless "organic change" will be the
> common theme of all experiments.

## 2026-08-30 — slowing it down for an organic simmer

> here's another update for Acid. let's move this to be the first preset.
> [preset URL]
>
> it also reveals something interesting. when slowed down, which i'm doing to
> avoid too much flashing and give it a bit more of an organic simmer feel, big
> psyx reveal a gap when they phase out. it gets filled in quickly enough, but
> feels like larger units should have higher gravity and fade in an out faster.
> maybe i'm inventing things. with the preset above, i have slowed the piece
> down, while ramping up all other timing params for a more organic feel.
>
> Still not a fan of the empty black box. Almost feels like content-carying
> pixels in a bigger psyx should knock out the smaller pieces. this would
> provide for complete fill without empty space. not sure how realistic that is.
> having an offset different to the box is also weird, i think we need to
> offsett the box and the content of the psyx, but that makes for a very fine
> grid.
>
> i just observed a large psyx staying on screen for a very long time. i guess
> some space affinity is still at play.

## 2026-08-30 — a slider is a slider

> i wanted to control the size of the larges psyx and it took me a while to
> figure out that "coarse" is the control. When presented as a percentage of the
> screen it doesn't fit on one line and reveals too much information. It's just
> a slider that controls the size: max is bigger, min is smaller. no need for
> super technical detail in percentages.
>
> "solid" isn't quite what I was aiming for, but misunderstanding is
> understandable. It has it's place. I was more thinking that smaller psyx can
> be shown in the empty spaces left by the unfilled portions of the big ones.
> But that's a much bigger ask.
>
> I also still don't like how offsetting works because the empty box doesn't
> move, only the visible portion moves, so there's this disconnect with the
> empty space being it's own thing.

## 2026-08-30 — build a real glow

> solid stays for a reason that we going to tackle next but with more precision.
> What solid does, in this particular case (please set it as preset 2: neon
> [preset URL]), is it provides a sort of a glow. Now I want us to build real
> glow. Maybe even with an aftereffect feel, so as the psyx is eased out, it's
> afterglow eases out with a delay.

## 2026-08-30 — the afterglow outlives its preset

The bug he describes here is the origin of `#117`, still open.

> set this to preset 3: Ampersand [preset URL]
>
> afterglow looks buggy in that if you click between presets and the target
> preset is on a slow clock, afterglow stays for a long time and is totally
> unrelated to the active preset. set playback on 4,5,6,7 to 1 because they're
> too slow and afterglow makes them look bad

## 2026-08-30 — a preset is never a default

This became
`docs/adr/20260830-a-preset-inherits-from-nothing.md`.

> we don't want Acid to be default settings. We already ran into this when
> working on one of previous experiments. we never want a preset to be used as
> default for others to be based upon. as with flotsam or dangler, first preset
> is just postition one and when experiment is opened without any params it
> redirects to the full url of the first preset. other presets are not impacted
> when something else becomes number one.
