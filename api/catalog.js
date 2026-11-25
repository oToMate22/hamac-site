// Catalogues vente / location rendus côté serveur (voir server/pages.tsx). Réécriture : /fr/{acheter|louer}
import { addCacheTag } from '@vercel/functions'
import { handleCatalog } from '../dist-ssr/pages.js'

export function GET(request) {
  return handleCatalog(request, { addCacheTag })
}
