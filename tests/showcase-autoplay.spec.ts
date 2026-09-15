import { expect, test } from "./support/experiment.ts"

/**
 * Autoplay: the wall stepping through itself, for a screen nobody is standing at.
 *
 * **A kiosk is the case this exists for**, and it is the one a browser is the
 * only way to check: the claim is about a timer, a `pushState` and a wrap at the
 * end of a real wall, none of which the unit runner has.
 *
 * **Every assertion here reads the index off `window.showcaseWall`, not the
 * clock.** A test that waits a beat and expects to find entry two is a test that
 * fails on a loaded machine — and worse, one that passes for the wrong reason
 * when it lands on entry three. Reading the sequence the wall actually visited
 * is the only shape of this check that cannot be flaky.
 *
 * That was not enough on its own, and the wrap test says how: reading the right
 * thing still races if the reading *starts* late. It passed alone and failed in
 * a full run, which is the only place the page was ever slow enough. Both
 * absences below name the presence that pairs them, for the same reason.
 *
 * Every test pins `?idle=0`. The furniture is hidden by default now, and a
 * counter that fades is a thing to race.
 */

type WallWindow = { showcaseWall?: { at: () => number; go: (to: number) => void } }

/** Where the wall is, as it reports itself. */
const index = () => (window as unknown as WallWindow).showcaseWall!.at()

/**
 * Where every test starts. The end of the wall is reached by walking rather than
 * by address, so nothing here hardcodes a length — see the wrap test.
 */
const FIRST = "embers-winter-blues"

async function openWall(page: import("@playwright/test").Page, id: string, query: string) {
  await page.goto(`/showcase/${id}/${query}`)
  await expect(page.locator("#showcase")).toHaveAttribute("data-state", "running")
  await page.waitForFunction(() => Boolean((window as unknown as WallWindow).showcaseWall))
}

test("the wall stays where it was put when nothing asked it to move", async ({ page }) => {
  await openWall(page, FIRST, "?idle=0")
  const start = await page.evaluate(index)

  // The default has to be off, or every link anybody has ever shared becomes a
  // slideshow that walks away from the scene it was sent for.
  //
  // **An absence, so it is worth something only next to a presence.** `?play`
  // steps on in about a second in the test below, and this window is four times
  // that — long enough for the thing being denied to have happened four times
  // over. Alone it would pass just as readily against autoplay broken outright,
  // which is the timing-dependent negative `AGENTS.md` names.
  await page.waitForTimeout(4000)
  expect(await page.evaluate(index)).toBe(start)
})

test("`?play` steps on by itself", async ({ page }) => {
  await openWall(page, FIRST, "?play=1&idle=0")

  await page.waitForFunction(() => (window as unknown as WallWindow).showcaseWall!.at() !== 0)

  // And it is a real move rather than a counter ticking: the entry on screen is
  // a different one, read off the wall rather than off the address — which by
  // design no longer moves. See the kiosk test below.
  const entry = await page.evaluate(() => document.querySelector(".placard .scene")?.textContent)
  expect(entry).not.toBe("winter blues")
})

test("it wraps at the end rather than parking on the last entry", async ({ page }) => {
  await openWall(page, FIRST, "?play=1&idle=0")

  /*
   * The whole bug this feature exists to fix, one entry later: a kiosk that
   * clamps at the end shows the last scene forever. `go()` still clamps for a
   * person pressing the arrow — the wrap belongs to the timer alone.
   *
   * **It walks to the end from inside the page rather than loading the last
   * entry's address**, which is not a shortcut. Landing on `/showcase/<last>/`
   * and then watching made the test a race against its own page load: on a
   * loaded machine the boot took longer than the interval, the wall had already
   * come round before the observer started, and it recorded `[0, 1, 2]` — a
   * failure that only appeared in a full suite run. Jumping once the page is up
   * has no such window.
   *
   * `go(10_000)` clamps to the last entry whatever the wall's length, so this
   * hardcodes no index and quietly asserts the clamp is still there — which is
   * the half of the behaviour the wrap is defined against.
   */
  const visited = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const wall = (window as unknown as WallWindow).showcaseWall!
        wall.go(10_000)
        const seen = [wall.at()]
        const tick = () => {
          const at = wall.at()
          if (seen.at(-1) !== at) seen.push(at)
          if (seen.length >= 3) resolve(seen)
          else requestAnimationFrame(tick)
        }
        tick()
      }),
  )

  // It really was at the end, and it really came round to the top.
  expect(visited[0]).toBeGreaterThan(0)
  expect(visited.slice(1)).toEqual([0, 1])
})

test("holding the piece holds the wall", async ({ page }) => {
  await openWall(page, FIRST, "?play=1&idle=0")

  await page.keyboard.press(" ")
  await expect(page.locator("#showcase")).toHaveAttribute("data-paused", "true")

  // Read *after* pausing, so an advance that slipped through before the key
  // landed cannot make this pass or fail for the wrong reason.
  const held = await page.evaluate(index)
  await page.waitForTimeout(4000)
  expect(await page.evaluate(index)).toBe(held)

  // And letting go starts it again, so pause is a pause and not a stop — which
  // is also what keeps the wait above from being an absence nobody paired.
  await page.keyboard.press(" ")
  await page.waitForFunction((from) => (window as unknown as WallWindow).showcaseWall!.at() !== from, held)
})

test("a scene that cannot load is stepped past rather than parked on", async ({ page, problems }) => {
  await page.route("**/showcase/runners/*.js", (route) => route.fulfill({ status: 404, body: "gone" }))
  await page.goto(`/showcase/${FIRST}/?play=1&idle=0`)
  await page.waitForFunction(() => Boolean((window as unknown as WallWindow).showcaseWall))

  await expect(page.locator(".trouble")).toBeVisible()

  // Without this a dead runner is a kiosk showing an error card until somebody
  // walks over to it. With autoplay on, the wall heals itself at the next tick.
  await page.waitForFunction(() => (window as unknown as WallWindow).showcaseWall!.at() !== 0)

  // Provoked on purpose — every runner on the wall is 404 here.
  expect(problems.some((problem) => problem.includes("/showcase/runners/"))).toBe(true)
  problems.length = 0
})

test("`?shuffle` plays a lap rather than the curated order", async ({ page }) => {
  // Seeded, so this asserts a property of the shuffle and not of one lucky
  // draw — `playwright.config.ts` takes the same line about the pieces: a
  // failure here has to be a real difference and not weather.
  await openWall(page, FIRST, "?play=1&shuffle&seed=7&idle=0")

  // Five is enough to see both ways this can be wrong, and costs five seconds
  // rather than the twenty-four a full lap would add to the suite. That a lap
  // is a whole permutation is asserted in `tests/unit/showcase-play.test.ts`,
  // where it costs microseconds and can be run three hundred times.
  const visited = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const wall = (window as unknown as WallWindow).showcaseWall!
        const seen = [wall.at()]
        const tick = () => {
          const at = wall.at()
          if (seen.at(-1) !== at) seen.push(at)
          if (seen.length >= 5) resolve(seen)
          else requestAnimationFrame(tick)
        }
        tick()
      }),
  )

  // Not the curated order — which is the ask — and no repeats, which is the
  // half a naive `Math.random()` jump would fail and be *more* repetitive for.
  expect(visited).not.toEqual([0, 1, 2, 3, 4])
  expect(new Set(visited).size).toBe(visited.length)
})

test("`?play=1-2` is a range and still steps", async ({ page }) => {
  await openWall(page, FIRST, "?play=1-2&idle=0")

  // That the draw actually varies is `pickInterval`'s, in the unit suite, over
  // five hundred samples. What needs a page is only that a range parses into
  // something the wall will act on at all.
  await page.waitForFunction(() => (window as unknown as WallWindow).showcaseWall!.at() !== 0)
})

test("a wall playing itself leaves the address exactly as the kiosk set it", async ({ page }) => {
  const configured = `/showcase/${FIRST}/?play=1&idle=0`
  await openWall(page, FIRST, "?play=1&idle=0")
  const before = await page.evaluate(() => history.length)

  // The address is a kiosk's *configuration*, not a location, and rewriting it
  // is what broke the real one: a wrapper enforcing a start URL reads the
  // rewrite as the page navigating away and puts its own URL back, so the wall
  // played one interval, tried to move, and was reset to the first entry —
  // forever, looking exactly like a wall that could not navigate.
  //
  // Pushing was the first answer and piled up an entry per interval; replacing
  // was the second and still rewrote the address. Writing nothing is the third.
  await page.waitForFunction(() => (window as unknown as WallWindow).showcaseWall!.at() >= 2)

  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(configured)
  expect(await page.evaluate(() => history.length)).toBe(before)

  // A person moving is navigation and still pushes — and carries the query, or
  // arrowing off a `?play` address would quietly switch autoplay off.
  await page.keyboard.press("ArrowUp")
  expect(await page.evaluate(() => history.length)).toBe(before + 1)
  expect(page.url()).toContain("play=1")
  expect(page.url()).toContain("idle=0")
})

test("a reload comes back to the playlist, not to whichever scene was up", async ({ page }) => {
  await openWall(page, FIRST, "?play=1&shuffle&idle=0")
  await page.waitForFunction(() => (window as unknown as WallWindow).showcaseWall!.at() !== 0)

  // What a reload is *for* on a kiosk is a restart, and what it must come back
  // to is the configuration. Losing the query here is what left a restarted
  // kiosk on one frozen scene — indistinguishable from one nobody configured.
  await page.reload()
  await page.waitForFunction(() => Boolean((window as unknown as WallWindow).showcaseWall))

  /*
   * **Still moving is the claim, not landing somewhere non-zero.**
   *
   * The first version of this asserted `at() !== 0` after the reload, and it
   * passed against the very regression it was written for: the old code wrote
   * the scene's bare address, so a reload landed on that scene — a non-zero
   * index, with autoplay silently off. Trivially true and blind to the fault,
   * which `AGENTS.md` calls a check that cannot see what it is meant to check.
   *
   * Reading from where the reload actually landed and requiring it to leave is
   * the claim with no way to be accidentally satisfied.
   */
  const resumed = await page.evaluate(index)
  await page.waitForFunction((from) => (window as unknown as WallWindow).showcaseWall!.at() !== from, resumed)
})
