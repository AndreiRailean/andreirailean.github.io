# A poster held over a booting piece

**Status:** Rejected — 2026-09-01

## Context

A piece is a bare document with a canvas and a module script. Nothing is on the
canvas until the script has loaded, measured the frame, built its population and
produced a frame — so a cold landing is a black rectangle for a moment. On a
desktop it reads as a page loading. On a phone, entered by a swipe from another
piece, it reads as a broken page.

Every piece already has a committed `poster.webp`, captured from its primary
preset, and a bare address renders exactly that preset. So the poster looked
like a pixel-accurate stand-in for the scene that was about to appear, for free.

## What was tried

`gallery/Reel.astro` rendered the piece's own poster as a fixed, full-bleed
`<img>` over the canvas, opaque from first paint. `reel.ts` waited for
`window.experiment` and two animation frames — the piece marks itself dirty and
asks for one frame, so the handle appears before anything is drawn — then
crossfaded the poster out over 420ms and removed it. It was removed outright,
with no fade, when the address carried settings, since then it is a still of a
different scene.

It shipped, on desktop as well as touch, and was looked at on a phone.

## How it failed

It read as a jump, which is worse than the black it replaced. "Loading the image
first causes a weird jump. would be nice if we could just launch into the
experiment on swipe rather than loading the poster first."

The mismatch is structural, and
`docs/adr/20260828-posters-are-captured-by-hand.md` already had the reason
written down: **no poster here is byte-reproducible.** Starry Night takes no
seed at all, so a re-capture is a different sky. Dangler's landing preset fixes
the arrangement but derives its wind from the clock, so the shutter catches the
same strands in a different breeze. The poster and the first live frame are
therefore two different pictures of the same scene, and crossfading between them
is a cut, not a dissolve.

Two pieces make it worse than that. Flotsam's specks take a wave period or two
to gather into lines and its poster is captured after running the sea forward;
Dangler settles its ropes twice before the shutter. Their posters are of a scene
that is *seconds* ahead of frame one, so the crossfade lands on a visibly
less-established picture — the piece appears to fall apart as it comes alive.

## What would make it viable

Only a poster that is a still of the frame the piece will actually produce
first, which means a seeded capture of frame one — losing the whole point of the
recipes, which is that the moment worth shooting is not frame one. Or a hold
long enough for the piece to reach the state the poster was captured in, which
is seconds of a static image on a page whose entire purpose is that it moves.

Neither is worth it. The black rectangle is short, it is honest about what is
happening, and it is what booting straight into the work looks like.
