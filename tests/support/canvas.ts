import type { Page } from "@playwright/test"

/**
 * Counting the lit pixels on a piece's canvas.
 *
 * Four specs had written this out — `tests/dangler.spec.ts` and
 * `tests/starry-night.spec.ts` byte-identically apart from `async function`
 * against a `const` arrow, `tests/flotsam.spec.ts` with a frame wait in front of
 * it, and `tests/experiments-notes.spec.ts` tolerating a canvas that has not
 * arrived. The section hoists on the third copy; this was the fourth.
 *
 * **The mechanism moves and the policy does not**, which is the same seam the
 * generators were split on — `docs/adr/20260829-a-third-copy-of-the-generators-moves-to-the-section.md`.
 * So `threshold` is a parameter rather than a constant here, even though all
 * four pass 90 today: each spec states its own, above a comment naming the
 * ground it is measured against — psyxels' `#05050a` sums to 19, Starry Night's
 * `rgb(5, 7, 15)` to 27. The number coinciding is not the same as the reason
 * coinciding, and a shared 90 would quietly become one piece's ground imposed on
 * the rest the first time a piece darkened its own.
 *
 * The wrappers stay with their specs for the same reason. Flotsam waits a frame
 * before reading because `light` is summed while drawing; that is a fact about
 * flotsam, not about canvases.
 *
 * Psyxels keeps its own `light()`, which returns `{ lit, left, right, total }` —
 * a superset used to ask whether a symmetric subject is balanced. A piece that
 * needs a different reading writes one; what is ruled out is writing this one
 * again.
 */
export async function litPixels(page: Page, threshold: number, whenMissing?: number): Promise<number> {
  return page.evaluate(
    ({ threshold, whenMissing }) => {
      const canvas = document.querySelector("canvas")
      const context = canvas?.getContext("2d")
      if (!canvas || !context) {
        // Throwing is right where the canvas is the thing under test, and wrong
        // while polling a page that is still booting — the notes spec waits for
        // a backdrop to arrive and wants a count it can retry, not an error.
        if (whenMissing === undefined) throw new Error("no canvas on the page")
        return whenMissing
      }

      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let lit = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! + data[i + 1]! + data[i + 2]! > threshold) lit++
      }
      return lit
    },
    { threshold, whenMissing },
  )
}
