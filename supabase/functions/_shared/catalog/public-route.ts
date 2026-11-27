// Routage public d'apimo-proxy : seule l'action « properties » (catalogue publié) existe.
// Les anciennes actions (agences, sondage, fiche par identifiant, statut libre, refresh, paramètres
// relayés à Apimo) sont refusées : elles permettaient de lire des biens non publiés ou de vider le cache.

/** Vrai seulement pour GET …/apimo-proxy/properties ou POST { route: 'properties' }. */
export function isCatalogRoute(method: string, pathname: string, body: unknown): boolean {
  if (method === 'GET') {
    const path = pathname.replace(/\/+$/, '')
    return /(^|\/)apimo-proxy\/properties$/.test(path) || path === '/properties' || path === 'properties'
  }
  if (method === 'POST') {
    const route = body && typeof body === 'object' ? (body as Record<string, unknown>).route : undefined
    return typeof route === 'string' && route.replace(/^\/+|\/+$/g, '') === 'properties'
  }
  return false
}
