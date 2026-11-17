// ─────────────────────────────────────────────
// src/analytics/config.ts
// Constantes du socle de tracking OTOMATE (spécification v1.4.2).
// ─────────────────────────────────────────────

export const TRACKING_VERSION = 'otomate-1.4'

/** Container GTM dédié au site. Sans ID, aucun tracking n'est chargé. */
export const GTM_ID = String(import.meta.env.VITE_GTM_ID ?? '').trim()

/**
 * Flux GA4 (G-KCHSLFNCBR). GA4 est configuré dans GTM : cet ID ne sert ici
 * qu'au drapeau `ga-disable-<ID>` et à la purge des cookies `_ga_<ID>`.
 */
export const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim()

export function isPrerender(): boolean {
  return typeof window !== 'undefined' && window.__PRERENDER__ === true
}

/** Le tracking ne peut exister que dans un vrai navigateur, hors pré-rendu, avec un container. */
export function trackingConfigured(): boolean {
  return typeof window !== 'undefined' && !isPrerender() && /^GTM-[A-Z0-9]+$/.test(GTM_ID)
}
