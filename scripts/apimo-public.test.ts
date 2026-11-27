// Garantie anti-fuite d'apimo-proxy et du flux : aucun champ Apimo hors liste blanche ne peut sortir.
// Usage : npx tsx scripts/apimo-public.test.ts
//   APIMO_SAMPLE=<fichier.json> : rejoue aussi le contrôle sur une copie locale du catalogue réel
//   (fichier hors dépôt ; seuls des compteurs sont affichés, jamais une valeur).
// Le bloc « rendu identique » exige `npm run build` (dist-ssr).
import { existsSync, readFileSync } from 'node:fs'
import { publicPayload } from '../supabase/functions/_shared/catalog/model.ts'
import { parseProxyResponse } from '../supabase/functions/_shared/catalog/proxy.ts'
import { isCatalogRoute } from '../supabase/functions/_shared/catalog/public-route.ts'
import { COARSE_COORDINATE_DECIMALS, publicCatalogEnvelope, sanitizeListing } from '../supabase/functions/_shared/catalog/public.ts'

let failures = 0
function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    failures++
    console.error(`  ÉCHEC : ${message}`)
  }
}
async function test(name: string, run: () => unknown | Promise<unknown>) {
  const before = failures
  try {
    await run()
  } catch (error) {
    failures++
    console.error(`  ÉCHEC : exception ${(error as Error).message}`)
  }
  console.log(`${failures === before ? 'ok ' : 'KO '} ${name}`)
}

// Valeurs témoins : si l'une d'elles apparaît dans une sortie, un champ privé a fui.
const CANARY = 'CANARI-PRIVE'
const BIRTHDAY = '1971-02-03'

/** Fiche Apimo complète, avec chaque champ sensible connu rempli par une valeur témoin. */
function fullListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 87634540,
    reference: 'H-1',
    type: 1,
    subtype: 3,
    category: 1,
    step: 1,
    status: 1,
    name: 'Maison familiale',
    rooms: 5,
    bedrooms: 3,
    condition: 2,
    standing: 1,
    availability: 1,
    available_at: '2026-12-01',
    updated_at: '2026-11-20 10:00:00',
    created_at: '2026-10-01 09:00:00',
    orientations: [1, 2],
    proximities: [3],
    services: [4, { [`${CANARY}-service`]: 1 }],
    city: { id: 1, name: 'Tassin-la-Demi-Lune', zipcode: '69160', mayor: CANARY },
    district: { id: 2, name: 'Centre', note: CANARY },
    area: { total: 140, unit: 1, value: 130, weighted: 128, cadastre: CANARY },
    plot: { width: 20, height: 30, net_floor: 600, land_type: 1, serviced_plot: true, owner_parcel: CANARY },
    floor: { type: 1, value: 0, floors: 2, levels: 2 },
    heating: { access: 1, device: 2, devices: [2], type: 1, types: [1] },
    water: { hot_access: 1, hot_device: 2, waste: 1 },
    construction: { construction_year: 1990, renovation_year: 2020, renovation_cost: 987654, construction_step: 1, method: 1 },
    view: { type: 1, landscape: [1] },
    price: {
      value: 650000,
      currency: 'EUR',
      period: null,
      hide: false,
      max: null,
      unit: 1,
      commission: 31337,
      commission_customer: 31338,
      commission_owner: 31339,
      contribution: 31340,
      deposit: 31341,
      fees: 31342,
      inventory: 31343,
      pension: 31344,
      tenant: 31345,
      transfer_tax: 31346,
      vat: 31347,
    },
    agreement: { type: 1, reference: `${CANARY}-mandat`, start_at: '2026-01-01', end_at: '2027-01-01' },
    areas: [{ type: 1, number: 1, area: 30, floor: 0, orientations: [1], comments: 'Séjour lumineux', flooring: 1, ceiling_height: 2.5, beds: 0, price: 31348, lot: `${CANARY}-lot` }],
    comments: [{ language: 'fr', title: 'Belle maison', subtitle: 'Calme', hook: 'Rare', comment: 'Maison avec jardin', comment_full: 'Maison avec jardin et garage', author: CANARY }],
    pictures: [
      { id: 1, rank: 1, url: 'https://media.apimo.pro/a.jpg', width_max: 1600, height_max: 1200, internet: 1, comments: [{ language: 'fr', comment: 'Façade', by: CANARY }], reference: `${CANARY}-photo` },
      { id: 2, rank: 2, url: `https://media.apimo.pro/${CANARY}-interne.jpg`, internet: 0 },
    ],
    regulations: [{ type: 1, value: 'C', date: '2025-01-01', label: 'DPE', graph: 'https://media.apimo.pro/dpe.png', graph_i18ns: { fr: 'https://media.apimo.pro/dpe-fr.png' }, auditor: CANARY }],
    user: {
      id: 4242,
      agency: 77,
      active: true,
      firstname: 'Camille',
      lastname: 'Conseil',
      email: 'camille@agence.example',
      phone: '+33 4 00 00 00 00',
      mobile: `${CANARY}-mobile`,
      fax: `${CANARY}-fax`,
      picture: 'https://media.apimo.pro/u.jpg',
      birthday_at: BIRTHDAY,
      created_at: '2020-01-01',
      updated_at: '2026-01-01',
      group: 1,
      language: 'fr',
      timezone: 'Europe/Paris',
    },
    latitude: 45.761234,
    longitude: 4.781234,
    publish_address: false,
    address: `${CANARY} 12 rue privée`,
    address_more: CANARY,
    owner: { firstname: CANARY, birthday: BIRTHDAY, phone: CANARY },
    tenant: { name: CANARY },
    private_comment: CANARY,
    interagency_comment: CANARY,
    status_comment: CANARY,
    life_annuity: { occupants: [{ birthday: BIRTHDAY, gender: 1 }] },
    cadastre_reference: CANARY,
    lot_reference: CANARY,
    logs: [{ message: CANARY }],
    financial: { margin: CANARY },
    documents: [{ url: CANARY }],
    exchanges: [CANARY],
    referral: CANARY,
    visit: { code: CANARY },
    champ_futur_apimo: CANARY,
    ...overrides,
  }
}

const FORBIDDEN_KEYS = [
  'owner', 'tenant', 'private_comment', 'interagency_comment', 'status_comment', 'life_annuity', 'occupants', 'birthday', 'birthday_at',
  'address', 'address_more', 'cadastre_reference', 'lot_reference', 'logs', 'financial', 'documents', 'exchanges', 'referral', 'visit',
  'commission', 'commission_customer', 'commission_owner', 'contribution', 'deposit', 'fees', 'inventory', 'pension', 'transfer_tax', 'vat',
  'renovation_cost', 'mobile', 'fax', 'start_at', 'end_at', 'lot', 'champ_futur_apimo',
]

function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => allKeys(item, out))
  else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      out.add(key)
      allKeys(inner, out)
    }
  }
  return out
}

function assertClean(output: unknown, label: string) {
  const text = JSON.stringify(output)
  check(!text.includes(CANARY), `${label} : valeur témoin présente`)
  check(!text.includes(BIRTHDAY), `${label} : date de naissance présente`)
  check(!text.includes('3133'), `${label} : montant financier témoin présent`)
  const keys = allKeys(output)
  const leaked = FORBIDDEN_KEYS.filter((key) => keys.has(key))
  check(leaked.length === 0, `${label} : clés interdites ${leaked.join(', ')}`)
  // `reference` n'est autorisé qu'à la racine (référence publique de l'annonce).
  const nested = JSON.stringify((output as Record<string, unknown>)?.agreement ?? {}) + JSON.stringify((output as Record<string, unknown>)?.pictures ?? [])
  check(!nested.includes('reference'), `${label} : référence interne imbriquée`)
}

await test('fiche filtrée : aucun champ privé, à aucun niveau', () => {
  assertClean(sanitizeListing(fullListing()), 'sanitizeListing')
  assertClean(publicPayload(fullListing() as never), 'publicPayload')
})

await test('champs utiles conservés (prix, conseiller professionnel, photos publiées, DPE, mandat)', () => {
  const out = sanitizeListing(fullListing())!
  const price = out.price as Record<string, unknown>
  check(price.value === 650000 && price.currency === 'EUR' && price.period === null, 'prix')
  const user = out.user as Record<string, unknown>
  check(user.firstname === 'Camille' && user.email === 'camille@agence.example' && user.phone === '+33 4 00 00 00 00', 'conseiller')
  check(user.picture === 'https://media.apimo.pro/u.jpg' && !('id' in user), 'photo conseiller, sans identifiant')
  const pictures = out.pictures as Array<Record<string, unknown>>
  check(pictures.length === 1 && pictures[0].url === 'https://media.apimo.pro/a.jpg', 'photo non publiée retirée')
  check((out.agreement as Record<string, unknown>).type === 1, 'type de mandat')
  check(((out.regulations as Array<Record<string, unknown>>)[0].graph_i18ns as Record<string, unknown>).fr !== undefined, 'DPE')
  check((out.comments as Array<Record<string, unknown>>)[0].comment === 'Maison avec jardin', 'description')
  check(JSON.stringify(out.services) === '[4]', 'services : valeurs simples seulement')
})

await test('coordonnées : arrondies si l’adresse n’est pas publiée, exactes sinon, stables au second filtrage', () => {
  const hidden = sanitizeListing(fullListing())!
  const step = 10 ** -COARSE_COORDINATE_DECIMALS
  check(hidden.latitude === 45.761 && hidden.longitude === 4.781, `arrondi ${hidden.latitude},${hidden.longitude}`)
  check(Math.abs((hidden.latitude as number) - 45.761234) <= step, 'arrondi proche')
  const shown = sanitizeListing(fullListing({ publish_address: true }))!
  check(shown.latitude === 45.761234 && !('address' in shown), 'exact sans adresse')
  check(JSON.stringify(sanitizeListing(shown)) === JSON.stringify(shown), 'idempotent (adresse publiée)')
  check(JSON.stringify(sanitizeListing(hidden)) === JSON.stringify(hidden), 'idempotent (adresse masquée)')
})

await test('types inattendus : objet à la place d’une valeur simple → retiré', () => {
  const out = sanitizeListing(fullListing({ name: { secret: CANARY }, price: { value: { nested: CANARY } }, user: [CANARY], comments: CANARY }))!
  assertClean(out, 'types inattendus')
  check(!('name' in out) && !('value' in (out.price as object)) && !('user' in out) && !('comments' in out), 'valeurs retirées')
})

await test('enveloppe publique : biens publiés seulement, aucun champ d’Apimo recopié', () => {
  const payload = {
    properties: [fullListing(), fullListing({ id: 1, status: 30 }), fullListing({ id: 2, status: 22 }), fullListing({ id: 3, status: '29' }), null, CANARY],
    total_items: 6,
    fetched_items: 6,
    sync_meta: { complete: true },
    agency: { siret: CANARY },
    timestamp: CANARY,
  }
  const env = publicCatalogEnvelope(payload)
  assertClean(env, 'enveloppe')
  check(JSON.stringify(Object.keys(env).sort()) === JSON.stringify(['fetched_items', 'properties', 'status_filter', 'sync_meta', 'total_items']), 'clés')
  const ids = (env.properties as Array<Record<string, unknown>>).map((p) => p.id)
  check(JSON.stringify(ids) === JSON.stringify([87634540, 2, 3]), `statuts publiés ${JSON.stringify(ids)}`)
  check(env.fetched_items === 3 && env.total_items === 3 && (env.sync_meta as Record<string, unknown>).complete === true, 'compteurs')
})

await test('cache ancien (réponse brute stockée avant le correctif) : resservi filtré', () => {
  const legacy = { properties: [fullListing()], total_items: 1, fetched_items: 1, status_filter: '1,22,29', sync_meta: { complete: false }, processing_time: CANARY }
  const env = publicCatalogEnvelope(legacy)
  assertClean(env, 'cache ancien')
  check((env.sync_meta as Record<string, unknown>).complete === false, 'complétude conservée')
})

await test('compatibilité catalog-sync / listing-feed : enveloppe lue comme avant', () => {
  const env = publicCatalogEnvelope({ properties: [fullListing(), fullListing({ id: 2 })], total_items: 2, sync_meta: { complete: true } })
  const read = parseProxyResponse(200, new Headers({ 'x-cache': 'miss' }), env)
  check(read.ok && read.items.length === 2 && read.complete && read.fresh, JSON.stringify(read).slice(0, 120))
  const quota = parseProxyResponse(429, new Headers(), { error: 'Quota Apimo atteint', status: 429 })
  check(!quota.ok && quota.status === 429, 'quota')
})

await test('routes : seul le catalogue publié est servi', () => {
  check(isCatalogRoute('POST', '/apimo-proxy', { route: 'properties' }), 'POST properties')
  check(isCatalogRoute('POST', '/apimo-proxy', { route: '/properties' }), 'POST /properties')
  check(isCatalogRoute('GET', '/functions/v1/apimo-proxy/properties', null), 'GET properties')
  check(isCatalogRoute('GET', '/apimo-proxy/properties', null), 'GET properties (chemin court)')
  for (const route of ['agencies', 'properties/probe', 'properties/87634540', 'properties?status=30', '', 'PROPERTIES', 'properties/../agencies']) {
    check(!isCatalogRoute('POST', '/apimo-proxy', { route }), `POST ${route} refusé`)
  }
  for (const path of ['/apimo-proxy/agencies', '/apimo-proxy/properties/probe', '/apimo-proxy/properties/87634540', '/apimo-proxy']) {
    check(!isCatalogRoute('GET', path, null), `GET ${path} refusé`)
  }
  check(!isCatalogRoute('POST', '/apimo-proxy', null) && !isCatalogRoute('PUT', '/apimo-proxy/properties', null), 'corps absent / méthode')
})

if (existsSync(new URL('../dist-ssr/pages.js', import.meta.url))) {
  const pages = await import('../dist-ssr/pages.js' as string)
  const env = { LISTING_FEED_URL: 'https://feed.test/f', LISTING_FEED_TOKEN: 't'.repeat(40), SYNC_HMAC_SECRET: 's'.repeat(48) }
  const render = async (payload: unknown) => {
    const item = { status: 'active', id: '87634540', kind: 'acheter', payload, ogHash: 'abcdefabcdef', ogStatus: 'ready', source: 'snapshot', updatedAt: null }
    const res: Response = await pages.handleListing(new Request('https://h.test/api/listing?kind=acheter&id=87634540'), {
      env,
      fetch: async () => new Response(JSON.stringify(item)),
    })
    return res.text()
  }
  await test('rendu serveur identique avec la charge filtrée (adresse publiée)', async () => {
    // Le site affichait aussi les photos marquées non publiables ; le filtre les retire (seul écart voulu).
    const raw = fullListing({ publish_address: true })
    const publishedOnly = { ...raw, pictures: raw.pictures.filter((p) => p.internet !== 0) }
    const [full, filtered] = await Promise.all([render(publishedOnly), render(sanitizeListing(raw))])
    check(!filtered.includes('interne.jpg'), 'photo non publiable dans le HTML')
    let at = 0
    while (at < full.length && full[at] === filtered[at]) at++
    check(full === filtered, `HTML différent à partir de : ${JSON.stringify(full.slice(Math.max(0, at - 60), at + 60))}`)
    assertClean({ html: filtered.replaceAll('Maison', '') }, 'HTML')
  })
} else {
  console.log('--  rendu serveur ignoré (lancer `npm run build`)')
}

// Contrôle facultatif sur une copie locale du catalogue réel : compteurs seulement.
const sample = process.env.APIMO_SAMPLE
if (sample && existsSync(sample)) {
  await test('catalogue réel : aucun champ interdit après filtrage', () => {
    const real = JSON.parse(readFileSync(sample, 'utf8'))
    const env = publicCatalogEnvelope(real)
    const keys = allKeys(env)
    const leaked = FORBIDDEN_KEYS.filter((key) => keys.has(key))
    check(leaked.length === 0, `clés interdites : ${leaked.join(', ')}`)
    const before = (real.properties as unknown[]).length
    console.log(`     ${before} biens lus, ${(env.properties as unknown[]).length} publiés servis, ${keys.size} clés distinctes`)
  })
}

if (failures) {
  console.error(`\n${failures} test(s) en échec`)
  process.exit(1)
}
console.log('\nTous les tests passent')
