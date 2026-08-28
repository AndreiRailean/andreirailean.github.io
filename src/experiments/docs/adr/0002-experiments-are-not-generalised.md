# 0002 — Experiments are not generalised

**Status:** Superseded by `20260828-the-piece-is-independent-the-gallery-is-not` — 2026-08-28

The half about a piece's own rendering survives; the half about notes, the index
and the chrome does not. A second experiment showed the notes had converged on
one structure anyway, and that the duplication was producing inconsistency
rather than independence.

## Context

Once the first experiment had a written note and an index page, there was an
obvious pull toward abstraction: a shared `ExperimentLayout`, a dynamic
`[slug]/about.astro` route so every future note came free, a section theme, a
content tree at `src/content/experiments/`.

That abstraction was proposed and rejected. The reason is the sample size: with
exactly one experiment, any shared layout encodes the first one's choices as
everyone's defaults. An experiment is supposed to stand on its own and not be
bound by a stylistic hierarchy.

## Decision

No shared layout, theme or component across experiments. No dynamic route for
the notes — each experiment renders its own about page, in its own visual
language.

Notes live beside the code they describe (`src/experiments/<slug>/about.md`)
rather than in a separate content tree. A typed content collection globs
`src/experiments/*/about.md`, so the index is generated from validated
frontmatter while an experiment's folder still holds its implementation, its
human note and its notes for agents together.

## Consequences

- Some duplication between about pages is accepted, knowingly.
- Each experiment is free to look like itself, including its note.
- `/experiments/` is the one genuinely shared surface, and it consumes only
  frontmatter — never a component.
- The content collection builds its store at dev-server startup, so adding or
  renaming an `about.md` needs a restart. Recorded in `../../AGENTS.md`.

## Revisit when

~~A second and a third experiment exist and show what is actually common. Two data
points, not one.~~ Met on 2026-08-28 with two experiments; see the superseding
record.

**Vocabulary is the deliberate exception.** `../../CONTEXT.md` generalises across
the section, because naming a shared concept binds no implementation — the cost
of a wrong word is a rename, not a coupled component.
