import { existsSync } from "node:fs"
import { filesCarryingTheBridge } from "../src/experiments/gallery/bridge.ts"

/**
 * Fails a production build that carries the preview bridge's client.
 *
 * The last step of `pnpm run build`, which is what CI's lint job and the deploy
 * run. The client is only ever built in while a preview sidecar is alive and
 * `NO_BRIDGE` is unset, so this should never find anything; it exists so that
 * "should" is checked on the artefact rather than trusted. See
 * `src/experiments/gallery/bridge.ts`.
 */

const DIST = "dist"

if (!existsSync(DIST)) {
  console.error(`check:bridge: no ${DIST}/ to check. Run it after a build.`)
  process.exit(1)
}

const found = filesCarryingTheBridge(DIST)
if (found.length > 0) {
  console.error("check:bridge: the preview bridge's client is in this build, which must never deploy:")
  for (const path of found.slice(0, 10)) console.error(`  ${path}`)
  if (found.length > 10) console.error(`  …and ${found.length - 10} more`)
  console.error("Build with `pnpm run build`, which sets NO_BRIDGE.")
  process.exit(1)
}
console.log(`check:bridge: no preview bridge in ${DIST}/.`)
