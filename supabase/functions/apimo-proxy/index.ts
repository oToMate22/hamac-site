import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { PUBLISHED_STATUSES, publicCatalogEnvelope } from "../_shared/catalog/public.ts"
import { isCatalogRoute } from "../_shared/catalog/public-route.ts"

// Fonction PUBLIQUE (clé anon, appelée par le navigateur) : une seule action, le catalogue publié.
// Aucun paramètre du client n'est transmis à Apimo. Chaque réponse, y compris celles lues
// dans les caches, passe par publicCatalogEnvelope (liste blanche profonde, biens publiés seulement).

const APIMO_BASE_URL = "https://api.apimo.pro"
const APIMO_PROVIDER_ID = Deno.env.get("APIMO_PROVIDER_ID")
const APIMO_TOKEN = Deno.env.get("APIMO_TOKEN")
const APIMO_AGENCY_ID = Deno.env.get("APIMO_AGENCY_ID")
const PROPERTIES_CACHE_KEY = "properties"
const CACHE_TTL_MS = 5 * 60 * 1000
const PAGE_SIZE = 100
const MAX_PAGES = 20

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
}

type MemoryEntry = { payload: unknown; expiresAt: number }
const memoryCache = new Map<string, MemoryEntry>()

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, ...extra } })

/** Seule sortie des données de biens : filtrage serveur, quelle que soit la provenance (Apimo ou cache). */
const catalogResponse = (payload: unknown, cache: "memory" | "persistent" | "stale" | "miss") =>
  json(publicCatalogEnvelope(payload), 200, {
    "X-Cache": cache,
    ...(cache === "miss" ? {} : { "Cache-Control": "public, max-age=60" }),
  })

function cacheClient() {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) return null
  return createClient(url, key)
}

async function readPersistent(): Promise<{ payload: unknown; fetchedAt: number } | null> {
  const supabase = cacheClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from("apimo_cache")
    .select("payload, fetched_at")
    .eq("key", PROPERTIES_CACHE_KEY)
    .maybeSingle()
  if (error) {
    console.error("[apimo-proxy] cache read failed:", error.message)
    return null
  }
  if (!data?.payload) return null
  const fetchedAt = data.fetched_at ? new Date(data.fetched_at as string).getTime() : 0
  return { payload: data.payload, fetchedAt }
}

async function writePersistent(payload: unknown) {
  const supabase = cacheClient()
  if (!supabase) return
  const { error } = await supabase.from("apimo_cache").upsert({
    key: PROPERTIES_CACHE_KEY,
    payload,
    fetched_at: new Date().toISOString(),
  })
  if (error) console.error("[apimo-proxy] cache write failed:", error.message)
}

function extractPropertiesArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []
  const obj = payload as Record<string, unknown>
  for (const key of ["properties", "items", "results", "data"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[]
  }
  return []
}

function extractTotalItems(payload: unknown, fallback: number): number {
  if (!payload || typeof payload !== "object") return fallback
  const obj = payload as Record<string, unknown>
  const pagination = obj.pagination && typeof obj.pagination === "object" ? (obj.pagination as Record<string, unknown>) : {}
  for (const value of [obj.total_items, pagination.total_items]) {
    const number = Number(value)
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(number)) return number
  }
  return fallback
}

async function fetchStatusPage(status: string, offset: number) {
  const url = new URL(`${APIMO_BASE_URL}/agencies/${APIMO_AGENCY_ID}/properties`)
  url.searchParams.set("status", status)
  url.searchParams.set("limit", String(PAGE_SIZE))
  url.searchParams.set("offset", String(offset))
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Basic ${btoa(`${APIMO_PROVIDER_ID}:${APIMO_TOKEN}`)}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, ok: response.ok, body }
}

/** Tous les biens d'un statut publié. complete = false si une page manque. */
async function fetchStatus(status: string) {
  const first = await fetchStatusPage(status, 0)
  if (!first.ok) return { ok: false as const, httpStatus: first.status, items: [] as unknown[], complete: false }
  const items = [...extractPropertiesArray(first.body)]
  const total = extractTotalItems(first.body, items.length)
  let complete = true
  for (let page = 1; page < MAX_PAGES && items.length < total; page++) {
    const next = await fetchStatusPage(status, page * PAGE_SIZE)
    if (!next.ok) {
      console.warn("[apimo-proxy] status", status, "page", page, "HTTP", next.status)
      complete = false
      break
    }
    const nextItems = extractPropertiesArray(next.body)
    if (!nextItems.length) break
    items.push(...nextItems)
  }
  if (items.length < total) complete = false
  return { ok: true as const, httpStatus: first.status, items, complete }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
    if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405)

    const body = req.method === "POST" ? await req.json().catch(() => null) : null
    if (!isCatalogRoute(req.method, new URL(req.url).pathname, body)) return json({ error: "Route not found" }, 404)

    if (!APIMO_PROVIDER_ID || !APIMO_TOKEN || !APIMO_AGENCY_ID) {
      console.error("[apimo-proxy] missing Apimo secrets")
      return json({ error: "Catalogue indisponible" }, 500)
    }

    const memory = memoryCache.get(PROPERTIES_CACHE_KEY)
    if (memory && Date.now() < memory.expiresAt) return catalogResponse(memory.payload, "memory")

    const persistent = await readPersistent()
    if (persistent && Date.now() - persistent.fetchedAt < CACHE_TTL_MS) {
      memoryCache.set(PROPERTIES_CACHE_KEY, { payload: persistent.payload, expiresAt: persistent.fetchedAt + CACHE_TTL_MS })
      return catalogResponse(persistent.payload, "persistent")
    }

    const stale = () => memory?.payload ?? persistent?.payload ?? null

    // Apimo n'accepte qu'un statut par requête : un appel par statut publié, puis fusion.
    const byId = new Map<string, unknown>()
    let complete = true
    let failedStatus = 0
    let anyOk = false
    try {
      for (const status of PUBLISHED_STATUSES) {
        const result = await fetchStatus(status)
        if (!result.ok) {
          failedStatus ||= result.httpStatus
          complete = false
          console.warn("[apimo-proxy] status", status, "HTTP", result.httpStatus)
          continue
        }
        anyOk = true
        if (!result.complete) complete = false
        for (const item of result.items) {
          if (!item || typeof item !== "object") continue
          const id = String((item as Record<string, unknown>).id ?? "")
          if (id) byId.set(id, item)
        }
      }
    } catch (error) {
      console.error("[apimo-proxy] Apimo fetch failed:", (error as Error).name)
      anyOk = false
    }

    if (!anyOk) {
      const fallback = stale()
      if (fallback) return catalogResponse(fallback, "stale")
      if (failedStatus === 429) return json({ error: "Quota Apimo atteint", status: 429 }, 429)
      return json({ error: "Catalogue indisponible" }, 502)
    }

    const merged = Array.from(byId.values())
    // Le cache ne conserve que la version filtrée : aucune donnée privée n'est stockée pour être resservie.
    const envelope = publicCatalogEnvelope({ properties: merged, total_items: merged.length, sync_meta: { complete } })
    memoryCache.set(PROPERTIES_CACHE_KEY, { payload: envelope, expiresAt: Date.now() + CACHE_TTL_MS })
    await writePersistent(envelope)
    return catalogResponse(envelope, "miss")
  } catch (error) {
    console.error("[apimo-proxy] internal error:", (error as Error).name)
    return json({ error: "Catalogue indisponible" }, 500)
  }
})
