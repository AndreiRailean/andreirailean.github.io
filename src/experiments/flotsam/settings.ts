import { keysOf, type RangeControl, type SliderControl } from "@/experiments/kit/controls"

/**
 * Everything about the sea that is tunable at runtime.
 *
 * One source of truth shared by the engine, the panel and the URL, so a slider
 * and the query-string parser cannot disagree about what a legal value is.
 *
 * **World units are metres and seconds, and the numbers are meant literally.**
 * A speck really is two centimetres across; a swell really is fourteen metres
 * long and really does travel at the four and a half metres a second that
 * deep-water dispersion says a fourteen-metre wave travels at. Nothing here is a
 * dimensionless "amount" dressed up with a unit — which is why there is no speed
 * control for the waves, and why `span` changes the character of the piece
 * rather than just its magnification.
 */

export type Settings = {
  seed: number
  dots: number
  smallest: number
  largest: number
  hue: number
  hueSpread: number
  variance: number
  trains: number
  shortest: number
  longest: number
  steepness: number
  peak: number
  gusts: number
  heading: number
  spread: number
  drift: number
  bearing: number
  eddies: number
  gyre: number
  stokes: number
  glint: number
  azimuth: number
  elevation: number
  shade: number
  gleam: number
  span: number
}

export type NumericKey = keyof Settings

export type ControlGroup = "flotsam" | "sea" | "current" | "light" | "view"

/**
 * Sliders and bound pairs; the kit's choice and toggle kinds have no use here.
 * `group` is narrowed from the kit's `string` to the five headings that exist,
 * so a typo is a type error.
 */
export type Control = (SliderControl<NumericKey> | RangeControl<NumericKey>) & {
  group: ControlGroup
}

export const GROUP_ORDER: ControlGroup[] = ["view", "sea", "current", "flotsam", "light"]

/** Widest legal seed. Kept small enough to stay readable in a shared URL. */
export const SEED_BOUNDS = { min: 0, max: 999_999 }

const metres = (value: number) => (value >= 10 ? `${value.toFixed(0)}m` : `${value.toFixed(2)}m`)

/** Below a decimetre a reader wants millimetres, and above it centimetres. */
const small = (value: number) => (value < 0.1 ? `${(value * 1000).toFixed(0)}mm` : `${(value * 100).toFixed(0)}cm`)

const degrees = (value: number) => `${Math.round(value)}°`

/**
 * The panel rows, in order.
 *
 * `seed` is deliberately absent: it round-trips through the URL like everything
 * else, but a slider over a million arbitrary integers is not a control anyone
 * can use. It gets a re-roll button instead, exactly as Dangler's does.
 *
 * Six of these are logarithmic, which is new to the kit and arrived with this
 * piece. They are the ones whose range spans orders of magnitude — a span from a
 * puddle to open water, a wavelength from a ripple to a swell — and on a linear
 * track the whole small end of each sits inside the first two per cent.
 */
export const CONTROLS: Control[] = [
  {
    kind: "slider",
    group: "view",
    key: "span",
    label: "span",
    min: 1.5,
    max: 320,
    step: 0.01,
    scale: "log",
    format: metres,
    hint: "How much water is in the frame, measured across its shorter side. This is the piece's main dial and it does more than magnify: because a wave's speed is fixed by its length, a frame full of centimetre ripples is frantic and a frame full of ocean swell is slow, and the same settings give you both. Everything floating stays where it is on screen as you drag it, so this zooms rather than rearranges.",
  },
  {
    kind: "slider",
    group: "sea",
    key: "trains",
    label: "trains",
    min: 1,
    max: 9,
    step: 1,
    format: (v) => String(v),
    hint: "How many separate wave trains the sea is made of. This is a trade rather than a quality knob: the steepness below is shared out between them, so one train gives a single hard swell that gathers the flotsam into strong lines, and nine give a rich confused sea with much fainter gathering. Changing it re-lays every direction, because the fan they are spread across is divided up afresh.",
  },
  {
    kind: "range",
    group: "sea",
    keys: ["shortest", "longest"],
    label: "wavelength",
    min: 0.1,
    max: 60,
    step: 0.01,
    scale: "log",
    format: (from, to) => `${metres(from)}–${metres(to)}`,
    hint: "The crest-to-crest range the trains are spread across, geometrically. It sets the speed of the sea as well as its shape: in deep water a long wave travels faster than a short one and there is nothing to choose about it, so a forty-metre swell moves eight metres a second and a half-metre ripple moves under one. Wavelength also decides which flotsam notices — anything much larger than a wave sits across it and barely moves.",
  },
  {
    kind: "slider",
    group: "sea",
    key: "peak",
    label: "peak",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much of the sea's steepness sits in its dominant train rather than being shared out evenly. This is what decides whether the water looks made or found. Low, and every component is equal: with a few trains that is a mechanically regular grid of crests, and with many it is mush. High, and one wavelength carries the sea while its neighbours a metre either side beat against it — which is where the uneven crest spacing and the occasional larger set come from in real water. Raise the train count with it; the two together are what a peak is for.",
  },
  {
    kind: "slider",
    group: "sea",
    key: "steepness",
    label: "steepness",
    min: 0,
    max: 0.92,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Height against length, summed over every train — the one number that says how violent the sea is. It is also what makes the flotsam gather: a steep wave carries water forward faster at its crest than in its trough, so floating things crowd toward the crests on their own. At 1 the crest would come to a point and the water would fold over itself, which is why this stops just short.",
  },
  {
    kind: "slider",
    group: "sea",
    key: "heading",
    label: "heading",
    min: 0,
    max: 360,
    step: 1,
    format: degrees,
    hint: "Which way the sea is running, measured anticlockwise from the right of the screen. 0 sends the waves to the right, 90 sends them up the frame.",
  },
  {
    kind: "slider",
    group: "sea",
    key: "spread",
    label: "fan",
    min: 0,
    max: 180,
    step: 1,
    format: degrees,
    hint: "How far the trains fan out either side of the heading. At 0 they all run together and the sea is a clean swell with parallel bands. Wide, and it is a crossing sea from every quarter, where the crests interfere and the gathering shows up as patches rather than lines.",
  },
  {
    kind: "slider",
    group: "sea",
    key: "gusts",
    label: "gusts",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much the wind varies. Wind arrives in gusts and it veers, and a sea under it does the same: the chop gets up and lies down again over half a minute, and the whole sea comes round a few degrees over a couple of minutes. Gusts move energy between the trains rather than adding any, so the steepness above keeps meaning what it says and the water cannot gust its way past breaking. At 0 the wind has blown at one strength from one quarter for ever, which is a thing no weather does.",
  },
  {
    kind: "slider",
    group: "current",
    key: "drift",
    label: "drift",
    min: 0,
    max: 2,
    step: 0.01,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "Speed of the steady current. This is the only thing in the piece that reliably takes flotsam anywhere: the waves shake it and hand it back, but a current of a few centimetres a second empties the frame and refills it from the other side.",
  },
  {
    kind: "slider",
    group: "current",
    key: "bearing",
    label: "set",
    min: 0,
    max: 360,
    step: 1,
    format: degrees,
    hint: "Which way the current flows toward — its set, in the old sense — on the same anticlockwise-from-the-right dial as the wave heading. Put it across the waves and you can watch the two effects come apart: the flotsam weaves one way and travels the other.",
  },
  {
    kind: "slider",
    group: "current",
    key: "eddies",
    label: "eddies",
    min: 0,
    max: 2,
    step: 0.01,
    format: (v) => `${v.toFixed(2)}m/s`,
    hint: "Peak speed of the swirling part of the current, so that different corners of the frame genuinely disagree about which way is downstream. It is built as a stream function, which makes it incompressible to machine precision — it stirs the flotsam without ever concentrating it, so every clump you can see is the waves' doing and not this.",
  },
  {
    kind: "slider",
    group: "current",
    key: "gyre",
    label: "gyre",
    min: 0.4,
    max: 400,
    step: 0.01,
    scale: "log",
    format: metres,
    hint: "Rough width of a turn in the eddying current. Much smaller than the frame and the water shears and churns; much larger and the whole frame drifts one way while slowly changing its mind. The gyres themselves wander, so the field never settles into a fixed picture.",
  },
  {
    kind: "slider",
    group: "current",
    key: "stokes",
    label: "wave drift",
    min: 0,
    max: 3,
    step: 0.01,
    format: (v) => (v === 1 ? "1.00 (true)" : v.toFixed(2)),
    hint: "How much the waves themselves carry things, as a multiple of the real thing — 1 is what the physics says, and everything above it is an exaggeration you are choosing. The orbits a wave puts a float through are not quite closed: it ends each circle a little downwind of where it began, by the square of the steepness times the wave's own speed. So a gentle sea carries nothing anywhere and a near-breaking one carries flotsam at a quarter of the speed of its own crests. On any single frame this is invisible; leave it running and the flotsam has quietly gone somewhere.",
  },
  {
    kind: "slider",
    group: "flotsam",
    key: "dots",
    label: "pieces",
    min: 60,
    max: 9000,
    step: 1,
    scale: "log",
    format: (v) => String(Math.round(v)),
    hint: "How much flotsam is in the frame. In frame, not per square metre — changing the span does not change this, which is a small untruth that keeps the picture legible at both ends of a range of eighty to one. Piece number seven is the same piece whether there are a hundred or nine thousand, so raising this adds to the water rather than restirring it.",
  },
  {
    kind: "range",
    group: "flotsam",
    keys: ["smallest", "largest"],
    label: "size",
    min: 0.004,
    max: 1.5,
    step: 0.001,
    scale: "log",
    format: (from, to) => `${small(from)}–${small(to)}`,
    hint: "Radius of the smallest and largest piece afloat, drawn evenly across the octaves between them so there is a haze of small stuff with a few large pieces through it. Size is not only how big a dot looks: a piece much larger than a wave sits across the crest and the trough at once and hardly moves, so widen this and the big flotsam visibly stops noticing the chop the specks beside it are still tracing.",
  },
  {
    kind: "slider",
    group: "flotsam",
    key: "hue",
    label: "hue",
    min: 0,
    max: 360,
    step: 1,
    format: degrees,
    hint: "The colour of the light the flotsam is catching. Around 40 is a low warm lamp, 205 is moonlight, 150 the green of something under the surface.",
  },
  {
    kind: "slider",
    group: "flotsam",
    key: "hueSpread",
    label: "colour spread",
    min: 0,
    max: 90,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}°`,
    hint: "How far pieces stray from that hue, as a standard deviation. A few degrees is one light source on a lot of similar debris; sixty is a harbour at night with every colour in it. Most pieces sit near the base at any setting, with the occasional outlier, which is what real variation looks like.",
  },
  {
    kind: "slider",
    group: "flotsam",
    key: "variance",
    label: "variance",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much pieces differ from one another in brightness and in how pure their colour comes back. Deliberately not hue, which the colour spread owns. At 0 they are identical objects, which reads as manufactured rather than found.",
  },
  {
    kind: "slider",
    group: "light",
    key: "glint",
    label: "glint",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much a piece flares when the water under it tilts toward the light. Flotsam lies flat and turns with the surface, so this is what makes the waves themselves visible: bands of brightness sweep across the frame at the speed of the crests, over water that is never drawn.",
  },
  {
    kind: "slider",
    group: "light",
    key: "azimuth",
    label: "light",
    min: 0,
    max: 360,
    step: 1,
    format: degrees,
    hint: "Which way the light is coming from, on the same dial as everything else. Set it along the waves and the glitter runs in bands with them; set it across and the bands break up.",
  },
  {
    kind: "slider",
    group: "light",
    key: "elevation",
    label: "elevation",
    min: 12,
    max: 90,
    step: 1,
    format: degrees,
    hint: "How high the light sits. At 90 it is directly overhead with you and the flat water glints while the wave faces go dark. Bring it down and the glitter narrows to a path across the steepest faces, then fades out entirely once the water is no longer steep enough to reflect it at you — which is exactly what a sun does as it sets, and why a low light needs a steep sea to show anything at all.",
  },
  {
    kind: "slider",
    group: "light",
    key: "shade",
    label: "shade",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How much a piece dims in the troughs and lifts on the crests. Where glint reads the tilt of the water, this reads its height, so the two show the same wave a quarter of a cycle apart — turning one down and the other up moves the bright bands without changing the sea at all.",
  },
  {
    kind: "slider",
    group: "light",
    key: "gleam",
    label: "gleam",
    min: 0,
    max: 40,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}px`,
    hint: "The halo around a piece, as a radius on screen rather than a multiple of its size. A glint is spread by the eye and the lens, not by the thing catching it, so a speck and a raft flare by the same amount — and where flotsam crowds together the halos add up, which is what makes a gathering line glow rather than just being denser.",
  },
]

/**
 * The base every scene is measured against.
 *
 * Two jobs, and neither is "the scene you land on" — that is `PRESETS[0]`, via
 * `settingsForLanding`. These are what `normalizeSettings` falls back to for a
 * value it cannot read, and what `settingsToQuery` diffs against so a shared URL
 * carries only what someone actually changed.
 *
 * They are also what the note's backdrop renders, so they are a recorded scene
 * rather than the simplest thing the machinery can draw. Replacing them changes
 * the length of every URL already shared, which is a cost worth paying once and
 * not often.
 */
export const DEFAULT_SETTINGS: Settings = {
  seed: 41,
  // Fine and numerous. The gathering is a *density*, so it is only legible in a
  // population dense enough for density to be a texture — a scene of a few
  // hundred fat discs shows the same physics and reads as confetti.
  dots: 8500,
  smallest: 0.005,
  // Small on purpose. The size range wants to be wide for the wave response to
  // show, and the top of it wants to be rare and modest, or the large pieces
  // become the picture and the haze they float in stops registering.
  largest: 0.09,
  hue: 202,
  hueSpread: 15,
  variance: 0.62,
  // Eight trains with the steepness concentrated on one of them. This pairing is
  // the whole point of `peak`: two trains sharing it equally gathered just as
  // hard and arrived on a metronome, and eight sharing it equally gather
  // nothing. Here the middle train draws the lines while its neighbours, a metre
  // or two either side, keep them from being evenly spaced.
  trains: 8,
  shortest: 3,
  longest: 11,
  steepness: 0.9,
  peak: 0.78,
  gusts: 0.5,
  // Diagonal, and that is not a taste decision. Crests run square to the
  // heading, so a sea running along a screen axis lays its lines along the other
  // one — and on a wide window that means six or seven parallel rules across the
  // frame, which reads as ruling however irregular their spacing is. Diagonally
  // there are three or four, they leave at the corners, and the eye stops
  // counting them.
  heading: 124,
  spread: 30,
  // Slow, and across the waves rather than along them, so the drift is legible
  // as something separate from the swinging.
  drift: 0.06,
  bearing: 248,
  eddies: 0.1,
  gyre: 30,
  stokes: 0.6,
  // The light runs with the swell, so the glitter bands land near the gathered
  // lines and the flotsam that has collected is also the flotsam that is lit.
  glint: 0.8,
  azimuth: 124,
  elevation: 52,
  shade: 0.38,
  gleam: 3,
  // Seventeen metres across. Wide enough for three or four crests to be in frame
  // at once — which is what makes the gathering read as lines rather than as one
  // band — and tight enough that a half-metre swing is a visible swing.
  span: 17,
}

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
    hint: "Open water at night, a gusting sea running diagonally, a slow current crossing it.",
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    label: "windrows",
    hint: "One swell carrying almost everything, and the flotsam collected into travelling lines with the light along them.",
    settings: {
      seed: 208,
      dots: 9000,
      smallest: 0.005,
      largest: 0.09,
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
      // Barely gusting. This is the one scene that wants a steady wind, because
      // what it is showing is the lines themselves.
      gusts: 0.22,
      heading: 138,
      spread: 10,
      drift: 0.04,
      bearing: 138,
      eddies: 0.06,
      gyre: 18,
      stokes: 0.5,
      // The light runs along the swell, so the gathered line and the glitter
      // band land on top of one another and the windrow comes out gilded.
      glint: 0.85,
      azimuth: 138,
      elevation: 52,
      shade: 0.42,
      gleam: 2,
      span: 16,
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
      glint: 0.8,
      azimuth: 40,
      elevation: 62,
      shade: 0.5,
      gleam: 5,
      span: 30,
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
      hue: 168,
      hueSpread: 24,
      variance: 0.8,
      trains: 6,
      shortest: 0.55,
      longest: 2.4,
      steepness: 0.86,
      peak: 0.7,
      gusts: 0.6,
      heading: 44,
      spread: 46,
      drift: 0.25,
      bearing: 12,
      // Gyres well under the width of the frame, so the water shears against
      // itself instead of the whole picture leaning one way.
      eddies: 0.8,
      gyre: 2.6,
      stokes: 1,
      glint: 0.85,
      azimuth: 250,
      elevation: 45,
      shade: 0.3,
      gleam: 2.5,
      span: 8,
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
      gusts: 0.35,
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
      glint: 0.9,
      azimuth: 120,
      elevation: 82,
      shade: 0.62,
      gleam: 9,
      span: 4,
    },
  },
]

/** Bounds for every numeric setting, including the ones with no slider. */
export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    CONTROLS.flatMap((control) => keysOf(control).map((key) => [key, { min: control.min, max: control.max }])),
  ) as Record<NumericKey, { min: number; max: number }>),
  // Last, and deliberately: seed has no slider to derive bounds from.
  seed: SEED_BOUNDS,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Settings that must hold whole numbers; a fractional train count is nonsense. */
const INTEGER_KEYS: NumericKey[] = ["seed", "dots", "trains"]

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API — comes through here, so the API cannot reach a state a URL could not.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const settings = { ...base, ...patch }

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const bound = BOUNDS[key]
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    if (INTEGER_KEYS.includes(key)) settings[key] = Math.round(settings[key])
  }

  // A pair arriving reversed — from a hand-written URL, or from the API — is
  // put back in order by moving the maximum, since with no key named there is
  // nothing to say which end the caller meant.
  if (settings.smallest > settings.largest) settings.largest = settings.smallest
  if (settings.shortest > settings.longest) settings.longest = settings.shortest

  return settings
}

/**
 * Keeps a bound pair in order, moving whichever end is *not* being dragged.
 *
 * `normalizeSettings` can only push the maximum up, which fights someone
 * dragging the maximum down past the minimum. Here the changed key is known, so
 * the other end gives way. Same shape as Starry Night's `reconcile`, and it is
 * here rather than in the kit for the same reason: which pairs exist is the
 * piece's knowledge.
 */
export function reconcile(next: Settings, changed: NumericKey): Settings {
  const pairs: [NumericKey, NumericKey][] = [
    ["smallest", "largest"],
    ["shortest", "longest"],
  ]

  for (const [low, high] of pairs) {
    if (changed === low && next[low] > next[high]) return { ...next, [high]: next[low] }
    if (changed === high && next[high] < next[low]) return { ...next, [low]: next[high] }
  }

  return next
}

/**
 * Reads settings from a query string.
 *
 * An absent param is `null` and `Number(null)` is 0, which is a legal value for
 * most of these — reading them with a bare `Number()` would silently still the
 * current, flatten the sea and put the light on the horizon. Absent, blank and
 * unparseable are all skipped so the default survives.
 */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}

  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }

  return normalizeSettings(patch)
}

/** Only values that differ from the defaults, so shared URLs stay readable. */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) params.set(key, String(settings[key]))
  }
  return params
}

/**
 * The address that restores exactly this scene.
 *
 * One definition with two callers — the chrome, which rewrites the URL on every
 * change, and the page, which rewrites it once on landing.
 */
export function urlForSettings(settings: Settings, pathname: string): string {
  const query = settingsToQuery(settings).toString()
  return `${pathname}${query ? `?${query}` : ""}`
}

/**
 * Whether a query string names any setting at all.
 *
 * The same rule `settingsFromQuery` applies, and it has to stay the same rule:
 * absent, blank and unparseable are all "not a setting" there, so a URL made
 * only of those is one the piece would read as carrying nothing.
 */
function namesASetting(params: URLSearchParams): boolean {
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * The scene a freshly-opened URL should show.
 *
 * `featured` says the caller should rewrite the address, so a landing visitor
 * has a URL describing the scene in front of them rather than one standing for
 * "whatever is featured". The first preset is the defaults here, unlike
 * Dangler's — the defaults were recorded as a landing scene from the start
 * rather than being retrofitted — but the indirection stays, because that is
 * what lets the featured scene change later without invalidating a link.
 */
export function settingsForLanding(params: URLSearchParams): { settings: Settings; featured: boolean } {
  if (namesASetting(params)) return { settings: settingsFromQuery(params), featured: false }
  return { settings: normalizeSettings(PRESETS[0]!.settings), featured: true }
}

/**
 * Whether a change needs the flotsam rebuilt.
 *
 * Deliberately short, and it deliberately does not include the sea: turning the
 * steepness up rebuilds the waves and leaves every piece exactly where it is,
 * because rebuilding the population would throw away the positions the current
 * has spent a minute establishing.
 */
export function needsScatter(before: Settings, after: Settings): boolean {
  return (
    before.seed !== after.seed ||
    before.dots !== after.dots ||
    before.smallest !== after.smallest ||
    before.largest !== after.largest ||
    before.hue !== after.hue ||
    before.hueSpread !== after.hueSpread ||
    before.variance !== after.variance
  )
}

/** Whether a change needs the wave trains rebuilt. */
export function needsSea(before: Settings, after: Settings): boolean {
  return (
    before.seed !== after.seed ||
    before.trains !== after.trains ||
    before.shortest !== after.shortest ||
    before.longest !== after.longest ||
    before.steepness !== after.steepness ||
    before.peak !== after.peak ||
    before.gusts !== after.gusts ||
    before.heading !== after.heading ||
    before.spread !== after.spread
  )
}
