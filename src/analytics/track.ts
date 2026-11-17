// ─────────────────────────────────────────────
// src/analytics/track.ts
// Contrat dataLayer OTOMATE (spécification §A4 / §1.7) :
//   • otomate_context : contexte de page persistant, remplacé en bloc
//   • event_params    : paramètres de l'événement, remis à null avant chaque push
// Aucun événement n'est mis en file avant consentement : il est abandonné.
// ─────────────────────────────────────────────

import { CONSENT_CHANGED_EVENT } from '../consent/storage'
import { TRACKING_VERSION, trackingConfigured } from './config'
import { analyticsGranted, canTrack, onBeforeGtmBoot } from './gtm'
import { trafficType } from './internalTraffic'
import { pageTypeFromPath, routePathFromWindow, type PageType } from './pageType'
import { EVENT_SCHEMAS, validateEvent, type AnalyticsEventName, type EventParams } from './events'
import { getLandingReferrer, lateConsentCampaign, looksPersonal, sanitizeUrl, type CampaignFields } from './url'

type OtomateContext = {
  page_location: string | undefined
  page_referrer: string | undefined
  page_type: PageType | undefined
  traffic_type: 'internal' | undefined
  tracking_version: string
  campaign_source: string | undefined
  campaign_medium: string | undefined
  campaign_name: string | undefined
  campaign_term: string | undefined
  campaign_content: string | undefined
  campaign_id: string | undefined
}

const EMPTY_CAMPAIGN = {
  campaign_source: undefined,
  campaign_medium: undefined,
  campaign_name: undefined,
  campaign_term: undefined,
  campaign_content: undefined,
  campaign_id: undefined,
} satisfies Record<keyof CampaignFields, undefined>

let currentRoute: string | null = null
let previousLocation: string | undefined
let currentLocation: string | undefined

function push(message: Record<string, unknown>) {
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(message)
}

function buildContext(campaign: CampaignFields = {}): OtomateContext {
  return {
    page_location: currentLocation,
    page_referrer: previousLocation ?? getLandingReferrer(),
    page_type: currentRoute ? pageTypeFromPath(currentRoute) : undefined,
    traffic_type: trafficType(),
    tracking_version: TRACKING_VERSION,
    ...EMPTY_CAMPAIGN,
    ...campaign,
  }
}

/**
 * Suivi de la route en mémoire, avec ou sans consentement (rien n'est envoyé ici).
 * Sert au référent réel de la vue suivante et au contexte initial de GTM.
 */
export function noteRoute(routePath: string) {
  const location = sanitizeUrl(window.location.href)
  if (location === currentLocation && routePath === currentRoute) return
  if (currentLocation !== undefined) previousLocation = currentLocation
  currentLocation = location
  currentRoute = routePath
}

// Contexte poussé AVANT le marqueur gtm.js : lu par la balise Google à l'Initialization (H2),
// avec les champs campaign_* en cas d'acceptation tardive (D3).
onBeforeGtmBoot(() => {
  if (currentLocation === undefined) noteRoute(routePathFromWindow())
  push({ otomate_context: buildContext(lateConsentCampaign(window.location.href)) })
})

function textLooksPersonal(params: object): boolean {
  for (const key of Object.getOwnPropertyNames(params)) {
    const value = Object.getOwnPropertyDescriptor(params, key)?.value
    if (typeof value === 'string' && looksPersonal(value)) return true
  }
  return false
}

const REJECTION_REASONS = new Set<string>([
  'not_object',
  'unexpected_key',
  'symbol_key',
  'accessor',
  'invalid_type',
  'invalid_value',
  'out_of_range',
  'resolver_rejected',
  'missing_key',
  'inconsistent',
  'personal',
])

/** Nom d'événement connu et motif technique. Jamais les clés, jamais les valeurs. Développement seulement. */
function reportRejection(event: string, reason: string): void {
  if (import.meta.env.DEV && Object.hasOwn(EVENT_SCHEMAS, event) && REJECTION_REASONS.has(reason)) {
    console.info('[otomate] rejet', event, reason)
  }
}

/**
 * Pousse un événement déjà décrit dans le schéma.
 * Sans consentement, sans validation, ou si une valeur textuelle ressemble
 * à une donnée personnelle : false, et aucun push.
 */
export function track<E extends AnalyticsEventName>(event: E, params: EventParams<E>): boolean {
  if (!canTrack()) return false
  const validated = validateEvent(event, params)
  if (!validated.ok) {
    reportRejection(event, validated.reason)
    return false
  }
  if (textLooksPersonal(validated.params)) {
    reportRejection(event, 'personal')
    return false
  }
  push({ event_params: null })
  push({ event, event_params: validated.params })
  return true
}

let lastPageViewRoute: string | null = null

// Après un refus, la prochaine acceptation (sans rechargement) renvoie un page_view pour la page courante.
if (trackingConfigured()) {
  window.addEventListener(CONSENT_CHANGED_EVENT, () => {
    if (!analyticsGranted()) lastPageViewRoute = null
  })
}

/** page_view de la route courante, une fois par pathname (dédoublonnage §A7). */
export function trackPageView(routePath: string) {
  noteRoute(routePath)
  if (!canTrack() || lastPageViewRoute === routePath) return
  push({ otomate_context: buildContext() })
  if (track('page_view', {})) lastPageViewRoute = routePath
}
