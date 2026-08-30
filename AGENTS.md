# AGENTS.md

## Agent skills

### Issue tracker

GitHub issues. `.scratch/` is gitignored private scratch space, never a tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as `Status:` values on each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context. `CONTEXT-MAP.md` at the root names each context and points at its glossary and decisions; there is no root `CONTEXT.md`. Read the map first, then only the context you are working in. See `docs/agents/domain.md` for the convention.

### The experiments steward

When several sessions build experiments at once, one of them tends the shared code of `src/experiments/` so the others do not. A standing role, invoked with `/steward`. See `docs/agents/experiments-steward.md`.
