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

## 3. Announce yourself, which is how you claim the role

**This is the step that is easy to skip and breaks the channel.** Peers are told
to route shared-code questions to the steward _by name_, so until you say so they
are still addressing a session that has moved on.

`SendMessage` **every live session**, not only the ones building experiments:
stewardship has moved to you, with your own session name; the scope is all of
`src/experiments`; tell you about a kit gap rather than working around it; and if
they must diverge, the file needs a `kit-opt-out: <reason>` line or
`tests/unit/kit-adoption.test.ts` fails them.

Add anything currently costing sessions time — a known-red test, a trap in
flight — so they do not each rediscover it.

**Everyone, because the announcement is the only thing that reaches another
steward.** Spinning you up does not stand the previous one down, and nothing
does it automatically. An earlier version of this step said "every live
experiment session", and a second steward is not an experiment session — so on a
strict reading the one peer who most needs to hear the claim was the one peer
excluded from it. Both stewards then derive the same queue and start the same top
item on different branches, and find out at PR time.

**Do not try to work out which peer is the steward. You cannot.** A session name
is arbitrary and says nothing about the role: `img-preview-1f` held it, and
`kit-stewardship-f2` only looked like a holder by luck. Name-matching fails in
both directions, which is why this is an announcement to everybody rather than a
handshake with a detected incumbent — it costs one extra message and needs no
guess.

**If a session replies claiming the role**, do not both carry on. Whichever of
you is mid-PR finishes it and the other waits; if neither is, the incumbent
stands down. **Silence is not a competing claim** — nobody answering means you
hold it, so proceed. Two stewards is a misconfiguration rather than a scaling
mode, and the point of this step is to make it loud, not to support it.

**Silence is weak evidence from a busy session, and this is a known limit rather
than an oversight.** A peer mid-task may not process an inbound message for a
long time, so proceeding on silence can still leave two live stewards — more
slowly than before, which is the whole of the improvement. `ListAgents` reports
busy/idle: silence from an _idle_ session is decent evidence it is not claiming,
and silence from a _busy_ one is nearly none. Where it matters, `SendMessage`
with `notify_when_idle` and let it answer before you take anything irreversible.

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

**Claim an item before starting it**, and check it is not already claimed:
`gh issue edit <n> --add-assignee @me`, then a one-line comment naming your
session. Arbitration in step 3 can still fail — a steward can start while you are
mid-turn — and this makes the duplication visible in the one place both of you
already look.

The comment is what makes the claim readable, because the assignee alone is not.
`@me` resolves to the human's GitHub account, so two stewards assign the _same_
name and an abandoned claim looks exactly like a live one. **An item assigned
with no live session behind it is stale** — check `ListAgents` against the
claiming comment, then take it and say so. Unassign yourself when you finish or
stand down, or you leave a corpse that stops the next steward touching the item
at all, which is worse than the duplication this prevents.

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
