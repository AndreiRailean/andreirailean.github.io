# Upgrading Astro

Astro's own guide is https://docs.astro.build/en/upgrade-astro/. This file is
that guide applied to this repo: which command, which packages, and what to
check here that the guide cannot know about.

## What kind of upgrade it is

Astro follows semver, and the kind decides how much reading comes first:

- **Patch** (7.2.4 → 7.2.8): bug fixes. No code changes, by Astro's policy.
- **Minor** (7.2 → 7.4): new features and **deprecations**. No code changes
  either, but a deprecation warning in the build is something to fix now,
  because the next major removes it.
- **Major** (7 → 8): breaking changes. Read the "Upgrade to v8" guide in full
  first. Every entry has a "What should I do?" section, so go through them as a
  checklist.

**Experimental flags do not follow semver** and can break in a patch. Any
`experimental` key in `astro.config.mjs` means reading the changelog even for a
patch. As of 2026-10-18 there are none.

**Node.** Astro supports the current Active LTS and the Maintenance LTS, and
changes Node majors only in its own major versions. `.node-version` pins Node
here, and CI reads it, so a major upgrade may need it moved in the same PR.

## The packages

Official, so moved together by Astro's upgrade tool:

- `astro`
- `@astrojs/react`
- `@astrojs/check` (a devDependency)

Not official, so check them separately. Each has to support the new Astro
version:

- `astro-icon`
- `astro-eslint-parser`
- `@tailwindcss/vite`

## The procedure

1. **Branch from `origin/main`**, as for anything else
   (`docs/agents/working-with-branches.md`).
2. **Read the changelog** from the current version up to the target:
   https://github.com/withastro/astro/blob/main/packages/astro/CHANGELOG.md.
   For a major version, also read the upgrade guide.
3. **Upgrade astro and its official integrations together**, with pnpm and
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
   an equivalent way to do the same thing.

   To pin a version instead of taking the latest:

   ```bash
   pnpm add astro@7.4.0 @astrojs/react@<matching>
   ```

   **A version published in the last 24 hours will not install**
   (`minimumReleaseAge`, `docs/adr/20260902-pnpm-is-the-package-manager.md`).
   The error reads like a missing version. Wait, or pin the previous release.

4. **Check `pnpm-workspace.yaml` did not change.** A dependency with a new
   install script needs an `allowBuilds` entry, and pnpm can write placeholders
   into the tracked file without being asked.
5. **The checks, reading exit codes:** `pnpm run typecheck` (astro check),
   `pnpm run lint`, `pnpm run build` and `pnpm run test:unit`. Look for any
   deprecation warning in the build output.
6. **Runners must not move.** They are built by esbuild, which is pinned
   directly in `package.json`, so an Astro upgrade should leave them alone.
   Check it: after `pnpm run runners`, `git status` shows no changed tracked
   file under `public/showcase/runners/`. A changed hash would break every
   page that pins the runner
   (`src/experiments/docs/adr/20260907-runners-are-committed.md`).
7. **Open a PR and let CI run it.** A change to `package.json` selects the
   whole browser suite by itself (`scripts/affected.ts` reports
   `everything, because of package.json`), so there is nothing to choose.
8. **Show Andrei a preview** (`/preview`). A visitor could see the difference
   (Astro renders every page), so the merge is his call.
9. **After the merge, run `pnpm install` in every worktree you use**, and in
   the main checkout. Installed packages do not follow the lockfile on their
   own: after #307 moved the lockfile to Astro 7.2.8, worktrees still ran
   7.2.4.

## When to upgrade: the monthly check

On the 1st of each month, `.github/workflows/astro-outdated.yml` asks the
registry about every package listed above. If any has a release newer than the
lockfile's version, and old enough for pnpm to install, it files or updates one
`steward` issue titled **Astro upgrade available**, with a table of what moved.
A month with nothing to upgrade closes that issue if it is still open. The
steward takes the issue like any other and follows this procedure. Andrei,
2026-10-18: "let's also make it a steward task to check for new versions on a
regular basis and suggest and upgrade if available. doesn't have to be too
frequent. once a month is probably enough".

To ask now rather than wait: `node scripts/astro-outdated.ts` prints what the
issue would say, or nothing. `gh workflow run astro-outdated.yml` files it.

## Dependabot

Dependabot raises grouped security bumps (`npm_and_yarn`) that often include
`astro`. Its CI result is against the `main` it branched from, so comment
`@dependabot rebase` and wait for green on today's `main` before merging. It
never runs `@astrojs/upgrade`, so integrations can be left behind.
