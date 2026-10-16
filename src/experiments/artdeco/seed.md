# seed — artdeco

What Andrei asked for, in his words, and each round of feedback as it arrives.
Verbatim. This file faces inward and records him; `about.md` faces outward and
describes the work.

## 2026-10-15 — the seed

> we're building art-deco style graphics that animate into existence. i'm
> seeing a symmetry: line starts growings from the middle bottom of the
> screen. as it reaches a certain height a few decisions are made: it can
> split into 2 that grow sideways at the same at opposite angles. initial line
> itself either terminates at the split or keeps going straight and then
> another such decision is made. the two lines that grew out of it grow as
> straight lines (at an angle) until they reach a certain point when another
> decision is made. due to symmetry, the lines do not make their own
> decisions, but have the same decision applied to them. they can either split
> again, keep going straigh or turn at opposite angles to keep the symmetry
> along the central axis of the screen.
>
> as i understand it, art-deco is characterised by symmetry, angles and
> parallel lines. while there is a rounded flavour of art-deco, to start with
> I want to begin with straight lines. I'm not exactly sure where this is
> going and if it will result in art-deco style graphics. i'll need your help
> in this. i'm not exactly sure on the cycling of this. eventually, if we keep
> drawing lines we'll fill the whole screen. perhaps lines being drawn can
> interact with lines already on screen and either terminate or cause more
> symmetric lines to be drawn. i'm not sure how to cause programmed
> parallelism. perhaps sometimes the line can make a decision to perform a
> parallel action, so at a ceritain point, while it keeps growing in a
> straight line, it grows an off-shoot and in a few "ticks" it generates
> another off-shoot at the same angle, thus giving parallel lines.
>
> symmetry can be provided by having 2 lines grow from the bottom of the
> screen equidistant from the center and behaving in the same way as the
> single center line would. but they'd know that there's more than one of
> them, so the overall symmetry would be maintained through the splitting and
> turning decisions that apply to both lines equally, but as mirror images of
> each other.
>
> i'm seeing thin lines, but i understand that art deco style is not just thin
> lines, though in my mind they dominate and provide the main structure.
>
> i don't know when we stop drawing and what happens after we do. perhaps the
> image could evolve in such a way that some segments begin to disappear ether
> due to line interactions or due to time passing.
>
> in other experiments the controls provide defining parameters that cause
> consistent piece rendering. here, it's hard for me to imagine how a piece
> can stay consistent while also being allowed to evolve freely

## 2026-10-16 — first look

> oooh. i love it. i like how the parallelism occurs naturally. feels like
> stop/cross/rebound is a decision to be made by the line. we only need to
> provide it as an option, so a piece can have all 3 enabled or only one.
>
> seeing this now makes me want to see some circles. i see them both placed
> randomly on a line and in a way where the center of the circle falls on the
> turning point of the line. am seeing a big circle in the middle of the piece
> with smaller circles all around

## 2026-10-16 — top and bottom, and threes

> i wonder if extra symmetry is possible by letting the lines grow from the top
> and bottom. and am thinking of how a "rule of threes" can be implemented in
> this experiment.

## Open questions

_Mine, not his — what I assumed and what would settle it._

- **Consistent versus free.** My reading: the settings are the grammar (angle,
  odds, rhythm, weight) and the seed is one sentence in it. Every drawing after
  the first follows from the seed too, so an address replays the same sequence
  forever while no two drawings in it repeat. `next drawing` makes the choice a
  control — _new_ (assumed default) or _same again_. If what you meant is that a
  drawing should keep evolving rather than be replaced, that is not built.
- **When does it stop?** Two answers built as `cycle`: _draw, hold, undraw_ (in
  the order it was drawn), and _flow_ (a tail follows every tip `life` seconds
  behind, and a new drawing starts as soon as the last tip stops). Neither is
  chosen; the primary uses the first.
- **Lines meeting lines.** Built: stop, cross, rebound, each with its own odds
  since 2026-10-16, so a piece can enable any of them. I read "a decision made
  by the line" as: the line chooses at each meeting, and lines that decide
  together (a family) choose together, as they do for turns. If you meant each
  line picks one temperament for its whole life, that is not built. Not built: a meeting that _causes_ new
  symmetric lines, and a meeting that erases segments — both in the seed, both
  need a decision about which line the new lines belong to.
- **Parallelism** is the `echo` decision plus families: an echo's offshoots,
  and the stems on one side, share one sequence of decisions, so they turn
  together and stay parallel. Is that the parallelism you were seeing, or did
  you mean parallels drawn alongside a line (that is what `strands` does)?
- **"All as one"** (every line's n-th decision the same) gives the strongest
  order and is all-or-nothing: an early fork kills everything, an early branch
  floods the frame. Measured, not guessed — see `AGENTS.md`.
- **Not thin lines.** Only `strands` (double rules, bands) and `taper` so far.
  Filled shapes between parallels, and the rounded flavour, are not started.
- **Circles** (2026-10-16). Built: a circle centred on a corner (turns and
  rebounds, splits, or both), a circle somewhere along a stretch, and one big
  circle on the centre line at a chosen height. Each draws itself round from
  its lowest point. Lines can meet the big circle; they never meet the small
  ones, since a corner circle is centred on its own line. Whether small circles
  should stop other lines, and whether a line could grow along a circle (an
  arc) rather than only past it, are both open. Presets 8–10 (medallion,
  sunrise, beads) are three readings of "a big circle in the middle with
  smaller circles all around".
- **Top and bottom, and threes** (2026-10-16). I built both as one control,
  `fold`: the drawing's symmetry. 2 grows from the bottom and from the top,
  mirrored both ways, and the two meet in the middle. 3 is the reading of the
  rule of threes I could build as a mechanism: three copies turned round the
  centre, each mirrored. The triad preset adds threes everywhere else too
  (bands of three strands, echoes of three offshoots). Other readings, not
  built: a split into three lines rather than two; proportion by thirds, with
  decisions or the big circle placed on thirds of the frame; repeating each
  mark three times. If one of those is what you meant, it is a setting rather
  than a rebuild.
