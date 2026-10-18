# Upgrading dependencies

Andrei, 2026-10-18: "do we need an instruction for a thorough version update of
dependencies? i used to do that by hand every few months. now that it's all
agentic, I don't do that anymore." This is that instruction. A monthly check
finds what is behind and files it for the steward (below); this file is how
the steward acts on it.

## The kinds, and what each costs

Semver decides how much reading comes first:

- **Patch** (1.2.3 → 1.2.4): bug fixes. No code changes.
- **Minor** (1.2 → 1.3): new features and **deprecations**. No code changes,
  but fix a deprecation warning now, because the next major removes it.
- **Major** (1 → 2): breaking changes. Read the package's migration guide in
  full first.
- **Below 1.0, a minor is a major** (0.14 → 0.15). The caret in `package.json`
  will not take it either.

## The general flow

1. **Patch and minor go together, in one PR a month.** Branch from
   `origin/main` and run `pnpm update`, which moves everything within its
   `package.json` range. That is every patch and minor except the 0.x ones.
   If `astro` or one of its integrations is among them, follow the Astro
   section for those too.
2. **Majors get one PR each**, with the migration guide read first, so a
   breakage has one cause. **Ask Andrei before starting a major that is a
   judgement call:** one that changes what a visitor sees, or that needs code
   rewritten rather than renamed. A major that only renames config is not one.
3. **Check `pnpm-workspace.yaml` did not change.** A dependency with a new
   install script needs an `allowBuilds` entry, and pnpm can write placeholders
   into the tracked file without being asked.
4. **The checks, reading exit codes:** `pnpm run typecheck` (astro check),
   `pnpm run lint`, `pnpm run prettier`, `pnpm run build` and
   `pnpm run test:unit`. Look for deprecation warnings in the build output.
5. **Open a PR and let CI run it.** A change to `package.json` selects the
   whole browser suite by itself (`scripts/affected.ts` reports
   `everything, because of package.json`).
6. **Who merges.** This is the steward's question, whether a visitor would see
   the difference:
   - **Only `devDependencies` moved:** the steward merges once CI is green.
     Tools change, and pages do not.
   - **Anything in `dependencies` moved,** or `esbuild` (see below): show
     Andrei a preview first (`/preview`), and he merges. `astro`, its
     integrations, React, the Radix and lucide components and tailwind-merge
     all render into the site.
7. **After the merge, run `pnpm install` in every checkout you use.** Installed
   packages do not follow the lockfile on their own. After #307 moved the
   lockfile to Astro 7.2.8, worktrees still ran 7.2.4. In
   `/root/projects/andrei.md` use `pnpm install --prod --frozen-lockfile`,
   because that checkout is deliberately production-only.

**A version published in the last 24 hours will not install**
(`minimumReleaseAge`, `docs/adr/20260902-pnpm-is-the-package-manager.md`). The
error reads like a missing version. Wait, or pin the previous release. The
monthly check already leaves those out.

## Special cases

- **esbuild builds the runners**, and a runner's file name is the hash of its
  bytes (`src/experiments/docs/adr/20260907-runners-are-committed.md`). If a
  new esbuild changes its output, every runner's hash moves at once:
  `tests/unit/showcase-runners.test.ts` ("leaves every committed file
  byte-identical") fails on the first PR after the bump, because what is
  committed no longer matches a rebuild. The fix is to commit
  the rebuilt runners beside the old ones, never in place of them: pages pin
  old hashes, and `.github/workflows/runners-append-only.yml` refuses any
  modified or renamed runner. Treat it as reaching the site. Every piece is
  republished, so Andrei sees a preview. Before starting, check whether the
  hashes actually move: bump it, run `pnpm run runners`, and read `git status`
  under `public/showcase/runners/`.
- **Playwright's browsers must match its version.** CI installs Chromium fresh
  on every run with whatever Playwright is installed
  (`pnpm exec playwright install --with-deps chromium` in
  `.github/workflows/test-browser.yml`), so CI follows a bump without changes.
  Locally, run `pnpm exec playwright install chromium` in each worktree after
  the merge, or the browser suite fails to launch. `playwright` and
  `@playwright/test` move together.
- **TypeScript has to be supported by `astro check`,** which is
  `@astrojs/check` and its language server, not `tsc`. `pnpm run typecheck` is
  the check that would break. Measured 2026-10-18 on Astro 7.4.0:
  - **TS 7.0.2 waits until `astro check` supports it.** `astro check` refuses
    to run: "astro check does not currently support TypeScript 7.0. To continue
    using astro check, install TypeScript 6 instead." The experimental route,
    `@astrojs/ts-content-mapper`, needs TS 7.1 or later. The peers say the same:
    `@astrojs/check` 0.9.10 wants `^5 || ^6`, and typescript-eslint 8.67 wants
    `<6.1.0`. Re-check when a new `@astrojs/check` or Astro release mentions
    TS 7. **The monthly check will keep listing typescript 7 as a major.** The
    steward answers that by pointing at this paragraph, not by upgrading.
  - **TS 6.0.3 works,** with one change. There were no peer issues, and lint,
    the unit suite and the build passed. `astro check` had one error: TS 6
    checks side-effect imports by default (`noUncheckedSideEffectImports`), and
    `@fontsource/source-sans-pro` ships no types. The fix is
    `import "@fontsource/source-sans-pro/index.css"`, which is the package's
    own `main`, and the built CSS was byte-identical.
- **Prettier and its plugins can reformat the repo.** Put the reformatting in a
  commit of its own, made by `pnpm run prettier:write` repo-wide, so the version
  bump stays reviewable. `pnpm run prettier` only checks. `prettier` and `prettier-plugin-astro` move together.
- **eslint and typescript-eslint move together:** `eslint`, `@eslint/eslintrc`,
  `typescript-eslint`, `@typescript-eslint/eslint-plugin`,
  `@typescript-eslint/parser` and `eslint-plugin-astro`. A mismatched pair fails
  lint for reasons that have nothing to do with the code.

## Astro

Astro's own guide is https://docs.astro.build/en/upgrade-astro/. This section is
that guide applied to this repo.

**Experimental flags do not follow semver** and can break in a patch. Any
`experimental` key in `astro.config.mjs` means reading the changelog even for a
patch. As of 2026-10-18 there are none.

**Node.** Astro supports the current Active LTS and the Maintenance LTS, and
changes Node majors only in its own major versions. `.node-version` pins Node
here, and CI reads it, so a major upgrade may need it moved in the same PR.

**The packages.** These are official, so Astro's upgrade tool moves them
together:

- `astro`
- `@astrojs/react`
- `@astrojs/check` (a devDependency)

These are not official, so check each separately for support of the new Astro
version:

- `astro-icon`
- `astro-eslint-parser`
- `@tailwindcss/vite`

**The procedure:**

1. **Read the changelog** from the current version up to the target:
   https://github.com/withastro/astro/blob/main/packages/astro/CHANGELOG.md, and
   each integration's. For an Astro major version, also read the "Upgrade to
   vX" guide. Every entry has a "What should I do?" section, so work through
   them as a checklist.
2. **Upgrade astro and its official integrations together**, with pnpm and
   never npx:

   ```bash
   pnpm dlx @astrojs/upgrade
   ```

   **It asks before an integration with breaking changes, so give it a
   terminal.** Run plainly from a session, it lists what it would do, then
   exits 0 having changed nothing, which reads as success. It needs a
   pseudo-terminal, and an Enter to take the default "Yes":

   ```bash
   (for i in $(seq 40); do sleep 3; printf '\r'; done) |
     timeout 200 script -qec "pnpm dlx @astrojs/upgrade" /dev/null
   git diff --stat package.json pnpm-lock.yaml   # must not be empty
   ```

   The `git diff` is the check, not the exit status. Only answer Yes having
   read the changelog of whatever it says has breaking changes: for 7.2.8 →
   7.4.0 that was `@astrojs/react` 6 → 7. Its result was byte-identical, both
   files, to `pnpm add` of the versions it listed. So the pinned form below is
   an equivalent way to do the same thing:

   ```bash
   pnpm add astro@7.4.0 @astrojs/react@<matching>
   ```

3. **Runners must not move.** Astro does not build them; esbuild does, and
   esbuild is pinned directly in `package.json`. Check it: after
   `pnpm run runners`, `git status` shows no changed tracked file under
   `public/showcase/runners/`.
4. **The general flow's checks, PR and preview** apply as above. Astro renders
   every page, so an Astro upgrade always gets Andrei's preview.

## When to upgrade: the monthly check

On the 1st of each month, `.github/workflows/outdated.yml` runs
`scripts/outdated.ts`. It reads every direct dependency's installed version from
`pnpm-lock.yaml` and asks the registry for the latest. If anything is behind,
and old enough for pnpm to install, it files or updates one `steward` issue
titled **Dependency upgrades available**. The issue has a table grouped by
major, minor and patch, saying whether each package reaches the site. A month
with nothing behind closes the issue if it is still open. The steward takes the
issue like any other and follows this file. Andrei, 2026-10-18: "let's also
make it a steward task to check for new versions on a regular basis and suggest
and upgrade if available. doesn't have to be too frequent. once a month is
probably enough".

To ask now rather than wait: `node scripts/outdated.ts` prints what the issue
would say, or nothing. `gh workflow run outdated.yml` files it.

## Dependabot

Dependabot raises grouped security bumps (`npm_and_yarn`). There is no
`dependabot.yml`, so it opens no version updates; those are the monthly check's
job. A Dependabot PR's CI result is against the `main` it branched from, so
comment `@dependabot rebase` and wait for green on today's `main` before merging.
It never runs `@astrojs/upgrade`, so Astro's integrations can be left behind.
