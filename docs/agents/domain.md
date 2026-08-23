# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo: one `CONTEXT.md` and one `docs/adr/` at the root.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the glossary / ubiquitous language.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-some-decision.md
│   └── 0002-another-decision.md
└── src/
```

If this repo ever grows into multiple bounded contexts, add a `CONTEXT-MAP.md` at the root pointing at one `CONTEXT.md` per context, with context-scoped decisions under `src/<context>/docs/adr/`.

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
