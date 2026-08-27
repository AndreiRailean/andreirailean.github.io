# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **multi-context** repo. `CONTEXT-MAP.md` at the root names each context
and points at its glossary and its decisions; there is no root `CONTEXT.md`.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — which contexts exist and where each
  one's glossary and decisions live. Read the map first, then only the context
  you are working in.
- **That context's `CONTEXT.md`** — its glossary / ubiquitous language.
- **`docs/adr/` at the root, and the context's own `docs/adr/`** — read the ADRs
  that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT-MAP.md              the contexts, and where each one's docs live
├── docs/adr/
│   └── 20260823-some-decision.md      cross-cutting: tooling, CI, conventions
└── src/
    └── experiments/            a context
        ├── CONTEXT.md          its glossary
        └── docs/adr/           its own decisions, so they travel with it
```

## Where a record goes, and in what shape

- **Cross-cutting or process decisions** — tooling, CI, conventions — go in
  `docs/adr/` at the root.
- **Decisions belonging to one context** go under that context, e.g.
  `src/experiments/docs/adr/`, so they travel with it if it is ever extracted.

Filename `YYYYMMDD-slug.md`. Date stems rather than sequential numbers, because
agents on separate branches would otherwise both claim `0004`.

Frontmatter carries `type`, `status` (`proposed` / `accepted` / `rejected` /
`superseded` / `deprecated`), `date`, and a one-line `summary` so the directory
can be skimmed without opening files. Then **Context / Decision /
Consequences**, plus `Considered Options` when the rejected alternatives are
worth remembering.

A `rejected` record is the most valuable file in the directory: it is the only
thing that can stop an approach being re-tried, because the code holds no trace
of one that was abandoned. Records are append-only — supersede, never delete.

The records under `src/experiments/docs/adr/` predate this format and use
sequential numbers with a `Status:` line in the body. They are not being
migrated.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
