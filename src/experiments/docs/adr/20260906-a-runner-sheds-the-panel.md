---
type: ADR
status: accepted
date: 2026-09-06
summary: TRACKS is declared per piece rather than derived from CONTROLS, and module-scope calls in a control list carry pure annotations, so a runner ships without the panel's prose.
---

# A runner sheds the panel it never draws

## Context

A **runner** is a piece's drawing code frozen into a bundle — no chrome, no
panel, no controls; see
`20260906-a-published-scene-is-settings-plus-a-frozen-runner.md`. Starry
Night's was 14,457 bytes, and 2,429 of those were `hint:` strings captioning
sliders it does not render, plus labels, `format` closures and option lists.

#151 filed it at about 17% and asked whether it was worth fixing at all, given
that 2.4kb on a background loaded once is defensible and a fix that costs a file
and an indirection would not be. The answer turned out to be larger and cheaper
than that framing: **28%, for no new file and no indirection.**

## What was actually keeping it

Two independent things, and this is the part worth recording, because removing
either one alone made the bundle **no smaller**:

| change                                      | bundle             |
| ------------------------------------------- | ------------------ |
| baseline                                    | 14,457             |
| declare `TRACKS`/`BOUNDS` as literals, only | 14,740 — _larger_  |
| annotate the calls as pure, only            | 14,132 — unchanged |
| both                                        | **10,384**         |

- **The derivation.** `BOUNDS` and `TRACKS` were built from `CONTROLS` at module
  scope, which made the whole control list reachable from `normalizeSettings` —
  and every runner calls that.
- **The call expressions.** A control list contains `MODES.map(...)` building a
  choice row's options, and `Math.ceil(...)` sizing psyxels' glyph grid. **esbuild
  cannot prove a call side-effect-free, so it pins the declaration that contains
  it even when nothing references that declaration at all.** An unexported,
  unreferenced `CONTROLS` still shipped in full. This was the surprising half:
  the first diagnosis, in the issue and in my own comment on it, blamed the
  derivation alone and would not have worked.

## Decision

- **`TRACKS` is written out per piece.** Numbers, not a computation over
  `CONTROLS`.
- **`BOUNDS` is narrowed from `TRACKS`**, so the numbers appear once.
- **Every module-scope call inside a control list carries `/* @__PURE__ */`.**
  Not literal option arrays, which would duplicate the label maps and give them
  somewhere to drift.

The literals can now disagree with the controls they describe, and the answer is
a check rather than a derivation: `tests/unit/experiments-grid.test.ts` fails if
any declared track differs from its control. **That is the same trade the address
registry makes** — the thing that must not drift silently gets a test rather than
a computation, because a computation is what pulled the prose in.

`tests/unit/experiments-runner-weight.test.ts` holds both mechanisms at the
source. Not against the built bundle: `public/showcase/` is gitignored, so a
check reading it would silently skip whenever it was absent, which is the exact
failure this section keeps finding.

## Consequences

- **A piece's numbers are stated twice** — in its controls and in its tracks.
  That is the cost, and it buys a runner that carries only what it draws.
- **Adding a slider now means adding a track too**, and the grid check says so by
  name when it is forgotten.
- **`format` closures, labels, hints and option lists stay out of every future
  runner**, which was the part of #151 that mattered: the concern was never the
  2.4kb, it was that it only grows.

## Considered Options

**Leave it.** #151's own first option and entirely defensible at 2.4kb. Rejected
once the real figure came in at 28% and the fix turned out to need no new file.

**Literal option arrays instead of pure annotations.** Works — measured at the
same 10.1kb — and duplicates `MODE_LABELS`, `FACE_LABELS`, `SUBJECT_LABELS` and
the rest into a second place that can drift. The annotation says the same thing
to the bundler and says nothing twice.

**A budget assertion on the built bundle.** Still worth having and deliberately
not done here. It needs the runners built, which the unit job does not do, and a
check that skips when its subject is missing is worse than no check. If it is
wanted, it belongs in whatever job already runs `pnpm run runners`.
