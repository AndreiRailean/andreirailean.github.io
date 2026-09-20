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
bias toward something interactable, the order the steps go in, and how Andrei
works. If you find yourself explaining a rule rather than pointing at it, it
belongs in the `AGENTS.md` nearest the code.

**When you edit this file, hand over the next keystroke rather than a
prohibition.** That is the one thing here with evidence behind it as a writing
rule, and it came from a session reporting why a rule held: the no-spec rule
never felt like a restriction to obey, because the text immediately supplies
the artefact's file order — `settings.ts` first, `TRACKS`, `BOUNDS`, a preset —
which is concrete enough to start typing. _"A prohibition alone would not have
done that; the substitute is what made it stick."_ Two rules here that lost to
a stronger instinct were both bare prohibitions with nothing offered in their
place.

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

**And a piece stays local until he asks for it.** No push to GitHub, no pull
request, however green the suite is — "we're not ready for PRs yet" is his own
phrasing, and a PR on a piece he is still exploring asks a question he has not
reached. Commit locally as much as you like; what he opens is the running URL,
and a push adds nothing to that. **Experiments only** — steward work, a check,
a build script or a doc fix still goes to a PR the normal way.

## The bias: build something he can touch, before anything else

**All of Andrei's feedback follows interaction with the work in progress.** He
does not review a description, a plan, or a still. He drags a slider and tells
you what he sees. So the thing that unblocks him is not a correct piece — it is
an _interactable_ one, however thin.

**This is a gate, not a preference.** Until the piece renders in a browser and
its controls move, nothing else you could write is the most valuable next thing.

- **Do not write a second module before a route renders the first.** A piece
  reduced to its simplest honest form — one mark, one slider, a page that boots —
  is worth more at minute ten than a correct simulation nobody has seen. **The
  constraint is the route, not the file size**: one large module followed by a
  page is fine, and writing a throwaway stub to look minimal is not what this
  asks for.
- **The panel is part of the first build, not a finishing step.** A piece with no
  chrome cannot be interacted with, so it cannot be reviewed. Build the kit's
  controls in with the first render, even over two settings.
- **`settings.ts` first is what makes that possible**, which is why it heads the
  order below: the panel is generated from `CONTROLS`, so a piece with settings
  has a panel almost for free and a piece without one has nothing to drag.

**The failure this exists to stop is bottom-up construction**, and it is the
natural instinct rather than a careless one: model the bodies, then the forces,
then the camera, and wire up a page once the simulation is worth looking at.

Observed on `crowd`, which had this file's first version and did it anyway:
`body.ts`, `camera.ts` and `steering.ts` were written first and `settings.ts`
fourth, and at twenty-two minutes there was still no route, no panel, no preview
server and nothing anyone could look at.

**And that session was working unattended** — Andrei invoked it, asked for
something to interact with in the morning, and stepped away. That is what makes
it evidence rather than an anecdote about one session being hasty. The gate was
the literal deliverable, nobody was waiting to be shown anything, and the build
_still_ went bottom-up. An instruction that loses under those conditions is not
an instruction that was ignored; it is one that was too weak, which is why it is
a stopping condition here and not a bullet in a list.

**The sizes were not the problem and neither was the care taken** — embers'
`settings.ts` was 31,689 bytes in its own first commit, larger than crowd's at
this point. Only the order was wrong. Do not read this as an argument for writing
less; read it as an argument for writing the renderable part first.

**The counter-instinct to hold, in the session's own words: _the part that
feels trivial is the part that is the gate._** It explained afterwards why it
went bottom-up, and the reason is not carelessness — the brief was rich in
physics, the physics felt like the risky part, and **the route felt trivial, so
it got deferred as the thing that could be done any time.** That reasoning is
correct about difficulty and exactly backwards about order. Whatever in the
brief feels hardest is what most needs something on screen to test it against,
and the boring page is what makes testing possible.

### This outranks a design-first process, deliberately

A general-purpose process skill will tell you to explore, ask, propose options,
write a design document and get it approved before implementing. **For an
experiment in this repo, that order is wrong**, and `AGENTS.md` at the root
permits saying so: user instructions and repo conventions take precedence over a
skill's default workflow.

The reason is that **the artefact _is_ the design conversation here.** Andrei
starts from imagination, not from a specification, and he cannot tell you whether
a crowd should read as a shoal or a queue until he is looking at one moving. A
spec extracts decisions from him that he makes better and faster by dragging a
handle.

It has been measured once. `docs/superpowers/specs/2026-08-24-dangler-design.md`
is 342 lines, committed at 12:47; dangler's first code landed at 13:16 and the
first commit that actually **drew** anything at 13:39 — 52 minutes in which there
was nothing to react to. Every piece since has skipped the document, and embers,
the newest, has none at all. So write no spec and no plan document for a piece;
build the smallest interactable thing and show it.

**Ask him questions through the work, not before it.** A question you cannot
answer by building is worth asking; a question you could have answered with ten
minutes and a slider is not, and asking it spends his attention on something he
was going to tell you by looking.

## Read these — but stage it, because reading is not building

The content that governs a piece runs to about 100KB and reading all of it before
writing anything costs the first render its whole head start. **Read what the
step you are on actually needs**, and read the rest when you reach the area it
covers.

**Before the first interactable build**, which is all you need to get there:

1. This file.
2. `src/experiments/AGENTS.md` — the `## Presets` section and `## Adding a
piece`. Those two cover `settings.ts`, the primary, and what registers a slug.
3. The layout block at the top of that file, so nothing lands in the wrong place.

**Then, as you touch each area** — and before changing anything the section
already decided:

4. The rest of `src/experiments/AGENTS.md`: the packed address, posters, the
   console API, the three layers, verifying.
5. `src/experiments/CONTEXT.md` — the glossary. _Piece, gallery, kit, placard,
   chrome, panel, note_ are precise; use them.
6. The piece's own `AGENTS.md`, when you are changing one rather than starting
   one. They run 130–459 lines and they are where the traps are — **this one is
   not deferrable**, because it is the file that stops you rediscovering a trap
   the hard way.
7. `AGENTS.md` at the root and `CONTEXT-MAP.md` for anything outside the section;
   `tests/AGENTS.md` whenever you touch a test.

This file points, they rule. The order is here; the content is there, and the
content is what has tests behind it.

**Nothing delivers any of these on its own.** Claude Code loads `CLAUDE.md` and
nothing else; every one is opt-in, seen only by a session that goes looking. That
is why this role is a skill rather than a paragraph somebody remembers — and why
the skill's first step is to read the short list above, not all of it.

## Two modes, and the gate means something different in each

**Read this before the order below, because most of that order applies to
exactly one of the two.**

**Starting a piece.** Nothing renders yet, so the gate is literal: get it on
screen with a panel. The numbered order below is for this case and only this
case.

**Amending a piece.** It already renders and it already has chrome, so "make it
interactable" is already true and the order below is mostly noise — skip the
registration points, the poster, `about.md` and the route; they exist. **The
gate becomes: make the change drivable and comparable.** Put what you changed
behind a control, or behind a preset per option, so the difference can be moved
rather than described. A change he can only look at returns an impression; one
he can toggle returns a decision.

This is the same discipline as the second scope gate and #117 is the worked
case — a mechanism nobody can isolate cannot be judged, however visible it is.
Amending is where that bites most, because the piece looks finished and the
temptation is to land the change and describe it.

**What amending requires that starting does not:** the piece's own `AGENTS.md`
and its `seed.md`, both read in full, first. The `AGENTS.md` holds the traps and
the invariants somebody already paid for. The `seed.md` holds what he asked for
originally, which is what stops a change that improves the piece against the
wrong target. Neither is deferrable here, where when starting there is nothing
to read.

**And a change that contradicts an invariant is worth saying so out loud**,
in the commit and in `seed.md` — not quietly overriding it, which is the section
rule for ADRs and applies the same way to a piece's own notes.

## Starting a piece: the order, and where it is forced

Every step below is stated in `src/experiments/AGENTS.md`. The **sequence** is
not stated anywhere, and three of its edges are forced: the gate at step 4, the
poster before the `poster:` line at step 8, and a route before there is anything
to show.

**Before any of it: write `src/experiments/<slug>/seed.md` with his instruction
in it, verbatim.** It costs a minute, it is the only copy of the brief that will
survive this session, and everything below is easier to judge against it.

1. **`src/experiments/<slug>/`, and `settings.ts` first.** `TRACKS` written out
   rather than computed, `BOUNDS` narrowed from it, `/* @__PURE__ */` on any call
   inside a control list. A preset states every setting and inherits from
   nothing — not from another preset, not from `DEFAULT_SETTINGS`. Psyxels lost
   four of its six scenes to that.
2. **Position one is the primary.** A bare address lands on it, the poster is
   captured from it, and a note reads both its backdrop and the hue its furniture
   is tinted from off it. Promoting a preset to first moves all of them together,
   which is the point of the arrangement — `src/experiments/AGENTS.md:205`.
3. **`src/pages/experiments/<slug>/index.astro`, immediately.** Markup, a
   `<style>` block and `import { boot } from "@/experiments/<slug>/page"` — no
   logic in the `.astro`. Without a route there is nothing to look at, which is
   why this comes before the piece is any good rather than after.

   **The rule is the route, not the file count.** "No second module before the
   first is on screen" means: no second module before a route renders the
   first. How much goes in that first file is your business — a whole
   simulation in one module and then a route is fine, and a throwaway stub that
   draws a circle to satisfy a word count is not what any of this asks for.
   `crowd`'s failure was three modules and no page, which is a different thing
   from one large module.

4. **The panel, from the kit, with the first render.** `CONTROLS` in
   `settings.ts` generates it, so two settings are enough to make the piece
   draggable. **Now show him, and stop.** This is the gate: not "renders" but
   "can be interacted with", and it is the step sessions get wrong by building
   the simulation out first. Everything below waits for him to have touched it.
5. **The about page**, once the piece is worth a note.
   `src/pages/experiments/<slug>/about.astro` — the note's furniture is the
   gallery's and only the paint is the piece's. **Read the theme off
   `PRESETS[0]`; never type the hue as a literal.** Every instance of that fault
   in the section was a literal that was correct on the day it was written —
   `src/pages/experiments/embers/about.astro` is the pattern to copy, and
   `starry-night`'s is the one deliberate departure, with its reason in the file.
6. **`about.md` without its `poster:` line**, and **the piece's own
   `AGENTS.md`**, holding the traps this build cost you. The layout block in
   `src/experiments/AGENTS.md` lists that file as part of a piece, but
   `## Adding a piece` never mentions it, so it is the step most likely to be
   skipped — and it is where the next session's traps are supposed to live.
   Frontmatter is validated by `src/content.config.ts`.
7. **The four registration points**, three of which fail loudly and one of which
   fails by silently leaving the piece out: `SLUGS` in `scripts/posters.ts`,
   `PIECES` in `tests/kit.spec.ts`, `EXPECTED` in
   `tests/experiments-index.spec.ts`, `NOTES` in `tests/experiments-notes.spec.ts`.
8. **Capture the poster, _then_ add `poster:` to `about.md`.** This order is
   forced: the collection resolves that path through `image()`, and a missing
   file 500s the index. Posters are captured by hand and committed —
   `src/experiments/docs/adr/20260828-posters-are-captured-by-hand.md`.
9. **A piece whose picture accumulates needs its recipe to say how many frames.**
   Stepping forward settles simulation state; it does not fill a buffer built up
   frame by frame. The three surfaces that read the primary — poster, note
   backdrop, reduced-motion still — all fall into this together.

**Restart the dev server after adding or renaming an `about.md`.** Astro builds
its content store at startup, so a new file 500s the about page and renders the
index's empty state until you do. `pnpm run build` is unaffected, which is why
`pnpm run preview` is the right tool anyway.

## `seed.md`: the record of what he actually said

**Every piece keeps `src/experiments/<slug>/seed.md`**, holding his own words:
the seed instruction that started it, then each round of corrective feedback,
each dated and appended. You write it; he never has to.

**Write the seed in before you write any code.** It is the first file, ahead of
`settings.ts`, and the reason is the one this repo keeps rediscovering: **a
session's transcript dies with the session, and dying is the normal case.** The
prose he typed exists nowhere else — not in the code, not in the commits, not in
`about.md` — so a session that ends abruptly at minute forty takes the entire
brief with it, and the next one starts from a piece whose purpose can only be
guessed from its source.

**Verbatim, not summarised.** This is the part that is easy to get wrong, because
a tidy paraphrase looks more useful and is not. The section's own aim is named in
`CONTEXT.md` as **organic change** — and the glossary records that it was "named
by the pieces' author across four of them". His phrasing _is_ the primary source
for the concept the whole section is trading against, so the words are the
artefact. Keep them; add your own reading underneath if it helps, marked as
yours.

What goes in:

- **The seed**, in full, as the first entry.
- **Each piece of corrective feedback**, as it arrives, dated. These are
  reliably about how natural the piece reads and what would make it feel more
  organic — the recurring shape of what he notices, which is worth being able to
  re-read across pieces rather than only within one.
- **Questions you could not answer**, since you are not going to ask him: what
  you assumed, and what would settle it. He reads them when he chooses.
- **Nothing else.** Not decisions — those are ADRs. Not traps — those are the
  piece's `AGENTS.md`. Not the visitor-facing write-up — that is `about.md`, and
  the two are easy to confuse because both are prose about the piece. `seed.md`
  faces inward and records _him_; `about.md` faces outward and describes the
  work.

**If you are adopting this convention mid-build, say so in the file.** A
`seed.md` written at minute four hundred is transcribed, not kept, and the two
are not the same artefact — `crowd` wrote one in a single sitting after the
rule landed and marked it as such rather than letting it read as
contemporaneous, which is the right handling. It also reported nearly losing
the exact phrasing of two rounds of his feedback, and that his phrasing was
load-bearing in both. That is the cost the rule exists to avoid, measured.

**No check holds this yet, and that is worth stating rather than hiding.** The
six pieces that already exist have no `seed.md`, so a check asserting every
piece has one fails six times today, and one that skips them is a list that goes
stale. Until then this is a rule that depends on being remembered, which
`AGENTS.md` names as a defect; the mitigation is that it is the _first_ step
rather than a tidy-up at the end, because the steps a session never reaches are
the ones at the end.

**The six are being backfilled, and then the check becomes trivial.** Their
seeds are not lost: session transcripts persist under
`/root/.claude/projects/<worktree-slug>/*.jsonl` and the first human message of
an experiment's session is usually the seed verbatim. #204 tracks it. Once every
piece has one, "every piece has a `seed.md`" is a four-line test with nothing
stale in it — which is the right end state, since this rule is otherwise held
only by being remembered.

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

**Show him early and often, and show him something he can drive.** He starts from
imagination, so the first interactable build is what turns his statement into
something he can react to — the loop is build a little, show, adjust. A piece
built to completion before the first look has spent its solution space on
guesses. **A piece under exploration owes its URLs nothing**: presets, defaults
and already-shared links are not things to preserve while a piece is still being
found, which is exactly why showing it early costs nothing later.

**Every round of feedback you will get starts with him interacting.** That is the
practical reason the panel is not a finishing step — a build he cannot drive
returns you an impression, where one he can returns you a setting, a number and a
direction.

### Assume he is not watching. Always.

**This is the default and there is no other mode.** He gives one instruction and
goes — he should not have to say he is stepping away, and you must never make
him declare it. A session that waits for an answer he was never going to give
wastes the whole night, which is the most expensive thing that can happen here
and costs him nothing to avoid only if you never do it.

**So never block.** Not for approval, not for a preference, not for "which of
these two did you mean". You have a running piece and a record file; both reach
him without his attention, and neither stops if he is asleep.

**Reaching interactable is still the first thing, and it is now also how you
report.** There is no showing without a build, so the build _is_ the message:
leave the server up and hand over the URL. Then keep going.

**After the gate: widen, do not commit.** This is the rule that makes unattended
work safe. Prefer anything that enlarges what he can explore — another preset, a
wider range on a control, a setting where you had a constant — over anything
that settles a question. A widening is useful whichever way he steers; a
commitment is a coin-flip that costs a night when it loses. A piece under
exploration owes its URLs nothing, so making it adjustable is nearly always
cheaper than picking well.

- **Measuring matters even more here**, though it is not special to being alone
  — see _Measure before you look_ below, which applies always. The `crowd`
  session found a deleted force term, a docblock claiming what the code no
  longer did, a check passing against broken code, and a crash, none of which a
  glance would have caught.
- **Spend the time on correctness and range, not on polish.** Polish is what he
  would have redirected, and what his first sentence is most likely to discard.
- **Know what measurement cannot reach, and do not mistake a green night for a
  good one.** The `crowd` session built overnight against numbers and came out
  with a piece that was structurally complete and visually unexamined: **every
  one of his first four notes was about motion quality, and no check could have
  raised any of them.** Measurements find defects; they do not find whether it
  looks right, and the gap between those two is where all of his feedback
  lives. So report an unattended night as "correct as far as I can test, and
  unlooked-at" rather than as finished.
- **Put every question you could not answer into `seed.md`**, not into a message
  to him. Better still, put it in the piece: a preset per candidate answer is
  answered by dragging, which is how he answers anyway.

### Not blocking is not the same as not stopping

**You are expected to stop. What you must not do is stop at the first hurdle.**
The two get conflated and the conflation is expensive in both directions — a
session that blocks on question one wastes the night, and a session told never
to stop grinds past the point where anything it adds is useful.

**The test is whether there is still work that does not need him.** There
almost always is a body of it: the gate, then widening — another preset, a
wider range, a constant turned into a setting, a mechanism isolated so the
comparison exists when he arrives. Do that work. **When it runs out, stop
properly** rather than inventing more.

Stopping properly means: the piece running and its URL handed over, the
questions you could not answer written into `seed.md`, **your work committed
locally and deliberately not pushed**, and `/wrap-up` run. Say the branch is
local so he knows where it is. That is a finished night, and it is a better
outcome than an extra hour of widening nobody asked for.

**The judgement to make is "is this still useful", not "am I allowed to
continue".** If the honest answer is that the next thing genuinely needs his
eye, you have reached the end of the independent work — which is a success
condition, not a failure.

**A visual complaint is a mechanism to find, not a number to tune.** When he says
something looks wrong, the useful response is to work out what in the physics or
the arithmetic produces it, rather than to nudge a constant until it goes away.

**This now has a count behind it. Across nine rounds of his feedback on
`crowd`, every single one resolved to a mechanism and not one to a constant** —
and four times what he described as a single symptom turned out to be two or
three separate defects. The worked examples are worth reading as a set, because
the pattern is that his words name the _symptom_ accurately and the _cause_ not
at all:

| What he said                     | What it was                            |
| -------------------------------- | -------------------------------------- |
| "robotic head turns"             | a rate limiter with no easing          |
| "strange jitter like collisions" | not collisions                         |
| "is there strafing"              | facing equals velocity by construction |
| "do I ever turn"                 | an unreachable branch                  |

So **take the symptom as reliable and the diagnosis as untested**, including
when he offers one. "Like collisions" was a genuine observation attached to the
wrong cause, and a session that went looking at collision code would have found
nothing wrong and reported back that the piece was fine.

**And one distinction that keeps producing this class**, recorded generally in
`src/experiments/crowd/AGENTS.md`: **a rate limit and a spring are not two
settings of the same thing.** A limit clips and leaves the clipped shape behind
— which is what "robotic" was. A spring filters. Reaching for the wrong one of
those is not a tuning error that a better constant fixes.

**And when the question is a mechanism, build the comparison that isolates it.**
This is the discipline the second gate turns on, and #117 is the worked case.
Andrei looked and could not decide, because nothing reachable from the sliders
separated the mechanism from its confounds: `afterglow` moves both the trail
length and the quantisation floor, `playback` moves both the erase alpha and
every other clock in the piece. Four statistics were tried and all four failed,
one of them backwards — the "washed out" scene measured as _higher_ contrast.
What settles a question like that is a prototype varying the mechanism alone at
identical settings, and it is your job to build it before asking him again.

## Measure before you look, every time

**Dump the numbers before the first screenshot**, and check that each mechanism
actually _fired_ — not merely that the page rendered. This is the primary tool
and not a substitute for anything. It was written down first under _Assume he is
not watching_, which mis-framed it as what you do when there is nobody to show:
it is what you do before showing anyone, including yourself.

`bubbles` caught two faults this way that no still would have shown. The frame
was 3m wide, so a 6mm bubble came out 1.3px and 0.5% of the screen was lit. And
`biggest` plateaued at 14mm against a `popSize` of 50mm — meaning **one of the
piece's three mechanisms never ran at all**, with nothing in the picture to say
so. A screenshot of that scene looks like a reasonable piece, which is the whole
danger.

`src/experiments/AGENTS.md` already records that almost every bug in this section
was invisible in a screenshot, and that both runners assert on numbers rather
than pixels. This is that rule moved earlier: not a thing the test suite does to
you at review, a thing you do to yourself at minute thirty. `stats()` and the
console API exist for exactly this.

**"A mechanism that never runs" is the class to check for, and two pieces have
now hit it.** `bubbles` caught its own by measuring. `crowd` did not, and only
Andrei looking found it: `if (Math.abs(yawOffset) > NECK_LIMIT)`, where
`yawOffset` springs toward a target that is _already clamped to `NECK_LIMIT`_,
critically damped and therefore never overshooting — an unreachable branch, so
the turning it implemented simply never happened. **Both the piece's note and
its own `AGENTS.md` described the behaviour as working.**

The general shape is worth recognising on sight: **a conditional whose guard is
bounded by the same constant that bounds its subject.** The repo already holds
the testing version of this — a check nobody has seen fail is a claim — and
this is the implementation version. A branch nobody has seen taken is also a
claim, and asserting that each mechanism actually _fires_ is how you stop
writing documentation for code that does nothing.

## Verifying, which never gates the URL

**Give him the address the moment the piece is interactable.** Verification
runs after that and alongside it; it is not a checkpoint the URL waits behind.
A session told him "I'll push and give you the URL once the suite reports" and
was reading this section's old heading, which said _before you show him
anything_ — so the URL sat behind a three-minute suite for no reason, and a
push he did not want was bundled with it.

The two are independent and reported separately: **the URL is the deliverable
and goes out immediately**; a test result is a claim about correctness and goes
out when it exists. If the suite later goes red, tell him — he is not harmed by
having had the link in the meantime, and a piece under exploration is expected
to be rough.

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
