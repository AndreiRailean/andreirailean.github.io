---
type: ADR
status: accepted
date: 2026-09-01
summary: The experiments steward is started by a human and has no clock. Polling was proposed, costed and declined; the rule that made the role read as terminal is corrected instead.
---

# Prompting is the steward's trigger

## Context

`SKILL.md` told a steward that "an empty queue has finished, not started". That
line exists to stop a steward inventing work, and it does — the role's whole
hazard is that a session hunting for something to share writes the premature
abstraction the role exists to prevent.

But nothing anywhere triggers a steward to look again. Combined, the two mean a
steward derives a queue once, clears it, and **ends the role**. The queue it
derived is a snapshot, and "finished" reads as terminal.

Raised as issue #81, with evidence from the session that filed it: #78 was picked
up only because its filer messaged the steward by name. So the route-by-artefact
contract landed in #79 — a peer files an issue rather than finding a session —
currently depends on the message channel to fire at all.

That is real. The session this record comes out of saw it twice more: #81 and #83
were both filed while it was working, and both arrived as messages. One of them
had already gone to a steward that had disclaimed the role hours earlier.

### What is not available

Recorded so it is not re-investigated. Claude Code hooks are tool-event hooks —
they observe a session's own tool calls, not the repository. Git hooks live in
the common `.git` dir, fire only on the worktree running the command, and cannot
wake a session; a merge on GitHub fires nothing locally. GitHub webhooks need a
listener a local session cannot be.

The only push channels into a session are cross-session messages,
`notify_when_idle`, background-task completion, and `Monitor`. **Polling is the
only mechanism available**, and `Monitor` is the closest thing to a subscription.

### The limit that shapes the answer

**Unpushed work is invisible to any poll.** `exp-psyxels` carried five unpushed
commits while its PR on origin showed a placement that session had already
corrected locally. A poll sees what is pushed; a message sees what is not. They
are complements, so no poll can replace the message channel — and its blind spot
sits exactly where a peer is mid-change, which is when a kit gap is most likely
being worked around.

## Decision

**A human starts the steward, with `/steward`, and the role has no clock.** No
poll, no `Monitor`, no `/loop`.

**The conflated rule is corrected.** "An empty queue has finished, not started"
now means _do not hunt for work_. It does not mean the role is over.

**A steward re-derives its queue before saying it is empty.** Two `gh` calls at
the end of a turn, which is the whole of what a poll would have bought within a
session — and both tickets this decision comes from were filed during a session
that had already declared its queue clear.

## Consequences

- A `kit` issue filed while no steward is running waits for a human to start one.
  That is the accepted cost, and the queue is usually empty.
- The announcement keeps a third job on top of the two #79 left it: it is the
  role's only inbound clock. #79 said the announcement no longer carries the peer
  contract, which is still true, and #81 is right that this makes it _more_
  load-bearing rather than less.
- Nothing merges unattended. Standing authorisation to land infrastructure on
  green CI stays, and stays inside a session a human started.

## Considered options

- **A watermark poll** — compare `origin/main` against the last SHA examined,
  kept in `.scratch/`, and inspect red CI, moved shared files, new remote
  branches, `kit` issues, and the adoption check. Declined. CI already covers
  every PR, so what is genuinely uncovered is narrow: labelled issues, and
  branches pushed but not yet PR'd. Against that, a standing cost, a blind spot
  on exactly the unpushed work that matters most, and two new hazards below.
- **Polling plus "inspect broadly, act narrowly"** — the mitigation #81 proposed
  for the obvious objection, that a sweep is precisely the shape which invites a
  steward to invent work. It is a good mitigation and it is not free: it asks a
  steward to hold a rule about which findings may become diffs, and the rule it
  is protecting is one this role has already had to write down twice.
- **Waking hourly with standing authorisation to merge.** This is the sharpest
  reason to decline. Landing infrastructure on green CI is safe in a prompted
  session because a human is present; the same authorisation on a timer is
  merging while nobody watches, which is a different proposition and was never
  the thing authorised.
- **Two polling stewards.** #73's arbitration rests on announcing and on silence
  meaning no competing claim, and its known weakness is that silence from a
  _busy_ session is nearly no evidence. Polling stewards would exercise that far
  more often than prompted ones, at the exact moments both are busy.

## Revisit when

A `kit` issue sits unattended long enough to cost something, or the section grows
enough concurrent sessions that a human is no longer reliably the one noticing.
Neither has happened; the tickets that prompted this were each picked up within
minutes.
