import { expect, test } from "./support/experiment.ts"

/**
 * The wall's furniture, and its one rule: it is up while somebody is moving and
 * gone when nobody is.
 *
 * Every assertion here needs a real page. The state is a timer, the reading is
 * a computed `opacity` the CSS decides, and `?idle=0` is a query string read at
 * load — none of which the unit runner has, since it is `environment: "node"`.
 *
 * **`?idle=0` is why these tests can click anything.** Furniture that fades
 * after two and a half seconds is a target a check would otherwise be racing,
 * and a flaky check is worse than none — so the escape hatch pins it, exactly
 * as the kit's `?idle=` does for the experiments.
 */

/** `IDLE_MS` in `viewer.ts`, plus room for the fade and a slow machine. */
const AFTER_THE_DELAY = 4000

const ENTRY = "/showcase/psyxels-ampersand/"

/** The wall, once a runner is actually on screen. Nothing here is about loading. */
async function openWall(page: import("@playwright/test").Page, query = "") {
  await page.goto(`${ENTRY}${query}`)
  const root = page.locator("#showcase")
  await expect(root).toHaveAttribute("data-state", "running")
  return root
}

test("the furniture arrives up and goes when nothing is moving", async ({ page }) => {
  const root = await openWall(page)

  // Up on arrival: landing on a scene and being told nothing about it would be
  // worse than the furniture never hiding at all.
  await expect(root).toHaveAttribute("data-idle", "false")
  await expect(page.locator(".placard")).toHaveCSS("opacity", "1")

  await expect(root).toHaveAttribute("data-idle", "true", { timeout: AFTER_THE_DELAY })

  // All five pieces, because the whole point is that they behave as one thing.
  for (const furniture of [".placard", ".counter", ".arrows", "[data-frame-toggle]", "[data-fullscreen-toggle]"]) {
    await expect(page.locator(furniture)).toHaveCSS("opacity", "0")
  }
})

test("the cursor goes with the furniture, rather than sitting on the work", async ({ page }) => {
  const root = await openWall(page)
  await expect(root).toHaveAttribute("data-idle", "true", { timeout: AFTER_THE_DELAY })
  await expect(root).toHaveCSS("cursor", "none")
})

test("a mouse moving brings it back", async ({ page }) => {
  const root = await openWall(page)
  await expect(root).toHaveAttribute("data-idle", "true", { timeout: AFTER_THE_DELAY })

  await page.mouse.move(640, 450)
  await expect(root).toHaveAttribute("data-idle", "false")
  await expect(page.locator(".placard")).toHaveCSS("opacity", "1")

  // And goes again, so waking is not a one-way door.
  await expect(root).toHaveAttribute("data-idle", "true", { timeout: AFTER_THE_DELAY })
})

test("the placard comes back with everything else, rather than keeping its own life", async ({ page }) => {
  const root = await openWall(page)
  await expect(root).toHaveAttribute("data-idle", "true", { timeout: AFTER_THE_DELAY })

  // The placard used to have a timer of its own that only a *tap* reset, so on a
  // desktop the scene's name was unrecoverable without clicking — which also
  // paused the piece. This is that fix.
  await page.mouse.move(300, 300)
  await expect(page.locator(".placard .scene")).toHaveText("ampersand")
  await expect(page.locator(".placard")).toHaveCSS("opacity", "1")
  await expect(root).toHaveAttribute("data-paused", "false")
})

test("hidden furniture takes no clicks, so the first tap wakes and the second presses", async ({ page }) => {
  const root = await openWall(page)
  await expect(root).toHaveAttribute("data-idle", "true", { timeout: AFTER_THE_DELAY })

  // `pointer-events: none` while idle. Without it a button nobody can see is
  // still a button somebody can hit, which is the trap this avoids.
  await expect(page.locator("[data-frame-toggle]")).toHaveCSS("pointer-events", "none")
  await expect(root).toHaveAttribute("data-framed", "false")
})

test("the keyboard wakes it too, since that is how a desktop drives the wall", async ({ page }) => {
  const root = await openWall(page)
  await expect(root).toHaveAttribute("data-idle", "true", { timeout: AFTER_THE_DELAY })

  await page.keyboard.press("ArrowDown")
  await expect(root).toHaveAttribute("data-idle", "false")
})

test("it behaves the same in fullscreen, which is where the work most wants the room", async ({ page }) => {
  const root = await openWall(page)

  // A key press is the user gesture `requestFullscreen` insists on.
  await page.keyboard.press("f")
  await expect(root).toHaveAttribute("data-fullscreen", "true")

  await expect(root).toHaveAttribute("data-idle", "true", { timeout: AFTER_THE_DELAY })
  await expect(page.locator("[data-fullscreen-toggle]")).toHaveCSS("opacity", "0")

  await page.mouse.move(700, 500)
  await expect(root).toHaveAttribute("data-idle", "false")
})

test("`?idle=0` pins the furniture on, for anything that cannot chase a fading target", async ({ page }) => {
  const root = await openWall(page, "?idle=0")

  await page.waitForTimeout(AFTER_THE_DELAY)
  await expect(root).toHaveAttribute("data-idle", "false")
  await expect(page.locator(".placard")).toHaveCSS("opacity", "1")

  // And the toggle is reachable without a wake-up tap first.
  await page.locator("[data-frame-toggle]").click()
  await expect(root).toHaveAttribute("data-framed", "true")
})
