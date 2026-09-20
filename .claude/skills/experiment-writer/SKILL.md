---
name: experiment-writer
description: Build an experiment — start a new piece from a statement of Andrei's imagination, or change an existing one — working unattended and never blocking on questions, until there is something running he can interact with. Use when asked to build, start, add, change or explore an experiment or a piece, when he describes a graphic he wants to see, or when a ticket needs something built before a visual question can be judged.
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

## 0. The bias, which decides what you do next at every point

**All of Andrei's feedback follows interaction with the work in progress.** He
drags a slider and tells you what he sees. He does not review a description, a
plan or a still.

**So the first goal is not a correct piece. It is an interactable one**, however
thin — a page that boots, one mark, a panel with two settings that move. Until
that exists and he has touched it, nothing else you could write is the most
valuable next thing.

- **Do not write a second module before the first is on screen.** The failure
  this stops is bottom-up construction, which is the natural instinct rather than
  a careless one: model the bodies, then the forces, then the camera, and wire up
  a page once the simulation is worth looking at. Observed on `crowd`, which had
  this file and did it anyway — `body.ts`, `camera.ts`, `steering.ts` first and
  `settings.ts` fourth, and at sixteen minutes no route, no panel, no preview
  server, nothing to look at. **Not a size problem**: embers' `settings.ts` was
  31,689 bytes in its own first commit. Only the order was wrong.
- **The panel ships with the first render**, not after. A piece with no chrome
  cannot be interacted with, so it cannot be reviewed. `CONTROLS` in
  `settings.ts` generates it, so two settings are enough.
- **Write no spec and no plan document for a piece.** A general-purpose process
  skill will tell you to explore, ask, propose options and get a design approved
  before implementing. For an experiment here that order is wrong, and repo
  conventions take precedence over a skill's default workflow. The artefact _is_
  the design conversation: he cannot tell you whether a crowd reads as a shoal or
  a queue until he is watching one move. Measured once —
  `docs/superpowers/specs/2026-08-24-dangler-design.md` is 342 lines, and the
  first commit that drew anything came 52 minutes after it.
- **Ask him questions through the work, not before it.** A question you could
  have answered with ten minutes and a slider is not worth his attention.

**Assume he is not watching, always. There is no other mode.** He gives one
instruction and goes, and he should never have to announce that. **So never
block** — not for approval, not for a preference, not for "which did you mean".
A session waiting on an answer he was never going to give wastes the entire
night, which is the worst outcome available here.

**After the gate: widen, do not commit.** Prefer whatever enlarges what he can
explore — another preset, a wider range, a setting where you had a constant —
over anything that settles a question. A widening helps whichever way he steers;
a commitment is a coin-flip that costs a night when it loses. **Reaching the
gate is not a reason to idle**; it is where widening starts.

**Nothing is pushed and no PR is opened until he asks.** A piece stays local
however green the suite is; what he opens is the running URL, and a push adds
nothing to it. Commit locally and freely. **Experiments only** — steward work
and infrastructure still go to a PR normally. Step 6 has the reasoning.

**Not blocking is not the same as not stopping.** You are expected to stop —
just not at the first hurdle. There is almost always a body of work that does
not need him: the gate, then the widening. Do that, and **when it runs out, stop
properly** — piece running and URL handed over, unanswered questions written
into `seed.md`, PR open, `/wrap-up` run. Grinding past the useful point is its
own failure. The judgement is "is this still useful", not "am I allowed to
continue".

**Write `src/experiments/<slug>/seed.md` before any code**, with his instruction
verbatim, and append each round of his feedback as it arrives. His transcript
dies with the session and the prose exists nowhere else. Verbatim, not
summarised: `CONTEXT.md` records that the section's aim, _organic change_, was
"named by the pieces' author across four of them", so his words are the primary
source rather than raw material for a tidier sentence. Questions you could not
answer go here too — not into a message to him.

**Two modes, and the gate differs.** _Starting_: nothing renders, so the gate is
literal — on screen with a panel, and step 3 below is for this case. _Amending_:
it already renders, so skip the route, the poster, `about.md` and the
registration points, and the gate becomes **make the change drivable and
comparable** — behind a control, or a preset per option, so the difference can
be moved rather than described. When amending, the piece's own `AGENTS.md` and
`seed.md` are both mandatory and come first.

## 1. Read what the step you are on needs — not all of it

**Delivery is the reason this skill exists.** Claude Code loads `CLAUDE.md` and
nothing else, so every file below is opt-in — a session sees one only if it goes
looking, and nothing anywhere reports that it did not. Andrei has been
hand-delivering these by mouth at the start of each piece. Stop making him.

**But reading is not building, and this content runs to about 100KB.** Reading
all of it before writing anything costs the first interactable build its whole
head start, which section 0 says is the thing that matters. So stage it.

**Before the first interactable build**, which is all you need to get there:

1. `docs/agents/experiment-writer.md` — the role.
2. **`src/experiments/AGENTS.md`**: the `## Presets` section, `## Adding a piece`
   and the layout block at the top. Those cover `settings.ts`, the primary, what
   registers a slug, and what must never land in `src/pages/`.

**Then, as you reach each area**, and before changing anything already decided:

3. The rest of `src/experiments/AGENTS.md` — the packed address, posters, the
   console API, the three layers, verifying.
4. `src/experiments/CONTEXT.md` — the glossary, which is precise.
5. **The piece's own `AGENTS.md`**, when changing one rather than starting one.
   130–459 lines each, they are where the traps are, and this one is **not**
   deferrable: it is what stops you rediscovering a trap the hard way.
6. `AGENTS.md` at the root and `CONTEXT-MAP.md` for anything outside the section;
   `tests/AGENTS.md` when you touch a test.

It points, they rule.

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

## 3. Build to the gate first, then past it

**Everything up to the gate, in this order** — nothing here is optional and
nothing below it starts until he has driven the result:

0. `src/experiments/<slug>/seed.md` — his instruction verbatim, before any code.
1. `src/experiments/<slug>/settings.ts` — `TRACKS` written out, `BOUNDS` narrowed
   from it, a preset stating every setting and inheriting from nothing. Position
   one is the primary; three other surfaces read it.
2. Something that draws. **How much goes in one file is not the rule** — the
   rule is that **no second module is written before a route renders the
   first**. A whole simulation in one file and then a route is fine; two
   modules and no page is the failure `crowd` demonstrated. Do not write a
   throwaway stub that draws a circle in order to obey a word count.
3. `src/pages/experiments/<slug>/index.astro` — markup, a `<style>` block and
   `import { boot } from "@/experiments/<slug>/page"`. No logic in the `.astro`.
4. The kit's panel, from `CONTROLS`.
5. **Numbers before the first screenshot** — see below. Then go to step 4 and
   hand over the URL.

**Measure before you look, every time.** This is not a fallback for when he is
away; it is how you find out whether the piece does what you think, and it goes
before the first screenshot rather than after. Dump `stats()` and check that
**each mechanism actually fired** — not that the page rendered.

`bubbles` caught two faults this way that no still would have shown: the frame
was 3m wide so a 6mm bubble came out 1.3px with 0.5% of the screen lit, and
`biggest` plateaued at 14mm against a `popSize` of 50mm, meaning **one of the
piece's three mechanisms never ran at all** and the picture gave no sign of it.
A screenshot of that scene looks like a reasonable piece. `src/experiments/AGENTS.md`
already says almost every bug in this section was invisible in a screenshot;
this is that rule applied at minute thirty rather than at review.

**Then, after he has interacted with it:** the about page reading its theme off
`PRESETS[0]`, `about.md` without its `poster:` line, the four registration points
(`SLUGS`, `PIECES`, `EXPECTED`, `NOTES`), **the piece's own `AGENTS.md`** holding
the traps this build cost you, and **capture the poster _before_ adding
`poster:` to `about.md`** — the collection resolves that path through `image()`
and a missing file 500s the index.

**Changing a piece:** read its own `AGENTS.md` first, and expect the trap you are
about to hit to be described in it.

**Either way, read the theme off `PRESETS[0]` rather than typing a hue.** Every
instance of that fault in the section was a literal that was correct on the day.

## 4. Hand over the URL, immediately and on its own

**He approves what he sees in a browser, not what you describe**, so this is part
of the work rather than something to ask permission for.

**Send the address the moment the piece is interactable — do not wait for the
suite, and do not bundle it with a test result.** A session said "I'll push and
give you the URL once the suite reports" and both halves of that were wrong:
the URL sat behind a three-minute run for no reason, and the push was not
wanted. The URL is the deliverable and goes out now; verification is a separate
claim reported separately when it exists. If the suite later goes red, say so —
a piece under exploration is expected to be rough.

```bash
pnpm run preview      # builds and serves in ~8s; hand him the tailscale or LAN URL
pnpm run build:quick  # rebuild without restarting, so his URL keeps working
```

**Never `localhost`** — this is a VM and his browser is elsewhere. **Never
`astro dev`** for a review: seven times the memory, and it has twice shown him
stale work he then reported as broken. `/preview` owns the lifecycle.

**Show the smallest thing he can drive, early.** He starts from imagination, and
the first interactable build is what turns his statement into something he can
react to. Building to completion before the first look spends the solution space
on guesses.

**A build he cannot drive returns an impression; one he can returns a setting, a
number and a direction.** That is the practical reason the panel is not a
finishing step, and why "it renders" is not the gate.

**If he has stepped away** — "something I can interact with in the morning" is a
real brief and has happened — the gate does not relax, it becomes the
deliverable. Build to interactable, leave it running, then substitute
measurement for the glance: assert on numbers, prefer choices that are cheap to
reverse over choices that are merely good, skip polish, and leave open questions
as extra presets rather than as a paragraph. `docs/agents/experiment-writer.md`
has the reasoning under _When he is not there_.

**When the question is a mechanism rather than a taste, build the comparison that
isolates it** before asking him again. A control that moves two things at once
cannot settle anything — #117 is the worked case, where every comparison the UI
could express confounded the mechanism with something else and four statistics
failed, one of them backwards.

## 5. Verify before you claim anything

```bash
pnpm exec astro check                # run this after every edit — seconds, not minutes
pnpm run prettier && pnpm run lint   # what CI actually runs; `lint` alone is not
pnpm exec vitest <name>              # milliseconds, while working
pnpm run build                       # the full thing, including astro check
```

**`pnpm exec astro check` is the one to reach for constantly.** `pnpm test` types
nothing — vitest strips types and Playwright compiles per file — so in CI the
lint job's `astro check` is the only thing that types anything at all, and it is
the only thing that types `.astro` files. It is the cheap half of
`pnpm run build` and takes seconds. `tests/AGENTS.md` says to run it before
pushing; run it far more often than that. The failure mode is not a broken build,
it is a red pull request after you thought you were done.

Both runners assert on numbers, not pixels — almost every bug in this section was
invisible in a screenshot. Test output buffers: wait for the run to exit rather
than polling its log.

## 6. Stay local: no push, no PR, until he asks

**A piece is not pushed to GitHub and gets no pull request until Andrei says
so.** Not when the suite is green, not when you think it is finished. He is
exploring, and a PR asks a question he is not ready to answer — "we're not
ready for PRs yet" is his own phrasing.

This is scoped to **experiments only**. Steward work, a check, a build script
or a doc fix still goes to a PR the normal way; it is a piece under exploration
that stays local.

**Commit locally, often, and do not push.** Local commits cost nothing and
protect everything: `docs/agents/steward.md` already prefers "commit early
rather than push early", and a worktree's commits are visible to every other
worktree through the shared object store, so nothing is at risk by staying off
the remote. Uncommitted work, by contrast, is invisible to everything and dies
with the session.

**The delivery is the running URL, not a branch.** That is what he opens, and
it is already live on this machine. A push adds nothing he wanted.

**When the work that does not need him runs out, stop.** Hand over the URL,
put the open questions in `seed.md`, commit, run `/wrap-up`, and say the branch
is local and unpushed. A finished night ends deliberately; it does not trail
off into widening nobody wanted, and it does not sit idle waiting for a reply.

**Never push to `main`, ever** — admin bypass makes a successful push
meaningless. And land nothing visual on your own authority even once he does
ask for a PR: that is the third gate and it stays his.

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
