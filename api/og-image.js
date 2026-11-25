// Image de partage d'une fiche (voir server/og.ts). Réécriture : /fr/og/listings/:file
import { handleOgImage } from '../dist-ssr/og.js'

export function GET(request) {
  return handleOgImage(request)
}
