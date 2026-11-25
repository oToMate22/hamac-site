// Fiches, catalogues et sitemap dynamiques (fonctions Vercel) : activé par défaut.
// DYNAMIC_LISTINGS=0 restaure l'ancien mode statique (pré-rendu au build), sans toucher au code.
export const DYNAMIC_LISTINGS = process.env.DYNAMIC_LISTINGS !== '0'

/** Routes servies par les fonctions en mode dynamique : ne pas les pré-rendre (le fichier statique masquerait la réécriture). */
export function isDynamicRoute(route: string) {
  return route === '/acheter' || route === '/louer' || /^\/(acheter|louer)\/[^/]+$/.test(route)
}
