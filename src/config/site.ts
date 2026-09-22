export const SITE_ORIGIN = 'https://hamacpatrimoine.com'

const viteBase =
  typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? String(import.meta.env.BASE_URL)
    : ''

export const BASE_PATH = (viteBase || '/fr/').replace(/\/$/, '')
export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}`

/** URL canonique d'une route : le pathname du routeur est déjà sans le basename. */
export const canonicalUrl = (pathname: string) => `${SITE_URL}${pathname === '/' ? '/' : pathname}`

export const SITE_NAME = 'Hamac Investissements & Patrimoine'

export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/Biens/maison-homepage.webp`

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
  if (value.startsWith(BASE_PATH)) return `${SITE_ORIGIN}${value}`
  if (value.startsWith('/')) return `${SITE_ORIGIN}${value}`
  return `${SITE_URL}/${value}`
}
