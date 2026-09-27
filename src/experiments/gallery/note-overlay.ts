/**
 * A piece's note, read over the piece rather than instead of it — #223.
 *
 * The note used to be its own page, reached by a button that looked like every
 * other button on the piece and was the only one that left it. Getting back
 * meant finding "open the piece" at the top of a long page, and it came back to
 * the primary rather than to whatever was on screen. So the note now opens as
 * an overlay on the piece, and anything that dismisses it leaves the viewer on
 * the scene they were looking at, because the piece never stopped.
 *
 * **Two ways in, one behaviour.** From the piece, `about` opens the overlay in
 * place and pushes the note's address, so Back closes it and a shared link to a
 * note still works. Loaded by that address directly, the page is the piece with
 * the overlay already open, on the primary — there is no earlier scene to
 * return to. Either way, closing leaves you on the piece, at the piece's own
 * address, with whatever settings the address carried.
 *
 * **Which closing applies is read off the history entry, not remembered.** An
 * entry this script pushed carries `{ note: true }`, and only then is Back the
 * right way out; otherwise the address is rewritten in place. A flag in a
 * variable would be wrong after a reload, or after Forward lands on the note.
 *
 * **While it is open the piece hears no keys.** The kit's digits, arrows and
 * `c` would otherwise change the scene under the text, and arrows and Space are
 * how the note scrolls. Stopped at the window in the capture phase, which runs
 * before the kit's own listener; the default action is left alone so scrolling
 * still works. Escape closes.
 */
export function mountNoteOverlay(overlay: HTMLElement): void {
  const piecePath = overlay.dataset.piece
  const notePath = overlay.dataset.note
  if (!piecePath || !notePath) throw new Error("note overlay: needs data-piece and data-note")

  const html = document.documentElement

  const show = () => {
    overlay.hidden = false
    html.dataset.note = "open"
    if (overlay.dataset.noteTitle) document.title = overlay.dataset.noteTitle
    overlay.scrollTop = 0
    overlay.focus({ preventScroll: true })
  }
  const hide = () => {
    overlay.hidden = true
    delete html.dataset.note
    if (overlay.dataset.pieceTitle) document.title = overlay.dataset.pieceTitle
  }

  // Loaded at the note's address, the overlay is rendered open.
  if (!overlay.hidden) show()

  const open = () => {
    if (!overlay.hidden) return
    show()
    history.pushState({ note: true }, "", notePath + location.search)
  }

  const close = () => {
    if (overlay.hidden) return
    hide()
    if ((history.state as { note?: boolean } | null)?.note) history.back()
    else history.replaceState(history.state, "", piecePath + location.search)
  }

  window.addEventListener("popstate", () => {
    if (location.pathname === notePath) show()
    else hide()
  })

  // The kit's `about` link. Intercepted rather than replaced, so a modified
  // click still opens the note in a new tab the ordinary way.
  document.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = event.target
    if (!(target instanceof Element) || !target.closest("#ui a.about")) return
    event.preventDefault()
    open()
  })

  overlay.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    // "view the piece" keeps its address for a reader without script, and
    // closes the overlay for everyone else.
    if (target.closest(`a[href="${piecePath}"]`)) {
      event.preventDefault()
      close()
      return
    }
    // Anywhere outside the text column.
    if (!target.closest(".sheet")) close()
  })

  window.addEventListener(
    "keydown",
    (event) => {
      if (overlay.hidden) return
      if (event.key === "Escape") {
        event.preventDefault()
        close()
      }
      event.stopImmediatePropagation()
    },
    true,
  )
}
