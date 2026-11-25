// Fiche bien rendue côté serveur (voir server/pages.tsx). Réécriture : /fr/{acheter|louer}/:id
import { addCacheTag } from '@vercel/functions'
import { handleListing } from '../dist-ssr/pages.js'

export function GET(request) {
  return handleListing(request, { addCacheTag })
}
