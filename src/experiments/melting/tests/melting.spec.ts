import type { ExperimentApi } from "@/experiments/melting/runner"
import { expect, openExperiment, test } from "../../../../tests/support/experiment"

/**
 * Melting, driven through its console API.
 *
 * The piece's one claim a still cannot show is that **the lamp is a function of
 * its seed and the moment**: two screens opened together agree, and `goto(t)`
 * lands on the same lamp from anywhere. The rest is which blobs a preset puts
 * in it, read by id rather than by pixel — a lamp with a ceiling and one without
 * both look like wax.
 *
 * The ids are `melting.ts`'s: the solid's corners count up from 0, satellites
 * from 100 000, the gathered solid is 150 000, lumps of wax from 200 000, the
 * pool from 300 000 and the ceiling from 400 000. A blob that is not there
 * keeps its id at radius 0 rather than leaving the list, so only blobs with a
 * size count as drawn.
 */

/** Any moment will do; this one is the poster's. */
const MOMENT = 1_800_000_101

const SATELLITE_ID = 100_000
const WAX_ID = 200_000
const CEILING_ID = 400_000

function openMelting(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "melting", options)
}

test("the lamp is a function of the moment: the same from anywhere, and on a second screen", async ({
  page,
  context,
}) => {
  const first = await openMelting(page, { idle: true })
  const at = ({ api, arg }: { api: ExperimentApi; arg?: unknown }) => {
    api.pause(true)
    api.goto(arg as number)
    return api.blobs()
  }

  const here = await first.api(at, MOMENT)
  expect(here.length).toBeGreaterThan(0)
  await first.api(at, MOMENT + 517)
  expect(await first.api(at, MOMENT)).toEqual(here)

  const elsewhere = await openMelting(await context.newPage(), { idle: true })
  expect(await elsewhere.api(at, MOMENT)).toEqual(here)
})

test("lava pong hangs a ceiling and the primary does not", async ({ page }) => {
  const experiment = await openMelting(page, { idle: true })
  const ids = ({ api, arg }: { api: ExperimentApi; arg?: unknown }) => {
    api.pause(true)
    api.preset(arg as string)
    api.goto(1_800_000_101)
    return api
      .blobs()
      .filter((blob) => blob.r > 0)
      .map((blob) => blob.id)
  }

  const pong = await experiment.api(ids, "lava pong")
  expect(pong.filter((id) => id >= CEILING_ID).length).toBeGreaterThan(0)

  const lamp = await experiment.api(ids, "lava lamp")
  expect(lamp.filter((id) => id >= CEILING_ID)).toEqual([])
  // Paired presence: the primary's solid is there, so an empty list above is
  // not merely an empty lamp.
  expect(lamp.filter((id) => id < SATELLITE_ID).length).toBeGreaterThan(0)
})

test("wax alone has no solid, and nothing budded from one", async ({ page }) => {
  const experiment = await openMelting(page, { idle: true })
  const ids = await experiment.api(({ api }) => {
    api.pause(true)
    api.preset("wax alone")
    api.goto(1_800_000_101)
    return api
      .blobs()
      .filter((blob) => blob.r > 0)
      .map((blob) => blob.id)
  })

  expect(ids.length).toBeGreaterThan(0)
  expect(ids.filter((id) => id < WAX_ID)).toEqual([])
})
