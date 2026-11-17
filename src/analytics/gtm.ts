// ─────────────────────────────────────────────
// src/analytics/gtm.ts
// Socle OTOMATE : API de consentement lue par le Consent Bridge GTM,
// chargement différé de GTM et révocation (spécification v1.4.2).
//
//  • Aucune commande gtag('consent') dans le code : c'est le modèle GTM
//    « OTOMATE – Consent Bridge » qui pose l'état (setDefaultConsentState)
//    à partir de window.otomateConsent.get(), puis suit les changements
//    via window.otomateConsent.subscribe() (updateConsentState).
//  • GTM n'est injecté qu'avec le consentement analytics (mode basique).
// ─────────────────────────────────────────────

import { CONSENT_CHANGED_EVENT, readConsent, writeConsent } from '../consent/storage'
import { GA_MEASUREMENT_ID, GTM_ID, trackingConfigured } from './config'
import { purgeGaCookies } from './cookies'

type ConsentValue = 'granted' | 'denied'
type ConsentSnapshot = { analytics_storage: ConsentValue }
type ConsentListener = (state: ConsentSnapshot) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    otomateConsent?: {
      get: () => ConsentSnapshot
      subscribe: (listener: ConsentListener) => void
    }
  }
}

const SCRIPT_ID = 'otomate-gtm'

let gtmBooted = false
let trackingEnabled = false
let notifySubscribers = true
const listeners = new Set<ConsentListener>()
const beforeGrantHooks: Array<() => void> = []

function snapshot(): ConsentSnapshot {
  return { analytics_storage: readConsent()?.analytics === true ? 'granted' : 'denied' }
}

export function analyticsGranted(): boolean {
  return snapshot().analytics_storage === 'granted'
}

/** Événements métier autorisés : configuration, consentement, GTM injecté, pas de révocation en cours. */
export function canTrack(): boolean {
  return trackingEnabled && gtmBooted && trackingConfigured() && analyticsGranted()
}

export function isGtmBooted(): boolean {
  return gtmBooted
}

/** Exécuté juste avant le marqueur gtm.js (poussée du contexte de page). */
export function onBeforeGtmBoot(hook: () => void) {
  beforeGrantHooks.push(hook)
}

function dataLayer(): unknown[] {
  window.dataLayer = window.dataLayer ?? []
  return window.dataLayer
}

function setGaDisabled(disabled: boolean) {
  if (!GA_MEASUREMENT_ID) return
  ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_MEASUREMENT_ID}`] = disabled
}

/** Expose l'état de la CMP au Consent Bridge (lecture seule + abonnement). */
function installConsentApi() {
  if (window.otomateConsent) return
  window.otomateConsent = {
    get: snapshot,
    subscribe: (listener) => {
      if (typeof listener === 'function') listeners.add(listener)
    },
  }
  window.addEventListener(CONSENT_CHANGED_EVENT, () => {
    if (!notifySubscribers) return
    const state = snapshot()
    for (const listener of listeners) {
      try {
        listener(state)
      } catch {
        /* un abonné défaillant ne doit pas bloquer les autres */
      }
    }
  })
}

/** Consentement analytics accordé : contexte, marqueur gtm.js, injection unique. */
export function grant() {
  if (!trackingConfigured() || !analyticsGranted()) return
  setGaDisabled(false)
  if (!gtmBooted) {
    for (const hook of beforeGrantHooks) hook()
    dataLayer().push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.async = true
      // Hôte via atob : la chaîne littérale n'apparaît pas dans dist/ (contrôle du HTML pré-rendu).
      script.src = `https://${atob('d3d3Lmdvb2dsZXRhZ21hbmFnZXIuY29t')}/gtm.js?id=${encodeURIComponent(GTM_ID)}`
      document.head.appendChild(script)
    }
    gtmBooted = true
  }
  trackingEnabled = true
}

export type RevokeVariant = 'VR-1' | 'VR-2' | 'VR-3'

/**
 * Variante de révocation (§1.4 de la note v1.4.1). VR-1 par défaut.
 * En développement uniquement, localStorage.otomate_revoke_variant permet
 * de mesurer VR-2 / VR-3 pour les tests bloquants T-RV2 / T-RV3.
 */
function revokeVariant(): RevokeVariant {
  if (import.meta.env.DEV) {
    try {
      const forced = localStorage.getItem('otomate_revoke_variant')
      if (forced === 'VR-2' || forced === 'VR-3') return forced
    } catch {
      /* ignoré */
    }
  }
  return 'VR-1'
}

function devReloadDisabled(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem('otomate_revoke_no_reload') === '1'
  } catch {
    return false
  }
}

/**
 * Refus ou révocation. Si GTM a été chargé sur cette page : séquence de révocation
 * puis rechargement (D1). Sinon : enregistrement du refus et purge des cookies.
 */
export function refuse() {
  if (!gtmBooted) {
    writeConsent(false)
    purgeGaCookies()
    return
  }

  // R1 — plus aucun événement métier, avant toute autre action.
  trackingEnabled = false
  if (import.meta.env.DEV) console.info('[otomate] R1', Date.now())

  const variant = revokeVariant()
  if (variant !== 'VR-3') setGaDisabled(true)
  notifySubscribers = variant !== 'VR-2'
  writeConsent(false) // condition D8 fausse ; Consent Bridge → updateConsentState(denied) sauf VR-2
  notifySubscribers = true
  purgeGaCookies()

  if (devReloadDisabled()) return // isolement T-RV1 / T-RV2, développement uniquement
  location.reload()
}

/** Démarrage, avant le rendu React. */
export function bootConsent() {
  if (!trackingConfigured()) return
  installConsentApi()
  const stored = readConsent()
  if (stored?.analytics === true) grant()
  else if (stored?.analytics === false) purgeGaCookies()

  window.addEventListener(CONSENT_CHANGED_EVENT, () => {
    if (analyticsGranted()) grant()
  })
}
