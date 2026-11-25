// Lecture du catalogue via apimo-proxy (requête mutualisée : la synchronisation et les visiteurs
// partagent le même cache apimo_cache de 5 min, donc Apimo n'est pas sollicité davantage).
import type { CatalogRead } from './decide.ts'
import type { RawListing } from './model.ts'

type ProxyPayload = {
  properties?: unknown
  data?: { properties?: unknown }
  total_items?: unknown
  fetched_items?: unknown
  sync_meta?: { complete?: unknown }
  error?: unknown
}

function retryAfterSeconds(headers: { get(name: string): string | null }) {
  const value = headers.get('retry-after')
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, Math.round((date - Date.now()) / 1000)) : undefined
}

/** Interprète la réponse d'apimo-proxy (code HTTP, X-Cache, sync_meta) en CatalogRead. */
export function parseProxyResponse(status: number, headers: { get(name: string): string | null }, body: unknown): CatalogRead {
  const payload = (body && typeof body === 'object' ? body : {}) as ProxyPayload
  // apimo-proxy relaie un 429 Apimo soit en code HTTP, soit dans le corps ({ status: 429 }).
  const bodyStatus = Number((payload as { status?: unknown }).status)
  if (status === 429 || bodyStatus === 429) {
    return { ok: false, status: 429, error: 'quota Apimo atteint', retryAfterSeconds: retryAfterSeconds(headers) }
  }
  if (status < 200 || status >= 300) {
    return { ok: false, status, error: typeof payload.error === 'string' ? payload.error : `HTTP ${status}` }
  }
  const list = Array.isArray(payload.properties)
    ? payload.properties
    : Array.isArray(payload.data?.properties)
      ? payload.data!.properties
      : null
  if (!Array.isArray(list)) return { ok: false, status: 502, error: 'réponse apimo-proxy sans liste de biens' }
  const items = list.filter((item): item is RawListing => Boolean(item) && typeof item === 'object')
  const total = Number(payload.total_items)
  const fetched = Number(payload.fetched_items)
  const metaComplete = payload.sync_meta?.complete
  const complete =
    typeof metaComplete === 'boolean'
      ? metaComplete
      : !(Number.isFinite(total) && Number.isFinite(fetched) && fetched < total)
  const cache = (headers.get('x-cache') ?? 'unknown').toLowerCase()
  return { ok: true, items, complete, fresh: cache !== 'stale', source: cache }
}
