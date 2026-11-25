// Tests unitaires du catalogue dynamique (synchronisation, flux, signatures, rendu serveur).
// Usage : npx tsx scripts/catalog-sync.test.ts   (le bloc « rendu serveur » exige `npm run build`)
import { existsSync } from 'node:fs'
import { backoffSeconds, decide, ogOutcome, type CatalogRead, type Snapshot } from '../supabase/functions/_shared/catalog/decide.ts'
import { feedItem, handleFeedRequest } from '../supabase/functions/_shared/catalog/feed.ts'
import { signRequest, tokenMatches, verifyRequest } from '../supabase/functions/_shared/catalog/hmac.ts'
import {
  candidatePhotoUrls,
  computeOgHash,
  isAllowedPhotoUrl,
  listingKind,
  payloadHash,
  type RawListing,
} from '../supabase/functions/_shared/catalog/model.ts'
import { parseProxyResponse } from '../supabase/functions/_shared/catalog/proxy.ts'
import { runSync, type SyncDeps } from '../supabase/functions/_shared/catalog/sync.ts'
import { MemoryDb, MemoryImages } from './catalog-memory'

let failures = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`ok   ${name}`)
  } catch (error) {
    failures++
    console.error(`FAIL ${name} : ${(error as Error).message}`)
  }
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const photo = (n: number) => `https://media.apimo.pro/cache/${String(n).padStart(32, '0')}_x-original.jpg`
function listing(id: number, extra: Partial<RawListing> = {}): RawListing {
  return {
    id,
    updated_at: '2026-11-25 10:00:00',
    price: { value: 300000, period: null } as RawListing['price'],
    pictures: [
      { url: photo(id), rank: 1, internet: 1 },
      { url: photo(id + 1), rank: 2, internet: 1 },
    ],
    ...extra,
  }
}
const catalog = (items: RawListing[], extra: Partial<Extract<CatalogRead, { ok: true }>> = {}): CatalogRead => ({
  ok: true,
  items,
  complete: true,
  fresh: true,
  source: 'miss',
  ...extra,
})
const base = Array.from({ length: 20 }, (_, i) => listing(87000000 + i * 10))
const T0 = new Date('2026-11-26T10:00:00Z')

async function snapshotsFrom(items: RawListing[]): Promise<Snapshot[]> {
  const decision = await decide([], catalog(items), T0)
  return decision.upserts.map(({ payload: _p, change: _c, ...snap }) => ({ ...snap, ogStatus: 'ready' as const }))
}

// ---------------------------------------------------------------------------- modèle
await test('rubrique : une période de prix = location', () => {
  check(listingKind(listing(1, { price: { period: 1 } } as never)) === 'louer', 'location')
  check(listingKind(listing(1)) === 'acheter', 'vente')
})

await test('photos candidates : rang, flag internet, hôte autorisé uniquement', () => {
  const urls = candidatePhotoUrls({
    pictures: [
      { url: photo(3), rank: 3 },
      { url: photo(1), rank: 1 },
      { url: photo(2), rank: 2, internet: 0 },
      { url: 'https://evil.example/x.jpg', rank: 0 },
      { url: 'http://media.apimo.pro/insecure.jpg', rank: 0 },
    ],
  })
  check(urls.join() === [photo(1), photo(3)].join(), urls.join())
  check(!isAllowedPhotoUrl('https://user:pw@media.apimo.pro/x.jpg'), 'identifiants dans l’URL refusés')
})

await test('empreinte image : déterministe, change avec la photo (vecteur de test Deno/Node)', async () => {
  const a = await computeOgHash([photo(1), photo(2)])
  check(a === (await computeOgHash([photo(1), photo(2)])), 'instable')
  check(a !== (await computeOgHash([photo(9), photo(2)])), 'ne change pas')
  check(/^[0-9a-f]{12}$/.test(a!), a!)
  check((await computeOgHash([])) === null, 'sans photo')
  // Vecteur figé : toute modification de l’algorithme doit être volontaire (OG_GENERATOR_VERSION).
  check(a === '83337ad8971b', `vecteur figé : ${a}`)
})

await test('payloadHash insensible à l’ordre des clés', async () => {
  check((await payloadHash({ a: 1, b: { c: 2, d: 3 } })) === (await payloadHash({ b: { d: 3, c: 2 }, a: 1 })), 'ordre')
})

// ---------------------------------------------------------------------------- lecture apimo-proxy
await test('apimo-proxy : complet, partiel, cache périmé, 429', () => {
  const ok = parseProxyResponse(200, new Headers({ 'x-cache': 'miss' }), { properties: [listing(87000001)], sync_meta: { complete: true } })
  check(ok.ok && ok.complete && ok.fresh, 'complet')
  const partial = parseProxyResponse(200, new Headers({ 'x-cache': 'miss' }), { properties: [], total_items: 120, fetched_items: 100 })
  check(partial.ok && !partial.complete, 'partiel déduit des compteurs')
  const stale = parseProxyResponse(200, new Headers({ 'x-cache': 'stale' }), { properties: [listing(87000001)] })
  check(stale.ok && !stale.fresh, 'périmé')
  const quota = parseProxyResponse(429, new Headers({ 'retry-after': '120' }), {})
  check(!quota.ok && quota.status === 429 && quota.retryAfterSeconds === 120, 'quota')
  const quotaInBody = parseProxyResponse(200, new Headers(), { status: 429 })
  check(!quotaInBody.ok && quotaInBody.status === 429, 'quota dans le corps')
})

// ---------------------------------------------------------------------------- décisions
await test('publication : nouveau bien → upsert, image à produire, étiquettes', async () => {
  const prev = await snapshotsFrom(base)
  const fresh = listing(87634540)
  const d = await decide(prev, catalog([...base, fresh]), T0)
  check(d.trustworthy, 'fiable')
  check(d.stats.created === 1, `créés ${d.stats.created}`)
  check(d.ogJobs.length === 1 && d.ogJobs[0].id === '87634540', 'job image')
  check(d.tags.includes('listing-87634540') && d.tags.includes('catalog-acheter') && d.tags.includes('sitemap'), d.tags.join())
})

await test('modification de prix : mise à jour sans nouvelle image ; changement de photo : nouvelle empreinte', async () => {
  const prev = await snapshotsFrom(base)
  const priced = base.map((l, i) => (i === 0 ? { ...l, price: { value: 1, period: null } } : l))
  const d1 = await decide(prev, catalog(priced), T0)
  check(d1.stats.updated === 1 && d1.ogJobs.length === 0, 'prix seul')
  const rephoto = base.map((l, i) => (i === 0 ? { ...l, pictures: [{ url: photo(5), rank: 1 }] } : l))
  const d2 = await decide(prev, catalog(rephoto), T0)
  const row = d2.upserts.find((u) => u.id === String(base[0].id))!
  check(row.ogHash !== prev[0].ogHash && row.ogStatus === 'pending' && d2.ogJobs.length === 1, 'photo')
})

await test('retrait : pas au 1er catalogue sans le bien, retiré au 2e', async () => {
  let prev = await snapshotsFrom(base)
  const without = base.slice(1)
  const d1 = await decide(prev, catalog(without), T0)
  const gone1 = d1.missing.find((m) => m.id === String(base[0].id))!
  check(gone1.status === 'pending_withdrawal' && gone1.missingRuns === 1 && d1.stats.withdrawn === 0, '1er run')
  prev = prev.map((s) => (s.id === gone1.id ? gone1 : s))
  const d2 = await decide(prev, catalog(without), T0)
  const gone2 = d2.missing.find((m) => m.id === String(base[0].id))!
  check(gone2.status === 'withdrawn' && gone2.withdrawnAt && d2.tags.includes(`listing-${gone2.id}`), '2e run')
})

await test('réapparition après une absence ponctuelle : le compteur repart à zéro', async () => {
  const prev = (await snapshotsFrom(base)).map((s, i) => (i === 0 ? { ...s, status: 'pending_withdrawal' as const, missingRuns: 1 } : s))
  const d = await decide(prev, catalog(base), T0)
  const back = d.upserts.find((u) => u.id === String(base[0].id))!
  check(back.status === 'active' && back.missingRuns === 0, 'réactivé')
})

for (const [label, read] of [
  ['catalogue partiel', catalog(base.slice(5), { complete: false })],
  ['cache périmé (Apimo en panne)', catalog(base.slice(5), { fresh: false })],
  ['baisse anormale (> 20 %)', catalog(base.slice(10))],
  ['catalogue vide', catalog([])],
] as const) {
  await test(`aucun retrait sur ${label}`, async () => {
    const prev = await snapshotsFrom(base)
    const d = await decide(prev, read, T0)
    check(!d.trustworthy && d.missing.length === 0 && d.stats.withdrawn === 0, `${d.reason}`)
  })
}

await test('erreur Apimo / 429 : aucune écriture', async () => {
  const d = await decide(await snapshotsFrom(base), { ok: false, status: 429, error: 'quota' }, T0)
  check(!d.trustworthy && d.upserts.length === 0 && d.missing.length === 0, 'rien')
})

await test('backoff : Retry-After respecté, 429 exponentiel, pannes réseau espacées', () => {
  check(backoffSeconds(1, 120, 429) === 120, 'retry-after')
  check(backoffSeconds(1, undefined, 429) === 900 && backoffSeconds(3, undefined, 429) === 3600, '429')
  check(backoffSeconds(1, undefined, 502) === 0 && backoffSeconds(4, undefined, 502) === 600, '5xx')
  check(backoffSeconds(30, undefined, 429) === 6 * 3600, 'plafond')
})

await test('échec d’image : nouvelles tentatives espacées puis abandon', () => {
  const job = { id: '87000000', ogHash: 'aaaaaaaaaaaa', urls: [photo(1)], attempt: 1 }
  const first = ogOutcome(job, false, T0)
  check(first.ogStatus === 'failed' && Date.parse(first.ogNextAttemptAt!) - T0.getTime() === 10 * 60_000, '10 min')
  const third = ogOutcome({ ...job, attempt: 3 }, false, T0)
  check(Date.parse(third.ogNextAttemptAt!) - T0.getTime() === 40 * 60_000, '40 min')
  check(ogOutcome(job, true, T0).ogStatus === 'ready', 'succès')
})

// ---------------------------------------------------------------------------- signatures
await test('HMAC : valide, corps modifié, chemin modifié, expiré, secret court', async () => {
  const secret = 's'.repeat(48)
  const body = JSON.stringify({ tags: ['sitemap'] })
  const headers = new Headers(await signRequest(secret, 'POST', '/api/revalidate', body, 1_800_000_000))
  check((await verifyRequest(secret, 'POST', '/api/revalidate', body, headers, 1_800_000_010)).ok, 'valide')
  check(!(await verifyRequest(secret, 'POST', '/api/revalidate', body + ' ', headers, 1_800_000_010)).ok, 'corps')
  check(!(await verifyRequest(secret, 'POST', '/api/og-render', body, headers, 1_800_000_010)).ok, 'chemin')
  check(!(await verifyRequest(secret, 'POST', '/api/revalidate', body, headers, 1_800_000_400)).ok, 'expiré')
  check(!(await verifyRequest('court', 'POST', '/api/revalidate', body, headers, 1_800_000_010)).ok, 'secret court')
  check(tokenMatches('t'.repeat(40), 't'.repeat(40)) && !tokenMatches('t'.repeat(40), 'x') && !tokenMatches('', ''), 'jeton')
  const two = `${'a'.repeat(40)},${'b'.repeat(40)}`
  check(tokenMatches(two, 'a'.repeat(40)) && tokenMatches(two, 'b'.repeat(40)) && !tokenMatches(two, two), 'jetons Preview / production')
  check(!tokenMatches(`${'a'.repeat(40)},court`, 'court'), 'jeton trop court ignoré')
})

// ---------------------------------------------------------------------------- flux
await test('flux : instantané, retiré, inconnu, repli en direct pour un bien plus récent', async () => {
  const db = new MemoryDb()
  for (const row of (await decide([], catalog(base), T0)).upserts) db.rows.set(row.id, { ...row })
  db.rows.set('87000990', { ...db.rows.get(String(base[1].id))!, id: '87000990', status: 'withdrawn', withdrawnAt: T0.toISOString() })
  let liveCalls = 0
  const deps = db.feedDeps(async () => {
    liveCalls++
    return catalog([...base, listing(87634540)])
  })
  const active = await feedItem(String(base[0].id), deps)
  check('status' in active && active.status === 'active' && active.source === 'snapshot', 'actif')
  const gone = await feedItem('87000990', deps)
  check('status' in gone && gone.status === 'withdrawn', 'retiré')
  const old = await feedItem('86000000', deps)
  check('status' in old && old.status === 'unknown' && liveCalls === 0, 'ancien identifiant : pas d’appel en direct')
  const fresh = await feedItem('87634540', deps)
  check('status' in fresh && fresh.status === 'active' && fresh.source === 'live' && fresh.ogStatus === 'pending', 'direct')
  await feedItem('99999999', deps)
  await feedItem('99999999', deps)
  check(Number(liveCalls) === 2, `identifiant arbitraire mis en cache négatif (${liveCalls} appels)`)
  const bad = await feedItem('../etc', deps)
  check('status' in bad && bad.status === 'unknown', 'format')
})

await test('flux : champs Apimo privés jamais transmis (fiche, repli direct, catalogue)', async () => {
  const db = new MemoryDb()
  const secret = { ...listing(87000000), owner: { name: 'Propriétaire' }, private_comment: 'interne', user: { firstname: 'Conseiller', birthday_at: '1980-01-01' } }
  for (const row of (await decide([], catalog([secret]), T0)).upserts) db.rows.set(row.id, { ...row })
  const deps = db.feedServerDeps('t'.repeat(40), async () => catalog([secret, { ...listing(87634540), tenant: { name: 'Locataire' } }]))
  const get = async (q: string) => (await handleFeedRequest(new Request(`https://f.test/?${q}`, { headers: { 'x-feed-token': 't'.repeat(40) } }), deps)).text()
  for (const body of [await get('id=87000000'), await get('id=87634540'), await get('catalog=acheter')]) {
    check(!/Propriétaire|"interne"|Locataire|private_comment|"owner"|"tenant"|"birthday_at"/.test(body), body.slice(0, 120))
  }
  check((await get('id=87000000')).includes('Conseiller'), 'le conseiller (affiché sur la fiche) reste transmis')
  const stored = [...db.rows.values()][0].payload as Record<string, unknown>
  check(!('owner' in stored) && !('private_comment' in stored), 'instantané stocké sans champ privé')
  const changedOwner = await decide(await snapshotsFrom([secret]), catalog([{ ...secret, owner: { name: 'Autre' } }]), T0)
  check(changedOwner.stats.updated === 0 && changedOwner.tags.length === 0, 'un champ privé modifié ne purge rien')
})

// ---------------------------------------------------------------------------- run complet (doubles en mémoire)
function harness(read: () => CatalogRead, clock: { now: Date }, render: 'ok' | 'fail' = 'ok') {
  const db = new MemoryDb()
  const images = new MemoryImages(() => clock.now)
  const revalidated: string[][] = []
  const alerts: string[] = []
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9])
  const deps: SyncDeps = {
    now: () => clock.now,
    readCatalog: async () => read(),
    store: db.store(),
    images: images.api(),
    site: {
      renderOg: async () => (render === 'ok' ? { ok: true, bytes: jpeg, sourceIndex: 0 } : { ok: false, error: 'photo illisible' }),
      revalidate: async (tags) => {
        revalidated.push(tags)
        return true
      },
    },
    alert: async (subject) => {
      alerts.push(subject)
    },
    log: () => {},
  }
  return { db, images, revalidated, alerts, deps }
}

await test('run : publication, image stockée, CDN purgé, journal', async () => {
  const clock = { now: T0 }
  let items = base
  const h = harness(() => catalog(items), clock)
  await runSync(h.deps)
  check(h.db.rows.size === 20 && h.images.files.size === 12, `rattrapage limité à 12 images/run (${h.images.files.size})`)
  items = [...base, listing(87634540)]
  clock.now = new Date(T0.getTime() + 5 * 60_000)
  const run = await runSync(h.deps)
  check(run.outcome === 'ok' && run.created === 1, JSON.stringify(run))
  const created = h.db.rows.get('87634540')!
  check(h.images.files.has(`87634540-${created.ogHash}.jpg`) && created.ogStatus === 'ready', 'nouvelle fiche traitée en priorité')
  check(h.revalidated.at(-1)!.includes('listing-87634540'), 'purge')
  check(h.db.runs.length === 2 && !h.db.state.locked, 'journal + verrou libéré')
})

await test('run : 429 → backoff, aucun appel pendant le backoff, aucun retrait', async () => {
  const clock = { now: T0 }
  let fail = false
  let reads = 0
  const h = harness(() => {
    reads++
    return fail ? { ok: false, status: 429, error: 'quota', retryAfterSeconds: 1800 } : catalog(base)
  }, clock)
  await runSync(h.deps)
  fail = true
  clock.now = new Date(T0.getTime() + 5 * 60_000)
  const failed = await runSync(h.deps)
  check(failed.outcome === 'failed' && h.db.state.backoffUntil !== null, 'backoff posé')
  clock.now = new Date(T0.getTime() + 10 * 60_000)
  await runSync(h.deps)
  check(reads === 2, `pas d’appel pendant le backoff (${reads})`)
  check([...h.db.rows.values()].every((r) => r.status === 'active'), 'aucun retrait')
})

await test('run : panne prolongée → une alerte après 60 min, pas de répétition avant 6 h', async () => {
  const clock = { now: T0 }
  const h = harness(() => ({ ok: false, status: 502, error: 'Apimo indisponible' }), clock)
  for (let minutes = 0; minutes <= 90; minutes += 5) {
    clock.now = new Date(T0.getTime() + minutes * 60_000)
    h.db.state.backoffUntil = null
    await runSync(h.deps)
  }
  check(h.alerts.length === 1, `${h.alerts.length} alertes`)
})

await test('run : catalogue partiel répété → dégradé, alerte, jamais de retrait', async () => {
  const clock = { now: T0 }
  let read = catalog(base)
  const h = harness(() => read, clock)
  await runSync(h.deps)
  read = catalog(base.slice(0, 5), { complete: false })
  for (let minutes = 5; minutes <= 70; minutes += 5) {
    clock.now = new Date(T0.getTime() + minutes * 60_000)
    const run = await runSync(h.deps)
    check(run.outcome === 'degraded', run.outcome)
  }
  check([...h.db.rows.values()].every((r) => r.status === 'active'), 'aucun retrait')
  check(h.alerts.length === 1, `${h.alerts.length} alertes`)
})

await test('run : échec d’image → statut failed, nouvelle tentative différée', async () => {
  const clock = { now: T0 }
  const h = harness(() => catalog(base.slice(0, 2)), clock, 'fail')
  await runSync(h.deps)
  const row = h.db.rows.get(String(base[0].id))!
  check(row.ogStatus === 'failed' && row.ogAttempts === 1 && row.ogNextAttemptAt, JSON.stringify(row))
  clock.now = new Date(T0.getTime() + 5 * 60_000)
  const run = await runSync(h.deps)
  check(run.ogFailed === 0, 'pas de nouvelle tentative avant l’échéance')
})

await test('run : verrou — deux runs simultanés, un seul s’exécute', async () => {
  const clock = { now: T0 }
  const h = harness(() => catalog(base), clock)
  const [a, b] = await Promise.all([runSync(h.deps), runSync(h.deps)])
  check([a.outcome, b.outcome].sort().join() === 'ok,skipped', `${a.outcome}/${b.outcome}`)
})

await test('run : mode observation → ni image ni purge', async () => {
  const clock = { now: T0 }
  const h = harness(() => catalog(base), clock)
  h.db.state.mode = 'observe'
  const run = await runSync(h.deps)
  check(run.outcome === 'ok' && h.images.files.size === 0 && h.revalidated.length === 0, 'observation')
})

await test('nettoyage : anciennes versions supprimées après 30 jours seulement', async () => {
  const clock = { now: T0 }
  let items = base.slice(0, 2)
  const h = harness(() => catalog(items), clock)
  await runSync(h.deps)
  const oldFiles = [...h.images.files.keys()]
  items = items.map((l, i) => (i === 0 ? { ...l, pictures: [{ url: photo(777), rank: 1 }] } : l))
  clock.now = new Date(T0.getTime() + 25 * 3_600_000)
  await runSync(h.deps)
  check(oldFiles.every((f) => h.images.files.has(f)), 'conservées pendant le délai de grâce')
  clock.now = new Date(T0.getTime() + 31 * 86_400_000)
  await runSync(h.deps)
  check(!h.images.files.has(oldFiles[0]) && h.images.files.has(oldFiles[1]), 'ancienne version supprimée, actuelle conservée')
})

// ---------------------------------------------------------------------------- rendu serveur (bundle)
if (existsSync(new URL('../dist-ssr/pages.js', import.meta.url))) {
  const pages = await import('../dist-ssr/pages.js' as string)
  const env = { LISTING_FEED_URL: 'https://feed.test/f', LISTING_FEED_TOKEN: 't'.repeat(40), SYNC_HMAC_SECRET: 's'.repeat(48) }
  const raw = listing(87634540, { city: { name: 'Lyon 5ème', zipcode: '69005' }, area: { value: 30 }, type: 6, comments: [{ language: 'fr', comment: 'Garage double' }] } as never)
  const feedReturning = (item: unknown): typeof fetch => async () => new Response(JSON.stringify(item))
  const get = (url: string, item: unknown) => pages.handleListing(new Request(url), { env, fetch: feedReturning(item) }) as Promise<Response>

  await test('fiche active : 200, canonical, JSON-LD, image versionnée, contenu sans JavaScript', async () => {
    const res = await get('https://h.test/api/listing?kind=acheter&id=87634540', {
      status: 'active', id: '87634540', kind: 'acheter', payload: raw, ogHash: 'abcdefabcdef', ogStatus: 'ready', source: 'snapshot', updatedAt: null,
    })
    const html = await res.text()
    check(res.status === 200, `${res.status}`)
    check(html.includes('<link rel="canonical" href="https://hamacpatrimoine.com/fr/acheter/87634540" />'), 'canonical')
    check(html.includes('id="ld-listing"') && html.includes('id="ld-breadcrumb"'), 'JSON-LD')
    check(html.includes('/fr/og/listings/87634540-abcdefabcdef.jpg'), 'og:image')
    check(html.includes('Garage double') && !html.includes('Chargement...'), 'contenu')
    check((html.match(/<meta property="og:image"/g) ?? []).length === 1, 'og:image unique')
    check((res.headers.get('vercel-cdn-cache-control') ?? '').includes('stale-if-error'), 'cache')
  })
  await test('mauvaise rubrique → 308 vers la bonne', async () => {
    const res = await get('https://h.test/api/listing?kind=louer&id=87634540&utm_source=x', {
      status: 'active', id: '87634540', kind: 'acheter', payload: raw, ogHash: null, ogStatus: 'none', source: 'snapshot', updatedAt: null,
    })
    check(res.status === 308 && res.headers.get('location') === '/fr/acheter/87634540?utm_source=x', `${res.status} ${res.headers.get('location')}`)
  })
  await test('fiche retirée → 410 noindex ; inconnue → 404 noindex ; flux en panne → 503 Retry-After', async () => {
    const gone = await get('https://h.test/api/listing?kind=acheter&id=87634540', { status: 'withdrawn', id: '87634540', kind: 'acheter', withdrawnAt: null })
    const goneHtml = await gone.text()
    check(gone.status === 410 && goneHtml.includes('noindex') && goneHtml.includes('plus disponible'), 'retirée')
    const unknown = await get('https://h.test/api/listing?kind=acheter&id=12345678', { status: 'unknown', id: '12345678' })
    check(unknown.status === 404 && (await unknown.text()).includes('noindex'), 'inconnue')
    const down = await pages.handleListing(new Request('https://h.test/api/listing?kind=acheter&id=87634540'), {
      env,
      fetch: async () => {
        throw new Error('ECONNREFUSED')
      },
    })
    check(down.status === 503 && down.headers.get('retry-after') === '300' && down.headers.get('cache-control') === 'no-store', 'panne')
  })
  await test('image en échec → image Hamac par défaut avec dimensions', async () => {
    const res = await get('https://h.test/api/listing?kind=acheter&id=87634540', {
      status: 'active', id: '87634540', kind: 'acheter', payload: raw, ogHash: 'abcdefabcdef', ogStatus: 'failed', source: 'snapshot', updatedAt: null,
    })
    const html = await res.text()
    check(html.includes('hamac-og-1200x630.jpg') && html.includes('og:image:width" content="1200"'), 'défaut')
  })
  await test('sitemap : biens servis uniquement, lastmod Apimo', () => {
    const xml: string = pages.sitemapXml([
      { id: '87634540', kind: 'acheter', status: 'active', updatedAt: '2026-11-25 16:07:22', ogHash: null, ogStatus: 'none' },
      { id: '87000001', kind: 'louer', status: 'pending_withdrawal', updatedAt: null, ogHash: null, ogStatus: 'none' },
      { id: '87000002', kind: 'acheter', status: 'withdrawn', updatedAt: null, ogHash: null, ogStatus: 'none' },
    ], '2026-11-26')
    check(xml.includes('/fr/acheter/87634540</loc>\n    <lastmod>2026-11-25'), 'actif + lastmod')
    check(xml.includes('/fr/louer/87000001') && !xml.includes('87000002'), 'statuts')
    check(xml.includes('<loc>https://hamacpatrimoine.com/fr/</loc>'), 'pages statiques')
  })
  await test('revalidate : signature exigée, étiquettes validées', async () => {
    const calls: string[][] = []
    const ctx = { env, invalidateByTag: async (t: string[]) => void calls.push(t) }
    const body = JSON.stringify({ tags: ['listing-87634540', 'sitemap'] })
    const unsigned = await pages.handleRevalidate(new Request('https://h.test/api/revalidate', { method: 'POST', body }), ctx)
    check(unsigned.status === 401, 'non signé')
    const signed = await pages.handleRevalidate(
      new Request('https://h.test/api/revalidate', { method: 'POST', body, headers: await signRequest(env.SYNC_HMAC_SECRET, 'POST', '/api/revalidate', body) }),
      ctx,
    )
    check(signed.status === 200 && calls.length === 1, `${signed.status}`)
    const evilBody = JSON.stringify({ tags: ['*'] })
    const evil = await pages.handleRevalidate(
      new Request('https://h.test/api/revalidate', { method: 'POST', body: evilBody, headers: await signRequest(env.SYNC_HMAC_SECRET, 'POST', '/api/revalidate', evilBody) }),
      ctx,
    )
    check(evil.status === 400, 'étiquette invalide refusée')
  })
  await test('catalogue SSR paginé : page 1 indexable + lien « page 2 » ; page 2 = 64 biens, noindex,follow, lien « page 3 »', async () => {
    const items = Array.from({ length: 80 }, (_, i) => ({
      payload: listing(87100000 + i, { city: { name: 'Écully', zipcode: '69130' }, area: { value: 90 }, type: 1, price: { value: 400000 + i, period: null } } as never),
    }))
    const catalogFetch: typeof fetch = async () => new Response(JSON.stringify({ source: 'snapshot', items }))
    const first = await (await pages.handleCatalog(new Request('https://h.test/api/catalog?kind=acheter'), { env, fetch: catalogFetch })).text()
    const cards = (html: string) => new Set(html.match(/href="\/fr\/acheter\/871\d{5}"/g) ?? []).size
    check(cards(first) === 32 && first.includes('href="/fr/acheter?page=2"') && !first.includes('noindex'), `page 1 : ${cards(first)} biens`)
    const second = await (await pages.handleCatalog(new Request('https://h.test/api/catalog?kind=acheter&page=2'), { env, fetch: catalogFetch })).text()
    check(cards(second) === 64 && second.includes('href="/fr/acheter?page=3"') && second.includes('noindex,follow'), `page 2 : ${cards(second)} biens`)
    const last = await (await pages.handleCatalog(new Request('https://h.test/api/catalog?kind=acheter&page=3'), { env, fetch: catalogFetch })).text()
    check(cards(last) === 80 && !last.includes('page=4'), `page 3 : ${cards(last)} biens, pas de lien suivant`)
  })
  await test('Preview : X-Robots-Tag noindex hors production, absent en production', async () => {
    const item = { status: 'active', id: '87634540', kind: 'acheter', payload: raw, ogHash: null, ogStatus: 'none', source: 'snapshot', updatedAt: null }
    const preview = await pages.handleListing(new Request('https://h.test/?kind=acheter&id=87634540'), { env: { ...env, VERCEL_ENV: 'preview' }, fetch: feedReturning(item) })
    const prod = await pages.handleListing(new Request('https://h.test/?kind=acheter&id=87634540'), { env: { ...env, VERCEL_ENV: 'production' }, fetch: feedReturning(item) })
    check(preview.headers.get('x-robots-tag') === 'noindex, nofollow' && prod.headers.get('x-robots-tag') === null, 'en-tête')
  })
  await test('paramètre page protégé : valeurs invalides ou excessives redirigées vers l’URL normalisée', async () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ payload: listing(87200000 + i) }))
    const catalogFetch: typeof fetch = async () => new Response(JSON.stringify({ source: 'snapshot', items }))
    const go = (q: string) => pages.handleCatalog(new Request(`https://h.test/api/catalog?kind=acheter${q}`), { env, fetch: catalogFetch }) as Promise<Response>
    const cases: Array<[string, number, string | null]> = [
      ['&page=999999999', 308, '/fr/acheter?page=3'],
      ['&page=3', 200, null],
      ['&page=1', 308, '/fr/acheter'],
      ['&page=abc&type=maison', 308, '/fr/acheter?type=maison'],
      ['&page=-2', 308, '/fr/acheter'],
      ['&page=2.5', 308, '/fr/acheter'],
    ]
    for (const [q, status, location] of cases) {
      const res = await go(q)
      check(res.status === status && res.headers.get('location') === location, `${q} → ${res.status} ${res.headers.get('location')}`)
    }
  })
  const og = await import('../dist-ssr/og.js' as string)
  await test('SSRF : hôte refusé avant tout appel, redirections jamais suivies, taille demandée au CDN Apimo', async () => {
    let calls = 0
    await og.fetchPhoto('http://169.254.169.254/latest', 1000, 1, async () => {
      calls++
      return new Response('x')
    }).catch(() => undefined)
    check(calls === 0, 'hôte interdit : aucun appel')
    let seen: { url: string; redirect?: string } | null = null
    await og.fetchPhoto('https://media.apimo.pro/cache/abc_x_3344-original.jpg', 1000, 1, async (url: string, init: RequestInit) => {
      seen = { url: String(url), redirect: init.redirect }
      return new Response(new Uint8Array([1]))
    })
    check(seen!.redirect === 'error', `redirect=${seen!.redirect}`)
    check(seen!.url.endsWith('_1600-original.jpg'), seen!.url)
    // Comportement réel de fetch avec redirect: 'error' face à une redirection vers une adresse interne.
    const { createServer } = await import('node:http')
    const server = createServer((_req, res) => {
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' })
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    const followed = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'error' }).then(() => true, () => false)
    server.close()
    check(!followed, 'fetch a suivi la redirection')
  })
} else {
  console.log('(rendu serveur ignoré : lancer `npm run build` pour produire dist-ssr)')
}

if (failures) {
  console.error(`\n${failures} test(s) en échec`)
  process.exit(1)
}
console.log('\nTous les tests passent')
