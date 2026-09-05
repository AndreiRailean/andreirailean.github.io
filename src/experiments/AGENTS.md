# Experiments — shared notes

Each experiment is a full-page programmed graphic. They are deliberately not a
framework yet; see the last section.

`CONTEXT.md` beside this file is the section's glossary. `docs/adr/` holds the
decisions that shaped it — read the one covering an area before changing it, and
say so explicitly if your work contradicts one rather than quietly overriding
it. Vocabulary and decisions belonging to a single experiment stay in that
experiment's own folder.

Three of those records are rules you will otherwise rediscover the hard way:

- **A piece under exploration owes its URLs nothing.** Presets, defaults and
  already-shared links are not things to preserve while a piece is still being
  found; shaping a change to be a no-op on existing scenes costs solution space
  and nobody asked for it. What that does _not_ cover, and a piece's invariants,
  are in `docs/adr/20260829-a-piece-under-exploration-owes-its-urls-nothing.md`.
- **A field advecting things on a wrapped patch must be periodic on that patch.**
  Incompressible is not enough — the seam gathers, and it does it so
  convincingly that it reads as a result rather than a bug. Measured at an index
  of dispersion of 134 against a baseline of 1, in
  `docs/adr/20260829-a-wrapped-patch-needs-a-periodic-field.md`.
- **A placement strategy is a choice about a scale, and does not travel with the
  file it is written in.** Dangler's R2 sequence is right for eighty anchors and
  comes out as a visible lattice at nine thousand specks. It is why each piece
  keeps its own `random.ts` holding only its own placement, while the generators
  underneath them are the kit's. See
  `docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`.

## Layout

```
src/experiments/<slug>/        code, about.md, poster.ts, AGENTS.md
src/experiments/gallery/       imposed: the index, the notes, the interactive view, the way out
src/experiments/kit/           offered: the control surface a piece builds its chrome from
src/experiments/*.ts           shared and owned by no piece: poster, window.d.ts, random
src/pages/experiments/<slug>/  index.astro (the piece), about.astro (the note)
```

- **Never put `.ts` under `src/pages/`.** Astro turns it into an API endpoint.
  Experiment code lives in `src/experiments/<slug>/`; only routes go in `pages`.
- An experiment page **imports nothing from the rest of the site** — no
  `Layout.astro`, no `globals.css`, no Tailwind. It is a bare document.
  **`pnpm run lint` fails this now**, so it is no longer convention: inside
  `src/experiments/` and `src/pages/experiments/`, an `@/` import must start
  `@/experiments/`, and a relative path may not climb into the site's folders.
  Written as an allow-list rather than a list of the site's folders, so the
  folder the site grows next is covered without anyone remembering. Copy what
  you need into the section, or share it at the section level beside
  `poster.ts`. `tests/unit/experiments-boundary.test.ts` keeps the rule from
  going vacuous — a lint rule that stops matching anything leaves a green
  suite.
- Pages are indexable but nothing links to them yet. A link from the front page
  is expected later.
- **A picture the piece loads itself goes through `getImage`, never `.src`.**
  Reading `.src` off an image import names the original file, and the build only
  writes an original when nothing has asked the image service to process _that
  image_ — a question Astro answers by contents, not by path. Psyxels' portrait
  is byte-identical to `src/assets/avatar.jpg`, the homepage runs that one
  through `<Image>`, the two collapsed into one asset and the original was never
  written. The URL still went into the HTML, so the only symptom was a 404 in
  production: `astro dev` serves every import off disk, and `astro build`
  reports nothing. `await getImage({ src: portrait, format: "jpeg" })` asks for a
  file and therefore gets one.

## Presets

**A preset states every setting, and inherits from nothing.** Not from another
preset, and not from `DEFAULT_SETTINGS`. Spreading over the defaults reads as
tidy and is a trap: the day the featured scene changes, every preset that did
not name a setting silently takes the new one's value for it. Psyxels lost four
of its six scenes to a quarter-speed playback that way, and Flotsam's
`settings.ts` already stated the rule — a scene someone found by dragging sliders
should stay the scene they found. Recorded, with what it cost, in
`docs/adr/20260830-a-preset-inherits-from-nothing.md`.

**`DEFAULT_SETTINGS` is a baseline, not a scene.** It is what `normalizeSettings`
fills gaps from — an address that named nothing, which is an old bookmark or a
bare visit, and neither was ever promised a particular picture.

**A shared address states the whole scene, and no longer measures itself against
that baseline.** `settingsToQuery` writes every setting, whatever its value. Four
of the five pieces wrote only the differences, for a shorter link, and that is
the trap a preset spreading over the defaults is, one layer up: **a link resting
on a default is a link whose scene changes the day the default does**, silently,
in a bookmark belonging to somebody who is not watching. Psyxels had already made
the change and written the reasoning into its own `settingsToQuery`; nobody
carried it across until #128, where starry-night showed the cost — its primary
holds the default values exactly, so the difference was _empty_ and its landing
rewrite produced a bare address, which is the one address meaning "whatever is
featured". `tests/unit/experiments-urls.test.ts` holds all five pieces to it, and
to the landing rewrite restoring its own scene.

The consequence is deliberate and worth stating: URLs are long now. That is the
price of a link that means the same thing next month.

**Position one is the primary, and a great deal follows from being first.** A
bare address lands on it and the page rewrites the URL to that scene's full
query, so a visitor leaves with a link to _that scene_ rather than to whatever is
featured next month. Three other surfaces read it too: the poster captured for
the index — four of the five recipes name no preset precisely because a bare URL
lands here — and both the backdrop a note runs behind its sheet and the hue its
furniture is tinted from, which walkers reads for whether that furniture is
light or dark as well. Promoting a preset to first therefore moves all of
them together, which is the point of the arrangement. See `CONTEXT.md` on
_primary_, and `tests/unit/experiments-presets.test.ts` for the mechanical half.

What does _not_ follow is inheritance: being first makes a preset the piece's
public face and still gives it nothing to inherit from, exactly as above.

## Adding a piece

Four places outside the experiment's own folder know a slug, and three of them
fail loudly while the fourth fails by silently leaving the piece out:

- `scripts/posters.ts` — `SLUGS`, or `pnpm run posters <slug>` says the
  experiment does not exist.
- `tests/kit.spec.ts` — `PIECES`, which runs the whole chrome suite against it.
- `tests/experiments-index.spec.ts` — `EXPECTED`, which pins the index's
  contents.
- `tests/experiments-notes.spec.ts` — `NOTES`, so a third note cannot quietly
  become a third shape.

A piece also needs `src/pages/experiments/<slug>/{index,about}.astro`, and an
`about.md` whose `poster:` line is added _after_ the first capture — the
collection resolves it through `image()` and a missing file 500s the index.

## The `about.md` collection

`src/content.config.ts` globs `src/experiments/*/about.md` and validates the
frontmatter. `/experiments/` is generated from it.

- **Restart the dev server after adding or renaming an `about.md`.** Astro builds
  its content store at startup, so a new file 500s the about page and silently
  renders the index's empty state until you do. `pnpm run build` is unaffected.
- Keep `updated` current when changing an experiment; they are evergreen, not
  dated posts.

## Posters

`/experiments/` shows a still of each piece above its entry. It is captured, not
drawn, and it is committed — see
`docs/adr/20260828-posters-are-captured-by-hand.md` for why not at build time.

```
src/experiments/<slug>/poster.ts     the recipe: which moment is worth shooting
src/experiments/<slug>/poster.webp   the result, referenced from about.md
```

- **`pnpm run posters` captures them; nothing else does.** Not the build, which
  stays browserless, and not `pnpm test`, which must never write tracked files.
  Name a slug — `pnpm run posters dangler` — to leave the others alone. **No
  `--` before it.** npm swallowed that separator and pnpm forwards it, so the
  form these instructions carried until #114 arrived as an unknown slug and
  killed the run. The script now ignores a `--` too, so a command copied out of
  an older ADR still works.
- **A picture that accumulates has to be _drawn_ into, not just advanced to.**
  Stepping a piece forward settles its state; it does not necessarily fill a
  buffer that is built up frame by frame, because that buffer is a rendering
  artefact rather than simulation state. Psyxels hit this first: `run()` draws
  its last twenty steps on purpose, because the glow is gathered _between_
  frames and a fast-forward that draws only its final one leaves the buffer
  holding a single frame — a poster with no glow on a scene that has plenty.
  **The three surfaces that read the primary are the three that fall into it**
  together: the captured poster, the backdrop a note runs behind its sheet, and
  the reduced-motion still, all of which ask the piece to arrive somewhere
  without watching it get there. A piece whose picture _is_ the accumulation has
  no scene at all until enough frames have been drawn, so its recipe has to say
  how many.
- **A recaptured poster does not reach a browser that has already seen it, and
  the dev server is why.** Astro's dev `<Image>` endpoint serves
  `/_image?href=<path>&w=…&f=webp` with `cache-control: public,
max-age=31536000` — a year — on a URL keyed by **file path with no content
  hash**. So a recapture changes the bytes and cannot change the address, and
  any browser that has loaded the index once keeps the old poster. Confirmed on
  a running server: the endpoint returned the correct new image while the
  reviewer was still being shown the previous one. **Restart the dev server
  after a recapture _and_ tell whoever is reviewing to hard-reload**, because
  restarting alone does nothing for their cache. Production is unaffected — a
  static build emits content-hashed `_astro/poster.<hash>.webp` — which is
  exactly what makes this expensive: it only ever bites during review, where
  the reviewer's own eyes say the change did not land. Its sibling, a stale
  content store changing the wall's order, is in `tests/AGENTS.md`.
- **A recipe is per-piece knowledge and stays with the piece.** Which preset,
  what has to happen before the shutter, how long to wait. Dangler loads a
  seeded preset and calls `settle()` twice, because a frame caught mid-relaxation
  shows a shape it never holds. Starry Night needs none of that — its layers are
  seeded out of phase, so frame one is already a sky — but takes the brightest of
  twelve tries, since its glimmers are too brief to catch on purpose.
- **No poster is byte-reproducible, for two different reasons.** Starry Night
  takes no seed at all, so a re-capture is a different sky. Dangler's landing
  preset does carry one, which fixes the arrangement — but its wind is derived
  from the clock too, so the shutter catches the same strands at a different
  point in the same breeze. Both look unchanged to a person and both churn the
  file. Hence the slug filter: re-capture the piece you actually changed.
- `scripts/posters.ts` is generic and knows nothing about any piece; the shared
  contract is the types in `src/experiments/poster.ts`. Per ADR-0002 that is all
  it is allowed to be — a shape, not a base class.
- `poster` is optional in the collection schema. A piece may exist before anyone
  has decided what one frame of it looks like, and the index falls back to a
  text-only entry.

## Console API

Every experiment exposes `window.experiment` so its controls can be driven
without a pointer. Minimum surface: `get()`, `set(patch)`, `preset(n)`,
`presets()`, `pause(held)`, `panel(open)`, `idle(force)`. See an existing
experiment for the shape.

`presets()` and `pause()` joined that list with the interactive view, which is
the first thing other than a test to drive a piece through this handle: a swipe
through the scenes has to say what it landed on, and a tap has to hold the piece.
`tests/support/experiment.ts` carries the same list as `BaseApi`.

**The chrome half of it comes from the kit — spread `createBaseApi`.**
`kit/api.ts` supplies `get`, `set`, `preset`, `presets`, `panel`, `pause`,
`idle`, `url`, `fullscreen` and `awake`, given the piece's `PRESETS`, its
`normalizeSettings` and a scene with a `setPaused`. It was hoisted on the
third-copy rule at the fourth copy: all four pieces had written those ten
methods out, byte-identically, and Starry Night's differed from the other three
by one identifier. **`set()` in particular is a trap worth not re-deriving** —
`Controls.apply` is the raw setter and does not normalize, so a hand-written
`set` that forgets is how the API reaches a state a URL could not.

What stays the piece's, because these differ for reasons: `controls()`,
`stats()`, `debug()`, the console banner, and the piece's own verbs like
`settle()` and `run()`. `tests/unit/kit-adoption.test.ts` fails a piece that
drives the chrome by hand from its `api.ts` instead — unless it says why.

**A setting may be a value or a list, and `===` no longer compares two of
them.** Every piece made settings a bag of primitives until Psyxels' vocabulary
became the marks themselves rather than a count of them, so identity comparison
was right for months and then quietly was not: `normalizeSettings` hands back a
fresh array every run, so a scene loaded straight from a preset stopped equalling
that preset. Use the kit's `sameValue`, which compares one level deep. **Three
readers depend on that one comparison, and only two of them are the kit's** —
the preset bar's active state, the arrow keys stepping through presets, and
`data-preset` on `<html>`. The third is the interactive view's: `gallery/reel.ts`
reads that attribute through a mutation observer and has no other way to know
which scene is on screen, since `gallery/` may not import a piece. So an identity
compare in the kit costs the reel its placard and its dots, which is a gallery
failure arriving from a kit line.

**`controls()` reports one entry per settings key, and every key must be real.**
Flatten over the kit's `keysOf(control)`: a range owns two settings and has
`keys` rather than a `key`, so a piece mapping `control.key` straight through
reports `undefined` for it. Three pieces did something different here and
nothing said which was the contract — Dangler read `control.key` and was correct
only because it happens to have no range control; Starry Night reported one
entry per _control_ with a `keys` array. It cost a real assertion, because
generic code reading `.key` off those got `undefined`, wrote its patch to a
setting no piece has, and then passed because nothing had moved. Extra fields
are fine — Starry Night keeps a `kind` discriminant, the others carry `group` —
but `key` is the part everything else may rely on.
`tests/kit.spec.ts` holds every piece to it.

**`pause()` is not the scene's `stop()`.** `stop()` is teardown — it drops the
resize listener, and in two pieces `start()` visibly moves the scene on the way
back: Dangler settles its ropes and Flotsam re-measures and redraws. Every piece
therefore has a `setPaused(held)` that parks the animation frame and nothing
else, and picks the clock up from the moment it comes back rather than from where
it was left. Starry Night is the one piece where `stop`/`start` already did
exactly that.

The global is declared **once for the section**, as `unknown`, in `window.d.ts`;
each piece keeps its own typed reference rather than widening it. Do not add a
second declaration — see
`docs/adr/20260824-one-window-experiment-declaration.md`.

**Reach for it whenever something is only verifiable through interaction.**
Anything behind a click is invisible to a headless check otherwise — a panel that
silently rendered unstyled, and a slider track that flipped colour at certain
hues, both went unnoticed until the API could open them. Where a tool cannot
evaluate JS at all, give the API a query-string trigger (`?panel=1`) rather than
leaving the state unreachable.

Route external input through one validator shared with the query string, so the
API cannot produce a state a URL could not. `pnpm test` drives these APIs
directly; see **Verifying** below.

Expose a `stats()`-style read of internal counts too. Without one there is no
way to tell whether a transition converged or a population was rebuilt, and a
screenshot cannot show it — one real regression here was invisible until the
counts were readable.

`webcheck` cannot evaluate JS. Reaching the API headlessly is what `pnpm test` is
for: `tests/support/experiment.ts` opens a piece, waits for `window.experiment`
and hands back a typed handle on it, so nothing needs to hand-roll a CDP harness
any more. Note that headless runs without a GPU, so absolute frame times are
pessimistic — trust the ratios between configurations, not the numbers.

## Verifying

`pnpm run build` covers `astro check` and the link check below, `pnpm run lint`
covers eslint, and none of them sees anything visual.

**`pnpm run lint` is not what CI's lint job runs.** The job is
`pnpm run prettier && pnpm run lint`, and `pnpm run prettier` is
`prettier . --check`. So a formatting-only difference passes every local command
in this list and turns the branch red anyway — which has happened, on a comment
block that eslint was perfectly happy with. Run `pnpm run prettier` too, or
`pnpm exec prettier <file> --write` on what you touched.

- **`pnpm test` is two runners, and `tests/AGENTS.md` is the contract.** Vitest
  over `tests/unit/**/*.test.ts` for anything that is a function and a number;
  Playwright over `tests/*.spec.ts` for anything needing a real page. Both assert
  on _numbers_ rather than comparing pixels — almost every bug in this section was
  invisible in a screenshot. Stills land in `.scratch/shots/` for a human to look
  at and nothing diffs them.
- **Reach for the unit runner while working.** `pnpm exec vitest rope` answers in
  milliseconds where the browser suite needs seconds and a dev server.
- **Do not give the browser suite a fixed port, or one derived per worktree.**
  Both fail, the first silently — see the dev-server section of
  `tests/AGENTS.md`.
- Use `/root/bin/webcheck` (see the machine's global notes) to sweep many pages
  at once for console errors and stills. It cannot evaluate JS; that is the one
  thing `pnpm test` adds.
- **A 200 proves nothing about content.** Grep the response for text you expect;
  an empty collection renders a perfectly valid blank page.
- **`pnpm run build` ends by checking that the built site answers its own
  addresses.** `scripts/check-links.mts` walks `dist/`, resolves every local
  `href`, `src`, `srcset`, `data-*` and `url()` against what was actually
  written, and fails the build on anything dangling. It is on the deploy path
  too — `withastro/action` builds by running the same script — because the bug
  it was written for reached production through it. Run it alone with
  `pnpm run check:links` against an existing `dist/`.
- Both runners resolve the `@/` alias, so a test imports a module by the path the
  piece itself uses. Reaching for bare `node --experimental-strip-types` on a
  module still does not — that is what the runners are for.

## Three layers: the piece, the gallery, the kit

Recorded in `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`,
which supersedes ADR-0002's blanket "no shared anything". What separates the two
shared layers is **who is spared the relearning**.

- **The piece owns its rendering, completely.** Palette, motion, geometry, what
  it draws, its settings and presets. Nothing shared reaches inside that, and it
  is not up for revisiting — it is the half of ADR-0002 that survives.
- **`gallery/` is imposed.** The index, the notes, the way out — what a visitor
  crosses _between_ pieces. `gallery/Note.astro` renders every note: an
  experiment passes a `NoteTheme` and a script booting its own piece behind the
  sheet, and chooses nothing else. It does not get to move the exit, because a
  visitor should not have to find it twice.
- **`kit/` is offered, and it is the control surface only.** The panel, the bar,
  their stylesheet, the chrome half of the console handle (`api.ts`), and what
  those need to work — `copy.ts`, `fullscreen.ts`,
  `wakelock.ts`. Compose them because they are already learned; ignore them if
  the piece needs a different control structure. The art ends at the console API,
  so controls sit outside that boundary. Using the kit is never a reason to
  refuse a piece something; quietly re-implementing what it already does well is
  the thing to avoid.
- **Shared code that is not the control surface sits at the section level**,
  beside `poster.ts` and `window.d.ts`, which already mean exactly that. `kit/`
  is not a cupboard for anything two pieces happen to share: the test is whether
  a piece could take it _without_ taking the chrome. The generators could;
  `copy.ts` could not. There is no `lib/` folder because one module does not earn
  one — the second will. See the "What the kit is not" section of
  `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`, which also
  records why not `src/lib/` (that is the _site's_, and importing it would invert
  the boundary) and why not `packages/`.
- **Neither imports from a piece.** Lift `kit/` out with an experiment and the
  experiment still runs.

### What joins the kit, and when

**A part is hoisted when a third piece wants it, not when a second does.** That
is ADR-0002's rule, kept deliberately by its successor, and it has now been
exercised in both directions:

- `wakelock.ts` moved in when Flotsam was about to make it a third byte-identical
  copy — `docs/adr/20260829-the-third-copy-moves-to-the-kit.md`.
- The **console API's chrome half** moved in at the _fourth_ copy, as
  `kit/api.ts`: ten methods written out identically in every piece. It went to
  `kit/` rather than the section level because every line of it drives the
  `Controls` handle `createControls` returns — a piece cannot take it without
  taking the chrome, which is the test. The delay is itself worth noting: the
  copies were methods on an object literal, so the adoption check could not see
  them, and #85 was a divergence inside that blind spot which cost a real
  assertion. The check can see it now.
- The **generators** — `hashSeed`, `makeRng`, `gaussian` — waited for a third
  piece and were hoisted with Psyxels, whose every psyx draws from
  `makeRng(hashSeed(seed, depth, column, row))`. They went to the **section
  level** rather than into `kit/`: the kit is the control surface, whose parts
  travel together, and the generators travel alone and need no browser. See
  `docs/adr/20260829-a-third-copy-of-the-generators-moves-to-the-section.md`.
- The **placement strategies** built on them did **not**, and each piece keeps
  its own. Copying one copies a choice about scale that does not travel:
  Dangler's R2 sequence is right for eighty anchors and is a visible lattice at
  nine thousand specks —
  `docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`. The seam is
  stability without policy below, policy above.

### The interactive view

On a touch device a piece is presented full-bleed with no chrome at all, and the
two gestures are the whole interface: **across for the piece's scenes, up and
down for the wall.** `gallery/Reel.astro` is the furniture — an X out to the
index, and a placard naming the scene — and `gallery/reel.ts` is the behaviour.
Both are imposed, for the reason the notes are: a visitor should not have to
relearn how to leave, or which way the next piece is, in the next room.

- **It reaches a piece through `window.experiment` and nothing else.**
  `gallery/` may not import a piece, and does not need to — the console API was
  built so a headless check could get past the pointer, and this is the same need
  from the other side. So nothing in `reel.ts` knows what a setting means, which
  is what keeps it from growing per-piece knowledge.
- **`?reel=1` forces it on and `?reel=0` off**, in the idiom of `?panel=1` and
  `?idle=`. Not only for tools: it is how the view gets looked at on a desktop,
  and Playwright cannot emulate `(hover: none) and (pointer: coarse)` at all.
- **A piece says one thing about all of it**: `chrome: !isReel()`. The kit stays
  headless rather than being skipped, because `createControls` is the settings,
  the validator and the URL sync as well as the bar — see `chrome` in
  `kit/controls.ts`.
- **Headless does not mean keyless.** `chrome: false` skips appending the bar and
  the panel; the kit's `keydown` listener registers either way, so the digits,
  `c`, `f`, a piece's action shortcuts and `←` / `→` all still work here. That is
  wanted — a tablet with a keyboard gets what the swipe gives — and it stays
  consistent because both paths go through the kit's one `apply()`, and the
  placard and dots read `data-preset` through a mutation observer rather than
  being written by whichever gesture moved the scene.
- **The kit publishes which preset is on screen** as `data-preset` on `<html>`,
  beside `data-idle`. It already knew, and nothing else can work it out without
  an opinion about what a piece's settings mean. Absent, not `-1`, when the scene
  is nobody's preset.
- **Two other horizontal gestures were built and thrown away**, and the reason
  is in `reel.ts` so nobody rebuilds them: the piece following the finger read as
  an animation about the swipe rather than about the work, and changing scenes
  continuously under the fingertip invited the reading that a horizontal drag
  seeks _within_ a scene, which is not a thing any piece here has. The placard's
  mid-drag preview of the scene it _would_ land on went with them, and was the
  most confusing part of all three — the name changed, the work did not, and the
  two disagreed until the finger came off. **The placard only ever names what is
  actually running.**
- **One slot in the middle of the screen**, for everything that is about the
  view rather than about the work: the piece's name on the way in, the mark for
  a tap that held it or let it go, and a word at either end of the wall. One
  timer pair for all of them, so two cannot be up at once and a second flash
  replaces the first rather than racing it. Every one of them goes, the way the
  chrome does — a persistent hold mark was tried first and was more furniture
  than the view wanted.
- **A tap holds the piece**, through `pause()`. The state outlives the mark that
  announced it, which is why a resume shows the _other_ icon rather than the
  same one again — on a slow piece that is the only thing distinguishing held
  from running.
- **Arriving names the piece, large, over the gap where it boots.** A piece
  arrives as an empty canvas, and between two full-bleed graphics that makes
  arriving somewhere new and arriving nowhere look the same. It is also the
  swipe's only acknowledgement: the placard is still naming the _scene_.
- **The dots are the only thing that says the horizontal axis exists.** A gesture
  with no visible extent is one nobody tries twice, and the placard's own words
  cannot say how many scenes are left. The vertical axis gets a one-line hint,
  once a session.
- **Both ends of the vertical axis say so**, and then stop saying it. Silence at
  the end of the wall reads as a gesture the view failed to register, which is
  the explanation a visitor reaches for first.
- **The screen is held awake by the kit's `wakelock.ts`, and only over HTTPS.**
  Screen Wake Lock is a secure-context API, so a piece served over plain `http`
  to anything but localhost silently gets no lock — which is every phone looking
  at a dev server by IP. Nothing is wrong when that happens, and there is
  nothing to fix in the page.
- **The address the view arrived at is read once, at import.** A piece landed on
  bare rewrites its own query and drops every param that is not a setting, so
  reading the live address later says this visit never asked for the view. That
  was a live bug the browser suite caught.
- Neither axis wraps, and adding a piece needs no change here — the order comes
  from `gallery/order.ts`, which the index uses too.

The seam, and the two routes not taken, are in
`docs/adr/20260901-the-gallery-presents-a-piece-on-a-phone.md`.

**A poster was held over the canvas while the piece booted, and it is gone.** It
removed the black rectangle of a cold landing, and it cost more than it saved:
the still is of a scene the piece is not yet running — no poster here is
reproducible, and two pieces need seconds to establish — so the crossfade landed
as a visible jump from one picture to a different one. Booting straight into the
piece is honest about what is happening. Do not put it back without solving the
mismatch: `docs/adr/20260901-a-poster-held-over-a-booting-piece.md`.

### The kit renders the chrome, and dresses it

`kit/controls.css` holds the appearance as well as `controls.ts` holding the
behaviour. They were separate until three pieces had hand-written near-identical
copies of those rules, and **every kit bug so far had come out of that gap** —
a range row's filled bar taking pointer events so its lower handle could not be
grabbed, which shipped in Starry Night the day it had a range control and reached
Flotsam by being copied; and Flotsam's `.span` stacking two tracks where a range
needs one overlaid. Neither was a mistake about how a piece should look. Both
were mistakes about how the chrome _works_, made in a file with no reason to know.

- **Structure is the kit's.** What stacks where, what takes a pointer, how a
  two-handled track is assembled. A piece does not get to redecide these, for
  the same reason it does not get to move the note's exit.
- **Appearance is a token contract**, listed at the top of `controls.css`:
  `--ui-text`, `--ui-label`, `--ui-heading`, `--ui-panel`, `--ui-chip`,
  `--ui-edge`, `--ui-edge-hover`, `--ui-on-bg`/`-text`/`-edge`, `--accent`,
  `--track`, `--ui-fade`, plus four measures the pieces legitimately disagree
  about — `--ui-label-col`, `--ui-value-col`, `--ui-panel-min`, `--ui-row-gap`.
  Every one has a fallback, so chrome works before a piece sets any of them.
  Starry Night drives the whole thing a second time from its inverted scheme.
- **Import it in the page's frontmatter**, so it is a real stylesheet in the
  head rather than something the client script injects.
- **The keys are the kit's too**: `c` and `Escape` for the panel, `f` for
  fullscreen, a digit for that preset, and **`←` / `→` to step through them**,
  clamped at both ends the way the interactive view's swipe is. A piece's own
  `actions` add single letters. The one trap: the arrow guard tests the _focused
  element_, not whether the focus is inside the chrome. Scoping it to the chrome
  is the obvious guard and is wrong — clicking a preset leaves the focus on that
  button, so the very next arrow press, the likeliest one there is, would do
  nothing. A field that uses arrows keeps them; a button has no use for one.
- **Still offered.** A piece that wants different chrome declines the import,
  exactly as it can decline `controls.ts`. The three tokens' worth of theming is
  the cheap path, not the only one.

### When the kit cannot do what your piece needs

Two ways out, and **neither of them is quietly writing your own**. Every kit
fault so far reached a second piece by being copied, and each was invisible
because nothing said a duplicate existed.

- **Diverge on purpose, in writing.** Put `kit-opt-out: <reason>` in the file
  that differs — the module, or the page's `<style>` block. One line, and the
  divergence is a decision someone can find.

  **The reason is the part that counts, and one line does not excuse
  everything.** A bare `kit-opt-out:` with nothing after it satisfies nothing;
  what these checks rule out is silence, and a magic word would put us back
  where we started. And where two checks read the same file for unrelated
  reasons, the marker **names the one it answers** —
  `kit-opt-out(presets): <reason>`, `kit-opt-out(primary):`, `kit-opt-out(hue):`
  — while the bare form keeps its own meaning, which is _this file is not the
  kit's_. The two do not stand in for each other, so a piece needing both writes
  both. Starry Night carried one unqualified line about a preset spreading over
  its defaults, and it was also, silently, the reason nothing checked that the
  piece had a primary; see `tests/unit/opt-out.ts`, which owns what satisfies a
  marker and carries the history.

- **Or say the kit is short**, by opening an issue labelled `kit`. A control kind
  it has no row for, a behaviour it hardcodes, a token it does not expose: those
  are gaps, and the next piece will hit them too. `scale: "log"` arrived exactly
  this way — Flotsam's `span` runs from a puddle to open water and a linear track
  put half the piece in the first two per cent of its length.

**File it; do not go looking for whoever is stewarding.** One session is
sometimes asked to tend this shared code, and you do not need to know whether
that is true today, who it is, or whether there are two of them. An issue
labelled `kit` reaches the role rather than a session: stewards come and go and
the queue does not. A message reaches whoever happened to be live when you sent
it, which on at least one day was two sessions and on most days is none. If a
steward messages you first, answer — it will be carrying something that is not in
the repo yet, like a check that is currently red.

**You are never blocked waiting for any of this.** The kit is offered, so a gap
in it is never a reason to stop: write the `kit-opt-out` line, build the thing
your piece needs, and file the issue on your way past. Nothing about the shared
code outranks getting the piece made — the section exists for the pieces.

`tests/unit/kit-adoption.test.ts` enforces the first of those and runs in the
unit suite, so it answers in milliseconds: no piece may carry its own copy of a
kit module, redeclare a selector `controls.css` owns, build the kit's chrome
without importing its stylesheet, or drive that chrome by hand from its `api.ts`
instead of spreading `createBaseApi` — unless it has said why. It cannot require
adoption, because the kit is offered; it requires that not adopting be legible.

**Its blind spot is worth knowing, because it is where the last two faults
lived.** The symbol check compares what a piece `export`s against what the
shared layers export, so anything that is not a top-level `export` is invisible
to it — a method on an object literal most of all. That is exactly how ten
duplicated console-API methods sat in four pieces unremarked, and #85 was a
divergence among them. The `api.ts` rule above is written as "do not reach into
`controls` from here" rather than as a search for those method names, because
the names are ordinary words and the calls into the handle are not.

The class names are the kit's namespace — `.bar`, `.panel`, `.group`, `.row`,
`.label`, `.value`, `.span`, `.modes`, `.mode`, `.preset`, `.toggle`, `.copy`,
`.about` — and **a setting key must not be able to land in it**. A slider carries
its key as `data-key`, not as a class, because Flotsam has a setting called `span`
and a class of that name pulled the two-handled-track rules onto a plain slider.
