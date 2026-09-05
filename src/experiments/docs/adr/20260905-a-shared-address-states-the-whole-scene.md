---
type: ADR
status: accepted
date: 2026-09-05
summary: settingsToQuery writes every setting rather than only what differs from DEFAULT_SETTINGS, so a shared link cannot change scene when a default moves.
---

# A shared address states the whole scene

## Context

A URL is the unit of sharing in this section. `CONTEXT.md` says so under
_Settings_: any state worth keeping can be copied, sent, or handed back to be
saved as a preset. Nothing in the UI records a preset, so a link is the only way
a scene someone found by dragging sliders survives at all.

Four of the five pieces wrote that link as the **difference** from
`DEFAULT_SETTINGS`. Each one carried the same one-line justification — _"Only
values that differ from the defaults, so shared URLs stay readable"_ — and the
result was short, legible addresses like `?peak=0.85`.

The cost was not visible from inside any one piece. A link that omits a setting
means _"whatever the default is"_ for that setting, so **moving a default
silently changes what every already-shared link shows**. `AGENTS.md` mitigated
this by asking that `DEFAULT_SETTINGS` move only when the meaning of a control
moves — a rule that depends on everyone remembering it, about a constant the
section elsewhere describes as arbitrary and diminishing in role.

This is the same fault as a preset spreading over the defaults, one layer up.
That one is settled: `20260830-a-preset-inherits-from-nothing.md`, written after
Psyxels lost four of its six scenes to a quarter-speed playback in a change that
touched none of them.

**Psyxels had already fixed it here too, and alone.** Its `settingsToQuery` has
written every setting for some time, with the reasoning in its docblock: _a link
resting on a default is a link whose scene changes the day the default does_.
Nobody carried that to the other four, and psyxels' own `AGENTS.md` still
described the diff its code had stopped writing.

Starry Night is what the gap cost. It had no landing rewrite at all (#128), and
adding one changed nothing: its primary holds its `DEFAULT_SETTINGS` values
exactly, so the difference between them was _empty_, and the rewrite produced a
bare address — which is precisely the address that means "whatever is featured".
The piece had to be skipped in `tests/kit.spec.ts` for it.

## Decision

`settingsToQuery` writes **every** setting, whatever its value, in every piece.

`DEFAULT_SETTINGS` keeps the job it should have had alone: filling an address
that named nothing. That address is an old bookmark or a bare visit, and neither
was ever promised a particular picture — a bare visit gets the primary, through
`settingsForLanding`.

`tests/unit/experiments-urls.test.ts` holds all five pieces to it, across three
claims: every setting named, the landing rewrite restoring its own scene, and
every preset surviving its own address with nothing left to the defaults. It is
written across the pieces rather than in each piece's own file, because the
per-piece version is exactly what already existed and did not hold.

## Considered Options

**Separate the primary from the baseline instead.** The narrow reading of #128:
give Starry Night a first preset whose values differ from its defaults, and the
diff stops being empty. Rejected as a fix, though it may still be worth doing on
its own merits. It repairs one piece by coincidence rather than the mechanism —
the next piece whose primary happens to equal its defaults has the bug back — and
it makes a scene choice, which is a visual decision, do the work of a structural
one. It is also strictly weaker: it leaves every other shared link still resting
on defaults that can move.

**Full state on landing, diffs everywhere else.** Rewrite only the bare landing
address in full and leave the chrome writing differences as the visitor drags.
Rejected: the drift hazard is identical in both cases, and the visitor would
watch the address collapse from four hundred characters to twenty on the first
slider drag. Two encodings for one thing, differing in the case nobody can see.

## Consequences

**URLs are long.** Flotsam has twenty-nine settings, so its addresses run to
around four hundred characters where they used to be a couple of dozen. This is
the whole cost of the decision and it is the thing a future reader will want to
undo on sight. It is worth saying plainly: the previous form was shorter, and it
was a link that meant something different next month.

The readability argument is not wrong, it is outranked. A short link nobody can
rely on is not serving the purpose links are here for.

**`DEFAULT_SETTINGS` gets safer to move**, which is the compensating gain and was
not the motivation. The rule that it should move only when the meaning of a
control moves was load-bearing for every shared link; now it is load-bearing only
for addresses that named nothing.

**Two things this deliberately does not change.** `settingsFromQuery` still
treats absent, blank and unparseable alike and falls back to the defaults, so
every link written under the old form keeps working. And the section's position
that a piece under exploration owes its URLs nothing —
`20260829-a-piece-under-exploration-owes-its-urls-nothing.md` — is untouched:
this is about a link not changing meaning underneath someone, not a promise to
preserve any particular scene.
