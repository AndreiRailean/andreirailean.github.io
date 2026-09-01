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

**What this step is for changed once the peer contract moved into the repo.** It
used to be the only place a peer learned its obligations, which made skipping it
fatal and made the whole contract re-transmitted by mouth on every handover —
`exp-psyxels-a6` was told twice in one day by two different stewards. Those
obligations now live in `src/experiments/AGENTS.md`, which a session building a
piece reads anyway, and peers are told to file an issue rather than find you. So
announcing no longer carries the contract.

What it still carries is the part that is **not** in the repo: what is red right
now, a trap in flight, a check you have just found vacuous — and the claim itself,
which is a message to any other steward rather than to peers. Keep doing it, and
stop treating it as load-bearing for peers. A session that starts after you
announce never hears you and must be fine anyway; if it is not, the missing thing
belongs in `AGENTS.md`, not in a better broadcast.

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

**The broadcast is best-effort, and the claim of record is on the issue.**
`ListAgents` reaches this machine, plus Remote Control and cloud sessions where
those happen to be connected — which is not guaranteed. So a steward on another
machine may never see your claim and you may never see theirs, and arbitration
does not get to run at all. That is deliberate rather than unsolved: the thing
that costs anything is two stewards doing the same work, and **claiming the item
in step 5 prevents that on its own**, because GitHub reaches every agent
regardless of machine and outlives the session that wrote it. Announce for
latency; assign for authority. If the two ever disagree, the assignee wins.

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
session. **This is the authoritative claim, not the announcement.** Step 3 can
fail outright rather than merely race — a steward on another machine is not
reachable by `ListAgents` and never hears you — so the broadcast is a latency
optimisation and this is the thing that actually holds. It is also the only part
with any memory: a steward starting tomorrow reads who last claimed instead of
re-asking a room that has already answered.

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

**Re-derive the queue before you say it is empty.** The list you built in step 2
is a snapshot, and a ticket filed while you were working is invisible to it —
which has happened twice, both times to a steward that had already announced its
queue clear. Two `gh` calls, at the end of the turn.

**If none of the four has anything in it then, say so and stop.** Do not go
looking for something to share: the section hoists on the _third_ copy, and a
steward hunting for work is exactly how a premature abstraction gets written —
which is the failure this role exists to prevent, not to cause.

**Stopping is not the role ending.** An earlier wording said an empty queue "has
finished, not started", which conflated two things: do not invent work, and the
role is over. Only the first was meant. The role has no clock — a human starts it
with `/steward` and nothing wakes it — so a `kit` issue filed after you stop waits
for the next one. Polling for those was proposed, costed and declined in
`docs/adr/20260901-prompting-is-the-stewards-trigger.md`, which is also why the
announcement in step 3 still matters more than #79 left it: it is the role's only
inbound clock.

## Rules that bite

- **"Every live session" means every row, with no judgement applied.** Both ways
  of narrowing it are the banned steward-detection heuristic wearing a different
  hat, and this session did both within an hour of writing the rule: it messaged
  one peer _because its name looked like a steward's_, and skipped another
  _because a background shell looked like it would not care_. A name says
  nothing — `img-preview-1f` held the role — and neither does a session kind.
  Announcing to everybody is cheap **because** it needs no guess; the moment you
  make one, detection is back.
- **A peer exchange needs a stop condition, and you have to set it.** Once a
  finding is established, hand it over once and stop. An exchange about a stale
  accent ran six round trips past its own conclusion because each reply was
  individually worth sending, and Andrei paid for the same reasoning narrated
  from two sessions at once. Signs you are past the point: you are agreeing,
  conceding, or refining a rationale for a decision already made. The steward
  owns the section, so a finding transfers in one message.
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
