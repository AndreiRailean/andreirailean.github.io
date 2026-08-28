---
type: ADR
status: accepted
date: 2026-08-28
summary: The experiments keep sharing the site's repo, build and origin. A separate repo and a subdomain are two independent decisions, and neither trigger has fired.
---

# Experiments stay in the site repo, and off a subdomain

## Context

The question was asked directly: spin the experiments out into their own repo
and publish them to `experiments.andrei.md`, or something shorter.

`src/experiments/docs/adr/0001-experiments-inside-the-site-project.md` already
decided the experiments live as bare pages in the site's Astro project, and
names a revisit trigger. This record exists for what that one does not cover —
the subdomain, and the fact that the repo and the origin are separable at all.

The state that makes the question answerable is that **the coupling is already
gone**. `CONTEXT-MAP.md` claims the two contexts share "a build, an origin and a
deployment, and deliberately nothing else", and that is true in practice: an
experiment imports nothing from the site, the site links to nothing in
experiments, and the glossaries and ADRs are already separated. A split would
buy enforcement of a boundary that is currently holding on its own.

## Decision

**No split.** The experiments keep sharing the repo, the build and the origin.
Revisit when ADR 0001's trigger fires — an experiment needing a dependency the
site should not carry, or its own build configuration.

**Repo and origin are two decisions, not one.** They feel welded together only
because GitHub Pages allows one site per repo. A second repo does not require a
second origin: its build output can be published into the site's. A subdomain
does not require a second repo: the same repo can deploy twice through another
host with a build filter. Anyone reopening this should decide them separately.

If the split does happen, take the repo _and_ the subdomain together. A second
origin is not otherwise available on Pages, and the URL migration is then paid
once rather than twice.

## Considered Options

**Separate repo plus subdomain.** Independent deploys, per-experiment
toolchains, a boundary that cannot be violated by accident, and CI that runs
only what changed. The costs are two of everything to maintain — lockfiles,
workflows, Node pins, lint configs, and two copies of `AGENTS.md` and `.claude/`
that will drift — plus the URL break below.

**Subdomain only, same repo.** Deploy the experiments to another host with a
build filter. Gets the separate origin without a second repo.

**Separate repo, same origin.** Publish the experiments build into the site's
output. Splits history and dependencies while keeping every existing URL. More
build machinery, no URL cost.

**npm workspaces.** Splits the dependency trees so an experiment can carry its
own toolchain, without a second repo or origin. Still needs both projects built
and their output merged, which is the cost ADR 0001 already named.

**CI path filters.** Not a split at all, and the cheapest fix for the friction
that is actually real today. Tracked separately.

## Correcting ADR 0001

ADR 0001 states that extraction would break "the secure-context features unless
a subdomain is set up". That is wrong, and it makes the split look more
expensive than it is. The wake lock and the clipboard need a _secure context_,
and **any** HTTPS origin qualifies — a subdomain on Pages is served over HTTPS
like the apex. Those APIs are not a reason to stay.

What a second origin actually costs is the existing `/experiments/…` links,
which ADR 0001 notes are already shared. GitHub Pages cannot issue a 301, so
those would need meta-refresh or JS redirect stubs kept in the site repo
indefinitely.

ADR 0001 is left as written rather than edited: it belongs to the experiments
context and is being worked on elsewhere.

## Consequences

- **A broken experiment fails the site deploy.** `deploy.yml` runs
  `astro check && astro build` over everything on push to `main`, so a typo in a
  piece takes the résumé down with it.
- **CI cost is shared in both directions.** A PR touching only `resume.md` still
  installs Chromium and runs the browser suite; a slider tweak rebuilds the
  whole site.
- **Every experiment tweak redeploys the site**, which given the iteration rate
  is nearly every deploy.
- The experiments carry a dependency tree they do not use, and the site's Astro
  and React versions constrain what an experiment can reach for.
