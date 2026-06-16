import "@supabase/functions-js/edge-runtime.d.ts"

// Per requirements: Apimo base URL (no /rest/v1 prefix)
const APIMO_BASE_URL = "https://api.apimo.pro"
const APIMO_PROVIDER_ID = Deno.env.get("APIMO_PROVIDER_ID")
const APIMO_TOKEN = Deno.env.get("APIMO_TOKEN")
const APIMO_AGENCY_ID = Deno.env.get("APIMO_AGENCY_ID")

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })

function buildApimoUrl(pathSuffix: string, searchParams: URLSearchParams) {
  // Endpoint for properties:
  //   /agencies/{APIMO_AGENCY_ID}/properties
  // And if pathSuffix is provided: /agencies/{id}/properties/{pathSuffix}
  const url = new URL(`${APIMO_BASE_URL}/agencies/${APIMO_AGENCY_ID}/properties${pathSuffix}`)
  for (const [key, value] of searchParams.entries()) {
    url.searchParams.set(key, value)
  }
  return url
}

function buildApimoAgenciesUrl(searchParams: URLSearchParams) {
  const url = new URL(`${APIMO_BASE_URL}/agencies`)
  for (const [key, value] of searchParams.entries()) {
    url.searchParams.set(key, value)
  }
  return url
}

function extractPropertiesArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []
  const obj = payload as Record<string, unknown>
  if (Array.isArray(obj.properties)) return obj.properties
  if (Array.isArray(obj.items)) return obj.items
  if (Array.isArray(obj.results)) return obj.results
  if (Array.isArray(obj.data)) return obj.data
  return []
}

function extractTotalItems(payload: unknown, fallback: number): number {
  if (!payload || typeof payload !== "object") return fallback
  const obj = payload as Record<string, unknown>
  const direct = obj.total_items
  if (typeof direct === "number" && Number.isFinite(direct)) return direct
  if (typeof direct === "string" && Number.isFinite(Number(direct))) return Number(direct)

  const pagination = obj.pagination
  if (pagination && typeof pagination === "object") {
    const nested = (pagination as Record<string, unknown>).total_items
    if (typeof nested === "number" && Number.isFinite(nested)) return nested
    if (typeof nested === "string" && Number.isFinite(Number(nested))) return Number(nested)
  }

  return fallback
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

    if (!APIMO_PROVIDER_ID || !APIMO_TOKEN || !APIMO_AGENCY_ID) {
      console.error('[apimo-proxy] missing required env vars:', {
        hasProviderId: Boolean(APIMO_PROVIDER_ID),
        hasToken: Boolean(APIMO_TOKEN),
        hasAgencyId: Boolean(APIMO_AGENCY_ID),
      })
      return json(
        {
          error: "Missing APIMO_PROVIDER_ID, APIMO_TOKEN or APIMO_AGENCY_ID in function secrets.",
        },
        500,
      )
    }

    const incomingUrl = new URL(req.url)
    const normalizedPath = incomingUrl.pathname.replace(/^\/+/, "")
    const routePath =
      normalizedPath.includes("apimo-proxy/") ? normalizedPath.split("apimo-proxy/")[1] : normalizedPath

    let apimoPath = ""
    let isAgenciesRoute = false

    if (req.method === "GET") {
      if (routePath === "agencies") {
        isAgenciesRoute = true
      } else if (routePath === "properties") {
        apimoPath = ""
      } else {
        const propertyMatch = routePath.match(/^properties\/([^/]+)$/)
        if (propertyMatch) apimoPath = `/${encodeURIComponent(propertyMatch[1])}`
        else return json({ error: "Route not found" }, 404)
      }
    } else {
      // Compatibility with `supabase.functions.invoke()`:
      // send JSON: { route: 'properties' } or { route: 'properties/<id>' }
      const body = await req.json().catch(() => ({} as Record<string, unknown>))

      const route = typeof body?.route === "string" ? body.route : ""

      const normalizedRoute = route.replace(/^\/+/, "")

      if (normalizedRoute === "agencies") {
        isAgenciesRoute = true
      } else if (normalizedRoute === "properties") {
        apimoPath = ""
      } else {
        const propertyMatch = normalizedRoute.match(/^properties\/([^/]+)$/)
        if (propertyMatch) apimoPath = `/${encodeURIComponent(propertyMatch[1])}`
        else return json({ error: "Route not found" }, 404)
      }
    }

    // Build Basic auth:
    // Authorization: Basic base64("APIMO_PROVIDER_ID:APIMO_TOKEN")
    const basicCreds = `${APIMO_PROVIDER_ID}:${APIMO_TOKEN}`
    const basicEncoded = btoa(basicCreds)
    const authorizationHeader = `Basic ${basicEncoded}`

    const fetchApimoPage = async (offset: number, limit: number) => {
      const pageParams = new URLSearchParams(incomingUrl.searchParams)
      pageParams.set("limit", String(limit))
      pageParams.set("offset", String(offset))
      const targetUrl = isAgenciesRoute ? buildApimoAgenciesUrl(pageParams) : buildApimoUrl(apimoPath, pageParams)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10_000)

      let apimoResponse: Response
      try {
        apimoResponse = await fetch(targetUrl, {
          method: "GET",
          headers: {
            Authorization: authorizationHeader,
            Accept: "application/json",
          },
          signal: controller.signal,
        })
      } catch (fetchErr) {
        console.error('[apimo-proxy] fetch failed for offset:', offset, 'error:', fetchErr)
        throw fetchErr
      } finally {
        clearTimeout(timeoutId)
      }

      const responseText = await apimoResponse.text()
      let parsedBody: unknown = responseText

      try {
        parsedBody = JSON.parse(responseText)
      } catch {
        // keep raw text when API does not return JSON
      }

      return { apimoResponse, parsedBody }
    }

    if (isAgenciesRoute) {
      let agenciesResponse: { apimoResponse: Response; parsedBody: unknown }
      try {
        agenciesResponse = await fetchApimoPage(0, 100)
      } catch (agenciesErr) {
        console.error('[apimo-proxy] agencies fetch failed:', agenciesErr)
        return json({ error: 'Apimo agencies fetch failed', details: String(agenciesErr) }, 502)
      }

      return json(agenciesResponse.parsedBody, agenciesResponse.apimoResponse.status)
    }

    if (apimoPath === "") {
      const pageSize = 100
      let firstPage: { apimoResponse: Response; parsedBody: unknown }
      try {
        firstPage = await fetchApimoPage(0, pageSize)
      } catch (firstErr) {
        console.error('[apimo-proxy] first page fetch failed:', firstErr)
        return json({ error: 'Apimo fetch failed on first page', details: String(firstErr) }, 502)
      }
      if (!firstPage.apimoResponse.ok) {
        return json(firstPage.parsedBody, firstPage.apimoResponse.status)
      }

      const firstItems = extractPropertiesArray(firstPage.parsedBody)
      const totalItems = extractTotalItems(firstPage.parsedBody, firstItems.length)

      const allItems: unknown[] = [...firstItems]
      const additionalOffsets = [100, 200]
      for (const offset of additionalOffsets) {
        if (totalItems <= offset) break
        let nextPage: { apimoResponse: Response; parsedBody: unknown }
        try {
          nextPage = await fetchApimoPage(offset, pageSize)
        } catch (nextErr) {
          console.error('[apimo-proxy] additional page fetch failed for offset:', offset, 'error:', nextErr)
          break
        }
        if (!nextPage.apimoResponse.ok) {
          return json(nextPage.parsedBody, nextPage.apimoResponse.status)
        }
        const nextItems = extractPropertiesArray(nextPage.parsedBody)
        allItems.push(...nextItems)
        if (!nextItems.length) break
      }

      const responsePayload =
        firstPage.parsedBody && typeof firstPage.parsedBody === "object"
          ? {
              ...(firstPage.parsedBody as Record<string, unknown>),
              properties: allItems,
              total_items: totalItems,
            }
          : { properties: allItems, total_items: totalItems }

      return json(responsePayload, 200)
    }

    let single: { apimoResponse: Response; parsedBody: unknown }
    try {
      single = await fetchApimoPage(0, 100)
    } catch (singleErr) {
      console.error('[apimo-proxy] single fetch failed:', singleErr)
      return json({ error: 'Apimo fetch failed', details: String(singleErr) }, 502)
    }
    return json(single.parsedBody, single.apimoResponse.status)
  } catch (err) {
    console.error('[apimo-proxy] caught error:', err)
    return json({ error: 'Internal error in apimo-proxy', details: String(err) }, 500)
  }
})
