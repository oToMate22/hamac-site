// Test ISOLÉ de la vraie fonction apimo-proxy (index.ts), exécutée par Deno SANS accès réseau :
// Apimo et la table apimo_cache sont simulés en mémoire. Rejoue les manipulations qu'un visiteur
// pourrait tenter (refresh forcé, statut libre, routes supprimées, paramètres arbitraires) sans
// jamais toucher la production.
// Usage : npm run test:apimo-proxy-isolated
// Deno télécharge les dépendances npm/jsr, mais le code testé ne reçoit aucune permission réseau
// (--allow-env, et lecture du dépôt pour charger la fonction) : tout appel non simulé échoue.

const CANARY = 'CANARI-PRIVE'
const BIRTHDAY = '1971-02-03'

function listing(id: number, status: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    reference: `REF-${id}`,
    status,
    category: 1,
    type: 1,
    city: { name: 'Lyon', zipcode: '69005' },
    price: { value: 300000, currency: 'EUR', hide: false, commission: 3133, fees: 3134, deposit: 3135 },
    area: { value: 80, unit: 1 },
    pictures: [{ url: 'https://media.apimo.pro/a.jpg', internet: 1 }, { url: `https://media.apimo.pro/${CANARY}.jpg`, internet: 0 }],
    user: { id: 9, firstname: 'Camille', lastname: 'Conseil', email: 'camille@agence.example', phone: '+33 4 00 00 00 00', mobile: CANARY, birthday_at: BIRTHDAY },
    latitude: 45.761234,
    longitude: 4.781234,
    publish_address: false,
    address: `${CANARY} rue privée`,
    owner: { firstname: CANARY, birthday: BIRTHDAY },
    private_comment: CANARY,
    life_annuity: { occupants: [{ birthday: BIRTHDAY, gender: 1 }] },
    mandate: { type: 1, reference: CANARY, start_at: '2026-01-01', end_at: '2027-01-01' },
    champ_futur_apimo: CANARY,
    ...extra,
  }
}

// Agence fictive : 3 biens publiés (1, 22, 29) et 2 non publiés (30 = vendu, 3 = archivé).
const APIMO = [listing(1, 1), listing(2, 22), listing(3, 29), listing(4, 30), listing(5, 3)]

// --- Simulation réseau -------------------------------------------------------------------------
const apimoCalls: string[] = []
let apimoMode: 'ok' | '429' = 'ok'
let cacheRow: { key: string; payload: unknown; fetched_at: string } | null = null
let cacheWrites = 0
let now = Date.parse('2026-11-27T15:00:00Z')

Date.now = () => now
Deno.env.set('APIMO_PROVIDER_ID', 'fournisseur-test')
Deno.env.set('APIMO_TOKEN', 'jeton-test')
Deno.env.set('APIMO_AGENCY_ID', '42')
Deno.env.set('SUPABASE_URL', 'http://supabase.isole.test')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'cle-test')

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const request = input instanceof Request ? input : new Request(input, init)
  const url = new URL(request.url)
  if (url.hostname === 'api.apimo.pro') {
    apimoCalls.push(url.pathname + url.search)
    if (apimoMode === '429') return Response.json({ error: 'quota' }, { status: 429 })
    const status = Number(url.searchParams.get('status'))
    const items = APIMO.filter((item) => item.status === status)
    return Response.json({ total_items: items.length, timestamp: 1, processing_time: 1, properties: items })
  }
  if (url.hostname === 'supabase.isole.test' && url.pathname === '/rest/v1/apimo_cache') {
    if (request.method === 'GET' || request.method === 'HEAD') return Response.json(cacheRow ? [cacheRow] : [])
    if (request.method === 'POST') {
      const body = await request.json()
      cacheRow = Array.isArray(body) ? body[0] : body
      cacheWrites++
      return new Response(null, { status: 201 })
    }
  }
  throw new Error(`réseau interdit dans le test isolé : ${url.host}`)
}

let handler: ((req: Request) => Promise<Response>) | null = null
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = (h: (req: Request) => Promise<Response>) => {
  handler = h
  return { finished: Promise.resolve(), shutdown() {} }
}
// APIMO_PROXY_ENTRY permet de rejouer le test sur une autre version (ex. l'ancienne, pour vérifier qu'il échoue).
await import(Deno.env.get('APIMO_PROXY_ENTRY') ?? '../supabase/functions/apimo-proxy/index.ts')
if (!handler) throw new Error('handler non enregistré')

// --- Outils ------------------------------------------------------------------------------------
const BASE = 'http://localhost/functions/v1/apimo-proxy'
let failures = 0
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`ok  ${name}`)
  } catch (error) {
    failures++
    console.error(`KO  ${name} : ${(error as Error).message}`)
  }
}
const call = (path = '', init: RequestInit = {}) => handler!(new Request(BASE + path, init))
const post = (body: unknown) => call('', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
async function publicBody(res: Response) {
  const text = await res.text()
  check(!text.includes(CANARY) && !text.includes(BIRTHDAY) && !/313[345]/.test(text), 'donnée privée dans la réponse')
  return JSON.parse(text)
}
function assertCatalog(body: Record<string, unknown>) {
  check(JSON.stringify(Object.keys(body).sort()) === JSON.stringify(['fetched_items', 'properties', 'status_filter', 'sync_meta', 'total_items']), `racine ${Object.keys(body)}`)
  const ids = (body.properties as Array<{ id: number; status: number }>).map((p) => p.id).sort()
  check(JSON.stringify(ids) === '[1,2,3]', `biens servis ${ids}`)
  check(body.status_filter === '1,22,29', 'status_filter')
}
const snapshot = () => JSON.stringify(cacheRow)
const ATTACKS: Array<[string, () => Promise<Response>]> = [
  ['POST statut 30 + refresh', () => post({ route: 'properties', status: '30', refresh: true })],
  ['POST statuts multiples + limit + filtres', () => post({ route: 'properties', status: ['3', '30'], limit: 1000, offset: 0, params: { status: 30 } })],
  ['GET ?refresh=1&status=30', () => call('/properties?refresh=1&status=30&limit=1000')],
  ['GET ?status=3&agency=1', () => call('/properties?status=3&agency=1')],
]
const REFUSED_ROUTES: Array<[string, () => Promise<Response>]> = [
  ['POST agencies', () => post({ route: 'agencies' })],
  ['POST properties/probe', () => post({ route: 'properties/probe' })],
  ['POST properties/4 (non publié)', () => post({ route: 'properties/4' })],
  ['POST route absente', () => post({ status: '30' })],
  ['POST corps invalide', () => call('', { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } })],
  ['GET /agencies', () => call('/agencies')],
  ['GET /properties/4', () => call('/properties/4')],
  ['GET /properties/../agencies', () => call('/properties/%2E%2E/agencies')],
]

// --- Scénarios ---------------------------------------------------------------------------------
await test('ancien cache BRUT (avant correctif, avec biens non publiés) : resservi filtré', async () => {
  cacheRow = { key: 'properties', payload: { timestamp: 1, status_filter: '30', properties: APIMO }, fetched_at: new Date(now).toISOString() }
  const before = snapshot()
  const res = await post({ route: 'properties' })
  check(res.status === 200, `HTTP ${res.status}`)
  check(res.headers.get('x-cache') === 'persistent', `X-Cache ${res.headers.get('x-cache')}`)
  assertCatalog(await publicBody(res))
  check(apimoCalls.length === 0 && snapshot() === before, 'aucun appel Apimo, cache inchangé')
})

await test('paramètres de manipulation ignorés : même réponse, aucun appel Apimo, cache inchangé', async () => {
  const before = snapshot()
  for (const [label, attack] of ATTACKS) {
    const res = await attack()
    check(res.status === 200, `${label} : HTTP ${res.status}`)
    assertCatalog(await publicBody(res))
  }
  check(apimoCalls.length === 0, `${apimoCalls.length} appels Apimo`)
  check(snapshot() === before && cacheWrites === 0, 'cache modifié')
})

await test('routes supprimées et méthodes non prévues : 404 / 405, sans donnée ni appel Apimo', async () => {
  const before = snapshot()
  for (const [label, attempt] of REFUSED_ROUTES) {
    const res = await attempt()
    const text = await res.text()
    check(res.status === 404, `${label} : HTTP ${res.status}`)
    check(text === JSON.stringify({ error: 'Route not found' }), `${label} : corps ${text.slice(0, 40)}`)
  }
  for (const method of ['PUT', 'DELETE', 'PATCH']) {
    const res = await call('/properties', { method })
    check(res.status === 405, `${method} : HTTP ${res.status}`)
  }
  check(apimoCalls.length === 0 && snapshot() === before, 'effet de bord')
})

await test('cache expiré + paramètres malveillants : seuls les statuts 1, 22, 29 sont lus ; le cache réécrit est filtré', async () => {
  now += 6 * 60 * 1000
  const res = await post({ route: 'properties', status: '30', refresh: true, limit: 1000 })
  check(res.status === 200 && res.headers.get('x-cache') === 'miss', `HTTP ${res.status} ${res.headers.get('x-cache')}`)
  assertCatalog(await publicBody(res))
  const expected = ['1', '22', '29'].map((s) => `/agencies/42/properties?status=${s}&limit=100&offset=0`)
  check(JSON.stringify(apimoCalls) === JSON.stringify(expected), `appels Apimo ${JSON.stringify(apimoCalls)}`)
  const stored = JSON.stringify(cacheRow?.payload)
  check(cacheWrites === 1 && !stored.includes(CANARY) && !stored.includes(BIRTHDAY) && !/313[345]/.test(stored), 'cache réécrit non filtré')
  assertCatalog(cacheRow!.payload as Record<string, unknown>)
})

await test('Apimo en quota (429) : cache périmé resservi filtré', async () => {
  apimoMode = '429'
  apimoCalls.length = 0
  now += 6 * 60 * 1000
  cacheRow = { key: 'properties', payload: { properties: APIMO }, fetched_at: new Date(now - 60 * 60 * 1000).toISOString() }
  // Le cache mémoire de l'instance contient la version filtrée du scénario précédent, elle aussi périmée.
  const res = await post({ route: 'properties' })
  check(res.status === 200 && res.headers.get('x-cache') === 'stale', `HTTP ${res.status} ${res.headers.get('x-cache')}`)
  assertCatalog(await publicBody(res))
})

await test('réponses d’erreur : aucune donnée, aucun détail interne', async () => {
  const res = await call('/properties', { method: 'PUT' })
  const text = await res.text()
  check(text === JSON.stringify({ error: 'Method not allowed' }), text)
})

if (failures) {
  console.error(`\n${failures} test(s) en échec`)
  Deno.exit(1)
}
console.log('\nTous les tests isolés passent (aucun accès réseau réel)')
