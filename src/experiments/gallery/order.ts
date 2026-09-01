/**
 * The order of the wall.
 *
 * Imposed, like the rest of `gallery/`: the index and the interactive view walk
 * the pieces in the same sequence, so swiping up on a phone moves through the
 * collection in the order the list you came from showed it. They used to be two
 * sort expressions in two files, which is the arrangement where they silently
 * stop agreeing.
 *
 * Structurally typed rather than importing `CollectionEntry`, so the unit runner
 * can reach it without Astro's content types.
 */

export type WallEntry = { data: { slug: string; updated: Date } }

/**
 * Most recently touched first, with the slug as a tie-break.
 *
 * The tie-break is not cosmetic. Two pieces updated on the same day left the
 * order resting on the loader's glob sequence, which nothing here controls and
 * which no test would notice changing.
 */
export function wallOrder<T extends WallEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) => b.data.updated.valueOf() - a.data.updated.valueOf() || a.data.slug.localeCompare(b.data.slug),
  )
}

/**
 * What sits either side of a slug in a given order.
 *
 * `null` at the ends rather than wrapping. Neither axis of the interactive view
 * loops — the collection has a top and a bottom, exactly as the index does, and
 * the way out is the gallery's own rather than a place you arrive at by
 * overshooting.
 */
export function neighbours(slugs: readonly string[], slug: string): { previous: string | null; next: string | null } {
  const at = slugs.indexOf(slug)
  if (at < 0) return { previous: null, next: null }
  return { previous: slugs[at - 1] ?? null, next: slugs[at + 1] ?? null }
}
