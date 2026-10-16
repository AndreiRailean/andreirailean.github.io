import { existsSync, readFileSync, statSync, watch } from "node:fs"
import { BRIDGE_LOG, bridgePort } from "../src/experiments/gallery/bridge.ts"

/**
 * Reading what Andrei's preview pages have posted. See `src/experiments/gallery/bridge.ts`.
 *
 *     pnpm run bridge                 the last 20 events, then follow
 *     pnpm run bridge state [piece]   the latest scene, as a preset
 *     pnpm run bridge trace [piece]   the latest page's `?trace=1` events
 *
 * **"Save what I have on screen as preset X"** is `bridge state <piece>`: the
 * settings he is looking at, ready to paste into that piece's `presets.ts` under
 * his label. Check the `at` line — it is the time of the last change he made,
 * and an old one means the page you want is not the page that posted.
 */

type Event = {
  at?: string
  page?: string
  piece?: string
  type?: string
  [key: string]: unknown
}

function events(): Event[] {
  if (!existsSync(BRIDGE_LOG)) return []
  return readFileSync(BRIDGE_LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Event]
      } catch {
        return []
      }
    })
}

function describe(event: Event): string {
  const { at, page, piece, type } = event
  const time = typeof at === "string" ? at.slice(11, 23) : "?"
  const head = `${time} ${piece} ${page}`
  if (type === "trace") return `${head} trace ${event.event} ${event.detail} focus=${event.focus}`
  if (type === "scene") return `${head} scene ${event.presetLabel ?? "(no preset)"} ${event.url}`
  const shown = Object.fromEntries(
    Object.entries(event).filter(([key]) => !["at", "page", "piece", "type", "marker", "t"].includes(key)),
  )
  return `${head} ${type} ${JSON.stringify(shown)}`
}

function status(): void {
  const port = bridgePort()
  if (port === null) {
    console.error("No bridge is running for this worktree. `pnpm run preview` starts one.\n")
  }
}

function tail(): void {
  status()
  for (const event of events().slice(-20)) console.log(describe(event))
  if (!existsSync(BRIDGE_LOG)) {
    console.log(`Nothing posted yet; waiting for ${BRIDGE_LOG}.`)
  }
  let offset = existsSync(BRIDGE_LOG) ? statSync(BRIDGE_LOG).size : 0
  const read = () => {
    if (!existsSync(BRIDGE_LOG)) return
    const size = statSync(BRIDGE_LOG).size
    if (size < offset) offset = 0
    if (size === offset) return
    const fresh = readFileSync(BRIDGE_LOG, "utf8").slice(offset)
    offset = size
    for (const line of fresh.split("\n").filter(Boolean)) {
      try {
        console.log(describe(JSON.parse(line) as Event))
      } catch {
        // A line caught mid-write; the next read has it whole.
      }
    }
  }
  watch(".astro", read)
  setInterval(read, 1000)
}

function state(piece: string | undefined): void {
  const scene = events()
    .filter((event) => event.type === "scene" && (piece === undefined || event.piece === piece))
    .at(-1)
  if (!scene) {
    status()
    console.error(`No scene posted${piece ? ` for ${piece}` : ""} yet. Is the page open on the preview?`)
    process.exitCode = 1
    return
  }
  console.log(`// ${scene.piece}, as on screen at ${scene.at} (page ${scene.page})`)
  console.log(`// ${scene.url}`)
  if (scene.presetLabel) console.log(`// this is preset ${Number(scene.preset) + 1}, "${scene.presetLabel}"`)
  console.log(JSON.stringify({ label: "", hint: "", settings: scene.settings }, null, 2))
}

function trace(piece: string | undefined): void {
  const all = events().filter((event) => piece === undefined || event.piece === piece)
  const page = all.filter((event) => event.type === "trace").at(-1)?.page
  if (!page) {
    console.error("No trace posted yet. Open the page with ?trace=1.")
    process.exitCode = 1
    return
  }
  for (const event of all.filter((each) => each.page === page)) console.log(describe(event))
}

const [command, argument] = process.argv.slice(2)
if (command === "state") state(argument)
else if (command === "trace") trace(argument)
else if (command === undefined || command === "tail") tail()
else {
  console.error(`Unknown command "${command}". Try: pnpm run bridge [tail | state [piece] | trace [piece]]`)
  process.exitCode = 1
}
