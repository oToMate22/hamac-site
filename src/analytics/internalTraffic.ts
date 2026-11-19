// ─────────────────────────────────────────────
// src/analytics/internalTraffic.ts
// Marquage des navigateurs de l'agence (spécification §1.3), sans adresse IP.
//   ?otomate_internal=on  → ce navigateur envoie traffic_type=internal
//   ?otomate_internal=off → marquage retiré
// Le paramètre est retiré de l'URL et n'est jamais transmis à GA4.
// L'exclusion n'est effective qu'avec le filtre de données GA4 « Internal Traffic » actif.
// ─────────────────────────────────────────────

const STORAGE_KEY = 'otomate_internal'
const URL_PARAM = 'otomate_internal'

export function applyInternalTrafficParam() {
  const url = new URL(location.href)
  const value = url.searchParams.get(URL_PARAM)
  if (value === null) return
  try {
    if (value === 'on') localStorage.setItem(STORAGE_KEY, '1')
    if (value === 'off') localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* stockage indisponible : marquage impossible */
  }
  url.searchParams.delete(URL_PARAM)
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export function trafficType(): 'internal' | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1' ? 'internal' : undefined
  } catch {
    return undefined
  }
}
