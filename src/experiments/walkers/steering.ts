/**
 * Why people do not walk into each other.
 *
 * ## Anticipation, not proximity
 *
 * The obvious model is a repulsion that grows as two people get close, and it is
 * wrong in a way that is immediately visible from above: everyone walks straight
 * at everyone else and then flinches. Real pedestrians resolve almost every
 * encounter before it is close, by reading where the other person *will* be.
 *
 * So the interaction here is on **time to collision**, not distance. Two people
 * on a course that never meets ignore each other completely however near they
 * pass; two people on a converging course start easing apart while they are
 * still metres away, and the earlier they notice the smaller the correction has
 * to be. That is the observed law — the interaction energy between two
 * pedestrians goes as 1/τ², where τ is the projected time to collision, with an
 * exponential cutoff a few seconds out — and it is the single thing that makes a
 * crowd from above look like people rather than like particles.
 *
 * It also produces the effects nobody wrote: a gap opens ahead of a fast walker,
 * and a dense crowd slows down before it jams.
 *
 * ## Four terms, and why each is needed
 *
 * 1. **Anticipatory avoidance**, the law above. Handles everything at walking
 *    distance and is nearly all of what you see.
 * 2. **Personal space**, a short exponential repulsion that does not care about
 *    velocity. The anticipatory term is blind to two people standing still next
 *    to each other — τ is infinite, the force is zero — so without this a
 *    stationary group slowly converges into one point.
 * 3. **Contact**, a positional correction when bodies actually overlap. Forces
 *    alone cannot guarantee separation: at a high enough closing speed a step of
 *    16 ms is long enough to pass straight through somebody. This is the term
 *    that makes "they don't walk through each other" a promise rather than a
 *    tendency, and `stats().overlap` is how the browser suite checks it.
 * 4. **A side to pass on**, in `passingBias`. The first term is exactly
 *    symmetric, and symmetric avoidance has no reason to prefer one gap over
 *    another — so two opposing streams stay mixed however long they run. Real
 *    crowds sort into files because their people share a convention about which
 *    side to give way on, and that is the whole of what this adds.
 *
 * The vision cone in `weightBehind` is the fourth thing and is not a term: it
 * scales the first two by how visible the other person is. People do not avoid
 * what is behind them, and a crowd that does looks like it has eyes in the back
 * of its head — which reads, oddly, as everyone being *too* polite.
 *
 * ## Obstacles get this for free
 *
 * An obstacle is a disc that is not moving. The law above already handles one:
 * τ against a static disc is exactly the τ this computes with a zero velocity,
 * and the contact term already refuses to let anyone inside it. Nothing here
 * needs to change when the piece grows things to walk around.
 */

/** Anything that can be walked into: a person, or an obstacle with no velocity. */
export type Disc = {
  x: number
  y: number
  vx: number
  vy: number
  /** Metres. Half a bideltoid breadth for a person. */
  r: number
}

export type Force = { x: number; y: number }

/**
 * Strength of the anticipatory interaction, in m³/s.
 *
 * Tuned rather than measured: the published value is for a model whose other
 * terms are scaled differently. What it has to satisfy is that a metre-per-
 * second closing at three metres produces a correction of a few tenths of a
 * metre, which is what people actually do.
 */
export const AVOID_STRENGTH = 2.4

/** Seconds. How far ahead anyone bothers to look. Beyond this the term dies off. */
export const HORIZON = 3

/** Ceiling on the avoidance acceleration, m/s². Two people nose to nose diverge. */
const MAX_AVOID = 22

/** Personal space: strength in m/s², and the distance it decays over in metres. */
const SPACE_STRENGTH = 1.9
const SPACE_DECAY = 0.32

/**
 * Time until two discs touch, if neither changes course. `Infinity` if never.
 *
 * Returns 0 when they are already overlapping, which the caller treats as a
 * contact rather than as an approach — the force law has a 1/τ³ in it and would
 * otherwise divide by nothing.
 */
export function timeToCollision(a: Disc, b: Disc): number {
  const xx = b.x - a.x
  const xy = b.y - a.y
  const vx = a.vx - b.vx
  const vy = a.vy - b.vy
  const radius = a.r + b.r

  const c = xx * xx + xy * xy - radius * radius
  if (c <= 0) return 0

  const speedSquared = vx * vx + vy * vy
  if (speedSquared < 1e-9) return Infinity

  const approach = xx * vx + xy * vy
  if (approach <= 0) return Infinity

  const discriminant = approach * approach - speedSquared * c
  if (discriminant <= 0) return Infinity

  return (approach - Math.sqrt(discriminant)) / speedSquared
}

/**
 * How much of `b` is in `a`'s field of view, from 0 behind to 1 straight ahead.
 *
 * A wide cone with a floor rather than a hard edge, because a hard edge makes
 * somebody who slips behind you vanish from your reckoning in one frame, and the
 * resulting twitch is more visible than the effect it is modelling. The floor is
 * peripheral vision and hearing, both of which are real.
 */
export function weightBehind(a: Disc, towardX: number, towardY: number): number {
  const speed = Math.hypot(a.vx, a.vy)
  if (speed < 1e-6) return 1

  const distance = Math.hypot(towardX, towardY)
  if (distance < 1e-6) return 1

  const cosine = (a.vx * towardX + a.vy * towardY) / (speed * distance)
  return 0.25 + 0.75 * (1 + cosine) * 0.5
}

/**
 * The acceleration on `a` that eases it clear of `b`.
 *
 * The gradient of the interaction energy E(τ) = k·exp(−τ/τ₀)/τ² with respect to
 * `a`'s position, worked out rather than approximated — the direction matters
 * more than the magnitude here, and a hand-waved "push away from them" is
 * exactly the model this is trying not to be. The result generally has a
 * component along the approach (slow down) *and* one across it (step aside), in
 * the ratio the geometry implies, which is why nobody has to be told to sidestep.
 */
export function avoidance(a: Disc, b: Disc, out: Force): Force {
  out.x = 0
  out.y = 0

  const xx = b.x - a.x
  const xy = b.y - a.y
  const vx = a.vx - b.vx
  const vy = a.vy - b.vy
  const radius = a.r + b.r

  const c = xx * xx + xy * xy - radius * radius
  if (c <= 0) return out

  const speedSquared = vx * vx + vy * vy
  if (speedSquared < 1e-9) return out

  const approach = xx * vx + xy * vy
  if (approach <= 0) return out

  const discriminant = approach * approach - speedSquared * c
  if (discriminant <= 0) return out

  const root = Math.sqrt(discriminant)
  const tau = (approach - root) / speedSquared
  if (tau <= 1e-4 || tau > HORIZON * 3) return out

  // ∂τ/∂position, from τ = (b·v − √(b² − a·c)) / a with x = p_b − p_a.
  const gradientX = (-vx - (speedSquared * xx - approach * vx) / root) / speedSquared
  const gradientY = (-vy - (speedSquared * xy - approach * vy) / root) / speedSquared

  const magnitude = AVOID_STRENGTH * Math.exp(-tau / HORIZON) * (2 / (tau * tau * tau) + 1 / (HORIZON * tau * tau))

  let fx = magnitude * gradientX
  let fy = magnitude * gradientY

  const size = Math.hypot(fx, fy)
  if (size > MAX_AVOID) {
    fx = (fx / size) * MAX_AVOID
    fy = (fy / size) * MAX_AVOID
  }

  out.x = fx
  out.y = fy
  return out
}

/**
 * The bit of avoidance that does not need anyone to be moving.
 *
 * Standing in a queue, sitting in a ring, waiting for a light: τ is infinite for
 * all of it and the anticipatory term contributes nothing at all. This is the
 * ordinary exponential repulsion, kept short-ranged so it does not interfere
 * with the anticipation it is filling a hole in.
 */
export function personalSpace(a: Disc, b: Disc, out: Force): Force {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const distance = Math.hypot(dx, dy)
  if (distance < 1e-6 || distance > (a.r + b.r) * 4) {
    out.x = 0
    out.y = 0
    return out
  }

  const gap = distance - (a.r + b.r)
  const strength = SPACE_STRENGTH * Math.exp(-gap / SPACE_DECAY)
  out.x = (dx / distance) * strength
  out.y = (dy / distance) * strength
  return out
}

/**
 * How far two bodies have been pushed into each other, in metres.
 *
 * Zero when they are clear. The simulation resolves this positionally rather
 * than with a force, so that "people do not walk through each other" survives a
 * dropped frame — the one condition under which a purely force-based separation
 * always fails.
 */
export const overlapOf = (a: Disc, b: Disc): number => Math.max(0, a.r + b.r - Math.hypot(b.x - a.x, b.y - a.y))

/**
 * How much of an oncoming avoidance is turned into a sidestep to one side.
 *
 * A **fraction of the avoidance**, not a force of its own. That distinction is
 * the whole of whether this works: written as a constant nudge per oncoming
 * neighbour it was silently summed over everybody within four metres, which at
 * half a person per square metre is a dozen people and ten metres per second
 * squared of sideways shove. The crowd stalled — mean speed a quarter of a
 * walk, runners demoted to walkers the moment they spawned, and every scene in
 * the piece reading as a jam at densities that should have been free-flowing.
 *
 * Scaled by the avoidance it accompanies, it is self-limiting: it only exists
 * where an encounter is actually imminent, it grows with how imminent, and it
 * cannot outlive the manoeuvre it is choosing a direction for.
 *
 * Larger than 1, which looks odd and is not. The gradient of the anticipatory
 * law for an exactly head-on approach is *pure braking* — it has no lateral
 * component at all, because there is no lateral asymmetry for it to find. Real
 * pedestrians resolve that encounter almost entirely by stepping aside rather
 * than by slowing, so the sidestep being half again the size of the braking is
 * the realistic ratio and not a thumb on the scale.
 *
 * Swept against the two things it trades off. At 0.6 a counterflow does not sort
 * at all — the file-forming measure *falls* from 0.29 to 0.12 over three
 * minutes. At 1.5 it rises from 0.16 to 0.30 and the crowd walks 13 per cent
 * slower. At 3.0 it sorts harder still and costs 21 per cent, which is a crowd
 * being managed rather than a crowd behaving.
 *
 * Real pedestrians have a side they prefer to pass on. Which side is cultural —
 * mostly the right where traffic drives on the right, mostly the left where it
 * does not — but *having* one is universal, and it is the mechanism that makes
 * two opposing streams sort themselves into files rather than negotiating every
 * encounter from scratch.
 *
 * Without it the anticipatory law is exactly symmetric, and symmetric avoidance
 * has no reason to prefer one gap over another: a counterflow stays mixed
 * however long it runs, which is what this piece measured before this existed —
 * a sorting figure of 0.12 that fell rather than rose over three minutes. It is
 * also, incidentally, why two people walking at each other sometimes dance
 * around one another for a moment before one gives way: they picked the same
 * side.
 */
export const SIDE_PREFERENCE = 1.5

/**
 * The sidestep half of avoiding somebody coming the other way.
 *
 * Applied only to **oncoming** encounters — somebody whose heading opposes
 * yours. Overtaking is a different manoeuvre with no such convention, and
 * biasing it puts a permanent sideways drift on anybody following anybody.
 *
 * `avoid` is the anticipatory force for this same encounter, and the sidestep
 * comes out as a fraction of its size. `handedness` is +1 for a walker who
 * passes on their right and −1 on their left, so a crowd can be given a
 * convention or a mix of both.
 */
export function passingBias(a: Disc, b: Disc, avoid: Force, strength: number, handedness: number, out: Force): Force {
  out.x = 0
  out.y = 0

  const urgency = Math.hypot(avoid.x, avoid.y)
  if (urgency < 1e-6) return out

  const speed = Math.hypot(a.vx, a.vy)
  if (speed < 0.15) return out
  // Oncoming only: their heading has a component against ours.
  if (a.vx * b.vx + a.vy * b.vy >= 0) return out

  // To this walker's right, in a world where y runs up.
  out.x = (a.vy / speed) * strength * urgency * handedness
  out.y = (-a.vx / speed) * strength * urgency * handedness
  return out
}

/**
 * The steering toward a wanted velocity.
 *
 * A relaxation rather than an instant change: `tau` is how long it takes to get
 * most of the way there, and half a second is the figure the pedestrian
 * literature uses. It is also what stops a stopped walker leaping to full speed
 * in one frame when their way clears.
 */
export function seek(current: Disc, wantX: number, wantY: number, tau: number, out: Force): Force {
  out.x = (wantX - current.vx) / tau
  out.y = (wantY - current.vy) / tau
  return out
}
