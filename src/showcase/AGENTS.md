# Showcase — notes for agents

**The showcase presents finished work. The experiments section makes it.** Those
are different jobs and this directory exists so they stay different.

If you are about to change something here and your reasoning starts "the
experiments already do X, so the showcase should too" — stop and read
[What must not be generalised](#what-must-not-be-generalised). That instinct is
right about half the time and expensive the other half.

---

## What this is

`/showcase/` shows one published scene at a time, full-bleed, with a way to the
next. Every entry is also an address — `/showcase/psyxels-ampersand/` — that a
link or a reload lands on exactly.

```
src/showcase/wall.ts          the published scenes, in order. Hand-curated. Data only.
src/showcase/viewer.ts        mounts one scene, swaps in place, owns the room's controls.
src/showcase/Wall.astro       the document and all of its chrome.
src/pages/showcase/           /showcase/ and a page per entry. Both render Wall.astro.
tests/unit/showcase-wall.test.ts   every pin names a committed runner of the right piece.
```

**A visitor here is looking, not working.** There is no panel, no slider, no
seed, no way to alter a scene. That is the whole distinction from
`/experiments/<slug>/`, which is the same pieces with every control exposed.

## The boundary, and who owns what

`src/experiments/` has a **steward** — one session tending the shared piece and
kit code while others build. **The steward's remit does not extend here**, and
that is deliberate rather than territorial:

- The steward's job is to keep five pieces coherent with each other. The
  showcase is not a sixth piece; it is a consumer, and the one whose needs are
  least like a piece's.
- Nearly every good generalisation across the pieces would be a bad
  generalisation across the pieces _and_ the showcase. See below.
- The dependency runs one way and a shared owner would erode that by being
  helpful.

So: **changes in here are the showcase's; changes to a piece, the kit, the
gallery or a runner's contract are the steward's.** If you need something from a
piece, ask rather than reach — that is how #168 got fixed properly instead of
being worked around here.

**The one import from their side is `gallery/gesture.ts`**, for the swipe
arithmetic, so the wall and the interactive view cannot drift to different
thresholds by accident. If that ever needs to change, it is a conversation, not
an edit.

## What must not be generalised

Four cases where the showcase and the experiments deliberately disagree. Each
one looks like duplication and is not.

**Failure.** `gallery/embed.ts` empties its container so the host's own
background shows — silence is correct for a decoration on someone else's page.
Here the runner _is_ the page, so failure says which scene failed and leaves the
wall navigable. These will never converge.

**Pausing.** The embed pauses off-screen instances via `IntersectionObserver`.
The wall mounts exactly one entry, so it has no off-screen instance to pause;
its hidden-tab pause is a genuine second copy and its off-screen pause does not
exist. The section hoists on the third copy, not the second — when a third
consumer appears, the _pausing_ moves somewhere shared and the _failure_ does
not.

**Full-bleed.** The interactive view is full-bleed because a phone viewport is a
viewport, which is the case the pieces were tuned for —
`docs/adr/20260906-a-frame-is-not-a-viewport.md` says so explicitly. The wall's
`frame` toggle letterboxes into 4:5 for comparison. Neither is the default for
the other.

**The room's controls.** Fullscreen (`f`) and the screen wake lock live here and
have no equivalent in the builder. A piece draws; how it is presented to a room
is the room's business, exactly as play and pause are.

## The rules

- **Nothing here imports a piece.** Not `src/experiments/<slug>/anything`, not
  even a type. A scene is read by its runner and by nothing else — a packed
  scene is positional, so only the registry that wrote it can decode it. The
  viewer dynamic-imports the **built artefact** at
  `/showcase/runners/<slug>.<hash>.js`, the way `gallery/embed.ts` does. See
  `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`.
- **`wall.ts` is hand-curated and nothing regenerates it.** It was seeded once
  from the pieces' `PRESETS` and is an ordinary source file from then on.
  Editing a preset does not republish anything, which is the point.
- **An entry pins a runner by filename, never by manifest lookup.** The manifest
  says what a piece's runner is _now_; an entry says what a scene was published
  _against_. Reading the manifest here would move every published scene onto the
  newest build the moment a piece changed — exactly the failure the freeze
  exists to prevent.
- **One entry is mounted at a time.** A column of live embeds is the obvious way
  to build a scrolling gallery and is not survivable: every piece is a
  full-viewport 2d canvas with its own loop, and a paused canvas still holds its
  pixels. Neighbours are _fetched_ and not mounted; that is the whole of the
  preloading.
- **The viewer does not go through `embed.js`.** Driving a wall needs `setScene`
  and `destroy`, and `window.showcase` withholds them on purpose — that file is
  a liability shared by every third-party page that ever pasted the tag. Loading
  the same artefact directly costs nothing and widens nothing.

## Publishing a runner is part of changing a piece

**When you change a piece, you have changed what its next runner will be.** Two
separate things follow, and only the first is automatic:

1. **Rebuild.** `pnpm run runners` and commit what it writes.
   `tests/unit/showcase-runners.test.ts` fails until you do, and that failure is
   an instruction rather than a bug. This part is enforced.
2. **Decide whether published scenes move.** Nothing forces this and nothing can,
   because leaving them is legitimate — a pinned scene keeps rendering the bytes
   it was published against, which is the guarantee. **So it is a question you
   have to actually ask**, and the answer is usually no.

Re-pin when the new runner fixes something the old one gets wrong _for the
wall_. It happened once already and is the worked example: #169 fixed a listener
leak that only bites a host mounting and unmounting repeatedly, which is this
one, so the flotsam and dangler entries were moved onto the new hashes in the
same PR. A rendering change nobody asked for is the opposite case — leave it,
and the old scene stays the scene that was approved.

**Old runners are never deleted.** They accumulate in `public/showcase/runners/`
and git is the retention, because GitHub Pages keeps no history. An untracked
runner beside a tracked one is a newer build of the same source; leave both.

## Verifying

All five, because two cover what the others miss:

```
pnpm run prettier        # repo-wide. `prettier --write <files>` is not this
pnpm run lint
pnpm typecheck           # does NOT type .astro files
pnpm exec astro check    # the only thing that does
pnpm test
```

**And look at it.** Everything here is a moving picture with chrome over it, and
three of the defects found so far were invisible to every check above: a placard
illegible over Flotsam at phone size, a stale `data-paused` over a piece that
was plainly moving, and every runner failing to load under `astro dev` while the
build was fine.

## Traps

- **A runner will not load from source under `astro dev` without the Vite plugin
  in `astro.config.mjs`.** Runners live in `public/`, and Vite holds that nothing
  in `public/` is ever a module; a dynamic import written in source is rewritten
  to `<url>?import` and the query trips that guard. **A `@vite-ignore` comment
  does not prevent it** — the transformed module reads
  `import(__vite__injectQuery(url, 'import'))`. `gallery/embed.ts` never meets
  this because it is bundled to `public/` and loaded from an HTML tag.
- **Restart the dev server after a rebase that moved runner hashes.** A running
  server keeps a stale view and every scene 500s, which looks exactly like the
  plugin above having been lost.
- **A piece only re-measures on `window`'s resize event.** Anything that changes
  the canvas's size without the window changing — the `frame` toggle, entering
  fullscreen — owes the piece a synthetic `resize`.
- **Scene strings are opaque here and must stay that way.** If you find yourself
  wanting to read one, the thing you want belongs on the entry as a field.
