import { decodeScene, encodeScene, type Slot } from "@/experiments/address"
import {
  gridAt,
  snapToGrid,
  type Control as KitControl,
  type RangeControl,
  type SliderControl,
  type Track,
} from "@/experiments/kit/controls"
import type { Chrome } from "@/experiments/piece"

/** Re-exported so a consumer needs one import for a control and its keys. */
export { keysOf } from "@/experiments/kit/controls"

/**
 * Everything about the walk that is tunable at runtime.
 *
 * The single source of truth shared by the simulation, the panel and the URL.
 *
 * **Anything not here is anatomy, and lives in `body.ts` with a measurement
 * behind it.** How wide a head is, how fast a leg swings, how far a head rises
 * on a step: a person who set those by hand would only be making their crowd
 * wrong. What is here is the shape of the crowd — how many, going where, and
 * what the person carrying the camera is doing about it.
 *
 * The one place the line is worth stating out loud is `eye`. It looks like
 * anatomy and it is not: it is *whose* walk this is, which is the piece's
 * subject, and the difference between 1.45 m and 1.90 m is a genuinely
 * different crowd to be in.
 */
export type Settings = {
  /** People per 100 m² of ground. */
  density: number
  /** How much the crowd follows one axis: 0 is a square, 1 is a corridor. */
  stream: number
  /** Of the people on that axis, the fraction walking toward me. */
  against: number
  /** Fraction of the crowd who arrived with somebody else. */
  grouping: number
  /** Fraction of the crowd under about twelve. */
  children: number
  /** Fraction who are not going anywhere — stopped at a stall, waiting, talking. */
  standing: number
  /** Slowest preferred walking speed among adults, m/s. */
  paceLow: number
  /** Fastest preferred walking speed among adults, m/s. */
  paceHigh: number
  /** Multiplier on how much room everybody keeps around themselves. */
  spacing: number
  /** How fast I walk, m/s. 0 is standing and watching. */
  walk: number
  /** How much of the time I stop to look around rather than walking on. */
  pausing: number
  /** How tall I am, in metres. What decides who is taller than me. */
  height: number
  /** How far above level I am looking, in degrees. Negative is down, which is where a walker looks. */
  pitch: number
  /** How many people are walking with me, talking. 0 is alone. */
  companions: number
  /** How much I turn my head, and how far. */
  looking: number
  /** Multiplier on what my own gait does to the frame. 1 is life-size. */
  bob: number
  /** Field of view across the shorter side of the window, in degrees. */
  fov: number
  /** Distance at which a head has faded to a third, in metres. */
  fade: number
  /** How far the crowd extends, in metres. Beyond it there is nobody. */
  reach: number
  /** How wide the corridor is, in metres. Wide enough, and it is open ground. */
  width: number
  /** How deep the stationary crowd lining each side of the way is, in metres. 0 is nobody watching. */
  lining: number
  /** People per 100 m² in that lining. A parade kerb packs far tighter than anything walking can. */
  watchers: number
  /** How far the way swings from side to side, in metres. 0 is straight. */
  bend: number
  /** Distance between one bend and the next like it, in metres. */
  meander: number
  /** How many walk together as a team. 0 is the ordinary mix of pairs and threes. */
  team: number
  /** How far the ground rises and falls, in metres. 0 is level. */
  climb: number
  /** Distance from one crest to the next like it, in metres. */
  hills: number
  /** How much a gradient slows people down. 0 ignores it, 1 is Tobler's hiking function. */
  effort: number
  /** Which side of the way people keep to. Positive is left of their own travel, negative right, 0 no rule. */
  keep: number
  /** Where across the way I hold myself, as a fraction of the half-width. Positive is left, 0 the middle. */
  line: number
  /** How firmly I hold that line. 0 is not at all, and I follow the crowd's rule instead. */
  hold: number
  /** How hard I go after the one person in red. 0 is nobody in red at all. */
  chase: number
  /** How fast the person in red goes, as a share of my own pace. */
  flee: number
  /** How long the way is if it is a loop, in metres. 0 is not a loop. */
  loop: number
  /** How unequal a loop's turns are: 0 is a circle, 1 has a few tight turns and long gentle sides. */
  corners: number
  /**
   * Share of the ground under market stalls nobody can see. 0 is none.
   *
   * **No control and no preset any more** — boulders replaced them in the market
   * (seed.md, 2026-09-27). Kept because addresses already out there name them:
   * the showcase's `catch me` scene opens into the live piece with stalls at
   * 0.5, and would walk an open square if this went.
   */
  stalls: number
  /**
   * How wide the passages between boulders on a grid are, in metres — and the
   * aisles between the stalls, when an address still names any.
   */
  aisle: number
  /** Share of the ground under boulders, which hide whoever is behind them. 0 is none. */
  boulders: number
  /** Mean radius of a boulder, in metres. */
  boulder: number
  /** How far above the ground my eye is raised, in metres, as if standing on something. 0 is my own height. */
  perch: number
  /**
   * Whether there is a way at all: 0 is open ground, 1 a way with sides. **The
   * one stored truth for it** — `normalizeSettings` makes `width` agree. What
   * kind of way is not a choice but its settings: straight or bending is `bend`,
   * a circuit is `loop`. (Replaced `ground`, which offered open, street, trail
   * and loop as four kinds: "not clear why 'loop' type is even needed for
   * ground if anything appears to be loopable".)
   */
  way: boolean
  /** How wide the passages between boulders on a grid are, in metres. */
  passage: number
  /** How boulders are laid out on open ground: 0 scattered, 1 a square grid, 2 a hexagonal grid. */
  layout: number
  /** How light a boulder is painted. 0 is the ground's own black, so it is only ever seen as what it hides. */
  shade: number
  /** Hue of the crowd, in degrees. */
  hue: number
  /** How much of that hue the heads actually carry. 0 is white. */
  tint: number
  /** Clock rate. Every time-dependent thing in the piece goes through it. */
  playback: number
  /** Decides who is out there, how tall they are and where they are going. */
  seed: number
}

/** Every setting but the one boolean, `way`. */
export type NumericKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings]

export type Control = KitControl<string & keyof Settings>

/** Numeric rows only — the ones with bounds to report and a track to drag. */
export type NumericControl = SliderControl<NumericKey> | RangeControl<NumericKey>

export const isNumericControl = (control: Control): control is NumericControl =>
  control.kind === "slider" || control.kind === "range"

/**
 * Headings, in panel order.
 *
 * **`me` is a group of its own and that is the piece's whole argument.** Every
 * other experiment in this section has settings about the work and settings
 * about the paint. This one has settings about the person the camera belongs
 * to — how tall they are, how fast they are going, whether they are looking
 * around — and filing those under `look` with the field of view would bury the
 * thing the piece is actually about.
 */
export const GROUPS = ["me", "look", "crowd", "ground", "boulders", "chase", "paint"] as const

/**
 * **Which settings do nothing, given the rest of a way.** One table, read by
 * both the panel — each row is drawn disabled while its rule holds — and
 * `normalizeSettings`, which resets it to `OFF`. A loop is its own shape, so a
 * bend does nothing on one; a loop's corners do nothing on a way that is not a
 * loop; watchers need a lining, the hills' spacing and the effort need a climb,
 * my line needs me to be holding it. `tests/layers.test.ts` holds that each is
 * the identity.
 */
export const INERT = {
  bend: (s: Settings) => s.loop > 0,
  meander: (s: Settings) => s.loop > 0 || s.bend <= 0,
  corners: (s: Settings) => s.loop <= 0,
  watchers: (s: Settings) => s.lining <= 0,
  hills: (s: Settings) => s.climb <= 0,
  effort: (s: Settings) => s.climb <= 0,
  line: (s: Settings) => s.hold <= 0,
} as const satisfies Partial<Record<keyof typeof OFF, (s: Settings) => boolean>>

export const CONTROLS: Control[] = [
  {
    kind: "slider",
    key: "density",
    label: "density",
    group: "crowd",
    min: 0.5,
    max: 100,
    step: 0.5,
    scale: "log",
    format: (v) => `${v.toFixed(1)}/100m²`,
    hint: "People per hundred square metres of ground. A quiet street is about 3, a market aisle 25, a busy square 50, a concourse at rush hour 70, a crush 100. Above about 40 people are visibly slowed by each other, and nothing in the piece tells them to be — it is what happens when there are more people to get past. Density is of the ground rather than of the frame, so widening the field of view brings more of them into shot rather than spreading these ones thinner. It is also what the frame costs: everything here is per person, and the top of this track is where a slow machine will say so.",
  },
  {
    kind: "slider",
    key: "stream",
    label: "stream",
    group: "crowd",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "How much of the crowd is following one axis rather than going its own way. At 0 this is a square: every heading is as likely as every other and nothing has a grain. At 1 it is a corridor and everyone is on the same line as me, one way or the other. The files form somewhere around 0.7 — opposing streams sort themselves into lanes within a few metres, and nothing in the code knows what a lane is.",
  },
  {
    kind: "slider",
    key: "against",
    label: "oncoming",
    group: "crowd",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Of the people on that axis, the fraction walking toward me rather than away. At 0 I am overtaking and being overtaken and never meeting anybody; at 1 the whole crowd is coming at me. Half is the interesting one, because it is the condition under which the two streams have to sort themselves out. It does nothing at all when stream is 0, which is correct rather than a gap: a crowd with no axis has no direction to be against.",
  },
  {
    kind: "slider",
    key: "grouping",
    label: "together",
    group: "crowd",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "How much of the crowd is with somebody. Observed crowds run around 0.7. Pairs and threes walk abreast, four and more bend into a shallow arc, and both flatten when it gets tight because a wide group cannot get through a gap. From in here a group is legible before you have counted it: the heads hold their spacing while everything around them changes.",
  },
  {
    kind: "slider",
    key: "children",
    label: "children",
    group: "crowd",
    min: 0,
    max: 0.5,
    step: 0.02,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Fraction of the crowd under about twelve. A child's head is only an eighth smaller than an adult's, which is why they are nearly invisible from overhead — and from in here it does not matter at all, because a child's head is sixty centimetres lower. Two circles almost the same size at obviously different heights is a parent and a child, with nothing else drawn.",
  },
  {
    kind: "slider",
    key: "standing",
    label: "standing",
    group: "crowd",
    min: 0,
    max: 0.6,
    step: 0.02,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "Fraction who are not going anywhere: stopped at a stall, waiting for somebody, talking. They are what makes a market a market rather than a corridor with bad traffic, and they are also what everybody else has to get around. Their heads still move, because a person standing still is not a person holding still.",
  },
  {
    kind: "range",
    keys: ["paceLow", "paceHigh"],
    label: "pace",
    group: "crowd",
    min: 0.4,
    max: 3,
    step: 0.05,
    format: (from, to) => `${from.toFixed(2)}–${to.toFixed(2)} m/s`,
    hint: "The band adults draw their preferred walking speed from. Free-flowing pedestrians average about 1.34 m/s with a spread of 0.26, which is roughly 0.9–1.8 here. Children are not drawn from this band: preferred speed goes as the square root of leg length, so a child's comes out of their height at whatever the adults around them are doing. Where my own speed sits inside this band is what decides whether I spend the walk overtaking or being overtaken.",
  },
  {
    kind: "slider",
    key: "spacing",
    label: "room",
    group: "crowd",
    min: 0.3,
    max: 2.5,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "How much room everybody insists on. It scales the disc a person will not have entered and the strength of the anticipation that keeps it empty, together, because they are the same preference. Low is a crowd that tolerates being close and resolves everything late; high is a crowd that starts easing apart while it is still several metres off, and jams at a density a tighter crowd walks through.",
  },
  {
    kind: "slider",
    key: "walk",
    label: "my pace",
    group: "me",
    min: 0,
    max: 5,
    step: 0.05,
    format: (v) => (v <= 0 ? "standing" : `${v.toFixed(2)} m/s`),
    hint: "How fast I am going. Set against the crowd's pace band, this is the single control that decides what the walk feels like: below the band I am being overtaken constantly and every head in front of me is drifting closer, above it I am doing the overtaking and the crowd ahead opens up as I reach it. At 0 I stand where I am and the crowd comes past. Past about 2.1 m/s — where my own legs say, since it depends on my height — I stop walking and run: the bob becomes a bounce twice the size, lowest when a foot lands, and the steps settle at about 170 a minute however fast I go.",
  },
  {
    kind: "slider",
    key: "pausing",
    label: "stopping",
    group: "me",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: "How much of the time I stop. Not a rate of stopping but a share of the walk spent stopped, so turning it up makes the stops longer as well as more frequent. A stop is where the looking happens — standing still and turning your head is a different observation from walking and glancing, and the piece is noticeably more legible during one.",
  },
  {
    kind: "slider",
    key: "height",
    label: "my height",
    group: "me",
    min: 1,
    max: 2.05,
    step: 0.01,
    format: (v) => `${v.toFixed(2)}m`,
    hint: "How tall I am, which decides who is taller than me and who is shorter. It is the control worth dragging slowly: at 1.95 I am looking over the crowd and every head is below the middle of the frame, at 1.60 the horizon runs straight through the tall ones' heads, and somewhere around 1.15 the picture changes completely because I am a child in it. My eye height, my stride and how far the frame bobs all follow from this one number.",
  },
  {
    kind: "slider",
    key: "pitch",
    label: "my gaze",
    group: "me",
    min: -25,
    max: 15,
    step: 0.5,
    format: (v) => (Math.abs(v) < 0.25 ? "level" : v < 0 ? `${(-v).toFixed(1)}° down` : `${v.toFixed(1)}° up`),
    hint: "Where my gaze rests, not where it is locked. A walking person does not look at the horizon — the resting line of sight is several degrees down, because the ground you are about to walk on and the faces of anybody close enough to matter are both below eye height. Glances wander up and down from here as well as side to side: at the ground ahead, at a face, at a child's head which is a long way below yours. It is also what decides where the crowd sits in the frame, since with heads and no bodies the picture is a band and this says where the band is.",
  },
  {
    kind: "slider",
    key: "hold",
    label: "hold",
    group: "ground",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => (v <= 0 ? "free" : `${Math.round(v * 100)}%`),
    hint: "How firmly I keep to my line, by the same pull the crowd uses to keep its side. At 0 my line is ignored and I keep to whatever side everybody else does.",
  },
  {
    kind: "slider",
    key: "line",
    inert: (s: Settings) => INERT.line(s),
    label: "my line",
    group: "ground",
    min: -1,
    max: 1,
    step: 0.05,
    format: (v) =>
      Math.abs(v) < 0.025 ? "the middle" : `${Math.round(Math.abs(v) * 100)}% ${v > 0 ? "left" : "right"}`,
    hint: "Where across the way I keep myself, as a share of the distance from the middle to the edge. It only does anything with hold turned up; at hold 0 I follow the crowd's own rule like everybody else. The middle, held firmly, is the gap between two streams keeping to their sides — which is where a runner goes.",
  },
  {
    kind: "slider",
    key: "chase",
    label: "chase",
    group: "chase",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => (v <= 0 ? "nobody" : `${Math.round(v * 100)}%`),
    hint: "Somebody I am trying to catch — a child who has run off, a friend who will not wait — and the only head in the piece that is not white, because in a crowd there is no other way to tell one person from the rest at thirty metres. This is how hard I go after them: how much of my heading is theirs rather than my own, and how much of my looking goes to them. They run when I get close, and wait, looking back, when I fall behind, so the gap keeps opening and closing rather than settling. At 0 there is nobody in red.",
  },
  {
    kind: "slider",
    key: "flee",
    label: "their pace",
    group: "chase",
    min: 0.5,
    max: 1.6,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}% of mine`,
    hint: "How fast the person in red runs off, as a share of my own pace. They run until they are far enough away, dawdle until I am nearly on them, then run again — so over 1 they get away each time and I only ever close while they wait, and under 1 I keep them close and the chase is a matter of who is weaving past whom.",
  },
  {
    kind: "slider",
    key: "companions",
    label: "with me",
    group: "crowd",
    min: 0,
    max: 15,
    step: 1,
    format: (v) => (v < 0.5 ? "alone" : v < 1.5 ? "one" : `${Math.round(v)}`),
    hint: "How many people are walking with me. They keep station beside me rather than being met and passed, they hold their place while the crowd goes round them, and I look at them — a conversation is most of where the head goes when there is one to be had. It changes the walk more than the number suggests: alone you are reading the crowd, and with somebody you are only half watching it. Past three it stops being company and becomes my team: a block of rows walking in step with me at the back of it, so every one of them is in front of me or beside me and none is behind, where I could not see them.",
  },
  {
    kind: "slider",
    key: "looking",
    label: "looking",
    group: "me",
    min: 0,
    max: 1.5,
    step: 0.05,
    format: (v) => (v <= 0 ? "fixed ahead" : v.toFixed(2)),
    hint: "How much I turn my head, and how far. I look at people coming toward me, at whoever has just passed close, at a group, and sometimes at nothing in particular — and the neck has a speed limit, so a glance is a sweep rather than a cut. At 0 the head is welded facing the way I am walking, which is worth seeing once for how wrong it is.",
  },
  {
    kind: "slider",
    key: "bob",
    label: "bob",
    group: "me",
    min: 0,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "Multiplier on what my own gait does to the frame. At 1 it is life-size: the head rises and falls about 2.3 cm once per step and swings 2 cm from side to side once per stride, which is two steps because the weight goes over one foot and then the other. It is far too small to notice and completely obvious when it is missing — without it the camera is on rails. Turn it past two to see the mechanism you were not supposed to see.",
  },
  {
    kind: "slider",
    key: "fov",
    label: "field",
    group: "look",
    min: 35,
    max: 120,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "Field of view across the shorter side of the window, so a portrait phone and a wide monitor see the same amount of crowd vertically and the wide one sees further to the sides. A human's attentive field is about 55°; wider than 90 is a lens rather than an eye, and the heads at the edges stretch the way they do in a photograph taken with one.",
  },
  {
    kind: "slider",
    key: "fade",
    label: "distance",
    group: "look",
    min: 2,
    max: 80,
    step: 0.1,
    scale: "log",
    format: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)}m`,
    hint: "How far the air lets me see, as the distance at which a head is down to a third of its brightness. Light is scattered out of the line of sight at a rate proportional to what is left, so the fall is exponential and the crowd has no edge — it thins until there is nothing, which is what makes it read as continuing past where it can be seen. How far the world actually extends is derived from this, so turning it up brings more crowd into being rather than revealing an empty plain. Logarithmic, because a two-metre fog and an eighty-metre one are both worth having and a linear track puts the first in the leftmost per cent.",
  },
  {
    kind: "slider",
    key: "reach",
    label: "reach",
    group: "look",
    min: 8,
    max: 250,
    step: 0.5,
    scale: "log",
    format: (v) => `${v < 100 ? v.toFixed(1) : Math.round(v)}m`,
    hint: "How far the crowd extends. Beyond it there is nobody — so this is the control that decides whether you are in the middle of something enormous or in a knot of twenty people with empty ground behind them. It is separate from **distance** on purpose: one is how far people exist, the other is how far you can see, and a scene where the first is shorter than the second shows you the crowd actually ending. Pull it in and the same density arrives as a press of people right around you.",
  },
  {
    kind: "toggle",
    key: "way",
    label: "way",
    group: "ground",
    labels: ["open ground", "a way"],
    hint: "Whether I am on open ground — a square, a field, no sides — or on a way with sides to it. What kind of way is its own settings: it runs straight until it bends, and it is a circuit if it has a length. Everything below does nothing on open ground, and shows so.",
  },
  {
    kind: "slider",
    key: "width",
    label: "corridor",
    group: "ground",
    min: 3,
    max: 250,
    step: 0.5,
    scale: "log",
    format: (v) => (v >= 250 ? "open ground" : `${v < 100 ? v.toFixed(1) : Math.round(v)}m`),
    hint: "How wide the ground is across the line I am walking. At the top it is open and this does nothing. Narrow it and the crowd has walls: everyone is in a street or a passage, nobody can go round, and the only way past somebody is to overtake them or wait. Worth pairing with **stream** at the top and **oncoming** near a half, which is the condition files form under — in a corridor they have nowhere else to form.",
  },
  {
    kind: "slider",
    key: "lining",
    label: "lining",
    group: "ground",
    min: 0,
    max: 12,
    step: 0.5,
    format: (v) => (v <= 0 ? "nobody" : `${v.toFixed(1)}m deep`),
    hint: "A crowd standing along both sides of the way, this many metres deep, watching it go by. They do not walk, so everything moving past them is the walk itself — and they are held off the way by a kerb nobody drew, which is the only edge the corridor has that you can see. Needs a corridor narrower than open ground to have sides to stand on.",
  },
  {
    kind: "slider",
    key: "watchers",
    inert: (s: Settings) => INERT.watchers(s),
    label: "watchers",
    group: "ground",
    min: 0,
    max: 300,
    step: 5,
    format: (v) => `${Math.round(v)}/100m²`,
    hint: "How tightly the lining is packed, per hundred square metres. Walking crowds top out around a hundred because people need room to step; a crowd standing to watch does not, and a parade kerb runs to two or three people a square metre. Separate from density, because the two are different crowds in the same street.",
  },
  {
    kind: "slider",
    key: "bend",
    inert: (s: Settings) => INERT.bend(s),
    label: "bend",
    group: "ground",
    min: 0,
    max: 60,
    step: 0.5,
    format: (v) => (v <= 0 ? "straight" : `±${v.toFixed(1)}m`),
    hint: "How far the way swings from side to side. At 0 it runs straight. Turn it up with a narrow corridor and the way becomes a trail: nothing draws it, and it is visible only as the shape the crowd makes following it — a ribbon of heads sweeping off to one side ahead and coming back.",
  },
  {
    kind: "slider",
    key: "meander",
    inert: (s: Settings) => INERT.meander(s),
    label: "meander",
    group: "ground",
    min: 40,
    max: 600,
    step: 5,
    format: (v) => `${Math.round(v)}m`,
    hint: "The distance from one bend to the next like it. Long is a river in a flood plain, short is a path picking its way round trees. Together with bend it decides how sharp the tightest turn is — stats() reports that radius, since short and wide together make hairpins.",
  },
  {
    kind: "slider",
    key: "climb",
    label: "climb",
    group: "ground",
    min: 0,
    max: 40,
    step: 0.5,
    format: (v) => (v <= 0 ? "level" : `±${v.toFixed(1)}m`),
    hint: "How far the ground rises and falls. On level ground every head is within a metre of my eye, so a winding trail collapses onto the horizon and its bends are only a spread from left to right. Give the ground some relief and the far bends lift above the horizon or drop below it: the line of heads draws the hillside, and nothing else in the picture does.",
  },
  {
    kind: "slider",
    key: "hills",
    inert: (s: Settings) => INERT.hills(s),
    label: "hills",
    group: "ground",
    min: 40,
    max: 800,
    step: 5,
    format: (v) => `${Math.round(v)}m`,
    hint: "The distance from one crest to the next like it. With climb it sets how steep the way gets — stats() reports the steepest gradient, and anything past about 0.3 is a scramble rather than a walk.",
  },
  {
    kind: "slider",
    key: "effort",
    inert: (s: Settings) => INERT.effort(s),
    label: "effort",
    group: "ground",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => (v <= 0 ? "none" : `${Math.round(v * 100)}%`),
    hint: "How much the hill slows everybody. At 1 it is Tobler's hiking function, from field measurement: a 25% climb is walked at under half of level pace, and the fastest ground is a gentle descent. What it does to a crowd on a trail is make it concertina — it bunches on every climb and strings out on every descent — so the density along the line becomes a second picture of the hillside. At 0 the ground is scenery.",
  },
  {
    kind: "slider",
    key: "loop",
    label: "loop",
    group: "ground",
    min: 0,
    max: 3000,
    step: 10,
    format: (v) => (v <= 0 ? "no loop" : `${Math.round(v)}m round`),
    hint: "Make the way a circuit this long, starting where I am standing and turning left. It replaces bend and meander while it is on. The question it exists to ask is whether a loop is legible from inside it: across the infield the far side of the circuit is a band of heads moving the other way, and whether that reads as the same crowd I am in is the whole test. Longer than the reach and the far side is out of the world, so it is only a curved street.",
  },
  {
    kind: "slider",
    key: "corners",
    inert: (s: Settings) => INERT.corners(s),
    label: "corners",
    group: "ground",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => (v <= 0 ? "a circle" : `${Math.round(v * 100)}%`),
    hint: "How unequal the loop's turns are. At 0 it is a circle, turning the same amount everywhere, which gives the eye nothing to measure a turn against. Turn it up and a few turns tighten while the sides between them straighten out. The curve stays smooth everywhere — curvature never jumps, the way a car's path through a corner does not — so a tight turn is a quick sweep, not a corner. stats() reports the tightest radius.",
  },
  {
    kind: "slider",
    key: "boulders",
    label: "boulders",
    group: "boulders",
    min: 0,
    max: 0.4,
    step: 0.01,
    format: (v) => (v <= 0 ? "none" : `${Math.round(v * 100)}% cover`),
    hint: "Great round boulders sitting on the ground, painted the ground's own black — so a boulder is never seen, only the heads it hides are missed. Everybody walks round them. They are placed at random, so some land together as islands, and in a street or on a trail they stand beside the way and never on it: the line of people goes round the bend and behind them, and comes back out at the clearing. A little is a reveal; a lot and the far crowd is gone, which is the infinity going with it.",
  },
  {
    kind: "slider",
    key: "boulder",
    label: "size",
    group: "boulders",
    min: 1,
    max: 25,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}m high`,
    hint: "How big a boulder is on average — its radius, and its centre is at ground level, so what stands above the ground is a dome that high. They vary about threefold either side of it. Small ones hide a group; big ones hide a hillside's worth of crowd and throw long gaps into the band.",
  },
  {
    kind: "slider",
    key: "perch",
    label: "perch",
    group: "me",
    min: 0,
    max: 30,
    step: 0.5,
    format: (v) => (v <= 0 ? "on the ground" : `${v.toFixed(1)}m up`),
    hint: "Raise my eye above the ground, as if I were walking along a wall or the top of the boulders. At eye level every head is on the horizon and a boulder can only hide what is behind it, so in a dense crowd the heads in front of a boulder cover it and a grid never shows. From above, the crowd is a carpet laid out below the horizon, and every boulder is a hole in it.",
  },
  {
    kind: "slider",
    key: "layout",
    label: "layout",
    group: "boulders",
    min: 0,
    max: 2,
    step: 1,
    format: (v) => (v < 0.5 ? "scattered" : v < 1.5 ? "square" : "hexagonal"),
    hint: "How the boulders are laid out on open ground. Scattered is at random, landing together as islands. A square grid lines them up with passages crossing between them, straight ones you can walk for ever — and the grid shows itself when you turn and look down another passage. A hexagonal grid has every passage end at a boulder, so every way through turns. On a grid they are all nearly one size, so the only randomness is the heads'. Streets and trails always line their verges instead.",
  },
  {
    kind: "slider",
    key: "passage",
    inert: (s: Settings) => s.layout < 1,
    label: "passages",
    group: "boulders",
    min: 1.6,
    max: 8,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}m wide`,
    hint: "How wide the passages between the boulders on a grid are. Narrow is a maze you can barely pass anybody in; wide is an open square the grid only just shows through. The share of the ground under boulders still decides how many of the grid's places are filled.",
  },
  {
    kind: "slider",
    key: "keep",
    label: "keep to",
    group: "ground",
    min: -1,
    max: 1,
    step: 0.05,
    format: (v) =>
      Math.abs(v) < 0.025 ? "either side" : `${v > 0 ? "left" : "right"} ${Math.round(Math.abs(v) * 100)}%`,
    hint: "Which side of the way people walk on, relative to where each of them is going. To the left, I and everyone going my way take the left half and everyone coming at me passes on my right — which is the same rule for them, since their left is my right. Right is the mirror. It is a pull rather than a wall, and it saturates early: at 0.2 about one walker in eight is on the wrong side at any moment — overtaking, or pushed across — and from 0.4 up almost nobody is. So the loose, human version of the rule is low on this track and the top is a procession. Does nothing on open ground, which has no sides.",
  },
  {
    kind: "slider",
    key: "team",
    label: "team",
    group: "crowd",
    min: 0,
    max: 16,
    step: 1,
    format: (v) => (v < 1 ? "mixed" : `${Math.round(v)} a team`),
    hint: "When set, every group in the crowd is a team of this many walking in a block — two or three abreast in rows — rather than the ordinary pairs and threes. How many of the walkers are in one is still together. Few walkers and big teams is a parade of delegations: blocks spaced out along the way with empty road between.",
  },
  {
    kind: "slider",
    key: "hue",
    label: "hue",
    group: "paint",
    min: 0,
    max: 359,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: "The colour the heads carry, when they carry any. It does nothing on its own — tint is what lets it through — and it is also the hue the controls and the written note are tinted from, which is why it has a value even in the scenes that are pure white.",
  },
  {
    kind: "slider",
    key: "tint",
    label: "tint",
    group: "paint",
    min: 0,
    max: 1,
    step: 0.02,
    format: (v) => (v <= 0 ? "white" : v.toFixed(2)),
    hint: "How much of the hue the heads actually carry. 0 is white circles on black, which is what this piece was asked for and what it is best at; turning it up is worth doing once to confirm that the colour adds nothing the distance was not already saying.",
  },
  {
    kind: "slider",
    key: "shade",
    label: "shade",
    group: "boulders",
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => (v <= 0 ? "unseen" : `${Math.round(v * 100)}%`),
    hint: "Paint the boulders grey instead of black, to see them as the shapes they are. At 0 they are the ground's colour and exist only as the crowd missing from behind them, which is the piece; turned up it is a way of finding out what is doing the hiding.",
  },
  {
    kind: "slider",
    key: "playback",
    label: "playback",
    group: "paint",
    min: 0,
    max: 2,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
    hint: "Clock rate. Everything time-dependent goes through it — my stride, the crowd's, the looking, the stopping — so half speed is the same walk taken slowly rather than a slower walk. 0 holds the frame.",
  },
]

/** Bounds for the seed, so `reroll` and the panel cannot disagree about them. */
export const SEED_BOUNDS = { min: 0, max: 99_999 }

/**
 * The arbitrary place the piece starts from before anyone has touched it.
 *
 * **Not the primary**, which is `PRESETS[0]`. Nothing presentational may read
 * this — see `../CONTEXT.md`.
 */
export const DEFAULT_SETTINGS: Settings = {
  density: 40,
  stream: 0.45,
  against: 0.5,
  grouping: 0.6,
  children: 0.18,
  standing: 0.12,
  paceLow: 0.9,
  paceHigh: 1.8,
  spacing: 1,
  walk: 1.3,
  pausing: 0.15,
  height: 1.78,
  pitch: -4,
  companions: 1,
  looking: 0.8,
  bob: 1,
  fov: 62,
  fade: 40,
  reach: 65,
  width: 250,
  lining: 0,
  watchers: 0,
  bend: 0,
  meander: 300,
  team: 0,
  climb: 0,
  hills: 400,
  effort: 0,
  keep: 0,
  line: 0,
  hold: 0,
  chase: 0,
  flee: 1,
  loop: 0,
  corners: 0,
  stalls: 0,
  aisle: 3,
  boulders: 0,
  boulder: 6,
  way: false,
  passage: 3,
  layout: 0,
  perch: 0,
  shade: 0,
  hue: 210,
  tint: 0,
  playback: 1,
  seed: 7351,
}

/**
 * The numeric shape of every setting a slider owns: its bounds and its grid.
 *
 * **Written out rather than derived from `CONTROLS`, and that is the point.**
 * Deriving it makes the whole control list reachable from `normalizeSettings`,
 * and therefore from a runner, which has no panel and draws none of it — labels,
 * hints and `format` closures all ride along. It was 30% of starry-night's
 * runner. `tests/unit/experiments-grid.test.ts` fails if any track here differs
 * from the control it describes, which is the check that replaces the
 * derivation.
 */
export const TRACKS: Partial<Record<NumericKey, Track>> = {
  density: { min: 0.5, max: 100, step: 0.5, scale: "log" },
  stream: { min: 0, max: 1, step: 0.01 },
  against: { min: 0, max: 1, step: 0.01 },
  grouping: { min: 0, max: 1, step: 0.05 },
  children: { min: 0, max: 0.5, step: 0.02 },
  standing: { min: 0, max: 0.6, step: 0.02 },
  paceLow: { min: 0.4, max: 3, step: 0.05 },
  paceHigh: { min: 0.4, max: 3, step: 0.05 },
  spacing: { min: 0.3, max: 2.5, step: 0.05 },
  walk: { min: 0, max: 5, step: 0.05 },
  pausing: { min: 0, max: 1, step: 0.05 },
  height: { min: 1, max: 2.05, step: 0.01 },
  pitch: { min: -25, max: 15, step: 0.5 },
  companions: { min: 0, max: 15, step: 1 },
  looking: { min: 0, max: 1.5, step: 0.05 },
  bob: { min: 0, max: 3, step: 0.05 },
  fov: { min: 35, max: 120, step: 1 },
  fade: { min: 2, max: 80, step: 0.1, scale: "log" },
  reach: { min: 8, max: 250, step: 0.5, scale: "log" },
  width: { min: 3, max: 250, step: 0.5, scale: "log" },
  lining: { min: 0, max: 12, step: 0.5 },
  watchers: { min: 0, max: 300, step: 5 },
  bend: { min: 0, max: 60, step: 0.5 },
  meander: { min: 40, max: 600, step: 5 },
  team: { min: 0, max: 16, step: 1 },
  climb: { min: 0, max: 40, step: 0.5 },
  hills: { min: 40, max: 800, step: 5 },
  effort: { min: 0, max: 1, step: 0.05 },
  keep: { min: -1, max: 1, step: 0.05 },
  line: { min: -1, max: 1, step: 0.05 },
  hold: { min: 0, max: 1, step: 0.05 },
  chase: { min: 0, max: 1, step: 0.05 },
  flee: { min: 0.5, max: 1.6, step: 0.05 },
  loop: { min: 0, max: 3000, step: 10 },
  corners: { min: 0, max: 1, step: 0.05 },
  boulders: { min: 0, max: 0.4, step: 0.01 },
  boulder: { min: 1, max: 25, step: 0.5 },
  layout: { min: 0, max: 2, step: 1 },
  passage: { min: 1.6, max: 8, step: 0.1 },
  perch: { min: 0, max: 30, step: 0.5 },
  shade: { min: 0, max: 1, step: 0.05 },
  hue: { min: 0, max: 359, step: 1 },
  tint: { min: 0, max: 1, step: 0.02 },
  playback: { min: 0, max: 2, step: 0.05 },
}

/**
 * Bounds for every numeric setting, so the validator never has to know how a
 * control is presented. Narrowed from `TRACKS` rather than declared twice.
 */
export const BOUNDS: Record<NumericKey, { min: number; max: number }> = {
  ...(Object.fromEntries(
    Object.entries(TRACKS).map(([key, track]) => [key, { min: track!.min, max: track!.max }]),
  ) as Record<NumericKey, { min: number; max: number }>),
  seed: SEED_BOUNDS,
  // No slider since boulders replaced them, so no track — but an address that
  // names them still has to be held to what the stalls can do. (`aisle` came
  // back as the passages between boulders on a grid, so it has its track again.)
  stalls: { min: 0, max: 0.8 },
  aisle: { min: 1.6, max: 8 },
}

/**
 * The spacing one setting is stored on.
 *
 * Exported because a check that a value is on its grid has to read the grid from
 * the piece rather than re-derive it — re-deriving is how a test ends up
 * asserting its own copy of the rule.
 */
export function gridFor(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? gridAt(track, value) : 0
}

function snap(key: NumericKey, value: number): number {
  const track = TRACKS[key]
  return track ? snapToGrid(track, value) : value
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Fills gaps from `base` and forces every value into legal bounds.
 *
 * Every route that accepts settings from outside — the query string, the console
 * API, the panel — passes through here, so the API cannot reach a walk a URL
 * could not.
 */
export function normalizeSettings(patch: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const settings: Settings = { ...base, ...patch }

  for (const [key, bound] of Object.entries(BOUNDS) as [NumericKey, { min: number; max: number }][]) {
    const value = Number(settings[key])
    settings[key] = Number.isFinite(value) ? clamp(value, bound.min, bound.max) : base[key]
    settings[key] = snap(key, settings[key])
  }

  settings.seed = Math.round(settings.seed)

  // A pace band that has crossed over leaves everybody drawing from an empty
  // interval, which comes out as a crowd walking at exactly one speed.
  if (settings.paceLow > settings.paceHigh) settings.paceHigh = settings.paceLow

  return layered(settings)
}

/**
 * What each layer's settings are when it is off, or when the chosen ground does
 * not use them.
 *
 * **Every hidden setting is reset to this**, or two scenes that look the same
 * would not match: the kit decides which preset is on screen by comparing every
 * key, and a leftover `bend` on open ground is a difference nobody can see. Each
 * of these values is the identity for its layer, which `layers.test.ts` holds —
 * so resetting one never changes a picture.
 */
export const OFF = {
  width: 250,
  lining: 0,
  watchers: 0,
  bend: 0,
  meander: 300,
  climb: 0,
  hills: 400,
  effort: 0,
  loop: 0,
  corners: 0,
  keep: 0,
  line: 0,
  hold: 0,
  boulder: 6,
  layout: 0,
  passage: 3,
  shade: 0,
  flee: 1,
  aisle: 3,
} as const satisfies Partial<Settings>

const GROUND_KEYS = [
  "width",
  "lining",
  "watchers",
  "bend",
  "meander",
  "climb",
  "hills",
  "effort",
  "loop",
  "corners",
  "keep",
  "line",
  "hold",
] as const

/** A way's width when a way is chosen on open ground. */
const STREET_WIDTH = 8

/**
 * **`ground` is the one stored truth**, and the settings that used to imply it
 * are made to agree with it: open ground has no width, a street does not bend,
 * a loop has a length.
 */
function layered(settings: Settings): Settings {
  settings.way = Boolean(settings.way)
  if (!settings.way) {
    for (const key of GROUND_KEYS) settings[key] = OFF[key]
  } else {
    // A way always has sides. Just under the top of the track rather than a
    // jump to a street's width, so dragging `width` to the end does not snap
    // back; choosing a way from open ground is `reconcile`'s, which knows.
    if (settings.width >= BOUNDS.width.max) settings.width = BOUNDS.width.max - 0.5
    // Within a way, what the rest of it makes inert — the same rules the
    // panel's rows show as disabled, in `INERT`.
    for (const key of Object.keys(INERT) as (keyof typeof INERT)[]) {
      if (INERT[key](settings)) settings[key] = OFF[key]
    }
  }

  // Passages are a grid's; scattered boulders have none.
  if (settings.layout < 1) settings.passage = OFF.passage
  if (settings.boulders <= 0) {
    settings.boulder = OFF.boulder
    settings.layout = OFF.layout
    settings.passage = OFF.passage
    settings.shade = OFF.shade
  }
  if (settings.chase <= 0) settings.flee = OFF.flee
  if (settings.stalls <= 0) settings.aisle = OFF.aisle
  return settings
}

/**
 * Whether an address meant a way, for addresses written before `way` was a
 * setting: from `ground` if it carries that (#250), from `width` if older.
 */
function wayOf(scene: Partial<Settings> & { ground?: number }): boolean {
  if (scene.ground !== undefined) return scene.ground > 0
  return (scene.width ?? DEFAULT_SETTINGS.width) < BOUNDS.width.max
}

/**
 * Fills in what an address from before the layers left out: whether it is a way, and
 * the boulder grid's passages, which were the stalls' `aisle` then.
 */
function fromOlder(scene: Partial<Settings> & { ground?: number }): Partial<Settings> {
  const patch: Partial<Settings> & { ground?: number } = { ...scene }
  delete patch.ground
  if (patch.way === undefined) patch.way = wayOf(scene)
  if (patch.passage === undefined && scene.aisle !== undefined) patch.passage = scene.aisle
  return patch
}

/**
 * Keeps the pace pair in order, moving whichever end is not being dragged.
 *
 * `normalizeSettings` can only push the top up, which fights somebody dragging
 * the top down. Here the moved key is known, so the other end gives way.
 */
export function reconcile(next: Settings, changed: keyof Settings): Settings {
  // Choosing a way on open ground gives it a street's width, not a 250 m one.
  if (changed === "way" && next.way && next.width >= BOUNDS.width.max) {
    return { ...next, width: STREET_WIDTH }
  }
  if (changed === "paceLow" && next.paceLow > next.paceHigh) return { ...next, paceHigh: next.paceLow }
  if (changed === "paceHigh" && next.paceHigh < next.paceLow) return { ...next, paceLow: next.paceHigh }
  return next
}

/**
 * Reads settings from a query string, in either form.
 *
 * The packed parameter wins when it is there and readable. Anything else falls
 * through to the named-parameter reader, which is why a link written by hand
 * still restores its own scene — and why a corrupt `s` degrades to the defaults
 * rather than throwing in a page's first statement.
 */
export function settingsFromQuery(params: URLSearchParams): Settings {
  const packed = params.get("s")
  if (packed !== null && packed !== "") {
    const scene = decodeScene(REGISTRY, packed)
    if (scene) return normalizeSettings(fromOlder(scene as Partial<Settings>))
  }
  return settingsFromNamedQuery(params)
}

function settingsFromNamedQuery(params: URLSearchParams): Settings {
  const patch: Partial<Settings> = {}
  for (const key of Object.keys(BOUNDS) as NumericKey[]) {
    const raw = params.get(key)
    if (raw === null || raw.trim() === "") continue
    const value = Number(raw)
    if (Number.isFinite(value)) patch[key] = value
  }
  return normalizeSettings(fromOlder(patch))
}

/**
 * **The address registry: append-only, and immutable slot by slot.**
 *
 * Read `@/experiments/address` before touching this. In short: append to add,
 * `retired: true` to remove, and retire-then-append for any change to a slot's
 * `grid`, `origin` or `bits` — including a change to what a value *means* while
 * its numbers stay the same, which nothing can detect automatically.
 *
 * `tests/unit/experiments-address.test.ts` holds a snapshot of every registry
 * and fails on any edit that is not an append.
 */
export const REGISTRY: readonly Slot[] = [
  { key: "density", kind: "num", grid: 0.5, origin: 0.5, bits: 8 },
  { key: "stream", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "against", kind: "num", grid: 0.01, origin: 0, bits: 7 },
  { key: "grouping", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "children", kind: "num", grid: 0.02, origin: 0, bits: 5 },
  { key: "standing", kind: "num", grid: 0.02, origin: 0, bits: 5 },
  { key: "paceLow", kind: "num", grid: 0.05, origin: 0.4, bits: 6 },
  { key: "paceHigh", kind: "num", grid: 0.05, origin: 0.4, bits: 6 },
  { key: "spacing", kind: "num", grid: 0.05, origin: 0.3, bits: 6 },
  { key: "walk", kind: "num", grid: 0.05, origin: 0, bits: 6, retired: true },
  { key: "pausing", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "height", kind: "num", grid: 0.01, origin: 1, bits: 7 },
  { key: "pitch", kind: "num", grid: 0.5, origin: -25, bits: 7 },
  { key: "looking", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "bob", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "fov", kind: "num", grid: 1, origin: 35, bits: 7 },
  // **`grid` is 0.1, which is this log track's `step` and not three significant
  // figures.** `gridAt` floors a log grid at `step`, and at every value on this
  // track — 2 through 80 — the three-significant-figure spacing is 0.01 or 0.1,
  // so the floor wins throughout and one number describes the whole track. A
  // track reaching below 1 would not have that property.
  { key: "fade", kind: "num", grid: 0.1, origin: 2, bits: 10 },
  { key: "hue", kind: "num", grid: 1, origin: 0, bits: 9 },
  { key: "tint", kind: "num", grid: 0.02, origin: 0, bits: 6 },
  { key: "playback", kind: "num", grid: 0.05, origin: 0, bits: 6 },
  { key: "seed", kind: "num", grid: 1, origin: 0, bits: 17 },
  // Appended, which is the only edit this list takes. `reach` splits the world's
  // size away from `fade`, which used to derive it — see `throng.ts`.
  { key: "reach", kind: "num", grid: 0.5, origin: 8, bits: 9 },
  { key: "width", kind: "num", grid: 0.5, origin: 3, bits: 9 },
  { key: "companions", kind: "num", grid: 1, origin: 0, bits: 2, retired: true },
  // Appended for the structured crowd: a parade's lining, a trail's bends, teams.
  { key: "lining", kind: "num", grid: 0.5, origin: 0, bits: 5 },
  { key: "watchers", kind: "num", grid: 5, origin: 0, bits: 6 },
  { key: "bend", kind: "num", grid: 0.5, origin: 0, bits: 7 },
  { key: "meander", kind: "num", grid: 5, origin: 40, bits: 7 },
  { key: "team", kind: "num", grid: 1, origin: 0, bits: 5 },
  { key: "climb", kind: "num", grid: 0.5, origin: 0, bits: 7 },
  { key: "hills", kind: "num", grid: 5, origin: 40, bits: 8 },
  { key: "effort", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  // `companions` again, retired above and re-appended: its range grew from 3 to
  // 15 for a team walking with me, and a slot's bits are immutable.
  { key: "companions", kind: "num", grid: 1, origin: 0, bits: 4 },
  { key: "keep", kind: "num", grid: 0.05, origin: -1, bits: 6 },
  // `walk` again: its range grew from 2.2 to 5 for running, and a slot's bits are immutable.
  { key: "walk", kind: "num", grid: 0.05, origin: 0, bits: 7 },
  { key: "line", kind: "num", grid: 0.05, origin: -1, bits: 6 },
  { key: "hold", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "chase", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "flee", kind: "num", grid: 0.05, origin: 0.5, bits: 5 },
  { key: "loop", kind: "num", grid: 10, origin: 0, bits: 9 },
  { key: "corners", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "stalls", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "aisle", kind: "num", grid: 0.1, origin: 1.6, bits: 7 },
  // Appended for occlusion: boulders that hide whoever is behind them.
  { key: "boulders", kind: "num", grid: 0.01, origin: 0, bits: 6 },
  { key: "boulder", kind: "num", grid: 0.5, origin: 1, bits: 6 },
  { key: "shade", kind: "num", grid: 0.05, origin: 0, bits: 5 },
  { key: "layout", kind: "num", grid: 1, origin: 0, bits: 2 },
  { key: "perch", kind: "num", grid: 0.5, origin: 0, bits: 6 },
  // Appended for the layers (#242): the ground as one stored choice, and the
  // boulder grid's passages as their own setting rather than the stalls' aisle.
  { key: "ground", kind: "num", grid: 1, origin: 0, bits: 2, retired: true },
  { key: "passage", kind: "num", grid: 0.1, origin: 1.6, bits: 7 },
  // `ground` retired above for this: open ground or a way, with the kind of way
  // left to its settings.
  { key: "way", kind: "num", grid: 1, origin: 0, bits: 1, retired: true },
  // `way` again, as the boolean it always was: a toggle, not a two-stop slider.
  { key: "way", kind: "bool" },
]

/**
 * The address that carries this scene, packed.
 *
 * Opaque on purpose — `../docs/adr/20260906-an-address-is-packed-not-readable.md`.
 * `experiment.decode()` expands an address back to a plain object, which is
 * where readability went.
 */
export function settingsToQuery(settings: Settings): URLSearchParams {
  const params = new URLSearchParams()
  params.set("s", encodeScene(REGISTRY, settings))
  return params
}

/**
 * Whether a query string names any setting at all.
 *
 * The same rule `settingsFromQuery` applies, and it has to stay the same rule:
 * absent, blank and unparseable are all "not a setting" there, so an address
 * made only of those is one the piece would read as carrying nothing.
 */
export function namesASetting(params: URLSearchParams): boolean {
  const packed = params.get("s")
  if (packed !== null && packed !== "" && decodeScene(REGISTRY, packed)) return true
  return (Object.keys(BOUNDS) as NumericKey[]).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/** The address that restores exactly these settings. */
export function urlForSettings(settings: Settings, pathname: string): string {
  const query = settingsToQuery(settings).toString()
  return `${pathname}${query ? `?${query}` : ""}`
}

/**
 * Settings that decide who is out there, so changing one starts the walk again.
 *
 * Deliberately short. Everything else is read per frame or applied to the people
 * already walking, because a rebuild is a new set of strangers and a colour has
 * no business producing one — dragging the hue used to empty the square on every
 * step of the slider in an earlier draft of exactly this list.
 */
const CAST_KEYS = ["seed", "companions", "chase"] as const satisfies readonly (keyof Settings)[]

export function needsRecast(before: Settings, after: Settings): boolean {
  return CAST_KEYS.some((key) => before[key] !== after[key])
}

/**
 * Settings that change how big the world is or how many people it holds.
 *
 * **`fade` is not one of them any more.** It used to size the world, which
 * coupled how far you can see to how many people exist and made a long view and
 * a dense crowd mutually exclusive. `reach` is that dimension now, and `fade` is
 * purely what the air does.
 *
 * Not a rebuild: the people already out there keep walking, and only how many of
 * them there ought to be, and how far out they are kept, moves.
 */
const WORLD_KEYS = [
  "density",
  "reach",
  "width",
  "fov",
  "lining",
  "watchers",
  "bend",
  "meander",
  "team",
  "climb",
  "hills",
  "loop",
  "corners",
  "stalls",
  "aisle",
  "boulders",
  "boulder",
  "layout",
  "passage",
  "way",
] as const satisfies readonly (keyof Settings)[]

export function needsRestock(before: Settings, after: Settings): boolean {
  return WORLD_KEYS.some((key) => before[key] !== after[key])
}

/**
 * What the frame needs from this piece beyond its settings tables, as data —
 * see `Chrome` in `../piece.ts`. Here rather than in `runner.ts`, because every
 * export of that file ships in a frozen runner, which draws none of this.
 */
export const CHROME: Chrome<Settings> = {
  slug: "crowd",
  title: "Crowd",
  canvas: "square",
  // A box per group, stacked down the right edge: the panel had outgrown one
  // scrolling column.
  boxes: true,
  // **Layers**, #242: a layer's heading holds the control that switches it,
  // and its rows hide while that control is off. The core — me, look — and the
  // crowd have no off.
  groups: [
    "me",
    "look",
    "crowd",
    { name: "ground", governor: "way", off: false },
    { name: "boulders", governor: "boulders", off: 0 },
    { name: "chase", governor: "chase", off: 0 },
    "paint",
  ],
  theme: (settings) => ({ style: { "--hue": String(settings.hue) } }),
  actions: [
    {
      label: "other strangers",
      hint: "A different set of people at the same settings (r)",
      shortcut: "r",
      verb: "reroll",
    },
  ],
  hatches: { settle: "seconds" },
  banner: [
    ["experiment.get()", "current settings"],
    ["experiment.set({ density: 40 })", "change one or more"],
    ["experiment.preset(1)", "load a preset by number or name"],
    ["experiment.presets()", "what the presets are called"],
    ["experiment.controls()", "every control, with its bounds and blurb"],
    ["experiment.settle(60)", "walk a minute without drawing it"],
    ["experiment.reroll()", "different strangers at the same settings"],
    ["experiment.panel(true)", "open the settings panel"],
    ["experiment.pause()", "hold the walk where it is, or let it run on"],
    ["experiment.idle(false)", "stop the chrome hiding itself"],
    ["experiment.fullscreen()", "toggle fullscreen (or press f)"],
    ["experiment.awake()", "is the display being held awake"],
    ["experiment.stats()", "who is out there, how close they got, and how far the world reaches"],
    ["experiment.url()", "a link that restores this exact state"],
  ],
}

/**
 * A fresh arrangement at the same settings: the bar's reroll button and
 * `experiment.reroll()` both call this, through `gallery/boot.ts`, so the two
 * cannot come to mean different things.
 *
 * Pure, and the piece's rather than the frame's, because which values a seed
 * may take is this piece's to say. The frame knows only that a rerollable piece
 * has a `seed`.
 */
export function reroll(settings: Settings, seed?: number): Settings {
  return normalizeSettings({ ...settings, seed: seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1)) })
}
