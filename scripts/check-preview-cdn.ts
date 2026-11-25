// Tests réels d'un déploiement Vercel (Preview d'abord) : CDN, cache, invalidation, SSR, image, sitemap,
// région, non-indexation. Lecture seule, sauf l'invalidation (POST signé, sans effet sur les données).
// Usage :
//   PREVIEW_BYPASS=<jeton> SYNC_HMAC_SECRET=<secret> npx tsx scripts/check-preview-cdn.ts https://<preview>.vercel.app [87634540]
// Les secrets sont lus dans l'environnement et ne sont jamais affichés.
import { signRequest } from '../supabase/functions/_shared/catalog/hmac.ts'
import { auditTags, readMetaTags } from './check-og-meta'
import { validateOgJpeg } from './og-images'

const base = (process.argv[2] ?? '').replace(/\/$/, '')
const id = process.argv[3] ?? '87634540'
if (!/^https:\/\//.test(base)) {
  console.error('Usage : npx tsx scripts/check-preview-cdn.ts https://<deploiement> [id]')
  process.exit(2)
}
const bypass = process.env.PREVIEW_BYPASS
const hmac = process.env.SYNC_HMAC_SECRET
const isProduction = /hamacpatrimoine\.com$/.test(new URL(base).hostname)

let failures = 0
function check(ok: boolean, label: string, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
}
const headers = (extra: Record<string, string> = {}) => ({
  'User-Agent': 'WhatsApp/2.23.20.0',
  ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
  ...extra,
})
const get = (path: string) => fetch(path.startsWith('http') ? path : `${base}${path}`, { headers: headers(), redirect: 'manual' })
const cacheOf = (res: Response) => res.headers.get('x-vercel-cache') ?? '—'
/** x-vercel-id : « <PoP>::<région de la fonction>::<id> » quand une fonction a répondu. */
const functionRegion = (res: Response) => (res.headers.get('x-vercel-id') ?? '').split('::').slice(-2, -1)[0] ?? '?'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 1. Fiche : rendu serveur, en-têtes, région, cache
const route = `/fr/acheter/${id}`
const first = await get(route)
const html = await first.text()
const tags = readMetaTags(html)
check(first.status === 200, `fiche ${id} : HTTP 200`, `${first.status}`)
check(auditTags(tags, `/acheter/${id}`).length === 0, 'balises OG/Twitter uniques et complètes', auditTags(tags, `/acheter/${id}`).join(', '))
check(html.includes(`<link rel="canonical" href="https://hamacpatrimoine.com${route}"`), 'canonical vers la production')
check(html.includes('id="ld-listing"') && (html.match(/<h1\b/g) ?? []).length === 1 && !html.includes('Chargement...'), 'contenu SSR complet (h1, JSON-LD, pas d’écran de chargement)')
check(functionRegion(first) === 'dub1' || cacheOf(first) === 'HIT', 'fonction exécutée en dub1', `x-vercel-id=${first.headers.get('x-vercel-id')}`)
if (!isProduction) {
  check((first.headers.get('x-robots-tag') ?? '').includes('noindex'), 'Preview non indexable (X-Robots-Tag)', first.headers.get('x-robots-tag') ?? 'absent')
}
await sleep(1500)
const second = await get(route)
await second.arrayBuffer()
check(['HIT', 'STALE', 'PRERENDER'].includes(cacheOf(second)), 'deuxième requête servie par le CDN', `${cacheOf(first)} → ${cacheOf(second)}`)

// 2. Image de partage
const og = tags.find((t) => t.key === 'og:image')?.content ?? ''
check(og.includes(`/fr/og/listings/${id}-`) || og.includes('hamac-og-1200x630'), 'og:image versionnée sur notre domaine', og)
const ogUrl = og.startsWith(base) || isProduction ? og : `${base}${new URL(og).pathname}`
const start = performance.now()
const image = await get(ogUrl)
const bytes = Buffer.from(await image.arrayBuffer())
const issues = image.status === 200 ? await validateOgJpeg(bytes) : [`HTTP ${image.status}`]
check(issues.length === 0, 'image JPEG 1200×630 valide', `${Math.round(bytes.length / 1024)} Ko, source ${image.headers.get('x-og-source') ?? '?'}, ${Math.round(performance.now() - start)} ms, cache ${cacheOf(image)}`)

// 3. Sitemap et catalogues
const sitemap = await get('/fr/sitemap.xml')
const xml = await sitemap.text()
check(sitemap.status === 200 && xml.includes(`/fr/acheter/${id}</loc>`), `sitemap dynamique contient ${id}`, `${(xml.match(/<loc>/g) ?? []).length} URL, cache ${cacheOf(sitemap)}`)
for (const path of ['/fr/acheter', '/fr/acheter?page=2', '/fr/louer']) {
  const res = await get(path)
  const body = await res.text()
  check(res.status === 200 && /href="\/fr\/(acheter|louer)\/\d+/.test(body), `${path} : 200, liens vers les fiches sans JavaScript`)
}
const robots = await (await get('/robots.txt')).text()
check(isProduction ? robots.includes('Allow: /') : robots.includes('Disallow: /'), `robots.txt ${isProduction ? 'autorise' : 'bloque'} l’indexation`)

// 4. Codes HTTP et protections
check((await get('/fr/acheter/10000001')).status === 404, 'identifiant inexistant → 404')
const unsigned = await fetch(`${base}/api/revalidate`, { method: 'POST', headers: headers(), body: '{"tags":["sitemap"]}' })
check(unsigned.status === 401, 'purge non signée refusée', `${unsigned.status}`)
const render = await fetch(`${base}/api/og-render`, { method: 'POST', headers: headers(), body: '{}' })
check(render.status === 401, 'génération non signée refusée', `${render.status}`)

// 5. Invalidation réelle (si le secret est fourni)
if (hmac) {
  const body = JSON.stringify({ tags: [`listing-${id}`] })
  const res = await fetch(`${base}/api/revalidate`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', ...(await signRequest(hmac, 'POST', '/api/revalidate', body)) }),
    body,
  })
  check(res.ok, 'purge signée acceptée', `${res.status}`)
  await sleep(3000)
  const after = await get(route)
  await after.arrayBuffer()
  check(['MISS', 'STALE', 'REVALIDATED', 'BYPASS'].includes(cacheOf(after)), 'après purge : page régénérée', `x-vercel-cache=${cacheOf(after)}`)
  await sleep(1500)
  const again = await get(route)
  await again.arrayBuffer()
  check(cacheOf(again) === 'HIT', 'puis de nouveau servie par le CDN', `x-vercel-cache=${cacheOf(again)}`)
} else {
  console.log('(invalidation non testée : SYNC_HMAC_SECRET absent de l’environnement)')
}

console.log(failures ? `\n${failures} écart(s)` : '\nDéploiement conforme')
process.exit(failures ? 1 : 0)
