/**
 * The wall: every published scene, in the order it is shown.
 *
 * **Hand-curated, and deliberately not generated.** It was seeded once from
 * each piece's `PRESETS` and is an ordinary source file from then on. Nothing
 * regenerates it, so editing a preset does not silently republish anything —
 * which is the whole point of a published scene being frozen. Adding one is a
 * commit; removing one is a commit; re-ordering the wall is a commit.
 *
 * ## What an entry pins, and why it pins the runner by name
 *
 * `runner` is a filename under `public/showcase/runners/` — the exact bytes this
 * scene was published against, and never a lookup of whatever the piece builds
 * to now. Resolving it at build time would move every published scene onto the
 * newest bytes the moment a piece changed, which is exactly the "new defaults
 * changed my piece" failure the showcase exists to escape.
 *
 * **Naming a runner here is also what publishes it.** `pnpm run runners` builds
 * every piece into that directory as an untracked file; a runner joins the store
 * because an entry like these names it, and `pnpm run prune` removes tracked
 * ones nothing does. See
 * `src/experiments/docs/adr/20260912-the-store-holds-published-runners-only.md`.
 *
 * The cost is that changing a piece's code and rebuilding leaves entries
 * pointing at the previous runner. That is correct — they keep rendering what
 * they always rendered — and moving one is a deliberate edit here.
 * `tests/unit/showcase-runners.test.ts` fails if an entry names a runner that is
 * not committed, because the alternative is silent: the container empties, and
 * an empty container looks like a design decision.
 *
 * ## What this file may not do
 *
 * **It may not import a piece.** A scene is read by its runner and by nothing
 * else — a packed scene is positional, so only the registry that wrote it can
 * decode it. `src/showcase/` therefore holds strings it cannot interpret,
 * which is the same arrangement `gallery/embed.ts` is under and for the same
 * reason. See `src/experiments/docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`.
 */

export type WallEntry = {
  /** The address — `/showcase/<id>/`. Unique across the wall, and permanent once published. */
  id: string
  /** What the placard says. The scene's name, not the piece's. */
  title: string
  /** Which piece made it. Names a runner and a builder link; never an import. */
  piece: string
  pieceTitle: string
  /** A line about the scene, carried over from the preset it was seeded from. */
  note: string
  /** The frozen runner this scene was published against. A filename, not a URL. */
  runner: string
  /** The packed scene. Opaque here on purpose: only `runner` can read it. */
  scene: string
}

/**
 * Woven rather than grouped by piece.
 *
 * Seeding in the index's own order — most recently updated first — opened the
 * wall with eight consecutive Flotsam scenes, which reads as one piece with
 * variations rather than as a collection. Alternating costs something real:
 * consecutive entries sharing a runner swap in place and instantly, and
 * crossing pieces tears one down and mounts another. Judged worth it, and the
 * order is a source edit away from any other opinion.
 *
 * **Melting's `lava lamp` leads, on the rule every lead has: `/showcase/` is
 * entry zero and that is the newest published scene.** It is the piece's
 * primary, a scene Andrei found by dragging. Its other three — tempus, ora and
 * wax alone — are woven further down, one after every fifth entry. Andrei named
 * all four. Each runs on the wall clock, so every screen showing one shows the
 * same lamp.
 *
 * **Art Deco's `construct` led before it, on the same rule.** It is the piece's
 * primary, a scene Andrei found by playing with it. Its other four — snowflake,
 * facade, skyline and clockwork — are woven further down, one after every
 * fifth entry. Andrei named all five.
 *
 * **Hexgrid's `embers` led before it, on the same rule.** It is the piece's
 * primary, a scene Andrei found by dragging. Its other eleven presets are
 * woven further down, one after every fifth entry. Andrei asked for all of
 * them.
 *
 * **Dotfield's `meadow` led before it, on the same rule.** It is the piece's
 * primary. Its other seven — white, still, squall, eddies, islands,
 * wildflowers and slalom — are woven further down. Andrei asked for all of
 * its presets; meadow and white are scenes he found by dragging.
 *
 * **Streakers' `dimensions` led before it, on the same rule.** It is the piece's
 * primary. Its other five — saturn, rosette, random star, weave and club — are
 * woven further down. Andrei named all six; the piece has ten presets.
 *
 * **Crowd's `catch me` led before it, on the rule Bubbles and Embers led on:
 * `/showcase/` is entry zero and that is the newest published scene.** It is
 * also the piece's primary. `keep left` follows it, and `parade`, `teams`,
 * `runner` and `street run` are woven further down. Bubbles comes after
 * `keep left`.
 *
 * **Bubbles led before it, on the rule Embers led on.** Embers is second and its own argument is
 * unchanged — its piece has moved further since it was pinned than any of its
 * neighbours have, which is the freeze doing its job rather than a reason to
 * move it. `winter blues` renders the bytes it was published against, and what
 * Embers does next cannot reach it.
 *
 * It was pinned twice before it ever shipped, and the second pin is the only
 * kind that needs no argument: **a scene inside an unmerged branch has not been
 * published**, so there is nothing frozen to disturb. The first runner retired
 * embers *above* the exposure at which it still painted them, so they winked out
 * while faintly lit — see `SEEN` in the piece's `palette.ts`. Shipping that on
 * day one would have been publishing a known defect and then owing it the
 * freeze.
 *
 * **Five of Bubbles' eleven scenes are here, chosen rather than swept in.** It
 * is the first piece published from a selection. Every other piece was seeded
 * whole; this one arrived with eleven presets of which several exist to
 * demonstrate a control rather than to be looked at, and Andrei named the five.
 *
 * **Crowd's later scenes are the second selection**: of the ten added after it
 * was seeded, Andrei named six — catch me, keep left, parade, teams, runner and
 * street run. The six it was seeded with are all here.
 *
 * **Of the rest, twenty-nine of the pieces' thirty seeded presets are here.** The one missing is
 * Psyxels' `maker`, the only scene in any piece whose subject is a photograph
 * rather than a glyph. Its runner has no way to be handed an image, and how a
 * frozen runner carries an asset is undecided — see the note at the top of
 * `src/experiments/psyxels/runner.ts`. Its six glyph-drawn siblings needed
 * nothing and are here.
 */
export const WALL: readonly WallEntry[] = [
  {
    id: "melting-lava-lamp",
    title: "lava lamp",
    piece: "melting",
    pieceTitle: "Melting",
    note: "Andrei's, found by dragging: an icosahedron tumbling on a slow, hard-tipping beat and losing a corner now and then, among nine small lumps of a little wax that rise quickly and often split.",
    runner: "melting.6a752ab50c61.js",
    scene: "_____39xkt5R64lg3ipSLaUUOAABw4SjAAMAAAA",
  },
  {
    id: "artdeco-construct",
    title: "construct",
    piece: "artdeco",
    pieceTitle: "Art Deco",
    note: "Andrei's, from playing with it: folded top and bottom at 60°, three stems far apart, flowing, so each new drawing grows into what the last one left.",
    runner: "artdeco.b8c2c26d9d98.js",
    scene: "___f________cEnZwkSRpSCAowggwwLQAAcdSBQpgABAEjLEAAMgAoAFUAAYCh3w",
  },
  {
    id: "hexgrid-embers",
    title: "embers",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Small warm hexes, each blooming from a point of colour in its middle until a soft dark hole opens there and swallows it.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YSMFHCg8MlCiAweHFh4nAABR5SCTwVgZFqVd",
  },
  {
    id: "dotfield-meadow",
    title: "meadow",
    piece: "dotfield",
    pieceTitle: "Dotfield",
    note: "A field of columns seen from above, purple running into red, leaning together in a quick, veering wind as wide gusts sweep across.",
    runner: "dotfield.ef90bb509bb6.js",
    scene: "vov___9wLjQmSXxGDcXKlh4qgUjIwAAEAAKsiEZNcDwhNVCRGAAG",
  },
  {
    id: "streakers-dimensions",
    title: "dimensions",
    piece: "streakers",
    pieceTitle: "Streakers",
    note: "A screen filled with lines of dots, all travelling one way, each line at its own speed and letting its dots go at random — plainly lines, and never a fixed structure.",
    runner: "streakers.7286d5bcf698.js",
    scene: "-_-fQDRhKtAFgPScGgAxpAABaAAAA",
  },
  {
    id: "crowd-catch-me",
    title: "catch me",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "A market whose stalls nobody can see, and one person in red I am trying to catch. They duck round corners and wait for me to nearly reach them; my eyes go between them and the way ahead. The red head looks like the subject for a moment — the subject is whoever is doing the chasing.",
    runner: "crowd.9810eb51f4a2.js",
    scene: "_-__7___QF8syctZLJ4JCqihtGAAAo-hVSe4AABoAAkABQ6oCkAABQ4",
  },
  {
    id: "melting-tempus",
    title: "tempus",
    piece: "melting",
    pieceTitle: "Melting",
    note: "The lava lamp at its steadiest: a lopsided icosahedron that now and then turns into another solid, over a bottomless pool whose surface the beats heap region by region.",
    runner: "melting.6a752ab50c61.js",
    scene: "_____39xktlR64lg6FJSLaUUOAABw4R5UwNRgAA",
  },
  {
    id: "crowd-keep-left",
    title: "keep left",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "A two-way trail winding over a hill, and everybody keeps left — my stream on one half, the people coming towards me on the other. Nothing draws the trail. It is the shape the crowd makes following it, two ribbons of heads running off into the distance and lifting over the rise.",
    runner: "crowd.9810eb51f4a2.js",
    scene: "_-__7___QE_IyQUJSxwJiySiPDFAAol5_yAMADxoAw4UCgwoACgAAA4",
  },
  {
    id: "artdeco-snowflake",
    title: "snowflake",
    piece: "artdeco",
    pieceTitle: "Art Deco",
    note: "Andrei's: six-fold at 60°, on the tips pen with the dots off, so lines lift and land unseen, and busyness keeps the regeneration from filling the frame.",
    runner: "artdeco.b8c2c26d9d98.js",
    scene: "___f________cAOZQYmYwzDMIwghQwLQAAEJQBQAAACgADLQAAowERZFUACsCB3w",
  },
  {
    id: "bubbles-time-bubbles",
    title: "time bubbles",
    piece: "bubbles",
    pieceTitle: "Bubbles",
    note: "Water from directly above, with four jets turning the same way somewhere underneath it. Nothing holds together for long at this depth — the boil shreds a bubble almost as fast as it arrives — so what you are watching is not really the bubbles. It is the flow they are written in, several thousand specks each dragging its own wake.",
    runner: "bubbles.b1f1e25e4c22.js",
    scene: "_4_177vX_0BiMTEjANGtCgUSTRIAZybEKnQA0aIK6CADLZzA-4gfiAQA",
  },
  {
    id: "hexgrid-drift",
    title: "drift",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Wide gaps, bright outlines and hues from all round the wheel, colour drifting slowly out of a few dark centres dropped at random.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YgejsUsI7kB6YgWIDAgGAAB4DCBVoVgZBQYA",
  },
  {
    id: "embers-winter-blues",
    title: "winter blues",
    piece: "embers",
    pieceTitle: "Embers",
    note: "A fire four metres across, seen from a metre away, so there is no column to look at — only what crosses: white-hot where an ember is burning hardest, deep blue as it cools, and the splinters arriving in fans. Its colours are a blackbody's, rotated off the Planck curve rather than chosen.",
    runner: "embers.da2cfdf8bf93.js",
    scene: "____-0AW29AnEGQE_EY9a0YGERRZLojAtkAMMqLEI",
  },
  {
    id: "melting-ora",
    title: "ora",
    piece: "melting",
    pieceTitle: "Melting",
    note: "Tempus in colour: every corner and every lump wears one of four colours the stream picks — a corner turns to a new one every few beats, a lump takes one each time it leaves the pool.",
    runner: "melting.6a752ab50c61.js",
    scene: "_____39xktlR64lg6FJSLaUHvAABw4R5UwNRgGA",
  },
  {
    id: "crowd-market",
    title: "market",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "A busy square at eye level, walked slowly, stopping to look, with three people alongside. Everyone is a white circle and the only thing you know about them is how high their head is and where it is going.",
    runner: "crowd.55724c73cfc2.js",
    scene: "____cF8syctZLJ6ppCqihtGGgAoXoRSe7",
  },
  {
    id: "dotfield-white",
    title: "white",
    piece: "dotfield",
    pieceTitle: "Dotfield",
    note: "Thin white dots on stiff stalks set wide apart, each tipping on its base and ringing long after the wind has passed.",
    runner: "dotfield.ef90bb509bb6.js",
    scene: "vov___9wOgBcqyaCCIAKhNokkKAZAAAUAAJQOYZPANBaFGRRaApi",
  },
  {
    id: "artdeco-facade",
    title: "facade",
    piece: "artdeco",
    pieceTitle: "Art Deco",
    note: "Folded twice: three stems from the bottom and their images from the top, square turns inside a frame, growing towards each other until they meet in the middle.",
    runner: "artdeco.b8c2c26d9d98.js",
    scene: "___f________cEIggYaYYVCAQxCCwwLQAAUJQQwCAACgADIEAAMgAoAFUAAYCh3w",
  },
  {
    id: "streakers-saturn",
    title: "saturn",
    piece: "streakers",
    pieceTitle: "Streakers",
    note: "Seventy-seven fine lines rising slowly to the upper right, the dots a little more even than random.",
    runner: "streakers.7286d5bcf698.js",
    scene: "-_-fQAmUetAFgEB8EBgR2gAA5AAAA",
  },
  {
    id: "flotsam-offing",
    title: "offing",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "Open water at night, a gusting sea running diagonally, a slow current crossing it — close enough in to read the shape of each wave rather than the pattern they make.",
    runner: "flotsam.b2c2cc0608a3.js",
    scene: "_____2AAApg-AAhWZMoefOEiIhWqrJNnYMfAUFyA8ZKB8UJgwADrig",
  },
  {
    id: "melting-wax-alone",
    title: "wax alone",
    piece: "melting",
    pieceTitle: "Melting",
    note: "Only the wax, rising, splitting, gathering and sinking, with no solid among it.",
    runner: "melting.6a752ab50c61.js",
    scene: "_____39xkt5R64linoJYQUoUOAABw4QDAAMAAAA",
  },
  {
    id: "hexgrid-even",
    title: "even",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Each hex comes in and goes out at the same pace, the fading retracing the bloom across the grid.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YGeXdUsI7kB6IQWEDAgGAAB4DBCTwlgMptCA",
  },
  {
    id: "psyxels-alive",
    title: "alive",
    piece: "psyxels",
    pieceTitle: "Psyxels",
    note: "Every hue at once, packed fine and overlapping, with the levels above showing through — and a word rather than a letter, so the field has to hold five shapes and the spaces between them.",
    runner: "psyxels.3d3ba1c0d12f.js",
    scene: "______9AnD0SngHypCDFYIYIDjmQ3gBAAPogRbxfCDYMEtG4qoxXM",
  },
  {
    id: "crowd-concourse",
    title: "concourse",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "One axis, half of it coming at me, and me walking faster than most of it. This is where the files form — nothing in the code knows what a lane is.",
    runner: "crowd.55724c73cfc2.js",
    scene: "____cHe4yOQRr5kYJixyxRQGIAoGfBwD4",
  },
  {
    id: "artdeco-skyline",
    title: "skyline",
    piece: "artdeco",
    pieceTitle: "Art Deco",
    note: "Rising: upright runs four times as long, turns leaning back to upright, single offshoots in threes, and the stems drawn as double rules.",
    runner: "artdeco.b8c2c26d9d98.js",
    scene: "___f________cIMggYaYYTlAAxCCwwLQAANNQNIAgACgADIABzsYIoAFUAAYCh3w",
  },
  {
    id: "dotfield-still",
    title: "still",
    piece: "dotfield",
    pieceTitle: "Dotfield",
    note: "Almost no wind: a square grid of dots, kept alive by a breath of swirl.",
    runner: "dotfield.ef90bb509bb6.js",
    scene: "vov___9wKEg0AAAUEsmFaRk3AAgsgAAMAAAeRgMSIB60CgAa0AAG",
  },
  {
    id: "walkers-chalky",
    title: "chalky",
    piece: "walkers",
    pieceTitle: "Walkers",
    note: "Nothing drawn but where people went, in chalk on slate. Andrei's, found with the sliders.",
    runner: "walkers.6daa00b20e51.js",
    scene: "____YHhmNHgAxzoCSY2CWAATOyNcwq",
  },
  {
    id: "dangler-dreamy",
    title: "dreamy",
    piece: "dangler",
    pieceTitle: "Dangler",
    note: "Six arms of long, all but limp strands in cold blue, falling past you, everything barely moving.",
    runner: "dangler.24e68564770d.js",
    scene: "____f0vRtmOcQjJtlcCJmt8jAYgo-EQQAsXQioQDI",
  },
  {
    id: "hexgrid-breath",
    title: "breath",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Colour breathes across the grid: a slow inhale, a short pause full, a longer exhale, a moment of dark.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YGeXdUsI7kB6IQUEMgEpAAB4DBCTwlgYBtCA",
  },
  {
    id: "streakers-rosette",
    title: "rosette",
    piece: "streakers",
    pieceTitle: "Streakers",
    note: "Lines from a ring all round the screen, each turned the same few degrees off the middle, so their crossings draw a hole.",
    runner: "streakers.7286d5bcf698.js",
    scene: "-_-fQI7gA0AGAjJsFAA2WAABIAMHg",
  },
  {
    id: "artdeco-clockwork",
    title: "clockwork",
    piece: "artdeco",
    pieceTitle: "Art Deco",
    note: "Andrei's: four with sides of their own, two stems each way at 60°, a small cut-out circle that changes size every drawing, flowing.",
    runner: "artdeco.b8c2c26d9d98.js",
    scene: "___f________cDAagkSQ5SFEQwggwwLQAAc9SAIQgABACbLOoJElMoAFUAAYCh3w",
  },
  {
    id: "crowd-the-street",
    title: "the street",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "A seven-metre street with two streams in it. Nobody can go round, so the only way past anybody is to overtake them or to wait.",
    runner: "crowd.55724c73cfc2.js",
    scene: "____cFnIyQcRThzoZSxihdfGQAoNlOYAh",
  },
  {
    id: "starry-night-deep-field",
    title: "deep field",
    piece: "starry-night",
    pieceTitle: "Starry Night",
    note: "Many faint layers on a dark sky. The starting point.",
    runner: "starry-night.490e5f9452c8.js",
    scene: "__9ADSDBSQfRYeR7imQ",
  },
  {
    id: "crowd-parade",
    title: "parade",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "Walking in a parade, at the pace of everybody around me, with a crowd three deep standing on both kerbs to watch it pass. The stationary crowd is what moves.",
    runner: "crowd.9810eb51f4a2.js",
    scene: "_-__7___QDvIAQUB6pwJiyyh1fA4Aoo15wA40gBoAAkAFQ0oACgAAA4",
  },
  {
    id: "dotfield-squall",
    title: "squall",
    piece: "dotfield",
    pieceTitle: "Dotfield",
    note: "Tall soft stems in crop rows, thrown about by strong gusts from every side, overshooting and ringing.",
    runner: "dotfield.ef90bb509bb6.js",
    scene: "vov___9wFCCFVDy-CgKUChQeAeoHgAAcAAbwIIUKUGR4KHjCWAAG",
  },
  {
    id: "hexgrid-swallow",
    title: "swallow",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Each hex leaves by its dark middle widening until it swallows the hex, the colour bright to the last.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YGeXdUsI7kB6IQWEDAgNAAB4DBCTwlgMptCB",
  },
  {
    id: "streakers-random-star",
    title: "random star",
    piece: "streakers",
    pieceTitle: "Streakers",
    note: "Emitters placed at random on a circle off screen, every line through the middle.",
    runner: "streakers.7286d5bcf698.js",
    scene: "-_-fQIdgCtAFgtK8GABEUAAAoAAAA",
  },
  {
    id: "bubbles-foam",
    title: "foam",
    piece: "bubbles",
    pieceTitle: "Bubbles",
    note: "Films that hold, so two bubbles that touch stay neighbours instead of becoming one. The surface packs into a raft and keeps its structure — which is the only reason foam exists at all, and the thing a bubble that joins whatever it meets can never make.",
    runner: "bubbles.b1f1e25e4c22.js",
    scene: "_4_177vX_0BgWEDxQM8PIggb1pkYIBC8EYjHwsKCKXxkcGYo7WgGCh6A",
  },
  {
    id: "flotsam-windrows",
    title: "windrows",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "One swell carrying almost everything, and the flotsam collected into travelling lines with the light along them.",
    runner: "flotsam.b2c2cc0608a3.js",
    scene: "_____2AADQi7AAhWZCYQeEGGFZTrSpFBQIRQMDcAyZKqKUKggALVDw",
  },
  {
    id: "crowd-standing-still",
    title: "standing still",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "I stop, and the square goes round me. Nothing moves the frame but my own breathing and my head.",
    runner: "crowd.55724c73cfc2.js",
    scene: "____cG1kyc5BDSIFISjCiNBG8AoyqVIe5",
  },
  {
    id: "psyxels-neon",
    title: "neon",
    piece: "psyxels",
    pieceTitle: "Psyxels",
    note: "Fine grain at a high threshold, half-solid, spread across the whole wheel: tube light rather than ink.",
    runner: "psyxels.3d3ba1c0d12f.js",
    scene: "______9AnD0QnIGJitjvD5wolWo1HgBcAD0xQdcjIwEdjtBkxe5Bo",
  },
  {
    id: "hexgrid-swallow-breath",
    title: "swallow breath",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "The breath by the hole: each hex arrives as a bright rim whose hole closes in, and leaves as the hole widens to swallow it.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YGeXdUsI7kB6IQUEMgEpAAB4DBCTwlgYBtCF",
  },
  {
    id: "walkers-bacteria",
    title: "bacteria",
    piece: "walkers",
    pieceTitle: "Walkers",
    note: "Far enough up that people are motile specks. Found by accident and kept.",
    runner: "walkers.6daa00b20e51.js",
    scene: "____YFyGa_gA-XbqDKQAAHNLsyUVmQ",
  },
  {
    id: "crowd-the-far-end",
    title: "the far end",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "A thinner crowd seen much further, which is where it stops being people and becomes texture. It has no edge — it simply runs out.",
    runner: "crowd.55724c73cfc2.js",
    scene: "____cBdGtUopThaBLy5yTW2mUAodszye4",
  },
  {
    id: "dangler-together",
    title: "together",
    piece: "dangler",
    pieceTitle: "Dangler",
    note: "A tight low cluster, strands plumb and plunging past you, all of it moving.",
    runner: "dangler.24e68564770d.js",
    scene: "____fwAAdiEOCQSgCAAAIvIaAEwfKEJSZEwZgCwEY",
  },
  {
    id: "crowd-runner",
    title: "runner",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "A two-way trail winding over a hill, both streams keeping to their sides — and me the only one running, down the gap between them, my stream falling back towards me and the other coming at me twice as fast.",
    runner: "crowd.9810eb51f4a2.js",
    scene: "_-__7___QE_IyQUJSxwJixiiPDAUApFxryAUADxoAw4UCiApQCgAAA4",
  },
  {
    id: "dotfield-eddies",
    title: "eddies",
    piece: "dotfield",
    pieceTitle: "Dotfield",
    note: "No steady breeze, only eddies: the field turns in slow whorls.",
    runner: "dotfield.ef90bb509bb6.js",
    scene: "vov___9wFChAWgAPEEcKVS0a4ojGQAAwAAQURhGHMFAAAAAi0AAG",
  },
  {
    id: "hexgrid-glow",
    title: "glow",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "The dark middle is always there; colour comes out of it and spreads to the edges, then the hole grows until it swallows the hex.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YGeXGUsI7kB6IQUTMgEpAAB4DBCTwlhABtCJ",
  },
  {
    id: "streakers-weave",
    title: "weave",
    piece: "streakers",
    pieceTitle: "Streakers",
    note: "Five hundred lines at random angles in shades of one colour, crossing every which way until the screen is full.",
    runner: "streakers.7286d5bcf698.js",
    scene: "-_-fQL5gCtPFgPOsHAAp9AACpgLPA",
  },
  {
    id: "starry-night-clay",
    title: "clay",
    piece: "starry-night",
    pieceTitle: "Starry Night",
    note: "Dark stars pressed into a warm light ground.",
    runner: "starry-night.490e5f9452c8.js",
    scene: "__9ALCzDvUi1YyAPAyI",
  },
  {
    id: "crowd-waist-high",
    title: "waist high",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "The same square from a child's eyes. Every adult is a ceiling and the other children are the only faces.",
    runner: "crowd.55724c73cfc2.js",
    scene: "____cGMyye9RLByZxzbC6E8GwApWCg-e5",
  },
  {
    id: "flotsam-crossing",
    title: "crossing",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "Nine trains from every quarter and none of them dominant — a confused sea that gathers in patches rather than lines.",
    runner: "flotsam.b2c2cc0608a3.js",
    scene: "_____2AABNfBAAhqZMQkhQCCK3WikZkHgMfQYHvA8ZKAoZMhQAWRJY",
  },
  {
    id: "crowd-teams",
    title: "teams",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "The parade thinned out into teams — blocks of ten walking together, spaced along the way with empty road between, and me at the back of one of them.",
    runner: "crowd.9810eb51f4a2.js",
    scene: "_-__7___QAnIAoACCZwKCyyh1rkYAo602EBI0gBooAkAlQyoACgAAA4",
  },
  {
    id: "hexgrid-bloom",
    title: "bloom",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Each hex runs through its gradient: a point of colour grows to fill it, a hole forms in its middle, and widens into darkness.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YGeXGUsI7kB6IQUTMgEpAAB4DBCTwlhABtCN",
  },
  {
    id: "dotfield-islands",
    title: "islands",
    piece: "dotfield",
    pieceTitle: "Dotfield",
    note: "Fine stems in patches of sharply different colour, every colour somewhere in the field.",
    runner: "dotfield.ef90bb509bb6.js",
    scene: "vov___9wDBgsyDJQFUcKeFoOZVlqAABUAAh4RgeQkDI8D1BA8AAG",
  },
  {
    id: "bubbles-ring-breathing",
    title: "ring, breathing",
    piece: "bubbles",
    pieceTitle: "Bubbles",
    note: "A closed tub has to give back everything its jets push out, and somewhere between them the two cancel exactly. Foam carried outward arrives at that radius and can go no further; foam beyond it is brought back. Nothing places the ring — it falls out of the arithmetic — and with a little churn underneath it grows lobes and wanders instead of holding a circle.",
    runner: "bubbles.b1f1e25e4c22.js",
    scene: "_4_177vX_0BiMTEhQNGtRgUSTRIAZ0zEKnQA0aIK6FADLZzA-4gfiAQA",
  },
  {
    id: "psyxels-ampersand",
    title: "ampersand",
    piece: "psyxels",
    pieceTitle: "Psyxels",
    note: "A script ampersand, held still and lit from within: no frame changes at all, only breathing.",
    runner: "psyxels.3d3ba1c0d12f.js",
    scene: "______9AnD0ZGwGJitjvH5woAWmBngBcAfshQdgBaK6djtJUxyI2Q",
  },
  {
    id: "streakers-club",
    title: "club",
    piece: "streakers",
    pieceTitle: "Streakers",
    note: "Huge discs in every colour, sparse and drifting across each other at random angles.",
    runner: "streakers.7286d5bcf698.js",
    scene: "-_-fQJ3ACzWkgDEKVgJ0ugACtKUtA",
  },
  {
    id: "crowd-street-run",
    title: "street run",
    piece: "crowd",
    pieceTitle: "Crowd",
    note: "Running with three others at my shoulder down a street that bends and straightens, a standing crowd on both kerbs the whole way.",
    runner: "crowd.9810eb51f4a2.js",
    scene: "_-__7___QADIAAACCZwKCySh2RBQApYMmsAg0FBQAAkANR4oACgAAA4",
  },
  {
    id: "hexgrid-ebb",
    title: "ebb",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Light rises out of each hex's dark middle to its edges, then draws back in until it is gone into the hole.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YGeXGUsI7kB6IQUTMgEpAAB4DBCTwlhABtCK",
  },
  {
    id: "walkers-busy",
    title: "busy",
    piece: "walkers",
    pieceTitle: "Walkers",
    note: "Nobody with anybody, all going the same way, from high enough up that a person is a point of light.",
    runner: "walkers.6daa00b20e51.js",
    scene: "____YAzaD3gRCX4GRWQAAHqT4yUAo2",
  },
  {
    id: "dangler-frantic",
    title: "frantic",
    piece: "dangler",
    pieceTitle: "Dangler",
    note: "Fifty-one short strands crammed almost overhead, hot pink through green, hit hard and often.",
    runner: "dangler.24e68564770d.js",
    scene: "____fwAAdkEOAAZQAt-TovIaAob7KEJSZiAAZEQAA",
  },
  {
    id: "starry-night-alive",
    title: "alive",
    piece: "starry-night",
    pieceTitle: "Starry Night",
    note: "Short lifespans and frequent flares, so the sky never settles.",
    runner: "starry-night.490e5f9452c8.js",
    scene: "__9AEazEZQXRYsBwhSY",
  },
  {
    id: "dotfield-wildflowers",
    title: "wildflowers",
    piece: "dotfield",
    pieceTitle: "Dotfield",
    note: "Columns of many heights seen from a low camera, tall ones swaying slower, their sides showing toward the edges.",
    runner: "dotfield.ef90bb509bb6.js",
    scene: "vov___9wKDhUHjJQEESKpSMkQejLQAAWgyJ4RgZPADxQFFBRQKAG",
  },
  {
    id: "flotsam-riptide",
    title: "riptide",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "Chop over a hard swirling current: the lines the waves gather are torn apart as fast as they form.",
    runner: "flotsam.b2c2cc0608a3.js",
    scene: "_____2ACRgi7AAAuZKgwoKAtBzVo0gWFwyBigAbhkZKr6QngoAFFCg",
  },
  {
    id: "hexgrid-vivid-dark",
    title: "vivid dark",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "A few dark centres, colour travelling several rings out from each, neighbours apart in hue and alike in lightness.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YIcKKjBkeEix4woKHCgdAAAYA9CTwVgZBQYA",
  },
  {
    id: "psyxels-mono",
    title: "mono",
    piece: "psyxels",
    pieceTitle: "Psyxels",
    note: "One hue and almost no colour: the packing and its light, and nothing else to look at.",
    runner: "psyxels.3d3ba1c0d12f.js",
    scene: "______9AnD0RmALNu6TLbDgoAWo1F4AYAD0xQCgo8wEc-FHoABlsA",
  },
  {
    id: "bubbles-slick",
    title: "slick",
    piece: "bubbles",
    pieceTitle: "Bubbles",
    note: "Soapy water: barely any gas, films that will hold a big bubble together, and coalescing so rare that two bubbles can rest against each other for ten seconds before they join. A few large circles drift, gather, and burst.",
    runner: "bubbles.b1f1e25e4c22.js",
    scene: "_4_177vX_0BUYGDxANSJGAgcNZ4kQBS4M5FIZEMAcXyV-jTptUACRh7Q",
  },
  {
    id: "flotsam-pond",
    title: "pond",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "Four metres of water with dust on it, lit from almost overhead. Small water is quick, which is the surprise.",
    runner: "flotsam.b2c2cc0608a3.js",
    scene: "_____2AAKUJ7AAAWZCwIVGAFAoKnj6WDQBlgCAPBkZLR4jPiQAB9Hg",
  },
  {
    id: "dotfield-slalom",
    title: "slalom",
    piece: "dotfield",
    pieceTitle: "Dotfield",
    note: "Tall straight poles on springy bases, tipping and snapping back without curling, like gates on a slalom course.",
    runner: "dotfield.ef90bb509bb6.js",
    scene: "vov___9wdCkkCiiCHMNKAo8toUl0AAAkAAB4LQPNcFBaFGRh4AyK",
  },
  {
    id: "psyxels-maybe",
    title: "maybe",
    piece: "psyxels",
    pieceTitle: "Psyxels",
    note: "Few frames, big psyxels, slow repacking: the field as a sign rather than a texture.",
    runner: "psyxels.3d3ba1c0d12f.js",
    scene: "______9AADA4m5aONAQLbDQoAWo1F4BgAB0xQIAdaCLScYBkxq0GQ",
  },
  {
    id: "hexgrid-flowers",
    title: "flowers",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Every seventh hex a dark centre, each ringed by six petals of different hues, the flowers fitting together exactly.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YIYGIZBQ8VCZ4ooYHCgdAAA5AACTwVgZBQYA",
  },
  {
    id: "flotsam-migration",
    title: "migration",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "A hard cross-current under a slack, wide-open sea, carrying a warm scatter of everything somewhere else.",
    runner: "flotsam.b2c2cc0608a3.js",
    scene: "_____2AADQNjgAA4ZCZvPEAVHQlExFCHBSVaOAKCUZD5EUMggAE0Cg",
  },
  {
    id: "psyxels-luna",
    title: "luna",
    piece: "psyxels",
    pieceTitle: "Psyxels",
    note: "The word as a hole again, and everything around it held: one grain everywhere rather than a range of them, and every psyx keeping the mark and the colour it was dealt. Made of the four that are drawn rather than built — a moon, a star, a heart and a leaf — each facing whichever way it was born facing, so the field reads as things strewn about rather than as signs stamped in rows — and nothing moves in it but the breath.",
    runner: "psyxels.3d3ba1c0d12f.js",
    scene: "______9AnD0W34BgyBj4D5wAODMxfmRfMAJBcAADIjnirtABHfyw4",
  },
  {
    id: "flotsam-simmer",
    title: "simmer",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "A field of violet points that hold their places and breathe, in a haze that moves around them.",
    runner: "flotsam.b2c2cc0608a3.js",
    scene: "_____2AADQPoAHEHdQEUwKBdOEIrTRQroIgCkCHBDZKA-GuHoC7HZA",
  },
  {
    id: "flotsam-dream",
    title: "dream",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "White water with flotsam-shaped holes in it: overlapping pieces blown past white, and the only dark left is the gaps between them.",
    runner: "flotsam.b2c2cc0608a3.js",
    scene: "_____2AADQEfg3zKdny0AEAVHQlExFCHBSVaOAKCUyECInEwCoE0Hg",
  },
  {
    id: "bubbles-surging",
    title: "surging",
    piece: "bubbles",
    pieceTitle: "Bubbles",
    note: "Every jet surging on its own clock, a few seconds long and never in step with its neighbours, so the surface never settles into anything and stays there.",
    runner: "bubbles.b1f1e25e4c22.js",
    scene: "_4_177vX_0BgYEGR4gyXHiCCMo9IIBS6GPLWwcIA6XwyXLWIPMgd1B8g",
  },
  {
    id: "hexgrid-deep-sea",
    title: "deep sea",
    piece: "hexgrid",
    pieceTitle: "Hexgrid",
    note: "Large hexes, wide gaps, blues and greens, darker edges and a slow breath.",
    runner: "hexgrid.a3f75667cc77.js",
    scene: "v____P8YE2QMaRaPUB6Ig8UMDIxAAB4BlCTwVgZBQYA",
  },
]

/** Where a runner is served from. The one place the path is spelled out. */
export const runnerUrl = (entry: WallEntry): string => `/showcase/runners/${entry.runner}`

/** What sits either side of an entry. `null` at the ends: the wall has a top and a bottom. */
export function neighbours(id: string): { previous: WallEntry | null; next: WallEntry | null } {
  const at = WALL.findIndex((entry) => entry.id === id)
  if (at < 0) return { previous: null, next: null }
  return { previous: WALL[at - 1] ?? null, next: WALL[at + 1] ?? null }
}
