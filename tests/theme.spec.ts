import { expect, test } from "./support/experiment.ts"

/**
 * The site's light/dark scheme, and the one question that matters about it:
 * **does it still follow the operating system tomorrow?**
 *
 * The toggle has offered a "System" item since it was written, so the bug this
 * file pins was never a missing feature. It was that `ThemeToggle.astro`
 * persisted the *outcome* rather than the *choice* — a MutationObserver wrote
 * `localStorage` on every change to the `.dark` class, and the React control
 * sets that class on mount, so a visitor who never touched the menu had a
 * concrete `"light"` or `"dark"` recorded for them on their first page load.
 * Every visit afterwards took the stored branch and the system was never asked
 * again. "System" was a state the component could be in for one paint and never
 * after a reload.
 *
 * browser-because: `prefers-color-scheme` and its `change` event are the
 * subject, not scaffolding around it. Only a real page can be told the OS
 * switched while it is open, which is the entire behaviour under test —
 * `page.emulateMedia` is the only way to say "sunset happened" and a headless
 * harness has no media query to change.
 *
 * ## The regression test starts in dark, and that is not a detail
 *
 * Written starting in light, it **passed against the broken code** — which is
 * how it was caught, by running it before the fix. Measured rather than
 * reasoned: with the OS in light the old code stored `null`, with the OS in dark
 * it stored `"dark"`.
 *
 * The reason is the flash. Nothing writes storage unless the `.dark` class
 * actually *changes*, and the React control's mount effect ran once with its
 * `"theme-light"` initial state before correcting itself — so a dark-OS visitor
 * flipped light-then-dark and had both values written, while a light-OS visitor
 * never changed the class at all and was never pinned. A light-first check
 * therefore asserts absence over a window in which the failure cannot occur,
 * which is the timing-dependent negative `AGENTS.md` lists: it reads as coverage
 * of the exact case it cannot see.
 *
 * So the starting scheme is the subject, and the reload is the other half — the
 * bad write happens on load one and is only read on load two.
 */

/** Whether the document is currently in dark mode, by the class Tailwind reads. */
const isDark = () => document.documentElement.classList.contains("dark")

/**
 * Every explicit choice, as stored. Read through the page rather than asserted
 * as a literal in three places, so renaming the key breaks one line here.
 *
 * The key is deliberately not the old `theme`: that slot cannot distinguish a
 * click from the observer's automatic write, so anyone who had visited before
 * this change carried a pin they never chose. A new name is the only way the
 * fix reaches them.
 */
const STORED = () => localStorage.getItem("theme-choice")

test("with no choice stored, the page follows the system — including a switch made while it is open", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")
  expect(await page.evaluate(isDark)).toBe(false)

  // The live half. Reading `prefers-color-scheme` once at load is how a session
  // that outlives sunset ends up on the morning's scheme.
  await page.emulateMedia({ colorScheme: "dark" })
  await expect.poll(async () => await page.evaluate(isDark)).toBe(true)

  await page.emulateMedia({ colorScheme: "light" })
  await expect.poll(async () => await page.evaluate(isDark)).toBe(false)
})

test("a visit that touches nothing stores nothing, so the next visit still asks the system", async ({ page }) => {
  // Dark first, deliberately. This is the only starting scheme under which the
  // old code wrote anything at all — see the note above; in light it stored
  // `null` and this test passed while the bug was fully present.
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  expect(await page.evaluate(isDark)).toBe(true)

  expect(
    await page.evaluate(STORED),
    "the page recorded a scheme for a visitor who never chose one — that is the bug: " +
      "persisting the outcome instead of the choice pins the visitor to whatever the OS " +
      "happened to say on their first load",
  ).toBeNull()

  // A different machine, or the same one come morning. The reload is the point:
  // the bad write was made on the visit above and only read on this one.
  await page.emulateMedia({ colorScheme: "light" })
  await page.reload()
  expect(await page.evaluate(isDark)).toBe(false)
  expect(await page.evaluate(STORED)).toBeNull()
})

/**
 * The returning visitor, who is the only person the migration is for.
 *
 * **Seeded rather than asserted as absent.** The first draft of this checked
 * that `localStorage.theme` was empty after an ordinary visit, which passes
 * trivially now that nothing writes that key — absence with no paired presence,
 * which `AGENTS.md` lists because it reads as coverage while testing nothing.
 * The presence has to be put there on purpose, because the state under test
 * belongs to a version of the site that no longer exists.
 */
test("a scheme the old code stored on a visitor's behalf is ignored, and cleared", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")

  // Exactly what a dark-OS visitor was left holding by the old code: the old
  // key, pinned, and no record of an actual choice.
  await page.evaluate(() => {
    localStorage.setItem("theme", "dark")
    localStorage.removeItem("theme-choice")
  })

  // Their next visit, on a light machine or in the morning.
  await page.emulateMedia({ colorScheme: "light" })
  await page.reload()

  expect(
    await page.evaluate(isDark),
    "the stale pin was honoured, so everyone who visited before this change is still stuck " +
      "on the scheme their OS happened to report that day",
  ).toBe(false)

  // Ignoring it is the behaviour; clearing it is hygiene, so that nothing later
  // mistakes it for a live preference. Separate assertions because the first can
  // hold while the second does not.
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull()
})

test("an explicit choice outranks the system, and survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  expect(await page.evaluate(isDark)).toBe(true)

  // Through the control rather than by writing storage directly: the point is
  // that a click is what makes a choice explicit, and a test that seeds
  // `localStorage` itself would pass even if the menu had stopped recording
  // anything at all.
  await page.getByRole("button", { name: "Toggle theme" }).click()
  await page.getByRole("menuitemradio", { name: "Light" }).click()

  await expect.poll(async () => await page.evaluate(isDark)).toBe(false)
  expect(await page.evaluate(STORED)).toBe("light")

  // Still light with the OS in dark, and still light after a reload. The first
  // says the choice wins now; the second says it was actually written down.
  await page.emulateMedia({ colorScheme: "dark" })
  await expect.poll(async () => await page.evaluate(isDark)).toBe(false)

  await page.reload()
  expect(await page.evaluate(isDark)).toBe(false)
})

test("choosing System hands the page back to the OS, live", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")

  // Pin it to light first, or "System" would be indistinguishable from doing
  // nothing — the assertion needs a state to return *from*. This is the paired
  // presence for what is otherwise an assertion about absence.
  await page.getByRole("button", { name: "Toggle theme" }).click()
  await page.getByRole("menuitemradio", { name: "Light" }).click()
  await expect.poll(async () => await page.evaluate(isDark)).toBe(false)

  await page.getByRole("button", { name: "Toggle theme" }).click()
  await page.getByRole("menuitemradio", { name: "System" }).click()

  // Back to the OS immediately...
  await expect.poll(async () => await page.evaluate(isDark)).toBe(true)
  expect(await page.evaluate(STORED)).toBe("system")

  // ...and following it again afterwards, which is the part a one-shot "apply
  // the current value" implementation gets wrong while looking correct.
  await page.emulateMedia({ colorScheme: "light" })
  await expect.poll(async () => await page.evaluate(isDark)).toBe(false)
})

/**
 * Which option the menu says is in effect.
 *
 * Asserted through `aria-checked` on the radio items rather than by looking for
 * a dot, because that is the half a screen reader gets and the half a CSS change
 * cannot quietly take away. It is also a paired assertion by construction: one
 * item checked *and* the other two not, so a build that marked everything, or
 * nothing, fails either way rather than passing on the one clause that happens
 * to hold.
 */
test("the menu marks the choice that is in effect, and keeps up with a new one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")

  const checked = async () => {
    await page.getByRole("button", { name: "Toggle theme" }).click()
    const items = page.getByRole("menuitemradio")
    await items.first().waitFor()
    const marks = await items.evaluateAll((nodes) =>
      nodes.map((node) => `${node.textContent?.trim()}:${node.getAttribute("aria-checked")}`),
    )
    await page.keyboard.press("Escape")
    return marks
  }

  // Nothing stored, so the honest answer is System — not "Dark" because the OS
  // happens to be dark. The distinction is the whole point of the menu now.
  expect(await checked()).toEqual(["Light:false", "Dark:false", "System:true"])

  await page.getByRole("button", { name: "Toggle theme" }).click()
  await page.getByRole("menuitemradio", { name: "Light" }).click()
  await expect.poll(async () => await page.evaluate(isDark)).toBe(false)

  expect(await checked()).toEqual(["Light:true", "Dark:false", "System:false"])

  // And after a reload, which is where a mark rendered from component state
  // rather than from the stored choice would quietly revert.
  await page.reload()
  expect(await checked()).toEqual(["Light:true", "Dark:false", "System:false"])
})

/**
 * The visible consequence, and the reason this lives beside `showcase.spec.ts`.
 *
 * `src/pages/index.astro` mirrors the `.dark` class onto the published
 * background through its own MutationObserver, so the home page's scene is the
 * thing a person actually notices at sunset. The class flipping and the scene
 * following are separate mechanisms and either can break alone.
 */
test("the home page's background scene follows the system switch too", async ({ page }) => {
  type ShowcaseWindow = { showcase?: { stats: () => { variant: string }[] } }
  const variant = () => (window as unknown as ShowcaseWindow).showcase?.stats()[0]?.variant
  const mounted = () => (window as unknown as ShowcaseWindow).showcase?.stats().length === 1

  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")
  await page.waitForFunction(mounted)
  expect(await page.evaluate(variant)).toBe("light")

  await page.emulateMedia({ colorScheme: "dark" })
  await expect.poll(async () => await page.evaluate(variant)).toBe("dark")
})
