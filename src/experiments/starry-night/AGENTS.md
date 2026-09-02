# Starry Night — notes for agents

Read `about.md` for what this is and why it looks the way it does, and
`../AGENTS.md` for conventions shared by every experiment. This file is only the
things about _this_ piece that will get broken by accident.

## Traps that have already been hit

Every item below was a real bug in this experiment, not a hypothetical.

- **Do not derive a layer's lifespan from its depth.** It was built that way
  first. Adjacent layers then draw from overlapping ranges, land on near-equal
  lifespans, and stay visually locked for minutes — two layers beat against each
  other with period `L1*L2/|L1-L2|`, so 15s against 15.5s holds for about eight
  minutes. Depth sets appearance; `randomLifetimeMs` sets tempo. Keep them
  independent.
- **Never reset a layer's phase on a settings change or a resize.** Rebuilding
  layers must carry `phase` and `lifetimeMs` across, or every layer restarts
  together and fades in as one — the exact artifact the piece exists to avoid.
  See `rebuildLayers`.
- **Keep star radii at or above ~0.7 css px.** Below that a dot is sub-pixel at
  DPR 1; antialiasing spreads its area and it can never reach its nominal alpha,
  so the whole tier silently contributes nothing. `FAR.minRadius` is the floor.
- **The page's `<style>` must stay `is:global`.** Astro scopes styles by adding a
  `data-astro-cid-*` attribute to elements in the template. The control panel is
  built in JS, so its elements never receive that attribute and scoped rules
  cannot match them. Symptom: controls render with default browser chrome.
- **`hidden` on the panel needs an explicit CSS rule.** `.panel { display: flex }`
  outranks the UA's `[hidden] { display: none }`, so setting the attribute does
  nothing without `.panel[hidden] { display: none }`. Symptom: panel always open.
- **Do not read query numbers with bare `Number()`.** An absent param is `null`
  and `Number(null)` is `0`, which is a legal value for most settings here — this
  silently disabled glimmers by default once. `settingsFromQuery` skips absent
  and blank params and requires `Number.isFinite`, so all three cases keep the
  default; an explicit `0` still reads as `0`. Covered by
  `tests/unit/starry-night/settings.test.ts`.
- **Do not set `accent-color` on the sliders.** The UA derives the unfilled track
  and thumb contrast from the accent's _perceived_ luminance, which swings wildly
  with hue at fixed lightness, so the track flips to a contrasting scheme partway
  around the wheel. The track is hand-styled against `--track`, which is
  deliberately hue-independent.
- **Full-screen composites cost far more than stars.** Measured at 2560x1440:
  4231 stars with 1176 separate fills ran at 60fps, while five per-layer
  full-viewport cloud composites dropped it to 19. Star count is close to free;
  every additional full-screen alpha blend is roughly 5ms in software raster.
  Cloud layers are therefore combined in a reduced-scale scratch buffer and
  scaled up once per set. Do not go back to blending each layer straight onto
  the canvas, and be wary of adding a third full-screen pass.
- **Alpha gradients need dithering.** A soft gradient ramping to a low alpha over
  a few hundred pixels bands into concentric rings at 8-bit precision. More
  colour stops do not help. See `dither` in `clouds.ts`.

## Invariants worth preserving

- **One canvas path per layer.** Every dot in a layer shares an alpha, so a
  single `fill` covers all of them. Per-dot fills are much slower for no gain.
- **Full-viewport gradients are never drawn per frame.** Cloud layers render once
  into a downscaled offscreen buffer; per-frame cost is one `drawImage` with
  `globalAlpha`. Restoring per-frame gradients will drop the frame rate hard.
- **`prefers-reduced-motion` gets a still frame and no RAF loop**, not a slowed
  animation.
- **Settings round-trip through the query string.** Anything added to `Settings`
  needs handling in `settingsFromQuery` and `settingsToQuery`, and a `hint` if it
  is a `Control`, or the panel and shared URLs quietly disagree.
- **A colour added to one scheme needs a counterpart in the other.** `invert` is
  a boolean and the two schemes are inversions, which is accepted debt rather
  than a design: `paletteFor(invert)` is the single seam it becomes
  `paletteFor(themeName)` at. The first colour with no opposite is what forces
  that. See `docs/adr/0003-colour-schemes-are-inversions-for-now.md`.

## Shape of the code

| File           | Holds                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| `settings.ts`  | `Settings`, the `CONTROLS` spec (bounds, formatting, tooltips), presets, query parsing |
| `character.ts` | depth → appearance curve, fade envelope, phase/lifespan seeding, biased size draw      |
| `starfield.ts` | the engine: canvas, DPR, layer lifecycle, drawing, glimmer spawning                    |
| `glimmer.ts`   | single-star flares                                                                     |
| `clouds.ts`    | background mottling, offscreen buffers, dithering                                      |
| `shape.ts`     | irregular outlines for large stars                                                     |
| `palette.ts`   | the two colour schemes; hue comes from settings, not from here                         |
| `controls.ts`  | the panel, idle hiding, URL sync                                                       |

## Verifying a change

`pnpm run build` covers `astro check` and `pnpm run lint` covers eslint. Neither
sees anything visual. `tests/AGENTS.md` explains the two runners; what matters
here is which of this piece's failures each one reaches.

- **`pnpm exec vitest run starry-night`** covers the parts with no canvas in them: the
  envelope, the size distribution, the lifespan spread, query parsing, the
  presets. These are the failures that are invisible _and_ slow to notice — a
  layer with the wrong lifespan looks fine until two of them beat against each
  other for eight minutes.
- **`pnpm exec playwright test starry-night`** covers the page. Both the styling bug
  and the always-open panel reported zero console errors and were only visible in
  an image — but neither needed a pixel comparison to catch: one is a computed
  `background-color`, the other is whether the panel is hidden. Assert the
  property, not the picture.
- **`experiment.stats().running`** is how the reduced-motion invariant is
  checked. A still field and a running loop look identical in a screenshot.
- Stills go to `.scratch/shots/` for a human to look at. Nothing compares them.

**Force rare events rather than waiting for them.** Glimmers default to one every
two seconds, so a still catches one about a fifth of the time. Pass a high
`?glimmersPerSecond=` to make them certain, and isolate the clouds with
`?clouds=1&layerCount=2&densityScale=0.1`.

`/root/bin/webcheck` (see the machine's global notes) is still the quickest way
to sweep several pages for console errors and stills at once. It cannot evaluate
JS, which is the one thing the suites add.
