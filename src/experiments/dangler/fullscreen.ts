/*
 * Copied verbatim from Starry Night.
 *
 * ADR-0002 defers extracting anything shared until a second *and* a third
 * experiment exist. This is the second, so the copy is the point: it is the
 * evidence for that decision rather than a shortcut around it. Fix a bug here
 * and in Starry Night's copy both.
 */

/**
 * Fullscreen toggling, on the document rather than on the canvas.
 *
 * The canvas alone would be the obvious thing to fullscreen, but the chrome is
 * its sibling rather than its child, so doing that would leave the controls
 * behind. The whole document goes instead, and the panel stays reachable.
 *
 * Safari still exposes only the webkit-prefixed forms, so both are tried.
 */

type PrefixedDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}

type PrefixedElement = HTMLElement & {
  webkitRequestFullscreen?: () => void
}

export function isFullscreen(): boolean {
  const doc = document as PrefixedDocument
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)
}

export async function setFullscreen(on: boolean): Promise<boolean> {
  const doc = document as PrefixedDocument
  const root = document.documentElement as PrefixedElement

  try {
    if (on) {
      if (root.requestFullscreen) await root.requestFullscreen()
      else root.webkitRequestFullscreen?.()
    } else if (doc.exitFullscreen) {
      await doc.exitFullscreen()
    } else {
      doc.webkitExitFullscreen?.()
    }
  } catch {
    // Refused for want of user activation, or by permissions policy. The
    // request failing is not worth an error in the console.
  }

  return isFullscreen()
}

export const toggleFullscreen = () => setFullscreen(!isFullscreen())
