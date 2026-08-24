---
type: ADR
status: accepted
date: 2026-08-24
summary: The section declares window.experiment once as unknown; each experiment keeps its own typed reference rather than widening the global.
---

# One `window.experiment` declaration for the section

## Context

Every experiment exposes a console handle at `window.experiment` — a convention
recorded in `../../AGENTS.md`, and the only way anything behind a pointer can be
reached from a headless browser.

Starry Night implemented that with a `declare global` in its own `api.ts`, typed
as its own `ExperimentApi`. That works exactly as long as there is one
experiment. Adding Dangler, whose API is a different shape, produced:

```
error TS2717: Subsequent property declarations must have the same type.
  Property 'experiment' must be of type 'ExperimentApi | undefined',
  but here has type 'ExperimentApi | undefined'.
```

The two contexts in this repo share one TypeScript project, and global
augmentation is global regardless of how separate the folders are. The section's
own convention had collided with itself the moment it was used twice.

## Decision

`src/experiments/window.d.ts` declares the name once, for the whole section, as
`unknown`. No experiment declares it. Each holds a properly typed reference to
its own API and uses that internally:

```ts
const api = createApi(controls, wakeLock, scene)
window.experiment = api
```

The declaration reserves the name and says nothing about what is in it.

## Considered Options

**Widen the global to a union of every experiment's API.** Rejected. It makes
each experiment's types depend on every other's, so adding a third edits a type
the first two rely on — precisely the coupling
`0002-experiments-are-not-generalised.md` exists to prevent.

**Let each experiment cast at the assignment site and declare nothing.** Touches
no other experiment, which was its appeal. Rejected because Starry Night's
declaration is global whether or not Dangler opts in: on Dangler's page
`window.experiment` would still be _typed_ as Starry Night's API, which is worse
than `unknown` — it type-checks calls that do not exist at runtime.

**Put the declaration in `src/env.d.ts`.** Rejected on boundaries. That file is
the Site context's, and `CONTEXT-MAP.md` has the dependency running one way
only.

## Consequences

- `window.experiment` needs a cast to be called with types anywhere. In practice
  nothing does: each page holds the typed local, and the global is for a human
  at a console, who has no types either way.
- Adding an experiment requires no edit here, which is the point.
- This is the first shared _file_ in the section, and it deliberately contains no
  implementation. Naming a shared concept binds nothing — the same exception
  ADR-0002 already makes for the section's vocabulary. It is not a precedent for
  a shared layout, theme or component, which remain ruled out.
