// Transport gtag, chargé uniquement après consentement analytics.
// Le conteneur GTM publié n'a aucune balise : il n'est pas injecté.
// Charger les deux enverrait chaque page_view deux fois.

import { CONSENT_CHANGED_EVENT, readConsent, writeConsent } from '../consent/storage'
import { GA_MEASUREMENT_ID, trackingConfigured } from './config'
import { purgeGaCookies } from './cookies'
import { trafficType } from './internalTraffic'
import { lateConsentCampaign } from './url'

declare global {
  interface Window {
    dataLayer?: IArguments[] | unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const SCRIPT_ID = 'ga4-gtag'

let gtagBooted = false
let trackingEnabled = false
let refusing = false
let consentDefaultsReady = false
const beforeGrantHooks: Array<() => void> = []

export function analyticsGranted(): boolean {
  return readConsent()?.analytics === true
}

/** Événements métier autorisés : mesure configurée, consentement, gtag préparé, pas de révocation. */
export function canTrack(): boolean {
  return trackingEnabled && gtagBooted && trackingConfigured() && analyticsGranted() && !refusing
}

export function onBeforeGtmBoot(hook: () => void) {
  beforeGrantHooks.push(hook)
}

function ensureGtagStub() {
  window.dataLayer = window.dataLayer ?? []
  if (typeof window.gtag === 'function') return
  window.gtag = function gtag(..._args: unknown[]) {
    // gtag.js attend un objet Arguments, comme le snippet officiel.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments as unknown as IArguments)
  }
}

function ensureConsentDefaults() {
  if (consentDefaultsReady || !trackingConfigured()) return
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

function setGaDisabled(disabled: boolean) {
  if (!GA_MEASUREMENT_ID) return
  ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_MEASUREMENT_ID}`] = disabled
}

function loadGtag() {
  if (document.getElementById(SCRIPT_ID)) return
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://${atob('d3d3Lmdvb2dsZXRhZ21hbmFnZXIuY29t')}/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`
  document.head.appendChild(script)
}

/** Consentement analytics accordé : défaut refusé déjà posé, puis autorisation et gtag.js une seule fois. */
export function grant() {
  if (refusing || !trackingConfigured() || !analyticsGranted()) return
  setGaDisabled(false)
  ensureConsentDefaults()
  window.gtag?.('consent', 'update', {
    analytics_storage: 'granted',
  })
  if (!gtagBooted) {
    for (const hook of beforeGrantHooks) hook()
    window.gtag?.('js', new Date())
    window.gtag?.('config', GA_MEASUREMENT_ID, {
      send_page_view: false,
      anonymize_ip: true,
      ...lateConsentCampaign(window.location.href),
      ...(trafficType() ? { traffic_type: trafficType() } : {}),
    })
    loadGtag()
    gtagBooted = true
  }
  trackingEnabled = true
}

/**
 * Refus ou révocation. Si gtag a été chargé : plus aucun événement, consentement retiré,
 * cookies purgés, rechargement. Sinon : refus enregistré et cookies purgés.
 */
export function refuse() {
  refusing = true
  trackingEnabled = false
  if (!gtagBooted) {
    writeConsent(false)
    purgeGaCookies()
    return
  }
  ensureConsentDefaults()
  setGaDisabled(true)
  window.gtag?.('consent', 'update', {
    analytics_storage: 'denied',
  })
  writeConsent(false)
  purgeGaCookies()
  location.reload()
}

/** Démarrage, avant le rendu React. Aucun script Google sans consentement déjà enregistré. */
export function bootConsent() {
  if (!trackingConfigured()) return
  ensureConsentDefaults()
  const stored = readConsent()
  if (stored?.analytics === true) grant()
  else if (stored?.analytics === false) purgeGaCookies()

  window.addEventListener(CONSENT_CHANGED_EVENT, () => {
    if (analyticsGranted()) grant()
  })
}
