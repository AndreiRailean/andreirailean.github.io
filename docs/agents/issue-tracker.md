# Issue tracker: GitHub issues

Issues and specs for this repo are **GitHub issues**, reached with `gh`.

```bash
gh issue create --title '…' --body '…'
gh issue list
gh issue view <n>
```

## `.scratch/` is private

`.scratch/` is gitignored. It is scratch space for private or throwaway notes,
and it is **not** the issue tracker. Nothing in it is versioned, reviewed or
shared, so nothing another person or agent needs to read belongs there.

This was an open question: the repo is public and publishes to GitHub Pages, so
a markdown tracker inside it would have made every ticket permanently public.
Settled in favour of GitHub issues, recorded in
`docs/adr/20260823-github-issues-as-the-tracker.md`.

## Conventions

- One issue per unit of work. Write the reasoning into the body — the future
  reader is usually an agent with no memory of the conversation.
- State what is **not** in scope, and link the ADR when a decision constrains
  the work. An issue that omits this gets re-litigated.
- Triage state is a GitHub label. See `triage-labels.md`, and note that most of
  the vocabulary it describes does not exist on the repo — only `wontfix` of its
  five has ever been created.
- Discussion belongs in issue comments.

## `kit` is a state, not a subject

`kit` means **in the experiments steward's domain and available to pick up**. It
does not mean "this ticket is about `src/experiments/kit/`" — the role's scope is
all of `src/experiments`, and was widened to that deliberately.

- **File a bare TODO if that is all you have.** The label does not assert that
  the analysis is done. Whoever picks it up does the working-out, and a cheap
  ticket that captures a gap beats a good one nobody wrote. The bar is not on
  filing; it is on **stopping mid-investigation** — if you did the work and are
  leaving, record what you ruled out and why, because that is the one thing that
  does not derive from the repo.
- **Removing the label must leave findings.** The steward may decide a ticket is
  out of domain, and then it says so in a comment before un-labelling. Otherwise
  the label silently disappears and the next reader cannot tell whether it was
  considered or overlooked — the same reason a divergence from the kit needs a
  `kit-opt-out: <reason>` rather than just being different.

There is deliberately no second label for "considered and declined". A comment
carries the reasoning and a label cannot; and a declared label nobody maintains
is exactly how `triage-labels.md` came to describe four labels that do not
exist.

## When a skill says "publish to the issue tracker"

`gh issue create`. Do not create a markdown file for it.

## When a skill says "fetch the relevant ticket"

`gh issue view <number>`. The user will normally give the number or the URL.
