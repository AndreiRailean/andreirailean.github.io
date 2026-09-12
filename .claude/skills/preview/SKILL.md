---
name: preview
description: Put the site in front of Andrei in a browser and manage the preview server's lifecycle. Use whenever there is something visual to approve — a new or changed experiment, a page, a poster, a layout — before asking whether it is right, and whenever he asks to see, preview, review or look at anything. Also use when deciding whether to stop a preview, or when a build warns that somebody is reviewing.
---

# Show Andrei the work

**He approves what he sees in a browser, not what you describe.** Nearly
everything in this repo ends at a visual judgement he makes, so putting the work
on screen is part of finishing it — not a favour to ask for.

Do not wait to be asked. When you have something visual that needs his verdict,
build it, hand him the URL, and say what to look at.

## The one command

```bash
pnpm run preview
```

It builds and serves, prints the address, and takes about eight seconds. Give
him the **tailscale or LAN** URL it prints — never `localhost`, which he cannot
open, because this runs on a VM and his browser is elsewhere.

Then say **what changed and what to look for**. A URL on its own makes him hunt.

## The loop

He reviews a _state_, not a stream. There is no HMR and that is the point.

1. `pnpm run preview` → give him the URL.
2. He looks, and gives feedback. Ask follow-up questions if the verdict is
   ambiguous. Agree what to change.
3. **Go back to work.** Build again when there is something new to see.
4. `pnpm run build:quick` → tell him to reload. **The URL does not change.**

Step 4 is the whole reason this is cheap: a rebuild takes four seconds and does
**not** restart the server, so his tab and his bookmark keep working.

## The port is his bookmark

Each worktree derives its own port from its path. It is **stable** — the same
across rebuilds, restarts and sessions — so he can bookmark one address per
branch and have several pieces on screen at once. Do not try to change it, and
do not hand him a different one; read it back from what `pnpm run preview`
prints, which comes from `.astro/preview.json` rather than from an assumption.

## Do not build while he is looking

`astro build` clears `dist/` before writing it, so a rebuild blanks his page for
a couple of seconds and then serves him something different. If he reloads in
that window he sees a 404 and reports the work as broken.

So: **previews happen when you are not building.** If the browser suite warns
that a preview is serving the review port, that warning is telling you somebody
is mid-review — finish the run and tell him to reload, or wait.

## Stopping it

A preview is about 179 MB, against roughly 1.2 GB for `astro dev`. It is cheap
enough to leave up, and a running one is meaningful: it is how anything else
knows a review is in progress.

**Stop it when the review is genuinely over**, not when your turn ends — he may
still be looking:

```bash
pnpm exec astro preview stop
```

That acts on `.astro/preview.json`, which is per-worktree. So it is safe to run
in your own checkout without checking on anyone, and it is **never** the right
way to tidy up another worktree's server.

`/wrap-up` does this alongside everything else a session leaves behind, and knows
the difference that matters: a preview on **this worktree's derived review port**
may have somebody looking at it, while one on any other port is a script's
leftover and safe to stop.

## Never `astro dev` for this

It costs seven times the memory, and it is not the artefact that deploys. It has
also shown him stale work and had him report correct code as broken — a content
store frozen at server startup, and an `_image` URL cached for a year that
cannot change when a poster is recaptured. A build has neither problem.

`pnpm run dev` still exists for a human who wants HMR. It is not the path for
showing him anything.

Full reasoning, with the measurements:
`docs/adr/20260912-previews-and-tests-run-against-a-static-build.md`, and the
"The server the browser suite drives" section of `tests/AGENTS.md`.
