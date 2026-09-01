# Experiments — glossary

The vocabulary of the experiments section: terms a second experiment would
inherit.

Words belonging to one experiment stay with that experiment. Starry Night's
_layers_, _glimmers_, _mottling_ and _solo stars_ are defined in its own
`about.md` and `AGENTS.md`, and are not hoisted here — a glossary that named
them would quietly suggest the next experiment ought to have them too.

## Terms

**Experiment** — one self-contained full-page programmed graphic, served at
`/experiments/<slug>/`. Owns its own look entirely and imports nothing from the
rest of the site.

**The piece** — the running graphic itself, as distinct from its note. What you
land on. The piece is the artwork, and the only thing an experiment owns
entirely: its palette, its motion, its geometry, what it draws.

**Gallery** — the surfaces a visitor crosses between pieces: the index, the
notes, the interactive view, the way out. Shared and _imposed_ — one implementation each experiment
tints, because a visitor should not have to relearn the exit in the next room. An
experiment does not get to move it.

**Kit** — the control surface, shared and offered, in `src/experiments/kit/`: the
bar, the panel, their stylesheet, preset management, idle behaviour, fullscreen,
clipboard. Only that. Shared code which is not the control surface sits at the
section level instead — the test is whether a piece could take it without taking
the chrome. Shared and _offered_ — a
piece composes them because it is convenient, and is free to build something else
if what it does needs different controls. The distinction from the gallery is who
is spared the relearning: the gallery spares the visitor, the kit spares whoever
is building or testing. Both in
`docs/adr/20260828-the-piece-is-independent-the-gallery-is-not`.

**Note** — the human-facing write-up of a piece: `about.md` beside its code,
served at `/experiments/<slug>/about/`. Its frontmatter is what the index is
built from. A note describes what a piece is and how it came to look that way;
it is not a changelog.

**Placard** — a gallery label. Two of them, from the same idea: the discreet link
from a piece to its note, living in the piece's own chrome, and the caption
mounted on each poster on the index. Never the first thing seen — there when
looked for, gone while watching.

**Chrome** — a piece's controls. Appears on input and disappears together with
the pointer after a few idle seconds, the way video controls do.

**Interactive view** — what the gallery renders a piece as on a touch device:
full-bleed, no chrome, and three gestures — across for the piece's scenes, up and
down for the wall, and a tap to **hold** it. Its furniture is an X out to the
index and a placard naming the scene with a dot per scene, which come and go with
the same idle state the chrome does, plus one mark in the middle of the screen
that does not: the hold, and a word at either end of the wall. Gallery, therefore
imposed: a piece chooses nothing about it and says one thing about it, which is
that the kit should not draw a bar. It reaches a piece only through the **console
API**, so it holds no knowledge of any piece.

**Held** — a piece with its animation frame parked, from a tap. Distinct from a
scene's `stop()`, which is teardown; a held piece keeps its listeners and picks
its clock up from the moment it is let go.

**Panel** — the expanded settings surface behind the chrome's `adjust`.

**Settings** — the complete tunable state of a piece. Round-trips through the
query string, which makes a URL the unit of sharing: any state worth keeping can
be copied, sent, or handed back to be saved as a preset.

**Preset** — a named, complete settings bundle, loadable from a number key.
Presets are recorded from exploration rather than designed up front; they are
starting points, not fixed configurations.

**Primary** — the _first_ preset, which is the piece's public face. Three
surfaces read it and nothing else: the poster captured for the index, the
backdrop the about page runs behind its sheet, and what a visitor gets landing on
`/experiments/<slug>/` with no query string. Changing all three is therefore one
move — promote a preset to first. "Primary" names the role rather than the code,
which still just calls it `PRESETS[0]`.

**`DEFAULT_SETTINGS`** — _not_ the primary, and the difference is newer than some
of the pieces. It is the arbitrary set of values a piece starts from before any
human has touched it: nothing in the UI can record a preset, so this is a place
to begin rather than a scene anyone chose. Its role is diminishing and it may be
replaced by randomised controls, with only playback speed pinned.

**Nothing presentational may read `DEFAULT_SETTINGS`.** A note, a poster or a
placard taking its scene or its tint from there is reading the arbitrary value
instead of the chosen one, and it looks correct for exactly as long as the two
coincide. Dangler's coincided until 2026-08-28, and its note wore a hue from a
scene the piece no longer ran for two days afterwards.

`tests/unit/experiments-presets.test.ts` holds the mechanical half: a primary
exists, every preset carries the hue those surfaces tint themselves from, and a
note **computes** its accent from the primary rather than writing the number
down. The last of those has no opinion about the colour — offsetting from the
primary passes, typing a literal does not — because a literal is the mechanism
every instance of this fault used, in all four pieces.

**Idle** — the state a piece enters after a few seconds without input, in which
the pointer and the chrome both disappear. Suppressed while the pointer rests on
the chrome, so a control cannot vanish mid-drag.

**Organic change** — the section's aim, and the thing every piece is trading
against. Motion that reads as _something happening_ rather than as a mechanism
running: a field that changes without a beat you can count, a population that
turns over without any one member holding your eye. Named by the pieces' author
across four of them, and the reason **large units are a cost** — a bigger star,
speck or psyx demands attention out of proportion to what it stands for, and a
big one that also sits still is what breaks the illusion first. Recorded, with
what each piece did about it, in
`docs/adr/20260830-large-units-demand-attention.md`.

Deliberately not a rule and not checkable. It is what the numbers in a
`stats()` are ultimately in service of, and what a preset is chosen against.

**Console API** — `window.experiment`, the scriptable handle every piece
exposes. Exists because anything reachable only by pointer cannot be checked
from a headless browser at all; see `AGENTS.md`.
