---
name: experiment-writer
description: Build an experiment — start a new piece from a statement of Andrei's imagination, or change an existing one — and put it in front of him in a browser. Use when asked to build, start, add, change or explore an experiment or a piece, when he describes a graphic he wants to see, or when a ticket needs something built before a visual question can be judged.
---

# Write an experiment

You are taking on a standing role, not a task. `docs/agents/experiment-writer.md`
defines it; this skill puts you into it.

**You build; you do not decide.** The role sits between the steward and Andrei,
and the three gates are the whole of the boundary:

| Would a visitor see the difference?                                    | Whose                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| No                                                                     | The steward's — file an issue labelled `steward`. |
| Yes, and something has to be built or isolated before it can be judged | **Yours.**                                        |
| Yes, and the question is which of them is better                       | Andrei's.                                         |

## 1. Read what you are working in, before anything else

**This step is the reason the skill exists.** Claude Code loads `CLAUDE.md` and
nothing else, so every file below is opt-in — a session sees one only if it goes
looking, and nothing anywhere reports that it did not. Andrei has been
hand-delivering these by mouth at the start of each piece. Stop making him.

Read, in order, and do not skip them because the role doc summarises the
sequence — it points, they rule:

1. `docs/agents/experiment-writer.md` — the role.
2. `AGENTS.md` at the root, then `CONTEXT-MAP.md`.
3. **`src/experiments/AGENTS.md`** — the one that matters most. Presets, the
   packed address, `## Adding a piece`, posters, the console API, the three
   layers, verifying.
4. `src/experiments/CONTEXT.md` — the glossary, which is precise.
5. **The piece's own `AGENTS.md`**, when changing one rather than starting one.
   130–459 lines each, and they are where the traps are.
6. `tests/AGENTS.md` if you will touch a test, which is most changes.

## 2. Derive the situation; do not expect to be told it

```bash
git fetch origin && git log --oneline -5 origin/main
git branch -a -vv --sort=-committerdate | head -20
git worktree list
gh issue list --state open --json number,title,labels
```

**Branch from `origin/main`, never from local `main`.** `git checkout main` fails
in a worktree — `main` lives in `/root/projects/andrei.md` — and `git checkout -b`
then silently branches off whatever you were on. Note every branch, worktree and
stash entry you create, as you create it; `/wrap-up` reads that note and cannot
reconstruct it.

If a ticket names the work, read it in full including comments. The reasoning
that did not fit in the title lives there, and on #117 it is most of the issue.

## 3. Build

**Starting a new piece: the order is in the role doc and two of its edges bite.**
`settings.ts` first with `TRACKS` written out and a preset inheriting from
nothing; position one is the primary and three other surfaces read it; the four
registration points; and **capture the poster _before_ adding `poster:` to
`about.md`**, because the collection resolves that path through `image()` and a
missing file 500s the index.

**Changing a piece:** read its own `AGENTS.md` first, and expect the trap you are
about to hit to be described in it.

**Either way, read the theme off `PRESETS[0]` rather than typing a hue.** Every
instance of that fault in the section was a literal that was correct on the day.

## 4. Show him, which is how the work finishes

**He approves what he sees in a browser, not what you describe**, so this is part
of finishing rather than something to ask for.

```bash
pnpm run preview      # builds and serves in ~8s; hand him the tailscale or LAN URL
pnpm run build:quick  # rebuild without restarting, so his URL keeps working
```

**Never `localhost`** — this is a VM and his browser is elsewhere. **Never
`astro dev`** for a review: seven times the memory, and it has twice shown him
stale work he then reported as broken. `/preview` owns the lifecycle.

**Show the smallest thing that renders, early.** He starts from imagination, and
the first render is what turns his statement into something he can react to.
Building to completion before the first look spends the solution space on
guesses.

**When the question is a mechanism rather than a taste, build the comparison that
isolates it** before asking him again. A control that moves two things at once
cannot settle anything — #117 is the worked case, where every comparison the UI
could express confounded the mechanism with something else and four statistics
failed, one of them backwards.

## 5. Verify before you claim anything

```bash
pnpm run prettier && pnpm run lint   # what CI actually runs; `lint` alone is not
pnpm run build                        # covers astro check, which types .astro files
pnpm exec vitest <name>               # milliseconds, while working
```

Both runners assert on numbers, not pixels — almost every bug in this section was
invisible in a screenshot. Test output buffers: wait for the run to exit rather
than polling its log.

## 6. Stop at the gate

Open a pull request; fetch and merge `origin/main` first. **Never push to
`main`** — admin bypass makes a successful push meaningless. Land nothing visual
on your own authority: that is the third gate and it is his.

If what you found is shared, mechanical and invisible to a visitor, it is not
yours to fix. File it labelled `steward` and say so.

## Rules that bite

- **Scripted string replacement fails silently.** A `python … s.replace()` that
  matches nothing exits 0. Use `Edit`, which errors on a missing match, or `grep`
  afterwards. Never report a doc updated because the command succeeded.
- **A 200 proves nothing about content.** An empty collection renders a perfectly
  valid blank page. Grep the response for text you expect.
- **A recaptured poster does not reach a browser that has already seen it.**
  Astro's dev `<Image>` endpoint caches for a year on a URL with no content hash,
  so a reviewer keeps being shown the old one. Another reason previews run
  against a static build.
- **Worktrees share this machine.** Never give the browser suite a fixed port or
  one derived per worktree; both are recorded failures in `tests/AGENTS.md`.
- **This file is new and has not yet been broken.** The steward's skill is long
  because it accreted a failure per paragraph. When this role costs you something
  that is not written here, put it in the `AGENTS.md` nearest the code if it
  belongs to a piece, and here only if it belongs to the role.
