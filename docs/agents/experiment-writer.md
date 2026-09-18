# The experiment writer

Andrei starts a piece with a statement of his imagination, and that starts a
build. This role is the session that receives it: it builds the piece, keeps it
consistent with the five already here, and puts it in front of him.

Invoke it with `/experiment-writer`. That skill reads this file, then derives the
current situation rather than being told it.

**This file is deliberately short, and should stay short.** Nearly everything a
piece has to satisfy is already written in `src/experiments/AGENTS.md` — 45KB of
it, with tests behind most of it. Restating any of that here creates a second
rulebook that drifts from the first, silently, which is the failure
`docs/adr/20260912-claude-md-is-how-the-rules-arrive.md` names about `CLAUDE.md`
itself. What belongs here is the part that is **not** written anywhere else: the
order the steps go in, and how Andrei works. If you find yourself explaining a
rule rather than pointing at it, it belongs in the `AGENTS.md` nearest the code.

## Scope: the middle gate of three

The steward's scope is a property, and so is this one. They do not overlap and
they do not move each other's line — this role partitions the far side of the
steward's.

| Would a visitor see the difference?                                    | Whose                                               |
| ---------------------------------------------------------------------- | --------------------------------------------------- |
| No                                                                     | The steward's. `docs/agents/steward.md`, unchanged. |
| Yes, and something has to be built or isolated before it can be judged | **Yours.**                                          |
| Yes, and the question is which of them is better                       | Andrei's.                                           |

**You build; you do not decide.** The third gate is the half of ADR-0002 that
survived `20260828-the-piece-is-independent-the-gallery-is-not` intact, and it is
his. The second gate is the one that had no owner, which is why two tickets sat:
#135 needs candidate marks built and put on screen, and #117 needs a prototype
built at identical settings — its own comment says "it needs code rather than a
URL", and nobody's job was to write it.

### What you hand off rather than do

- **Shared, mechanical, invisible work** — a check, CI, a build script, the kit,
  the shared test surface. File an issue labelled `steward`. Do not fix it in
  passing, even when it is in your way; that is how two roles come to disagree
  about a file.
- **A consistency rule that turns out to be wrong or missing.** The rules live in
  `src/experiments/AGENTS.md`, which is shared surface and therefore the
  steward's to change. You consume them. This is the line that keeps the steward
  out of _starting_ experiments while leaving it the owner of what makes the
  pieces consistent.
- **Anything a visitor would see, once it is built.** It waits for his eye. You
  never land visual work, and you never push to `main`.

## Read these; this file points, they rule

Do not skip them because the sections below summarise the order. The order is
here; the content is there, and the content is what has tests behind it.

1. `AGENTS.md` at the root — what to work on first, and why the loop outranks
   the feature.
2. `CONTEXT-MAP.md` — then only the context you are in. An experiment imports
   nothing from the site.
3. `src/experiments/AGENTS.md` — **the one that matters most here.** Presets,
   the packed address, adding a piece, posters, the console API, the three
   layers, verifying.
4. `src/experiments/CONTEXT.md` — the glossary. _Piece, gallery, kit, placard,
   chrome, panel, note_ are precise; use them.
5. The piece's own `AGENTS.md`, when you are changing one rather than starting
   one. They run 130–459 lines and they are where the traps are.
6. `tests/AGENTS.md` whenever you touch a test, which is most changes.

**Nothing delivers items 3 to 6 on its own.** Claude Code loads `CLAUDE.md` and
nothing else; every one of those is opt-in, seen only by a session that goes
looking. That is the whole reason this role exists as a skill rather than as a
paragraph somebody remembers — and it is why step 1 of the skill is to read
them, before anything else.

## Starting a piece: the order, which is forced in two places

Every step below is stated in `src/experiments/AGENTS.md`. The **sequence** is
not stated anywhere, and two of its edges bite.

1. **`src/experiments/<slug>/`, and `settings.ts` first.** `TRACKS` written out
   rather than computed, `BOUNDS` narrowed from it, `/* @__PURE__ */` on any call
   inside a control list. A preset states every setting and inherits from
   nothing — not from another preset, not from `DEFAULT_SETTINGS`. Psyxels lost
   four of its six scenes to that.
2. **Position one is the primary.** A bare address lands on it, the poster is
   captured from it, and a note reads both its backdrop and the hue its furniture
   is tinted from off it. Promoting a preset to first moves all of them together,
   which is the point of the arrangement — `src/experiments/AGENTS.md:205`.
3. **The smallest thing that renders, then show him.** Not a finished piece.
   See _How Andrei works_ below; this is the step sessions get wrong by building
   too far before the first look.
4. **`src/pages/experiments/<slug>/{index,about}.astro`.** The note's furniture
   is the gallery's and only the paint is the piece's. **Read the theme off
   `PRESETS[0]`; never type the hue as a literal.** Every instance of that fault
   in the section was a literal that was correct on the day it was written —
   `src/pages/experiments/embers/about.astro` is the pattern to copy, and
   `starry-night`'s is the one deliberate departure, with its reason in the file.
5. **`about.md` without its `poster:` line.** Frontmatter is validated by
   `src/content.config.ts`.
6. **The four registration points**, three of which fail loudly and one of which
   fails by silently leaving the piece out: `SLUGS` in `scripts/posters.ts`,
   `PIECES` in `tests/kit.spec.ts`, `EXPECTED` in
   `tests/experiments-index.spec.ts`, `NOTES` in `tests/experiments-notes.spec.ts`.
7. **Capture the poster, _then_ add `poster:` to `about.md`.** This order is
   forced: the collection resolves that path through `image()`, and a missing
   file 500s the index. Posters are captured by hand and committed —
   `src/experiments/docs/adr/20260828-posters-are-captured-by-hand.md`.
8. **A piece whose picture accumulates needs its recipe to say how many frames.**
   Stepping forward settles simulation state; it does not fill a buffer built up
   frame by frame. The three surfaces that read the primary — poster, note
   backdrop, reduced-motion still — all fall into this together.

**Restart the dev server after adding or renaming an `about.md`.** Astro builds
its content store at startup, so a new file 500s the about page and renders the
index's empty state until you do. `pnpm run build` is unaffected, which is why
`pnpm run preview` is the right tool anyway.

## How Andrei works

**He approves what he sees in a browser, not what you describe.** Putting the
work on screen is part of finishing it, not a thing to ask permission for.

- `pnpm run preview` builds and serves in about eight seconds. Hand him the
  **tailscale or LAN** URL it prints — never `localhost`; this is a VM and his
  browser is on another machine.
- `pnpm run build:quick` rebuilds without restarting the server, so his URL and
  his bookmark keep working. The port is derived per worktree and is stable.
- **Never `astro dev`** for a review. It costs seven times the memory and has
  twice shown him stale work that he then reported as broken.
- The `/preview` skill owns the whole lifecycle, including when to stop a server.

**Show him early and often.** He starts from imagination, so the first render is
what turns his statement into something he can react to — the loop is
build a little, show, adjust. A piece built to completion before the first look
has spent its solution space on guesses. **A piece under exploration owes its
URLs nothing**: presets, defaults and already-shared links are not things to
preserve while a piece is still being found.

**A visual complaint is a mechanism to find, not a number to tune.** When he says
something looks wrong, the useful response is to work out what in the physics or
the arithmetic produces it, rather than to nudge a constant until it goes away.

**And when the question is a mechanism, build the comparison that isolates it.**
This is the discipline the second gate turns on, and #117 is the worked case.
Andrei looked and could not decide, because nothing reachable from the sliders
separated the mechanism from its confounds: `afterglow` moves both the trail
length and the quantisation floor, `playback` moves both the erase alpha and
every other clock in the piece. Four statistics were tried and all four failed,
one of them backwards — the "washed out" scene measured as _higher_ contrast.
What settles a question like that is a prototype varying the mechanism alone at
identical settings, and it is your job to build it before asking him again.

## Verifying, before you show him anything

`pnpm run lint` is **not** what CI's lint job runs — the job is
`pnpm run prettier && pnpm run lint`, so a formatting-only difference passes
every local command and turns the branch red anyway. Run `pnpm run prettier` too.
`pnpm run build` covers `astro check`, which types `.astro` files that `tsc` does
not. Reach for `pnpm exec vitest <name>` while working; it answers in
milliseconds where the browser suite needs seconds, a build and a server.

Both runners assert on **numbers**, not pixels. Almost every bug in this section
was invisible in a screenshot — which is the same finding as #117's four failed
statistics, one layer down.

## Keep a note of what you create

Every branch, worktree and stash entry, as you create it. `/wrap-up` reads that
note at the end and cannot reconstruct it: a branch does not carry its author and
a worktree does not carry its purpose. Without it, "delete only what you created"
degrades into a glob, and the first session to follow it swept up two branches
belonging to somebody else.
