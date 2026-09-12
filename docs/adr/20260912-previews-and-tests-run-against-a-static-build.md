---
type: ADR
status: accepted
date: 2026-09-12
summary: The browser suite and human review both run against a static build served by `astro preview` rather than `astro dev`, which removes a family of dev-only bugs and cuts the serving process from 1311 MB to 179 MB; the review port is derived per worktree and the suite's is still discovered.
---

# Previews and tests run against a static build

## Context

Every session on this repo works through agents, and each worktree that ran the
browser suite left an `astro dev` server behind — deliberately, so the next run
would skip a cold start. Measured on one ordinary afternoon there were **four**
of them on a 16 GB box, totalling **4.2 GB**, one of which had been up four days
and seven hours. None of them was a leak; `tests/AGENTS.md` says so explicitly,
because two sessions had already each mistaken the other's for one.

The resource cost is the obvious complaint and the weaker half of the argument.
The stronger half is that **`astro dev` is not the artefact that ships**, and
this repo has repeatedly paid for the difference:

- **A 404 in production that every gate called green.** Psyxels' portrait was
  byte-identical to another asset, the two collapsed during the build, and the
  original was never written. The URL still went into the HTML. `astro dev`
  serves imports straight off disk, so the browser suite passed. The only
  symptom was a person finding a broken image on the live site.
  `scripts/check-links.mts` exists because of it.
- **A stale content store changing what a test is about.** Astro builds the
  store at startup, so a server left up across an `about.md` edit serves the old
  wall order — and `wall(page)` is the subject of most of `reel.spec.ts`. Two
  runs on the same commit drove different pieces during #119.
- **`504 (Outdated Optimize Dep)` read as five page failures** after an
  `astro.config.mjs` edit re-optimised Vite's dependencies. Nothing was wrong
  with the code. It cost another session two full suite runs to find.
- **A year-long cache showing a reviewer the old poster.** The dev `<Image>`
  endpoint keys `/_image?href=…` on the file path with no content hash, so a
  recapture changes the bytes and _cannot_ change the address. Andrei reported
  correct work as broken twice in one session because of it.
- **A fixed port letting a run drive another worktree's branch**, green and
  silent, with posters captured as stills of the wrong code —
  `20260828-a-derived-port-per-worktree.md`.

Four of those five are impossible against a directory of files.

## Decision

**The browser suite and human review both run against `astro build` output,
served by `astro preview`.** `astro dev` remains available for a human who wants
HMR; nothing in the automated path starts one.

Measured before committing to it, on the same box with both servers up so the
comparison is not across load:

|                             | `astro dev` | `astro preview` |
| --------------------------- | ----------- | --------------- |
| RSS while serving the suite | **1311 MB** | **179 MB**      |
| Full browser suite          | 4.9 min     | 2.8 min         |
| Result                      | 177 passed  | 177 passed      |

No test was changed to achieve that. The cold build which buys it is **4.7s**,
a warm rebuild **4.0s**, and `dist/` is 3.1 MB.

### Two ports, deliberately not one

**The review port is derived from the worktree's path**, so every checkout has
its own by construction and keeps it across rebuilds, restarts and sessions. One
bookmark per branch, and several pieces can be on screen at once — which is the
requirement, and is what a single fixed number cannot do: it gives one bookmark
_in total_, so a second worktree wanting to be seen has to take the port off the
first. Measured over the nine worktrees on this box, the derivation gave nine
distinct ports.

**The same scheme is safe here and was not safe for the suite**, which is the
distinction most at risk of being flattened. `20260828` failed because the suite
_insisted_ on its port and because it _adopted_ whatever answered on it.
`scripts/preview.ts` does neither: it stops its own worktree's preview, takes the
slot — under three seconds, since a preview holds no compile cache — and then
believes `.astro/preview.json` about where it actually landed. A collision costs
a different port and a printed warning, never a hang and never the wrong
branch.

**The suite names no port at all.** It builds, adopts or starts a preview, and
reads `.astro/preview.json` to learn where Astro settled. That file lives inside
the worktree and is therefore incapable of naming another branch's server, which
is the property a number does not have.

This asymmetry is the part most likely to be tidied away, so
`tests/unit/preview-ports.test.ts` asserts it, with each absence paired against
a presence so the check cannot pass by matching nothing.

`astro preview` has the **same** one-daemon-per-project behaviour that killed the
derived-port design for `astro dev` — asking for a second port while one runs
reports the running server and starts nothing. Verified, not assumed.

**So why does the same derivation work here when `20260828` says it cannot?**
That is the question the next person arrives with, having found that record, and
"nothing insists on a port" is only half an answer — the objection there was
mechanical rather than about insisting.

The real difference is **how many servers each scheme asks one directory for.**
The rejected design wanted a _second_ server in a checkout that already had one:
a human's dev server on 4354, and the suite then asking for its derived 4437 in
the same directory. Astro reports the running server, nothing ever answers on
4437, and the wait times out. The review port asks for **the only server in its
own worktree**, and takes the slot when something already holds it. That is not
the same demand, and the singleton never refuses it.

Which leaves the one thing the old record genuinely cannot settle, because it is
about a different binary: is the singleton per _directory_, or shared across the
worktrees of one repo? If the latter, nine worktrees could not hold nine
previews and this collapses into the same 120s hang.

**Measured rather than reasoned about.** A second worktree was created, built,
and told to preview while this one was already serving:

```
4707 -> 200    ways-of-working
4423 -> 200    (probe worktree)
379 MB total, two daemons, one .astro/preview.json each
```

Both answered at the same moment, on their own derived ports, from their own
state files — and the pair together cost less than a third of one `astro dev`.
The daemon is per directory. Nine worktrees can hold nine previews.

### "Someone is reviewing" is a live process, not a flag

`astro build` **clears `dist/` before writing it** — verified with a marker file.
So a suite run in the worktree Andrei is reviewing blanks his page and then
serves him a different build: the wrong-branch bug arriving from the build side.

The obvious guard is a flag file, and it is the wrong shape. **Dying is the case
that matters.** A session that ends abruptly cannot clear its own flag, and that
is how most sessions end, so the default outcome of a declared flag is a corpse —
every later build refusing on behalf of a reviewer who left hours ago. The
remedy becomes "delete the flag", people learn the reflex, and the reflex is
indistinguishable from overriding a live reviewer. A guard everyone has learned
to clear is worse than none, because it still reads as protection. A steward
claim held by a dead session cost a session real time last week in exactly this
shape.

So nothing is declared. **A preview actually answering on the review port is the
flag**, checked by pid _and_ by a request — `kill -0` is true for any process
that inherited the number. It cannot outlive what it asserts, because it is what
it asserts. This is the pattern `tests/AGENTS.md` already records for
`dev.json`.

It **warns rather than refuses**. A block would teach a way around it, and the
way around a stale block looks exactly like overriding a live one. The cost here
is one reload, paid by the person being told.

## Consequences

- `tests/support/dev-server.ts` becomes `tests/support/preview-server.ts`, and
  builds before serving. `scripts/posters.ts` follows it, so a recapture now
  shoots the piece as it ships.
- `pnpm run preview` builds and serves on the review port, printing the network
  address. **Never loopback** — this runs on a VM and Andrei's browser is
  elsewhere.
- A rebuild does not restart the server; `astro preview` reads `dist/` per
  request. The loop is build, reload, same URL.
- `pnpm run build:quick` is `runners && astro build` — the build without
  `astro check` and `check:links`, which belong to the `lint` job and answer a
  different question. **`runners` still runs first**, or a piece changed in the
  same commit is served by a stale runner.
- The `noDevToolbar` fixture is deleted: it existed to cover a dev server
  _adopted_ from an older worktree, and there is no adoption and no toolbar.
  `tests/harness.spec.ts` stays and **says in its docblock that it has become a
  revert detector** — it now asserts the absence of something structurally
  impossible, so it can only fail if someone puts the suite back on `astro dev`.
  A passing test that cannot fail is only safe while it admits it.
- **The dev-server diagnoses in `tests/AGENTS.md` are scoped, not retired.**
  `astro dev` still exists and people still run it, so the stale content store
  and the `504` class still bite; they just stop biting the suite. Deleting a
  measured diagnosis because one consumer stopped hitting it is how expensive
  knowledge is lost.
- CI gains a build in the browser job, which is where the class of bug in the
  first bullet becomes catchable rather than merely regrettable.
- **The suite had to stop talking to Google, and nobody knew it had started.**
  This is the change paying for itself on its first run. `GoogleAnalytics.astro`
  gates on `import.meta.env.PROD`, so `astro dev` never loaded it — the moment
  the suite served a build, every `page.goto("/")` became a real `page_view`
  against the live property, and one beacon's network failure took down one test
  out of 177. The failing test was the small half. The silent half is that this
  is what a build-served suite does by default, and would have gone on doing.
  A `noAnalytics` fixture now fulfils those requests with a 204, and
  `tests/harness.spec.ts` asserts it — **by counting what the route intercepted,
  not by checking that nothing failed.** The first version asserted the absence
  of failures and passed with the matcher deliberately broken, because a request
  let through is still in flight when the test ends. Absence of a failure was
  measuring the test's own length.

## What this does not claim

The timings are two conditions measured minutes apart on a shared box, and
`tests/AGENTS.md` rightly warns against reading a single whole-suite number as a
measurement. The direction held across three runs and the mechanism is
understood — the dev server Vite-compiles each experiment on first request and
the build has already done it — but treat 2.8 against 4.9 as "roughly half",
not as a constant. **The memory figures are the solid ones**: both servers were
up at the same instant, serving the same suite.
