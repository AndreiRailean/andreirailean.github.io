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
 * `runner` is a filename under `public/showcase/runners/`, not a piece's
 * current runner looked up in the manifest. Those are different things and the
 * difference is the freeze: the manifest says what a piece's runner is *now*,
 * and an entry says what this scene was published *against*. Reading the
 * manifest here would move every published scene onto the newest build the
 * moment a piece changed, which is exactly the "new defaults changed my piece"
 * failure the showcase exists to escape.
 *
 * The cost is that changing a piece's code and rebuilding leaves entries
 * pointing at the previous runner. That is correct — they keep rendering what
 * they always rendered — and moving one is a deliberate edit here.
 * `tests/unit/showcase-wall.test.ts` fails if an entry names a runner that is
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
 * **Twenty-three of the twenty-four presets are here.** The one missing is
 * Psyxels' `maker`, the only scene in any piece whose subject is a photograph
 * rather than a glyph. Its runner has no way to be handed an image, and how a
 * frozen runner carries an asset is undecided — see the note at the top of
 * `src/experiments/psyxels/runner.ts`. Its six glyph-drawn siblings needed
 * nothing and are here.
 */
export const WALL: readonly WallEntry[] = [
  {
    id: "flotsam-offing",
    title: "offing",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "Open water at night, a gusting sea running diagonally, a slow current crossing it — close enough in to read the shape of each wave rather than the pattern they make.",
    runner: "flotsam.b08fcae289b9.js",
    scene: "_____2AAApg-AAhWZMoefOEiIhWqrJNnYMfAUFyA8ZKB8UJgwADrig",
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
    runner: "dangler.b1ea8731e234.js",
    scene: "____f0vRtmOcQjJtlcCJmt8jAYgo-EQQAsXQioQDI",
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
    id: "flotsam-windrows",
    title: "windrows",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "One swell carrying almost everything, and the flotsam collected into travelling lines with the light along them.",
    runner: "flotsam.b08fcae289b9.js",
    scene: "_____2AADQi7AAhWZCYQeEGGFZTrSpFBQIRQMDcAyZKqKUKggALVDw",
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
    id: "walkers-bacteria",
    title: "bacteria",
    piece: "walkers",
    pieceTitle: "Walkers",
    note: "Far enough up that people are motile specks. Found by accident and kept.",
    runner: "walkers.6daa00b20e51.js",
    scene: "____YFyGa_gA-XbqDKQAAHNLsyUVmQ",
  },
  {
    id: "dangler-together",
    title: "together",
    piece: "dangler",
    pieceTitle: "Dangler",
    note: "A tight low cluster, strands plumb and plunging past you, all of it moving.",
    runner: "dangler.b1ea8731e234.js",
    scene: "____fwAAdiEOCQSgCAAAIvIaAEwfKEJSZEwZgCwEY",
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
    id: "flotsam-crossing",
    title: "crossing",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "Nine trains from every quarter and none of them dominant — a confused sea that gathers in patches rather than lines.",
    runner: "flotsam.b08fcae289b9.js",
    scene: "_____2AABNfBAAhqZMQkhQCCK3WikZkHgMfQYHvA8ZKAoZMhQAWRJY",
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
    runner: "dangler.b1ea8731e234.js",
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
    id: "flotsam-riptide",
    title: "riptide",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "Chop over a hard swirling current: the lines the waves gather are torn apart as fast as they form.",
    runner: "flotsam.b08fcae289b9.js",
    scene: "_____2ACRgi7AAAuZKgwoKAtBzVo0gWFwyBigAbhkZKr6QngoAFFCg",
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
    id: "flotsam-pond",
    title: "pond",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "Four metres of water with dust on it, lit from almost overhead. Small water is quick, which is the surprise.",
    runner: "flotsam.b08fcae289b9.js",
    scene: "_____2AAKUJ7AAAWZCwIVGAFAoKnj6WDQBlgCAPBkZLR4jPiQAB9Hg",
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
    id: "flotsam-migration",
    title: "migration",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "A hard cross-current under a slack, wide-open sea, carrying a warm scatter of everything somewhere else.",
    runner: "flotsam.b08fcae289b9.js",
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
    runner: "flotsam.b08fcae289b9.js",
    scene: "_____2AADQPoAHEHdQEUwKBdOEIrTRQroIgCkCHBDZKA-GuHoC7HZA",
  },
  {
    id: "flotsam-dream",
    title: "dream",
    piece: "flotsam",
    pieceTitle: "Flotsam",
    note: "White water with flotsam-shaped holes in it: overlapping pieces blown past white, and the only dark left is the gaps between them.",
    runner: "flotsam.b08fcae289b9.js",
    scene: "_____2AADQEfg3zKdny0AEAVHQlExFCHBSVaOAKCUyECInEwCoE0Hg",
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
