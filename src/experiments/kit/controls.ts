import { copyText } from "@/experiments/kit/copy"
import { toggleFullscreen } from "@/experiments/kit/fullscreen"

/**
 * The chrome: a bar of presets, a settings panel, and the idle behaviour that
 * hides both.
 *
 * **Offered, not imposed.** Per
 * `../docs/adr/20260828-the-piece-is-independent-the-gallery-is-not`, a piece
 * owns its rendering and may build whatever controls it needs; this exists
 * because an artist reaching for a panel usually wants the one they already
 * know. The art ends at the console API — `window.experiment` — and controls sit
 * outside that boundary, which is what makes them swappable rather than
 * load-bearing.
 *
 * The kit reaches into nothing. It takes a settings object, a list of controls,
 * a validator and a URL function, and knows nothing else about the piece. Lift
 * `kit/` out with an experiment and the experiment still runs.
 *
 * Grown from Dangler's chrome, which was the larger of the two, with Starry
 * Night's range, choice and toggle rows folded in.
 *
 * **It renders DOM, not appearance.** The class names below are the contract
 * with a piece's own stylesheet: `.bar`, `.panel`, `.group`, `.row`, `.label`,
 * `.value`, `.span`, `.modes`, `.modes.set`, `.mode`, `.mode.glyph`, `.preset`,
 * `.toggle`, `.copy`, `.about` — plus `data-active` and `data-locked` on a mode.
 * A piece that uses a control kind it has no CSS for will render it unstyled and
 * nothing will say so — that has happened here twice now, and
 * `tests/kit.spec.ts` checks the range row's layout because of the second time.
 *
 * **Those names are the kit's, and a setting key must not be able to land in the
 * same namespace.** An individual slider carries its key as `data-key` rather
 * than as a class, which it used to. Flotsam has a setting called `span`, and a
 * class of that name put the kit's own two-handled-track rules onto a plain
 * slider: it came out lit on both sides of its knob, from a filled interval
 * painted by a rule meant for a different element entirely. Nothing selected on
 * the key class, so moving it costs nothing and closes the collision for every
 * structural name at once.
 */

/** Idle gap before the pointer and the controls both disappear, video-player style. */
const IDLE_MS = 2500

type Shared = {
  label: string
  /** Shown as a tooltip on the row. */
  hint: string
  /** Heading to file the row under. Ignored unless `groups` is given. */
  group?: string
}

/**
 * How a value is laid out along its track.
 *
 * `"log"` requires a **positive minimum**, and is for a control whose range
 * spans orders of magnitude. Flotsam's `span` runs from a puddle to open water,
 * a factor of eighty; laid out linearly, everything below a room-sized frame
 * sits in the first two per cent of the track and the whole intimate half of the
 * piece is unreachable with a mouse. Nothing in Dangler or Starry Night needs
 * this — their ranges all sit inside one order of magnitude — which is why the
 * default is linear and why this arrived with the third piece rather than the
 * first.
 */
export type Scale = "linear" | "log"

type Track = { min: number; max: number; step: number; scale?: Scale }

type Numeric = Shared & Track

export type SliderControl<K> = Numeric & {
  kind: "slider"
  key: K
  format: (value: number) => string
}

/**
 * Two handles on one axis.
 *
 * A pair of separate sliders cannot express a bound pair: they had different
 * ranges, so the same number sat at a different place on each track and moving
 * one never showed its effect on the other.
 */
export type RangeControl<K> = Numeric & {
  kind: "range"
  keys: [K, K]
  format: (from: number, to: number) => string
}

/** One of a fixed set, as a row of buttons. */
export type ChoiceControl<K> = Shared & {
  kind: "choice"
  key: K
  options: { value: string; label: string }[]
}

/** A boolean, as one button that says which way it currently is. */
export type ToggleControl<K> = Shared & {
  kind: "toggle"
  key: K
  /** What the button reads when the setting is off, then on. */
  labels: [string, string]
}

/**
 * Several of a fixed set at once, as a row of buttons that each toggle.
 *
 * A choice with more than one answer, and the difference that matters is
 * `least`: a set that may empty is a set the piece has to have an opinion about
 * being empty, everywhere it is read. Refusing the last removal in the control
 * is one rule in one place instead.
 *
 * **The rule is shown, not just enforced.** When exactly `least` remain, those
 * buttons carry `data-locked` so a piece's stylesheet can say why the click did
 * nothing. A control that silently ignores a click reads as broken.
 *
 * An option may bring an `icon` when its own shape is the label — the kit
 * appends whatever node the piece hands back and knows nothing about it. The
 * `label` is still required, as the accessible name and as the fallback.
 */
export type SetControl<K> = Shared & {
  kind: "set"
  key: K
  options: { value: string; label: string; icon?: () => Node }[]
  /** Fewest that may be selected at once. Below two, prefer a row of toggles. */
  least: number
}

export type Control<K> = SliderControl<K> | RangeControl<K> | ChoiceControl<K> | ToggleControl<K> | SetControl<K>

export const keysOf = <K>(control: Control<K>): K[] => (control.kind === "range" ? control.keys : [control.key])

/**
 * Whether two settings values are the same scene's worth of the same thing.
 *
 * **`===` is not enough once a setting can be a set.** A validator hands back a
 * fresh array every time it runs, so a scene loaded straight from a preset
 * compared unequal to that preset on identity alone — and the whole preset bar
 * went dark, the arrow keys lost their place, and `[data-preset]` stopped being
 * set for a scene that *was* the preset.
 *
 * One level deep, deliberately: a setting is a primitive or a list of them, and
 * a general deep compare here would be answering a question nothing asks.
 */
const sameValue = (a: unknown, b: unknown): boolean =>
  Array.isArray(a) || Array.isArray(b)
    ? Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => item === b[i])
    : a === b

/**
 * Positions a log track is divided into.
 *
 * A range input holds a *position* rather than a value on a log control, because
 * the element's own `step` is uniform and a log track's is not. A thousand is
 * finer than a pointer can resolve on any track a person will drag, so the
 * quantisation a reader sees is `valueAtPosition`'s, not this one's.
 */
export const LOG_STEPS = 1000

/** Where a value sits along its track, 0 at the left stop and 1 at the right. */
export function positionOf(track: Track, value: number): number {
  if (track.scale !== "log") {
    const span = track.max - track.min || 1
    return Math.min(1, Math.max(0, (value - track.min) / span))
  }
  const low = Math.max(track.min, Number.MIN_VALUE)
  const clamped = Math.min(track.max, Math.max(low, value))
  return Math.log(clamped / low) / Math.log(track.max / low)
}

/**
 * The value a position stands for, rounded to something a person would write.
 *
 * `step` is a floor rather than the grid: a track from 0.15 to 40 needs
 * hundredths at the bottom and whole numbers at the top, so the value is snapped
 * to three significant figures unless `step` is coarser. The final `toPrecision`
 * is not cosmetic — without it a snapped value arrives as 0.30000000000000004
 * and goes into a shared URL that way.
 */
export function valueAtPosition(track: Track, position: number): number {
  const t = Math.min(1, Math.max(0, position))
  if (track.scale !== "log") return track.min + t * (track.max - track.min)

  const low = Math.max(track.min, Number.MIN_VALUE)
  const raw = low * (track.max / low) ** t
  const quantum = Math.max(track.step, 10 ** (Math.floor(Math.log10(raw)) - 2))
  return Number((Math.round(raw / quantum) * quantum).toPrecision(10))
}

export type Preset<S> = { label: string; hint: string; settings: S }

/**
 * An extra button in the bar — Dangler's `reroll`.
 *
 * Handed the controls rather than closing over them, so a piece does not have to
 * declare a mutable binding to build one before the thing it acts on exists.
 */
export type Action<S> = {
  label: string
  hint: string
  /** A single lowercase character. `c` and `f` are taken. */
  shortcut?: string
  run: (controls: Controls<S>) => void
}

export type Controls<S> = {
  destroy: () => void
  getSettings: () => S
  apply: (next: S) => void
  setPanelOpen: (open: boolean) => void
  isPanelOpen: () => boolean
  /** true or false pins the state; null hands control back to the idle timer. */
  setIdle: (idle: boolean | null) => void
}

export type Options<S extends object> = {
  root: HTMLElement
  settings: S
  controls: Control<string & keyof S>[]
  presets: Preset<S>[]
  /** Heading order. Omitted, the rows run together with no headings. */
  groups?: readonly string[]
  actions?: Action<S>[]
  /**
   * The one validator every external input passes through, so the panel cannot
   * reach a state a URL could not.
   *
   * Given a complete candidate rather than a patch, and the key just moved —
   * which is how a bound pair keeps its order when one handle is dragged past
   * the other.
   */
  normalize: (next: S, changed?: string & keyof S) => S
  /** The address that restores these settings. */
  url: (settings: S) => string
  onChange: (settings: S) => void
  /** Where the written note lives. Omitted, no link is shown. */
  aboutHref?: string
  /** The copy button's resting label — pieces word it differently. */
  copyLabel?: string
  /**
   * Whether to mount the bar and the panel. Default true.
   *
   * `false` is **headless**: everything below still exists — the settings, the
   * validator, preset application, the URL sync, the idle state — and none of it
   * is drawn. This is not a piece's choice but the gallery's: on a touch device
   * the interactive view presents the piece full-bleed and moves through presets
   * by swipe, and a bar of controls too small to hit would be in the way of the
   * work rather than in service of it.
   *
   * It is an option rather than a piece hiding the chrome in CSS because
   * `createControls` is the state machine as well as the appearance. Nothing can
   * skip calling it: the console API is built on the handle it returns, and a
   * piece with no `window.experiment` is a piece no test can reach.
   */
  chrome?: boolean
}

function button(label: string, className = ""): HTMLButtonElement {
  const element = document.createElement("button")
  element.type = "button"
  element.textContent = label
  if (className) element.className = className
  return element
}

export function createControls<S extends object>(options: Options<S>): Controls<S> {
  const { root, controls: specs, presets, groups, actions = [], normalize, url, onChange, aboutHref } = options
  const copyLabel = options.copyLabel ?? "copy link to these settings"
  const chrome = options.chrome ?? true

  let current: S = { ...options.settings }
  let panelOpen = false
  let pointerOverUi = false
  /** Which preset the current settings are, or -1 for a scene that is nobody's. */
  let matching = -1
  let idleTimer = 0
  let pinnedIdle: boolean | null = null

  const bar = document.createElement("div")
  bar.className = "bar"

  const panel = document.createElement("div")
  panel.className = "panel"
  panel.hidden = true

  // Built either way, appended only when the chrome is wanted: `render()` writes
  // to these nodes on every change and a headless mount would otherwise need a
  // second code path through the one function everything goes through.
  if (chrome) root.append(bar, panel)

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

  const presetButtons = presets.map((preset, index) => {
    const element = button(`${index + 1} ${preset.label}`, "preset")
    element.title = `${preset.hint} (key ${index + 1}, or ← →)`
    element.addEventListener("click", () => apply(normalize({ ...preset.settings })))
    return element
  })

  const actionButtons = actions.map((action) => {
    const element = button(action.label, action.label)
    element.title = action.shortcut ? `${action.hint} (key ${action.shortcut})` : action.hint
    element.addEventListener("click", () => action.run(handle))
    return element
  })

  const settingsToggle = button("adjust", "toggle")
  settingsToggle.title = "Show or hide these controls (key c, Escape closes)"
  settingsToggle.addEventListener("click", () => setPanelOpen(!panelOpen))

  bar.append(...presetButtons, ...actionButtons, settingsToggle)

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

  const sliders = new Map<string, HTMLInputElement>()
  const spans = new Map<string, HTMLElement>()
  const valueLabels = new Map<string, HTMLElement>()
  const choiceButtons = new Map<string, Map<string, HTMLButtonElement>>()
  const toggleButtons = new Map<string, HTMLButtonElement>()
  const setButtons = new Map<string, Map<string, HTMLButtonElement>>()

  /** What a set control currently holds, tolerating a setting that is not one. */
  const chosenOf = (key: string & keyof S): string[] => {
    const held = current[key]
    return Array.isArray(held) ? held.map(String) : []
  }

  /**
   * Rows are grouped under headings when a piece asks for it.
   *
   * Dangler's twenty-two are nearly twice Starry Night's, and an undivided list
   * that long stops being scannable — you hunt for a control instead of reaching
   * for it. The panel scrolls rather than the groups collapsing: collapse is
   * state that has to be remembered, decided about on load and kept out of the
   * shared URL, which is a lot to buy before the scrolling is a problem.
   */
  if (groups && groups.length > 0) {
    for (const group of groups) {
      const inGroup = specs.filter((control) => control.group === group)
      if (inGroup.length === 0) continue

      const heading = document.createElement("div")
      heading.className = "group"
      heading.textContent = group
      panel.append(heading)

      for (const control of inGroup) panel.append(makeRow(control))
    }
  } else {
    for (const control of specs) panel.append(makeRow(control))
  }

  function makeSlider(control: SliderControl<string & keyof S> | RangeControl<string & keyof S>, key: string) {
    const slider = document.createElement("input")
    const log = control.scale === "log"
    slider.type = "range"
    slider.min = log ? "0" : String(control.min)
    slider.max = log ? String(LOG_STEPS) : String(control.max)
    slider.step = log ? "1" : String(control.step)
    // The key as data, never as a class — see the namespace note at the top.
    slider.dataset.key = key
    slider.addEventListener("input", () => {
      const value = log ? valueAtPosition(control, Number(slider.value) / LOG_STEPS) : Number(slider.value)
      apply(normalize({ ...current, [key]: value }, key as string & keyof S))
    })
    sliders.set(key, slider)
    return slider
  }

  function makeRow(control: Control<string & keyof S>): HTMLDivElement {
    const row = document.createElement("div")
    row.className = "row"
    row.title = control.hint

    const label = document.createElement("span")
    label.className = "label"
    label.textContent = control.label

    if (control.kind === "set") {
      const group = document.createElement("div")
      group.className = "modes set"
      const byValue = new Map<string, HTMLButtonElement>()

      for (const option of control.options) {
        const element = button(option.icon ? "" : option.label, option.icon ? "mode glyph" : "mode")
        if (option.icon) {
          element.append(option.icon())
          // The shape is the label, so the name has to reach a screen reader
          // some other way.
          element.setAttribute("aria-label", option.label)
        }
        element.addEventListener("click", () => {
          const held = new Set(chosenOf(control.key))
          if (held.has(option.value)) held.delete(option.value)
          else held.add(option.value)
          // The refusal lives here and nowhere else: everything downstream may
          // assume the set is never smaller than `least`.
          if (held.size < control.least) return
          const next = control.options.filter((o) => held.has(o.value)).map((o) => o.value)
          apply(normalize({ ...current, [control.key]: next }, control.key))
        })
        byValue.set(option.value, element)
        group.append(element)
      }

      setButtons.set(control.key, byValue)
      row.append(label, group)
      return row
    }

    if (control.kind === "choice" || control.kind === "toggle") {
      const group = document.createElement("div")
      group.className = "modes"

      if (control.kind === "choice") {
        const byValue = new Map<string, HTMLButtonElement>()
        for (const option of control.options) {
          const element = button(option.label, "mode")
          element.addEventListener("click", () =>
            apply(normalize({ ...current, [control.key]: option.value }, control.key)),
          )
          byValue.set(option.value, element)
          group.append(element)
        }
        choiceButtons.set(control.key, byValue)
      } else {
        const element = button(control.labels[0], "mode")
        element.addEventListener("click", () =>
          apply(normalize({ ...current, [control.key]: !current[control.key] }, control.key)),
        )
        toggleButtons.set(control.key, element)
        group.append(element)
      }

      row.append(label, group)
      return row
    }

    const value = document.createElement("span")
    value.className = "value"
    valueLabels.set(keysOf(control).join("-"), value)

    if (control.kind === "range") {
      const span = document.createElement("div")
      span.className = "span"
      span.append(...control.keys.map((key) => makeSlider(control, key)))
      spans.set(control.keys.join("-"), span)
      row.append(label, span, value)
    } else {
      row.append(label, makeSlider(control, control.key), value)
    }

    return row
  }

  const copyRow = document.createElement("div")
  copyRow.className = "row copy"
  const copyButton = button(copyLabel, "copy")
  copyButton.title = "Copy this page's address, which carries every setting above."
  copyButton.addEventListener("click", async () => {
    const copied = await copyText(window.location.href)
    copyButton.textContent = copied ? "copied" : "copy failed"
    window.setTimeout(() => {
      copyButton.textContent = copyLabel
    }, 1600)
  })
  copyRow.append(copyButton)
  panel.append(copyRow)

  // --- state ---------------------------------------------------------------

  function render() {
    for (const control of specs) {
      if (control.kind === "choice") {
        const byValue = choiceButtons.get(control.key)
        if (byValue) {
          for (const [value, element] of byValue) element.dataset.active = String(value === current[control.key])
        }
        continue
      }

      if (control.kind === "set") {
        const byValue = setButtons.get(control.key)
        if (byValue) {
          const held = new Set(chosenOf(control.key))
          // Locked, not disabled: the button still takes focus and still has a
          // tooltip, it simply cannot be the one that empties the set.
          const cornered = held.size <= control.least
          for (const [value, element] of byValue) {
            const on = held.has(value)
            element.dataset.active = String(on)
            element.dataset.locked = String(on && cornered)
          }
        }
        continue
      }

      if (control.kind === "toggle") {
        const element = toggleButtons.get(control.key)
        if (element) {
          const on = Boolean(current[control.key])
          element.textContent = control.labels[on ? 1 : 0]
          element.dataset.active = String(on)
        }
        continue
      }

      const position = (key: string) => positionOf(control, Number(current[key as keyof S])) * 100

      for (const key of keysOf(control)) {
        const slider = sliders.get(key)
        if (!slider) continue
        slider.value =
          control.scale === "log"
            ? String(Math.round(positionOf(control, Number(current[key as keyof S])) * LOG_STEPS))
            : String(current[key as keyof S])
        // Webkit has no ::-moz-range-progress equivalent, so the filled portion
        // is drawn as a gradient and needs the position handed to CSS.
        slider.style.setProperty("--fill", `${position(key)}%`)
      }

      const keys = keysOf(control)
      const span = spans.get(keys.join("-"))
      if (span && control.kind === "range") {
        span.style.setProperty("--from", `${position(control.keys[0])}%`)
        span.style.setProperty("--to", `${position(control.keys[1])}%`)
      }

      const value = valueLabels.get(keys.join("-"))
      if (value) {
        value.textContent =
          control.kind === "range"
            ? control.format(Number(current[control.keys[0]]), Number(current[control.keys[1]]))
            : control.format(Number(current[control.key]))
      }
    }

    matching = presets.findIndex((preset) =>
      (Object.keys(preset.settings) as (keyof S)[]).every((key) => sameValue(preset.settings[key], current[key])),
    )

    presetButtons.forEach((element, index) => {
      element.dataset.active = String(index === matching)
    })

    /*
     * Which preset is on screen, published on `<html>` beside the idle state.
     *
     * The kit already knows this — it is what lights a preset button — and
     * nothing else can work it out without an opinion about what a piece's
     * settings mean. Published rather than returned because the reader is CSS
     * and the gallery's interactive view, neither of which holds this handle.
     * Absent, rather than -1, when the scene is nobody's preset: a shared link
     * to a scene found by dragging sliders is the normal way to be in that
     * state, and `[data-preset]` should not match for it.
     */
    if (matching < 0) delete document.documentElement.dataset.preset
    else document.documentElement.dataset.preset = String(matching)
  }

  function syncUrl() {
    window.history.replaceState(null, "", url(current))
  }

  function apply(next: S) {
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

    /*
     * Left and right step through the presets, the way a swipe does on a phone.
     *
     * The digits already load one each, and they stop being reachable past nine
     * — but that is not the reason this exists. Stepping is how a scene gets
     * *compared* to the one beside it, and hunting for the right digit is not
     * the same gesture at all.
     *
     * **Not while a field that uses them has the focus.** A range input's arrow
     * keys are how it is operated without a pointer, and the panel is
     * deliberately keyboard-reachable — taking them would make every slider
     * unusable for anyone not holding a mouse. The digits have the same
     * collision and keep it for now; arrows are worth guarding because arrows
     * are the *native* way to work the thing they would be taken from.
     *
     * The test is the element, not the chrome. Scoping it to "inside the
     * controls" is the obvious guard and is wrong: clicking a preset leaves the
     * focus on that button, so the very next arrow press — the likeliest one
     * there is — would do nothing. A button has no use for an arrow key; a field
     * does.
     *
     * Clamps at both ends rather than wrapping, which is what the interactive
     * view does with the same gesture. From a scene that is nobody's preset,
     * either direction lands on the primary — there is no position to step from,
     * and the primary is the piece's public face.
     */
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const target = event.target
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      if (typing) return

      const wanted = matching + (event.key === "ArrowRight" ? 1 : -1)
      const stepped = presets[Math.min(presets.length - 1, Math.max(0, wanted))]
      if (stepped) {
        event.preventDefault()
        apply(normalize({ ...stepped.settings }))
      }
      return
    }

    const action = actions.find((candidate) => candidate.shortcut === key)
    if (action) {
      action.run(handle)
      return
    }

    const preset = presets[Number(event.key) - 1]
    if (preset) apply(normalize({ ...preset.settings }))
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

  const handle: Controls<S> = {
    getSettings: () => ({ ...current }),
    apply,
    setPanelOpen,
    isPanelOpen: () => panelOpen,
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

  render()
  goActive()

  return handle
}
