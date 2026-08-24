import { toggleFullscreen } from "@/experiments/dangler/fullscreen"
import {
  CONTROLS,
  GROUP_ORDER,
  normalizeSettings,
  PRESETS,
  SEED_BOUNDS,
  settingsToQuery,
  type Control,
  type Settings,
} from "@/experiments/dangler/settings"

const COPY_LABEL = "copy link to this scene"

/** Idle gap before the pointer and the controls both disappear, video-player style. */
const IDLE_MS = 2500

export type Controls = {
  destroy: () => void
  getSettings: () => Settings
  apply: (next: Settings) => void
  setPanelOpen: (open: boolean) => void
  isPanelOpen: () => boolean
  /** true or false pins the state; null hands control back to the idle timer. */
  setIdle: (idle: boolean | null) => void
  /** New arrangement. Omit for a random seed; returns the seed used. */
  reroll: (seed?: number) => number
}

type Options = {
  root: HTMLElement
  settings: Settings
  onChange: (settings: Settings) => void
  /** Where the written note lives. Omitted, no link is shown. */
  aboutHref?: string
}

/**
 * Copies text, including on origins where the Clipboard API does not exist.
 *
 * Copied from Starry Night along with `fullscreen.ts` and `wakelock.ts`; see the
 * note at the top of those. `navigator.clipboard` is gated behind secure
 * contexts, so on a plain-http LAN address — exactly how this page gets viewed
 * from another machine — it is undefined. The legacy selection path covers that.
 * It must run synchronously inside the click handler to stay within the user
 * gesture, which is why the API is feature-detected rather than tried first.
 */
async function copyText(text: string): Promise<boolean> {
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

function button(label: string, className = ""): HTMLButtonElement {
  const element = document.createElement("button")
  element.type = "button"
  element.textContent = label
  if (className) element.className = className
  return element
}

export function createControls({ root, settings, onChange, aboutHref }: Options): Controls {
  let current: Settings = { ...settings }
  let panelOpen = false
  let pointerOverUi = false
  let idleTimer = 0
  let pinnedIdle: boolean | null = null

  const bar = document.createElement("div")
  bar.className = "bar"

  const panel = document.createElement("div")
  panel.className = "panel"
  panel.hidden = true

  root.append(bar, panel)

  // --- idle handling -------------------------------------------------------

  function setIdle(idle: boolean) {
    document.documentElement.dataset.idle = String(idle)
  }

  /**
   * Any activity wakes the UI. The timer is not restarted while the pointer
   * rests on the panel — losing the cursor mid-drag would be unusable.
   */
  function goActive() {
    window.clearTimeout(idleTimer)
    if (pinnedIdle !== null) {
      setIdle(pinnedIdle)
      return
    }
    setIdle(false)
    if (pointerOverUi) return
    idleTimer = window.setTimeout(() => setIdle(true), IDLE_MS)
  }

  // --- the bar -------------------------------------------------------------

  const presetButtons = PRESETS.map((preset, index) => {
    const element = button(`${index + 1} ${preset.label}`, "preset")
    element.title = `${preset.hint} (key ${index + 1})`
    element.addEventListener("click", () => apply({ ...preset.settings }))
    return element
  })

  const rerollButton = button("reroll", "reroll")
  rerollButton.title = "A fresh arrangement of wires and bulbs (key r). The seed travels in the address bar."
  rerollButton.addEventListener("click", () => reroll())

  const settingsToggle = button("adjust", "toggle")
  settingsToggle.title = "Show or hide these controls (key c, Escape closes)"
  settingsToggle.addEventListener("click", () => setPanelOpen(!panelOpen))

  bar.append(...presetButtons, rerollButton, settingsToggle)

  // The gallery placard: present when you look for it, gone while you watch.
  if (aboutHref) {
    const about = document.createElement("a")
    about.className = "about"
    about.href = aboutHref
    about.textContent = "about"
    about.title = "A written note on this piece and how it came to look this way"
    bar.append(about)
  }

  // --- the panel -----------------------------------------------------------

  const valueLabels = new Map<string, HTMLSpanElement>()
  const sliders = new Map<string, HTMLInputElement>()

  /**
   * Rows are grouped under headings rather than run together.
   *
   * Twenty-two of them is nearly twice what Starry Night carries, and an
   * undivided list that long stops being scannable — you hunt for a control
   * instead of reaching for it. The panel scrolls rather than the groups
   * collapsing: collapse is state that has to be remembered, decided about on
   * load and kept out of the shared URL, which is a lot to buy before there is
   * evidence the scrolling is a problem.
   */
  for (const group of GROUP_ORDER) {
    const controls = CONTROLS.filter((control) => control.group === group)
    if (controls.length === 0) continue

    const heading = document.createElement("div")
    heading.className = "group"
    heading.textContent = group
    panel.append(heading)

    for (const control of controls) panel.append(makeRow(control))
  }

  function makeRow(control: Control): HTMLDivElement {
    const row = document.createElement("div")
    row.className = "row"
    row.title = control.hint

    const label = document.createElement("span")
    label.className = "label"
    label.textContent = control.label

    const slider = document.createElement("input")
    slider.type = "range"
    slider.min = String(control.min)
    slider.max = String(control.max)
    slider.step = String(control.step)
    slider.className = control.key
    slider.addEventListener("input", () => {
      // Through the same validator the query string uses, so the panel cannot
      // reach a state a URL could not.
      apply(normalizeSettings({ ...current, [control.key]: Number(slider.value) }))
    })
    sliders.set(control.key, slider)

    const value = document.createElement("span")
    value.className = "value"
    valueLabels.set(control.key, value)

    row.append(label, slider, value)
    return row
  }

  const copyRow = document.createElement("div")
  copyRow.className = "row copy"
  const copyButton = button(COPY_LABEL, "copy")
  copyButton.title = "Copy this page's address, which carries the seed and every setting above."
  copyButton.addEventListener("click", async () => {
    const copied = await copyText(window.location.href)
    copyButton.textContent = copied ? "copied" : "copy failed"
    window.setTimeout(() => {
      copyButton.textContent = COPY_LABEL
    }, 1600)
  })
  copyRow.append(copyButton)
  panel.append(copyRow)

  // --- state ---------------------------------------------------------------

  function render() {
    for (const control of CONTROLS) {
      const slider = sliders.get(control.key)
      if (slider) {
        slider.value = String(current[control.key])
        // Webkit has no ::-moz-range-progress equivalent, so the filled portion
        // is drawn as a gradient and needs the position handed to CSS.
        const fill = ((current[control.key] - control.min) / (control.max - control.min || 1)) * 100
        slider.style.setProperty("--fill", `${fill}%`)
      }
      const value = valueLabels.get(control.key)
      if (value) value.textContent = control.format(current[control.key])
    }

    presetButtons.forEach((element, index) => {
      const preset = PRESETS[index]
      const matches =
        preset &&
        (Object.keys(preset.settings) as (keyof Settings)[]).every((key) => preset.settings[key] === current[key])
      element.dataset.active = String(Boolean(matches))
    })
  }

  function syncUrl() {
    const query = settingsToQuery(current).toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`
    window.history.replaceState(null, "", url)
  }

  function apply(next: Settings) {
    current = next
    render()
    syncUrl()
    onChange(current)
    goActive()
  }

  function reroll(seed?: number): number {
    const next = seed ?? Math.floor(Math.random() * (SEED_BOUNDS.max + 1))
    apply(normalizeSettings({ ...current, seed: next }))
    return current.seed
  }

  function setPanelOpen(open: boolean) {
    panelOpen = open
    panel.hidden = !open
    settingsToggle.dataset.active = String(open)
    goActive()
  }

  // --- events --------------------------------------------------------------

  const onActivity = () => goActive()

  const onKeyDown = (event: KeyboardEvent) => {
    goActive()

    // Leave browser and OS chords alone. Cmd+2 would switch tab and load a
    // preset at the same time.
    if (event.ctrlKey || event.metaKey || event.altKey) return

    if (event.key === "Escape" && panelOpen) {
      setPanelOpen(false)
      return
    }

    const key = event.key.toLowerCase()
    if (key === "c") {
      setPanelOpen(!panelOpen)
      return
    }
    if (key === "f") {
      void toggleFullscreen()
      return
    }
    if (key === "r") {
      reroll()
      return
    }

    const preset = PRESETS[Number(event.key) - 1]
    if (preset) apply({ ...preset.settings })
  }

  const onPointerDownAway = (event: PointerEvent) => {
    if (!panelOpen) return
    const target = event.target
    if (target instanceof Node && root.contains(target)) return
    setPanelOpen(false)
  }

  const onPointerEnter = () => {
    pointerOverUi = true
    goActive()
  }
  const onPointerLeave = () => {
    pointerOverUi = false
    goActive()
  }

  window.addEventListener("mousemove", onActivity)
  window.addEventListener("mousedown", onActivity)
  window.addEventListener("wheel", onActivity, { passive: true })
  window.addEventListener("touchstart", onActivity, { passive: true })
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("pointerdown", onPointerDownAway)
  root.addEventListener("pointerenter", onPointerEnter)
  root.addEventListener("pointerleave", onPointerLeave)

  render()
  goActive()

  return {
    getSettings: () => ({ ...current }),
    apply,
    setPanelOpen,
    isPanelOpen: () => panelOpen,
    reroll,
    setIdle(idle) {
      pinnedIdle = idle
      goActive()
    },
    destroy() {
      window.clearTimeout(idleTimer)
      window.removeEventListener("mousemove", onActivity)
      window.removeEventListener("mousedown", onActivity)
      window.removeEventListener("wheel", onActivity)
      window.removeEventListener("touchstart", onActivity)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("pointerdown", onPointerDownAway)
      root.removeEventListener("pointerenter", onPointerEnter)
      root.removeEventListener("pointerleave", onPointerLeave)
    },
  }
}
