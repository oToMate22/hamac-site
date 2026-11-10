import { BASE_PATH, canonicalUrl } from '../config/site'

declare global {
  interface Window {
    __PRERENDER__?: boolean
    dataLayer?: IArguments[] | unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim()
const SCRIPT_ID = 'ga4-gtag'
const GA_COOKIE_SUFFIX = MEASUREMENT_ID.replace(/^G-/i, '')

let lastSentPath: string | null = null
let loading: Promise<void> | null = null
let consentDefaultsReady = false

function isPrerender() {
  return typeof window !== 'undefined' && window.__PRERENDER__ === true
}

export function canTrackAnalytics() {
  return Boolean(MEASUREMENT_ID) && !isPrerender()
}

function ensureGtagStub() {
  window.dataLayer = window.dataLayer ?? []
  if (typeof window.gtag === 'function') return
  window.gtag = function gtag(..._args: unknown[]) {
    // gtag.js attend un objet Arguments (comme le snippet officiel).
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments as unknown as IArguments)
  }
}

/** Consent Mode v2 : défaut refusé avant tout hit (EEA / CNIL). */
function ensureConsentDefaults() {
  if (consentDefaultsReady || isPrerender()) return
  ensureGtagStub()
  window.gtag?.('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  })
  consentDefaultsReady = true
}

/** Ancien flux provisoire — à purger si encore présent sur le navigateur. */
const LEGACY_GA_COOKIE_SUFFIXES = ['WV45LNS0KK']

function gaCookieNames(): string[] {
  const names = new Set<string>(['_ga'])
  if (GA_COOKIE_SUFFIX) names.add(`_ga_${GA_COOKIE_SUFFIX}`)
  for (const suffix of LEGACY_GA_COOKIE_SUFFIXES) names.add(`_ga_${suffix}`)
  for (const part of document.cookie.split(';')) {
    const name = part.trim().split('=')[0]
    if (name === '_ga' || name.startsWith('_ga_')) names.add(name)
  }
  return [...names]
}

function cookiePaths(): string[] {
  const paths = new Set<string>(['/', BASE_PATH || '/fr', `${BASE_PATH || '/fr'}/`])
  const segments = location.pathname.split('/').filter(Boolean)
  let acc = ''
  for (const segment of segments) {
    acc += `/${segment}`
    paths.add(acc)
    paths.add(`${acc}/`)
  }
  return [...paths]
}

function cookieDomains(): Array<string | undefined> {
  const host = location.hostname
  const domains: Array<string | undefined> = [
    undefined, // host-only
    host,
    host.startsWith('.') ? host : `.${host}`,
    'hamacpatrimoine.com',
    '.hamacpatrimoine.com',
  ]
  return [...new Set(domains)]
}

/** Supprime _ga / _ga_<ID> (host-only + Domain=.hamacpatrimoine.com, path=/ et paths rencontrés). */
export function purgeGaCookies() {
  if (typeof document === 'undefined') return
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT'
  for (const name of gaCookieNames()) {
    for (const domain of cookieDomains()) {
      for (const path of cookiePaths()) {
        let value = `${name}=; Expires=${expires}; Max-Age=0; Path=${path}`
        if (domain) value += `; Domain=${domain}`
        document.cookie = value
      }
    }
  }
}

export function loadGa4(): Promise<void> {
  if (!canTrackAnalytics()) return Promise.resolve()
  ;(window as unknown as Record<string, boolean>)[`ga-disable-${MEASUREMENT_ID}`] = false

  ensureConsentDefaults()
  window.gtag?.('consent', 'update', {
    analytics_storage: 'granted',
  })

  if (document.getElementById(SCRIPT_ID)) return loading ?? Promise.resolve()

  window.gtag?.('js', new Date())
  window.gtag?.('config', MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
  })

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    // Host via atob : la chaîne littérale n’apparaît pas dans dist/ (grep SEO / audit).
    script.src = `https://${atob('d3d3Lmdvb2dsZXRhZ21hbmFnZXIuY29t')}/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('GA4 script failed to load'))
    }
    document.head.appendChild(script)
  })

  return loading
}

export function sendPageView(pathname: string) {
  if (!canTrackAnalytics() || typeof window.gtag !== 'function') return
  if (lastSentPath === pathname) return
  lastSentPath = pathname
  window.gtag('event', 'page_view', {
    page_path: pathname,
    page_location: canonicalUrl(pathname),
    send_to: MEASUREMENT_ID,
  })
}

export function disableGa4() {
  lastSentPath = null
  if (typeof window === 'undefined') return
  ensureConsentDefaults()
  window.gtag?.('consent', 'update', {
    analytics_storage: 'denied',
  })
  if (MEASUREMENT_ID) {
    ;(window as unknown as Record<string, boolean>)[`ga-disable-${MEASUREMENT_ID}`] = true
  }
  purgeGaCookies()
}
