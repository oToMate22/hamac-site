// Rendu serveur des pages du catalogue avec les composants React existants (aucune refonte) :
//   /fr/acheter/:id, /fr/louer/:id  → fiche complète (contenu, head, JSON-LD), 200 / 308 / 404 / 410 / 503
//   /fr/acheter, /fr/louer          → catalogue avec la liste des biens et leurs liens
//   /fr/sitemap.xml                 → sitemap cohérent avec Apimo
//   POST /api/revalidate            → purge CDN par étiquette (appel signé de catalog-sync)
// Compilé par vite.ssr.config.ts dans dist-ssr/pages.js, appelé par api/*.js (Vercel) et
// scripts/dev-vercel.ts (tests locaux).
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import shell from 'virtual:hamac-shell'
import { App } from '../src/App'
import { BASE_PATH, DEFAULT_OG_IMAGE, SERVED_ORIGIN, SITE_URL } from '../src/config/site'
import { BLOG_POSTS } from '../src/data/blogPosts'
import { NEIGHBORHOODS } from '../src/data/neighborhoods'
import { STATIC_ROUTES } from '../src/routes'
import { applyHead, notFoundHead, OG_HEIGHT, OG_WIDTH, staticHead, SUFFIX, type RouteHead } from '../src/seo/headHtml'
import { listingJsonLd } from '../src/seo/jsonld'
import { listingDocumentTitle, listingMetaDescription } from '../src/seo/listingTitle'
import { filterCatalogForMode, mapFeaturedProperty, mapRawProperties, type FeaturedProperty } from '../src/services/apimo'
import { SsrDataProvider, type SsrData } from '../src/ssr/SsrData'
import { verifyRequest } from '../supabase/functions/_shared/catalog/hmac.ts'
import { isServable, LISTING_ID_PATTERN, ogFileName, type FeedItem, type IndexEntry } from '../supabase/functions/_shared/catalog/model.ts'
import { feed, feedConfigFromEnv, FeedUnavailableError } from './feed-client'
import { htmlResponse, jsonResponse, redirectResponse, unavailableResponse, withRobots, type CacheProfile } from './http'

type Env = Record<string, string | undefined>

export type PageContext = {
  env?: Env
  /** Vercel : @vercel/functions addCacheTag (purge ciblée par catalog-sync). */
  addCacheTag?: (tags: string[]) => unknown
  /** Vercel : @vercel/functions invalidateByTag. */
  invalidateByTag?: (tags: string[]) => Promise<unknown>
  /** Tests : feed injecté. */
  fetch?: typeof fetch
}

type Kind = 'acheter' | 'louer'

const envOf = (ctx: PageContext): Env => ctx.env ?? process.env

/**
 * Origine des images de partage : le domaine servi en production, l'URL du déploiement en Preview
 * (pour que l'image soit testable avant mise en production). Le canonical reste toujours la production.
 */
export function publicOrigin(env: Env) {
  if (env.PUBLIC_ORIGIN) return env.PUBLIC_ORIGIN.replace(/\/$/, '')
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) return `https://${env.VERCEL_URL}`
  return SERVED_ORIGIN
}

export function ogImageUrl(env: Env, id: string, ogHash: string) {
  return `${publicOrigin(env)}${BASE_PATH}/og/listings/${ogFileName(id, ogHash)}`
}

function renderApp(route: string, search: string, ssrData: SsrData, state?: unknown) {
  return renderToString(
    <SsrDataProvider value={ssrData}>
      <StaticRouter basename={BASE_PATH} location={{ pathname: `${BASE_PATH}${route}`, search, hash: '', state, key: 'ssr' }}>
        <App homeMainHtml="" />
      </StaticRouter>
    </SsrDataProvider>,
  )
}

/** Shell Vite (CSS, script, CMP) + head de la route + contenu rendu, comme le pré-rendu Chromium. */
export function composeHtml(route: string, head: RouteHead, appHtml: string) {
  const html = applyHead(shell, route, head)
  return html.replace(/<body([^>]*)>[\s\S]*<\/body>/i, (_match, attrs: string) => `<body${attrs}><div id="app">${appHtml}</div></body>`)
}

/** Shell SPA brut avec le head de la route, comme l'ancienne réécriture vers /fr/200.html. */
function legacyShell(route: string) {
  return htmlResponse(applyHead(shell, route, staticHead(route) ?? { title: `Bien immobilier — ${SUFFIX}`, description: notFoundHead.description }), 200, 'short')
}

function tag(ctx: PageContext, tags: string[]) {
  try {
    void ctx.addCacheTag?.(tags)
  } catch {
    /* hors Vercel */
  }
}

function page(ctx: PageContext, route: string, search: string, head: RouteHead, ssr: SsrData, status: number, profile: CacheProfile, tags: string[], state?: unknown) {
  tag(ctx, tags)
  return htmlResponse(composeHtml(route, head, renderApp(route, search, ssr, state)), status, profile)
}

export function listingHead(env: Env, property: FeaturedProperty, route: string, item: Extract<FeedItem, { payload: unknown }>): RouteHead {
  const usable = item.ogHash && item.ogStatus !== 'failed' && item.ogStatus !== 'none'
  return {
    title: listingDocumentTitle(property),
    description: listingMetaDescription(property),
    ogType: 'article',
    ogImage: usable ? ogImageUrl(env, item.id, item.ogHash!) : DEFAULT_OG_IMAGE,
    ogImageSize: usable ? { width: OG_WIDTH, height: OG_HEIGHT, type: 'image/jpeg' } : undefined,
    ogImageAlt: listingDocumentTitle(property),
    jsonLd: [{ id: 'ld-listing', data: listingJsonLd(property, route) }],
  }
}

const unknownHead: RouteHead = { ...notFoundHead, title: `Bien introuvable — ${SUFFIX}` }
const withdrawnHead: RouteHead = {
  title: `Ce bien n’est plus disponible — ${SUFFIX}`,
  description: 'Ce bien a été vendu ou retiré de la vente. Découvrez les autres biens Hamac dans l’Ouest lyonnais.',
  robots: 'noindex,follow',
}

function kindParam(value: string | null): Kind | null {
  return value === 'acheter' || value === 'louer' ? value : null
}

/** Paramètres d'origine du visiteur, sans ceux ajoutés par la réécriture Vercel. */
function visitorSearch(url: URL, internal: string[]) {
  const params = new URLSearchParams(url.search)
  for (const key of internal) params.delete(key)
  const value = params.toString()
  return value ? `?${value}` : ''
}

async function handleListingInner(request: Request, ctx: PageContext = {}): Promise<Response> {
  const env = envOf(ctx)
  const url = new URL(request.url)
  const kind = kindParam(url.searchParams.get('kind'))
  const id = url.searchParams.get('id') ?? ''
  const search = visitorSearch(url, ['kind', 'id'])
  if (!kind) return htmlResponse('Not found', 404, 'not-found')
  const route = `/${kind}/${id}`
  if (!LISTING_ID_PATTERN.test(id)) return page(ctx, route, search, unknownHead, { listingStatus: 'unknown' }, 404, 'not-found', [])

  const config = feedConfigFromEnv(env)
  // Flux non configuré (retour arrière, environnement incomplet) : ancien comportement, shell SPA.
  if (!config) return legacyShell(route)
  let item: FeedItem
  try {
    item = await feed.item({ ...config, fetch: ctx.fetch }, id)
  } catch (error) {
    if (error instanceof FeedUnavailableError) return unavailableResponse()
    throw error
  }

  const tags = [`listing-${id}`]
  if (item.status === 'unknown') return page(ctx, route, search, unknownHead, { listingStatus: 'unknown' }, 404, 'not-found', tags)
  if (item.status === 'withdrawn') return page(ctx, route, search, withdrawnHead, { listingStatus: 'withdrawn' }, 410, 'gone', tags)
  if (!isServable(item.status)) return unavailableResponse()
  // Mauvaise rubrique (bien passé de la vente à la location, ancien lien) : URL canonique.
  if (item.kind !== kind) {
    tag(ctx, tags)
    return redirectResponse(`${BASE_PATH}/${item.kind}/${id}${search}`)
  }

  const property = mapFeaturedProperty(item.payload as never)
  return page(ctx, route, search, listingHead(env, property, route, item), {}, 200, 'page', tags, { property })
}

async function handleCatalogInner(request: Request, ctx: PageContext = {}): Promise<Response> {
  const env = envOf(ctx)
  const url = new URL(request.url)
  const kind = kindParam(url.searchParams.get('kind'))
  if (!kind) return htmlResponse('Not found', 404, 'not-found')
  const route = `/${kind}`
  const search = visitorSearch(url, ['kind'])
  const pageNumber = Number(url.searchParams.get('page'))
  // Pages suivantes : liens suivis par les robots, pages non indexées (mêmes règles que le client).
  const head = { ...staticHead(route)!, ...(Number.isInteger(pageNumber) && pageNumber > 1 ? { robots: 'noindex,follow' } : {}) }
  const config = feedConfigFromEnv(env)
  try {
    if (!config) throw new FeedUnavailableError('flux non configuré')
    const data = await feed.catalog({ ...config, fetch: ctx.fetch }, kind)
    const properties = filterCatalogForMode(
      mapRawProperties(data.items.map((item) => item.payload)),
      kind === 'louer' ? 'rent' : 'sale',
    )
    const normalized = normalizedPageSearch(url, properties.length)
    if (normalized !== null) {
      tag(ctx, [`catalog-${kind}`])
      return redirectResponse(`${BASE_PATH}${route}${normalized}`)
    }
    return page(ctx, route, search, head, { catalog: properties }, 200, 'page', [`catalog-${kind}`])
  } catch (error) {
    if (!(error instanceof FeedUnavailableError)) throw error
    // Flux indisponible : la page reste utilisable (liste chargée par le navigateur), cache court.
    return page(ctx, route, search, head, {}, 200, 'short', [`catalog-${kind}`])
  }
}

const CATALOG_PAGE_SIZE = 32

/**
 * ?page= invalide (non entier, ≤ 1, au-delà de la dernière page) : URL normalisée, sinon null.
 * Évite les doublons indexables et la multiplication des variantes en cache (page=999999…).
 */
export function normalizedPageSearch(url: URL, total: number): string | null {
  const raw = url.searchParams.get('page')
  if (raw === null) return null
  const lastPage = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE))
  const value = /^\d{1,12}$/.test(raw) ? Number(raw) : NaN
  const target = Number.isInteger(value) && value >= 2 ? Math.min(value, lastPage) : 1
  if (target >= 2 && String(target) === raw) return null
  const params = new URLSearchParams(url.search)
  params.delete('kind')
  if (target <= 1) params.delete('page')
  else params.set('page', String(target))
  const query = params.toString()
  return query ? `?${query}` : ''
}

function staticSitemapRoutes() {
  return [
    ...STATIC_ROUTES,
    ...BLOG_POSTS.map((post) => `/blog/${post.slug}`),
    ...NEIGHBORHOODS.map((neighborhood) => `/quartiers/${neighborhood.slug}`),
  ]
}

export function sitemapXml(items: IndexEntry[], today = new Date().toISOString().slice(0, 10)) {
  const entries = new Map<string, string>()
  for (const route of staticSitemapRoutes()) entries.set(route, today)
  for (const item of items) {
    if (!isServable(item.status)) continue
    const lastmod = /^\d{4}-\d{2}-\d{2}/.test(item.updatedAt ?? '') ? item.updatedAt!.slice(0, 10) : today
    entries.set(`/${item.kind}/${item.id}`, lastmod)
  }
  const urls = [...entries]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([route, lastmod]) => {
      const loc = `${SITE_URL}${route === '/' ? '/' : route}`
      const priority = route === '/' ? '1.0' : route.split('/').length <= 2 ? '0.8' : '0.6'
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

async function handleSitemapInner(_request: Request, ctx: PageContext = {}): Promise<Response> {
  const config = feedConfigFromEnv(envOf(ctx))
  if (!config) return unavailableResponse('Flux catalogue non configuré')
  try {
    const index = await feed.index({ ...config, fetch: ctx.fetch })
    tag(ctx, ['sitemap'])
    return new Response(sitemapXml(index.items), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=604800, stale-if-error=604800',
        'Vercel-CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=604800, stale-if-error=604800',
      },
    })
  } catch (error) {
    if (error instanceof FeedUnavailableError) return unavailableResponse()
    throw error
  }
}

export const REVALIDATE_PATH = '/api/revalidate'
const TAG_PATTERN = /^(listing-\d{5,12}|catalog-(acheter|louer)|sitemap)$/

export async function handleRevalidate(request: Request, ctx: PageContext = {}): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  const body = await request.text()
  if (body.length > 64_000) return jsonResponse({ error: 'Payload too large' }, 413)
  const verified = await verifyRequest(envOf(ctx).SYNC_HMAC_SECRET, 'POST', REVALIDATE_PATH, body, request.headers)
  if (!verified.ok) return jsonResponse({ error: 'Unauthorized' }, 401)
  let tags: unknown
  try {
    tags = (JSON.parse(body) as { tags?: unknown }).tags
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 500 || !tags.every((t) => typeof t === 'string' && TAG_PATTERN.test(t))) {
    return jsonResponse({ error: 'Invalid tags' }, 400)
  }
  if (!ctx.invalidateByTag) return jsonResponse({ error: 'Invalidation indisponible hors Vercel' }, 501)
  await ctx.invalidateByTag(tags as string[])
  return jsonResponse({ invalidated: tags.length })
}

export async function handleListing(request: Request, ctx: PageContext = {}) {
  return withRobots(await handleListingInner(request, ctx), envOf(ctx))
}

export async function handleCatalog(request: Request, ctx: PageContext = {}) {
  return withRobots(await handleCatalogInner(request, ctx), envOf(ctx))
}

export async function handleSitemap(request: Request, ctx: PageContext = {}) {
  return withRobots(await handleSitemapInner(request, ctx), envOf(ctx))
}
