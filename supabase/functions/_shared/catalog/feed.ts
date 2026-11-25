// Logique du flux listing-feed (lecture seule) : instantanés d'abord, repli « en direct »
// via apimo-proxy pour un bien publié depuis le dernier run (≤ intervalle de synchronisation).
import type { CatalogRead } from './decide.ts'
import { tokenMatches } from './hmac.ts'
import {
  apimoUpdatedAt,
  candidatePhotoUrls,
  computeOgHash,
  isServable,
  listingId,
  listingKind,
  LISTING_ID_PATTERN,
  publicPayload,
  type FeedItem,
  type IndexEntry,
  type ListingKind,
  type ListingStatus,
  type OgStatus,
  type RawListing,
} from './model.ts'

export type StoredSnapshot = {
  id: string
  kind: ListingKind
  status: ListingStatus
  payload: RawListing
  ogHash: string | null
  ogStatus: OgStatus
  updatedAtApimo: string | null
  withdrawnAt: string | null
}

export type FeedDeps = {
  getSnapshot(id: string): Promise<StoredSnapshot | null>
  /** Plus grand identifiant connu (null : table vide, aucun run réussi). */
  maxKnownId(): Promise<number | null>
  readLiveCatalog(): Promise<CatalogRead>
}

/** Cache mémoire des recherches « en direct » infructueuses (identifiants arbitraires). */
const liveMisses = new Map<string, number>()
const LIVE_MISS_TTL_MS = 60_000

async function liveItem(raw: RawListing, id: string): Promise<FeedItem> {
  const ogHash = await computeOgHash(candidatePhotoUrls(raw))
  return {
    status: 'active',
    id,
    kind: listingKind(raw),
    payload: publicPayload(raw),
    ogHash,
    ogStatus: ogHash ? 'pending' : 'none',
    source: 'live',
    updatedAt: apimoUpdatedAt(raw),
  }
}

export async function feedItem(rawId: string, deps: FeedDeps, now = Date.now()): Promise<FeedItem | { error: string }> {
  const id = String(rawId ?? '').trim()
  if (!LISTING_ID_PATTERN.test(id)) return { status: 'unknown', id }
  const snap = await deps.getSnapshot(id)
  if (snap) {
    if (snap.status === 'withdrawn') return { status: 'withdrawn', id, kind: snap.kind, withdrawnAt: snap.withdrawnAt }
    if (isServable(snap.status)) {
      return {
        status: snap.status as 'active' | 'pending_withdrawal',
        id,
        kind: snap.kind,
        payload: publicPayload(snap.payload),
        ogHash: snap.ogHash,
        ogStatus: snap.ogStatus,
        source: 'snapshot',
        updatedAt: snap.updatedAtApimo,
      }
    }
  }

  // Repli en direct : seulement pour un identifiant plus récent que le catalogue connu
  // (Apimo attribue des identifiants croissants), ou si aucun run n'a encore réussi.
  const maxId = await deps.maxKnownId()
  if (maxId !== null && Number(id) <= maxId) return { status: 'unknown', id }
  const missAt = liveMisses.get(id)
  if (missAt && now - missAt < LIVE_MISS_TTL_MS) return { status: 'unknown', id }

  const read = await deps.readLiveCatalog()
  if (!read.ok) return { error: `catalogue indisponible (${read.error})` }
  const raw = read.items.find((item) => listingId(item) === id)
  if (!raw) {
    liveMisses.set(id, now)
    if (liveMisses.size > 5000) liveMisses.clear()
    return { status: 'unknown', id }
  }
  return liveItem(raw, id)
}

/** Repli complet quand la table est vide (premier déploiement) : index calculé depuis apimo-proxy. */
export async function indexFromLive(read: CatalogRead): Promise<IndexEntry[] | null> {
  if (!read.ok) return null
  const entries: IndexEntry[] = []
  for (const raw of read.items) {
    const id = listingId(raw)
    if (!id) continue
    entries.push({
      id,
      kind: listingKind(raw),
      status: 'active',
      updatedAt: apimoUpdatedAt(raw),
      ogHash: await computeOgHash(candidatePhotoUrls(raw)),
      ogStatus: 'pending',
    })
  }
  return entries
}

// ----------------------------------------------------------------------------- routage HTTP partagé

export type FeedServerDeps = FeedDeps & {
  token: string
  countSnapshots(): Promise<number>
  listCatalog(kind: ListingKind): Promise<Array<{ payload: RawListing; ogHash: string | null; ogStatus: OgStatus }>>
  listIndex(): Promise<IndexEntry[]>
  syncMeta(): Promise<Record<string, unknown>>
  log?(message: string, error?: unknown): void
}

function feedJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/**
 *   GET ?index=1            → index de tous les biens (statut, rubrique, date, empreinte image)
 *   GET ?id=87634540        → un bien (instantané, sinon repli en direct s'il est plus récent)
 *   GET ?catalog=acheter    → contenu complet des biens servis d'une rubrique
 * Authentification : en-tête x-feed-token.
 */
export async function handleFeedRequest(req: Request, deps: FeedServerDeps): Promise<Response> {
  if (req.method !== 'GET') return feedJson({ error: 'Method not allowed' }, 405)
  if (!tokenMatches(deps.token, req.headers.get('x-feed-token'))) return feedJson({ error: 'Unauthorized' }, 401)
  const params = new URL(req.url).searchParams
  try {
    const id = params.get('id')
    if (id !== null) {
      const item = await feedItem(id, deps)
      return 'error' in item ? feedJson(item, 503) : feedJson(item)
    }

    const catalog = params.get('catalog')
    if (catalog === 'acheter' || catalog === 'louer') {
      if ((await deps.countSnapshots()) === 0) {
        const read = await deps.readLiveCatalog()
        if (!read.ok) return feedJson({ error: read.error }, 503)
        return feedJson({ source: 'live', items: read.items.filter((raw) => listingKind(raw) === catalog).map((raw) => ({ payload: publicPayload(raw) })) })
      }
      return feedJson({
        source: 'snapshot',
        items: (await deps.listCatalog(catalog)).map((item) => ({ ...item, payload: publicPayload(item.payload) })),
      })
    }

    if (params.get('index') === '1') {
      let items = await deps.listIndex()
      let source = 'snapshot'
      if (items.length === 0) {
        const live = await indexFromLive(await deps.readLiveCatalog())
        if (!live) return feedJson({ error: 'catalogue indisponible' }, 503)
        items = live
        source = 'live'
      }
      return feedJson({ source, generatedAt: new Date().toISOString(), meta: await deps.syncMeta(), items })
    }

    return feedJson({ error: 'Paramètre attendu : index, id ou catalog' }, 400)
  } catch (error) {
    deps.log?.('[listing-feed]', error)
    return feedJson({ error: 'Flux indisponible' }, 503)
  }
}
