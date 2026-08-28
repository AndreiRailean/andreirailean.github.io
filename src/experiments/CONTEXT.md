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
notes, the way out. Shared and _imposed_ — one implementation each experiment
tints, because a visitor should not have to relearn the exit in the next room. An
experiment does not get to move it.

**Kit** — shared parts a piece builds its own chrome from, in
`src/experiments/kit/`: the bar, the panel, preset management, idle behaviour,
fullscreen, clipboard. Shared and _offered_ — a
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

**Panel** — the expanded settings surface behind the chrome's `adjust`.

**Settings** — the complete tunable state of a piece. Round-trips through the
query string, which makes a URL the unit of sharing: any state worth keeping can
be copied, sent, or handed back to be saved as a preset.

**Preset** — a named, complete settings bundle, loadable from a number key.
Presets are recorded from exploration rather than designed up front; they are
starting points, not fixed configurations.

**Idle** — the state a piece enters after a few seconds without input, in which
the pointer and the chrome both disappear. Suppressed while the pointer rests on
the chrome, so a control cannot vanish mid-drag.

**Console API** — `window.experiment`, the scriptable handle every piece
exposes. Exists because anything reachable only by pointer cannot be checked
from a headless browser at all; see `AGENTS.md`.
