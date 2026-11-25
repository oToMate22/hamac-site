import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOG_POSTS } from '../src/data/blogPosts'
import { NEIGHBORHOODS } from '../src/data/neighborhoods'
import { DEFAULT_OG_IMAGE, SERVED_SITE_URL } from '../src/config/site'
import { blogPostingJsonLd, listingJsonLd, realEstateAgentJsonLd } from '../src/seo/jsonld'
import {
  applyHead,
  notFoundHead,
  staticHead,
  SUFFIX,
  DEFAULT_DESCRIPTION,
  type RouteHead,
} from '../src/seo/headHtml'
import { listingDocumentTitle, listingMetaDescription } from '../src/seo/listingTitle'
import type { FeaturedProperty } from '../src/services/apimo'
import {
  generateListingOgImage,
  LISTING_OG_SUBDIR,
  mapWithConcurrency,
  needsMainPhotoRetry,
  OG_HEIGHT,
  OG_WIDTH,
  type OgImageResult,
  type OgPicture,
} from './og-images'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')
const BASE_PATH = (process.env.VITE_BASE_PATH ?? '/fr').replace(/\/$/, '')

// Réexports : les scripts et tests existants importent ces fonctions depuis ce module.
export { applyHead, applyOgImageTags, notFoundHead, OG_ROUTE_META, type RouteHead } from '../src/seo/headHtml'


export type ListingHeadInput = Pick<
  FeaturedProperty,
  'slug' | 'title' | 'city' | 'type' | 'price' | 'surface' | 'rooms' | 'images' | 'description' | 'zipcode' | 'isRental'
> & {
  id: string
  /** Photos Apimo brutes (rang, flag internet) pour choisir l'image de partage. */
  ogPictures: OgPicture[]
  /** Image de partage générée au build (null : échec, image Hamac par défaut). */
  ogImage?: { url: string; width: number; height: number } | null
}


function outputDir(route: string) {
  if (route === '/') return path.join(DIST, BASE_PATH)
  return path.join(DIST, BASE_PATH, route.replace(/^\//, ''))
}


function mapType(apimoType: unknown): FeaturedProperty['type'] {
  const n = typeof apimoType === 'number' ? apimoType : Number(apimoType)
  if (n === 1) return 'appartement'
  if (n === 2) return 'maison'
  if (n === 3) return 'terrain'
  if (n === 4) return 'commerce'
  if (n === 5) return 'bureau'
  if (n === 6) return 'garage'
  if (n === 7) return 'immeuble'
  return 'maison'
}

function slimListing(raw: Record<string, unknown>): ListingHeadInput | null {
  const id = raw.id
  if (id == null) return null
  const cityObj = raw.city && typeof raw.city === 'object' ? (raw.city as { name?: string; zipcode?: string }) : null
  const areaObj = raw.area && typeof raw.area === 'object' ? (raw.area as { value?: unknown }) : null
  const priceObj = raw.price && typeof raw.price === 'object' ? (raw.price as { value?: unknown; period?: unknown }) : null
  const surface = typeof areaObj?.value === 'number' ? areaObj.value : Number(areaObj?.value) || 0
  const city = cityObj?.name ?? ''
  const reference = typeof raw.reference === 'string' ? raw.reference : String(id)
  const pictures = Array.isArray(raw.pictures) ? (raw.pictures as OgPicture[]) : []
  const images = [...pictures]
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((p) => p.url)
    .filter((url): url is string => Boolean(url))
  let description: string | undefined
  if (typeof raw.comments === 'string') description = raw.comments
  else if (Array.isArray(raw.comments)) {
    const comments = raw.comments as Array<{ language?: string; comment?: string }>
    const french = comments.find((c) => c.language?.toLowerCase() === 'fr') ?? comments[0]
    if (typeof french?.comment === 'string') description = french.comment
  }
  const isRental = priceObj?.period !== null && priceObj?.period !== undefined
  return {
    id: String(id),
    ogPictures: pictures,
    slug: reference,
    title: city && surface ? `${city} ${surface}m²` : reference,
    city,
    type: mapType(raw.type),
    price: typeof priceObj?.value === 'number' ? priceObj.value : Number(priceObj?.value) || 0,
    surface,
    rooms: typeof raw.rooms === 'number' ? raw.rooms : Number(raw.rooms) || 0,
    images,
    description,
    zipcode: cityObj?.zipcode,
    isRental,
  }
}

export async function fetchListingsForHead(): Promise<Map<string, ListingHeadInput>> {
  const map = new Map<string, ListingHeadInput>()
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anon) return map
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/apimo-proxy`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ route: 'properties' }),
    })
    if (!res.ok) {
      console.warn(`Injection head : apimo-proxy HTTP ${res.status}, titres génériques pour les fiches.`)
      return map
    }
    const payload = (await res.json()) as { properties?: Record<string, unknown>[]; data?: { properties?: Record<string, unknown>[] } }
    const list = payload.properties ?? payload.data?.properties ?? []
    for (const raw of list) {
      const listing = slimListing(raw)
      if (!listing) continue
      const prefix = listing.isRental ? '/louer' : '/acheter'
      map.set(`${prefix}/${listing.slug}`, listing)
      if (raw.id != null) map.set(`${prefix}/${String(raw.id)}`, listing)
    }
  } catch (error) {
    console.warn(`Injection head : listing Apimo indisponible (${(error as Error).message}).`)
  }
  return map
}


export function headForRoute(route: string, listings: Map<string, ListingHeadInput>): RouteHead {
  const staticMeta = staticHead(route)
  if (staticMeta) return staticMeta

  const blog = route.match(/^\/blog\/([^/]+)$/)
  if (blog) {
    const post = BLOG_POSTS.find((entry) => entry.slug === blog[1])
    if (post) {
      return {
        title: `${post.title} — ${SUFFIX}`,
        description: post.excerpt,
        ogType: 'article',
        ogImage: post.coverImage,
        jsonLd: [{ id: 'ld-article', data: blogPostingJsonLd(post) }],
      }
    }
  }

  const quartier = route.match(/^\/quartiers\/([^/]+)$/)
  if (quartier) {
    const neighborhood = NEIGHBORHOODS.find((entry) => entry.slug === quartier[1])
    if (neighborhood) {
      return {
        title: `Immobilier à ${neighborhood.name} — ${SUFFIX}`,
        description: `${neighborhood.tagline}. Prix moyen : ${neighborhood.pricePerSqm}. Découvrez nos biens disponibles à ${neighborhood.name} dans l'Ouest Lyonnais.`,
        ogImage: neighborhood.heroImage,
        jsonLd: [{ id: 'ld-agent', data: realEstateAgentJsonLd(neighborhood.name) }],
      }
    }
  }

  const listing = listings.get(route)
  if (listing) {
    const pathname = route
    const property = {
      ...listing,
      bedrooms: 0,
      amenities: [],
    } as FeaturedProperty
    return {
      title: listingDocumentTitle(listing),
      description: listingMetaDescription(listing),
      ogType: 'article',
      // Jamais la photo Apimo brute (trop lourde, domaine en « Disallow: / ») : l'image générée
      // au build, sinon l'image Hamac par défaut.
      ogImage: listing.ogImage?.url ?? DEFAULT_OG_IMAGE,
      ogImageSize: listing.ogImage
        ? { width: listing.ogImage.width, height: listing.ogImage.height, type: 'image/jpeg' }
        : undefined,
      ogImageAlt: listingDocumentTitle(listing),
      jsonLd: [{ id: 'ld-listing', data: listingJsonLd(property, pathname) }],
    }
  }

  if (/^\/(acheter|louer)\/[^/]+$/.test(route)) {
    const id = route.split('/')[2]
    return {
      title: `Bien immobilier · réf. ${id} — ${SUFFIX}`,
      description: `Découvrez ce bien Hamac (réf. ${id}) dans l’Ouest lyonnais.`,
      ogType: 'article',
      ogImage: DEFAULT_OG_IMAGE,
    }
  }

  return {
    title: `Hamac — Immobilier premium | Ouest Lyonnais`,
    description: DEFAULT_DESCRIPTION,
  }
}


/**
 * Génère une image de partage 1200×630 par bien (photo principale, puis les suivantes en cas d'échec)
 * dans dist/images/og/listings/, et l'attache à chaque fiche. Écrit aussi un rapport JSON
 * (dist/og-images-report.json) relu par scripts/check-og-meta.ts.
 */
/** File d'exécution séquentielle (un seul téléchargement de reprise à la fois). */
const retryQueue = {
  tail: Promise.resolve() as Promise<unknown>,
  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task)
    this.tail = next.catch(() => undefined)
    return next
  },
}

export async function prepareListingOgImages(listings: Map<string, ListingHeadInput>) {
  const unique = [...new Map([...listings.values()].map((listing) => [listing.id, listing])).values()]
  if (unique.length === 0) return []
  const outDir = path.join(DIST, LISTING_OG_SUBDIR)
  const started = Date.now()
  const results = await mapWithConcurrency(unique, 4, async (listing) => {
    let result: OgImageResult = await generateListingOgImage(listing.id, listing.ogPictures, outDir)
    if (needsMainPhotoRetry(result)) {
      // media.apimo.pro ralentit sous charge : on retente seul (file séquentielle) avant
      // d'accepter une photo secondaire ou l'image par défaut.
      const retry = await retryQueue.run(() => generateListingOgImage(listing.id, listing.ogPictures, outDir))
      const better = retry.ok && (!result.ok || retry.sourceIndex < result.sourceIndex)
      if (better) {
        if (result.ok) await rm(path.join(outDir, result.file), { force: true })
        console.log(`Image OG ${listing.id} : photo ${retry.sourceIndex + 1} récupérée au second essai`)
        result = retry
      }
    }
    listing.ogImage = result.ok
      ? { url: `${SERVED_SITE_URL}/${LISTING_OG_SUBDIR}/${result.file}`, width: OG_WIDTH, height: OG_HEIGHT }
      : null
    if (!result.ok) {
      console.warn(`Image OG ${listing.id} : image Hamac par défaut — ${result.rejected.join(' ; ')}`)
    } else if (result.rejected.length) {
      console.warn(`Image OG ${listing.id} : photo ${result.sourceIndex + 1} utilisée — ${result.rejected.join(' ; ')}`)
    }
    return { id: listing.id, ...result }
  })
  const ok = results.filter((r) => r.ok).length
  console.log(
    `Images OG : ${ok}/${results.length} générées, ${results.length - ok} image(s) par défaut (${Math.round((Date.now() - started) / 1000)} s)`,
  )
  await writeFile(path.join(DIST, 'og-images-report.json'), JSON.stringify(results, null, 2))
  return results
}

export async function injectRouteHeads(routes: Iterable<string>, listings: Map<string, ListingHeadInput>) {
  const shellHtml = path.join(DIST, 'index.html')
  if (!existsSync(shellHtml)) throw new Error('dist/index.html absent après vite build')
  const shell = await readFile(shellHtml, 'utf8')
  const frDir = path.join(DIST, BASE_PATH)
  await mkdir(frDir, { recursive: true })

  let written = 0
  for (const route of routes) {
    const html = applyHead(shell, route, headForRoute(route, listings))
    const dir = outputDir(route)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html)
    written++
  }

  const notFound = applyHead(shell, '/route-inexistante', notFoundHead)
  await writeFile(path.join(DIST, '404.html'), notFound)
  await writeFile(path.join(frDir, '404.html'), notFound)
  await copyFile(shellHtml, path.join(frDir, '200.html'))
  console.log(`Injection head : ${written} pages + 404 + 200.html`)
}
