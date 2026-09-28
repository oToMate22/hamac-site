import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOG_POSTS } from '../src/data/blogPosts'
import { NEIGHBORHOODS } from '../src/data/neighborhoods'
import { canonicalUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, socialOgImage } from '../src/config/site'
import {
  blogPostingJsonLd,
  breadcrumbJsonLd,
  listingJsonLd,
  realEstateAgentJsonLd,
} from '../src/seo/jsonld'
import { listingDocumentTitle, listingMetaDescription } from '../src/seo/listingTitle'
import type { FeaturedProperty } from '../src/services/apimo'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')
const BASE_PATH = (process.env.VITE_BASE_PATH ?? '/fr').replace(/\/$/, '')

export type RouteHead = {
  title: string
  description: string
  ogType?: string
  ogImage?: string
  robots?: string
  jsonLd?: Array<{ id: string; data: object }>
}

export type ListingHeadInput = Pick<
  FeaturedProperty,
  'slug' | 'title' | 'city' | 'type' | 'price' | 'surface' | 'rooms' | 'images' | 'description' | 'zipcode' | 'isRental'
>

const SUFFIX = 'Hamac Investissements & Patrimoine'
const DEFAULT_DESCRIPTION =
  "Hamac Investissements & Patrimoine — agence immobilière premium dans l'Ouest Lyonnais. Immobilier de confiance, sur-mesure et humain."

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function outputDir(route: string) {
  if (route === '/') return path.join(DIST, BASE_PATH)
  return path.join(DIST, BASE_PATH, route.replace(/^\//, ''))
}

function setMetaByName(html: string, name: string, content: string) {
  const tag = `<meta name="${name}" content="${escapeHtml(content)}" />`
  const re = new RegExp(`<meta\\s+name="${name}"[^>]*>`, 'i')
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function setMetaByProperty(html: string, property: string, content: string) {
  const tag = `<meta property="${property}" content="${escapeHtml(content)}" />`
  const re = new RegExp(`<meta\\s+property="${property}"[^>]*>`, 'i')
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function setLink(html: string, rel: string, href: string, extra = '') {
  const extraAttr = extra ? ` ${extra}` : ''
  const tag = `<link rel="${rel}"${extraAttr} href="${escapeHtml(href)}" />`
  if (rel === 'canonical') {
    html = html.replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    return html.replace('</head>', `    ${tag}\n  </head>`)
  }
  if (rel === 'alternate' && extra.includes('hreflang="fr-FR"')) {
    html = html.replace(/<link\s+rel="alternate"[^>]*hreflang="fr-FR"[^>]*>/gi, '')
    return html.replace('</head>', `    ${tag}\n  </head>`)
  }
  if (rel === 'alternate' && extra.includes('hreflang="x-default"')) {
    html = html.replace(/<link\s+rel="alternate"[^>]*hreflang="x-default"[^>]*>/gi, '')
    return html.replace('</head>', `    ${tag}\n  </head>`)
  }
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function applyHead(shell: string, route: string, meta: RouteHead) {
  const url = canonicalUrl(route)
  const image = socialOgImage(meta.ogImage)
  const robots = meta.robots ?? 'index,follow'
  const ogType = meta.ogType ?? 'website'
  let html = shell
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
  html = setMetaByName(html, 'description', meta.description)
  html = setMetaByName(html, 'robots', robots)
  html = setMetaByProperty(html, 'og:title', meta.title)
  html = setMetaByProperty(html, 'og:description', meta.description)
  html = setMetaByProperty(html, 'og:type', ogType)
  html = setMetaByProperty(html, 'og:url', url)
  html = setMetaByProperty(html, 'og:site_name', SITE_NAME)
  html = setMetaByProperty(html, 'og:locale', 'fr_FR')
  html = setMetaByProperty(html, 'og:image', image)
  if (image === DEFAULT_OG_IMAGE) {
    html = setMetaByProperty(html, 'og:image:width', '1200')
    html = setMetaByProperty(html, 'og:image:height', '630')
    html = setMetaByProperty(html, 'og:image:type', 'image/jpeg')
  } else {
    html = html.replace(/<meta\s+property="og:image:(?:width|height|type)"[^>]*>\s*/gi, '')
  }
  html = setMetaByName(html, 'twitter:card', 'summary_large_image')
  html = setMetaByName(html, 'twitter:title', meta.title)
  html = setMetaByName(html, 'twitter:description', meta.description)
  html = setMetaByName(html, 'twitter:image', image)
  html = setLink(html, 'canonical', url)
  html = setLink(html, 'alternate', url, 'hreflang="fr-FR"')
  html = setLink(html, 'alternate', `${SITE_URL}/`, 'hreflang="x-default"')
  html = html.replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '')
  const blocks = [
    { id: 'ld-breadcrumb', data: breadcrumbJsonLd(route) },
    ...(meta.jsonLd ?? []),
  ]
  const scripts = blocks
    .map(
      (block) =>
        `    <script type="application/ld+json" id="${block.id}">${JSON.stringify(block.data)}</script>`,
    )
    .join('\n')
  html = html.replace('</head>', `${scripts}\n  </head>`)
  return html
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
  const pictures = Array.isArray(raw.pictures) ? (raw.pictures as Array<{ url?: string; rank?: number }>) : []
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

function staticHead(route: string): RouteHead | null {
  const pages: Record<string, RouteHead> = {
    '/': {
      title: 'Hamac — Immobilier premium | Ouest Lyonnais',
      description: DEFAULT_DESCRIPTION,
      jsonLd: [{ id: 'ld-agent', data: realEstateAgentJsonLd() }],
    },
    '/acheter': {
      title: `Biens à vendre — ${SUFFIX}`,
      description:
        "Explorez nos biens disponibles dans l'Ouest Lyonnais : maisons, appartements et terrains sélectionnés par Hamac.",
    },
    '/louer': {
      title: `Biens à louer — ${SUFFIX}`,
      description:
        "Explorez nos biens à louer dans l'Ouest Lyonnais : appartements, maisons et opportunités sélectionnés par Hamac.",
    },
    '/vendre': {
      title: `Vendre avec Hamac — ${SUFFIX}`,
      description: 'De l’estimation à la signature, Hamac vous accompagne pour vendre votre bien dans l’Ouest lyonnais.',
    },
    '/estimation': {
      title: `Estimation immobilière gratuite — ${SUFFIX}`,
      description: 'Obtenez une estimation précise et argumentée de votre bien sous 24 h avec un expert Hamac de votre quartier.',
    },
    '/off-market': {
      title: `Off-market immobilier — ${SUFFIX}`,
      description: 'Accédez aux biens off-market de l’Ouest lyonnais avant leur publication et rejoignez le club privé Hamac.',
    },
    '/quartiers': {
      title: `Communes de l’Ouest Lyonnais — ${SUFFIX}`,
      description: 'Découvrez nos communes, leurs atouts et les biens disponibles dans chaque secteur de l’Ouest lyonnais.',
    },
    '/agence': {
      title: `L'agence Hamac — ${SUFFIX}`,
      description: "Découvrez l'histoire, l'équipe et la vision de Hamac, agence immobilière spécialisée dans l’Ouest lyonnais.",
      jsonLd: [{ id: 'ld-agent', data: realEstateAgentJsonLd() }],
    },
    '/contact': {
      title: `Contact — ${SUFFIX}`,
      description: 'Rencontrez l’équipe Hamac à Sainte-Foy-lès-Lyon ou envoyez-nous votre demande. Réponse sous 24 h.',
      jsonLd: [{ id: 'ld-agent', data: realEstateAgentJsonLd() }],
    },
    '/investir': {
      title: `Investir dans l’immobilier — ${SUFFIX}`,
      description:
        "Hamac accompagne vos projets d'investissement immobilier dans l'Ouest lyonnais avec une sélection locale et une lecture patrimoniale.",
    },
    '/blog': {
      title: `Journal Hamac — ${SUFFIX}`,
      description: "Analyses du marché, guides pratiques et vie locale dans l'Ouest Lyonnais.",
    },
    '/mentions-legales': {
      title: `Mentions légales — ${SUFFIX}`,
      description: 'Mentions légales du site Hamac Investissements & Patrimoine, agence immobilière à Sainte-Foy-lès-Lyon.',
      robots: 'noindex,follow',
    },
    '/honoraires': {
      title: `Honoraires — ${SUFFIX}`,
      description: "Barème et modalités d'honoraires de l'agence Hamac Investissements & Patrimoine.",
      robots: 'noindex,follow',
    },
    '/confidentialite': {
      title: `Politique de confidentialité — ${SUFFIX}`,
      description: 'Données personnelles, cookies et droits des utilisateurs sur le site Hamac Investissements & Patrimoine.',
      robots: 'noindex,follow',
    },
  }
  return pages[route] ?? null
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
      ogImage: listing.images[0],
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

export const notFoundHead: RouteHead = {
  title: `Page introuvable — ${SUFFIX}`,
  description: 'Cette page n’existe pas. Revenez au catalogue des biens Hamac dans l’Ouest lyonnais.',
  robots: 'noindex,follow',
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
