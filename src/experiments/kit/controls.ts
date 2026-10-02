import { copyText } from "@/experiments/kit/copy"
import { toggleFullscreen } from "@/experiments/kit/fullscreen"

/**
 * The chrome: a column of presets, a bar of actions and `adjust`, a settings
 * panel, the way to the note, and the idle behaviour that hides all of it.
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
 * `.value`, `.span`, `.modes`, `.modes.set`, `.mode`, `.mode.glyph`, `.presets`, `.preset`,
 * `.toggle`, `.copy`, `.index`, `.about` — plus `data-active` and `data-locked` on a mode.
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
  /**
   * True while this row can do nothing in the current scene — a loop's corners
   * while the way is not a loop. **Shown, never hidden**: the row is drawn
   * disabled and dimmed, so the panel keeps its shape as the scene changes.
   * Hiding rows was built first, for governed groups, and made the whole panel
   * jump whenever a layer was switched: "we can disable unused controls without
   * hiding them".
   *
   * Given the piece's settings. Typed `never` here so a piece can annotate its
   * own settings type on the argument.
   */
  inert?: (settings: never) => boolean
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

/**
 * The numeric shape of a row, which is all the grid and position helpers need.
 *
 * Exported because a piece's `normalizeSettings` now holds a table of these to
 * snap with — see `snapToGrid`. It was internal while the only callers were in
 * this file.
 */
export type Track = { min: number; max: number; step: number; scale?: Scale }

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

/**
 * A boolean, as a **toggle group**: two buttons side by side, the current one
 * lit, each setting its own value — the same row a choice draws.
 *
 * It used to be one button whose label flipped to say which way it currently
 * was, which reads as an action rather than a state: "having one button change
 * label based on state is possible, but is unorthodox and surprising".
 */
export type ToggleControl<K> = Shared & {
  kind: "toggle"
  key: K
  /** What the off button reads, then the on button. */
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
  /**
   * Most per row. Omitted, they all sit on one.
   *
   * **This is a width control, not a tidiness one.** The panel is a flex column
   * with no width of its own, so it is as wide as its widest row — and a set of
   * fifteen on one line made it 583px against the 446px everything else wanted.
   * Wrapping alone does not fix that: the row would happily take the width if
   * offered it, and it is the offer that has to be withdrawn.
   */
  columns?: number
}

/**
 * Free text, as one line of input: psyxels' subject, which was a choice of five
 * words until #263 — "no need to select from a limited set of subjects of
 * textual kind".
 *
 * `maxLength` is a promise the address has to keep, not a nicety: whatever is
 * typed goes into a shared link, so a piece states its limit here and in its
 * registry's text slot, and the validator is what holds the two together.
 *
 * **Typing is not a shortcut.** While a text field has the focus the panel's
 * keys — `c`, `f`, the digits, the arrows and a piece's own — are left alone,
 * or typing "Luna" would load preset nothing, and the `c` in "Acid" would close
 * the panel under the cursor.
 */
export type TextControl<K> = Shared & {
  kind: "text"
  key: K
  maxLength: number
  placeholder?: string
}

export type Control<K> =
  SliderControl<K> | RangeControl<K> | ChoiceControl<K> | ToggleControl<K> | SetControl<K> | TextControl<K>

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
 * The spacing a track's values sit on, at a given magnitude.
 *
 * `step` is a **floor** rather than the grid: a track from 0.15 to 40 needs
 * hundredths at the bottom and whole numbers at the top, so a log track is cut
 * at three significant figures unless `step` is coarser. A linear track's grid
 * is its `step` and nothing else.
 *
 * `finer` lets a piece store a setting at a resolution its slider does not
 * offer. That is not a contradiction: `step` says how far an arrow key moves a
 * handle, and it has never been a claim about which values the setting can
 * hold. Three settings in the section were recorded before their control's step
 * was what it is now and sit between its stops.
 */
export function gridAt(track: Track, value: number, finer?: number): number {
  const floor = finer !== undefined ? Math.min(finer, track.step) : track.step
  if (track.scale !== "log") return floor
  const magnitude = Math.max(Math.abs(value), Number.MIN_VALUE)
  return Math.max(floor, 10 ** (Math.floor(Math.log10(magnitude)) - 2))
}

/**
 * A value put onto its track's grid.
 *
 * **One rule, one implementation, and that is the point of it living here.**
 * The quantisation used to belong to `valueAtPosition` alone, so a value was cut
 * to the grid when a handle was dragged and left alone when it arrived from the
 * console API or a query string — the same scene with two spellings depending on
 * how it was reached. `normalizeSettings` now applies this to every route, and
 * `valueAtPosition` is written in terms of it so the two cannot drift apart.
 *
 * The final `toPrecision` is not cosmetic. Without it a snapped value arrives as
 * 0.30000000000000004 and goes into a shared URL that way.
 */
export function snapToGrid(track: Track, value: number, finer?: number): number {
  if (!Number.isFinite(value)) return value
  const grid = gridAt(track, value, finer)
  if (!(grid > 0)) return value
  return Number((Math.round(value / grid) * grid).toPrecision(10))
}

/** The value a position stands for, rounded to something a person would write. */
export function valueAtPosition(track: Track, position: number): number {
  const t = Math.min(1, Math.max(0, position))
  if (track.scale !== "log") return track.min + t * (track.max - track.min)

  const low = Math.max(track.min, Number.MIN_VALUE)
  return snapToGrid(track, low * (track.max / low) ** t)
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

/**
 * A group one of whose controls switches the rest of it on — #242.
 *
 * A layer of a piece, in crowd's case: boulders, a chase, a kind of ground.
 * While `governor` holds `off` the group's other rows are **inert** — drawn
 * disabled, never hidden, so the panel keeps its shape (see `inert` on a
 * control for why hiding was dropped). The governor
 * is an ordinary control in the group — a toggle, a slider whose zero means
 * absent, or a choice whose `off` option is the plain case — and it stays in
 * view under the heading, since it is how the group is switched back on.
 *
 * `off` is compared with the same one-level equality the preset matching uses.
 * It is the piece's to state rather than the kit's to guess: crowd's way and
 * its boulders are both off at `0`.
 *
 * **Inert is not reset.** The kit only disables; making an off layer's other
 * values canonical is the piece's validator's job, or two scenes that look the
 * same would stop matching the same preset.
 */
export type GovernedGroup<K extends string> = {
  name: string
  governor: K
  off: unknown
}

export type Options<S extends object> = {
  root: HTMLElement
  settings: S
  controls: Control<string & keyof S>[]
  presets: Preset<S>[]
  /**
   * Heading order. Omitted, the rows run together with no headings.
   *
   * An entry may be a **governed group** instead of a name: one of its controls
   * decides whether the rest mean anything, and its other rows hide while that
   * control holds `off`. See `GovernedGroup`.
   */
  groups?: readonly (string | GovernedGroup<string & keyof S>)[]
  /**
   * **Each group in a box of its own**, the boxes stacked down the right edge
   * and wrapping into further columns to the left as the frame runs out of
   * height, so nothing scrolls and no group is out of sight. Crowd's panel had
   * outgrown one scrolling column: "each section could be a box and those boxes
   * stack along the right side of the screen masonry grid style". Tabs were
   * the other answer and were not taken, because they put groups out of sight.
   * Needs `groups`; without them there is one box.
   */
  boxes?: boolean
  /**
   * With `boxes`, the key under which the viewer's folded boxes are remembered,
   * one per piece. A box folds to its heading when the heading is clicked:
   * "a user could then decide to collapse some modules so they stay collapsed
   * if they're not in use". **Browser storage, never the address**: which boxes
   * a viewer keeps folded is theirs, not the scene's, so a shared link opens
   * every box. Storage that is blocked or empty just means nothing is folded.
   */
  folds?: string
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
  /**
   * Where every piece is listed. Omitted, no link is shown. It has the
   * bottom-left corner, under the presets, because the only way back to the
   * gallery used to be through the note — and there it fills the last empty
   * corner and leaves `about` its own.
   */
  indexHref?: string
  /**
   * What the bar offers to copy, in order, one button each, after the piece's
   * actions and before `adjust`.
   *
   * Defaults to the one action every piece has: `copy link`, this page's
   * address. It sat in the panel as a full-width row until #257, which put it
   * in the bar reading exactly those two words, so the bar reads **reroll, copy
   * link, adjust** on every piece and nobody has to open the panel to share a
   * scene.
   *
   * The kit owns the button, its label, the copied / copy-failed reply and the
   * clipboard fallback in `copy.ts` — all genuinely shared, and `copy.ts` in
   * particular is careful work about plain-http origins that nobody should
   * rewrite. Deciding *what is worth copying* is not shared, and used to be the
   * one part of the row a caller could not supply: the label was configurable
   * and the text was not, so anything wanting to offer a second thing had to
   * rebuild the row, duplicate the clipboard handling, and trip
   * `tests/unit/kit-adoption.test.ts` for reimplementing shared code. See #144.
   */
  copy?: CopyAction[]
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

/**
 * One copy button in the bar.
 *
 * `text` is a function rather than a string because the interesting things to
 * copy are all derived from settings that move under it — the address changes
 * with every drag, and anything built from the current scene has the same
 * problem. Read at click time, it cannot go stale.
 */
export type CopyAction = {
  /** The button's resting label. Pieces word it differently. */
  label: string
  /** Built when the button is pressed. */
  text: () => string
  /** Tooltip. Worth saying what the copied text is for. */
  title?: string
}

function button(label: string, className = ""): HTMLButtonElement {
  const element = document.createElement("button")
  element.type = "button"
  element.textContent = label
  if (className) element.className = className
  return element
}

export function createControls<S extends object>(options: Options<S>): Controls<S> {
  const {
    root,
    controls: specs,
    presets,
    groups,
    boxes = false,
    folds,
    actions = [],
    normalize,
    url,
    onChange,
    aboutHref,
    indexHref,
  } = options
  const copyActions: CopyAction[] = options.copy ?? [
    {
      label: "copy link",
      title: "Copy this page's address, which carries every setting.",
      text: () => window.location.href,
    },
  ]
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
  panel.className = boxes ? "panel boxed" : "panel"
  // The viewer's folded boxes. Every read and write is guarded: private
  // windows, blocked storage and previews all throw or come back empty, and
  // each of those simply means nothing is folded.
  const foldKey = folds ? `kit:folds:${folds}` : null
  const folded = new Set<string>()
  if (foldKey) {
    try {
      const stored = JSON.parse(window.localStorage.getItem(foldKey) ?? "[]") as unknown
      if (Array.isArray(stored)) for (const name of stored) if (typeof name === "string") folded.add(name)
    } catch {
      folded.clear()
    }
  }
  const fold = (box: HTMLElement, heading: HTMLElement) => {
    const name = box.dataset.group ?? ""
    const now = !folded.has(name)
    if (now) folded.add(name)
    else folded.delete(name)
    box.dataset.folded = String(now)
    heading.setAttribute("aria-expanded", String(!now))
    if (!foldKey) return
    try {
      window.localStorage.setItem(foldKey, JSON.stringify([...folded]))
    } catch {
      // Remembered for this page only, then.
    }
  }

  /** Where the next group's rows go: the panel, or that group's own box. */
  let into: HTMLElement = panel
  const openBox = (name: string) => {
    if (!boxes) return
    const box = document.createElement("section")
    box.className = "box"
    box.dataset.group = name
    box.dataset.folded = String(folded.has(name))
    panel.append(box)
    into = box
  }
  panel.hidden = true

  /**
   * The presets have a column of their own, apart from the bar — #223.
   *
   * They used to lead one bar with the actions, `adjust` and `about` after
   * them, and at sixteen presets everything that was not a scene sat at the far
   * end of a row of scenes. So the presets run down the left edge in columns of
   * five, the bar holds the actions and `adjust` top right with the panel
   * opening beneath it, and `about` has the bottom-right corner to itself.
   */
  const presetColumn = document.createElement("div")
  presetColumn.className = "presets"

  // Built either way, appended only when the chrome is wanted: `render()` writes
  // to these nodes on every change and a headless mount would otherwise need a
  // second code path through the one function everything goes through.
  if (chrome) root.append(presetColumn, bar, panel)

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
    // Nor while somebody is typing into the panel: the chrome fading under a
    // caret reads as the field having lost what was typed.
    const focused = document.activeElement
    if (pointerOverUi || (focused instanceof HTMLInputElement && focused.type === "text" && root.contains(focused)))
      return
    idleTimer = window.setTimeout(() => setIdle(true), IDLE_MS)
  }

  // --- the bar -------------------------------------------------------------

  const presetButtons = presets.map((preset, index) => {
    const element = button(`${index + 1} ${preset.label}`, "preset")
    // A digit is one keypress, so the tenth preset onward has no key of its own
    // and its title must not claim one — #223.
    element.title = index < 9 ? `${preset.hint} (key ${index + 1}, or ← →)` : `${preset.hint} (← →)`
    element.addEventListener("click", () => apply(normalize({ ...preset.settings })))
    return element
  })

  const actionButtons = actions.map((action) => {
    const element = button(action.label, action.label)
    element.title = action.shortcut ? `${action.hint} (key ${action.shortcut})` : action.hint
    element.addEventListener("click", () => action.run(handle))
    return element
  })

  const copyButtons = copyActions.map((action) => {
    const element = button(action.label, "copy")
    if (action.title) element.title = action.title
    element.addEventListener("click", async () => {
      const copied = await copyText(action.text())
      element.textContent = copied ? "copied" : "copy failed"
      window.setTimeout(() => {
        element.textContent = action.label
      }, 1600)
    })
    return element
  })

  const settingsToggle = button("adjust", "toggle")
  settingsToggle.title = "Show or hide these controls (key c, Escape closes)"
  settingsToggle.addEventListener("click", () => setPanelOpen(!panelOpen))

  presetColumn.append(...presetButtons)
  bar.append(...actionButtons, ...copyButtons, settingsToggle)

  // The gallery's two links, one corner each: the way back to every piece
  // bottom left, beneath the presets, and the placard bottom right. Present
  // when you look for them, gone while you watch.
  if (indexHref) {
    const index = document.createElement("a")
    index.className = "index"
    index.href = indexHref
    index.textContent = "all experiments"
    index.title = "Every piece in the gallery"
    if (chrome) root.append(index)
  }
  if (aboutHref) {
    const about = document.createElement("a")
    about.className = "about"
    about.href = aboutHref
    about.textContent = "about"
    about.title = "A written note on this piece and how it came to look this way"
    if (chrome) root.append(about)
  }

  // --- the panel -----------------------------------------------------------

  const sliders = new Map<string, HTMLInputElement>()
  const spans = new Map<string, HTMLElement>()
  const valueLabels = new Map<string, HTMLElement>()
  const choiceButtons = new Map<string, Map<string, HTMLButtonElement>>()
  const toggleButtons = new Map<string, [HTMLButtonElement, HTMLButtonElement]>()
  const setButtons = new Map<string, Map<string, HTMLButtonElement>>()
  const textInputs = new Map<string, HTMLInputElement>()

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
  /** Each governed group's body, and what switches it off. */
  const governed: { body: HTMLElement; governor: string & keyof S; off: unknown }[] = []
  /** Every row the panel drew, with its control, so `render()` can mark the inert ones. */
  const drawn: { row: HTMLElement; control: Control<string & keyof S> }[] = []

  if (groups && groups.length > 0) {
    for (const entry of groups) {
      const group = typeof entry === "string" ? entry : entry.name
      const inGroup = specs.filter((control) => control.group === group)
      if (inGroup.length === 0) continue

      openBox(group)
      const heading = document.createElement("div")
      heading.className = "group"
      heading.textContent = group
      if (boxes) {
        const box = into
        heading.setAttribute("role", "button")
        heading.tabIndex = 0
        heading.title = "fold or unfold"
        heading.setAttribute("aria-expanded", String(box.dataset.folded !== "true"))
        // A click on the heading's own switch switches; anywhere else folds.
        heading.addEventListener("click", (event) => {
          if ((event.target as HTMLElement).closest(".row")) return
          fold(box, heading)
        })
        heading.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          fold(box, heading)
        })
      }
      into.append(heading)

      if (typeof entry === "string") {
        for (const control of inGroup) into.append(makeRow(control))
        continue
      }

      // The governor first, under its heading, and the rest in a body whose
      // rows `render()` makes inert while the governor holds `off`.
      const governor = inGroup.find((control) => keysOf(control).includes(entry.governor))
      if (!governor) throw new Error(`group "${group}" is governed by ${entry.governor}, which has no control in it`)
      const governorRow = makeRow(governor)
      governorRow.classList.add("governor")
      // **A toggle that governs a box switches the box, so it sits in the
      // box's heading**: "it's the whole section that's being turned on and
      // off, not one control inside the section". A governor with a range of
      // values — a slider whose zero is off — stays a row, since the section
      // is not simply on or off.
      if (boxes && governor.kind === "toggle") {
        governorRow.classList.add("switch")
        heading.append(governorRow)
      } else {
        into.append(governorRow)
      }

      const body = document.createElement("div")
      body.className = "rows"
      body.dataset.governor = entry.governor
      // Published so a test, or a piece's stylesheet, can tell what off is.
      body.dataset.off = JSON.stringify(entry.off)
      for (const control of inGroup) if (control !== governor) body.append(makeRow(control))
      into.append(body)
      governed.push({ body, governor: entry.governor, off: entry.off })
    }
  } else {
    openBox("")
    for (const control of specs) into.append(makeRow(control))
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
      let value = log ? valueAtPosition(control, Number(slider.value) / LOG_STEPS) : Number(slider.value)
      /*
       * **A log track's step can be finer than its grid**, and then the
       * keyboard stalls. An arrow key moves the position one part in
       * `LOG_STEPS`, which on a track spanning 1500× is 0.7% of the value — and
       * the grid keeps three significant figures, which just above a power of
       * ten is 1%. So the step rounds back to the value it left and the handle
       * never moves again, found on psyxels' sizes at 0.0104. When the
       * position moved and the value did not, take one grid step the same way.
       */
      if (log) {
        const held = Number(current[key as keyof S])
        const was = Math.round(positionOf(control, held) * LOG_STEPS)
        const now = Number(slider.value)
        if (value === held && now !== was) {
          value = snapToGrid(control, held + Math.sign(now - was) * gridAt(control, held * (now < was ? 0.999 : 1)))
        }
      }
      apply(normalize({ ...current, [key]: value }, key as string & keyof S))
    })
    sliders.set(key, slider)
    return slider
  }

  function makeRow(control: Control<string & keyof S>): HTMLDivElement {
    const row = buildRow(control)
    drawn.push({ row, control })
    return row
  }

  function buildRow(control: Control<string & keyof S>): HTMLDivElement {
    const row = document.createElement("div")
    row.className = "row"
    row.title = control.hint

    const label = document.createElement("span")
    label.className = "label"
    label.textContent = control.label

    if (control.kind === "set") {
      const group = document.createElement("div")
      group.className = "modes set"
      // A count rather than a media query, and set here rather than left to the
      // stylesheet, because only the piece knows how many of its own marks read
      // as a row. The range row hands its stylesheet `--from` and `--to` the
      // same way.
      group.style.setProperty("--set-columns", String(control.columns ?? control.options.length))
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

    if (control.kind === "text") {
      const input = document.createElement("input")
      input.type = "text"
      input.className = "text"
      input.maxLength = control.maxLength
      input.spellcheck = false
      input.autocomplete = "off"
      if (control.placeholder) input.placeholder = control.placeholder
      input.dataset.key = control.key
      input.setAttribute("aria-label", control.label)
      input.addEventListener("input", () => apply(normalize({ ...current, [control.key]: input.value }, control.key)))
      textInputs.set(control.key, input)
      row.append(label, input)
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
        const pair = [false, true].map((value) => {
          const element = button(control.labels[value ? 1 : 0], "mode")
          element.addEventListener("click", () => apply(normalize({ ...current, [control.key]: value }, control.key)))
          group.append(element)
          return element
        }) as [HTMLButtonElement, HTMLButtonElement]
        toggleButtons.set(control.key, pair)
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

  // --- state ---------------------------------------------------------------

  function render() {
    const offBodies = new Set<HTMLElement>()
    for (const { body, governor, off } of governed) {
      const isOff = sameValue(current[governor], off)
      body.dataset.inert = String(isOff)
      if (isOff) offBodies.add(body)
    }
    for (const { row, control } of drawn) {
      const underOff = row.parentElement !== null && offBodies.has(row.parentElement)
      const inert = underOff || (control.inert ? control.inert(current as never) : false)
      row.dataset.inert = String(inert)
      row.setAttribute("aria-disabled", String(inert))
      for (const input of row.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")) {
        input.disabled = inert
      }
    }

    for (const control of specs) {
      if (control.kind === "text") {
        const input = textInputs.get(control.key)
        const held = String(current[control.key] ?? "")
        // Written only when it differs, so the caret stays where the person
        // left it while they type.
        if (input && input.value !== held) input.value = held
        continue
      }

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
        const pair = toggleButtons.get(control.key)
        if (pair) {
          const on = Boolean(current[control.key])
          pair[0].dataset.active = String(!on)
          pair[1].dataset.active = String(on)
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

    // A key typed into a text field is text. Escape still closes the panel.
    if (event.target instanceof HTMLInputElement && event.target.type === "text" && event.key !== "Escape") return

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
