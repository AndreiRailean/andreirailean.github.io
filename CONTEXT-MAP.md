# Context map

This repo holds two bounded contexts. They share a build, an origin and a
deployment, and deliberately nothing else.

| Context         | Lives in                                                              | Glossary                     | Decisions                  |
| --------------- | --------------------------------------------------------------------- | ---------------------------- | -------------------------- |
| **Site**        | `src/pages`, `src/components`, `src/layouts`, `src/styles`, `src/lib` | none yet                     | none yet                   |
| **Experiments** | `src/experiments`, `src/pages/experiments`                            | `src/experiments/CONTEXT.md` | `src/experiments/docs/adr` |

Decisions that cut across both contexts — tooling, CI, repo conventions — live in
`docs/adr/` at the root.

An experiment imports nothing from the site — no layout, no stylesheet, no
component. The boundary runs one way only: the site may eventually link to an
experiment, but no experiment reaches back.

Both contexts currently build as one Astro project. Whether that lasts is
recorded in `src/experiments/docs/adr/0001-experiments-inside-the-site-project.md`.
