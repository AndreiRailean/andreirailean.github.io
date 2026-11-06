---
type: ADR
status: accepted
date: 2026-11-06
summary: Runner builds go to a gitignored .runners/, and only a build something names is copied into public/showcase/runners/, so the store never holds build output.
---

# Runner builds live outside the store

Partly supersedes `20260912-the-store-holds-published-runners-only.md`. **What
the store holds is unchanged**: runners something references, committed,
never rewritten, pruned only when nothing names them. What changes is where a
build goes before anything names it.

## Context

Under `20260912`, `pnpm run runners` wrote every piece's current build into
`public/showcase/runners/`, and the directory told the two kinds apart by one
property: **tracked is published, untracked is build output.** Every build,
preview, poster capture and test run wrote thirteen more, and the pre-push hook
added since (#349) makes every push one of those runs.

A rule that separates two things only through git's view of them fails the
moment somebody acts on the directory instead. A session clearing build output
ran `rm public/showcase/runners/*.js`, which deleted published runners along
with it; they were restored from git. `/wrap-up` had carried a careful loop for
exactly this — search every file for each untracked runner's name before
deleting it — and the loop was not in front of the session when the glob was.
Andrei, on hearing of it: "it is still confusing, likely due to the structure
of where runners live and how we determine the ones we use."

## Decision

**Builds go to `.runners/`**, gitignored, which nothing serves and anything may
delete: the next build writes it back byte for byte.

**A build enters the store when something names it.** After building,
`scripts/runner-store.ts` scans every file in the worktree, committed or not,
for runner filenames, and copies each named build the store lacks into
`public/showcase/runners/`. It never touches a runner already there.

Publishing is unchanged for the person doing it: take the filename the build
prints, name it in `src/showcase/wall.ts` or a page, and the next build puts
it in the store, to be committed with that edit. **An untracked file in the
store now always means a publish waiting for its commit.**

## Considered Options

- **Keep the layout and sharpen the warning.** The careful loop and the prose
  already existed and did not prevent the glob. A directory where a pattern
  matches both published and disposable files keeps the trap however it is
  documented.
- **Publish by an explicit copy command.** Clear, but adds a step to every
  publish, which `scripts/runners.ts` exists to keep as an edit and nothing
  else. Copying on the next build gives the same separation without it.
- **Build only what is published.** Rejected in `20260912` for pointing the
  build at the showcase's data. The copy here reads only filenames out of text,
  as the prune and the reference check already do, and the build stays uniform.

## Consequences

- **Tests and pushes leave nothing in the tree.** `.runners/` is ignored, so a
  run that used to add thirteen untracked files adds none.
- **The scan for runner names now exists three times**: here, in
  `scripts/prune-runners.ts` and in `tests/unit/showcase-runners.test.ts`. The
  last two were kept apart on purpose so a pruner and its check share no blind
  spot, and this one stays apart for the same reason: a reference it misses
  leaves a runner out of the store, and the test, scanning on its own, fails.
- **A worktree from before this change** still has untracked builds in the
  store. `/wrap-up` deletes those nothing names, by searching for each name,
  and reports any something names.
- `showcase-runners.test.ts` runs the script and fails on any untracked runner
  in the store that nothing names, found by `git grep` rather than by the
  script's scan. That also catches a publish whose naming edit was undone,
  which leaves its copied runner behind.
- **A moved hash no longer shows in `git status`.** It used to, as an
  untracked build in the store, and that was how a changed piece got noticed.
  The build now ends on one `moved` line naming each piece whose current build
  is not in the store.
- **The site serves fewer runners.** Its build used to put every piece's
  current build into the store, so each one was reachable at
  `/showcase/runners/<name>` though nothing named it. Only named runners are
  served now. Nothing outside this repo named one of those.
- **`pnpm run dev` copies only at start**, so a runner named while it runs is
  missing until it restarts. Previews rebuild, and are what this repo uses.
- The three scans read `git ls-files -z`: without it git quotes a path with an
  unusual character, and the read of the quoted form fails silently.
