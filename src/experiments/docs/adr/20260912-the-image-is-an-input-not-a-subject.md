---
type: ADR
status: proposed
date: 2026-09-12
summary: A frozen runner will not carry or fetch the piece's portrait; the image becomes an input the embedder supplies, and psyxels' avatar subject leaves the piece.
---

# The image is an input, not a subject the piece owns

## Context

Psyxels' `maker` preset sets `subject: "avatar"` and is the only scene in any
piece whose subject is a photograph. `psyxels/runner.ts` already records what
that costs: the runner passes no image, so such a scene "mounts and runs with a
blank subject — a field with no psyxels in it", and the scene is simply never
published.

#173 asked how a frozen runner should be handed an image, with four options. The
research was done and is recorded below, because the measurements outlive the
question.

## What was measured

All of it on the live host and the current tree, rather than estimated.

- **CORS is not the obstacle.** GitHub Pages serves
  `access-control-allow-origin: *` on every asset checked, so a cross-origin
  fetch is available.
- **Canvas tainting is, and psyxels is the worst case in the section.** It draws
  the image (`subject.ts`) and then reads the pixels back with `getImageData`
  (`mask.ts`). Without `crossOrigin = "anonymous"` set _before_ `src`, that
  throws on a cross-origin image. `page.ts` assigns `.src` directly today, so the
  piece would work on this origin and fail on any other — **a failure that only
  appears where nobody is testing.**
- **`_astro/` is the wrong place to point at, and the reason is this repo's own
  recurring one.** The portrait builds to `/_astro/avatar.<hash>.jpeg`. The URL
  is stable across an unchanged rebuild — verified — but `astro build` clears
  `dist/`, Pages serves only the current build and keeps no history, so its
  lifetime is "while the current build still emits it". A runner's promise is
  permanent. That is a permanent pointer at an impermanent target, failing
  silently, which is `20260907-runners-are-committed.md` one level down.
- **`public/` has the right property.** Files are copied verbatim and unhashed —
  `dist/showcase/runners/` carries the same names as `public/showcase/runners/` —
  so an image committed there has a runner's retention, and
  `.github/workflows/runners-append-only.yml` already guards that directory.
- **Inlining costs less than the existing estimate says.** `runner.ts` guesses
  "roughly triple this bundle". Measured: the psyxels runner is 39.2kb, the built
  webp 6.4kb, and base64 adds a third — so **47.7kb, about 1.2x**. The jpeg the
  piece actually loads today would make it 1.9x. The estimate was high, and the
  decision below does not rest on it either way.

## Decision

**None of the four options, and the question is withdrawn rather than answered.**

A piece that owns an image it must fetch is the anomaly, and the measurements
made that legible rather than settling it. `subject` conflates two things that do
not survive the same trip: **which shape to draw**, which is a number and packs
into an address, and **which external resource to read**, which is a file and
does not. A packed scene plus a frozen bundle can carry the first. Nothing about
adding an asset channel changes that the second was never the piece's to hold.

**So the image becomes an input supplied by whatever embeds the piece, and
psyxels is reworked so that the avatar subject leaves it.** Where it goes is open
— a standalone experiment, or a manifestation of this one that runners do not
support. What is not open is that the piece should stop owning a file.

This also serves what the piece is for next: psyxels as a base for pixellating
_animated_ things, where the thing being pixellated is by definition supplied
from outside and varies per embed. An image input is that case's ordinary form,
not a special case for one preset.

### What is settled and what is not

**Settled:** the four options are not being taken; the avatar subject does not
stay in psyxels as it is; the image is an input rather than a property of the
piece.

**Open:** where the avatar case lands, what the input's shape is, and when. Andrei
is not committed to a destination, which is why this is `proposed` — it records a
direction and a closed door, not a plan.

## What survives the redirection

**The tainting finding becomes more central, not less.** An embedder-supplied
image is cross-origin by default, so `crossOrigin = "anonymous"` and a host that
sends `access-control-allow-origin` stop being an implementation detail and
become **terms of the embed contract**. A host serving an image without that
header means psyxels cannot read its pixels at all — and the symptom is a piece
that mounts and shows nothing, on that host only. Whatever the input's shape
turns out to be, it has to say what happens then.

**The `public/` versus `_astro/` distinction stands for any asset a published
artefact points at**, not just this one, and is the generalisable half of the
research.

## Considered options

The four from #173, all rejected by the reframing rather than on their merits.
Recorded so nobody re-costs them.

- **Inline the portrait as a data URI.** Keeps the hash guarantee, which is its
  real merit, at 1.2x the bundle using webp. Rejected because it makes the piece
  own the file harder, and it re-inlines per runner — five pieces sharing a
  portrait would carry five copies.
- **Fetch from a public URL beside the runner.** Workable, and the only version
  worth building would have put the image in `public/` with the runners' own
  retention discipline. Rejected with the rest: it is an asset channel for a
  thing the piece should not be holding.
- **A second content-addressed artefact pinned by the scene.** The most correct
  of the four and the most machinery — it would need its own manifest, its own
  append-only guard, and a second thing for an address to pin.
- **Drop the `maker` preset.** Rejected because it treats the symptom. The
  subject stays worth having; it is the ownership that is wrong.
