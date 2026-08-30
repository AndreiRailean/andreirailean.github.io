import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, posix, relative, resolve } from "node:path"

/**
 * Checking that every address the built site points at is a thing the built
 * site contains.
 *
 * Runs as the last step of `npm run build`, which puts it on both gates that
 * matter: the pull-request check, and the deploy — `withastro/action` builds by
 * running that same script.
 *
 * It exists because a dangling URL was the one breakage this project had no way
 * of noticing. Astro will write `/_astro/avatar.<hash>.jpg` into a page and then
 * not emit the file: reading `.src` off an image import asks for the original,
 * and the build only writes an original when nothing has asked the image
 * service to process that image — a question it answers by contents rather than
 * by path, so a byte-identical twin elsewhere in the tree can take the decision
 * for you. That is what happened to Psyxels' portrait, and every gate we had
 * said the site was fine. `astro dev` serves imports straight off disk, so the
 * browser suite passed. `astro build` reported nothing. The page rendered, just
 * without its subject. The only symptom was a 404 in production, on one preset,
 * found by a person.
 *
 * The check is deliberately dumb: read the HTML, resolve each local address
 * against `dist/`, complain about the ones that are not there. It knows nothing
 * about Astro, and so cannot be fooled by whatever Astro decides to inline,
 * hash or skip next.
 */

const DIST = "dist"

/**
 * An address this site is responsible for answering.
 *
 * Root-relative or explicitly relative, which is every address Astro emits. The
 * line is drawn on the leading character rather than on which attribute the
 * value came from, because the attribute that broke was `data-avatar` — an
 * experiment handing its own script an asset — and a list of names would never
 * have had it on it.
 *
 * The cost of reading the value rather than the name is that a bare `about/`
 * is indistinguishable from the hundreds of attribute values that are not
 * addresses at all: `en`, `utf-8`, `width=device-width`, every class list on
 * the page. So bare relatives are not checked. Nothing here emits one, and a
 * check that cried wolf on `lang="en"` would be turned off within the week.
 */
const isLocal = (value: string) => /^[./]/.test(value) && !value.startsWith("//")

/**
 * Attribute values and `url()`s, which between them carry every address in the
 * output — `src`, `href`, `srcset`, the `content` of a meta tag, a `data-*`
 * an experiment reads back, and whatever a stylesheet points at.
 */
const ATTRIBUTE = /\s[a-zA-Z][a-zA-Z0-9-]*\s*=\s*"([^"]*)"/g
const CSS_URL = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/g

/** Every `.html` under `dist/`, which is every page the site publishes. */
function pages(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...pages(path))
    else if (entry.name.endsWith(".html")) found.push(path)
  }
  return found
}

/**
 * One attribute value to the addresses in it.
 *
 * Only `srcset` holds more than one, as `url 560w, url 2x`, and it is taken
 * apart by shape rather than by attribute name for the same reason the
 * addresses are found by shape: `imagesrcset` on a preload carries the same
 * syntax under a different name. A comma inside a filename would be split
 * wrongly; hashed asset names do not contain one.
 */
function addresses(value: string): string[] {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean)
}

/**
 * Whether a file in `dist/` answers this address.
 *
 * A directory address is answered by its `index.html`, and an extensionless one
 * by either that or a sibling `.html` — which is how a static host reads them,
 * and therefore the only reading that matters here.
 */
function resolves(address: string, page: string): boolean {
  const path = address.split(/[?#]/)[0]
  if (!path) return true

  const from = posix.dirname("/" + relative(DIST, page).split(/[\\/]/).join("/"))
  const absolute = path.startsWith("/") ? path : posix.resolve(from, path)
  const target = resolve(DIST, "." + absolute)
  const root = resolve(DIST)

  // A `../` that climbs past the root is broken however the host reads it.
  if (target !== root && !target.startsWith(root + "/")) return false

  return [target, join(target, "index.html"), target + ".html"].some((candidate) => {
    try {
      return statSync(candidate).isFile()
    } catch {
      return false
    }
  })
}

try {
  statSync(DIST)
} catch {
  console.error(`No ${DIST}/ to check. Run the build first.`)
  process.exit(1)
}

const broken: { page: string; address: string }[] = []
const seen = new Set<string>()

for (const page of pages(DIST)) {
  const html = readFileSync(page, "utf8")
  const values = [...html.matchAll(ATTRIBUTE), ...html.matchAll(CSS_URL)].map((match) => match[1])

  for (const address of values.flatMap(addresses).filter(isLocal)) {
    const key = `${page} ${address}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!resolves(address, page)) broken.push({ page, address })
  }
}

if (broken.length > 0) {
  console.error(`\n${broken.length} of ${seen.size} addresses in ${DIST}/ point at nothing:\n`)
  for (const { page, address } of broken) console.error(`  ${address}\n    in ${page}\n`)
  process.exit(1)
}

console.log(`${seen.size} addresses in ${DIST}/, all of them answered.`)
