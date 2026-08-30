# A preset inherits from nothing

**Status:** Accepted — 2026-08-30

## Context

Presets are recorded from exploration: someone drags sliders until a scene is
worth keeping, and the numbers are written down. The obvious way to write them
down is as a difference from the defaults —

```ts
settings: { ...DEFAULT_SETTINGS, hue: 318, spread: 168, wildness: 1 },
```

— which reads as tidy, keeps the diff short, and puts the _interesting_ numbers
where a reader can see them. Flotsam declined to do it and said why in its own
`settings.ts`: "a scene someone found by dragging sliders should stay the scene
they found; inheriting the defaults would let it drift silently the next time one
of those is retuned."

Psyxels did it anyway, and then made it worse by promoting a preset to be the
defaults — the featured scene _was_ `DEFAULT_SETTINGS`, and every other preset
was a spread over it. The failure arrived on schedule. When the featured scene
changed to one watched at a quarter speed, every preset that had not named
`playback` silently became a quarter-speed scene. Four of the six did. They had
also just gained an afterglow, which fades on the piece's clock, so each of them
was additionally wearing a light trail meant for something four times slower.

Nothing was broken. Every one of those scenes was still a legal, renderable
state, and each had been _approved by eye_ in its original form. What had
happened is that four recorded scenes were edited by a change to a fifth, with no
diff, no test failure and no way to notice except by looking at all of them.

The piece's author had hit the same thing on an earlier experiment.

## Decision

**A preset states every setting.** Not a spread over `DEFAULT_SETTINGS`, not a
spread over another preset. `tests/unit/psyxels/settings.test.ts` asserts that
each preset's key set equals the full settings key set, so a new setting cannot
be added without every scene deciding what it wants.

**`DEFAULT_SETTINGS` is a baseline, not a scene.** It is what
`normalizeSettings` fills gaps from and what `settingsToQuery` measures a link
against. It is deliberately uneditorial — in Psyxels, a plain letter with every
effect at rest — so that it moves only when the _meaning_ of a control moves.

**Position one is only position one.** A bare address lands on the first preset
and the page rewrites the URL to that scene's full query. Which preset is first
is presentation; nothing follows from it.

## Consequences

- Preset blocks are long, and repetitive between neighbouring scenes. That is the
  price and it is worth paying: the repetition is what makes each one independent.
- Shared links are long, because a scene is measured against plain rather than
  against whatever is currently featured. This is the right way round — a link
  should carry the scene, not a reference to the current fashion.
- A new setting must be added to every preset at once. This is a feature: it
  forces the question "what does this scene want here" to be asked six times
  rather than answered once by accident.
- Retuning the defaults no longer edits any scene. It changes only how long a
  URL is.

## The check

`tests/unit/kit-adoption.test.ts` carries it, per the section's steward: that
file already walks the slugs and already has the shape for _every piece must,
unless it says why_. It reads the preset blocks as text rather than importing
them, because the question is whether a preset **states** a value, which an
imported object cannot answer.

Two pieces opt out with a reason rather than complying, and both are the same
shape: Flotsam's `offing` and Starry Night's `deep field` are written as
`{ ...DEFAULT_SETTINGS }`. That is a deliberate identity in both — the landing
scene _is_ the defaults there — but it means retuning the defaults edits a
recorded scene, which is what this record is about. The opt-outs say so and point
back here; whether to unpick them is their pieces' call.

Verified by breaking it: dropping one key from one preset, and replacing a preset
with a spread, each fail with the name of the preset and the missing settings.
