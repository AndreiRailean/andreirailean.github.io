---
type: ADR
status: accepted
date: 2026-08-23
summary: GitHub issues are the tracker; .scratch/ is gitignored private scratch space and never holds anything another reader needs.
---

# GitHub issues are the tracker, `.scratch/` is private

## Context

The agent docs described a local-markdown tracker: one directory per feature
under `.scratch/`, a `spec.md`, numbered issue files, triage recorded as a
`Status:` line. They also flagged an unresolved problem with it, and refused to
create the first file until someone decided:

> **Status: undecided.** This repo is public and `.scratch/` is not in
> `.gitignore`, so files written here are committable and pushing them makes
> them permanently public.

The question stayed open because nothing had needed a ticket yet. It came due
when the experiments work produced one — an import boundary to enforce later —
and a GitHub issue was filed for it in practice. That left the repo's documented
convention and its actual behaviour disagreeing, which is worse than either
choice.

## Decision

**GitHub issues are the tracker.** `.scratch/` is added to `.gitignore` and
becomes private scratch space for throwaway notes only. Nothing another person
or agent needs to read goes there, because nothing there is versioned, reviewed
or shared.

## Considered Options

**A local-markdown tracker in `.scratch/`.** Tickets version alongside the code
that resolves them, are readable with no network, and need no auth for an agent
to search. But every ticket in a repo that publishes to GitHub Pages is
permanently public the moment it is pushed — including half-formed plans and
candid notes — and the only mitigations are remembering not to write certain
things down, or gitignoring the directory and thereby losing the versioning that
was the point.

**Gitignoring `.scratch/` while keeping it as the tracker.** Solves the exposure
and keeps the format, but a tracker nobody else can read is not a tracker. Two
agents on two machines would each have their own.

## Consequences

- Tickets need `gh` and network access; an agent cannot grep them from the
  working tree.
- Triage is a real GitHub label rather than a `Status:` line, which is why
  `docs/agents/triage-labels.md` describes labels now.
- An issue body has to carry its own reasoning and its own out-of-scope notes.
  There is no adjacent `spec.md` supplying context, and the reader is usually an
  agent with no memory of the conversation that produced it.
- The publication risk moves rather than disappearing: GitHub issues on a public
  repo are public too. The gain is that nothing becomes public _by accident_ —
  writing a file no longer publishes it.
