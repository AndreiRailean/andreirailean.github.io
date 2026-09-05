/**
 * The section's escape hatch, and how far one instance of it reaches.
 *
 * The kit is *offered*, so no check may demand adoption — what they demand is
 * that divergence be **deliberate and visible**, stated in the file itself:
 *
 *     // kit-opt-out: the panel is a radial dial, so none of the row CSS applies
 *
 * That form is unchanged and means what it always meant: **this file is not the
 * kit's**. It answers the checks that are about the file as a copy — whether it
 * reimplements a shared symbol, whether it imports the stylesheet its chrome
 * needs.
 *
 * ## Why there is a second form
 *
 * Several checks read the *same* file for unrelated reasons, and a bare marker
 * silenced all of them. `tests/unit/experiments-presets.test.ts` computed
 * `source.includes(OPT_OUT)` once per piece and every check in the file returned
 * early on it; `kit-adoption.test.ts` gates its preset check the same way.
 *
 * This is not hypothetical. Starry Night carried one line, written about
 * `deep field` being a spread over `DEFAULT_SETTINGS`. It was also — silently,
 * and for as long as it stood — the reason nothing checked that the piece had a
 * primary at all, or that its presets carried usable hues. Removing it in #136
 * turned both back on. They passed, so nothing was hiding; nobody knew that
 * until the line came out, which is the whole problem. #137.
 *
 * A hatch that opens more doors than it names is the failure these checks exist
 * to prevent, wearing the costume of the fix. So a check that shares a file with
 * another names itself:
 *
 *     // kit-opt-out(hue): the marks carry no colour, so there is no hue to give
 *
 * ## The reason is mandatory, not the marker
 *
 * Same rule `browser-because:` follows in `tests/unit/browser-suite.test.ts`, and
 * for the same reason: nobody has ever argued for divergence, they have just
 * written it and moved on. A bare `kit-opt-out:` that satisfied a check would
 * turn a stop-and-think into a magic word.
 *
 * Stripping a trailing comment terminator before looking for words is not
 * decoration. Without it, a bare `\S` test after the colon matches the close of
 * the very docblock the marker was written in, so an empty marker satisfies the
 * check that exists to refuse exactly that. That is the bug `browser-because:`
 * shipped with, and the reason this cannot be spelled out any more literally
 * than it is here.
 */

/** The bare form: this file is not the kit's. */
const FILE_WIDE = /kit-opt-out[ \t]*:[ \t]*([^\n]*)/

/** Whether what follows a marker is an actual reason rather than a terminator. */
function isReason(stated: string | undefined): boolean {
  if (stated === undefined) return false
  return /[A-Za-z]{3}/.test(stated.replace(/\*+\/\s*$/, ""))
}

/**
 * Whether this file says it is not the kit's, with a reason.
 *
 * For checks whose subject *is* the whole file — a module that reimplements a
 * shared symbol, a page that does not import `controls.css`. A named opt-out
 * does not answer these: saying why one preset inherits says nothing about
 * whether the file is a copy of something shared.
 */
export function optsOutOfFile(source: string): boolean {
  return isReason(FILE_WIDE.exec(source)?.[1])
}

/**
 * Whether this file excuses itself from one named check, with a reason.
 *
 * For checks that share a file with others. The bare form deliberately does not
 * satisfy these — that is the whole point of the split — so a piece which needs
 * both writes both.
 */
export function optsOutOf(source: string, check: string): boolean {
  const named = new RegExp(`kit-opt-out[ \\t]*\\([ \\t]*${check}[ \\t]*\\)[ \\t]*:[ \\t]*([^\\n]*)`)
  return isReason(named.exec(source)?.[1])
}
