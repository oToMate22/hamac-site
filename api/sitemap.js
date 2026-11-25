// Sitemap dynamique, cohérent avec Apimo (voir server/pages.tsx). Réécriture : /fr/sitemap.xml
import { addCacheTag } from '@vercel/functions'
import { handleSitemap } from '../dist-ssr/pages.js'

export function GET(request) {
  return handleSitemap(request, { addCacheTag })
}
