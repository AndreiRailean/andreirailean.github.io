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

  **The principle is easy and recognising it in the moment is not**, which is why
  the shapes are listed rather than left as an exercise. All of these have
  happened here, most of them more than once:

  - a pattern that **matches nothing** — a grep, a glob, a lint rule, a route
    matcher that stopped matching when the thing it guarded was renamed;
  - an assertion of **absence with no paired presence**, which passes when the
    subject has been deleted as readily as when it is well behaved;
  - a test of something **structurally impossible**, which can never fail for the
    reason it was written;
  - a **timing-dependent negative** — "nothing failed" measured over a window too
    short for anything to fail in;
  - a **declared fact nobody can clear**, which outlives the session that wrote
    it and then reads as current.

- **Derive it; do not declare it.** A fact a session writes down is a fact that
  dies with the session, and **dying is the case that matters** — abruptly is how
  most sessions end. So the corpse, not the truth, becomes the default state,
  and once people learn to clear corpses they cannot tell one from a live claim.
  Prefer a fact that is the thing it asserts: a server answering on a port, a pid
  that `kill -0` can test. `.astro/dev.json` is the pattern.

- **Measure it; do not argue it.** Three disagreements this repo could not settle
  in prose took minutes to settle with a number, and two were settled the other
  way than expected. Compare conditions inside one run on this shared box; a
  single whole-suite timing is not a measurement.

**And the habit that makes the rest trustworthy: break it and watch it fail.**
A check nobody has seen fail is a claim, not a check — that is what every shape
above has in common. `tests/unit/browser-suite.test.ts` and
`tests/unit/opt-out.test.ts` go further and test the gate itself against cases
the repo does not contain, which is the version to copy when a check reads
source rather than behaviour.

**A rule written in prose has the same failure and a different test.** A rule can
be true, agreed and unfollowable — when it assumes something the reader was never
in a position to record. `/wrap-up` said "delete only branches this session
created", which nothing can establish afterwards, so the first session to follow
it globbed and swept up somebody else's work. That is not a smaller version of
the rule; it is a different one, and it reads as compliance.

**The discriminator is whether the next clause hands over something local and
decidable.** An unverifiable property is fine when it is immediately paired with
a proxy the reader can actually check, and fatal when the reader is left to
bridge the gap themselves. Both known instances left the bridge to the reader.

**And the test is to run it without the rule and watch what gets invented.** A
reviewer reads for whether a rule is correct; only an executor discovers whether
it is followable, and those are different properties. What an agent invents where
the prose runs out is the finding. The control run is the load-bearing half and
the one that feels skippable: a dotfiles session measured 2 of 4 agents deriving
a rule unaided, which said the text was under-specified rather than wrong and
changed the fix from a prohibition to a clarification. Off the fixed version
alone it would have read as 4 of 4 saved.

- **Work the tools cannot reach.** Code a grep of its own section does not find,
  or a type checker does not type, will be refactored wrongly eventually. The
  fix is to move the code, not to remember the trap.
- **Waiting that buys nothing.** A full browser suite over five pieces to
  approve a paragraph of prose is friction with no verification in it —
  `.github/workflows/test-browser.yml` and `tests/unit/ci-paths.test.ts`.
- **A rule that depends on being remembered.** Where a check can hold it
  instead, that is the higher-leverage version of writing it down. This repo
  keeps producing documented rules broken by their own author within the hour.

The trade this makes explicit: a day spent on the loop is worth more than a day
spent on the thing being looped over, and neither needs asking for.

## Agent skills

### Showing Andrei the work

**He approves what he sees in a browser, not what you describe**, so putting
visual work on screen is part of finishing it rather than something to ask
permission for. `pnpm run preview` builds and serves in about eight seconds;
hand him the **tailscale or LAN** address it prints, never `localhost`. A
rebuild is `pnpm run build:quick` and does not restart the server, so his URL
and his bookmark keep working — the port is derived per worktree and is stable.
Never `astro dev`: it costs seven times the memory and has twice shown him stale
work he then reported as broken. Invoked with `/preview`. See
`docs/adr/20260912-previews-and-tests-run-against-a-static-build.md`.

### Wrapping up a session

**Most of what a session leaves behind, it did not choose to start.** A poster
capture and a browser run each build and leave a preview server up by design, and
a merged branch will refuse to delete while its upstream ref is stale. Neither is
found by remembering. `/wrap-up` clears what is yours — servers, branches, probe
worktrees — and reports what is not safe to touch, because `astro preview stop`
and the stash are per-worktree and shared respectively. It is best-effort by
nature: a session that ends abruptly never runs it, which is why leftovers
announce themselves through `.astro/*.json` instead.

**Keep a note of every branch, worktree and stash entry you create, as you
create it.** That is the half `/wrap-up` cannot supply, because it is read at the
end and the record has to start at the beginning — and none of it is recoverable
afterwards: a branch does not carry its author and a worktree does not carry its
purpose. Without the note the skill's "delete only what you created" degrades
into a glob, which is not a smaller version of the rule but a different one; the
first session to follow it swept up two branches belonging to somebody else.

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

### The steward

When several sessions build at once, one of them tends the **shared surface** so the others do not. Its scope is a property rather than a directory: work that is shared, mechanical and verifiable, decided by one question — **would a visitor see the difference?** If no it is the steward's, wherever it lives; if yes it waits for Andrei. A standing role, invoked with `/steward`. See `docs/agents/steward.md`.
