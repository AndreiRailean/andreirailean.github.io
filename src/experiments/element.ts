/**
 * The one element lookup every piece's page does, and used to do five times.
 *
 * Section level rather than `kit/`: a piece could take this without taking the
 * chrome, which is the test the layers ADR sets.
 *
 * **It was five byte-identical copies for months, and nothing noticed** —
 * because all five lived inside `src/pages/experiments/<slug>/index.astro`, and
 * `tests/unit/kit-adoption.test.ts` reads `.ts` files. The check written to
 * catch exactly this duplication could not see it. That blind spot is why the
 * pages now hold markup and a `boot()` call and nothing else; see
 * `docs/adr/20260906-a-page-holds-no-logic.md`.
 */
export function requireElement<T extends Element>(piece: string, id: string, type: new () => T): T {
  const element = document.getElementById(id)
  if (!(element instanceof type)) {
    throw new Error(`${piece}: missing #${id}`)
  }
  return element
}
