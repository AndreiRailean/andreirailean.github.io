---
type: ADR
status: rejected
date: 2026-09-27
summary: fullyParallel with four CI workers was measured against the default two and bought nothing — 5.9 against 6.0 minutes over three runs each — while one CPU-heavy test timed out twice in four runs; what cut the browser job was holding the piece in kit.spec.ts.
---

# More browser workers buy nothing on CI

## Context

After the unit job was split (#229), the browser job was the longest check on
every PR, at 7.9–8.6 minutes. #133 had left `fullyParallel` as the untouched
lever. CI's browser job runs Playwright's default two workers on a four-core
runner, with each worker taking whole spec files.

A model built from local per-test durations (JSON reporter, 299 tests, 1,129
seconds of test time) looked promising at first. `kit.spec.ts` alone was 449
seconds, 40% of the whole. At four workers, file-level scheduling is bound by
that one file at 449 seconds, and test-level scheduling came out at 282. At two
workers both schedules give the same 564, so `fullyParallel` alone could never
help. It needed more workers too.

## What was tried

`fullyParallel: true` and `workers: process.env.CI ? 4 : undefined` in
`playwright.config.ts`, measured on CI in draft PR #233. It was stacked on
#234, which pauses the piece in every `kit.spec.ts` chrome test. So both arms
below include that change, and they differ only in parallelism. Each arm is
several runs of the same commit, reran in place.

| Config                                         | Browser suite     | Mean    |
| ---------------------------------------------- | ----------------- | ------- |
| 2 workers, file-level (as shipped)             | 6.9, 5.4, 5.8 min | 6.0 min |
| 4 workers, `fullyParallel`, one timeout raised | 5.3, 6.3, 6.2 min | 5.9 min |

## How it failed

**No measurable gain.** The difference between the arms is smaller than the
run-to-run spread within either of them.

**And it was flakier until patched.** Before one test was given an explicit
timeout, four runs gave two failures, both
`crowd.spec.ts › a head passing close is large and a head at the back is a
speck`. It runs 40 simulated seconds, which is about 32s of arithmetic alone,
and it went past the default 60s with four Chromiums on four cores.

The model's 282 seconds assumed tests do not slow each other down. These tests
are CPU-bound — simulation and canvas work — so on a four-core runner a third
and fourth worker mostly take CPU from the first two. The suite also still
carries wall-clock assertions such as crowd's `drawMs < 8` and flotsam's frame
cost, which is exactly what contention attacks. `tests/embers.spec.ts` records
the same effect on a draw-time ratio at four workers.

**What did cut the job was less work per test, not more workers.** Thirteen of
`kit.spec.ts`'s fifteen tests drove the chrome while the piece kept rendering.
Pausing it took that file from 4.5 to 3.2 minutes at two workers, and the CI
browser job from 7.9–8.6 minutes to a mean of 6.0 (#234).

## What would make it viable

A runner with more cores than the suite has workers: an 8-core runner at four
workers is a different experiment and is not ruled out by this. Or a suite
whose heavy tests are no longer CPU-bound in the browser. On the current
four-core runner, look for work to take out of a test before looking for
another worker to run it on.
