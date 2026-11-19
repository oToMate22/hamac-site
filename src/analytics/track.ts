// ─────────────────────────────────────────────
// src/analytics/track.ts
// Émission gtag après validation du schéma fermé.
// Sans consentement, sans validation, ou si une valeur ressemble à une donnée
// personnelle : rien n'est envoyé. GTM n'est pas chargé.
// ─────────────────────────────────────────────

import { CONSENT_CHANGED_EVENT } from '../consent/storage'
import { GA_MEASUREMENT_ID, TRACKING_VERSION, trackingConfigured } from './config'
import { analyticsGranted, canTrack, onBeforeGtmBoot } from './gtm'
import { reserveLead } from './lead-dedup'
import { trafficType } from './internalTraffic'
import { pageTypeFromPath, routePathFromWindow } from './pageType'
import { EVENT_SCHEMAS, validateEvent, type AnalyticsEventName, type EventParams } from './events'
import { getLandingReferrer, looksPersonal, sanitizeUrl } from './url'

let currentRoute: string | null = null
let previousLocation: string | undefined
let currentLocation: string | undefined

function deliver(event: string, params: Record<string, unknown>) {
  if (typeof window.gtag !== 'function') return false
  const payload: Record<string, unknown> = { ...params, send_to: GA_MEASUREMENT_ID }
  const internal = trafficType()
  if (internal) payload.traffic_type = internal
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) delete payload[key]
  }
  window.gtag('event', event, payload)
  return true
}

/**
 * Suivi de la route en mémoire, avec ou sans consentement (rien n'est envoyé ici).
 * Sert au référent réel de la vue suivante.
 */
export function noteRoute(routePath: string) {
  const location = sanitizeUrl(window.location.href)
  if (location === currentLocation && routePath === currentRoute) return
  if (currentLocation !== undefined) previousLocation = currentLocation
  currentLocation = location
  currentRoute = routePath
}

// Mémorise la route avant la configuration gtag, pour le premier page_view.
onBeforeGtmBoot(() => {
  if (currentLocation === undefined) noteRoute(routePathFromWindow())
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
  const form = Object.getOwnPropertyDescriptor(validated.params, 'form')?.value
  if (event === 'generate_lead' && (typeof form !== 'string' || !reserveLead(form, Date.now()))) {
    return false
  }
  const wire: Record<string, unknown> = {
    ...validated.params,
    tracking_version: TRACKING_VERSION,
  }
  if (event === 'page_view') {
    wire.page_path = currentRoute ?? undefined
    wire.page_location = currentLocation
    wire.page_referrer = previousLocation ?? getLandingReferrer()
    const pageType = currentRoute ? pageTypeFromPath(currentRoute) : undefined
    if (pageType) wire.page_type = pageType
  }
  return deliver(event, wire)
}

let lastPageViewRoute: string | null = null

// Après un refus, la prochaine acceptation (sans rechargement) renvoie un page_view pour la page courante.
if (trackingConfigured()) {
  window.addEventListener(CONSENT_CHANGED_EVENT, () => {
    if (!analyticsGranted()) lastPageViewRoute = null
  })
}

/** page_view de la route courante, une fois par pathname. Une recherche sur la même page ne renvoie pas l'événement. */
export function trackPageView(routePath: string) {
  noteRoute(routePath)
  if (!canTrack() || lastPageViewRoute === routePath) return
  if (track('page_view', {})) lastPageViewRoute = routePath
}
