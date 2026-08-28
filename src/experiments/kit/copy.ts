/**
 * Copying text, including on origins where the Clipboard API does not exist.
 *
 * `navigator.clipboard` is gated behind secure contexts, so on a plain-http LAN
 * address — exactly how these pages get viewed from another machine — it is
 * undefined. The legacy selection path covers that. It must run synchronously
 * inside the click handler to stay within the user gesture, which is why the API
 * is feature-detected rather than tried first.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission refused; fall through to the legacy path.
    }
  }

  const previouslyFocused = document.activeElement
  const carrier = document.createElement("textarea")
  carrier.value = text
  carrier.setAttribute("readonly", "")
  carrier.style.position = "fixed"
  carrier.style.top = "-1000px"
  carrier.style.opacity = "0"
  document.body.append(carrier)

  try {
    carrier.select()
    carrier.setSelectionRange(0, text.length)
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    carrier.remove()
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
  }
}
