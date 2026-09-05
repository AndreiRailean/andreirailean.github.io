import { createCrowd, type Crowd } from "@/experiments/walkers/crowd"
import { normalizeSettings, type Settings } from "@/experiments/walkers/settings"
import { makeView, type View } from "@/experiments/walkers/view"

/**
 * A park, headless, with the verbs the page's API uses.
 *
 * **This exists to remove a reason, not to save typing.** Tests kept landing in
 * the browser suite that had no business there — assertions about `crowd.ts`,
 * which is arithmetic on numbers and needs no canvas at all. The cause was not
 * conviction. It was that `window.experiment` hands you `settle`, `set` and
 * `stats` through one call, and getting the same three here meant building a
 * view, constructing a crowd and writing your own step loop, in every file that
 * wanted them. The browser was the path of least resistance even where it was
 * the wrong home.
 *
 * **Be honest about what moving one saves.** The first case moved out of
 * `tests/walkers.spec.ts` cost about 18 seconds there and costs 16.3 here: the
 * settle dominates, and simulating thirty seconds of park is the same
 * arithmetic in either runner. What is saved per test is the page — a browser
 * launch, a navigation, a compile — and what is saved structurally is that
 * Playwright parallelises across *files* but not within one, so eighteen
 * seconds off `walkers.spec.ts` comes straight off the serial chain that sets
 * the browser suite's wall clock. The big lever is neither: it is how much park
 * a test insists on settling at all.
 *
 * So the verbs are deliberately the page's, and mean the same things: a test
 * that reads `stats()` after a `settle()` should move between the two suites by
 * changing its import. `tests/unit/browser-suite.test.ts` is the gate that
 * notices when one has not.
 *
 * What is **not** here is the three fields that only exist because something
 * drew: `heads`, `fps` and `running`. That is not an omission to be fixed — it
 * is the line itself. An assertion that needs one of them needs a page and
 * belongs in `tests/walkers.spec.ts`; an assertion that does not, does not.
 */
export type Park = {
  /** Run the crowd forward, in seconds of park. */
  settle: (seconds: number) => Park
  /**
   * Change the scene, the way the panel does.
   *
   * Rebuilds the view, since `span` and `camera` decide how much ground is in
   * frame and therefore how many people the density asks for.
   */
  set: (patch: Partial<Settings>) => Park
  /**
   * Everything `window.experiment.stats()` reports except what drawing fills
   * in. `area` and `clock` are here because both are properties of the view and
   * the crowd rather than of a frame.
   */
  stats: () => ReturnType<Crowd["stats"]> & { clock: number; area: number }
  crowd: Crowd
  view: View
  settings: Settings
}

/**
 * The step the unit suite runs at, where the piece runs at 1/120.
 *
 * A longer step is the harder case for everything asserted here — anticipation
 * has less warning, and the positional contact resolution has further to undo —
 * so passing at 1/60 implies passing at the rate the scene uses, for half the
 * arithmetic. Stated once, here, rather than in each file that used to declare
 * its own.
 */
export const STEP = 1 / 60

/**
 * How far past the frame the world extends, in metres.
 *
 * As small as a world can be while still having one. The scene derives this
 * from its span; here it is a constant and a deliberately mean one, because it
 * is not part of anything under test and it is expensive: the opening cast is
 * scattered across the whole world rather than only the frame, so doubling the
 * margin roughly doubles the people simulated to look at the same picture.
 */
export const MARGIN = 4

/**
 * A frame, in pixels.
 *
 * Small, because nearly every claim here is about people per square metre
 * rather than about how many people there are — a third of the frame is the
 * same physics at a third of the cost. The exception is lane sorting, which
 * needs the *span* as well as the density, because files form along a walker's
 * path and a crossing has to last long enough for one to.
 */
const FRAME = { width: 1280, height: 800 }

export function park(patch: Partial<Settings> = {}, frame: { width: number; height: number } = FRAME): Park {
  let settings = normalizeSettings(patch)
  let view = makeView(settings.span, settings.camera, frame.width, frame.height, MARGIN)
  const crowd = createCrowd({ view, settings })
  crowd.fill()

  const self: Park = {
    settle(seconds) {
      const steps = Math.round(seconds / STEP)
      for (let step = 0; step < steps; step++) crowd.step(STEP)
      return self
    },
    set(next) {
      settings = normalizeSettings({ ...settings, ...next })
      view = makeView(settings.span, settings.camera, frame.width, frame.height, MARGIN)
      crowd.remeasure(view, settings)
      crowd.recolour(settings)
      self.view = view
      self.settings = settings
      return self
    },
    stats: () => ({ ...crowd.stats(), clock: crowd.clock, area: view.area }),
    crowd,
    view,
    settings,
  }

  return self
}
