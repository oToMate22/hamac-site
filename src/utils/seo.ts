import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { canonicalUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, shareUrl, socialOgImage } from '../config/site'
import { breadcrumbJsonLd } from '../seo/jsonld'

/** Balise posée par scripts/inject-route-heads.ts : route dont l'image de partage est figée au build. */
const OG_ROUTE_META = 'hamac:og-route'

type PageMeta = {
  title: string
  description: string
  ogType?: string
  ogImage?: string
  canonicalPath?: string
  robots?: string
  jsonLd?: Array<{ id: string; data: object | null }>
}

const upsertMetaByName = (name: string, content: string) => {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute('name', name)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

const upsertMetaByProperty = (property: string, content: string) => {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute('property', property)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

const upsertLink = (rel: string, href: string, extra?: Record<string, string>) => {
  const extraKey = extra
    ? Object.entries(extra)
        .map(([key, value]) => `[${key}="${value}"]`)
        .join('')
    : ''
  let node = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]${extraKey}`)
  if (rel === 'canonical') {
    document.head.querySelectorAll('link[rel="canonical"]').forEach((entry) => entry.remove())
    node = null
  }
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', rel)
    if (extra) {
      for (const [key, value] of Object.entries(extra)) node.setAttribute(key, value)
    }
    document.head.appendChild(node)
  }
  node.setAttribute('href', href)
}

export const applyJsonLd = (id: string, data: object | null) => {
  const existing = document.getElementById(id)
  if (!data) {
    existing?.remove()
    return
  }
  const node =
    existing instanceof HTMLScriptElement
      ? existing
      : document.createElement('script')
  node.id = id
  node.type = 'application/ld+json'
  node.textContent = JSON.stringify(data)
  if (!existing) document.head.appendChild(node)
}

export const applyPageMeta = ({
  title,
  description,
  ogType = 'website',
  ogImage,
  canonicalPath = '/',
  robots = 'index,follow',
}: PageMeta) => {
  const url = canonicalUrl(canonicalPath)
  const ogUrl = shareUrl(canonicalPath)
  const image = socialOgImage(ogImage)
  const isDefaultOg = image === DEFAULT_OG_IMAGE

  document.title = title
  upsertMetaByName('description', description)
  upsertMetaByName('robots', robots)
  upsertMetaByProperty('og:title', title)
  upsertMetaByProperty('og:description', description)
  upsertMetaByProperty('og:type', ogType)
  upsertMetaByProperty('og:url', ogUrl)
  upsertMetaByProperty('og:site_name', SITE_NAME)
  upsertMetaByProperty('og:locale', 'fr_FR')
  // L'image de partage injectée au build (JPEG 1200×630 hébergé chez nous) prime : sans cette
  // garde, le pré-rendu Chromium la remplacerait par la photo Apimo brute.
  const staticOgRoute = document.head
    .querySelector<HTMLMetaElement>(`meta[name="${OG_ROUTE_META}"]`)
    ?.getAttribute('content')
  const stripSlash = (value: string) => (value.length > 1 ? value.replace(/\/+$/, '') : value)
  if (!staticOgRoute || stripSlash(staticOgRoute) !== stripSlash(canonicalPath)) {
    upsertMetaByProperty('og:image', image)
    if (image.startsWith('https://')) upsertMetaByProperty('og:image:secure_url', image)
    else document.head.querySelector('meta[property="og:image:secure_url"]')?.remove()
    if (isDefaultOg) {
      upsertMetaByProperty('og:image:width', '1200')
      upsertMetaByProperty('og:image:height', '630')
      upsertMetaByProperty('og:image:type', 'image/jpeg')
    } else {
      document.head.querySelector('meta[property="og:image:width"]')?.remove()
      document.head.querySelector('meta[property="og:image:height"]')?.remove()
      document.head.querySelector('meta[property="og:image:type"]')?.remove()
    }
    upsertMetaByProperty('og:image:alt', title)
    upsertMetaByName('twitter:image', image)
    upsertMetaByName('twitter:image:alt', title)
  }
  upsertMetaByName('twitter:card', 'summary_large_image')
  upsertMetaByName('twitter:title', title)
  upsertMetaByName('twitter:description', description)
  upsertLink('canonical', url)
  upsertLink('alternate', url, { hreflang: 'fr-FR' })
  upsertLink('alternate', `${SITE_URL}/`, { hreflang: 'x-default' })
  applyJsonLd('ld-breadcrumb', breadcrumbJsonLd(canonicalPath))
}

export const usePageMeta = (meta: PageMeta) => {
  const { pathname } = useLocation()
  const canonicalPath = meta.canonicalPath ?? pathname
  const jsonLdKey = JSON.stringify(meta.jsonLd ?? [])

  useEffect(() => {
    applyPageMeta({ ...meta, canonicalPath })
    const blocks = meta.jsonLd ?? []
    for (const block of blocks) {
      applyJsonLd(block.id, block.data)
    }
    return () => {
      for (const block of blocks) {
        applyJsonLd(block.id, null)
      }
    }
  }, [
    canonicalPath,
    jsonLdKey,
    meta.description,
    meta.ogImage,
    meta.ogType,
    meta.robots,
    meta.title,
  ])
}
