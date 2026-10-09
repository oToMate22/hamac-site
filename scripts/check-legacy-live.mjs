#!/usr/bin/env node
/** Rejoue le sitemap de l'ancien site contre une base (prod Vercel par défaut). */

const SITEMAP = 'https://hamacpatrimoine.com/sitemap-1.xml'
const DEFAULT_BASE = 'https://hamac-site.vercel.app'
const CONCURRENCY = 10

const base = (process.argv[2] || DEFAULT_BASE).replace(/\/$/, '')

function pathnameOf(loc) {
  try {
    return new URL(loc.trim()).pathname
  } catch {
    return loc.trim()
  }
}

function resolveLocation(location, origin) {
  if (!location) return null
  try {
    return new URL(location, origin)
  } catch {
    return null
  }
}

async function fetchSitemapPaths() {
  const res = await fetch(SITEMAP)
  if (!res.ok) throw new Error(`sitemap HTTP ${res.status}`)
  const xml = await res.text()
  const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim())
  if (locs.length === 0) throw new Error('sitemap : aucune <loc>')
  return locs.map(pathnameOf)
}

async function probe(pathname) {
  const first = await fetch(`${base}${pathname}`, { redirect: 'manual' })
  const status = first.status
  if (status < 300 || status >= 400) {
    return { pathname, status, hops: 0, location: null, second: null, self: false }
  }
  const location = first.headers.get('location')
  const target = resolveLocation(location, base)
  const destPath = target ? stripSlash(target.pathname) : location
  const self = destPath === stripSlash(pathname)
  const hops = 1
  if (!target) return { pathname, status, hops, location, second: null, self }
  const secondRes = await fetch(target.href, { redirect: 'manual' })
  const second = secondRes.status
  const extraHop = second >= 300 && second < 400
  return { pathname, status, hops: extraHop ? 2 : 1, location: destPath, second, self }
}

function stripSlash(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length)
  let i = 0
  async function run() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await worker(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return out
}

const paths = await fetchSitemapPaths()
console.log(`${paths.length} URLs dans ${SITEMAP}`)
console.log(`cible ${base}`)

const results = await mapPool(paths, CONCURRENCY, probe)

const counts = { 308: 0, 301: 0, 200: 0, 404: 0, other: 0 }
const failures = []
for (const row of results) {
  if (row.status === 308) counts[308]++
  else if (row.status === 301) counts[301]++
  else if (row.status === 200) counts[200]++
  else if (row.status === 404) counts[404]++
  else counts.other++

  if (row.status === 404) failures.push({ ...row, why: '404' })
  else if (row.hops > 1) failures.push({ ...row, why: 'chaine>1' })
  else if (row.self) failures.push({ ...row, why: 'self' })
}

console.log(
  `308 ${counts[308]} · 301 ${counts[301]} · 200 ${counts[200]} · 404 ${counts[404]} · autre ${counts.other}`,
)

const witnesses = [
  ['/es/estimaci%C3%B3n', '/fr/estimation'],
  ['/es/selecci%C3%B3n', '/fr/off-market'],
  ['/es/transacci%C3%B3n', '/fr/acheter'],
  [
    '/fr/propriete/vente+appartement+sainte-foy-les-lyon+sainte-foy-les-lyon-plein-bourg-appartement-91-m-avec-terrasse-a-renover+82847594',
    '/fr/acheter/82847594',
  ],
]
for (const [source, expected] of witnesses) {
  const row = await probe(source)
  const ok = row.status === 308 && row.location === expected && row.hops === 1 && !row.self
  console.log(`${ok ? 'ok' : 'KO'} ${source} → ${row.status} ${row.location ?? ''} (attendu ${expected})`)
  if (!ok) failures.push({ ...row, why: 'temoin', pathname: source })
}

const unknown = await fetch(`${base}/fr/route-inexistante-42`, { redirect: 'manual' })
console.log(`/fr/route-inexistante-42 → ${unknown.status} (attendu 404)`)
if (unknown.status !== 404) failures.push({ pathname: '/fr/route-inexistante-42', why: '404-site', status: unknown.status })

if (failures.length) {
  console.error(`${failures.length} échec(s)`)
  for (const row of failures.slice(0, 40)) {
    console.error(`  ${row.why} ${row.pathname} ${row.status} ${row.location ?? ''}`)
  }
  if (failures.length > 40) console.error(`  … +${failures.length - 40}`)
  process.exit(1)
}

console.log('accepté : 0 × 404, 0 chaîne > 1, 0 auto-redirection')
