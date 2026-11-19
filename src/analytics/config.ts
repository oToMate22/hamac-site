// ─────────────────────────────────────────────
// src/analytics/config.ts
// Constantes du socle de tracking OTOMATE (spécification v1.4.2).
// ─────────────────────────────────────────────

export const TRACKING_VERSION = 'otomate-1.4'

/**
 * Flux GA4 du site. Le conteneur GTM n'est pas chargé : ses balises publiées sont vides,
 * et le charger en plus de gtag doublerait les pages vues.
 */
export const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim()

export function isPrerender(): boolean {
  return typeof window !== 'undefined' && window.__PRERENDER__ === true
}

/** Le tracking n'existe que dans un vrai navigateur, hors pré-rendu, avec un flux GA4. */
export function trackingConfigured(): boolean {
  return typeof window !== 'undefined' && !isPrerender() && /^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)
}
