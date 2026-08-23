import { MODES, type Mode } from "@/experiments/starry-night/character"
import { CONTROLS, PRESETS, settingsToQuery, type Settings } from "@/experiments/starry-night/settings"

const COPY_LABEL = "copy link to these settings"

/** Idle gap before the pointer and the controls both disappear, video-player style. */
const IDLE_MS = 2500

export type Controls = { destroy: () => void }

type Options = {
  root: HTMLElement
  settings: Settings
  onChange: (settings: Settings) => void
}

/**
 * Copies text, including on origins where the Clipboard API does not exist.
 *
 * `navigator.clipboard` is gated behind secure contexts, so on a plain-http LAN
 * address — exactly how this page gets viewed from another machine — it is
 * undefined. The legacy selection-based path covers that case. It must run
 * synchronously inside the click handler to stay within the user gesture, which
 * is why the API is feature-detected rather than tried-and-awaited first.
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

export function createControls({ root, settings, onChange }: Options): Controls {
  let current: Settings = { ...settings }
  let panelOpen = false
  let pointerOverUi = false
  let idleTimer = 0

  const bar = document.createElement("div")
  bar.className = "bar"

  const panel = document.createElement("div")
  panel.className = "panel"
  panel.hidden = true

  root.append(bar, panel)

  // --- idle handling -------------------------------------------------------

  function setIdle(idle: boolean) {
    document.body.dataset.idle = String(idle)
  }

  /**
   * Any activity wakes the UI. The timer is not restarted while the panel is
   * open or the pointer is over it — losing the cursor mid-drag would be
   * unusable.
   */
  function goActive() {
    window.clearTimeout(idleTimer)
    setIdle(false)
    if (panelOpen || pointerOverUi) return
    idleTimer = window.setTimeout(() => setIdle(true), IDLE_MS)
  }

  // --- rendering -----------------------------------------------------------

  const presetButtons = PRESETS.map((preset, index) => {
    const element = button(`${index + 1} ${preset.label}`, "preset")
    element.addEventListener("click", () => apply({ ...preset.settings }))
    return element
  })

  const settingsToggle = button("adjust", "toggle")
  settingsToggle.addEventListener("click", () => setPanelOpen(!panelOpen))

  bar.append(...presetButtons, settingsToggle)

  const modeButtons = new Map<Mode, HTMLButtonElement>()
  const valueLabels = new Map<string, HTMLSpanElement>()
  const sliders = new Map<string, HTMLInputElement>()

  const modeRow = document.createElement("div")
  modeRow.className = "row"
  const modeLabel = document.createElement("span")
  modeLabel.className = "label"
  modeLabel.textContent = "layer depth"
  const modeGroup = document.createElement("div")
  modeGroup.className = "modes"
  for (const mode of MODES) {
    const element = button(mode, "mode")
    element.addEventListener("click", () => apply({ ...current, mode }))
    modeButtons.set(mode, element)
    modeGroup.append(element)
  }
  modeRow.append(modeLabel, modeGroup)
  panel.append(modeRow)

  for (const control of CONTROLS) {
    const row = document.createElement("div")
    row.className = "row"

    const label = document.createElement("span")
    label.className = "label"
    label.textContent = control.label

    const slider = document.createElement("input")
    slider.type = "range"
    slider.min = String(control.min)
    slider.max = String(control.max)
    slider.step = String(control.step)
    slider.addEventListener("input", () => {
      apply({ ...current, [control.key]: Number(slider.value) })
    })

    const value = document.createElement("span")
    value.className = "value"

    row.append(label, slider, value)
    panel.append(row)

    sliders.set(control.key, slider)
    valueLabels.set(control.key, value)
  }

  const copyRow = document.createElement("div")
  copyRow.className = "row copy"
  const copyButton = button(COPY_LABEL, "copy")
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
    for (const [mode, element] of modeButtons) {
      element.dataset.active = String(mode === current.mode)
    }
    for (const control of CONTROLS) {
      const slider = sliders.get(control.key)
      const value = valueLabels.get(control.key)
      if (slider) slider.value = String(current[control.key])
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
    if (event.key === "Escape" && panelOpen) {
      setPanelOpen(false)
      return
    }
    if (event.key === "c") {
      setPanelOpen(!panelOpen)
      return
    }
    const index = Number(event.key) - 1
    const preset = PRESETS[index]
    if (preset) apply({ ...preset.settings })
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
  root.addEventListener("pointerenter", onPointerEnter)
  root.addEventListener("pointerleave", onPointerLeave)

  render()
  goActive()

  return {
    destroy() {
      window.clearTimeout(idleTimer)
      window.removeEventListener("mousemove", onActivity)
      window.removeEventListener("mousedown", onActivity)
      window.removeEventListener("wheel", onActivity)
      window.removeEventListener("touchstart", onActivity)
      window.removeEventListener("keydown", onKeyDown)
      root.removeEventListener("pointerenter", onPointerEnter)
      root.removeEventListener("pointerleave", onPointerLeave)
      root.replaceChildren()
    },
  }
}
