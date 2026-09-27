/**
 * Which points in the parameter space are named — the piece's presets.
 *
 * Its own file because presets change for a different reason than the space
 * they sit in: curation, under Andrei's eye, where `settings.ts` changes when a
 * parameter does. The runner never imports this; see
 * `../docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 */
import type { Settings } from "@/experiments/flotsam/settings"

/**
 * Recorded scenes.
 *
 * The section's convention is that presets are recorded from exploration rather
 * than designed up front, so each one is written out in full rather than spread
 * over `DEFAULT_SETTINGS`. A scene someone found by dragging sliders should stay
 * the scene they found; inheriting the defaults would let it drift silently the
 * next time one of those is retuned.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "offing",
    hint: "Open water at night, a gusting sea running diagonally, a slow current crossing it — close enough in to read the shape of each wave rather than the pattern they make.",
    settings: {
      seed: 41,
      dots: 8500,
      smallest: 0.005,
      largest: 0.09,
      sizeMix: 0.5,
      hue: 202,
      hueSpread: 15,
      variance: 0.62,
      trains: 8,
      shortest: 3,
      longest: 11,
      steepness: 0.9,
      peak: 0.85,
      gusts: 0.5,
      heading: 155,
      spread: 59,
      drift: 0.06,
      bearing: 248,
      eddies: 0.1,
      gyre: 30,
      stokes: 0.6,
      exposure: 1,
      glint: 0.8,
      azimuth: 124,
      elevation: 52,
      shade: 0.38,
      gleam: 3,
      softness: 0,
      span: 6.21,
      playback: 0.2,
    },
  },
  {
    label: "windrows",
    hint: "One swell carrying almost everything, and the flotsam collected into travelling lines with the light along them.",
    settings: {
      seed: 208,
      dots: 9000,
      smallest: 0.005,
      largest: 0.09,
      sizeMix: 0.5,
      hue: 38,
      hueSpread: 8,
      variance: 0.6,
      // Three trains and nearly all of the steepness in one of them: as close to
      // a single clean swell as this piece gets, with just enough beside it to
      // stop the crests arriving on a beat. At a peak this sharp the water at a
      // crest is compressed four to one and the flotsam draws it for you.
      trains: 3,
      shortest: 4,
      longest: 7,
      steepness: 0.78,
      peak: 0.9,
      // Gusting, but the least of any scene here. This is the one that is
      // showing the lines themselves, so the wind is allowed to breathe the
      // spacing without ever pulling a line apart.
      gusts: 0.42,
      heading: 138,
      spread: 10,
      drift: 0.04,
      bearing: 138,
      eddies: 0.06,
      gyre: 18,
      stokes: 0.5,
      // The light runs along the swell, so the gathered line and the glitter
      // band land on top of one another and the windrow comes out gilded.
      exposure: 1,
      glint: 0.85,
      azimuth: 138,
      elevation: 52,
      shade: 0.42,
      gleam: 2,
      softness: 0,
      span: 16,
      playback: 0.3,
    },
  },
  {
    label: "crossing",
    hint: "Nine trains from every quarter and none of them dominant — a confused sea that gathers in patches rather than lines.",
    settings: {
      seed: 77,
      dots: 8000,
      smallest: 0.005,
      largest: 0.11,
      sizeMix: 0.5,
      hue: 196,
      hueSpread: 18,
      variance: 0.66,
      // The opposite end of `peak` from windrows, and the reason it is a control
      // rather than a constant: a flat spectrum over a wide fan is a sea with no
      // dominant wave in it at all.
      trains: 9,
      shortest: 1.4,
      longest: 14,
      steepness: 0.9,
      peak: 0.2,
      gusts: 0.7,
      heading: 200,
      spread: 60,
      drift: 0.06,
      bearing: 250,
      eddies: 0.12,
      gyre: 40,
      stokes: 0.6,
      exposure: 1,
      glint: 0.8,
      azimuth: 40,
      elevation: 62,
      shade: 0.5,
      gleam: 5,
      softness: 0,
      span: 30,
      playback: 0.75,
    },
  },
  {
    label: "riptide",
    hint: "Chop over a hard swirling current: the lines the waves gather are torn apart as fast as they form.",
    settings: {
      seed: 9312,
      dots: 9000,
      smallest: 0.004,
      largest: 0.05,
      sizeMix: 0.5,
      hue: 168,
      hueSpread: 24,
      variance: 0.8,
      trains: 6,
      shortest: 0.55,
      longest: 2.4,
      steepness: 0.86,
      peak: 0.7,
      gusts: 0.72,
      heading: 44,
      spread: 46,
      drift: 0.25,
      bearing: 12,
      // Gyres well under the width of the frame, so the water shears against
      // itself instead of the whole picture leaning one way.
      eddies: 0.8,
      gyre: 2.6,
      stokes: 1,
      exposure: 1,
      glint: 0.85,
      azimuth: 250,
      elevation: 45,
      shade: 0.3,
      gleam: 2.5,
      softness: 0,
      span: 8,
      playback: 0.2,
    },
  },
  {
    label: "pond",
    hint: "Four metres of water with dust on it, lit from almost overhead. Small water is quick, which is the surprise.",
    settings: {
      seed: 660,
      dots: 2600,
      smallest: 0.004,
      largest: 0.026,
      sizeMix: 0.5,
      hue: 44,
      hueSpread: 4,
      variance: 0.42,
      trains: 4,
      // Nothing below 15cm. Under about 2cm the water stops being a gravity wave
      // at all and surface tension takes over, and this piece models only the
      // first of those; the lower bound of the control is set where that is
      // still a three per cent correction.
      shortest: 0.15,
      longest: 0.9,
      steepness: 0.42,
      peak: 0.6,
      // Small water answers the wind fastest, so this is the gustiest scene
      // here: a puddle goes from glass to shivering and back in seconds, which
      // is a thing a pond does and an ocean cannot.
      gusts: 0.62,
      heading: 300,
      spread: 26,
      drift: 0.005,
      bearing: 300,
      eddies: 0.01,
      gyre: 1.6,
      stokes: 1,
      // Almost overhead, and a wide gleam. Between them they make this the one
      // scene that reads as *looking through* water rather than at it: the
      // pieces hold their size and only move and fade, the way lights on the
      // floor of a shallow pool do, and the trough of each ripple crosses as a
      // dark band. `shade` is carrying that band and is high here for it.
      exposure: 1,
      glint: 0.9,
      azimuth: 120,
      elevation: 82,
      shade: 0.62,
      gleam: 9,
      softness: 0,
      span: 4,
      playback: 0.6,
    },
  },
  {
    label: "migration",
    hint: "A hard cross-current under a slack, wide-open sea, carrying a warm scatter of everything somewhere else.",
    settings: {
      seed: 208,
      dots: 3530,
      smallest: 0.004,
      largest: 0.06,
      sizeMix: 0.5,
      hue: 38,
      // The widest colour spread of any scene here, at the lowest variance: a
      // lot of different things afloat, each of them lit evenly.
      hueSpread: 55.5,
      variance: 0.3,
      trains: 3,
      shortest: 0.31,
      longest: 9.39,
      // A tenth of the steepness the other seas run at, spread over a wide fan.
      // Almost nothing gathers, which is the point — this is the one scene where
      // the current is doing all of the work and the waves are only texture.
      steepness: 0.2,
      peak: 0.38,
      gusts: 0.17,
      heading: 132,
      spread: 56,
      // Four tenths of a metre a second, with eddies nearly twice that and gyres
      // barely a metre across. Everything is going somewhere and the somewhere
      // is different a metre away.
      drift: 0.41,
      bearing: 171,
      eddies: 0.71,
      gyre: 1.2,
      // Above 1, so the waves carry harder than the physics says. At this
      // steepness the true drift is a rounding error, and the exaggeration is
      // what lets the sea contribute to the travelling at all.
      stokes: 1.48,
      exposure: 1,
      // Low. With the sea this slack there is barely a facet anywhere pointed
      // the right way, so most of what a glint control can do here is dim
      // everything by its floor — turning it down instead lets the pieces be
      // lit evenly, which is what a wide colour spread wants.
      glint: 0.31,
      azimuth: 68,
      elevation: 52,
      shade: 0.5,
      gleam: 2,
      softness: 0,
      span: 7.66,
      playback: 0.2,
    },
  },
  {
    label: "simmer",
    hint: "A field of violet points that hold their places and breathe, in a haze that moves around them.",
    settings: {
      seed: 208,
      dots: 4060,
      smallest: 0.018,
      largest: 0.267,
      sizeMix: 0.58,
      hue: 257,
      hueSpread: 10,
      // Nearly maximum, which is what sorts the field into a few dominant points
      // and a great many faint ones. Without it every speck is the same speck
      // and there is nothing for the eye to hold on to.
      variance: 0.96,
      trains: 6,
      shortest: 1.03,
      longest: 18.1,
      steepness: 0.34,
      peak: 0.9,
      gusts: 0.52,
      heading: 161,
      spread: 93,
      drift: 0.04,
      bearing: 256,
      eddies: 0.82,
      gyre: 11.2,
      stokes: 0.67,
      exposure: 1,
      glint: 0.8,
      azimuth: 62,
      // **Below what the water can reflect, and that is the whole scene.**
      // Catching the light at 25° needs a surface tilted 32.5°, and a sea this
      // slack never exceeds 19° anywhere. So not one speck ever glints: every
      // one of them sits at the glint floor, evenly dimmed, and the glitter is
      // switched off by putting the light out of the water's reach rather than
      // by turning `glint` down.
      elevation: 25,
      // Which leaves `shade` as the only thing varying, and it reads wave
      // *height* rather than tilt. The specks do not flare and, at this span,
      // they do not move either — see below. They only brighten and dim as the
      // crests pass through them.
      shade: 0.56,
      // Thirty pixels of halo on cores well under one. Every speck is almost
      // entirely glow, so four thousand of them overlap into a nebulosity while
      // their cores stay hard points inside it.
      gleam: 30.5,
      softness: 0,
      // Two hundred and forty-one metres of water. The dominant train is four
      // metres long and a quarter of a metre high, which at this scale is well
      // under a pixel of displacement — measured, the whole population swings by
      // 0.64 of one. So the points keep their positions and the sea is visible
      // only as the haze around them coming and going. That is the piece running
      // against its own grain, and it was found rather than designed.
      span: 241,
      // Doubled, alone among the scenes here, which are all slowed. Nothing in
      // this one *travels*: the points hold their places and only the haze
      // around them comes and goes, so there is no pattern for speed to give
      // away and slowing it only stops the breathing. The same reasoning as
      // everywhere else, arriving at the opposite number.
      playback: 2,
    },
  },
  {
    label: "dream",
    hint: "White water with flotsam-shaped holes in it: overlapping pieces blown past white, and the only dark left is the gaps between them.",
    settings: {
      seed: 208,
      dots: 1210,
      smallest: 0.115,
      largest: 1.23,
      // Flat enough that large pieces are common rather than rare, which is
      // what gets the frame covered.
      sizeMix: 0.59,
      hue: 124,
      // Every hue there is, and no variance at all: each piece one flat colour,
      // and no two neighbours the same. The colour only survives where a piece
      // is *alone*, which is why what you see of it is the edges.
      hueSpread: 90,
      variance: 0,
      trains: 3,
      shortest: 0.31,
      longest: 9.39,
      steepness: 0.2,
      peak: 0.38,
      gusts: 0.17,
      heading: 132,
      spread: 56,
      drift: 0.41,
      bearing: 171,
      eddies: 0.71,
      gyre: 1.2,
      stokes: 1.48,
      // **This is the scene, and it is not a mistake.** Big soft pieces at
      // double exposure, covering the frame several times over, summed
      // additively until nearly everything clips to white — so the only dark
      // left anywhere is the cusps *between* overlapping pieces. The piece comes
      // out inverted: white water with flotsam-shaped holes in it, drifting and
      // breathing on the waves like everything else.
      //
      // Reached by saturation rather than by a light scheme, which the palette
      // does not have and is not getting. `light` reads about 6.7 here — nearly
      // seven canvases' worth — where every other scene is under one. Do not
      // "fix" that number.
      exposure: 2,
      glint: 0.32,
      azimuth: 136,
      // Straight overhead, so the flat water between the crests is what catches
      // the light and the wave faces go dark.
      elevation: 90,
      shade: 0.19,
      // No glare at all. With pieces this large and this crowded there is
      // nothing for it to do but wash out the cusps, which are the picture.
      gleam: 0,
      softness: 0.42,
      span: 7.66,
      playback: 0.6,
    },
  },
]
