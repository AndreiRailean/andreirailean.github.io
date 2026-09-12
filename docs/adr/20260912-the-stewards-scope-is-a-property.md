---
type: ADR
status: accepted
date: 2026-09-12
summary: The steward's scope stops being a directory and becomes a property — shared, mechanical, verifiable work decided by whether a visitor would see the difference.
---

# The steward's scope is a property, not a directory

## Context

The role began as "tend `kit/`", widened to "all of `src/experiments/`", and
both scopes were directories. Each widening happened for the same reason: the
faults did not respect the line.

By 2026-09-12 the pattern was plain enough to count. In one working period the
steward's own queue produced, in order:

| what                                                               | where it lived                  | in the old scope? |
| ------------------------------------------------------------------ | ------------------------------- | ----------------- |
| `controls()` reported `min: 0, max: 0` for a trackless control     | `src/experiments/`              | yes               |
| a scene never dropped its reduced-motion listener                  | `src/experiments/`              | yes               |
| `pnpm test` rewrote a tracked file on every browser run            | `scripts/runners.ts`            | **no**            |
| the ADR check could not fail on an ADR-only pull request           | `.github/workflows/`            | **no**            |
| the runner store's append-only rule had nothing behind it          | `.github/workflows/`            | **no**            |
| the dev toolbar, and a dev server left holding 1.3GB for four days | `astro.config.mjs`, the machine | **no**            |

Four of the six sat outside the scope, and **none of them had another owner**.
They are not a different kind of problem from the two that were inside: every
one is shared, mechanical, verifiable, and silent when it breaks. A check that
cannot fail and a duplicated kit module are the same fault wearing different
directories.

The directory clause was doing no work except excluding things nobody else was
going to do.

## Decision

**The steward's scope is the repo's shared surface, defined by a property.** Work
is the steward's when it is _shared_, _mechanical_ and _verifiable_ — and it
matters most where its failure is **silent**.

**One question decides it, and nothing else: would a visitor see the
difference?** If no, it is the steward's, wherever it lives. If yes, it waits for
Andrei.

That test is not new. It was already in the role doc, already
directory-independent, and already the half that did the discriminating; the
directory clause sat beside it adding only false negatives. **This decision is
mostly a deletion.**

### Three exclusions, which are the whole of what is not covered

- **Product and visual direction.** What a piece draws, what it should look like,
  what to build next. The surviving half of ADR-0002, and Andrei's.
- **Risk judgements that belong to the owner.** Dependency policy is the standing
  example: report a vulnerable transitive dependency with what pins it and what
  forcing it would cost; do not pick his tolerance for him.
- **A surface another session owns end to end.** `src/showcase/AGENTS.md` draws
  one and it holds.

**The third exclusion changes character under this decision and that is worth
stating.** It used to be implied by geography — the showcase is not
`src/experiments/`, so it was out. Geography is no longer an argument for
anything, so the only thing keeping a surface out of this role is that somebody
else is accountable for it. A boundary that was free now has to be asserted and
maintained, which is a real cost of widening the scope.

## Consequences

- `docs/agents/experiments-steward.md` becomes `docs/agents/steward.md`, and the
  role stops being called the _experiments_ steward.
- **The `kit` label is renamed `steward`.** It is the role's queue and its name
  had become a lie: a CI ticket is not a kit ticket. Its description said "in the
  experiments steward's domain" and was wrong twice over.
- `docs/agents/issue-tracker.md`'s "it belongs to a piece is not a finding"
  generalises to "it belongs to X", since the misreading it guards against is
  now available in more places.
- **The bottleneck risk is real and is not solved here.** A wider remit invites
  one session to become the gate on more work, and tempts it to generalise across
  things that should stay different — which is precisely the argument
  `src/showcase/AGENTS.md` makes, correctly. Two existing requirements are what
  hold it: peers keep their own surfaces, and the steward claims work publicly on
  issues so the queue is visible rather than living in one session's head. If
  those stop being enough, the answer is more stewards with named surfaces rather
  than a narrower property.

## Considered options

- **Keep it at `src/experiments/`.** Rejected on the table above: four of six
  items had no owner, and they are the same class as the two that did.
- **Repo-wide with no exclusions — "in charge of the whole repo".** Rejected. It
  would put visual direction and the owner's risk tolerance inside a role that is
  explicitly about mechanical, verifiable things, and the first two exclusions
  are the ones that keep the role honest about what it is for.
- **A second directory clause — `src/experiments/` plus CI plus scripts.**
  Rejected as the same mistake with a longer list. It would have excluded
  `astro.config.mjs` and a dev server on the shared box, and it is a list
  somebody has to keep correct, which `AGENTS.md` names as the weakest kind of
  rule.
