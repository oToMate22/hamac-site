// Images de partage des fiches (Sharp, runtime Node) :
//   GET  /fr/og/listings/{id}-{hash}.jpg → image stockée (Supabase Storage), sinon générée à la volée
//                                          (budget 4 s), sinon image Hamac par défaut. Jamais vide.
//   POST /api/og-render                  → génération signée (HMAC) pour catalog-sync, qui stocke le résultat.
// Compilé dans dist-ssr/og.js (Sharp reste externe, embarqué par la fonction Vercel).
import defaultOgBase64 from 'virtual:hamac-default-og'
import { renderOgImage, type RenderedOg } from '../scripts/og-images'
import { imageApimo } from '../src/utils/images'
import { verifyRequest } from '../supabase/functions/_shared/catalog/hmac.ts'
import {
  candidatePhotoUrls,
  isAllowedPhotoUrl,
  LISTING_ID_PATTERN,
  OG_FILE_PATTERN,
  OG_HASH_PATTERN,
  ogFileName,
} from '../supabase/functions/_shared/catalog/model.ts'
import { feed, feedConfigFromEnv, FeedUnavailableError } from './feed-client'
import { cacheHeaders, jsonResponse, withRobots } from './http'

type Env = Record<string, string | undefined>

export type OgContext = {
  env?: Env
  fetch?: typeof fetch
  /** Tests : remplace le téléchargement des photos Apimo. */
  photoFetcher?: (url: string) => Promise<Buffer>
  now?: () => number
}

export const OG_RENDER_PATH = '/api/og-render'
const ON_THE_FLY_BUDGET_MS = 4000
const MAX_PHOTO_BYTES = 15 * 1024 * 1024
export const OG_SOURCE_WIDTH = 1600
const BUCKET = 'og-listings'

let defaultOg: Buffer | null = null
export function defaultOgImage() {
  defaultOg ??= Buffer.from(defaultOgBase64, 'base64')
  return defaultOg
}

function jpeg(bytes: Uint8Array, headers: Record<string, string>) {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { 'Content-Type': 'image/jpeg', ...headers } })
}

/**
 * Téléchargement contrôlé (SSRF) : https://media.apimo.pro uniquement, sans suivre de redirection,
 * taille et durée bornées, nouvelles tentatives sur erreur réseau / 5xx / 429.
 */
export async function fetchPhoto(url: string, timeoutMs: number, attempts: number, doFetch: typeof fetch = fetch): Promise<Buffer> {
  if (!isAllowedPhotoUrl(url)) throw new Error('hôte non autorisé')
  // Le CDN Apimo redimensionne via l'URL (« _1600-original ») et n'agrandit jamais : 1600 px suffisent
  // pour un 1200×630 et divisent le téléchargement par 5 à 10 (premier partage plus rapide).
  const sized = imageApimo(url, OG_SOURCE_WIDTH)
  if (!isAllowedPhotoUrl(sized)) throw new Error('hôte non autorisé')
  let lastError: Error = new Error('aucune tentative')
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // redirect: 'error' — une redirection (même depuis media.apimo.pro) n'est jamais suivie (SSRF).
      const res = await doFetch(sized, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' })
      if (res.ok) {
        const declared = Number(res.headers.get('content-length') ?? 0)
        if (declared > MAX_PHOTO_BYTES) throw new Error('photo trop lourde')
        const bytes = Buffer.from(await res.arrayBuffer())
        if (bytes.length > MAX_PHOTO_BYTES) throw new Error('photo trop lourde')
        return bytes
      }
      lastError = new Error(`HTTP ${res.status}`)
      if (res.status < 500 && res.status !== 408 && res.status !== 429) break
    } catch (error) {
      lastError = error as Error
      if (lastError.message === 'photo trop lourde') break
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)))
  }
  throw lastError
}

/** Une seule génération à la fois par image (requêtes concurrentes du premier partage). */
const inflight = new Map<string, Promise<RenderedOg>>()

function storageUrl(env: Env, file: string) {
  const base = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  return base ? `${base}/storage/v1/object/public/${BUCKET}/${file}` : null
}

export async function handleOgImage(request: Request, ctx: OgContext = {}): Promise<Response> {
  return withRobots(await handleOgImageInner(request, ctx), ctx.env ?? process.env)
}

async function handleOgImageInner(request: Request, ctx: OgContext = {}): Promise<Response> {
  const env = ctx.env ?? process.env
  const doFetch = ctx.fetch ?? fetch
  const file = new URL(request.url).searchParams.get('file') ?? ''
  const match = file.match(OG_FILE_PATTERN)
  if (!match) return new Response('Not found', { status: 404, headers: cacheHeaders('not-found') })
  const [, id, hash] = match

  // 1. Image déjà produite par catalog-sync : réponse immuable (l'URL change avec la photo).
  const stored = storageUrl(env, file)
  if (stored) {
    try {
      const res = await doFetch(stored, { signal: AbortSignal.timeout(3000) })
      if (res.ok && (res.headers.get('content-type') ?? '').includes('image/jpeg')) {
        return jpeg(new Uint8Array(await res.arrayBuffer()), { ...cacheHeaders('immutable'), 'X-Og-Source': 'storage' })
      }
    } catch {
      /* stockage injoignable : génération à la volée */
    }
  }

  // 2. Bien nouveau (pas encore traité par la synchronisation) : génération à la volée.
  const fallback = (reason: string) =>
    jpeg(defaultOgImage(), { ...cacheHeaders('short'), 'X-Og-Source': 'default', 'X-Og-Reason': reason.slice(0, 120) })
  const config = feedConfigFromEnv(env)
  if (!config) return fallback('flux non configuré')
  let item
  try {
    item = await feed.item({ ...config, fetch: ctx.fetch, timeoutMs: 2500 }, id)
  } catch (error) {
    return fallback(error instanceof FeedUnavailableError ? 'flux indisponible' : 'erreur flux')
  }
  if (item.status === 'unknown' || item.status === 'withdrawn' || !('payload' in item)) {
    return new Response('Not found', { status: 404, headers: cacheHeaders('not-found') })
  }
  // Empreinte périmée (photo changée depuis le partage) : redirection vers l'image actuelle.
  if (item.ogHash && item.ogHash !== hash) {
    return new Response(null, {
      status: 308,
      headers: { Location: `${new URL(request.url).pathname.replace(/[^/]+$/, '')}${ogFileName(id, item.ogHash)}`, ...cacheHeaders('short') },
    })
  }
  if (!item.ogHash) return fallback('aucune photo publiable')

  const urls = candidatePhotoUrls(item.payload)
  const deadline = (ctx.now?.() ?? Date.now()) + ON_THE_FLY_BUDGET_MS
  const fetcher = ctx.photoFetcher ?? ((url: string) => fetchPhoto(url, 3000, 1, doFetch))
  let task = inflight.get(file)
  if (!task) {
    task = renderOgImage(urls, fetcher, deadline).finally(() => inflight.delete(file))
    inflight.set(file, task)
  }
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ON_THE_FLY_BUDGET_MS))
  const rendered = await Promise.race([task, timeout])
  if (!rendered) return fallback('délai dépassé')
  if (!rendered.ok) return fallback(rendered.rejected.join(' ; '))
  // Pas « immutable » : catalog-sync stockera la version définitive au prochain run.
  return jpeg(rendered.bytes, {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': 'max-age=86400',
    'Vercel-CDN-Cache-Control': 'max-age=86400',
    'X-Og-Source': 'on-the-fly',
  })
}

export async function handleOgRender(request: Request, ctx: OgContext = {}): Promise<Response> {
  const env = ctx.env ?? process.env
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  const body = await request.text()
  if (body.length > 16_000) return jsonResponse({ error: 'Payload too large' }, 413)
  const verified = await verifyRequest(env.SYNC_HMAC_SECRET, 'POST', OG_RENDER_PATH, body, request.headers)
  if (!verified.ok) return jsonResponse({ error: 'Unauthorized' }, 401)
  let input: { id?: unknown; ogHash?: unknown; urls?: unknown }
  try {
    input = JSON.parse(body)
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }
  const { id, ogHash, urls } = input
  if (typeof id !== 'string' || !LISTING_ID_PATTERN.test(id)) return jsonResponse({ error: 'Invalid id' }, 400)
  if (typeof ogHash !== 'string' || !OG_HASH_PATTERN.test(ogHash)) return jsonResponse({ error: 'Invalid hash' }, 400)
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > 5 || !urls.every(isAllowedPhotoUrl)) {
    return jsonResponse({ error: 'Invalid urls' }, 400)
  }
  const fetcher = ctx.photoFetcher ?? ((url: string) => fetchPhoto(url, 20_000, 3, ctx.fetch ?? fetch))
  const rendered = await renderOgImage(urls as string[], fetcher)
  if (!rendered.ok) return jsonResponse({ error: 'Aucune photo exploitable', rejected: rendered.rejected }, 422)
  return jpeg(rendered.bytes, {
    ...cacheHeaders('none'),
    'X-Og-Source-Index': String(rendered.sourceIndex),
    'X-Og-Layout': rendered.layout,
    'X-Og-Quality': String(rendered.quality),
  })
}
