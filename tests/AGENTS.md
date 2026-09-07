# tests — notes for agents

Two runners, split by **what a check needs** rather than by how fast it is.

| Runner     | Files                     | Command                 | For                                          |
| ---------- | ------------------------- | ----------------------- | -------------------------------------------- |
| Vitest     | `tests/unit/**/*.test.ts` | `pnpm run test:unit`    | A function and a number. No DOM.             |
| Playwright | `tests/*.spec.ts`         | `pnpm run test:browser` | A real page: canvas, layout, the console API |

`pnpm test` runs both. The extensions are load-bearing — each runner is
configured to collect only its own, or they collect each other's files and fail
on the other's imports.

Mid-change, run one module: `pnpm exec vitest rope`, `pnpm exec vitest run settings`, or
`pnpm exec vitest` to watch. That is the whole reason the unit runner exists; the
browser suite takes seconds and a cold dev server, and answering "did I break the
solver" should not.

**A full `pnpm run test:unit` no longer answers in milliseconds, and one module
is why.** `tests/unit/walkers/` simulates hours of crowd to assert things no
screenshot and no shorter run can — a counterflow sorting into files, a
population holding without arriving in waves, a pace that wanders as somebody
walks — and it is around two minutes of the run on its own. Everything else in
the suite is still instant, and the filter is how you get it:
`pnpm exec vitest walkers` for that piece, `pnpm exec vitest <yours>` for
anything else. Reach for the filter mid-change and the full run before you push.
Nothing is wrong when the full run takes two and a half minutes.

## Neither runner typechecks

`pnpm test` runs both suites and **types nothing**. Vitest strips types and
Playwright compiles per file; a type error in a test passes locally and fails in
CI, where the lint job's `astro check` is the only thing that types anything.

That has now caught two changes in one day from opposite directions: a shared
type renamed with live callers in `.astro` files, which nothing else types at
all, and a test declaring `type Record` — which silently shadows TypeScript's own
generic, so `Record<string, string>` in the same file became "Type 'Record' is
not generic". Both were invisible to a green `pnpm test`.

**So run `pnpm exec astro check` before pushing, not just the suites.** It is the
cheap half of `pnpm run build` and takes seconds. The failure mode is not a
broken build — it is a red pull request after you thought you were done, which is
the most expensive place to find a one-word mistake.

## The dev server the browser suite drives

**Do not give it a fixed port, and do not make it insist on one.** Both are
tried-and-failed, and the second has now been rederived in a separate session —
which is what this section is for.

`tests/support/dev-server.ts` reads `.astro/dev.json`, Astro's own record of the
server it is running for this checkout. That file lives inside the worktree, so
it cannot name another branch's server, and it reports whichever port Astro
actually settled on. A server already up — a human's included — is adopted rather
than fought for.

**The suite leaves one running, and "stop the dev server when you are done" does
not cover it.** `globalSetup` starts a server and deliberately does not stop it,
so the next run reuses it instead of paying the startup again. The consequence
is that **any full `pnpm run test:browser` leaves a server behind whether or not
the session ever started one on purpose** — about 700MB to 1GB of it, on a box
several worktrees share.

So a stray server is not evidence anybody forgot anything, and two sessions here
each mistook the other's for a forgotten one. What tells them apart is
`.astro/dev.json` in each worktree: it names the pid, `kill -0` says whether that
pid is alive, and `pnpm exec astro dev stop` acts on that file alone — so it is
safe to run in your own worktree without checking on anyone else, and is never
the right way to tidy up someone else's. A `dev.json` naming a dead pid is a
session that stopped its server cleanly, not a leak.

**Starting that server runs `pnpm run runners`, so the browser suite builds the
showcase runners whether or not it cares about them.** `pnpm run dev` is
`pnpm run runners && astro dev`. Until #163 the script rewrote
`public/showcase/manifest.json` unconditionally, so **every full
`pnpm run test:browser` left the tree dirty** at a committed file — breaking the
rule in `src/experiments/AGENTS.md` that `pnpm test` must never write tracked
files, and doing it in the one directory where a stray modification is expensive
to misread, since a runner is committed because Pages keeps no history. It writes
only when a runner hash actually changes now, and
`tests/unit/showcase-runners.test.ts` runs the script and fails if a committed
file moved. **So a modified `manifest.json` after a run is a real change**: a
piece's runner has moved and wants committing.

Two things bite anyone who changes this:

- **Worktrees share a machine.** A fixed port means a run here can find _another
  worktree's_ server answering and drive that branch for the whole run. It
  passes, because the pages exist there too, and nothing in the output says so.
  That happened; posters captured in the same run were stills of the wrong code.
- **Astro allows one background dev server per project**, and reports the running
  one rather than starting a second. So a port derived per worktree — the obvious
  fix for the first problem — hangs for the full 120s timeout whenever any server
  for the project is already up. Recorded, with the code that failed, in
  `docs/adr/20260828-a-derived-port-per-worktree.md`.

`BASE_URL` is therefore not a constant. The port is unknown until `globalSetup`
has run, so it is published as an environment variable that workers read through
`use.baseURL`. `PW_PORT` still overrides the port to _ask_ for.

**A long-running dev server serves a stale content store, and that changes which
piece some tests drive.** Astro builds the store at startup, so an `about.md`
edited afterwards is not seen — which `src/experiments/AGENTS.md` says for
_adding_ a note, and is worth knowing for editing one too, because
`gallery/order.ts` sorts the wall by `updated` descending. Any test whose subject
comes from `wall(page)` — most of `reel.spec.ts` — therefore drives whichever
piece the **server's** store thinks is newest, not whichever the working tree
does. Bumping `updated` on one note reorders the wall and silently changes the
subject of a dozen checks.

That cost real time while diagnosing #119: a run against a server started before
an `updated` bump drove psyxels, the same run against a fresh one drove flotsam,
and the two have different preset counts and different scenes. **Restart the dev
server before trusting a measurement that depends on the wall order**, and read
the order off the page rather than from `EXPECTED` in
`tests/experiments-index.spec.ts` — that list pins the index's _contents_ and is
written in a fixed order which is **not** the order the page renders.

**Its sibling is a recaptured poster that does not reach the browser**, for a
different reason with the same shape — Astro's dev `<Image>` endpoint caches by
file path with no content hash, so the bytes change and the address cannot. The
mechanism is in `src/experiments/AGENTS.md`, under Posters, because that is what
somebody running a recapture reads. What belongs here is the diagnosis, since
this is the section you land in when a measurement disagrees with the tree:
**restarting the dev server fixes the content store and does nothing for the
reviewer's cache**, so the two look identical from here and are not.

Walkers, 2026-09-04: a poster recaptured from a daylight park to a night scene
was reported as still green, and the endpoint was serving the correct image at
the time — mean RGB 35, 33, 33, matching the file on disk. **When a report
contradicts something already verified, compare the served bytes against the
file before doubting the code.** Half a morning went the other way.

**A third sibling: after editing `astro.config.mjs`, clear `node_modules/.vite`
before trusting a run.** Changing the config makes Vite re-optimise the site's
dependencies, which changes the `?v=<hash>` on every pre-bundled dep URL. A
server restarted across that edit serves the new hash while anything holding the
old one gets **`504 (Outdated Optimize Dep)`**, and the suite reports each as a
page problem rather than as a build failure:

```
console.error: Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep)
request failed: .../node_modules/.vite/deps/lucide-react.js?v=afd1dc91 (net::ERR_ABORTED)
```

Measured while turning the dev toolbar off: **five failures, all in
`showcase.spec.ts`**, which is the one spec driving the site's own React pages
rather than an experiment. `rm -rf node_modules/.vite`, restart, and the same
commit went 172-passed-5-failed to 177-passed. **Nothing was wrong with the
code.** The tell is that every reported problem names `/node_modules/.vite/deps/`
and none names anything you changed.

Worth knowing because it does not look like a cache: `problems` is the fixture
that catches real console errors, so a stale dep arrives wearing the same
clothes as a genuine regression, and it lands on whichever spec touches the
site's React deps rather than on the thing you edited.

The suite also serves the Astro dev toolbar's module empty, since it is part of
the dev server rather than the site and injects four extra `h1`s into every page.
**`astro.config.mjs` now disables the toolbar project-wide as well**, so on a
server started from this checkout there is nothing to suppress — but the suite
**adopts** a running server rather than insisting on its own, and one from an
older worktree still serves it, which is what the fixture is for.
`tests/harness.spec.ts` checks the end state and says which of the two achieved
it.

## A running piece starves the thread Playwright is talking to

**Everything gets uniformly slower, and nothing stalls.** That is what makes it
read as a mystery instead of as contention.

**The size of the tax is the piece's, not Playwright's**, and the number below is
flotsam's. It scales with per-frame work, which the `dots: 100` row makes plain:
same piece, same loop, a thirtieth of the cost. Measured at the other end by the
showcase session, on the home page's embedded starry-night at 863 dots against
the same page with nothing rendering, it is **1.4-2x on `boundingBox` and about
3x on `evaluate`** — tens of milliseconds per ten calls. So do not carry "35x"
around as a property of the harness; carry the mechanism, and measure your own
piece if the number matters.

Measured on flotsam, whose default scene is 8,500 specks, ten `boundingBox()`
calls on a panel row:

|                          | 10 boxes |
| ------------------------ | -------- |
| piece running            | 9,934ms  |
| `api.pause(true)` first  | 279ms    |
| `reducedMotion: true`    | 215ms    |
| running, but `dots: 100` | 346ms    |

**35x on a call that touches no canvas.** A `boundingBox`, a `getAttribute`, an
`api.get()` — all of them queue behind the render on the single core a headless
run has. `flotsam: both handles of a bound pair` took 24 seconds for this reason
and failed once in a full suite when other work pushed a 10-second `expect`
timeout over.

**So a test about the chrome should hold the piece.** `api.pause(true)` is in the
minimum surface of every piece and parks the frame loop without tearing anything
down — `stats().running` goes false. Do it before touching the panel, not after.
`kit.spec.ts` does, and says so.

**And a drag is one settings change per step.** `page.mouse.move(x, y, { steps:
8 })` is eight of them, and a settings change can be expensive: flotsam's size
pair is in `needsScatter`, so eight steps rebuilt 8,500 specks eight times per
handle. One move is enough when the assertion that follows proves the handle
took. Holding the piece and dropping to one move measured 14,945ms to 6,232ms
for the same sequence.

**An embedded piece has no `pause` to reach for.** `gallery/embed.ts` exposes
`window.showcase` rather than `window.experiment`, so there is no console API on
it and inventing one for a test would be speculative. The way to get a
no-motion arm there is to **route-404 the runner** so nothing renders, which is
how the showcase numbers above were taken.

**Holding the piece does nothing for a test that asks it to simulate.** The two
levers are for different shapes and it is worth knowing which you have. A chrome
test makes many cheap round trips and pays the contention above — holding it is
worth 2.4x. A test that calls `run()` or `settle()` makes a few expensive calls,
and `api.pause(true)` changed flotsam's raft sequence from 14,455ms to 14,151ms,
which is nothing. The work is synchronous arithmetic and parking the frame loop
cannot touch it.

**And the simulated duration is often not the cost either.** #133 asks for these
to be measured, so: flotsam's `a raft ignores the chop` costs the same at
`run(0.5)`, `run(1)` and `run(3)` — 14.4s in all three. Phase-timed, the cost is
**speck size**, not seconds:

|           | with 4mm specks | with 1.2m rafts |
| --------- | --------------- | --------------- |
| `run(3)`  | 346ms           | 6,892ms         |
| `stats()` | 217ms           | 5,747ms         |

A raft that spans a wave has to be sampled across its own footprint, so it is
20x the arithmetic to advance and 26x to measure. That is the piece's physics
rather than a test's waste, it is identical in either runner, and it is why
**moving that test to a headless harness would not make it cheap** — the same
thing #131 measured for walkers, now confirmed on a second piece. What a harness
buys is the page, and a shorter serial chain; it does not buy the arithmetic.

**Do not read a single whole-test timing as a measurement.** This box is shared
with other sessions, and the same test measured 24s, 29s and 41-55s within an
hour with no code change — overlapping ranges for conditions that differ by
2.4x. Compare conditions **inside one run**, where they meet the same load: a
loop of ten identical calls, or two tests in one file. Every reliable number
above came out that way, and the unreliable ones sent this investigation after a
race that was never there.

## The principle

**Assert on numbers. Do not compare pixels.**

Almost nothing that goes wrong in an experiment can be seen. A stretched wire, a
wire that has quietly straightened, a frame that flipped, an arrangement that
reshuffled itself when the count changed, a rate in the wrong units — all of them
look like a plausible scatter of dots in a screenshot. Read the traps list in
`src/experiments/dangler/AGENTS.md`: nearly every entry ends with a note that it
was invisible on screen. Numbers are the only way to tell.

**Comparing two masks of the same run is not comparing pixels, and it is
sometimes the only instrument that works.** The rule above bans a _baseline_ —
an image checked in and diffed against, which fails for reasons nobody can read.
Reading the same canvas twice in one call and counting how many pixels changed
state is a number like any other, and it sees things a total is blind to: a
threshold count of an afterglow moves under a per cent, because light spread
thin crosses the cut in both directions, while the set difference between the
two masks is 1.6–2.5% of the lit area against a control of under 0.05%. #109 is
the worked case; "the afterglow leaves light where the psyx no longer is" in
`tests/psyxels.spec.ts` is the shape. Two things make it safe rather than
flaky: both reads happen inside **one** `experiment.api` call, so nothing can
step the piece between them, and it comes with a **null control** — the same
reading with the thing under test left alone, asserted to come out near zero.
Without that control it is measuring whatever else moved, which is exactly how
the assertion it replaced died.

So stills are captured, into `.scratch/shots/`, as evidence for a human to look
at — and nothing compares them. A baseline over an additively blended canvas
rendered without a GPU would fail for reasons nobody can read, and we would learn
to ignore it. The one visual assertion worth making is coarse and robust: that
there are canvas pixels brighter than the ground at all.

## Reading a canvas — or a draw-time stat — after changing a setting

**`set()` does not draw.** Every piece here marks the scene dirty and asks for
one animation frame, so the canvas holds the _previous_ frame until that frame
runs. A `getImageData` in the round trip straight after a `set()` is inside that
window, and how wide the window is depends on when the browser next produces a
frame — which differs between one CI runner and another. **Wait for a frame
before reading**; `painted()` in `tests/flotsam.spec.ts` is the one-liner.

**This is not only about pixels.** A `stats()` field accumulated _while drawing_
goes stale in exactly the same window, and it comes back as an ordinary number
rather than as an obviously old frame, so nothing about it looks suspicious.
Flotsam's `light` is summed by `specks.lit()` during the draw; the exposure spec
read it straight after a `set()` and got the previous exposure's value —
intermittently, so it passed locally and on three CI runs before failing on the
fourth. Psyxels' `drawn`, `fill`, `colours`, `drawMs` and `fps` are the same kind
and its `AGENTS.md` names them, which is the part worth copying: say which of a
piece's stats are computed in `stats()` and which are filled in while drawing.

Two fixes, both right for different cases. Wait a frame when you want the value
that frame produces. Compute the field in `stats()` instead when it never needed
a frame — psyxels added a `live` count for that reason after hitting this twice.

**And a third case, because "wait a frame" is not always enough: ask what the
frame actually runs.** A loop with a dirty path draws without integrating, so a
field written during _integration_ survives any number of frame waits while
every field written during _draw_ refreshes. Flotsam's `transport` is written in
`advance()` and nothing else is: five frame waits on a parked scene left it
byte-identical, and one `api.run(1 / 60)` zeroed it — #107. Where a piece
exposes a step (`run`, `settle`), prefer it to a frame wait for anything the
integrator computes; it does not depend on whether the scene happens to be
animated. The distinction is invisible in the stat, which comes back as an
ordinary plausible number either way.

The reason this is a section rule and not a line in one spec is how well it
hides. It cost two sessions and three disproved hypotheses as issue #65:

- **A static scene makes a race look like a rasteriser.** The scenes worth taking
  a pixel reading on are usually the still ones — flotsam's set `steepness`,
  `drift`, `eddies` and `stokes` to 0 — so nothing moves, the clock stays at 0
  and the loop parks. A stale frame is then byte-identical every run. The failure
  came back with _the same numbers on two different commits_, which is what a race
  is not supposed to do, so a race was ruled out and the search went to
  compositing. Identical numbers are exactly what this race predicts.
- **The signature is the giveaway.** The changed reading came back equal to the
  unchanged one _to the pixel_. A different rendering path gives a different
  number; only an unrepainted canvas gives back precisely the old one.
- **Demonstrate the fix on the failure.** A frame wait was written, and reverted,
  the session before it landed — it closed a real window but could not be shown
  to close _this_ one, and a plausible non-fix stops anyone looking. Delaying
  every animation frame by 400ms reproduces it on demand, which is what turned
  the guess into a fix.

## Writing a check for a new experiment

1. **Unit first.** Anything expressible as a function of numbers goes in
   `tests/unit/<slug>/`, one file per module of the piece, named after it. The
   `@/` alias resolves, so import the module by the path the piece itself uses.
2. **Then the page**, in `tests/<slug>.spec.ts`, via `openExperiment` from
   `tests/support/experiment.ts`. It waits for `window.experiment`, fails the
   test on any console error, and hands back a handle typed with that piece's own
   `ExperimentApi`.
3. **Anything the piece exposes only through the pointer needs a console API
   first.** See the Console API section of `src/experiments/AGENTS.md`; a control
   that cannot be driven from `window.experiment` cannot be tested at all.
4. **Assert the property, not the current output.** Every test in
   `tests/unit/dangler/` corresponds to a bug that actually happened, and each
   one names it. A test that would pass on a broken implementation is worse than
   no test, so break the code and watch it fail before trusting it.

Callbacks handed to `experiment.api()` run inside the page: nothing from the
test's scope travels with them. Values go through the second argument — the
signature destructures `{ api, arg }` to keep that boundary visible.
