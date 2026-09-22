import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SITEMAP_URL = 'https://hamacpatrimoine.com/sitemap-1.xml'
const VERCEL_PATH = path.join(ROOT, 'vercel.json')
const OUTPUT_JSON = path.join(ROOT, 'data/legacy-redirects.json')

const IDENTITY_PATHS = new Set([
  '/fr/',
  '/fr/acheter',
  '/fr/agence',
  '/fr/contact',
  '/fr/estimation',
  '/fr/mentions-legales',
  '/fr/vendre',
])

const FIXED_PAGES = new Map([
  ['/en/', '/fr/'],
  ['/en/agency', '/fr/agence'],
  ['/en/buy', '/fr/acheter'],
  ['/en/contact-us', '/fr/contact'],
  ['/en/estimate', '/fr/estimation'],
  ['/en/legal-notice', '/fr/mentions-legales'],
  ['/en/legals/fees', '/fr/honoraires'],
  ['/en/news/9567', '/fr/blog'],
  ['/en/news/9568', '/fr/blog'],
  ['/en/news/9569', '/fr/blog'],
  ['/en/not-found', '/fr/'],
  ['/en/rental-investments', '/fr/investir'],
  ['/en/sales', '/fr/acheter'],
  ['/en/selection', '/fr/off-market'],
  ['/en/sell', '/fr/vendre'],
  ['/en/stages-sell', '/fr/vendre'],
  ['/es/', '/fr/'],
  ['/es/aviso-legal', '/fr/mentions-legales'],
  ['/es/concepto', '/fr/agence'],
  ['/es/contacto-con-nosotros', '/fr/contact'],
  ['/es/estimaci%C3%B3n', '/fr/estimation'],
  ['/es/etapas-venta', '/fr/vendre'],
  ['/es/inversiones-en-alquiler', '/fr/investir'],
  ['/es/legals/fees', '/fr/honoraires'],
  ['/es/not-found', '/fr/'],
  ['/es/selecci%C3%B3n', '/fr/off-market'],
  ['/es/transacci%C3%B3n', '/fr/acheter'],
  ['/es/venta', '/fr/vendre'],
  ['/es/ventas', '/fr/acheter'],
  ['/fr/actualites/9567', '/fr/blog'],
  ['/fr/actualites/9568', '/fr/blog'],
  ['/fr/actualites/9569', '/fr/blog'],
  ['/fr/alerte-email', '/fr/contact'],
  ['/fr/biens-vendu', '/fr/acheter'],
  ['/fr/etapes-vente', '/fr/vendre'],
  ['/fr/investissement-locatif', '/fr/investir'],
  ['/fr/mentions-legales/honoraires', '/fr/honoraires'],
  ['/fr/not-found', '/fr/'],
  ['/fr/recherche', '/fr/acheter'],
  ['/fr/selection', '/fr/off-market'],
])

function loadEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name)
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  }
}

function encodePath(pathname) {
  const withSlash = pathname.endsWith('/') && pathname !== '/' ? pathname : pathname
  return withSlash
    .split('/')
    .map((segment) =>
      segment
        .split('+')
        .map((part) => {
          try {
            part = decodeURIComponent(part)
          } catch {
            /* keep */
          }
          return encodeURIComponent(part)
        })
        .join('+'),
    )
    .join('/')
}

function parseSitemapLocs(xml) {
  const locs = []
  const re = /<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/gs
  for (const match of xml.matchAll(re)) {
    locs.push(match[1].trim())
  }
  return locs
}

function toPathname(loc) {
  const url = new URL(loc)
  let pathname = url.pathname || '/'
  if (pathname.length > 1 && pathname.endsWith('/') && !['/fr/', '/en/', '/es/'].includes(pathname)) {
    pathname = pathname.slice(0, -1)
  }
  if (pathname === '/fr' || pathname === '/en' || pathname === '/es') pathname += '/'
  return encodePath(pathname)
}

function listingKindFromSlug(firstToken) {
  const token = firstToken.toLowerCase()
  if (['location', 'rental', 'alquiler'].includes(token)) return 'louer'
  return 'acheter'
}

function isPropertyPath(pathname) {
  return /\/(propriete|property|propiedad)\//.test(pathname)
}

async function fetchPublishedProperties() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anon) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY absents')
  }
  const res = await fetch(`${supabaseUrl}/functions/v1/apimo-proxy`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ route: 'properties' }),
  })
  if (!res.ok) throw new Error(`apimo-proxy HTTP ${res.status}`)
  const payload = await res.json()
  const list = payload.properties ?? payload.data?.properties ?? []
  const live = new Map()
  for (const property of list) {
    if (property.id == null) continue
    const isRental = property.price?.period !== null && property.price?.period !== undefined
    live.set(String(property.id), isRental ? 'louer' : 'acheter')
  }
  return live
}

function destinationFor(pathname, live) {
  if (IDENTITY_PATHS.has(pathname)) return null
  if (FIXED_PAGES.has(pathname)) return FIXED_PAGES.get(pathname)

  if (isPropertyPath(pathname)) {
    const slug = decodeURIComponent(pathname.split('/').pop() ?? '')
    const parts = slug.split('+')
    const id = parts.at(-1)
    const first = parts[0] ?? ''
    if (!id) throw new Error(`id Apimo introuvable : ${pathname}`)
    const liveKind = live.get(id)
    if (liveKind) return `/fr/${liveKind}/${id}`
    return `/fr/${listingKindFromSlug(first)}`
  }

  throw new Error(`URL sans règle : ${pathname}`)
}

loadEnvFiles()

const sitemapXml = await (await fetch(SITEMAP_URL)).text()
const locs = parseSitemapLocs(sitemapXml)
if (locs.length < 700) {
  throw new Error(`sitemap trop court : ${locs.length} URLs`)
}

const live = await fetchPublishedProperties()
console.log(`${live.size} biens publiés dans l'API`)

const redirects = []
const seen = new Set()
let identities = 0

for (const loc of locs) {
  const source = toPathname(loc)
  if (seen.has(source)) continue
  seen.add(source)
  const destination = destinationFor(source, live)
  if (!destination) {
    identities++
    continue
  }
  if (source === destination) {
    throw new Error(`boucle : ${source}`)
  }
  redirects.push({ source, destination, permanent: true })
}

redirects.sort((a, b) => a.source.localeCompare(b.source))

if (redirects.length !== 721) {
  throw new Error(`attendu 721 redirections, obtenu ${redirects.length} (identités : ${identities})`)
}

await mkdir(path.dirname(OUTPUT_JSON), { recursive: true })
await writeFile(OUTPUT_JSON, `${JSON.stringify(redirects, null, 2)}\n`)

const vercel = JSON.parse(await readFile(VERCEL_PATH, 'utf8'))
const routes = vercel.routes
vercel.redirects = [{ source: '/', destination: '/fr/', permanent: true }, ...redirects]
vercel.routes = routes
await writeFile(VERCEL_PATH, `${JSON.stringify(vercel, null, 2)}\n`)

console.log(`identités (pas de règle) : ${identities}`)
console.log(`redirections : ${redirects.length}`)
console.log(`vercel.json redirects : ${vercel.redirects.length}`)
