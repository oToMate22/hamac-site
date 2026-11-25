// Purge du CDN par étiquette, appelée par catalog-sync (requête signée HMAC). Voir server/pages.tsx.
import { invalidateByTag } from '@vercel/functions'
import { handleRevalidate } from '../dist-ssr/pages.js'

export function POST(request) {
  return handleRevalidate(request, { invalidateByTag })
}
