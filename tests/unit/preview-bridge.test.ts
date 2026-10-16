import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { BRIDGE_MARKER, bridgePort, filesCarryingTheBridge } from "@/experiments/gallery/bridge"

/**
 * The preview bridge must never deploy, and what keeps it out is tested here
 * rather than trusted. See `src/experiments/gallery/bridge.ts` and #305.
 *
 * Three layers, each tested against cases the repo does not contain, because a
 * gate that has only ever seen a clean tree has never been seen to work:
 *
 * - the **decision**: a page gets the client only while a sidecar is alive and
 *   `NO_BRIDGE` is unset;
 * - the **scan** that `pnpm run build` ends with, which has to find the marker
 *   wherever it lands and nothing where it is absent;
 * - the **wiring**: the build CI and the deploy run sets `NO_BRIDGE` and ends
 *   with the scan.
 */

const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function dir(): string {
  const made = mkdtempSync(join(tmpdir(), "bridge-"))
  scratch.push(made)
  return made
}

function stateFile(pid: number, port = 5555): string {
  const path = join(dir(), "bridge.json")
  writeFileSync(path, JSON.stringify({ pid, port, startedAt: "" }))
  return path
}

/** A pid that is certainly dead: one that has just exited. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""])
  await new Promise((resolve) => child.on("exit", resolve))
  return child.pid!
}

describe("whether a build carries the client", () => {
  it("does while a sidecar is alive", () => {
    expect(bridgePort({}, stateFile(process.pid, 5601))).toBe(5601)
  })

  it("does not when the build says NO_BRIDGE, even with a sidecar alive", () => {
    expect(bridgePort({ NO_BRIDGE: "1" }, stateFile(process.pid))).toBeNull()
  })

  it("does not when the sidecar that wrote the state has died", async () => {
    expect(bridgePort({}, stateFile(await deadPid()))).toBeNull()
  })

  it("does not when there is no state, or it is not a state", () => {
    expect(bridgePort({}, join(dir(), "absent.json"))).toBeNull()
    const garbage = join(dir(), "bridge.json")
    writeFileSync(garbage, "{ half")
    expect(bridgePort({}, garbage)).toBeNull()
  })
})

describe("the scan a production build ends with", () => {
  it("finds the marker in any file at any depth", () => {
    const root = dir()
    mkdirSync(join(root, "experiments", "crowd"), { recursive: true })
    writeFileSync(join(root, "index.html"), "<html></html>")
    writeFileSync(join(root, "experiments", "crowd", "index.html"), `<script>const m = "${BRIDGE_MARKER}"</script>`)
    expect(filesCarryingTheBridge(root)).toEqual([join(root, "experiments", "crowd", "index.html")])
  })

  it("finds nothing in a build without it", () => {
    const root = dir()
    writeFileSync(join(root, "index.html"), "<html><script>fetch('/')</script></html>")
    expect(filesCarryingTheBridge(root)).toEqual([])
  })
})

describe("the build that deploys", () => {
  const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts

  it("builds with NO_BRIDGE and ends with the scan", () => {
    const steps = scripts.build!.split("&&").map((step) => step.trim())
    expect(steps).toContain("NO_BRIDGE=1 astro build")
    expect(steps.at(-1)).toBe("pnpm run check:bridge")
    expect(scripts["check:bridge"]).toBe("node scripts/check-no-bridge.ts")
  })

  it("is the build CI runs", () => {
    // withastro/action runs the package's own `build` script for the deploy.
    expect(readFileSync(".github/workflows/lint.yml", "utf8")).toMatch(/run: pnpm run build\s*$/m)
    expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain("withastro/action")
  })
})
