# CLAUDE.md

**This file exists because `AGENTS.md` was not reaching anybody.**

Every rule this repo has lived in an `AGENTS.md`, and a session only saw one if
it happened to go looking. Claude Code loads `CLAUDE.md` on its own and does not
load `AGENTS.md`, so nine files of hard-won reasoning were opt-in — including
the ones that exist precisely because somebody skipped them. This file is the
hook that pulls them in.

@AGENTS.md

**If the line above appears verbatim rather than as the contents of `AGENTS.md`,
imports are not active — read `AGENTS.md` now, before anything else.** It is
short and it points at everything else.

## The five that cost the most when missed

Everything below is in `AGENTS.md` too. It is repeated here because these are
the ones that have actually been broken, some by the person who wrote them down.

1. **Show, do not describe.** Andrei approves what he sees in a browser.
   `pnpm run preview` builds and serves; hand him the **tailscale or LAN** URL it
   prints, never `localhost` — this is a VM and his browser is elsewhere. The
   `/preview` skill has the whole lifecycle. **Never `astro dev`** for this.

2. **pnpm, not npm.** `pnpm install`, `pnpm run <script>`, `pnpm exec <tool>`.

3. **Branch from `origin/main`, never local `main`.** `git checkout main` fails
   in a worktree — `main` lives in `/root/projects/andrei.md` — and
   `git checkout -b` then silently branches off whatever you were on. Fetch and
   merge `origin/main` before opening a pull request. Always a pull request.

4. **Anything that speeds up iteration outranks feature work**, and does not need
   asking for. A red check, a check that cannot see what it is meant to check,
   code the tools cannot reach, waiting that buys nothing, and a rule that
   depends on being remembered. `AGENTS.md` opens with why.

5. **Read the context you are working in, not all of them.** `CONTEXT-MAP.md`
   names the two bounded contexts and points at each one's glossary and
   decisions. An experiment imports nothing from the site.

## Where the rest lives

| If you are working on           | Read                                      |
| ------------------------------- | ----------------------------------------- |
| Anything at all                 | `AGENTS.md`, then `CONTEXT-MAP.md`        |
| Tests, or the browser suite     | `tests/AGENTS.md`                         |
| An experiment                   | `src/experiments/AGENTS.md`, then its own |
| The showcase                    | `src/showcase/AGENTS.md`                  |
| A decision worth not rederiving | `docs/adr/`, and `/record-decision`       |
