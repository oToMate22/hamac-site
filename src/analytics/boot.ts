// ─────────────────────────────────────────────
// src/analytics/boot.ts
// Démarrage du socle, appelé dans main.ts AVANT le rendu React.
// Ordre : marquage interne → mémoire de l'arrivée → consentement gtag. GTM n'est pas chargé.
// ─────────────────────────────────────────────

import { trackingConfigured } from './config'
import { bootConsent } from './gtm'
import { applyInternalTrafficParam } from './internalTraffic'
import './track' // mémorise la route avant la configuration gtag
import { captureLanding } from './url'

export function bootTracking() {
  if (!trackingConfigured()) return
  applyInternalTrafficParam()
  captureLanding()
  bootConsent()
}
