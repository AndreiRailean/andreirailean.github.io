---
name: wrap-up
description: Clear what this session leaves behind in its worktree — servers a script started, merged branches, probe worktrees, stray processes — and report what is not safe to touch. Use when the work is done or handed off, when Andrei says the session is over, before going idle for a long stretch, and whenever you are about to say a task is finished.
---

# Leave the worktree as you found it

**Most of what a session leaves behind, it does not remember starting.** That is
the whole reason this exists. The audit that produced it found a preview server
nobody chose to run — `pnpm run posters` had started one as a side effect and
left it up by design — and a merged branch that `git branch -d` silently refused
to delete because its upstream ref was stale.

Neither would have been found by trying to recall what the session did.

## Before anything: this is the weaker half

**A session that ends abruptly never runs this**, and that is how most sessions
end. So do not treat a clean wrap-up as the thing that keeps the box tidy. What
actually does that is leftovers **announcing themselves** — `.astro/dev.json` and
`.astro/preview.json` name a pid, `kill -0` says whether it is alive, and a state
file naming a dead pid is self-evidently stale. Any later session can read those
safely.

This skill is the cheap best-effort on top. Run it when you can; do not build
anything that depends on it having run.

## Record as you go, because hindsight cannot

**Three of the steps below need to know what _this_ session did**, and none of
that is recoverable afterwards. A branch does not carry its author, a worktree
does not carry its purpose, and a server does not say who started it.

So keep a running note, from the moment each thing exists:

- **branches** you create,
- **worktrees** you add,
- **stash entries** you push, by their unique tag.

It costs a line each and it is the difference between deleting what is yours and
guessing. An instruction whose precondition was never recorded is not one a
session can follow — it degrades into a heuristic that looks exactly like
compliance, which is how two of somebody else's branches nearly went.

If you reach this skill without having kept that note, say so and clean only
what you can identify with certainty. **Reporting more and deleting less is
always the right trade here**, because everything below is shared with sessions
you cannot see.

## The one rule that governs all of it

**Act only on your own worktree. Report everything else.**

`astro dev stop` and `astro preview stop` act on `.astro/*.json` inside the
checkout you are in, so they are safe here and are **never** the right way to
tidy another worktree. The same goes for branches other sessions are using and
for the stash, which is shared across every worktree on this machine.

A stray server in someone else's worktree is not evidence anybody forgot
anything. Two sessions here have already each mistaken the other's for a leak.

## 1. Servers

```bash
for f in dev preview; do [ -s ".astro/$f.json" ] && echo "$f: $(cat .astro/$f.json)"; done
```

**The discriminator is the port, and it needs no flag:**

- A preview on **this worktree's derived review port** means somebody may be
  looking at it right now. **Leave it**, or ask. `pnpm run preview` prints that
  port; `tests/support/review-port.ts` derives it.
- A server on **any other port** is a script's leftover — `pnpm run posters` and
  `pnpm run test:browser` both build and leave a preview running deliberately, so
  the next run skips the start. Stop it:

```bash
pnpm exec astro preview stop
pnpm exec astro dev stop
```

Both are no-ops when nothing is running, so neither needs a check first.

**Do not reach for `pkill`.** `pgrep`/`pkill -f` match this session's own Bash
wrapper, so `pkill` exits 144 and a wait loop on `pgrep` never returns. If you
genuinely need a pid, read it from the state file.

## 2. Branches you created

```bash
git fetch origin --prune
git branch --merged origin/main
```

**`--prune` first, and it is load-bearing.** `git branch -d` compares against the
branch's upstream ref, not against `main`. GitHub deletes the remote branch when a
pull request merges, but until you prune, git still believes it exists and
refuses the delete with "not fully merged" — which reads like a real warning and
is not one.

Delete **only branches this session created — by name, from the list you wrote
down when you created them.** Branches checked out in another worktree show with
a `+` and are not yours. The rest belong to other sessions; there is a
`/clean_gone` command for those, and running it is Andrei's call rather than
yours.

**Do not pattern-match to work out which were yours.** This instruction used to
end at "only branches this session created", and the first session to follow it
did the obvious thing — globbed `feat/*` — and swept up two branches belonging to
somebody else. It was caught by listing before deleting, not by the rule.

A glob is what a session reaches for when the rule assumes a record it never
kept, and the result reads as compliance either way. `git branch --merged` cannot
tell you who made a branch, and neither can its name.

## 3. Worktrees you created

```bash
git worktree list
```

A probe or scratch worktree added during the session must go, or it misleads
every later `git worktree list` — including the steward's. **From your note**, not
from guessing which of nine paths looks temporary:

```bash
git worktree remove --force <path>
```

## 4. The stash — read, never pop

```bash
git stash list
```

**The stack is shared with every worktree and other sessions push to it
concurrently.** Never `git stash pop` and never bare `git stash`. If this session
pushed an entry, find it by its unique tag, `apply` it by SHA, and drop that entry
specifically. If the list holds entries you did not create, leave them and say so.

## 5. Stray processes

Test runners and builds occasionally outlive the command that started them:

```bash
ps -eo pid,etime,args | grep -E "[p]laywright|[v]itest|[a]stro build"
```

Report anything long-running rather than killing it blind — it may be another
worktree's suite mid-run.

## 6. What you cannot clean, say out loud

Finish by reporting, not fixing:

- **Open pull requests you authored**, and whether they are green. A queued PR is
  fine; a queued PR nobody knows about is not.
- **Uncommitted changes** — `git status --porcelain`. Never discard them to make
  the tree look tidy.
- **Anything left running on purpose**, and why. "A preview is up on the review
  port because Andrei is mid-review" is a useful sentence; a silently running
  server is not.

## The shape of a good report

State the numbers, because they are checkable and a claim is not:

```
tree: 0 changes · HEAD: <branch> @ <sha>
astro processes: 0 · open PRs: 0 · stash: 0 · worktrees: 8
available: 13.3 GB
left running: nothing
```

If something is still up, name it and say why it is still up.
