/** Largeur dans le nom de fichier du CDN Apimo : `…_2896-original.jpg`. */
const TAILLE_APIMO = /_\d+-original(\.(?:jpe?g|png))$/i

/**
 * Réécrit la largeur demandée au CDN Apimo. Le CDN n'agrandit jamais :
 * demander plus large que la source renvoie la source, donc pas d'image cassée.
 * Toute URL étrangère à media.apimo.pro est renvoyée telle quelle.
 */
export function imageApimo(url: string, largeur: number): string {
  if (!url || !url.includes('media.apimo.pro')) return url
  return url.replace(TAILLE_APIMO, (_m, ext: string) => `_${largeur}-original${ext}`)
}

/** `srcset` Apimo, ou `undefined` si l'image n'est pas chez Apimo. */
export function srcsetApimo(url: string, largeurs: number[]): string | undefined {
  if (!url || !url.includes('media.apimo.pro')) return undefined
  return largeurs.map((largeur) => `${imageApimo(url, largeur)} ${largeur}w`).join(', ')
}
