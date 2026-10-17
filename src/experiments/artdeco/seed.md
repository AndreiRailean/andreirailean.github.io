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

## 2026-10-16 — playing with it, and "the construct"

> I'm playing with this:
> http://100.117.55.104:4627/experiments/artdeco/?s=___f____QEnZwkSRpSCAowggwwLQAAcdSBQpgABAEjLE
>
> Observations: the stems all come from the same location, which pegs the
> birth to always be in the same spot. i wonder if allowing variability beyond
> the static calculation based on screen height would help. having them be born
> in the same spots does help maintain consistency, especially with a config
> like this that appears to never stop. the next birth naturally fits into what
> was there before and keeps completing the same picture
>
> When I said the "rule of threes" i guess i meant that the same decision is
> made 3 times in a row or the same "shape" i birthed three times. perhaps that
> only applies to some decisions. say if the line decides to send an off-shoot,
> it makes the same decision 3 times at the same interval, so result appears as
> 3 parallel lines. the effect would probably get lost unless the the effect is
> constrained to only some decisions only some of the time.
>
> the circle always being the same size is interesting, but also gets a little
> predictable.
>
> a little surprised that 4 stems grows from a square canvas, not the sides of
> the screen. i guess it makes it easier to predict the symmetry. the piece
> appears more impressive when it fills the screen. but when birth happens in
> the middle of the screen the effect is not as seamless.
>
> would be good to allow for a vertical bias - so a line would have a tendency
> to go longer in the up-down plane to build skyscraper-like structures.
>
> i'm finding circles a little hard to control, so i'm not testing them at the
> moment. they overlap a little too much and unpredictably, so i'll leave them
> until i get the feel for the lines.
>
> i'm not finding the multi-line treatment (triplets) very useful. it may be
> good as a stem, but it only works if it is smarter about angles and joins. it
> produces joins that only touch on one of the lines and has others over or
> undershoot. hard to control and kinda gets boring really quickly.
>
> save this one as "the construct"
> http://100.117.55.104:4627/experiments/artdeco/?s=___f____QEnZwkSRpSCAowggwwLQAAcdSBQpgABAEjLE
>
> - it's the same one as above, only the stems are a little further apart. on
>   my screen, the pattern it produces is mesmerising. not sure what will happen
>   on replay.

## 2026-10-16 — four to the edges

> interesting. by pushing 4 to the edges (instead of a square) i get 3 big
> circles and strange cut-offs on where the up-down lines would meet. does the
> left-right symmetry need to mirror the up-down one or can the left-right have
> a life of its own? i'm looking at this
> http://100.117.55.104:4627/experiments/artdeco/?s=___f_____2BQGcJEkaUiAKMIIMMC0AAHPUgUKYAAQBIyz0ERIq

## 2026-10-16 — clockwork

> save this as clockwork
> http://100.117.55.104:4627/experiments/artdeco/?s=___f_____3AwGoJEkOUhREMIIMMC0AAHPUgCEIAAQAmyzqCRJT

## 2026-10-17 — busyness

> is there a way to control the "busyness"? some areads end up with too many
> intersections. so far I've been managing it with the "life" of a line and if
> longer life (fewer stop) is allowed it end up being very busy and almost
> completely fills the piece. i'm wondering if it is possible to have "area
> busyiness" determination to increase the incidence of stops and or kick off
> the line disappearance process sooner. so in a busy area, a new line crossing
> through would "infect" existing lines to make them start disappearing. and
> the disappearance itself would make decisions at intersections and turns.

## 2026-10-17 — the permanent circle, and circles crowding

> i'm looking at this, a derivative of preset 17, and the main circle has not
> moved in a few minutes now. nothing can kill it and it makes no decision to
> go. there's something to its permanence, but i'd like to know how to control
> it.
>
> http://100.117.55.104:4627/experiments/artdeco/?s=___f_____39J2cJEkaUggKMIJMMC0AAHHUgUKYYAQBIyxAADIAMYRQ
>
> I started playing with circles and it appears that busyness controlls allow
> me to find them manageable again, though i do find places of
> multi-circle-overlap that look messy. circles draw special attention. i think
> they need to be controlled by probability based on other circles nearby. if
> other circles are around the likelihood of spawning a circle should go down.
> [Image #1]

_(Image #1: a close-up of six small rings, several overlapping each other and
two overlapping in a chain along a line.)_

## 2026-10-17 — tips instead of lines

> i just saw something interesting. the tip of the line ended up in a state
> where its body disappeared. so they (the tips) were flying in different
> directions. that added some nuance and made me wander if instead of thinking
> about lines we think about those tips. so rather than line deciding to stop
> moving and starting another spawn, the dot keeps moving and makes decision to
> draw or not and while doing that it makes decisions to trun and to split.
> stopping becomes stopping to draw. so another decision becomes starting to
> draw. and the dot can turn and split while not drawing anything - just the
> tips are flying through. whether that makes tips immortal and how that
> impacts the art will show if it's a good idea. i like what we have so far and
> don't want it's feel to change. not sure if this tip thing is a hint at a new
> piece or another type of "pen"

## 2026-10-17 — taming tips, and snowflake

> hmmm. it does begin to look like a different piece, but we'll keep it here
> because learning the controls is a little hard. tips dynamic needs to be
> tamed. tips end up splitting endlessly and the screen becomes filled with
> the noise of moving dots. the nuance i saw stops being attractive. i think
> split decisions need to carry a cost, so splitting into 3, shortens their
> life or we cap the density. or maybe we have a hierarchy of tips and some can
> be seen and others cannot.
>
> here, i turned off the tips and am quite enjoying the constant
> re-generation. let's call this a snowflake
> http://100.117.55.104:4627/experiments/artdeco/?s=___f______9_A5lBiZjDMMwjCCFDAtAAAQlAFAAAAKAAMtAACjARFkVQAKwI

## 2026-10-17 — hyper cube

> hyper cube
> http://100.117.55.104:4627/experiments/artdeco/?s=___f________cAOZQYmYwzDMIwghQwLQAAEJQBQAAACgADLQAAowERZFUACsiG2M

## 2026-10-17 — frames

> i was wondering if we could make artdeco frames. so the pattern would evolve
> only on the edges of the screen and avoid coming into the center. it's like
> the margin setting only in reverse. i am thinking that I may use it as an
> overlay for videos or other things. or it could be embedded as a background
> on a web page.

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
  behind, and a new drawing starts as soon as the last tip stops). The
  primary was on the first until 2026-10-17, when Andrei made the construct
  primary, which flows.
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
- **Answers to the third round** (2026-10-16), each a setting:
  - _Birth in the same spot_: `wander` moves each pair of stems by up to that
    share of the gap, afresh each drawing; 0 keeps your construct's behaviour.
    Not built: stems placed as a share of the width, not the height.
  - _Threes as the same decision three times_: `in threes`, `threes of` and
    `beat`. One offshoot (`offshoots` 1) in threes gives your three parallels.
    Repeats are drawn per decision, so they only happen some of the time.
  - _The circle always the same size_: `big circle varies`, per drawing. Small
    circles already had `jitter`.
  - _4 grows from a square_: `copies: to the edges` slides each copy out until
    its stems start at the frame's edge.
  - _Vertical bias_: `rise` lengthens upright stretches and, at the same odds,
    makes turns lean back towards upright. Two mechanisms under one slider; if
    you want them apart, that is a split.
  - _Strands_: joins at turns are now mitred, and `strands on: stems only`
    bands the stems alone. Splits still start in the middle of a band.
  - _Replay_: two live loads of the construct used to diverge within seconds,
    because the drawing depended on frame length. Growth now runs in fixed
    ticks, so a replay is the same drawing. **The construct you saw was one of
    those frame-dependent drawings**; the preset now grows the fixed one, which
    may not be the exact picture you fell for.
- **Four to the edges** (2026-10-16). The three circles were the big circle
  slid out with each side copy; it now turns with the copies but never slides,
  so one on the centre stays one. The cut-offs: with slid copies every copy
  shares one growth, so a line stopping at the circle in one copy stops in the
  others where nothing is drawn. That is not fixable while the sides are
  copies. So, to your question: the left and right do not have to mirror the
  up and down. `sides: their own` (at 4) grows stems in from the side edges
  that decide for themselves, mirrored left to right and top to bottom, and
  meet the bottom and top drawing. Preset 15, crossroads, is your scene that
  way. Not built: sides with a different stem count, gap or angle from the
  bottom.
- **Busyness** (2026-10-17). Built as you described it, in a group of its own.
  _crowded at_ is how many visible lines near a point, from every drawing on
  screen, count as fully busy. _hush_ raises the odds of stopping there, at
  decisions and meetings. _infect_ is the odds that a line a tip crosses in a
  busy place starts dissolving from the crossing, a gap widening both ways at
  the speed lines grow. _contagion_ is the odds the dissolving carries on into
  the next line at each turn, split or meeting it reaches. Measured on the
  construct with life 30: 14.6% of the frame lit and climbing without it, near
  7% and steady with infect and contagion at 0.2 (preset 17, construct,
  thinned). Higher than about 0.4 contagion and it eats the whole drawing.
  Open: dissolving only passes along joints a line made while growing, so it
  does not jump to a line from an older drawing that merely crosses it; and a
  dissolving line could make other decisions on the way (turn back, stop
  early), which is not built.
- **The permanent circle** (2026-10-17). It was a stack: in flow every drawing
  draws its own big circle in the same place, three or four on screen at once,
  so a gap dissolving in one was covered by the next. Now controllable:
  _circle odds_ (some drawings have none), _circle drift_ (its height wanders),
  the big circle dissolves under _infect_ like a line, and _shy_ keeps a
  drawing from adding one while an older one still shows. With shy at 1 there
  is never more than one, and it fades or dissolves before another comes.
  Preset 18, construct, breathing, is your derivative with these on.
- **Circles crowding**: _shy_. Each visible circle within a radius, edge to
  edge (mirror images and the big circle included), makes a new one that much
  more likely to be left out. On your scene with corner circles at 0.6: 70
  placed in two minutes without, 27 with shy at 0.8.
- **Tips instead of lines** (2026-10-17). Built as a second pen, so nothing you
  have changes: _pen: line_ is what there was, and every preset is on it.
  _pen: tips_ makes every stop a lift: the tip flies on drawing nothing and
  meeting nothing, still turning, splitting and echoing, until _land_ puts the
  pen down and it draws from wherever it is. _tips_ (line group) draws a dot on
  every tip so the flying ones show. Immortality is the open question, so it is
  a setting: _flight_ is how many decisions a lifted tip may make before it
  dies; the edge and depth still end tips too. Preset 19, pen up, is the spire
  this way. On the construct the tips pen is far denser, since branching tips
  no longer die where they meet; the busyness controls should be what tames it.
  Whether this is a pen or a piece of its own: it shares everything with the
  line pen, which is the case for a pen, and it reads differently enough that
  a piece is plausible. Yours to say once you have flown it.
- **Taming tips** (2026-10-17), all three of your ideas, each a setting:
  _toll_ (a split's cost: each line it makes starts that many decisions
  further through its depth, and a flying one further through its flight),
  _flock_ (the most tips flying at once; full, a flying tip cannot split and a
  line that would lift ends instead), and _dots to_ (only tips up to that many
  splits from a stem are drawn as dots). On pen up in flow, flying tips peaked
  at 1143 with none of them, 113 with toll 2, and exactly 60 with flock 60.
  Snowflake is preset 20, as you made it.
- **Frames** (2026-10-17). A group of its own, first in the panel. _frame_ is
  the margin turned inside out: a band that wide round the edges, as a share
  of the height, and the middle stays empty. Lines meet the middle's edge as
  they meet the screen's, and the middle is clipped, so a turned copy or a
  circle cannot carry anything into it. _shape_ is a box or the oval inside
  it. _at the middle_: stop, rebound, or rebound off the screen's edge too, so
  lines zigzag along the band. _backdrop: clear_ draws only the lines, for an
  overlay. Presets 22 and 23. On the construct at frame 15: stop leaves 8
  segments, rebound 33, edges too 61, and 156 with depth 30, against 175
  unframed. Not built: the band a different width on the sides than top and
  bottom; stems planted along the band rather than in the middle of each edge
  (the corners fill last); a soft edge to the middle rather than a hard clip;
  a page that serves the clear frame alone for embedding, with no chrome.
  Tips that are flying ignore the middle, so a tips-pen drawing can land in it
  and draw lines nobody sees.
