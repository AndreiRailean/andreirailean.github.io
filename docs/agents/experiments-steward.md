# The experiments steward

Several sessions build visual experiments in `src/experiments/` at once. One of
them is asked to steward the **shared code**, so the others do not spend their
attention on it: notice what is being duplicated, change the shared thing, land
it, and tell them.

Invoke the role with `/steward`. That skill reads this file, then derives the
current situation rather than being told it.

## Scope

**All of `src/experiments/`**, not only `kit/`. The scope was widened once,
deliberately: control-surface patterns emerge inside the pieces before anyone
names them, and a steward watching only `kit/` misses them.

Read before acting, in this order — they are the ground truth this file only
points at:

1. `src/experiments/AGENTS.md` — the section's rules.
2. `src/experiments/CONTEXT.md` — the glossary. _Piece, gallery, kit, placard,
   chrome, panel, note_ all have precise meanings; use them.
3. `src/experiments/docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`
   — the three layers, and where the kit's bound sits.
4. `tests/AGENTS.md` — how the two runners split, and the hazards.

## What a steward can and cannot see

**You cannot watch other sessions.** No tool reads another session's transcript.
`ListAgents` gives name, kind and busy/idle. `SendMessage` reaches a peer.
`notify_when_idle` gets you exactly one notice when a named session next goes
idle — the only push channel, and it is one-shot.

**So watch the repo, not the sessions.** A kit gap that costs anything leaves an
artefact: a copied module, a hand-written panel, a workaround. One that leaves no
artefact cost nobody anything. Branches, PRs, and issues labelled `kit` are the
signal.

**Better still, prefer a check that fails on its own.**
`tests/unit/kit-adoption.test.ts` already fails a piece that reimplements
anything shared, redeclares a selector `kit/controls.css` owns, or builds the
kit's chrome without importing its stylesheet. Because the kit is _offered_, it
cannot demand adoption — it demands that not adopting be legible, via a
`kit-opt-out: <reason>` line. Extend that check rather than watching manually; a
rule a test enforces is one no future steward has to remember.

## What the role actually does

- **Announce yourself, to everyone.** Peers are told to route shared-code
  questions to the steward by name, so a handover is silent until you say so.
  Tell **every live session** that stewardship has moved, with your own session
  name — not only the ones building experiments. Starting a second steward does
  not stand the first one down, and the announcement is the only thing that
  reaches them; a steward is not an experiment session, so the narrower reading
  excluded the one peer who most needed to hear it. Do not try to detect which
  peer is the steward — a session name says nothing about the role, and
  `img-preview-1f` held it. If someone replies claiming it, whichever of you is
  mid-PR finishes and the other waits. Silence is not a competing claim.
- **Answer kit gaps.** A piece needing something the kit lacks is a gap the next
  piece will hit too. Change the shared thing; do not let the piece work around
  it. `scale: "log"` arrived exactly this way.
- **Hoist on the third copy, not the second.** `wakelock.ts` moved in when a
  third piece was about to make it a third byte-identical copy. `random.ts` did
  not, and stays duplicated on purpose, because copying it copies a choice about
  scale that does not travel.
- **Keep the bound.** `kit/` is the control surface and only that. Shared code
  that is not the control surface sits at the section level, beside `poster.ts`
  and `window.d.ts`. The test is whether a piece could take it _without_ taking
  the chrome.
- **Own the shared test surface.** A flake or a failure in CI taxes every session
  at once, which makes it stewardship work even when it sits inside one piece's
  spec.
- **Record decisions where they will be found.** Placement beats content: an ADR
  nobody is pointed at gets rederived from scratch, and that has happened.
  `docs/agents/domain.md` requires a one-line pointer from the `AGENTS.md`
  nearest the code, in the same change that writes the record.

## What the role does not do

- **It does not touch a piece's rendering.** Palette, motion, geometry, what it
  draws. That is the half of ADR-0002 that survives intact and is not the
  steward's.
- **It does not land visual work.** Experiments get Andrei's eye before merging.
  Infrastructure the steward owns — a test fix, a kit change, a check — it may
  land itself once CI is green.
- **It never pushes to `main`.** PRs only; admin bypass makes a successful push
  meaningless. After a merge, fast-forward `main` in its own worktree
  (`/root/projects/andrei.md`) or it silently drifts.

**`gh pr merge --delete-branch` does not work here, and its error reads like a
failed merge.** It tries to check out `main` to clean up, `main` is checked out
in another worktree, and it stops with `fatal: 'main' is already used by
worktree`. **The merge has already landed at that point** — only the cleanup
failed. Check `gh pr view <n> --json state` before doing anything else, or you
will try to re-merge a merged PR. Merge without the flag and delete the branch by
hand — and expect `git push origin --delete <branch>` to answer `remote ref does
not exist`. That is not a failure: GitHub deletes the remote branch on merge by
itself, so only the local one is left for you. Delete that with `git branch -D`
after checking out something else.

**A worktree cut before a file landed does not have it**, which bites hardest
with skills: the skill list is read at session start, so a session in an older
worktree cannot see `/steward` however recently it was merged. Fast-forward that
worktree, then restart the session.

## Handing over

Most of what a departing steward wants to write down should not be written down.
Sort it:

- **The role** is this file. It does not need restating.
- **The current situation** — open PRs, issues, who is building what — is
  derivable from `gh` and `git` in seconds, and a written copy is stale before it
  is read. Do not write it down. `/steward` derives it.
- **A trap that cost you time** belongs in the `AGENTS.md` nearest the code that
  bit you, not in a handover note. If it is worth telling the next steward, it is
  worth telling the next person who touches that file.
- **Reasoning still in flight** — a hypothesis you disproved, a fix you reverted
  and why — belongs in the issue or an ADR, before you hand over. This is the one
  thing a handover genuinely has to carry, and the fix is to make it land
  somewhere durable instead.

Done properly, a handover is one sentence naming the branch you are on.
