# 0003 — Colour schemes are inversions, for now

**Status:** Accepted, with known debt — 2026-08-23

## Context

Starry Night's light scheme began as a strict inversion of its dark one: the
background became the star colour and the star colour became the background,
behind a single `invert` boolean.

That constraint is not one anything actually requires, and it showed. The
mottling tint had to break the mirror to work at all — a true inversion of the
dark scheme's blue reads as a cold wash on near-white, where warmth is what
reads as clay. Forcing every colour to have a counterpart is an invented
requirement.

The immediate problem was absorbed by making hue a control and reducing the
palette to saturation and lightness only, so one number drives both the mottling
and the interface. That removed the symptom without removing the constraint.

## Decision

Keep `invert` as a boolean for now. Do not build a named-theme system yet.

The honest shape is a list of named themes in which `dark` and `light` are two
independent entries, free to hold colours the other has no answer for. That is
deferred, not rejected.

## Consequences

- Any colour added to a scheme must have a sensible counterpart in the other.
- A scheme cannot express a colour with no opposite, which is the specific thing
  that will eventually force the change.
- `invert` appears in shared URLs, so it has to keep working as an alias when
  themes arrive.

## Revisit when

The first time a scheme wants a colour with no counterpart.

The migration is small and the seam is already single: `paletteFor(invert)` is
the only place a scheme is chosen. It becomes `paletteFor(themeName)`, and
`invert` in `Settings` becomes a legacy alias mapping to the two original
themes.
