# AGENTS.md

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/` in this repo. See `docs/agents/issue-tracker.md`.

> [!WARNING]
> **Open decision: is `.scratch/` public?** This repo is public (it publishes to GitHub Pages) and `.scratch/` is **not** in `.gitignore` — so anything written there is committable and, once pushed, permanently public.
>
> Stop and raise it with the repo owner, before writing the file, when:
>
> - it would be the **first** file created under `.scratch/` — the `.gitignore` decision is still unmade, so make it then; or
> - a scratch file would contain anything worth reconsidering: employer or client names, unreleased or embargoed plans, credentials, tokens, private URLs, personal data, or candid notes about identifiable people.
>
> Never stage a `.scratch/` path as part of a broader `git add` without calling it out first. If the decision has since been made, record it in `docs/agents/issue-tracker.md` and this warning can go.

### Triage labels

The five canonical triage roles, used verbatim as `Status:` values on each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
