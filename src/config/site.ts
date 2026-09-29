export const SITE_ORIGIN = 'https://hamacpatrimoine.com'

const rawBase =
  typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? String(import.meta.env.BASE_URL)
    : ''
export const BASE_PATH = (rawBase && rawBase !== '/' ? rawBase : '/fr/').replace(/\/$/, '')

function hostnameOf(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase()
}

function productionHost() {
  const runtime = globalThis as Record<string, { env?: Record<string, string | undefined> } | undefined>
  const fromProcess = String(runtime['process']?.env?.VERCEL_PROJECT_PRODUCTION_URL ?? '')
  const fromVite =
    typeof import.meta !== 'undefined' && import.meta.env
      ? String(import.meta.env.VERCEL_PROJECT_PRODUCTION_URL ?? '')
      : ''
  return hostnameOf(fromProcess || fromVite)
}

/** Hôte réellement servi (Vercel aujourd’hui, hamacpatrimoine.com après rattachement du domaine). */
export const SERVED_ORIGIN = (() => {
  const host = productionHost()
  return host ? `https://${host}` : SITE_ORIGIN
})()

export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}`
export const SERVED_SITE_URL = `${SERVED_ORIGIN}${BASE_PATH}`

/** URL canonique d'une route : le pathname du routeur est déjà sans le basename. */
export const canonicalUrl = (pathname: string) => `${SITE_URL}${pathname === '/' ? '/' : pathname}`

/** URL d’aperçu social : suit l’hôte servi, pas l’ancien site Apimo. */
export const shareUrl = (pathname: string) => `${SERVED_SITE_URL}${pathname === '/' ? '/' : pathname}`

export const SITE_NAME = 'Hamac Investissements & Patrimoine'

export const DEFAULT_OG_IMAGE = `${SERVED_SITE_URL}/images/og/hamac-og-1200x630.jpg`

export const AGENCY = {
  legalName: 'Hamac Investissements & Patrimoine',
  street: '19 Bd Baron du Marais',
  postalCode: '69110',
  city: 'Sainte-Foy-lès-Lyon',
  telephone: '+33478850827',
  email: 'agence@hamacpatrimoine.com',
  areaServed: [
    'Sainte-Foy-lès-Lyon',
    'Tassin-la-Demi-Lune',
    'Écully',
    'Francheville',
    'Craponne',
    'Oullins',
  ],
}

export const toAbsoluteUrl = (value: string) => {
  if (!value) return DEFAULT_OG_IMAGE
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith(BASE_PATH)) return `${SERVED_ORIGIN}${value}`
  if (value.startsWith('/')) return `${SERVED_ORIGIN}${value}`
  return `${SERVED_SITE_URL}/${value}`
}

/** JPEG 1200×630 pour les réseaux sociaux ; les .webp locaux sont refusés par Facebook / WhatsApp. */
export const socialOgImage = (value?: string) => {
  if (!value) return DEFAULT_OG_IMAGE
  const abs = toAbsoluteUrl(value)
  const isLocalWebp =
    /\.webp(\?|$)/i.test(abs) && (abs.startsWith(SITE_ORIGIN) || abs.startsWith(SERVED_ORIGIN))
  return isLocalWebp ? DEFAULT_OG_IMAGE : abs
}
