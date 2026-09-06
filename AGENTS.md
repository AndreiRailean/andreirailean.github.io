# AGENTS.md

## What to work on first

**Anything that speeds up iteration outranks feature work.** A slow or noisy
loop is paid on every change by every session afterwards, so fixing it compounds
where a feature does not. Treat these as higher priority than whatever is next
in the queue, and do not ask before taking one:

- **A red or flaky check**, which taxes everybody at once.
- **A check that cannot see what it is meant to check.** Worse than a missing
  one, because it reads as coverage. Five identical copies of a helper sat in
  `.astro` files past the third-copy rule while `kit-adoption.test.ts` scanned
  only `.ts` —
  `src/experiments/docs/adr/20260906-a-page-holds-no-logic.md`.
- **Work the tools cannot reach.** Code a grep of its own section does not find,
  or a type checker does not type, will be refactored wrongly eventually. The
  fix is to move the code, not to remember the trap.
- **Waiting that buys nothing.** A full browser suite over five pieces to
  approve a paragraph of prose is friction with no verification in it —
  `.github/workflows/test.yml` and `tests/unit/ci-paths.test.ts`.
- **A rule that depends on being remembered.** Where a check can hold it
  instead, that is the higher-leverage version of writing it down. This repo
  keeps producing documented rules broken by their own author within the hour.

The trade this makes explicit: a day spent on the loop is worth more than a day
spent on the thing being looped over, and neither needs asking for.

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
