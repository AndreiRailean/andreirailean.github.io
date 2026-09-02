---
type: ADR
status: accepted
date: 2026-09-02
summary: pnpm replaces npm, because the store hardlinks across worktrees and this repo is worked on in several at once — an extra checkout costs 27 M instead of 383 M.
---

# pnpm is the package manager

## Context

This repo is worked on in several git worktrees at once, by parallel sessions.
Each one carried its own full `node_modules`, 352–498 M, and the box has a 20 G
root. Disk pressure was the trigger (#101); it is not the reason this landed.

Housekeeping — an unused 656 M Playwright browser cache, 324 M of `npx`
one-offs, superseded toolchain versions, worktrees on already-merged branches —
recovered about 2 G, more than this migration does, and none of it is anything
pnpm touches. **The two are additive, and housekeeping alone was the larger
win.** So the one-off saving is not the argument.

The argument is the marginal cost of the next worktree, measured rather than
estimated:

|                                   | Disk     |
| --------------------------------- | -------- |
| One npm worktree                  | 383 M    |
| Store + first pnpm worktree       | 381 M    |
| **Each additional pnpm worktree** | **27 M** |

Files in `node_modules` carry two hardlinks — one in the store, one in the tree
— so the content exists once per box rather than once per checkout. At a steady
five or six worktrees that is roughly 1.8 G; the point is that it stays flat as
worktrees are added. A warm-store install is also 0.9 s against npm's 7 s.

## Decision

pnpm 11.25.0, declared in `packageManager` and installed standalone.

**Standalone, not Corepack.** Corepack is not shipped with Node 25 and later,
so a Corepack-based setup has a known end date. On this box pnpm is the release
binary in `~/.local/share/pnpm`, symlinked onto `PATH`.

**Every machine and every agent now needs pnpm.** That is a real cost and it is
accepted deliberately: nothing in the repo can install dependencies without it,
because `packageManager` makes pnpm refuse to run at all in a project it thinks
belongs to another manager — `pnpm --version` alone fails. That refusal is why
changing `packageManager` is the first step of the migration and not one of the
later ones.

**Build scripts are declared, not discovered.** pnpm 11 defaults
`strictDepBuilds` to true, so an unreviewed `postinstall` is a hard error rather
than a warning, and this recurs for every future dependency that has one. The
allowlist lives in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: false
  fsevents: false
```

`false` rather than absent, and `false` rather than `true`. Astro's own monorepo
sets `esbuild: false`, and a build here confirms it: esbuild's binary arrives
via its platform package, so its install script has nothing left to do.
`fsevents` is darwin-only. Pre-declaring both also sidesteps
[pnpm/pnpm#11574](https://github.com/pnpm/pnpm/issues/11574), still open, where
a non-interactive install appends `allowBuilds` placeholders to the _checked-in_
`pnpm-workspace.yaml` — which with several worktrees installing would hand
sessions tracked-file diffs they did not create. With both entries present,
every install run during this migration left the file byte-identical.

**Settings live in `pnpm-workspace.yaml`, and nowhere else.** pnpm 11 reads only
auth and registry settings from `.npmrc`, and no longer reads a `pnpm` field in
`package.json` at all. Every pre-2026 `shamefully-hoist` recipe is inert here.

**`minimumReleaseAge` keeps its default of 1440 minutes.** A dependency
published in the last 24 hours will not install. Kept because the supply-chain
protection is worth more than the surprise, but it is a surprise: the failure
reads as a missing version.

## Consequences

**pnpm surfaced three latent bugs that npm's hoisting had been hiding.** Its
isolated layout lets _dependencies_ reach undeclared packages but not project
code, and every offender here was project code:

- `astro-eslint-parser`, `playwright` and `sharp` were imported and never
  declared. `sharp` was reaching the build as an **optional** transitive of
  `astro`, so any install that skipped optional dependencies would have dropped
  what `astro:assets` needs, silently. Fixed ahead of this, on its own branch,
  because it was worth fixing whatever was decided here.
- `package.json`'s `build` and `test` scripts shelled back into `npm run`.
- `tests/support/dev-server.ts` spawned `npm run dev` to start the browser
  suite's server — which would have kept the whole Playwright suite dependent on
  npm still being installed after the migration.

**CI setup collapses into one action.** `pnpm/setup@v2` supersedes
`pnpm/action-setup` for pnpm 11 and replaces `actions/setup-node` outright,
installing the runtime itself. It has no equivalent of setup-node's
`node-version-file`, so `.node-version` is read into a step output and passed as
`runtime:` — the read `deploy.yml` already did. The alternative was declaring
`devEngines.runtime` in `package.json`, rejected because it would make the Node
version true in two places.

The action installs dependencies itself by default, and that default is used
with `install: false` — the install is a named step running
`pnpm install --frozen-lockfile`, the `npm ci` equivalent. The action's own
`require-lockfile` input, which would have made its install frozen, exists on
the action's `main` branch but **not in the released `v2` tag**, which rejects
it as an unexpected input: a warning annotation, plus an install that quietly is
not `npm ci`. CI caught this and the docs did not, because reading `action.yml`
on `main` describes an unreleased action. Read the tag.

`deploy.yml` needed nothing, and that was checked at the `v6` tag rather than
assumed: the action runs `find . -maxdepth 1 -name "pnpm-lock.yaml"` and sets
`PACKAGE_MANAGER=pnpm` from the lockfile alone.

**That makes `packageManager` load-bearing a second time, on a path no
pull-request CI exercises.** The action then reads it with
`jq -e '.packageManager'`, and when the field is missing it does not fail — it
emits `::warning title=Could not detect PNPM version` and installs **latest**
pnpm. So the deploy's pnpm version is pinned by that field and nothing else.
Delete or mistype it and the deploy floats to whatever pnpm is newest, with a
warning as the only signal. The same fail-soft shape as the two defects above.

Worth knowing too: `withastro/action@v6` installs pnpm with
`pnpm/action-setup@0ebf4713` (v6.0.9) internally. So "`pnpm/action-setup` is
superseded by `pnpm/setup@v2`" describes what _this repo_ writes, not the whole
build — the deploy still goes through the predecessor. Its README recommends
`pnpm/setup` for pnpm 11 and newer but states no incompatibility or version cap,
so this is unsupported-by-preference rather than known-broken. It is also the
one part of this migration that no pull request can prove, because `deploy.yml`
runs only on push to `main`.

**ADRs were not rewritten.** Eleven `npm`/`npx` commands remain in `docs/adr/`,
`src/experiments/docs/adr/` and `docs/superpowers/specs/`. Those files record
what was run at the time and are append-only; rewriting a past decision's
transcript would make it a worse record. Everything an agent reads as
instruction — the `AGENTS.md` files, the steward skill, code comments — was
converted.

**Rollback is one command and stays available.** `package-lock.json` is in git
history, so the migration is a revert. Before it merged, closing the PR; after,
`git revert` and an `npm ci` per converted worktree.

## Considered Options

|                                 | Space    | Verdict                                                                                                                                                                         |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Housekeeping alone**          | ~2 G     | **Done, and larger. Not an alternative — additive**                                                                                                                             |
| npm `--install-strategy=linked` | ~0       | Its `.store/` is **per project**, so zero cross-worktree dedup — it solves phantom dependencies, not disk. Orphaned entries also accumulate and `npm prune` will not clear them |
| Yarn Berry / PnP                | ~similar | Astro's own troubleshooting docs tell you to set `nodeLinker: node-modules`, which discards the benefit                                                                         |
| Bun                             | unknown  | Playwright's bun support request is closed as not planned, and it changes the runtime as well as the installer                                                                  |
| Shared symlinked `node_modules` | ~1.9 G   | Pins every worktree to one dependency set. Version drift between worktrees is real and this breaks it silently — it is what pnpm does correctly, so do not hand-roll it         |
| Fewer worktrees                 | ~1.2 G   | Folded into housekeeping; two worktrees on merged branches were removed                                                                                                         |
