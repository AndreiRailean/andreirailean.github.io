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
- Triage state is a GitHub label. See `triage-labels.md`.
- Discussion belongs in issue comments.

## When a skill says "publish to the issue tracker"

`gh issue create`. Do not create a markdown file for it.

## When a skill says "fetch the relevant ticket"

`gh issue view <number>`. The user will normally give the number or the URL.
