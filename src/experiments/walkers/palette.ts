/**
 * Colour: the ground, the light, and what everybody is wearing.
 *
 * The brief left one question open — whether a person's colour says who they are
 * with or only what they like — so it is a control with four answers rather than
 * a decision. `settings.palette` picks between them and everything else here is
 * shared machinery.
 *
 * ## Pastel is a place on two axes, not a hue
 *
 * A pastel is high lightness and low saturation, and the `pastel` slider walks
 * both at once: at 1 every head is chalk, at 0 they state their colours. It is
 * one control because the two are not independently interesting — high
 * saturation at high lightness is neon, and low saturation at low lightness is
 * mud, and neither is a picture anybody asked for.
 *
 * ## The crowd sits opposite the ground
 *
 * The crowd's hues are centred 160° round the wheel from the ground rather than
 * on an absolute value, so moving the ground from grass to sand carries the
 * people with it and they never sink into it. 160 rather than 180 because exact
 * complements read as a colour exercise; a little off is what a photograph looks
 * like.
 */

import { gaussian, type Rng } from "@/experiments/random"
import type { PaletteName, Settings } from "@/experiments/walkers/settings"
import type { Sun } from "@/experiments/walkers/view"

/** The hue the crowd's own colours scatter around. */
export const crowdCentre = (settings: Settings): number => (settings.hue + 160) % 360

/**
 * The ground lightness past which the crowd is drawn darker than it rather than
 * lighter. Just above where grass sits, so no green scene is near the switch.
 */
const PALE_GROUND = 62

/** Where a team's two colours sit, either side of the centre. A third apart. */
const TEAM_SEPARATION = 60

/**
 * A person's hue and lightness, before the light gets to them.
 *
 * `groupDraw` is a number in [0, 1) shared by everyone in a group and
 * `ownDraw` is theirs alone, which is what lets one policy colour by group and
 * another by person without either knowing how groups work.
 */
export function skinOf(
  policy: PaletteName,
  settings: Settings,
  rng: Rng,
  groupHue: number,
  groupTeam: number,
): { hue: number; lightness: number; saturation: number } {
  const centre = crowdCentre(settings)
  const spread = settings.spread

  let hue: number
  let saturationScale = 1

  switch (policy) {
    case "kin":
      // The group's hue, exactly. Only lightness separates a family, which is
      // what makes them legible as a family from the other side of the frame.
      hue = groupHue
      break
    case "teams": {
      // Two colours a third of the circle apart, and a few people in neither —
      // there are always some. The spread applies at a fraction of its value,
      // because a team colour that scatters is not a team colour.
      const neutral = rng() < 0.14
      hue = neutral
        ? centre + gaussian(rng) * spread
        : centre + groupTeam * TEAM_SEPARATION + gaussian(rng) * spread * 0.12
      if (neutral) saturationScale = 0.3
      break
    }
    case "quiet":
      hue = centre + gaussian(rng) * spread * 0.4
      saturationScale = 0.4
      break
    default:
      hue = centre + gaussian(rng) * spread
  }

  // Lightness carries the individual variation in every policy, so a crowd at
  // zero spread is still a crowd rather than a stencil.
  //
  // **Pitched against the ground rather than at an absolute value.** The first
  // version put pastel heads at around 70% lightness on a ground that was also
  // around 70%, and at eight pixels across a head that differs from the grass
  // only in hue is not visible at all — the picture came out as a field of
  // shadows with nobody casting them.
  //
  // And pitched to **whichever side has room**. On grass or paving people are
  // the lighter thing; on sand or bleached paving they are the darker one, which
  // is what dark hair on a pale ground actually looks like from above. Without
  // this the ground could not be allowed to get light at all, because the crowd
  // would climb into the clamp at the top and disappear into it.
  //
  // The gap is wider at dusk. Not a fudge: at last light the ground has gone and
  // people are still catching a low sun, so the *contrast* between a person and
  // the grass is at its highest of the day even though everything in the frame
  // is darker than it was at noon.
  const ground = groundLightness(settings)
  const below = !settings.dusk && ground > PALE_GROUND
  const base = below
    ? clamp(ground - 30 - settings.pastel * 6, 10, 58)
    : clamp(ground + (settings.dusk ? 34 : 20) + settings.pastel * 8, 38, 88)
  const lightness = clamp(base + (rng() - 0.5) * (below ? 20 : 26), 8, 95)
  const saturation = clamp((64 - settings.pastel * 36) * saturationScale, 3, 80)

  return { hue: wrapHue(hue), lightness, saturation }
}

export type Tones = {
  /** The head in full light. */
  lit: string
  /** The head in its own shade, away from the sun. */
  shade: string
  /** The darker line where the head meets the air. Hair, mostly. */
  edge: string
  /** Whatever of a face is showing. */
  face: string
}

/**
 * One person's colours, with the light applied.
 *
 * Built once per person and rebuilt only when a colour or light setting moves,
 * rather than per frame: at the top of the density slider this is several
 * hundred people and four `hsl()` strings each, which is real work to do sixty
 * times a second for something that does not change.
 */
export function tonesFor(
  settings: Settings,
  skin: { hue: number; lightness: number; saturation: number },
  sun: Sun,
): Tones {
  // A low sun is a warmer, weaker light; an overhead one is white and hard.
  const warmth = settings.dusk ? 14 : 6 * (1 - Math.min(1, sun.reach / 3))
  const strength = settings.dusk ? 0.55 : 1
  // Only a touch: `skinOf` has already pitched the whole crowd against the
  // ground, and darkening them again on top of a ground that is itself dark
  // took the last of the contrast out of the evening scenes.
  const evening = settings.dusk ? -4 : 0

  const hue = skin.hue
  const lightness = clamp(skin.lightness + evening, 14, 93)

  return {
    lit: hsl(hue - warmth * 0.4, skin.saturation, clamp(lightness + 13 * strength, 0, 97)),
    shade: hsl(hue + 8, skin.saturation * 1.05, clamp(lightness - 9 * strength, 4, 96)),
    edge: hsl(hue + 12, skin.saturation * 1.1, clamp(lightness - 24, 2, 90)),
    // A face is a face whatever somebody is wearing, so this is a skin band
    // rather than a shade of the person's own colour — the one place in the
    // piece where the palette does not reach.
    face: hsl(26, 30, clamp(lightness + 14, 34, 92)),
  }
}

export type Ground = {
  /** The flat colour under everything. */
  base: string
  /** A slightly different one, for the mottling that keeps it from being paint. */
  mottle: string
  /** The same colour at zero alpha, which is what a mottle fades out to. */
  mottleOut: string
  /** Colour of a cast shadow, at full strength. */
  shadow: string
  /** Alpha the shadow layer is composited at. */
  shadowAlpha: number
}

/**
 * How light the ground is.
 *
 * One axis rather than two, running from bleached paper at 0 to full grass at 1
 * — pale and colourless at one end, dark and stated at the other, because that
 * is the pairing real ground comes in. Sand, gravel, dry grass and wet paving
 * all sit somewhere along it and none of them is a saturated near-white.
 *
 * The range used to stop at 59, which is a mid grey, on the reasoning that a
 * pale ground makes the crowd invisible. That was true of the version where the
 * crowd's lightness was an absolute value; it is not true now that `skinOf`
 * pitches them against this and will put them *below* it when there is more room
 * underneath. Extending it is what gives the piece a light scheme at all, and
 * the shadows-only scene needs one — a silhouette wants paper to be on.
 */
export const groundLightness = (settings: Settings): number =>
  settings.dusk ? 24 + settings.tint * 7 : 44 + (1 - settings.tint) * 40

export function groundOf(settings: Settings, sun: Sun): Ground {
  const saturation = clamp(settings.tint * 38, 0, 38)
  const lightness = groundLightness(settings)

  return {
    base: hsl(settings.hue, saturation, lightness),
    mottle: hsl(settings.hue + 12, saturation * 1.2, lightness + (settings.dusk ? 5 : -6)),
    // Not `transparent`, which is *black* at zero alpha: a gradient fading to it
    // interpolates through black and rings every blotch with a dark halo. The
    // ground came out looking like a sheet of faint pressed coins.
    mottleOut: hsla(settings.hue + 12, saturation * 1.2, lightness + (settings.dusk ? 5 : -6), 0),
    // A shadow is not black: it is the ground lit by the sky instead of the sun,
    // which on a clear day means it is bluer as well as darker. A *ratio* of the
    // ground's own lightness rather than a fixed step below it, because that is
    // what "lit by less" means — and it is what lets a pale ground keep a dark
    // shadow rather than a grey one.
    shadow: hsl(settings.hue + 26, clamp(saturation + 14, 8, 60), Math.max(4, lightness * 0.45)),
    // Deliberately below what a bright day gives. Only the head is drawn, so a
    // shadow at full strength is three times the width of the person it belongs
    // to and twice the contrast, and the eye reads the picture as a field of
    // shadows with some markers on it. Turning it down puts the person back as
    // the subject and costs nothing that matters — the shadow is there to say
    // there is a body, not to be looked at.
    shadowAlpha: clamp(settings.shadow * (settings.dusk ? 0.5 : 0.62) * (0.6 + 0.4 * (1 - sun.softness)), 0, 0.8),
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const wrapHue = (hue: number) => ((hue % 360) + 360) % 360

/**
 * Comma syntax rather than the modern space-separated form, which is fussier
 * about substitution and, in canvas, parses fractionally slower on some engines
 * — and these are built a few hundred at a time.
 */
const hsl = (hue: number, saturation: number, lightness: number) =>
  `hsl(${wrapHue(hue).toFixed(1)}, ${clamp(saturation, 0, 100).toFixed(1)}%, ${clamp(lightness, 0, 100).toFixed(1)}%)`

const hsla = (hue: number, saturation: number, lightness: number, alpha: number) =>
  `hsla(${wrapHue(hue).toFixed(1)}, ${clamp(saturation, 0, 100).toFixed(1)}%, ${clamp(lightness, 0, 100).toFixed(1)}%, ${alpha})`
