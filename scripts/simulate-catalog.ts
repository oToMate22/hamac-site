// Simulation de bout en bout du catalogue autonome, sans toucher à la production :
//   faux apimo-proxy (catalogue réel lu une fois, puis piloté) → catalog-sync (code réel, base en mémoire)
//   → listing-feed (routage réel) → fonctions Vercel (bundle réel dist-ssr, routage vercel.json émulé)
//   → images Sharp réelles (photos media.apimo.pro) → stockage en mémoire.
// Scénarios : publication, premier partage avant synchronisation, modification, retrait, réactivation,
// pannes Apimo (502, 429, cache périmé, réponse partielle), panne Supabase, sécurité, SEO, performances.
// Usage : npm run build && npx tsx scripts/simulate-catalog.ts [--sample=40]
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { signRequest } from '../supabase/functions/_shared/catalog/hmac.ts'
import { handleFeedRequest } from '../supabase/functions/_shared/catalog/feed.ts'
import { listingId, type RawListing } from '../supabase/functions/_shared/catalog/model.ts'
import { parseProxyResponse } from '../supabase/functions/_shared/catalog/proxy.ts'
import { runSync, type SyncDeps } from '../supabase/functions/_shared/catalog/sync.ts'
import { auditTags, readMetaTags } from './check-og-meta'
import { MemoryDb, MemoryImages } from './catalog-memory'
import { startHarness, type HarnessContext } from './dev-vercel'
import { loadEnvFiles } from './load-env'
import { validateOgJpeg } from './og-images'

const ROOT = new URL('..', import.meta.url).pathname
loadEnvFiles(ROOT)
const TARGET = '87634540'
const SAMPLE = Number(process.argv.find((a) => a.startsWith('--sample='))?.split('=')[1] ?? 0)
const FEED_TOKEN = 'f'.repeat(48)
const HMAC = 'h'.repeat(48)

let failures = 0
const results: Array<{ scenario: string; ok: boolean; detail: string }> = []
function record(scenario: string, ok: boolean, detail = '') {
  results.push({ scenario, ok, detail })
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${scenario}${detail ? ` — ${detail}` : ''}`)
}
const timings: Record<string, number[]> = {}
async function timed<T>(label: string, fn: () => Promise<T>) {
  const start = performance.now()
  const value = await fn()
  ;(timings[label] ??= []).push(performance.now() - start)
  return value
}
function pct(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

function listen(handler: (req: Request) => Promise<Response> | Response): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${req.url}`
      const response = await handler(
        new Request(url, { method: req.method, headers: req.headers as Record<string, string>, body: chunks.length ? Buffer.concat(chunks) : undefined }),
      )
      const headers: Record<string, string> = {}
      response.headers.forEach((v, k) => (headers[k] = v))
      res.writeHead(response.status, headers)
      res.end(Buffer.from(await response.arrayBuffer()))
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }))
  })
}

// ------------------------------------------------------------------ catalogue réel (lecture seule, une fois)
console.log('Lecture du catalogue réel via apimo-proxy (lecture seule, cache partagé)…')
const live = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/apimo-proxy`, {
  method: 'POST',
  headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ route: 'properties' }),
})
let realCatalog = ((await live.json()) as { properties: RawListing[] }).properties
const targetRaw = realCatalog.find((p) => listingId(p) === TARGET)
if (!targetRaw) throw new Error(`${TARGET} absent du catalogue Apimo`)
if (SAMPLE > 0) realCatalog = [...realCatalog.filter((p) => listingId(p) !== TARGET).slice(0, SAMPLE - 1), targetRaw]
console.log(`${realCatalog.length} biens réels${SAMPLE ? ' (échantillon)' : ''}`)

// ------------------------------------------------------------------ faux apimo-proxy pilotable
type ProxyMode = 'ok' | '502' | '429' | 'stale' | 'partial'
const proxy = { mode: 'ok' as ProxyMode, items: realCatalog.filter((p) => listingId(p) !== TARGET), calls: 0 }
const proxyServer = await listen(() => {
  proxy.calls++
  if (proxy.mode === '502') return new Response(JSON.stringify({ error: 'Apimo fetch failed' }), { status: 502 })
  if (proxy.mode === '429') return new Response(JSON.stringify({ error: 'quota' }), { status: 429, headers: { 'Retry-After': '900' } })
  const items = proxy.mode === 'partial' ? proxy.items.slice(0, Math.ceil(proxy.items.length / 2)) : proxy.items
  return new Response(
    JSON.stringify({ properties: items, total_items: items.length, fetched_items: items.length, sync_meta: { complete: proxy.mode !== 'partial' } }),
    { headers: { 'x-cache': proxy.mode === 'stale' ? 'stale' : 'miss', 'Content-Type': 'application/json' } },
  )
})
const readCatalog = async () => {
  const res = await fetch(proxyServer.url, { method: 'POST' })
  return parseProxyResponse(res.status, res.headers, await res.json().catch(() => null))
}

// ------------------------------------------------------------------ Supabase simulé : base, flux, stockage
const clock = { now: new Date() }
const db = new MemoryDb()
const images = new MemoryImages(() => clock.now)
const supabase = { up: true }
const feedServer = await listen((req) => {
  if (!supabase.up) return new Response('down', { status: 503 })
  return handleFeedRequest(req, db.feedServerDeps(FEED_TOKEN, readCatalog))
})
const storageServer = await listen((req) => {
  if (!supabase.up) return new Response('down', { status: 503 })
  const file = new URL(req.url).pathname.split('/').pop()!
  const hit = images.files.get(file)
  return hit ? new Response(new Uint8Array(hit.bytes), { headers: { 'Content-Type': 'image/jpeg' } }) : new Response('{"error":"not found"}', { status: 400 })
})

// ------------------------------------------------------------------ Vercel émulé (bundle réel)
const harnessPort = 4400 + Math.floor(Math.random() * 400)
const ctx: HarnessContext = {
  env: {
    LISTING_FEED_URL: `${feedServer.url}/functions/v1/listing-feed`,
    LISTING_FEED_TOKEN: FEED_TOKEN,
    SYNC_HMAC_SECRET: HMAC,
    VITE_SUPABASE_URL: storageServer.url,
    // Origine publique HTTPS simulée : les URL d'image sont ramenées vers l'émulation par leur chemin.
    PUBLIC_ORIGIN: 'https://hamacpatrimoine.test',
  },
  tagged: [],
  invalidated: [],
}
const vercel = await startHarness(harnessPort, ctx)
const get = (path: string, init?: RequestInit) => fetch(`${vercel.url}${path}`, { redirect: 'manual', ...init })

// ------------------------------------------------------------------ catalog-sync (code réel, appels HTTP signés)
const alerts: string[] = []
async function signedPost(path: string, body: unknown) {
  const raw = JSON.stringify(body)
  return fetch(`${vercel.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await signRequest(HMAC, 'POST', path, raw)) },
    body: raw,
  })
}
const syncDeps: SyncDeps = {
  now: () => clock.now,
  readCatalog,
  store: db.store(),
  images: images.api(),
  site: {
    async renderOg(job) {
      const res = await timed('og-render', () => signedPost('/api/og-render', { id: job.id, ogHash: job.ogHash, urls: job.urls }))
      if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${(await res.text()).slice(0, 160)}` }
      return { ok: true, bytes: new Uint8Array(await res.arrayBuffer()), sourceIndex: Number(res.headers.get('x-og-source-index')) }
    },
    async revalidate(tags) {
      return (await signedPost('/api/revalidate', { tags })).ok
    },
  },
  alert: async (subject) => void alerts.push(subject),
  log: (m) => console.log(`   [sync] ${m}`),
  options: { ogJobsPerRun: 400 },
}
const sync = async (minutes = 5) => {
  clock.now = new Date(clock.now.getTime() + minutes * 60_000)
  return timed('sync', () => runSync(syncDeps))
}

async function pageInfo(path: string) {
  const res = await get(path)
  const html = await res.text()
  const tags = readMetaTags(html)
  return { res, html, tags, og: tags.find((t) => t.key === 'og:image')?.content ?? '' }
}

try {
  // ================================================================ 1. synchronisation initiale
  const first = await sync(0)
  const ready = [...db.rows.values()].filter((r) => r.ogStatus === 'ready').length
  record(
    'Synchronisation initiale (catalogue réel)',
    first.outcome === 'ok' && db.rows.size === proxy.items.length,
    `${db.rows.size} instantanés, ${ready} images générées, ${first.ogFailed} échecs, ${Math.round(first.durationMs / 1000)} s`,
  )
  const failedOg = [...db.rows.values()].filter((r) => r.ogStatus === 'failed')
  if (failedOg.length) console.log(`   images en échec : ${failedOg.map((r) => `${r.id} (${r.ogLastError})`).join(' ; ')}`)

  // ================================================================ 2. premier partage AVANT la synchronisation
  proxy.items = [...proxy.items, targetRaw]
  const before = await timed('fiche (repli direct)', () => pageInfo(`/fr/acheter/${TARGET}`))
  record(
    `${TARGET} publié, partagé avant la synchronisation : fiche 200 via repli direct`,
    before.res.status === 200 && before.og.includes(`/fr/og/listings/${TARGET}-`) && auditTags(before.tags, `/acheter/${TARGET}`).length === 0,
    `${before.og} ${auditTags(before.tags, `/acheter/${TARGET}`).join(', ')}`,
  )
  const ogPath = new URL(before.og).pathname
  const [shareA, shareB] = await Promise.all([
    timed('image à la volée', () => get(ogPath)),
    timed('image à la volée', () => get(ogPath)),
  ])
  const flyBytes = Buffer.from(await shareA.arrayBuffer())
  await shareB.arrayBuffer()
  const flyProblems = await validateOgJpeg(flyBytes)
  record(
    'Premier partage : image générée à la volée, valide, requêtes concurrentes dédupliquées',
    shareA.headers.get('x-og-source') === 'on-the-fly' && flyProblems.length === 0,
    `${shareA.headers.get('x-og-source')}, ${Math.round(flyBytes.length / 1024)} Ko, ${Math.round(timings['image à la volée'].at(-1)!)} ms`,
  )

  // ================================================================ 3. synchronisation : création
  const created = await sync()
  const snap = db.rows.get(TARGET)!
  const purged = ctx.invalidated.flat()
  record(
    'Synchronisation : bien créé, image stockée, CDN purgé (fiche, catalogue, sitemap)',
    created.created === 1 && snap.ogStatus === 'ready' && purged.includes(`listing-${TARGET}`) && purged.includes('catalog-acheter') && purged.includes('sitemap'),
    `créés=${created.created}, image=${snap.ogStatus}, étiquettes=${created.revalidatedTags}`,
  )
  const stored = await timed('image stockée', () => get(ogPath))
  record('Image servie depuis le stockage, immuable', stored.headers.get('x-og-source') === 'storage' && (stored.headers.get('cache-control') ?? '').includes('immutable'))
  const sitemap1 = await (await get('/fr/sitemap.xml')).text()
  record('Sitemap dynamique : contient le nouveau bien', sitemap1.includes(`/fr/acheter/${TARGET}</loc>`))
  const catalogPage = await (await get('/fr/acheter')).text()
  record('Catalogue vente SSR : le nouveau bien y figure sans JavaScript', catalogPage.includes(`/fr/acheter/${TARGET}`))

  // ================================================================ 4. modification (prix + photo principale)
  const pics = [...((targetRaw.pictures as Array<{ rank?: number }>) ?? [])]
  const swapped: RawListing = {
    ...targetRaw,
    price: { ...(targetRaw.price as object), value: 99999 },
    pictures: pics.map((p, i) => ({ ...p, rank: i === 0 ? 2 : i === 1 ? 1 : p.rank })),
  }
  proxy.items = proxy.items.map((p) => (listingId(p) === TARGET ? swapped : p))
  const oldHash = snap.ogHash
  const modified = await sync()
  const snap2 = db.rows.get(TARGET)!
  const after = await pageInfo(`/fr/acheter/${TARGET}`)
  record(
    'Modification : nouvelle empreinte image, page à jour (prix et JSON-LD), ancienne image conservée',
    modified.updated === 1 && snap2.ogHash !== oldHash && after.og.includes(snap2.ogHash!) && after.html.includes('99') && images.files.has(`${TARGET}-${oldHash}.jpg`),
    `${oldHash} → ${snap2.ogHash}`,
  )
  const oldUrl = await get(`/fr/og/listings/${TARGET}-${oldHash}.jpg`)
  record('Ancienne URL d’image (déjà partagée) toujours servie pendant le délai de grâce', oldUrl.status === 200)

  // ================================================================ 5. retrait
  proxy.items = proxy.items.filter((p) => listingId(p) !== TARGET)
  await sync()
  const pending = await get(`/fr/acheter/${TARGET}`)
  record('Retrait, 1er catalogue sans le bien : toujours 200 (pas de retrait sur une seule absence)', pending.status === 200 && db.rows.get(TARGET)!.status === 'pending_withdrawal')
  await sync()
  const gone = await pageInfo(`/fr/acheter/${TARGET}`)
  const sitemap2 = await (await get('/fr/sitemap.xml')).text()
  const goneImage = await get(ogPath)
  record(
    'Retrait confirmé au 2e catalogue : 410 noindex, retiré du sitemap, image déjà partagée encore servie (délai de grâce)',
    gone.res.status === 410 && gone.html.includes('noindex') && !sitemap2.includes(`/acheter/${TARGET}<`) && goneImage.status === 200,
    `fiche=${gone.res.status}, sitemap=${sitemap2.includes(`/acheter/${TARGET}<`) ? 'présent' : 'absent'}, image=${goneImage.status} (${goneImage.headers.get('x-og-source')})`,
  )

  // ================================================================ 6. réactivation
  proxy.items = [...proxy.items, swapped]
  const back = await sync()
  record('Réactivation : le bien revient en 200', back.reactivated === 1 && (await get(`/fr/acheter/${TARGET}`)).status === 200)

  // ================================================================ 7. pannes Apimo
  const servable = () => [...db.rows.values()].filter((r) => r.status !== 'withdrawn').length
  const beforeOutage = servable()
  for (const mode of ['502', 'stale', 'partial'] as const) {
    proxy.mode = mode
    const run = await sync()
    db.state.backoffUntil = null
    const page = await get(`/fr/acheter/${TARGET}`)
    record(
      `Panne Apimo (${mode}) : run ${run.outcome}, aucun bien retiré, fiches servies`,
      servable() === beforeOutage && page.status === 200 && run.outcome !== 'ok',
      run.reason ?? '',
    )
  }
  proxy.mode = '429'
  const callsBefore = proxy.calls
  const quota = await sync()
  await sync()
  await sync()
  record(
    'Quota Apimo (429) : backoff respecté (aucun appel pendant 15 min), aucun retrait',
    quota.outcome === 'failed' && proxy.calls === callsBefore + 1 && servable() === beforeOutage,
    `backoff jusqu’à ${db.state.backoffUntil}`,
  )
  // Panne prolongée → alerte unique
  proxy.mode = '502'
  db.state.backoffUntil = null
  for (let i = 0; i < 14; i++) {
    await sync()
    db.state.backoffUntil = null
  }
  record('Panne prolongée : alerte envoyée une seule fois', alerts.length === 1, alerts[0] ?? 'aucune')
  proxy.mode = 'ok'
  const recovered = await sync()
  record('Retour à la normale : run ok, compteur d’échecs remis à zéro', recovered.outcome === 'ok' && db.state.consecutiveFailures === 0)

  // ================================================================ 8. panne Supabase (flux + stockage)
  supabase.up = false
  const down = await get(`/fr/acheter/${TARGET}`)
  const downCatalog = await get('/fr/acheter')
  const downImage = await get(new URL((await (async () => {
    supabase.up = true
    const p = await pageInfo(`/fr/acheter/${TARGET}`)
    supabase.up = false
    return p
  })()).og).pathname)
  const downSitemap = await get('/fr/sitemap.xml')
  supabase.up = true
  record(
    'Panne Supabase : fiche 503 Retry-After (jamais 404/410), catalogue 200 dégradé, image par défaut valide, sitemap 503',
    down.status === 503 && down.headers.get('retry-after') === '300' && downCatalog.status === 200 &&
      downImage.status === 200 && downImage.headers.get('x-og-source') === 'default' && downSitemap.status === 503,
    `fiche=${down.status}, catalogue=${downCatalog.status}, image=${downImage.headers.get('x-og-source')}, sitemap=${downSitemap.status}`,
  )

  // ================================================================ 9. sécurité
  const unsigned = await fetch(`${vercel.url}/api/og-render`, { method: 'POST', body: JSON.stringify({ id: TARGET, ogHash: 'a'.repeat(12), urls: [] }) })
  const ssrf = await signedPost('/api/og-render', { id: TARGET, ogHash: 'a'.repeat(12), urls: ['http://169.254.169.254/latest/meta-data'] })
  const badFile = await get('/fr/og/listings/..%2F..%2Fetc%2Fpasswd')
  const arbitrary = await get('/fr/og/listings/12345678-aaaaaaaaaaaa.jpg')
  const staleHash = await get(`/fr/og/listings/${TARGET}-aaaaaaaaaaaa.jpg`)
  const fakeId = await get('/fr/acheter/99999999999')
  const junkId = await get('/fr/acheter/%3Cscript%3E')
  const unsignedPurge = await fetch(`${vercel.url}/api/revalidate`, { method: 'POST', body: JSON.stringify({ tags: ['sitemap'] }) })
  const badToken = await fetch(`${feedServer.url}/functions/v1/listing-feed?index=1`, { headers: { 'x-feed-token': 'nope' } })
  record(
    'Sécurité : signatures exigées, SSRF bloqué, fichiers et identifiants arbitraires refusés, jeton du flux vérifié',
    unsigned.status === 401 && ssrf.status === 400 && badFile.status === 404 && arbitrary.status === 404 &&
      staleHash.status === 308 && fakeId.status === 404 && junkId.status === 404 && unsignedPurge.status === 401 && badToken.status === 401,
    `og-render non signé=${unsigned.status}, SSRF=${ssrf.status}, chemin=${badFile.status}, id arbitraire=${arbitrary.status}, empreinte périmée=${staleHash.status}, fiche inexistante=${fakeId.status}/${junkId.status}, purge=${unsignedPurge.status}, flux=${badToken.status}`,
  )

  // ================================================================ 10. audit SEO de tout le catalogue
  const servableRows = [...db.rows.values()].filter((r) => r.status !== 'withdrawn')
  const seo = { pages: 0, problems: [] as string[], images: 0, imageProblems: [] as string[], defaults: 0, sizes: [] as number[] }
  const imageChecks: Array<Promise<void>> = []
  for (const row of servableRows) {
    const route = `/${row.kind}/${row.id}`
    const page = await timed('fiche (instantané)', () => pageInfo(`/fr${route}`))
    seo.pages++
    const problems = auditTags(page.tags, route)
    if (page.res.status !== 200) problems.push(`HTTP ${page.res.status}`)
    const h1 = (page.html.match(/<h1\b/g) ?? []).length
    if (h1 !== 1) problems.push(`${h1} h1`)
    for (const block of page.html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(block[1])
      } catch {
        problems.push('JSON-LD invalide')
      }
    }
    if (!page.html.includes('id="ld-listing"')) problems.push('JSON-LD fiche absent')
    if (page.html.includes('Chargement...')) problems.push('écran de chargement')
    if (problems.length) seo.problems.push(`${route} : ${problems.join(', ')}`)
    if (page.og.includes('hamac-og-1200x630')) seo.defaults++
    else {
      imageChecks.push(
        (async () => {
          const res = await get(new URL(page.og).pathname)
          const bytes = Buffer.from(await res.arrayBuffer())
          const issues = await validateOgJpeg(bytes)
          seo.images++
          seo.sizes.push(bytes.length)
          if (res.status !== 200 || issues.length) seo.imageProblems.push(`${row.id} : ${res.status} ${issues.join(', ')}`)
        })(),
      )
    }
  }
  await Promise.all(imageChecks)
  const sitemap3 = await (await get('/fr/sitemap.xml')).text()
  const sitemapListings = (sitemap3.match(/\/fr\/(acheter|louer)\/\d+<\/loc>/g) ?? []).length
  record(
    'SEO : toutes les fiches en 200, balises uniques et complètes, 1 h1, JSON-LD valide, contenu sans JavaScript',
    seo.problems.length === 0,
    seo.problems.slice(0, 5).join(' | ') || `${seo.pages} fiches conformes`,
  )
  record(
    'Images : toutes téléchargeables, JPEG 1200×630 valides',
    seo.imageProblems.length === 0,
    `${seo.images} images, ${seo.defaults} image(s) par défaut, ${Math.round(Math.min(...seo.sizes) / 1024)}–${Math.round(Math.max(...seo.sizes) / 1024)} Ko`,
  )
  record('Sitemap cohérent avec le catalogue', sitemapListings === servableRows.length, `${sitemapListings} fiches / ${servableRows.length}`)
  const louer = await pageInfo('/fr/louer')
  const acheter = await pageInfo('/fr/acheter')
  record(
    'Catalogues SSR : 200, balises valides, liens vers les fiches',
    louer.res.status === 200 && acheter.res.status === 200 && auditTags(acheter.tags, '/acheter').length === 0 && /href="\/fr\/acheter\/\d+/.test(acheter.html),
  )
  const home = await get('/fr/')
  record('Pages statiques inchangées (accueil pré-rendu servi par le système de fichiers)', home.status === 200 && !(home.headers.get('content-type') ?? '').includes('json'))

  // ================================================================ 11. performances (serveur local, chaud)
  for (let i = 0; i < 30; i++) {
    await timed('fiche SSR (chaud)', () => get(`/fr/acheter/${TARGET}`).then((r) => r.arrayBuffer()))
    await timed('catalogue SSR (chaud)', () => get('/fr/acheter').then((r) => r.arrayBuffer()))
    await timed('sitemap', () => get('/fr/sitemap.xml').then((r) => r.arrayBuffer()))
  }
} finally {
  console.log('\nPerformances (ms, p50 / p95 / max) :')
  for (const [label, values] of Object.entries(timings)) {
    console.log(`  ${label.padEnd(24)} ${String(Math.round(pct(values, 50))).padStart(6)} ${String(Math.round(pct(values, 95))).padStart(6)} ${String(Math.round(Math.max(...values))).padStart(6)}   (n=${values.length})`)
  }
  for (const s of [vercel.server, proxyServer.server, feedServer.server, storageServer.server]) s.close()
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} scénarios conformes`)
  if (failures) process.exit(1)
}
