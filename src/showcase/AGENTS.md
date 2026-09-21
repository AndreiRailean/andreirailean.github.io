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
tests/unit/showcase-play.test.ts   what `?play` asks for, and the order a shuffled wall plays in.
tests/showcase-wall.spec.ts   the furniture: up while somebody is moving, gone when nobody is.
tests/showcase-autoplay.spec.ts   the wall stepping through itself: wrapping, shuffling, holding when held.
```

**The furniture is hidden by default.** The placard, the counter, the arrows and
the two toggles all come and go on one state — `#showcase[data-idle]`, set by
`viewer.ts` after `IDLE_MS` without a mouse, a key or a touch — and the cursor
goes with them. Anything at all brings the lot back. `?idle=0` pins it on and
`?idle=1` pins it away, which is the only reason a check can click a toggle
without racing a fade.

## The address is the only control

Four query parameters, and **deliberately no UI for any of them**. The case they
were built for is a kiosk: a TV on a dedicated machine with no keyboard and
nobody standing at it, configured once by the address it boots to. A panel would
be furniture on the surface whose whole recent history is having less of it.

| parameter             | what it does                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `?idle=0` / `?idle=1` | Pin the furniture on, or away. Absent by default — the timer decides.                            |
| `?play` / `?play=45`  | Step through the wall, at `PLAY_MS` or at the seconds given. `?play=0` is off, and so is absent. |
| `?play=20-45`         | The same, drawing a fresh interval per scene. A range, not a jitter percentage.                  |
| `?shuffle`            | Play a shuffled lap rather than the curated order. Off by default.                               |
| `?seed=7`             | Pin the randomness. The clock otherwise, so two kiosks do not play in step.                      |

The kiosk address, for the record: `/showcase/?play=20-45&shuffle`.

**Shuffling is opt-in and `wall.ts`'s order is the default.** The wall is
hand-curated and nothing regenerates it, and a `?play` address somebody already
has should keep meaning what it meant yesterday. One word is a low price for the
one place the order was ever the problem.

**A lap, not a random jump**, and that is the whole reason this is worth a
mechanism. Picking uniformly each time repeats — on twenty-four entries it shows
the same scene twice running about one step in twenty-four, and clusters visibly
over an evening. That is _more_ repetitive than the fixed order it was meant to
relieve, in the one way a viewer notices. So `lap()` deals the whole wall,
plays it out, and reshuffles — and it will not open a new lap on the entry
already showing, because the seam is where a repeat would be most visible.

**Autoplay wraps, and `go()` still does not.** A person pressing ↓ on the last
entry has asked for a next one that does not exist and should stop; a wall left
running has to come round, or a kiosk shows the last scene until somebody walks
over to it — the bug the feature exists to fix, one entry later. Keeping the
wrap in the timer is what lets both be true.

**A wall playing itself writes no history at all, and the address is left
exactly as it was given.** This is the third answer to one question and the
first that survived contact with a real kiosk.

Pushing piled up an entry every interval — twenty thousand in a week, and a
back button that could not reach anything anyone chose. Replacing fixed that and
was still wrong, for a reason no desktop browser will show you: **on a kiosk the
address is the configuration, not a location.** A wrapper enforcing a start URL
reads a rewrite as the page navigating away and puts its own URL back, so the
wall played one interval, tried to move, and was reset to the first entry —
forever, and looking for all the world like a wall that could not navigate.

The boot `replaceState` had the same fault and was the louder half of it: it
passed `location.pathname`, which deleted the query on the first frame. The
address bar read `/showcase/` a moment after you typed
`/showcase/?play=20-45&shuffle`, which looks exactly like a redirect eating your
parameters — and a reload came back with autoplay off, so a kiosk restarting for
any reason silently reverted to one frozen scene.

So: an automatic step changes the scene and nothing else, and **a person moving
still pushes** — carrying the query, or arrowing off a `?play` address would
quietly switch autoplay off. What this gives up is a reload landing on the scene
that was showing; on a kiosk a reload is a restart, and it should come back to
the playlist it was configured with.

The clock is per scene rather than a metronome: every arrival reschedules, so a
slow fetch does not eat an entry's turn, and moving by hand gives the next one a
whole interval. A held piece, a hidden tab and a failed runner each interact
with it, and `viewer.ts` says why at `schedulePlay`. The failure is the one
worth knowing about here: **with autoplay on, a dead runner costs one interval
instead of lasting until somebody notices**.

**The prefetch asks where the wall is actually going.** It warmed `at ± 1`,
which stops being where the wall goes the moment a lap is running — a cold
runner at every piece boundary, which is the stutter the prefetch exists to
remove, reintroduced by a feature that never mentioned it. It and the timer both
call `peekNext()` so they cannot drift.

`playSpan`, `pickInterval` and `lap` are exported and unit-tested, because all
of it is numbers in and numbers out and needs no page: what `?play=thirty` means,
that a lap is a permutation, that an interval varies across its range. The
browser suite keeps only what a page can answer — that the wall steps, wraps,
holds when held, and does not repeat inside the first few entries of a lap.
`?play=thirty` reads as _on_: the silent failure is a kiosk showing one frozen
scene all week, which looks exactly like a kiosk nobody configured.

**No wake lock rides on autoplay**, and that was asked and answered rather than
overlooked: the kiosk this was built for does not sleep, and a desktop showing
the wall to a room presses `f`, which already holds one.

**A visitor here is looking, not working.** There is no panel, no slider, and
no way to alter a scene. That is the whole distinction from
`/experiments/<slug>/`, which is the same pieces with every control exposed.

`?seed=` is not a counter-example and the difference is worth keeping straight:
it seeds the **order the wall plays in**, never a scene. Every scene on this
wall is frozen bytes pinned by an entry, and nothing in the address can move
one. A seed that reached a piece would be a control, and there are none here.

## The boundary, and who owns what

The repo has a **steward** — one session tending its shared surface while others
build. **The remit excludes the showcase, and the reason is not geography.**

That distinction is load-bearing, because the reason changed. The scope was
`src/experiments/`, so this directory was outside it for free. It is now a
_property_ — shared, mechanical, verifiable work, wherever it lives — and a
directory clause is no longer an argument for anything. The exclusion that
applies here is that **another session owns this surface end to end**, which is
the only one of the role's three that depends on somebody actually being
accountable for it.

So the boundary is asserted rather than inherited, and these are what assert it:

- The steward keeps the pieces coherent with each other. The showcase is not
  another piece; it is a consumer, and the one whose needs are least like a
  piece's.
- Nearly every good generalisation across the pieces would be a bad
  generalisation across the pieces _and_ the showcase. See below — four of them,
  each of which looks like duplication and is not.
- The dependency runs one way and a shared owner would erode that by being
  helpful.

**If nobody is tending this, the exclusion lapses** and the work is the
steward's like anything else. It is not a reservation.

So: **changes in here are the showcase's; changes to a piece, the kit, the
gallery or a runner's contract are the steward's.** If you need something from a
piece, ask rather than reach — that is how #168 got fixed properly instead of
being worked around here.

**The boundary is deliberately permeable inward, and that is the point rather
than a concession.** A consumer finds bugs in what it consumes: #168 was four
pieces sharing a listener leak that only a host mounting and unmounting
repeatedly could ever surface, and nothing inside the section would have found
it. Reporting upward is the strongest argument that the split is right — the
showcase is the section's first real load test, and it can only be that while it
stays a separate consumer rather than becoming part of what it tests.

**"Your directory / my directory" is not quite the rule**, and the place it
misleads is the hoist. When a third consumer of the pausing appears, the copy
that triggers it may live here, but the destination is `gallery/` — so the
decision to hoist and where it lands are the steward's, on a count taken here.
That is the one move where the right answer is a change on their side prompted
by something on ours.

**Two imports from their side, and the rule is the shape of them rather than
the count.** `gallery/gesture.ts` for the swipe arithmetic, so the wall and the
interactive view cannot drift to different thresholds by accident;
`experiments/random.ts` for the seeded generators, so a shuffled wall is not the
fourth place in this repo to write mulberry32.

The line both sit on: **the showcase may import the section's arithmetic and
never a piece's behaviour.** Pure, no DOM, no knowledge of what a scene means,
and tested in the node suite — that is the test, and it is the same one
`20260829-a-third-copy-of-the-generators-moves-to-the-section.md` used to hoist
the generators out of three pieces in the first place. Copying them in here to
honour the letter of "nothing here imports a piece" would have broken the rule
that clause exists to serve.

It was one import until the shuffle wanted a generator, and the count is
expected to stay small. **Adding a third is still a conversation, not an edit** —
and so is any change to these two.

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

## What is a second copy, and will move

The list above is things that look like duplication and are not. **Idle-hiding
is the other kind** — real duplication, deliberately left alone for now, and the
next one to write it down should hoist it instead.

`kit/controls.ts` fades its chrome and hides the cursor after `IDLE_MS` of
nothing; `viewer.ts` now does the same for the wall's furniture, with the same
number and the same `?idle=` escape hatch. It is a copy rather than an import
because nothing here reaches into the kit, and a wall receding on a different
clock from the experiments would be a difference nobody chose.

So it sits beside the hidden-tab pause as a **known second copy**, under the
section's rule: hoist on the third, not the second. When a third consumer wants
it, what moves is a timer, an attribute name and a query parameter — roughly
twenty lines with no DOM opinion in them — and the destination is the section's
shared layer, which makes it the steward's call on a count taken here.

## The rules

- **Nothing here imports a piece.** Not `src/experiments/<slug>/anything`, not
  even a type. A scene is read by its runner and by nothing else — a packed
  scene is positional, so only the registry that wrote it can decode it. The
  viewer dynamic-imports the **built artefact** at
  `/showcase/runners/<slug>.<hash>.js`, the way `gallery/embed.ts` does. See
  `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`.
  **A piece, not the section**: `gallery/gesture.ts` and `experiments/random.ts`
  are pure arithmetic at the section level and are imported — see
  [the boundary](#the-boundary-and-who-owns-what) for why that is the same rule
  rather than an exception to it.
- **`wall.ts` is hand-curated and nothing regenerates it.** It was seeded once
  from the pieces' `PRESETS` and is an ordinary source file from then on.
  Editing a preset does not republish anything, which is the point.
- **An entry pins a runner by filename, and that pin is what publishes it.** An
  entry says what a scene was published _against_, and nothing moves it. There is
  no index of current builds to consult and there deliberately is not: reading
  one would move every published scene onto the newest bytes the moment a piece
  changed, which is the failure the freeze exists to prevent. The manifest that
  used to be one was dropped —
  `docs/adr/20260912-the-store-holds-published-runners-only.md`.
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

1. **Rebuild.** `pnpm run runners` writes the new bytes into
   `public/showcase/runners/` as an untracked file. Nothing obliges you to commit
   it — building is not publishing.
2. **Decide whether published scenes move.** Nothing forces this and nothing can,
   because leaving them is legitimate — a pinned scene keeps rendering the bytes
   it was published against, which is the guarantee. **So it is a question you
   have to actually ask**, and the answer is usually no. Answering yes means
   editing the entry to name the new runner, and _that_ is what commits it.

**Why a check cannot replace step 2, so nobody re-proposes one.** The _noticing_
is already mechanical: `showcase-runners.test.ts` forces the rebuild and the
commit, so a moved hash always lands in somebody's diff. What is left is a
judgement whose legitimate default is _no_, and a check would have to fail on
the right answer.

The tempting shape is a `kit-opt-out`-style marker on an entry pinned to a
superseded runner, making a stale pin legible rather than forbidden. **It does
not transfer, and the reason is polarity.** That pattern works where adoption is
the norm and divergence is rare, so the marker marks the exception. Here it is
inverted — a stale pin is the ordinary case, because the freeze is the point —
so per-entry markers would be noise on the common path and silence on the rare
one. Exactly backwards.

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
pnpm run typecheck       # now `astro check`; was tsc, which did NOT type .astro
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
