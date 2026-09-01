# Working with branches

`main` moves often — roughly fifteen times on 2026-09-01. A session that branched
in the morning is a long way behind by the afternoon and finds out at PR time, as
a conflict or as rework.

Nothing forces an update: branch protection has `strict: false`, deliberately.
This is the local habit that makes that a non-issue, and it is two moments rather
than continuous syncing. **Do not spend time staying in sync.**

## Two milestones

1. **Creating a branch** — `git fetch origin`, then branch from `origin/main`, so
   it does not start stale.
2. **Before opening a PR** — `git fetch origin`, then merge `origin/main`, so
   conflicts surface before the branch is published.

Nothing in between. One cheap command says whether it even matters:

```bash
git fetch origin && git rev-list --count HEAD..origin/main
```

**One fetch serves the whole machine.** Worktrees share refs through the common
`.git` dir, so a fetch in any worktree updates `origin/main` for all of them.

## A green tick does not prove the combination

The tempting reason to skip milestone 2 is that `on: pull_request` builds a merge
commit of the branch with its base, so the tick should already describe the
combination. **Measured, it does not.**

`#88` added four browser tests, taking the suite from 105 to 109; `#89` added
eight. #89's CI reported **`113 passed`** — 105 + 8, a base without #88 — where
the real combination gives 117, which is what a local merge produced. The run was
created five seconds after #88 merged. Whether GitHub served a cached merge ref
or the base had not propagated does not change what to do about it: **the count
is the fact.**

So a tick describes the combination the run happened to see, and nothing re-runs
it when `main` moves afterwards. Both milestones carry weight.

## Two traps

**Branch from `origin/main`, never from local `main`.** Local `main` is checked
out in `/root/projects/andrei.md` and drifts unless someone fast-forwards it
there. A session in another worktree cannot even `git checkout main` to look —
that fails with `fatal: 'main' is already used by worktree`, which is also why
`gh pr merge --delete-branch` fails in this repo. So local `main` is the wrong
base by default and `origin/main` after a fetch is the right one.

**Merge, do not rebase, once a branch is pushed or claimed.** A rebase rewrites
committer dates, and a branch's last-commit time is what
`docs/agents/experiments-steward.md` uses to tell a live claim from an abandoned
one. Rebasing a claimed branch destroys the only heartbeat it has. Rewritten
dates have already confused an ordering question here once.

## Deliberately not done

- **`strict: true`** — "require branches to be up to date". Excluded: every merge
  would invalidate every other open PR's tick, and there were about fifteen open
  on the day this was written.
- **Any branch-protection or repository setting change**, and any bot that pushes
  merges into branches.
- **A `post-checkout` hook that fetches.** Local, which fits, but it makes every
  checkout hit the network and fires in cases these two milestones do not cover.
  A documented habit is cheaper than surprising machinery.
