---
type: ADR
status: accepted
date: 2026-09-07
summary: Runners and the manifest are committed and never pruned, because a published page pins a runner by content hash; a rebuild in CI proves what is committed is current.
---

# Runners are committed, by hand, and a rebuild proves it

## Context

`20260906-a-published-scene-is-settings-plus-a-frozen-runner.md` established
that a page outside the section runs a piece by pinning a **runner** — the piece
bundled, named by the content hash of its own bytes. It left the runners as build
output, written into `public/showcase/runners/` and pruned on every build.

That was only ever coherent while the one page using a runner was rebuilt in the
same breath as the runner itself. The moment a page **pins** a hash, pruning
deletes the file that page names, and the failure is silent: the loader empties
its container and the host's own CSS background shows, which looks deliberate.

So pinning requires retention, and a build directory has none. GitHub Pages
serves exactly what the current build emits and keeps no history, which is the
constraint that decides the rest.

## Decision

**Runners are committed to the repo**, and so is `manifest.json`. `embed.js` is
not. Git is the accumulation; Pages is the distribution.

The split states the design. The immutable things are committed, so a page that
pinned one keeps finding it. The one deliberately mutable thing — the loader, the
only part that can be fixed for every embed at once — is rebuilt every time and
never pinned by anybody.

The manifest is committed for a duller reason: it is what tells anything in the
Astro build which runner is a piece's current one, and leaving it generated would
put a build-order dependency in front of `astro check`.

**Being committed means it is only written when it changes**, which was an
amendment rather than part of the original decision — see #163. `pnpm run dev` is
`pnpm run runners && astro dev`, so the browser suite ran the script every time
its `globalSetup` started a server, and an unconditional write stamped HEAD into
`manifest.json` on every run. That broke the rule in `AGENTS.md` that `pnpm test`
must never write tracked files, and it made the `commit` field untrue besides:
documented as tracing a runner back to a tree, it recorded the commit at which
somebody last started a dev server. The field now means **the commit these
runners were built at**, and the manifest is left alone when the runner map is
unchanged — which is the property the content-addressed naming already promised
one section up. `tests/unit/showcase-runners.test.ts` runs the script and fails
if a committed file moved.

**And the untruth had already landed, which is the part worth keeping.** Not a
working-copy observation: `ee57788` — a documentation-only commit, "the
superseded record no longer reads as live", in PR #160 — carries

```diff
-  "commit": "1b6c6e48e2ba2f4ab1486b14b3e1cc780fd5372a",
+  "commit": "bd5b4b7d1f02ba706a450779a646f67b6f89142f",
```

and nothing else. `starry-night.490e5f9452c8.js` is unchanged across both, so the
provenance stamp moved in a commit that touched no runner and no code. `bd5b4b7`
is simply what HEAD happened to be when somebody last ran the browser suite. A
field that records something other than what it claims is worse than no field,
which is why the semantics are the more important half of this amendment and the
tracked-file rule is the more visible one.

**Committed by hand, in the change that alters the piece.** `pnpm run runners`
writes them; a human or an agent commits what it wrote. The precedent is
`20260828-posters-are-captured-by-hand.md`, and the reasoning transfers: this is
a published thing rather than an intermediate, and it should be visible in the
diff of the change that produced it.

**And unlike a poster, it can be checked.** A poster is deliberately not
byte-reproducible — Starry Night takes no seed, and Dangler's wind comes off the
clock. A runner is: three clean builds of `starry-night/runner.ts` produced
`053becfbd15a` every time. So `tests/unit/showcase-runners.test.ts` rebuilds from
source and fails if the bytes it gets are not already committed under their own
name. "Somebody changed a piece and forgot to publish" stops being a failure mode
rather than merely being unlikely, which is the one thing the poster arrangement
cannot offer.

`scripts/runners.ts` therefore **never deletes**. It writes.

## Considered and rejected

**CI commits on merge.** Needs write access to a protected branch, a bot
identity, and it lands a commit after the merge that nobody reviewed. More
machinery, and it moves the publish out of the diff where it belongs.

**An object store — S3, R2 — with a publish step.** The right answer once this
outgrows one repo, and where option 1 hands over at that point. It needs an
account, credentials and a deploy path, none of which exist, to solve a problem
git already solves at this size.

**Leave the page tracking the current build.** What the first implementation did.
It makes the site and the section one system, which is the thing this reverses:
a page's background should not change because an unrelated piece was edited.

**Generate the runner into the page at build time.** Removes the pinning problem
by removing the pin. Same objection.

## Consequences

- **`public/showcase/runners/` grows and never shrinks.** Roughly 12kb per
  published version. If that ever becomes a real number, it is the signal to move
  to the object store rather than to start deleting.
- **A test failure here is an instruction, not a bug.** "`starry-night/runner.ts`
  now builds to `X`, which is not committed" means run `pnpm run runners` and
  commit the result.
- **Publishing is now a deliberate second step.** Changing a piece writes a new
  runner beside the old one; adopting it on a page is a separate edit. That is the
  intended shape — a republish should be a decision — and it is the cost Andrei
  named when accepting it.
- **Byte-reproducibility is now load-bearing.** It rests on esbuild being pinned
  in the lockfile. If a future esbuild changes its output, every runner's hash
  moves at once and the check will say so loudly on the first PR after the bump.
