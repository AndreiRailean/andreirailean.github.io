---
type: ADR
status: rejected
date: 2026-08-28
summary: Deriving the browser suite's dev-server port from the checkout path fixes worktree collisions and then hangs, because Astro allows one background dev server per project.
---

# A port per worktree, derived from the checkout path

## Context

`tests/support/dev-server.ts` used a fixed port, 4355, chosen to stay clear of
the 4354 in `astro.config.mjs` that a human's own server sits on. It starts a
server only if nothing already answers there.

Worktrees share a machine. A run in one checkout found 4355 already answering —
another worktree's server, on another branch — skipped its own start, and drove
that branch for the whole run. It passed, because the pages it asked for existed
there too. Nothing in the output said so, and the posters captured in the same
run were stills of the wrong code.

The obvious fix is to stop sharing the number.

## What was tried

A port derived from the checkout's absolute path, so every worktree gets its own
by construction rather than by noticing:

```ts
const PORT_BASE = 4400
const PORT_SPAN = 100

function portForThisCheckout(): number {
  let hash = 0x811c9dc5 // FNV-1a over process.cwd()
  for (const char of process.cwd()) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return PORT_BASE + (hash % PORT_SPAN)
}

export const PORT = Number(process.env.PW_PORT ?? portForThisCheckout())
```

Stable across runs, so leaving the server up still saves a cold start; different
in every worktree, so two cannot collide. `BASE_URL` stays a module constant,
which is what `playwright.config.ts` needs, since the config is evaluated before
`globalSetup` runs.

## How it failed

**Astro 7 allows one background dev server per project, and reports the running
one instead of starting a second.**

```
$ npx astro dev --port 4370 --background
Dev server already running at http://localhost:4360 (pid 955876)
```

The command succeeds. Nothing ever answers on the port the suite asked for, so
`startDevServer` waits out its full 120s timeout and the run dies:

```
Error: The dev server did not answer on http://127.0.0.1:4437 within 120s.
```

This is worse than the bug it fixes. The old failure was silent and wrong; this
one is a two-minute hang whenever any dev server for the project is already up —
including the one a human is working in, which is the common case.

The hash is not the problem. Any scheme that picks a port _and then insists on
it_ has the same fault, because the daemon slot, not the port, is the contested
resource.

## What would make it viable

Nothing, while Astro runs its dev server as a per-project daemon. The resource to
reason about is that daemon, not a number.

What replaced it (`fe3ef77`) reads `.astro/dev.json`, Astro's own record of the
server it is running. That file lives inside the worktree, so it is incapable of
naming another branch's server, and it reports whichever port Astro actually
chose — including when Astro falls through to the next free one, which is
exactly what happens when 4355 is taken. A server that is already up is adopted
rather than fought for the slot.

The cost is that `BASE_URL` can no longer be a module constant: the port is not
known until `globalSetup` has run. It is published as an environment variable
that worker processes read through `use.baseURL`, which is why
`playwright.config.ts` no longer imports a URL from here.
