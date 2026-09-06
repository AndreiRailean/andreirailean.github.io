/**
 * A scene packed into one short, opaque query parameter.
 *
 * Section level rather than `kit/`, on the test the layers ADR sets: a piece
 * could take this without taking the chrome. It needs no browser and knows
 * nothing about a panel — see the "What the kit is not" section of
 * `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`.
 *
 * **Why addresses stopped being readable**, and what was weighed against it, is
 * `docs/adr/20260906-an-address-is-packed-not-readable.md`. The short version:
 * `20260905-a-shared-address-states-the-whole-scene.md` made every piece write
 * all of its settings out, which is right and made addresses 214 to 489
 * characters long. Nobody types them; the names were a side effect of how the
 * pieces grew. Readability moved to the panel, which keeps its labels, and to
 * `experiment.decode()`, which expands an address back to a plain object.
 *
 * ## The registry, which is the whole design
 *
 * Each piece owns an **append-only** list of slots. A slot is allocated once and
 * is immutable after — anything that would change its `grid`, `origin`, `bits`
 * or option list retires it and appends a new one, and the reader maps both to
 * the same setting.
 *
 * **So the slot index is the version, and there is no version field.** That is
 * what versioning per parameter rather than per schema buys:
 *
 * - **Adding a setting is free.** An address written before that slot existed
 *   has a shorter bitmap and is simply silent about it, and silence falls back
 *   to the piece's defaults — which is what `DEFAULT_SETTINGS` is for, and what
 *   the previous record already says an address that named nothing should get.
 * - **Changing a setting's resolution is an append.** Every address ever written
 *   keeps decoding, through the retired slot.
 * - **Retiring costs one bit.** A piece could retire a setting a month for a
 *   decade and pay about seventeen characters.
 *
 * What no encoding can catch is a setting being *redefined* while its numbers
 * stay the same. The slot guarantees the number survives; it says nothing about
 * what the number means. **If you change what a value means, retire the slot
 * anyway** — it costs a seventh of a character, which is the only reason a rule
 * like that is worth writing down.
 *
 * ## The grid is the registry's, not the control's
 *
 * `bits` and `grid` are frozen here rather than read from the live control, so a
 * control's `min` and `max` can move without touching an address anyone has
 * already written. `normalizeSettings` clamps on read, which is where clamping
 * belongs. See `docs/adr/20260906-a-setting-lands-on-a-grid.md`.
 */

/** URL-safe base64, in the order `btoa` would not give us. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

/** How many slots one group of the bitmap covers, leaving a continuation bit. */
const GROUP = 7

/**
 * One setting's place in a piece's address, fixed for as long as the piece
 * exists.
 *
 * `retired` slots are never written and are always read: an address older than
 * the retirement still sets that bit and still carries those bits, and dropping
 * the slot would misalign everything after it.
 */
export type Slot =
  | { key: string; kind: "num"; grid: number; origin: number; bits: number; retired?: true }
  | { key: string; kind: "bool"; retired?: true }
  | { key: string; kind: "enum"; options: readonly string[]; retired?: true }
  | { key: string; kind: "set"; options: readonly string[]; retired?: true }

/** How many bits a slot's value occupies. Fixed by the slot, never by a control. */
export function bitsOf(slot: Slot): number {
  switch (slot.kind) {
    case "num":
      return slot.bits
    case "bool":
      return 1
    case "enum":
      return Math.max(1, Math.ceil(Math.log2(Math.max(2, slot.options.length))))
    case "set":
      return slot.options.length
  }
}

type Scene = Record<string, unknown>

function toBits(slot: Slot, value: unknown): number {
  switch (slot.kind) {
    case "bool":
      return value ? 1 : 0
    case "enum": {
      const at = slot.options.indexOf(String(value))
      return at < 0 ? 0 : at
    }
    case "set": {
      const held = Array.isArray(value) ? (value as unknown[]).map(String) : []
      return slot.options.reduce((mask, name, index) => (held.includes(name) ? mask | (1 << index) : mask), 0)
    }
    case "num": {
      const index = Math.round((Number(value) - slot.origin) / slot.grid)
      return Number.isFinite(index) ? Math.min(2 ** slot.bits - 1, Math.max(0, index)) : 0
    }
  }
}

function fromBits(slot: Slot, packed: number): unknown {
  switch (slot.kind) {
    case "bool":
      return packed === 1
    case "enum":
      return slot.options[Math.min(packed, slot.options.length - 1)]
    case "set":
      return slot.options.filter((_, index) => packed & (1 << index))
    case "num":
      // `toPrecision` for the same reason the grid rule has it: without it a
      // value comes back as 0.30000000000000004 and the round trip fails on a
      // number a person would call identical.
      return Number((slot.origin + packed * slot.grid).toPrecision(12))
  }
}

/**
 * Pack a scene into text.
 *
 * Retired slots are skipped, so their bit is 0 in anything written from now on
 * and the value bits are simply absent — which is the same shape as an address
 * written before a slot existed, and decodes the same way.
 */
export function encodeScene(registry: readonly Slot[], scene: Scene): string {
  const present = registry.map((slot) => !slot.retired && slot.key in scene)
  const bits: number[] = []

  for (let at = 0; at < present.length; at += GROUP) {
    bits.push(at + GROUP < present.length ? 1 : 0)
    for (let step = 0; step < GROUP; step++) bits.push(present[at + step] ? 1 : 0)
  }

  registry.forEach((slot, index) => {
    if (!present[index]) return
    const width = bitsOf(slot)
    const packed = toBits(slot, scene[slot.key])
    for (let bit = width - 1; bit >= 0; bit--) bits.push((packed >> bit) & 1)
  })

  let text = ""
  for (let at = 0; at < bits.length; at += 6) {
    let value = 0
    for (let step = 0; step < 6; step++) value = (value << 1) | (bits[at + step] ?? 0)
    text += ALPHABET[value]
  }
  return text
}

/**
 * Unpack a scene, or `null` for anything this registry cannot read.
 *
 * Returning `null` rather than throwing or guessing: a caller's answer to a
 * corrupt address is to fall back to the named-parameter reader and then to the
 * defaults, and an exception in a page's first statement would take the piece
 * down with it.
 *
 * A slot later in the registry wins over an earlier one for the same key, which
 * is what makes retirement work: an address carrying both a retired slot and its
 * replacement ends up with the replacement's value.
 */
export function decodeScene(registry: readonly Slot[], text: string): Scene | null {
  if (text === "") return null

  const bits: number[] = []
  for (const character of text) {
    const value = ALPHABET.indexOf(character)
    if (value < 0) return null
    for (let bit = 5; bit >= 0; bit--) bits.push((value >> bit) & 1)
  }

  let at = 0
  const present: boolean[] = []
  for (;;) {
    if (at + GROUP >= bits.length + 1 && present.length === 0) return null
    const more = bits[at]
    if (more === undefined) return null
    at += 1
    for (let step = 0; step < GROUP; step++) present.push(bits[at + step] === 1)
    at += GROUP
    if (more === 0) break
    // An address claiming more groups than it carries is corrupt, not old.
    if (at >= bits.length) return null
  }

  const scene: Scene = {}
  for (const [index, slot] of registry.entries()) {
    if (!present[index]) continue
    const width = bitsOf(slot)
    if (at + width > bits.length) return null
    let packed = 0
    for (let bit = 0; bit < width; bit++) packed = (packed << 1) | bits[at + bit]!
    at += width
    scene[slot.key] = fromBits(slot, packed)
  }

  // A bitmap longer than the registry is an address from a *newer* build. The
  // slots it names are unreadable here and are skipped rather than guessed at;
  // everything up to the end of this registry has already been read.
  return scene
}
