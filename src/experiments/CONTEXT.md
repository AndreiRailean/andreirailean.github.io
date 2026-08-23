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
land on.

**Note** — the human-facing write-up of a piece: `about.md` beside its code,
served at `/experiments/<slug>/about/`. Its frontmatter is what the index is
built from. A note describes what a piece is and how it came to look that way;
it is not a changelog.

**Placard** — the discreet link from a piece to its note, living in the piece's
own chrome. Named after a gallery label: there when looked for, gone while
watching. Never the first thing seen.

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
