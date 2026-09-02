# AGENTS.md

## Agent skills

### Issue tracker

GitHub issues. `.scratch/` is gitignored private scratch space, never a tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as `Status:` values on each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context. `CONTEXT-MAP.md` at the root names each context and points at its glossary and decisions; there is no root `CONTEXT.md`. Read the map first, then only the context you are working in. See `docs/agents/domain.md` for the convention.

### The package manager

**pnpm, not npm.** `pnpm install`, `pnpm run <script>`, `pnpm exec <tool>`. `packageManager` makes pnpm refuse to run in a project it thinks belongs to another manager, so there is nothing to get wrong once pnpm is on `PATH` — but a dependency with an install script needs declaring in `pnpm-workspace.yaml` before it will install, and a version published in the last 24 hours will not install at all. See `docs/adr/20260902-pnpm-is-the-package-manager.md`.

### Working with branches

`main` moves often and nothing forces a branch to keep up. Fetch and branch from `origin/main`, never from local `main`; fetch and merge `origin/main` before opening a PR. Nothing in between. See `docs/agents/working-with-branches.md`.

### The experiments steward

When several sessions build experiments at once, one of them tends the shared code of `src/experiments/` so the others do not. A standing role, invoked with `/steward`. See `docs/agents/experiments-steward.md`.
