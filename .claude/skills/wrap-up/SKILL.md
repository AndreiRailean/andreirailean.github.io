---
name: wrap-up
description: Clear what this session leaves behind in its worktree — background tasks, servers a script started, runner builds nothing names, merged branches, probe worktrees — name what exists only in the conversation, and report what is not safe to touch. Use when the work is done or handed off, when Andrei says the session is over, before going idle for a long stretch, and whenever you are about to say a task is finished.
---

# Leave the worktree as you found it

## Contents

- The one rule
- Keep a ledger from the start
- This is the weaker half
- 1. Background work and stray processes
- 2. Servers
- 3. Built runners nobody published
- 4. Git: branches, worktrees, the stash, main
- 5. What would be forgotten
- The report

Read every section before acting on any of them: each step ends on a **Done
when** line, and the report at the end checks all of them at once.

**Most of what a session leaves behind, it does not remember starting.** That is
why this exists. The audit that produced it found a preview server nobody chose
to run — `pnpm run posters` had started one as a side effect and left it up by
design — and a merged branch that `git branch -d` refused to delete because its
upstream ref was stale. Neither would have been found by recalling what the
session did.

## The one rule

**Act only on your own worktree. Report everything else.**

Everything below is shared with sessions you cannot see. `astro dev stop` and
`astro preview stop` act on `.astro/*.json` inside the checkout you are in, so
they are safe here and are **never** the way to tidy another worktree. The same
goes for branches other sessions are using and for the stash, which every
worktree on this machine shares. A stray server in someone else's worktree is
evidence of their work, not of a leak — two sessions here have each mistaken
the other's for one.

## Keep a ledger from the start

**Three steps below need to know what _this_ session did**, and none of it is
recoverable afterwards: a branch does not carry its author, a worktree does not
carry its purpose, and a server does not say who started it. So keep a
**ledger** at `ledger.md` in your scratchpad directory, one line written when
each thing comes into existence:

- **branches** you create and **worktrees** you add;
- **stash entries** you push, by their unique tag;
- **background tasks** — a `run_in_background` command, a Monitor, a loop or
  cron you scheduled;
- **servers** you or a script started, and on which port;
- **pull requests** you open, by number.

An instruction whose precondition was never recorded degrades into a heuristic
that looks exactly like compliance. This one used to end at "delete only
branches this session created", and the first session to follow it globbed
`feat/*` and swept up two branches belonging to somebody else. It was caught by
listing before deleting, not by the rule.

If you reach this skill without a ledger, say so, and clean only what you can
identify with certainty. **Reporting more and deleting less is always the right
trade here.**

## This is the weaker half

**A session that ends abruptly never runs this**, and that is how most sessions
end. What actually keeps the box tidy is leftovers **announcing themselves**:
`.astro/dev.json` and `.astro/preview.json` name a pid, `kill -0` says whether it
is alive, and a state file naming a dead pid is self-evidently stale. Run this
as the cheap best effort on top, and build nothing that depends on it having run.

## 1. Background work and stray processes

**Stop this session's background work first**, so nothing restarts a server or
rewrites a runner after you have cleared it. From the ledger: stop each
background task and Monitor still running (TaskStop), and delete any loop or
cron you scheduled (CronList, CronDelete).

Then look for what outlived the command that started it:

```bash
ps -eo pid,etime,args | grep -E "[p]laywright|[v]itest|[a]stro (build|preview|dev)"
```

Stop only what the ledger names. Report anything else that has been running long
rather than killing it blind — it may be another worktree's suite mid-run.

**Do not reach for `pkill`.** `pgrep`/`pkill -f` match this session's own Bash
wrapper, so `pkill` exits 144 and a wait loop on `pgrep` never returns. If you
need a pid, read it from `ps` or the state file and `kill` that.

**Done when:** no background task, Monitor or scheduled loop of this session is
running, and every long-running process left is reported with its worktree.

## 2. Servers

```bash
for f in dev preview; do [ -s ".astro/$f.json" ] && echo "$f: $(cat .astro/$f.json)"; done
```

**The discriminator is the port, and it needs no flag:**

- A preview on **this worktree's derived review port** is the one Andrei
  reviews on. **If he asked for the wrap-up, stop it**: "if i ask for a wrap-up
  it means we can stop the preview server" (2026-10-02). Asking for a wrap-up is
  saying the review is over, so do not ask him again. If you are wrapping up on
  your own initiative, the review may still be going: leave it, and say so.
  `pnpm run preview` prints that port; `tests/support/review-port.ts` derives
  it.
- A server on **any other port** is a script's leftover — `pnpm run posters` and
  `pnpm run test:browser` both build and leave a preview running deliberately, so
  the next run skips the start. Stop it.

```bash
pnpm exec astro preview stop
pnpm exec astro dev stop
```

Both are no-ops when nothing is running, so neither needs a check first.

The preview **bridge** (`scripts/bridge-sidecar.ts`, `.astro/bridge.json`) needs
nothing of its own: it exits thirty seconds after this worktree's preview is
gone and removes its state as it goes. A `bridge.json` naming a dead pid is a
corpse from a kill, harmless, and `bridgePort()` already reads it as no bridge.
`.astro/bridge.jsonl` is the log he may still want read; leave it.

**Done when:** the loop above prints nothing, or only a preview left up for a
review you can name.

## 3. Built runners nobody published

**Delete this worktree's untracked runners.** `pnpm run runners` — which every
build, preview, poster capture and browser run calls — writes each piece's
current build into `public/showcase/runners/`, and in that directory **tracked
is published, untracked is build output**. They pile up: sixteen in one worktree
after one day, and a `git add -A` in that state staged eight of them, which
would have published them.

**Keep any runner something here names.** Naming a runner — a wall entry, a
page, an embed — is what makes it wanted, and committing it is what publishes
it, so a runner that is named and untracked is a publish somebody forgot. The
loop below decides that rather than judging it: it searches every file in the
worktree — tracked, with its uncommitted edits, and untracked — for the
runner's filename. A runner nothing names cannot be loaded by anything, and
`pnpm run runners` rebuilds it byte for byte, so deleting it loses nothing.

```bash
for f in $(git ls-files --others --exclude-standard public/showcase/runners/); do
  name=$(basename "$f")
  if git grep -qF "$name" -- ':!public/showcase/runners/' ||
    git ls-files --others --exclude-standard -z -- ':!public/showcase/runners/' |
      xargs -0 -r grep -lF "$name" 2>/dev/null | grep -q .; then
    echo "NAMED BUT UNPUBLISHED: $f — commit it, or stop naming it"
  else
    rm -- "$f"
  fi
done
```

**The last `grep -q .` is load-bearing.** With no untracked files, `xargs -r`
runs nothing and exits 0, so testing its status reads every runner as named and
deletes none. The first draft did that, and was caught by un-naming a runner and
watching it survive.

**A `NAMED BUT UNPUBLISHED` line means the work is not finished**, not that
something needs cleaning. Commit the runner with whatever names it, or report it
if that is not yours to do. `tests/unit/showcase-runners.test.ts` catches the
same thing once the naming is committed.

**Untracked only, and this worktree only.** A tracked runner is published and is
never deleted, edited or renamed — `pnpm run prune` is the only tool for those,
and it is not part of closing.

**Done when:** the loop prints nothing, or only `NAMED BUT UNPUBLISHED` lines you
are reporting.

## 4. Git: branches, worktrees, the stash, main

```bash
git fetch origin --prune
git branch --merged origin/main
git worktree list
git stash list
```

**`--prune` first, and it is load-bearing.** `git branch -d` compares against the
branch's upstream ref, not against `main`. GitHub deletes the remote branch when
a pull request merges, but until you prune, git still believes it exists and
refuses the delete with "not fully merged" — which reads like a real warning and
is not one.

- **Branches:** delete only those **named in your ledger**. `git branch --merged`
  cannot tell you who made a branch, and neither can its name. The global
  `CLAUDE.md`, "After a PR merges", has the rest: `-D` only after
  `gh pr view <n> --json state` says merged, and `git switch --detach
origin/main` first if the branch is checked out here. Branches marked `+` are
  checked out in another worktree. `/clean_gone` sweeps everyone's, so running
  it is Andrei's call.
- **The main checkout:** if a PR of yours merged this session, fast-forward
  `/root/projects/andrei.md` as that same section says — `git -C`, `--ff-only`,
  and leave it alone if it is dirty.
- **Worktrees:** the one you are in is herdr's, not yours to remove. A probe or
  scratch worktree **from your ledger** must go, or it misleads every later
  `git worktree list`: `git worktree remove --force <path>`.
- **The stash — read, never pop.** If this session pushed an entry, find it by
  its tag, `git stash apply <sha>`, and drop that entry by re-finding its
  `stash@{n}`. Entries you did not push stay, and are reported.

**Done when:** `git status --porcelain` prints nothing, **unfiltered**; no branch,
worktree or stash entry in the ledger remains unless the report names why; and
every PR you opened is merged or reported with its check status.

## 5. What would be forgotten

Read back over the session for anything that exists only in the conversation,
because the next session cannot read this one. Each item is named to Andrei with
its capture:

| Found in the session                                        | Capture                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| A decision agreed in chat, or an approach tried and dropped | an ADR, via `/record-decision`                                 |
| A defect or gap noticed and not fixed                       | a GitHub issue — labelled `steward` if no visitor would see it |
| A promise ("I'll do that next") or work in flight           | an issue, or the PR description it belongs to                  |
| A standing instruction or correction from Andrei            | a memory                                                       |

Issues are part of finishing and need no agreement. Name an ADR or a memory,
and make it once he agrees. A capture made in the repo is a change like any
other, so after making one, step 4's **Done when** is checked again.

**Done when:** every item is captured, or named in the report with its suggested
capture.

## The report

**Ready to close means every line below is zero or names a reason** — and the
tree line has no reason that excuses it. `git status --porcelain` prints
nothing, not "nothing of mine", not "nothing but build output". A session once
checked after every step with `git status --porcelain | grep -v
public/showcase/runners/`, reported "0 changes", and told Andrei it was ready to
close with sixteen untracked runners in the worktree. The check worked; the
filter added to it hid the answer — the pipe-on-a-check shape the root
`AGENTS.md` warns about. Step 3 is what makes an unfiltered count reachable.

Numbers, because they are checkable and a claim is not:

```
tree: 0 changes (`git status --porcelain | wc -l`, unfiltered) · HEAD: <branch> @ <sha>
background: 0 · astro processes: 0 · preview: stopped | left for review | another worktree's
open PRs: <numbers and checks, or 0> · main checkout: fast-forwarded to <sha> | untouched, why
branches deleted: <names> · stash: <n, none mine> · worktrees: <n>
untracked runners: 0 (or: named but unpublished, listed)
not captured: <items from step 5, each with its suggested capture>
available: 13.3 GB
left running on purpose: <what, and why>
```
