// Construction du <head> (titre, description, Open Graph, Twitter, canonical, JSON-LD) à partir
// du shell HTML de Vite. Code pur, sans dépendance Node ni Sharp : partagé par le build
// (scripts/inject-route-heads.ts, scripts/prerender.ts) et le rendu serveur des fiches (server/).
import { canonicalUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, shareUrl, socialOgImage } from '../config/site'
import { breadcrumbJsonLd, realEstateAgentJsonLd } from './jsonld'

/** Format des images de partage (doit rester aligné sur scripts/og-images.ts). */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export type RouteHead = {
  title: string
  description: string
  ogType?: string
  ogImage?: string
  /** Dimensions connues de ogImage (sinon les balises og:image:width/height/type sont omises). */
  ogImageSize?: { width: number; height: number; type: string }
  ogImageAlt?: string
  robots?: string
  jsonLd?: Array<{ id: string; data: object }>
}

export const SUFFIX = 'Hamac Investissements & Patrimoine'
export const DEFAULT_DESCRIPTION =
  "Hamac Investissements & Patrimoine — agence immobilière premium dans l'Ouest Lyonnais. Immobilier de confiance, sur-mesure et humain."

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function setMetaByName(html: string, name: string, content: string) {
  const tag = `<meta name="${name}" content="${escapeHtml(content)}" />`
  const re = new RegExp(`<meta\\s+name="${name}"[^>]*>`, 'i')
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

export function setMetaByProperty(html: string, property: string, content: string) {
  const tag = `<meta property="${property}" content="${escapeHtml(content)}" />`
  const re = new RegExp(`<meta\\s+property="${property}"[^>]*>`, 'i')
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

export function removeMetaByProperty(html: string, property: string) {
  return html.replace(new RegExp(`<meta\\s+property="${property}"[^>]*>\\s*`, 'gi'), '')
}

/** Nom de la balise qui marque une image de partage figée au build (lue par src/utils/seo.ts). */
export const OG_ROUTE_META = 'hamac:og-route'

export function setLink(html: string, rel: string, href: string, extra = '') {
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

/**
 * Balises image de partage (og:image*, twitter:image*) + marqueur de route.
 * Appelée à l'injection du <head> ET après le pré-rendu Chromium : `vite preview` sert le shell
 * SPA aux fiches, le code client y réécrit og:image avec la photo Apimo brute, et ce HTML
 * remplace ensuite la page injectée. On réimpose donc l'image générée au build.
 */
export function applyOgImageTags(input: string, route: string, meta: RouteHead) {
  let html = input
  const image = socialOgImage(meta.ogImage)
  const size =
    image === DEFAULT_OG_IMAGE ? { width: OG_WIDTH, height: OG_HEIGHT, type: 'image/jpeg' } : meta.ogImageSize
  const alt = meta.ogImageAlt ?? meta.title
  html = setMetaByProperty(html, 'og:image', image)
  if (image.startsWith('https://')) html = setMetaByProperty(html, 'og:image:secure_url', image)
  else html = removeMetaByProperty(html, 'og:image:secure_url')
  if (size) {
    html = setMetaByProperty(html, 'og:image:width', String(size.width))
    html = setMetaByProperty(html, 'og:image:height', String(size.height))
    html = setMetaByProperty(html, 'og:image:type', size.type)
  } else {
    for (const key of ['width', 'height', 'type']) html = removeMetaByProperty(html, `og:image:${key}`)
  }
  html = setMetaByProperty(html, 'og:image:alt', alt)
  html = setMetaByName(html, 'twitter:image', image)
  html = setMetaByName(html, 'twitter:image:alt', alt)
  // Indique au code client que l'image de partage de cette route est fixée au build :
  // le pré-rendu Chromium ne doit pas la remplacer par la photo Apimo brute.
  html = setMetaByName(html, OG_ROUTE_META, route)
  return html
}

export function applyHead(shell: string, route: string, meta: RouteHead) {
  const url = canonicalUrl(route)
  const ogUrl = shareUrl(route)
  const robots = meta.robots ?? 'index,follow'
  const ogType = meta.ogType ?? 'website'
  let html = shell
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
  html = setMetaByName(html, 'description', meta.description)
  html = setMetaByName(html, 'robots', robots)
  html = setMetaByProperty(html, 'og:title', meta.title)
  html = setMetaByProperty(html, 'og:description', meta.description)
  html = setMetaByProperty(html, 'og:type', ogType)
  html = setMetaByProperty(html, 'og:url', ogUrl)
  html = setMetaByProperty(html, 'og:site_name', SITE_NAME)
  html = setMetaByProperty(html, 'og:locale', 'fr_FR')
  html = applyOgImageTags(html, route, meta)
  html = setMetaByName(html, 'twitter:card', 'summary_large_image')
  html = setMetaByName(html, 'twitter:title', meta.title)
  html = setMetaByName(html, 'twitter:description', meta.description)
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

export function staticHead(route: string): RouteHead | null {
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
      description:
        'Grille d’honoraires Hamac : transaction, location, gestion courte durée et investissement clé en main.',
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

export const notFoundHead: RouteHead = {
  title: `Page introuvable — ${SUFFIX}`,
  description: 'Cette page n’existe pas. Revenez au catalogue des biens Hamac dans l’Ouest lyonnais.',
  robots: 'noindex,follow',
}
