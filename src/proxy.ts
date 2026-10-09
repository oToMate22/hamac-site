import { next } from '@vercel/functions'
import apimoRoutes from '../data/apimo-routes.json' with { type: 'json' }

const FICHE = /^\/(fr|en|es)\/(propriete|property|propiedad)\/(.+)$/
const ID = /^\d{5,12}$/
const RENTAL_PREFIX = /^(location|rental|alquiler)$/i

const ES_PAGES: Record<string, string> = {
  '/es/estimación': '/fr/estimation',
  '/es/selección': '/fr/off-market',
  '/es/transacción': '/fr/acheter',
}

const liveById = new Map<string, 'acheter' | 'louer'>()
for (const route of apimoRoutes.routes) {
  const match = route.match(/^\/(acheter|louer)\/(\d+)$/)
  if (match) liveById.set(match[2], match[1] as 'acheter' | 'louer')
}

function decodePathname(pathname: string) {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

function stripSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

function listingPath(slug: string) {
  const prefix = slug.split('+')[0] ?? ''
  return RENTAL_PREFIX.test(prefix) ? '/fr/louer' : '/fr/acheter'
}

function redirect(fromPath: string, toPath: string, search: string) {
  if (toPath === fromPath) return next()
  return new Response(null, {
    status: 308,
    headers: { Location: `${toPath}${search}` },
  })
}

export default function proxy(request: Request) {
  const url = new URL(request.url)
  const pathname = stripSlash(decodePathname(url.pathname))
  const search = url.search

  const esPage = ES_PAGES[pathname]
  if (esPage) return redirect(pathname, esPage, search)

  const fiche = pathname.match(FICHE)
  if (fiche) {
    const slug = fiche[3]
    const lastPlus = slug.lastIndexOf('+')
    const id = lastPlus >= 0 ? slug.slice(lastPlus + 1) : slug
    if (ID.test(id)) {
      const kind = liveById.get(id)
      const destination = kind ? `/fr/${kind}/${id}` : listingPath(slug)
      return redirect(pathname, destination, search)
    }
    return redirect(pathname, listingPath(slug), search)
  }

  return next()
}
