// Client du flux Supabase « listing-feed » (lecture seule, jeton dédié).
// Aucune clé Supabase privée côté Vercel : seulement LISTING_FEED_URL + LISTING_FEED_TOKEN.
import type { FeedItem, IndexEntry, RawListing } from '../supabase/functions/_shared/catalog/model.ts'

export type FeedConfig = {
  url: string
  token: string
  timeoutMs?: number
  fetch?: typeof fetch
}

export class FeedUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeedUnavailableError'
  }
}

export function feedConfigFromEnv(env: Record<string, string | undefined> = process.env): FeedConfig | null {
  const url = env.LISTING_FEED_URL?.trim()
  const token = env.LISTING_FEED_TOKEN?.trim()
  if (!url || !token) return null
  return { url, token }
}

async function call<T>(config: FeedConfig, query: string): Promise<T> {
  const doFetch = config.fetch ?? fetch
  let lastError = 'flux injoignable'
  // 2 tentatives rapides : une page doit répondre vite, le CDN garde sinon la version précédente.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await doFetch(`${config.url}?${query}`, {
        headers: { 'x-feed-token': config.token },
        signal: AbortSignal.timeout(config.timeoutMs ?? 4000),
      })
      if (res.ok) return (await res.json()) as T
      lastError = `flux HTTP ${res.status}`
      if (res.status < 500) break
    } catch (error) {
      lastError = (error as Error).message
    }
  }
  throw new FeedUnavailableError(lastError)
}

export const feed = {
  item: (config: FeedConfig, id: string) => call<FeedItem>(config, `id=${encodeURIComponent(id)}`),
  catalog: (config: FeedConfig, kind: 'acheter' | 'louer') =>
    call<{ source: string; items: Array<{ payload: RawListing; ogHash?: string | null; ogStatus?: string }> }>(
      config,
      `catalog=${kind}`,
    ),
  index: (config: FeedConfig) =>
    call<{ source: string; generatedAt: string; items: IndexEntry[]; meta?: Record<string, unknown> }>(config, 'index=1'),
}
