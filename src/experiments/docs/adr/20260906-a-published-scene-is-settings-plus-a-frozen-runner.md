# A published scene is settings plus a frozen runner

**Status:** Accepted — 2026-09-06. **Partly superseded 2026-09-07**: the runner
half stands unchanged; the artefact half does not. See the correction at the end.

## Context

The site's home page wanted a piece running behind it. The obvious way to do
that is to import the piece — and it is ruled out twice over. `AGENTS.md` forbids
an experiment importing from the site, `CONTEXT-MAP.md` records that the site
links to nothing in experiments, and neither would survive a page that reached
into `starry-night/starfield.ts`.

There is a second problem the boundary does not name. A piece under exploration
**owes its URLs nothing** — that is
`20260829-a-piece-under-exploration-owes-its-urls-nothing.md`, and it is the
right rule. But a scene on the front page cannot be renegotiated every time a
default moves, and asking the section to hold still for it would trade away the
freedom that record exists to protect.

Both problems have the same shape: something outside wants a scene that keeps
working while the piece it came from keeps moving.

## Decision

A published scene is two things, built at different times and by different
rules.

**A runner** is a piece bundled into one self-contained module —
`src/experiments/<slug>/runner.ts`, frozen by `scripts/runners.ts` into
`public/showcase/runners/<slug>.<hash>.js`. It carries the scene code and
nothing else: no chrome, no kit, no presets, no URL handling. Its filename is a
**content hash**, so identical code is always the same address and a rebuild
that changes nothing publishes nothing.

**An artefact** is a settings blob naming the runner it was published against —
`src/showcase/*.json`, stamped and written to `public/showcase/artefacts/`. It
is **data, never code**.

Between them sits `gallery/embed.ts`, one unversioned loader, which reads an
artefact, imports the runner it names, and knows nothing about any piece.

Three properties follow, and each is the answer to something above:

- **A published scene cannot drift.** It runs the bytes it was published
  against. The piece stays free to move, which is what the URLs record asked
  for.
- **Nothing imports across the boundary.** The page holds two URLs.
- **Normalisation happens inside the runner**, behind the freeze. A host that
  validated settings itself would have to be upgraded in step with every piece,
  which is the coupling this exists to remove.

**Runner preparation belongs to the piece; runner hosting does not.** What goes
into a bundle is a decision only an experiment can make, so `runner.ts` lives
with the piece and a piece opts in by having one. How runners are named,
versioned, served and loaded is imposed on every piece alike, so it is the
gallery's — `offered` versus `imposed`, the same test as everything else in
`20260828-the-piece-is-independent-the-gallery-is-not.md`.

**Light and dark are two complete settings blobs, not a flag.** A host picks a
variant by _name_, which is what lets it stay ignorant of what any setting
means. A `scheme` hint would have required every runner to understand schemes,
and a host flipping `invert` itself would have to know Starry Night has one.

## Considered and rejected

**Compile the piece to WebAssembly.** The stated appeal was a tightly controlled
runtime with its library versions pinned. That is bundling, not compilation: a
pinned JS bundle is exactly as frozen as a pinned `.wasm`, and content-addressing
is what does the pinning either way. The measured bundle is 13.7kb, so size was
not an argument either. Rejected as a large rewrite buying a property already in
hand — though it remains open later on performance grounds, which is a different
question.

**Publish a still or a video.** Genuinely frozen, and it discards the motion the
whole section is about, along with resolution independence. Rejected.

**Name a piece rather than a runner**, letting a page follow the current build.
Simpler, and it reintroduces exactly the drift this record exists to prevent.
The address of a published scene has to be the bytes.

**Commit hashes instead of content hashes.** A runner bundles a piece _and_
whatever section-level code it imports, so no single commit describes it, and a
no-op rebuild would publish a new name. The commit is recorded in
`manifest.json` for tracing; the name is the contents.

**A prerendered still as the failure fallback.** A whole capture-and-store
pipeline for a case every host has already solved: the loader empties the
container instead, and whatever CSS background the page already has is what
shows.

## Consequences

- `public/showcase/` is build output and is **not committed**. `pnpm run
runners` writes it; `dev` and `build` both run it first.
- The unit suite cannot see a runner, since building one needs a bundler. What
  it can check — that an artefact names a piece with a runner, and that every
  variant states every setting — is in `tests/unit/showcase-artefacts.test.ts`.
  That an artefact actually reaches a page is `tests/showcase.spec.ts`.
- **A piece with a `runner.ts` acquires a second audience.** Its scene modules
  are now imported by something that will not be rebuilt when they change. That
  costs the piece nothing today — a published artefact keeps its old runner —
  but it is the reason `runner.ts` exposes a deliberately tiny surface rather
  than re-exporting the piece.
- The wake lock does not travel: it lives in the kit, and a runner does not
  import the kit. Worth keeping as a property to check rather than a fact to
  remember.

## Correction — 2026-09-07

**A scene is not a JSON file, and never should have been one on this site.**

This record described an artefact as `src/showcase/*.json`, stamped by the build
into `public/showcase/artefacts/` and fetched by the page. Every property claimed
above survives that shape, which is why it read as a detail. It was not one.

Generating the home page's background out of the same build that builds the piece
makes the site and the section **one system** — the thing the boundary in
`AGENTS.md` exists to prevent, arrived at from the other direction. Andrei named
it: _"this work appears to be blurring the line between the experiments project
and the home page of andrei.md and treating them as one system. i'd rather see
the home page treat experiments as a third party system even at this early
stage."_

**A scene is now the packed address string, carried in the page.** The snippet
pins a runner and states its scene inline, `src/showcase/` is gone, and nothing
is generated into `src/pages/index.astro`. The runner decodes the string, because
a packed scene is positional and only the registry that wrote it can read it —
which is also why packing is safe here and would not have been in a free-standing
JSON file, where the registry version would be implicit and unpinned.

Two consequences this record did not reach:

- **Pinning requires retention**, so runners are committed and never pruned. See
  `20260907-runners-are-committed.md`.
- **Light and dark are a host convenience, not the base form.** A copy-embed
  action produces one scene; pairing two, and deciding what drives the switch,
  belongs to the page — it cannot be generalised across hosts.
