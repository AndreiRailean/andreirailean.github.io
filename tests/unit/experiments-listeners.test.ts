import { readdirSync, readFileSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * **A scene drops every listener it took.**
 *
 * `stop()` is teardown, not pause — `src/experiments/AGENTS.md` says so
 * outright: "`stop()` is teardown — it drops the resize listener", while
 * `setPaused(held)` parks the animation frame and nothing else. So a listener a
 * piece registers has to come off again, and the thing it costs when it does not
 * is not the listener: **a handler holds its closure, and that closure is the
 * whole scene** — canvas, settings, buffers, and in flotsam's case 8,500 specks.
 * Every mount that is torn down retains one.
 *
 * #168 is the case. Flotsam and Dangler each registered two listeners and
 * dropped one, and walkers — nearly byte-identical to flotsam here — dropped
 * both. So there was a correct precedent in the section the whole time and
 * nothing compared them.
 *
 * **Why it went unnoticed for so long, which is the part worth keeping.** It is
 * invisible by construction. The leaked callback wakes a loop that is no longer
 * running, so nothing happens, nothing errors, and no screenshot or `stats()`
 * differs. And until a host existed that mounts and unmounts repeatedly, every
 * consumer mounted once and never tore down — so the bug was real and cost
 * nothing, which is the worst combination for being found.
 *
 * ### Why an identifier match, rather than counting calls
 *
 * Dangler's was not a missing line. It was
 *
 *     stillOnly.addEventListener("change", () => { … })
 *
 * an inline arrow with **no reference to it anywhere**, so no
 * `removeEventListener` was even writable. A check that counted `addEventListener`
 * against `removeEventListener` would have reported "one missing" and sent the
 * next person looking for a line to add, when the fix is to name the handler
 * first. Matching on the handler *identifier* catches the shape instead: an
 * inline handler has nothing to match, and the failure can say why.
 *
 * ### It needs no exemptions, and that was checked rather than assumed
 *
 * Every listener under `src/experiments/<slug>/` was enumerated when this was
 * written:
 * no `once: true`, no `AbortController`, no `signal`, and every handler a named
 * identifier bar the one bug. So there is no allow-list here on purpose — the
 * moment one is needed, that is a real decision someone should have to write
 * down rather than a pattern this file quietly tolerates.
 *
 * If a piece ever genuinely needs a listener that outlives `stop()`, the
 * section's own escape hatch applies: a `kit-opt-out: <reason>` line in the
 * file, per `tests/unit/opt-out.ts`.
 *
 * ### What it does not check, stated so nobody reads it as stronger
 *
 * **It matches presence, not position.** The pair has to exist somewhere in the
 * same file; it is not required to be inside `stop()`. So a piece whose removal
 * sits only in some other teardown method would pass this while `stop()` still
 * leaked, and that is a weaker guarantee than the heading above claims.
 *
 * Deliberate, because the section has not settled on one teardown method name —
 * a piece may reasonably carry both a `stop()` and a `destroy()`, and dropping
 * its listeners in either is defensible depending on which a host calls.
 * Requiring `stop()` specifically would encode a naming convention this check
 * has no business deciding, and names are exactly what `kit-adoption.test.ts`
 * stopped trusting.
 *
 * What it does catch is the fault that actually happened twice: **registered and
 * never removed at all.** That is the shape with no visible symptom, and the one
 * a reader cannot spot by looking at `stop()`, because what is missing is not
 * there to see.
 *
 * **Presence also means a duplicate removal is fine**, which is not a special
 * case bolted on: walkers already drops both of its listeners in two different
 * places, and has done since before this check existed.
 */

import { optsOutOfFile } from "./opt-out.ts"

const EXPERIMENTS = "src/experiments"

/** Not pieces: shared code, and the section's own docs. */
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

/**
 * `target.addEventListener("event", handler` — the target, the event, and
 * whatever the second argument starts with.
 *
 * The handler is captured loosely, up to the next `,` or `)`, because the whole
 * point is to tell a bare identifier from anything else. An arrow function's
 * capture will contain `=>` or `(`, and that is the signal.
 */
const ADDS = /([A-Za-z0-9_$.?]+)\.addEventListener\(\s*"([^"]+)"\s*,\s*([^,)]*)/g
const REMOVES = /([A-Za-z0-9_$.?]+)\.removeEventListener\(\s*"([^"]+)"\s*,\s*([^,)]*)/g

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

type Listener = { target: string; event: string; handler: string }

function listeners(source: string, pattern: RegExp): Listener[] {
  return [...source.matchAll(pattern)].map((match) => ({
    // `stillOnly?.` and `stillOnly.` are the same subscription.
    target: match[1]!.replace(/\?$/, ""),
    event: match[2]!,
    handler: match[3]!.trim(),
  }))
}

const files = (slug: string) =>
  readdirSync(`${EXPERIMENTS}/${slug}`)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => [name, readFileSync(`${EXPERIMENTS}/${slug}/${name}`, "utf8")] as const)

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

it("finds listeners at all, so a broken pattern cannot pass for a clean section", () => {
  // The regex above is the whole instrument. If it stops matching — a formatter
  // wraps a call, someone writes `on("resize")` — every assertion below passes
  // over nothing, which is how a check dies quietly.
  const found = slugs.flatMap((slug) => files(slug).flatMap(([, source]) => listeners(source, ADDS)))
  expect(found.length, "no addEventListener calls matched anywhere in the section").toBeGreaterThan(4)
})

describe.each(slugs)("%s", (slug) => {
  it("names every handler it registers, so teardown can reach it", () => {
    const inline: string[] = []
    for (const [name, source] of files(slug)) {
      if (optsOutOfFile(source)) continue
      for (const { target, event, handler } of listeners(source, ADDS)) {
        if (!IDENTIFIER.test(handler)) inline.push(`${name}: ${target}.on("${event}") with ${handler || "?"}…`)
      }
    }

    expect(
      inline,
      `${slug} registers a listener with an inline handler, so nothing can ever remove it — ` +
        `removeEventListener needs the same function reference. Hoist it to a named const above ` +
        `the registration, as walkers does with onResize. Dangler's reduced-motion watcher was ` +
        `written this way and the missing teardown was therefore unwritable rather than ` +
        `forgotten. See #168.`,
    ).toEqual([])
  })

  it("removes every listener it adds", () => {
    const orphans: string[] = []
    for (const [name, source] of files(slug)) {
      if (optsOutOfFile(source)) continue
      const removed = listeners(source, REMOVES)
      for (const added of listeners(source, ADDS)) {
        if (!IDENTIFIER.test(added.handler)) continue // the check above owns that
        const matched = removed.some(
          (gone) => gone.target === added.target && gone.event === added.event && gone.handler === added.handler,
        )
        if (!matched) orphans.push(`${name}: ${added.target}.removeEventListener("${added.event}", ${added.handler})`)
      }
    }

    expect(
      orphans,
      `${slug} adds a listener it never removes. \`stop()\` is teardown and must drop it — a ` +
        `handler holds its closure, and that closure is the whole scene, so every mount that is ` +
        `torn down retains one. The missing call is: ${orphans.join("; ")}. Nothing visible ` +
        `happens when this is wrong, which is why it needs a check rather than review. If a ` +
        `listener genuinely has to outlive stop(), say why with a "kit-opt-out: <reason>" line.`,
    ).toEqual([])
  })
})
