# Published artefacts

An **artefact** is a settings blob plus the runner it was published against. It
is data, never code: nothing here is executed, and nothing here can name a
function.

Each `*.json` beside this file is an artefact _source_ — the settings, and which
piece they belong to. `scripts/runners.ts` stamps in the runner's content hash
and writes the finished artefact to `public/showcase/artefacts/`.

Sources are here rather than in `src/experiments/` because choosing a scene for
a page is the **site's** decision, not the experiment's. The section supplies
runners; what the site runs in its own background is its own business.

## Shape

```json
{
  "piece": "<slug, matching a src/experiments/<slug>/runner.ts>",
  "defaultVariant": "<name>",
  "variants": { "<name>": { …every setting… } }
}
```

**Every variant states every setting.** Not a diff from a default, and not a
spread over another variant — the same rule as
`src/experiments/docs/adr/20260830-a-preset-inherits-from-nothing.md`, and for
the same reason: a scene resting on a default is a scene that changes the day
the default does.

**Light and dark are two complete blobs, not a flag.** The embed picks a variant
by name, which is what lets it stay ignorant of what any setting means.

Nothing validates these files here. The runner normalises whatever it is given,
behind the freeze — which is what keeps a published scene immune to a piece's
later defaults.
