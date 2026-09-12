---
type: ADR
status: accepted
date: 2026-09-12
summary: The repo's conventions lived only in nine AGENTS.md files, which Claude Code does not load, so every rule was opt-in; a root CLAUDE.md now imports AGENTS.md and a skill carries the preview lifecycle, with a check asserting both still deliver.
---

# CLAUDE.md is how the rules arrive

## Context

This repo has an unusual amount of hard-won reasoning written down — nine
`AGENTS.md` files, a directory of ADRs, a context map. `AGENTS.md` opens by
naming "a rule that depends on being remembered" as a defect worth fixing before
feature work.

**None of it was being delivered.** Claude Code loads `CLAUDE.md` automatically
and does not load `AGENTS.md`. There was no `CLAUDE.md`. So a session started
with the user's global conventions and nothing from this project: every rule here
was opt-in, seen only if a session happened to go looking.

This was found the way it would always be found — by noticing, not by failing.
The session that wrote this ADR had read `AGENTS.md` early and assumed that was
the normal path; Andrei asked whether Claude sees those files out of the box. It
does not. Checking the session's own starting context settled it in one step.

**Nothing had gone wrong, and that is the whole problem.** A convention nobody is
handed looks exactly like a convention everybody follows, right until a session
does the thing the document forbids — and then the document is blamed for being
unread rather than undelivered. Several rules in `tests/AGENTS.md` exist because
that already happened, including one rederived from scratch in a separate
session.

A second gap sat behind it. Andrei approves visual work in a browser, so almost
everything here ends at something he looks at. But the preview lifecycle — build,
hand over a LAN URL, rebuild, reload, stop when done — was known only to the
session that designed it. He should not have to instruct each new session in how
he reviews.

## Decision

**Two delivery mechanisms, chosen because they fail differently.**

1. **`CLAUDE.md` at the root**, which is loaded, and which pulls in `AGENTS.md`
   with an `@AGENTS.md` import rather than restating it. It also repeats the five
   rules that have actually been broken, because a pointer followed late is
   worse than a line read early.
2. **A `preview` skill** under `.claude/skills/`. Skills are listed to every
   session with their descriptions, without anything being read — verified
   directly: the skill appeared in the authoring session's own skill list
   moments after the file was written.

The import degrades safely. If imports are not active the line renders as
literal text, which still reads as a pointer, and the sentence immediately below
it says to go read `AGENTS.md` now.

`tests/unit/agent-docs.test.ts` asserts both: that `CLAUDE.md` exists and imports
`AGENTS.md`, that the section-level `AGENTS.md` files are still pointed at, and
that every skill has a name matching its directory and a description long enough
to say when it applies.

## Why the check is not paranoia

**A malformed skill is not surfaced, silently.** No error, no warning — it simply
stops being offered, which is indistinguishable from a session choosing not to
use it. That is the same shape as a grep that matches nothing and the same shape
as the vacuity `tests/unit/browser-suite.test.ts` shipped with. The mechanisms
that deliver rules fail quietly by nature, so they need a check more than the
rules do.

**And `CLAUDE.md` is the obvious thing to delete.** It sits beside `AGENTS.md`
saying overlapping things, and looks like duplication to anyone tidying up. The
check is what makes removing it a failing test rather than a plausible cleanup.

## Consequences

- A session now arrives knowing how Andrei reviews without being told, which was
  the request: he should not have to ask each session to start and stop a server
  when his approval is what everything rests on.
- `AGENTS.md` stays the single source. `CLAUDE.md` is a hook and a short list of
  repeat offenders, not a second rulebook — if it grows into one, the two will
  drift and the drift will be silent.
- The per-experiment `AGENTS.md` files are reached through
  `src/experiments/AGENTS.md`, which already says to read the piece's own. Only
  the section-level ones are asserted from the root.
- Nothing stops a _nested_ `AGENTS.md` going unread while working deep in a
  subdirectory. The root file names the three that matter; a fourth section
  appearing without a pointer is the gap this leaves open, and the check closes
  it for the three that exist today.
