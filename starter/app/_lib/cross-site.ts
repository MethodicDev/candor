/*
 * This starter's own crossSite() and crossSiteRefused(). The starter is MIT and builds without Candor's Premium blocks,
 * so it keeps a copy rather than importing them. The Premium version is crossSite() in the server foundation, which
 * any Premium block installs at `lib/candor/candor-server.ts` (`@/lib/candor/candor-server`); once a Premium block is
 * installed, the routes can import that one instead. Candor tests this copy against the foundation's on the same requests, so the two
 * decide alike and a fix to one reaches both.
 */
const origins = (list: string | undefined) =>
  (list ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => {
      try {
        return [new URL(s).origin]
      } catch {
        return []
      }
    })

/**
 * Whether a page on another site made the browser send `request`, so a route that changes something can refuse it
 * (cross-site request forgery: another site making a signed-in person's browser act here). The same rule as the
 * server foundation's crossSite() in Candor's Premium blocks:
 *
 * - GET, HEAD and OPTIONS are never refused.
 * - An `Origin` listed in `CANDOR_TRUSTED_ORIGINS` (comma-separated, e.g. `https://admin.example.com`) may go on.
 * - `Sec-Fetch-Site` is trusted when the browser sends it: "same-origin", or "none" (the address was typed), may go
 *   on; "same-site" and "cross-site" may not.
 * - Without it, `Origin` must name this app's host (`X-Forwarded-Host` behind a proxy, else `Host`). `Origin: null`
 *   is refused. A request with neither header didn't come from a browser page and goes on: your auth holds it back.
 */
export function crossSite(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return false
  const origin = request.headers.get("origin")
  let normalised: string | null = null
  try {
    normalised = origin ? new URL(origin).origin : null
  } catch {
    normalised = null
  }
  if (normalised && origins(process.env.CANDOR_TRUSTED_ORIGINS).includes(normalised)) return false
  const site = request.headers.get("sec-fetch-site")
  if (site) return site !== "same-origin" && site !== "none"
  if (!origin) return false
  const host = (request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || new URL(request.url).host).toLowerCase()
  try {
    return new URL(origin).host.toLowerCase() !== host
  } catch {
    // "null", from a sandboxed frame or a redirect across sites, and anything that isn't a URL.
    return true
  }
}

/** What a route answers, with a 403, when crossSite() says another site's page sent the request. */
export function crossSiteRefused(): Response {
  return Response.json({ error: "This request came from another site, so it wasn't carried out. Do it from this app's own page." }, { status: 403 })
}
