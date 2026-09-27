import { mkdirSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { chromium, type Page } from "playwright"
import { resolveChromium } from "../tests/support/chromium.ts"
import startPreviewServer from "../tests/support/preview-server.ts"

/**
 * `pnpm run shot <slug> [preset] [json patch] [--settle s] [--zoom x,y,w,h] [--size WxH]`
 *
 * **One picture of one scene, with the numbers beside it — #240.** Every
 * session that needed to *see* a scene wrote a Playwright script for it, and a
 * script can only import `playwright` from inside the repo — so it lived in
 * `.scratch/` and turned the lint job red, or in `tests/` and risked being
 * committed. This is that script, once.
 *
 * It builds and serves the site the way the browser suite does
 * (`tests/support/preview-server.ts`), so the picture is the artefact that
 * ships. Then: the piece, idled so the chrome is out of shot; the preset, by
 * number or name; the patch over it; `--settle` seconds through the piece's own
 * `settle` or `run`; one frame; the screenshot, cropped by `--zoom` in CSS
 * pixels. It prints the PNG's path and `stats()` together, because a still is
 * evidence for a person and the numbers are what a check would read.
 *
 * Stills go to `.scratch/shots/`, which is private scratch space and never
 * compared — `tests/AGENTS.md`, "The principle".
 */

export type ShotArgs = {
  slug: string
  preset?: number | string
  patch: Record<string, unknown>
  settle?: number
  zoom?: { x: number; y: number; width: number; height: number }
  size: { width: number; height: number }
}

/** The browser suite's viewport, so a shot shows what a test sees. */
const SIZE = { width: 1280, height: 900 }

export function parseShotArgs(argv: string[]): ShotArgs {
  const positional: string[] = []
  const flags = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith("--")) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`)
      flags.set(arg.slice(2), value)
      i++
    } else positional.push(arg)
  }

  const [slug, ...rest] = positional
  if (!slug)
    throw new Error("usage: pnpm run shot <slug> [preset] [json patch] [--settle s] [--zoom x,y,w,h] [--size WxH]")

  let preset: number | string | undefined
  let patch: Record<string, unknown> = {}
  for (const value of rest) {
    // Anything that looks like JSON is read as JSON, so an array or a typo is
    // refused rather than taken for a preset name.
    if (/^\s*[[{]/.test(value)) {
      const parsed: unknown = JSON.parse(value)
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
        throw new Error("the patch must be a JSON object")
      patch = parsed as Record<string, unknown>
    } else if (preset === undefined) {
      preset = /^\d+$/.test(value) ? Number(value) : value
    } else throw new Error(`unexpected argument: ${value}`)
  }

  const numbers = (flag: string, count: number, separator: string) => {
    const raw = flags.get(flag)
    if (raw === undefined) return undefined
    const parts = raw.split(separator).map(Number)
    if (parts.length !== count || parts.some((part) => !Number.isFinite(part))) {
      throw new Error(`--${flag} wants ${count} numbers separated by "${separator}", got ${raw}`)
    }
    return parts
  }

  const settleRaw = numbers("settle", 1, ",")
  const zoom = numbers("zoom", 4, ",")
  const size = numbers("size", 2, "x")
  for (const flag of flags.keys()) {
    if (!["settle", "zoom", "size"].includes(flag)) throw new Error(`unknown flag --${flag}`)
  }

  return {
    slug,
    preset,
    patch,
    settle: settleRaw?.[0],
    zoom: zoom && { x: zoom[0]!, y: zoom[1]!, width: zoom[2]!, height: zoom[3]! },
    size: size ? { width: size[0]!, height: size[1]! } : SIZE,
  }
}

/** Where a shot is written: named for what it shows, so a folder of them reads as a list. */
export function shotPath(args: ShotArgs): string {
  const scene = [args.preset ?? "primary", Object.keys(args.patch).length > 0 ? "patched" : ""]
    .filter(Boolean)
    .join("-")
    .toString()
    .replace(/[^a-z0-9-]+/gi, "-")
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `.scratch/shots/${args.slug}-${scene}-${stamp}.png`
}

async function main(): Promise<void> {
  const args = parseShotArgs(process.argv.slice(2))
  const baseUrl = await startPreviewServer()
  const browser = await chromium.launch({ executablePath: resolveChromium() })
  try {
    const context = await browser.newContext({ viewport: args.size, reducedMotion: "no-preference" })
    const page = await context.newPage()
    const problems: string[] = []
    page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`))
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console.error: ${message.text()}`)
    })

    await page.goto(`${baseUrl}/experiments/${args.slug}/`)
    await page.waitForFunction(() => Boolean(window.experiment), undefined, { timeout: 30_000 })

    const stats = await run(
      page,
      ({ api, arg }) => {
        const piece = api as {
          idle: (force: boolean) => void
          preset: (which: number | string) => unknown
          set: (patch: Record<string, unknown>) => unknown
          settle?: (seconds: number) => unknown
          run?: (seconds: number) => unknown
          stats?: () => unknown
        }
        const { preset, patch, settle } = arg as Pick<ShotArgs, "preset" | "patch" | "settle">
        piece.idle(true)
        if (preset !== undefined) piece.preset(preset)
        if (Object.keys(patch).length > 0) piece.set(patch)
        let settled = "no"
        if (settle !== undefined && settle > 0) {
          const step = piece.settle ?? piece.run
          if (!step) settled = "asked for, but this piece has neither settle() nor run()"
          else {
            step.call(piece, settle)
            settled = `${settle}s`
          }
        }
        return { settled, stats: piece.stats?.() }
      },
      { preset: args.preset, patch: args.patch, settle: args.settle },
    )

    // One frame, so the canvas holds what the settings just made: `set()` does not draw.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))

    const png = await page.screenshot({ type: "png", clip: args.zoom })
    const path = shotPath(args)
    mkdirSync(".scratch/shots", { recursive: true })
    writeFileSync(path, png)

    console.log(path)
    console.log(`settled: ${stats.settled}`)
    console.log(JSON.stringify(stats.stats, null, 2))
    if (problems.length > 0) {
      console.error(`${args.slug} reported ${problems.length} problem(s):\n  ${problems.join("\n  ")}`)
      process.exitCode = 1
    }
    await context.close()
  } finally {
    await browser.close()
  }
}

/** `scripts/posters.ts`'s helper: the callback runs in the page, and only `arg` travels with it. */
async function run<T>(page: Page, fn: (handle: { api: unknown; arg?: unknown }) => T, arg?: unknown): Promise<T> {
  const handle = await page.evaluateHandle(() => {
    const api = window.experiment
    if (!api) throw new Error("window.experiment is missing — did the piece's module fail to load?")
    return api
  })
  try {
    return await page.evaluate(fn as never, { api: handle, arg })
  } finally {
    await handle.dispose()
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
