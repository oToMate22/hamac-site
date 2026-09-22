import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { canonicalUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, toAbsoluteUrl } from '../config/site'

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

const SECTION_LABELS: Record<string, string> = {
  acheter: 'Acheter',
  louer: 'Louer',
  vendre: 'Vendre',
  estimation: 'Estimation',
  'off-market': 'Off-market',
  quartiers: 'Communes',
  agence: "L'agence",
  contact: 'Contact',
  investir: 'Investir',
  blog: 'Journal',
  'mentions-legales': 'Mentions légales',
  honoraires: 'Honoraires',
  confidentialite: 'Confidentialité',
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

const breadcrumbJsonLd = (pathname: string) => {
  const parts = pathname.split('/').filter(Boolean)
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
  ]
  let acc = ''
  parts.forEach((part, index) => {
    acc += `/${part}`
    const isLast = index === parts.length - 1
    const name = SECTION_LABELS[part] ?? decodeURIComponent(part).replace(/-/g, ' ')
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name: isLast ? name.charAt(0).toUpperCase() + name.slice(1) : name,
      item: canonicalUrl(acc),
    })
  })
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
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
  const image = toAbsoluteUrl(ogImage || DEFAULT_OG_IMAGE)

  document.title = title
  upsertMetaByName('description', description)
  upsertMetaByName('robots', robots)
  upsertMetaByProperty('og:title', title)
  upsertMetaByProperty('og:description', description)
  upsertMetaByProperty('og:type', ogType)
  upsertMetaByProperty('og:url', url)
  upsertMetaByProperty('og:site_name', SITE_NAME)
  upsertMetaByProperty('og:locale', 'fr_FR')
  upsertMetaByProperty('og:image', image)
  upsertMetaByName('twitter:card', 'summary_large_image')
  upsertMetaByName('twitter:title', title)
  upsertMetaByName('twitter:description', description)
  upsertMetaByName('twitter:image', image)
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
