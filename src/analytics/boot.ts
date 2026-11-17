// ─────────────────────────────────────────────
// src/analytics/boot.ts
// Démarrage du socle, appelé dans main.ts AVANT le rendu React.
// Ordre : marquage interne → mémoire de l'arrivée → API de consentement / GTM.
// ─────────────────────────────────────────────

import { trackingConfigured } from './config'
import { bootConsent } from './gtm'
import { applyInternalTrafficParam } from './internalTraffic'
import './track' // enregistre la poussée du contexte avant le marqueur gtm.js
import { captureLanding } from './url'

export function bootTracking() {
  if (!trackingConfigured()) return
  applyInternalTrafficParam()
  captureLanding()
  bootConsent()
}
