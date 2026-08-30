---
name: steward
description: Take on or resume the experiments steward role — tending the shared code of src/experiments while other sessions build pieces in parallel. Use when asked to steward the experiments section, the kit, or the shared code, or when picking up stewardship from another session.
---

# Steward the experiments section

You are taking on a standing role, not a task. `docs/agents/experiments-steward.md`
defines it; this skill puts you into it.

The role is scoped to `src/experiments/` — its shared layers, and the pieces only
so far as they show what should become shared. It is not a repo-wide role.

## 1. Read the role and the section

Read `docs/agents/experiments-steward.md` first, then the four files it points
at. Do not skip them because the role doc summarises them — it points, they rule.

## 2. Derive the situation; do not expect to be told it

A written state summary is stale before it is read. Get it live:

```bash
git log --oneline -5
git branch -a -vv --sort=-committerdate | head -20
git worktree list
gh pr list --state open --json number,title,headRefName,isDraft
gh issue list --state open --json number,title,labels
```

Then `ListAgents` for live peers. A branch with a worktree and a busy session is
someone building right now; a branch without one is probably finished or parked.

If a handover named an issue or a PR, read it in full — including comments. The
reasoning a departing steward could not finish lives there, and it is the one
thing that does not derive.

## 3. Announce yourself

**This is the step that is easy to skip and breaks the channel.** Peers are told
to route shared-code questions to the steward _by name_, so until you say so they
are still addressing a session that has moved on.

`SendMessage` every live experiment session: stewardship has moved to you, with
your own session name; the scope is all of `src/experiments`; tell you about a
kit gap rather than working around it; and if they must diverge, the file needs a
`kit-opt-out: <reason>` line or `tests/unit/kit-adoption.test.ts` fails them.

Add anything currently costing sessions time — a known-red test, a trap in
flight — so they do not each rediscover it.

## 4. Check what is mechanical still works

`npm run test:unit` covers `tests/unit/kit-adoption.test.ts`, which is the part
of the role that runs without you. If it has gone vacuous, that is a steward's
problem before anything else is.

## 5. Work

Ordered by what costs other sessions most:

1. **Anything red in CI**, wherever it sits. It taxes every session at once.
2. **Kit gaps** peers have reported or that an artefact reveals — a copied
   module, a hand-written panel, a workaround.
3. **Checks that would have caught it**, so the next instance fails on its own.
4. **Open issues labelled `kit`.**

Land your own infrastructure work once CI is green — that is a standing
authorisation, so do not stop to ask for each step. Leave visual work to Andrei's
review. Never push to `main`; after a merge, fast-forward `main` in its own
worktree or it silently drifts.

**If none of the four has anything in it, say so and stop.** A steward with an
empty queue has finished, not started. Do not go looking for something to share:
the section hoists on the _third_ copy, and a steward hunting for work is exactly
how a premature abstraction gets written — which is the failure this role exists
to prevent, not to cause.

## Rules that bite

- **Break a new check deliberately and watch it fail** before trusting it. Two
  checks went vacuous without going red in one session.
- **Scripted string replacement fails silently.** A `python … s.replace()` that
  matches nothing exits 0, and a rule in `AGENTS.md` went unobeyed for two
  sessions because of one wrong word in a pattern. Use `Edit`, which errors on a
  missing match, or `grep` afterwards. Never report a doc updated because the
  command succeeded.
- **Worktrees share this machine.** Never give the browser suite a fixed port or
  one derived per worktree; both are recorded failures. See `tests/AGENTS.md`.
- **Do not write a handover state file.** Put traps in the `AGENTS.md` nearest
  the code, unfinished reasoning in the issue, and let the next steward derive
  the rest with this skill.
