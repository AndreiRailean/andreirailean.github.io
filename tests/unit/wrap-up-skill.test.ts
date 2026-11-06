import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

/**
 * The wrap-up lists unfinished work, and before the signals.
 *
 * On 2026-11-06 a wrap-up counted its signals and findings and never mentioned
 * step 4 of an agreed plan, which lived only in the conversation about to be
 * cleared: nothing had gone wrong, so a review hunting for what cost something
 * passed over it. The pass that catches it is prose, so this holds its place.
 */
const skill = readFileSync(".claude/skills/wrap-up/SKILL.md", "utf8")
const step5 = skill.slice(skill.indexOf("## 5. What would be forgotten"), skill.indexOf("## The report"))
const report = skill.slice(skill.indexOf("## The report"))

it("reads for unfinished work first, then the signals", () => {
  const unfinished = step5.indexOf("Start with the work that is not finished")
  const signals = step5.indexOf("Then the signals")
  expect(unfinished, "step 5 has no pass for unfinished work").toBeGreaterThan(-1)
  expect(signals, "step 5 has no signals pass after it").toBeGreaterThan(unfinished)
})

it("reports each unfinished item with where it is recorded", () => {
  expect(report).toContain("unfinished: <n> (each → where it is recorded)")
})
