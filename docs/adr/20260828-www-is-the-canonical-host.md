---
type: ADR
status: accepted
date: 2026-08-28
summary: www.andrei.md stays canonical; the apex redirects to it at Cloudflare, and astro.config's `site` was corrected to match what has always been served.
---

# `www` is the canonical host

## Context

`astro.config.mjs` declared `site: "https://andrei.md"` while the site has
always been served from `https://www.andrei.md`. Every page therefore advertised
a canonical URL, an `og:url` and a `twitter:url` pointing at a host that
immediately 301s, and fetched its favicon over a cross-host hop.

The reason it was `www` in the first place was the belief that GitHub Pages
cannot serve an apex domain. That is out of date — Pages has supported apex
domains for years via A records to `185.199.108–111.153`, and Cloudflare's CNAME
flattening is a second route. `www` was never forced.

What is actually deployed matters more than either, and was not written down
anywhere:

- DNS is on Cloudflare (`coby` / `irena.ns.cloudflare.com`).
- Both the apex and `www` resolve to Cloudflare proxy addresses — they are
  proxied, not DNS-only.
- **The apex → `www` 301 is issued by Cloudflare, not GitHub.** That response
  carries `cf-ray` and no `x-github-request-id`. GitHub only ever sees `www`.

The last point is the one that catches people: editing the `CNAME` file alone
would not change the redirect direction, because Cloudflare's rule answers
first and GitHub never gets the apex request.

## Decision

**`www.andrei.md` is canonical.** `site` was corrected to match it. No DNS
records, Cloudflare rules or GitHub Pages settings were touched — the
infrastructure was already right and only the repo disagreed with it.

## Considered Options

**Make the apex canonical.** A shorter, better-looking name, and the one the
README and `site` already claimed. It needs the `CNAME` file changed, the
Cloudflare redirect rule flipped to `www` → apex, and a GitHub certificate
re-provision for the new custom domain. That last step is the expensive one:
because the record is proxied, GitHub's ACME challenge is intercepted, so it
takes a grey-cloud → save the domain → wait for "Enforce HTTPS" → re-proxy
cycle, with a window where HTTPS is unreliable. Not worth it for a shorter name
on a site whose shared links are already `www`.

## Consequences

- **The canonical decision lives in the Cloudflare redirect rule**, not in
  `CNAME` and not in the Pages settings. Anyone reversing this has to change the
  rule; changing the repo alone will do nothing.
- **Cloudflare's SSL/TLS mode must stay Full or Full (strict).** "Flexible"
  produces an infinite redirect loop against Pages, which enforces HTTPS.
- Any _new_ hostname on this domain — a subdomain for the experiments, say —
  needs the same grey-cloud dance before GitHub can issue its certificate. See
  [20260828-experiments-stay-in-the-site-repo](20260828-experiments-stay-in-the-site-repo.md).

Recorded after 3149e36 (PR #54).
