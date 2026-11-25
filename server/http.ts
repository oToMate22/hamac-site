// Politique de cache et réponses HTTP des pages dynamiques.
//
// Navigateur : toujours revalidé (max-age=0). CDN Vercel : 1 h, invalidé par étiquette dès qu'un bien
// change (catalog-sync → /api/revalidate), et resservi périmé pendant 7 jours si la fonction échoue
// ou pendant sa régénération : une panne Supabase/Apimo n'efface jamais une fiche du cache.

export type CacheProfile = 'page' | 'not-found' | 'gone' | 'redirect' | 'immutable' | 'short' | 'none'

const CDN: Record<CacheProfile, string | null> = {
  page: 'max-age=3600, stale-while-revalidate=604800, stale-if-error=604800',
  'not-found': 'max-age=300',
  gone: 'max-age=3600, stale-while-revalidate=86400',
  redirect: 'max-age=3600',
  immutable: 'max-age=31536000, immutable',
  short: 'max-age=60',
  none: null,
}

export function cacheHeaders(profile: CacheProfile): Record<string, string> {
  if (profile === 'none') return { 'Cache-Control': 'no-store' }
  if (profile === 'immutable') return { 'Cache-Control': 'public, max-age=31536000, immutable' }
  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': CDN[profile]!,
    'Vercel-CDN-Cache-Control': CDN[profile]!,
  }
}

export function htmlResponse(html: string, status: number, profile: CacheProfile, extra: Record<string, string> = {}) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...cacheHeaders(profile), ...extra },
  })
}

export function redirectResponse(location: string, status = 308) {
  return new Response(null, { status, headers: { Location: location, ...cacheHeaders('redirect') } })
}

/** Panne du flux sans copie en cache : 503 temporaire (jamais 404/410, qui désindexeraient). */
export function unavailableResponse(message = 'Service temporairement indisponible') {
  return new Response(message, {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300', ...cacheHeaders('none') },
  })
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cacheHeaders('none') } })
}

/** Hors production Vercel (Preview, développement) : interdiction d'indexer, en plus de la protection Vercel. */
export function robotsHeaders(env: Record<string, string | undefined>): Record<string, string> {
  return env.VERCEL_ENV === 'production' ? {} : { 'X-Robots-Tag': 'noindex, nofollow' }
}

/** Ajoute les en-têtes anti-indexation à une réponse existante. */
export function withRobots(response: Response, env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(robotsHeaders(env))) response.headers.set(key, value)
  return response
}
