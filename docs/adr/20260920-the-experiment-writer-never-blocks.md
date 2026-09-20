---
type: ADR
status: accepted
date: 2026-09-20
summary: Unattended is the experiment writer's only mode — it never blocks on a question, and after reaching an interactable build it widens what can be explored rather than committing to answers; his prose is captured verbatim in a per-piece seed.md because a session's transcript dies with it.
---

# The experiment writer never blocks, and keeps the seed

## Context

`20260919-an-interactable-build-precedes-the-design-conversation.md` made the
first interactable build a gate and added guidance for the case where Andrei is
not watching. That guidance was **conditional**, which turned out to be the
wrong shape for three reasons he named directly:

- **He has to declare it.** Making "he stepped away" a mode means he must
  announce it, and the whole point of the role is that he gives one instruction
  and goes.
- **The default it falls back to is the dangerous one.** A session that believes
  he is present will stop and ask. He is usually not present, so the question
  waits until morning and the night is spent idle — the worst available outcome,
  and one that costs nothing to avoid.
- **Reaching the gate reads as done.** "Show him and stop" is correct about not
  landing visual work and wrong about stopping, and a session with hours left
  and a finished gate has no instruction telling it what to do with them.

A fourth thing surfaced separately. **The prose he starts a piece with exists
nowhere durable.** It is typed into a session, and that session's transcript is
unreadable by anything else and gone when it ends. Six pieces exist and not one
of their seeds survives. That matters more here than it would elsewhere, because
`CONTEXT.md` records that the section's central aim — _organic change_ — was
"named by the pieces' author across four of them". His wording is the primary
source for the concept the section is built around, and it has been discarded
four times.

## Decision

**Unattended is the only mode.** Assume he is not watching. Never block on
approval, a preference, or a disambiguation. A running piece and a file both
reach him without his attention; a question does not.

**After the gate, widen rather than commit.** Prefer whatever enlarges what he
can explore — another preset, a wider range, a setting where there was a
constant — over anything that settles a question. A widening is useful whichever
way he later steers; a commitment is a coin flip that costs a night when it
loses. This is what makes unattended work safe to continue rather than merely
permitted, and it is why "I have reached the gate" is not a stopping point.

**Questions go into the record, not to him.** What was assumed and what would
settle it, written where he will find it when he chooses. Better still, turned
into two presets, because comparing is how he answers anyway.

**Not blocking is not the same as not stopping, and the role is expected to
stop.** What it must not do is stop at the _first hurdle_ — there is almost
always a body of work that needs nobody, and the rule exists to get that work
done. When it runs out, the session ends deliberately: the piece running and
its URL handed over, open questions in `seed.md`, a pull request open,
`/wrap-up` run. The judgement is "is this still useful", not "am I allowed to
continue", and reaching the end of the independent work is a success condition.

This distinction was drawn after the first version said only "never block",
which reads as "never stop" and invites the opposite failure: grinding past the
point where anything added is wanted.

**Every piece keeps `src/experiments/<slug>/seed.md`**, written **before any
code**: his seed instruction verbatim, then each round of corrective feedback,
dated and appended. Verbatim rather than summarised — a paraphrase looks tidier
and discards exactly the thing that made it worth keeping.

**The role covers amending a piece as well as starting one, and the gate differs
between them.** Starting: the gate is literal, get it on screen with a panel.
Amending: it already renders, so the gate becomes _make the change drivable and
comparable_ — behind a control or a preset per option, so the difference can be
moved rather than described. The start-only steps are explicitly skipped, and
the piece's own `AGENTS.md` and `seed.md` become mandatory first reading, which
they are not when starting because there is nothing yet to read.

## Consequences

- **He never has to say he is stepping away**, which was the request.
- **A session will sometimes build the wrong thing for hours.** That is the
  accepted cost, and the widen-don't-commit rule is what bounds it: the wrong
  widening is still a control he can use, where a wrong commitment is work
  thrown away. If this proves wrong it will show up as him discarding whole
  nights, which is visible and worth watching for.
- **"Never block" is a strong instruction and could be over-read** into not
  reporting, or into landing visual work unilaterally. It means neither: the
  third scope gate is unchanged, PRs are still his to merge, and the report is
  the running URL rather than silence.
- **`seed.md` has no check and cannot get a useful one yet.** The six existing
  pieces have no seed to recover, so a check asserting every piece has one fails
  on unrecoverable history, and one that skips them is a stale list. It becomes
  checkable when every piece has one. Until then it is a remembered rule, which
  this repo treats as a defect — mitigated only by being the first step rather
  than the last, since the steps a dying session skips are at the end.
- **The six missing seeds turn out to be recoverable, which this record first
  claimed they were not.** Session transcripts persist on this machine under
  `/root/.claude/projects/<worktree-slug>/*.jsonl`, 91 of them, and a probe
  pulled back psyxels, flotsam, embers and dangler verbatim from the first human
  message of their sessions. The claim was written from the true premise that a
  transcript is unreadable _by another session at runtime_ and the false
  inference that it is therefore gone. Corrected here rather than quietly, since
  the wrong version would have stopped anyone trying. #204 tracks the recovery.
- **Reconstructing a seed from the code is still forbidden.** That half stands:
  an invented brief is worse than an absent one. Recovery means transcribing
  what he actually typed, and a piece whose transcript cannot be found keeps no
  `seed.md` rather than a plausible one.
