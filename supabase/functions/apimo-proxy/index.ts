import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const APIMO_BASE_URL = "https://api.apimo.pro"
const APIMO_PROVIDER_ID = Deno.env.get("APIMO_PROVIDER_ID")
const APIMO_TOKEN = Deno.env.get("APIMO_TOKEN")
const APIMO_AGENCY_ID = Deno.env.get("APIMO_AGENCY_ID")
const PROPERTIES_CACHE_KEY = "properties"
const CACHE_TTL_MS = 5 * 60 * 1000

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
}

type MemoryEntry = { payload: unknown; fetchedAt: number; expiresAt: number }
const memoryCache = new Map<string, MemoryEntry>()

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, ...extra } })

function cacheHeaders(kind: "memory" | "persistent" | "stale" | "miss") {
  const headers: Record<string, string> = { "X-Cache": kind }
  if (kind !== "miss") headers["Cache-Control"] = "public, max-age=60"
  return headers
}

function cacheClient() {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) return null
  return createClient(url, key)
}

function readMemory(key: string): { payload: unknown; stale: boolean } | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  return { payload: entry.payload, stale: Date.now() >= entry.expiresAt }
}

function writeMemory(key: string, payload: unknown) {
  const fetchedAt = Date.now()
  memoryCache.set(key, { payload, fetchedAt, expiresAt: fetchedAt + CACHE_TTL_MS })
}

async function readPersistent(key: string): Promise<{ payload: unknown; fetchedAt: number } | null> {
  const supabase = cacheClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from("apimo_cache")
    .select("payload, fetched_at")
    .eq("key", key)
    .maybeSingle()
  if (error) {
    console.error("[apimo-proxy] cache read failed:", error.message)
    return null
  }
  if (!data?.payload) return null
  const fetchedAt = data.fetched_at ? new Date(data.fetched_at as string).getTime() : 0
  return { payload: data.payload, fetchedAt }
}

async function writePersistent(key: string, payload: unknown) {
  const supabase = cacheClient()
  if (!supabase) return
  const { error } = await supabase.from("apimo_cache").upsert({
    key,
    payload,
    fetched_at: new Date().toISOString(),
  })
  if (error) console.error("[apimo-proxy] cache write failed:", error.message)
}

async function readFreshListCache(): Promise<{ payload: unknown; source: "memory" | "persistent" } | null> {
  const mem = readMemory(PROPERTIES_CACHE_KEY)
  if (mem && !mem.stale) return { payload: mem.payload, source: "memory" }

  const persistent = await readPersistent(PROPERTIES_CACHE_KEY)
  if (persistent && Date.now() - persistent.fetchedAt < CACHE_TTL_MS) {
    writeMemory(PROPERTIES_CACHE_KEY, persistent.payload)
    return { payload: persistent.payload, source: "persistent" }
  }
  return null
}

async function readAnyListCache(): Promise<unknown | null> {
  const mem = readMemory(PROPERTIES_CACHE_KEY)
  if (mem) return mem.payload
  const persistent = await readPersistent(PROPERTIES_CACHE_KEY)
  return persistent?.payload ?? null
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

function buildApimoUrl(pathSuffix: string, searchParams: URLSearchParams) {
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

function findPropertyInList(payload: unknown, id: string): unknown | null {
  const match = extractPropertiesArray(payload).find((item) => {
    if (!item || typeof item !== "object") return false
    return String((item as Record<string, unknown>).id) === id
  })
  return match ?? null
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

    if (!APIMO_PROVIDER_ID || !APIMO_TOKEN || !APIMO_AGENCY_ID) {
      console.error("[apimo-proxy] missing required env vars:", {
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
        console.error("[apimo-proxy] fetch failed for offset:", offset, "error:", fetchErr)
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
        console.error("[apimo-proxy] agencies fetch failed:", agenciesErr)
        return json({ error: "Apimo agencies fetch failed", details: String(agenciesErr) }, 502)
      }

      return json(agenciesResponse.parsedBody, agenciesResponse.apimoResponse.status)
    }

    if (apimoPath === "") {
      const fresh = await readFreshListCache()
      if (fresh) {
        console.log("[apimo-proxy] properties cache", fresh.source)
        return json(fresh.payload, 200, cacheHeaders(fresh.source))
      }

      const pageSize = 100
      let firstPage: { apimoResponse: Response; parsedBody: unknown }
      try {
        firstPage = await fetchApimoPage(0, pageSize)
      } catch (firstErr) {
        console.error("[apimo-proxy] first page fetch failed:", firstErr)
        const stale = await readAnyListCache()
        if (stale) return json(stale, 200, cacheHeaders("stale"))
        return json({ error: "Apimo fetch failed on first page", details: String(firstErr) }, 502)
      }
      if (!firstPage.apimoResponse.ok) {
        const stale = await readAnyListCache()
        if (stale) {
          console.warn("[apimo-proxy] Apimo", firstPage.apimoResponse.status, "— serving stale cache")
          return json(stale, 200, cacheHeaders("stale"))
        }
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
          console.error("[apimo-proxy] additional page fetch failed for offset:", offset, "error:", nextErr)
          break
        }
        if (!nextPage.apimoResponse.ok) {
          console.warn("[apimo-proxy] additional page HTTP", nextPage.apimoResponse.status, "— keeping", allItems.length, "items")
          break
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

      writeMemory(PROPERTIES_CACHE_KEY, responsePayload)
      await writePersistent(PROPERTIES_CACHE_KEY, responsePayload)
      return json(responsePayload, 200, cacheHeaders("miss"))
    }

    const wantedId = apimoPath.replace(/^\//, "")
    const listCache = await readFreshListCache()
    if (listCache) {
      const match = findPropertyInList(listCache.payload, wantedId)
      if (match) return json(match, 200, cacheHeaders(listCache.source))
    }

    let single: { apimoResponse: Response; parsedBody: unknown }
    try {
      single = await fetchApimoPage(0, 100)
    } catch (singleErr) {
      console.error("[apimo-proxy] single fetch failed:", singleErr)
      const stale = await readAnyListCache()
      const match = stale ? findPropertyInList(stale, wantedId) : null
      if (match) return json(match, 200, cacheHeaders("stale"))
      return json({ error: "Apimo fetch failed", details: String(singleErr) }, 502)
    }
    if (!single.apimoResponse.ok) {
      const stale = await readAnyListCache()
      const match = stale ? findPropertyInList(stale, wantedId) : null
      if (match) return json(match, 200, cacheHeaders("stale"))
    }
    return json(single.parsedBody, single.apimoResponse.status)
  } catch (err) {
    console.error("[apimo-proxy] caught error:", err)
    return json({ error: "Internal error in apimo-proxy", details: String(err) }, 500)
  }
})
