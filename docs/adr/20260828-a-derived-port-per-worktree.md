---
type: ADR
status: rejected
date: 2026-08-28
summary: Deriving the browser suite's dev-server port from the checkout path fixes worktree collisions and then hangs, because Astro allows one background dev server per checkout and the suite was asking for a second.
---

# A port per worktree, derived from the checkout path

> Rederived from scratch in a separate session before this record was linked
> anywhere. `tests/AGENTS.md` now carries the short version and points here; that
> file is what an agent working on tests actually reads, and an ADR nobody is
> pointed at does not stop a third attempt.

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

> **"Project" means the checkout, not the repository — and the difference is not
> academic.** Read as "the repository", this record says no two worktrees can
> hold a background server at once, which is false: three have run
> simultaneously on this machine, on 4354, 4329 and 4355, each with its own
> `.astro/dev.json`. Measured again from the other side in #178, where two
> worktrees held `astro preview` daemons on their own derived ports at the same
> instant.
>
> The reasoning below is correct under the narrow reading and the example
> demonstrates it — 4370 refused while 4360 was up **in the same checkout**. But
> the wording sent a steward to the wrong premise in September 2026: it read as a
> cross-worktree singleton, which made any derived-port scheme look doomed
> everywhere rather than doomed in the one place it actually is.
>
> **What is genuinely contested is the daemon slot in one directory**, so the
> question to ask of a new scheme is not "does it derive a port" but **how many
> servers does it ask one checkout for?** This design asked for a _second_ —
> the suite's derived port in a worktree where a human already had one, which is
> the common case and why it hung. A scheme asking for the only server in its own
> worktree takes the slot instead of being refused by it.

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
one is a two-minute hang whenever a dev server is already up **in the same
checkout** — including the one a human is working in, which is the common case.

The hash is not the problem. Any scheme that picks a port _and then insists on
it_ has the same fault, because the daemon slot, not the port, is the contested
resource.

## What would make it viable

Nothing, while Astro runs its dev server as a per-checkout daemon. The resource
to reason about is that daemon, not a number — and specifically how many of them
a scheme asks one checkout for.

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
