// Génération signée d'une image de partage pour catalog-sync (voir server/og.ts).
import { handleOgRender } from '../dist-ssr/og.js'

export function POST(request) {
  return handleOgRender(request)
}
