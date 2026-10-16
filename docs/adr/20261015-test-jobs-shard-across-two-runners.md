---
type: ADR
status: accepted
date: 2026-10-15
summary: Both test jobs run as two shards on separate runners, after kit.spec.ts was set to run its tests in parallel. That roughly halved both jobs: browser from 525–593 s to 268–302 s, and unit from 435–490 s to 233–298 s. It is the "more cores" case the workers ADR left open, not a re-run of the rejected "more workers".
---

# The test jobs shard across two runners

## Context

#274 asked what would make a merge reach the site sooner. Once #238 and #283 had
cut what docs-only and piece-only PRs run, **21 of the last 30 merged PRs still
selected everything**. Replaying `scripts/affected.ts` over their file lists
showed that every one of them touched something genuinely shared: the kit, the
gallery, `posters.ts`, a workflow. So the selector was not the leak, and the
full suites set the release clock. Browser was 525–593 s per job and unit about
470 s.

`docs/adr/20260927-more-browser-workers-buy-nothing-on-ci.md` had found that
four workers on one four-core runner bought nothing, because the tests are
CPU-bound and take cores from each other. Its "what would make it viable" was
more cores than workers.

The browser suite was profiled with the JSON reporter on 2026-10-15. Of 1,233 s
of test time, `kit.spec.ts` was 522 s, **all of it on one worker**: Playwright
hands a file to a single worker whole. So that one file was a floor at about
the job's whole length, and no added capacity could have got under it.

## Decision

- `kit.spec.ts` runs `test.describe.configure({ mode: "parallel" })`. Its tests
  each open their own page and share no hooks or module state. Alone on two
  workers it went from 522 s on one worker to 295 s wall, split 273/273 s per
  worker, with all 216 tests passing.
- `test-browser.yml` and `test-unit.yml` each run a matrix of two shards.
  Each shard is its own four-core runner at the same worker count as before,
  so each runner sees the same contention it always did. The repo is public,
  so the extra runners cost no money.
- `scripts/affected.ts` passes `--shard` through to vitest and Playwright. The
  kit-selection check lists the selection unsharded, because a shard holding
  none of a piece's kit tests is normal.

| job (wall clock of the slower shard) | before              | after (3 runs)  |
| ------------------------------------ | ------------------- | --------------- |
| Browser tests, everything selected   | 525–593 s (10 runs) | 268, 292, 302 s |
| Unit tests, everything selected      | 435–490 s           | 260, 298, 233 s |

## Consequences

**The shard count is written twice and must agree.** If `matrix.shard` lists
fewer values than the `/N` after `--shard`, some shards never run, and an empty
or unrun shard reports nothing. Half a suite would go unchecked and stay green.
`tests/unit/affected.test.ts` fails when the two disagree, in either workflow.

**Each browser shard builds the site itself**, about 30 s paid twice. That is
cheaper than passing `dist/` between jobs, which would add an upload, a
download and an ordering dependency.

**The unit job's floor is now the heaviest single file**, crowd's
`stroll.route.test.ts` at about 245 s locally. Of that, 230 s is one 300-second
market walk. Sharding cannot split a file, and `src/experiments/crowd/AGENTS.md`
records why the step stays at 1/120. The next unit lever is that test's length,
which is a judgement about what it needs to show, not a CI setting.

_Update 2026-10-16:_ that judgement was made (#287). The crowd's and walkers'
long walks were replaced by tests of the functions that decide each property,
and `stroll.route.test.ts` no longer exists. The heaviest unit file is now
walkers' `crowd.test.ts` at about 10 s locally, and the whole unit suite is
about 45 s of test time, so the unit job's clock is set by setup and the
browser job rather than by any one file.

**A spec file that grows past a few minutes should go parallel**, or it becomes
the job's clock again however many shards there are. `tests/AGENTS.md` carries
that rule.
