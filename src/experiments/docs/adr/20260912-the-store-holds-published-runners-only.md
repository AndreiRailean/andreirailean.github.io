---
type: ADR
status: accepted
date: 2026-09-12
summary: public/showcase/runners/ holds runners something references, not every build; the manifest is dropped because nothing ever read it and it was the only thing keeping unpublished builds alive.
---

# The store holds published runners, not every build

Partly supersedes `20260907-runners-are-committed.md`. **The runner half of that
record stands**: a page pins a runner by the hash of its own bytes, so a
referenced runner is never deleted, modified or renamed, and git is the
retention because Pages keeps no history. What changes is which runners are in
the store, and the manifest goes with it.

## Context

Committing every piece's current build produced one new committed file per
rebuild, forever. `embers` accumulated three runners on the day it shipped, two
of them dead before anyone published anything against them. Across six pieces
after one week, four of ten runners were referenced by nothing — 86kb of 232kb.

That was not the store filling up with published work. It was the store
collecting build output.

The chain that produced it:

```
piece changes → a runner is built
              → manifest.json names it as the piece's current one
              → showcase-runners.test.ts requires the current build be committed
              → one committed file per rebuild
```

The manifest is the link holding it together, and it is the link that does not
hold.

## What the manifest was for, checked rather than assumed

`20260907-runners-are-committed.md` says it is committed because "it is what
tells **anything in the Astro build** which runner is a piece's current one, and
leaving it generated would put a build-order dependency in front of `astro
check`". `scripts/runners.ts` hardened that hedge into a statement of fact: "it
is what the Astro build reads".

**Nothing has ever read it.** Searched across the whole history rather than the
working tree: the only commits touching a file that mentions
`public/showcase/manifest.json` are the three that wrote it. Today its readers
are two test files, both of which exist to check that it is written correctly.

The history explains how that happened without anyone being careless:

- At `fbe9258` it was introduced as **build output, uncommitted**, and the file's
  own docblock said so. The home page reached a piece through
  `/showcase/artefacts/home.json`, an artefact file, which named the runner. The
  manifest was a convenience index beside it.
- At `6748e19` the artefact indirection was removed. The page now pins the runner
  URL directly and states its scene inline. That commit's reasoning —
  _"pinning requires retention"_ — is about **runners**, and the manifest was
  committed alongside them.
- The justification was then written in the future tense, for a consumer that
  was expected rather than one that existed, on the same day the last thing
  resembling one was deleted.

## Decision

**`public/showcase/runners/` holds runners that something references.** A runner
enters the store by being published — named by a wall entry, a page, or anything
else in the repo — and not by being built.

**`public/showcase/manifest.json` is dropped.** Nothing read it, and keeping a
piece's current build referenced was the only work it was doing.

**`scripts/runners.ts` still builds every piece's runner on every run.** The
build is unchanged and stays cheap; what changes is that its output is not
automatically part of the store. A freshly built runner nothing names is an
untracked file in that directory — build output sitting where it was built.

So the directory becomes self-describing: **tracked is published, untracked is
build output.** `pnpm run prune` removes tracked runners nothing names and
leaves untracked ones alone, because deleting what a publish is about to commit
would be the opposite of helpful.

**The "is committed at the hash its source currently produces" check is
removed.** It asserted that changing a piece obliges you to commit its new
runner, which stopped being true when `20260907`'s own rider established that
republishing is a question rather than a duty. It could only have been kept by
keeping the manifest, which is the thing being dropped.

## Consequences

**Accumulation stops at the source rather than being swept up.** A piece can be
rebuilt any number of times and commit nothing. The store's size is the number
of distinct published pins, and nothing else.

**A published runner's guarantees are unchanged**, and are now checked by
properties rather than by an index:

- `showcase-runners.test.ts` verifies every runner's bytes hash to its own name,
  so the directory verifies itself.
- It verifies that every runner named by any tracked file exists — found by
  scanning, so a new kind of consumer is covered without anyone adding a check.
- The `Runner store` workflow forbids modifying, renaming or type-changing a
  committed runner.

**"Changed the piece, forgot to publish" is no longer caught, and that is
correct.** Not publishing is the ordinary case. Publishing is an edit to
whatever names the runner, and that edit is what commits it.

**The build-order argument becomes live again the day something in `src/` wants
to know a piece's current runner.** Nothing does. If something ever does, the
right answer is probably to give that consumer what it needs rather than to
restore an index for it, but this record is the one to reopen.

**This does not change what happens when a runner leaves the repo.** A
copy-embed button would put a runner URL on a page nobody here controls, and no
runner would be provably unreferenced again. On that day the store goes back to
append-only and prune is retired — noted in `scripts/prune-runners.ts` and in
the workflow.

## Alternatives

**Keep the manifest and rely on `pnpm run prune`.** Works, and is what was in
place before this. The store's steady state is already bounded — pieces plus
distinct older pins — so this is tidying rather than a leak. Rejected because
the tidying is unbounded between prunes, and because the manifest's only
remaining function was to create the mess that prune cleans up.

**Generate the manifest and gitignore it.** Keeps an index for whoever wants one
without committing it. Rejected as the worst of both: it reintroduces exactly
the build-order dependency the original record worried about, in exchange for a
file that still has no reader.

**Stop building runners for unpublished pieces.** Would need the build to know
what is published, which points `scripts/runners.ts` at the showcase's data and
inverts a dependency deliberately kept one-way. Rejected; leaving the build
uniform and letting the store be selective achieves the same result without it.
