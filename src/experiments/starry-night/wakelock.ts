/**
 * Holds the screen awake while the piece is on show, as a video player does.
 * This is meant to be left running, and a sleeping display defeats that.
 *
 * Two things shape the implementation. Screen Wake Lock is a secure-context
 * API, so it is simply absent over plain http to anything but localhost —
 * viewing this from another machine by IP silently gets no lock. And the browser
 * drops the lock whenever the page stops being visible, so it has to be taken
 * again on the way back rather than assumed to persist.
 */

export type WakeLock = {
  /** Whether a lock is held right now. */
  held: () => boolean
  release: () => void
}

export function keepAwake(): WakeLock {
  let sentinel: WakeLockSentinel | null = null
  let wanted = true

  const supported = "wakeLock" in navigator

  async function acquire() {
    if (!wanted || !supported || sentinel !== null) return
    // A lock can only be taken while the page is actually visible.
    if (document.visibilityState !== "visible") return

    try {
      sentinel = await navigator.wakeLock.request("screen")
      sentinel.addEventListener("release", () => {
        sentinel = null
      })
    } catch {
      // Refused by policy, battery saver, or the user. Let the screen sleep.
      sentinel = null
    }
  }

  const onVisibilityChange = () => void acquire()
  document.addEventListener("visibilitychange", onVisibilityChange)
  void acquire()

  return {
    held: () => sentinel !== null,
    release() {
      wanted = false
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void sentinel?.release()
      sentinel = null
    },
  }
}
