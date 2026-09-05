import { describe, expect, it } from "vitest"
import { optsOutOf, optsOutOfFile } from "./opt-out.ts"

/**
 * The escape hatch, against cases the repo does not contain.
 *
 * No piece carries an opt-out at all right now — starry-night's was the last and
 * came out in #136 — so nothing here can be exercised against real files. That
 * is exactly the shape a rule goes vacuous in: it would pass for ever, whether
 * or not it still recognises anything, which is the fault this hatch exists to
 * prevent in the first place.
 *
 * The same discipline `tests/unit/browser-suite.test.ts` uses on its own gate.
 */

const REASON = "the marks carry no colour, so there is no hue to give"

describe("the bare form", () => {
  it("says the file is not the kit's, when it gives a reason", () => {
    expect(optsOutOfFile(`// kit-opt-out: ${REASON}\nconst x = 1`)).toBe(true)
  })

  it("does not accept the marker without a reason", () => {
    // The failure these gates are for is silence, so a magic word that means
    // nothing is the one escape hatch that must not work.
    expect(optsOutOfFile("// kit-opt-out:\nconst x = 1")).toBe(false)
  })

  it("does not read a docblock terminator as a reason", () => {
    // A bare `\S` test after the colon matched the close of the very comment the
    // marker sat in, which is how `browser-because:` first shipped broken.
    expect(optsOutOfFile("/**\n * kit-opt-out:\n */\nconst x = 1")).toBe(false)
  })

  it("is absent from a file that never says it", () => {
    expect(optsOutOfFile("const x = 1 // nothing to declare here")).toBe(false)
  })
})

describe("the named form", () => {
  it("answers the check it names", () => {
    expect(optsOutOf(`// kit-opt-out(hue): ${REASON}`, "hue")).toBe(true)
  })

  it("answers no other check", () => {
    // The whole point of the split. Starry Night's one line was written about
    // its presets and silenced the primary and hue checks with it — #137.
    const source = `// kit-opt-out(hue): ${REASON}`
    expect(optsOutOf(source, "primary")).toBe(false)
    expect(optsOutOf(source, "presets")).toBe(false)
  })

  it("needs a reason too", () => {
    expect(optsOutOf("// kit-opt-out(hue):", "hue")).toBe(false)
  })

  it("tolerates the spacing someone will actually write", () => {
    expect(optsOutOf(`// kit-opt-out( hue ) : ${REASON}`, "hue")).toBe(true)
  })
})

/**
 * The two forms do not stand in for each other, in either direction.
 *
 * This is the pair of assertions that makes the split mean anything. A piece
 * needing both writes both, and a reader of either line knows exactly what it
 * covers — which is the property one unqualified marker could not have.
 */
describe("the two forms are not interchangeable", () => {
  it("does not let a bare marker answer a named check", () => {
    expect(optsOutOf(`// kit-opt-out: ${REASON}`, "hue")).toBe(false)
  })

  it("does not let a named marker say the file is not the kit's", () => {
    expect(optsOutOfFile(`// kit-opt-out(hue): ${REASON}`)).toBe(false)
  })

  it("reads both when both are written", () => {
    const source = `// kit-opt-out: ${REASON}\n// kit-opt-out(hue): ${REASON}`
    expect(optsOutOfFile(source)).toBe(true)
    expect(optsOutOf(source, "hue")).toBe(true)
    expect(optsOutOf(source, "primary")).toBe(false)
  })
})
