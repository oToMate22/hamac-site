export type FrenchCommune = {
  name: string
  code: string
  postcodes: string[]
  lat?: number
  lng?: number
}

type ApiCommune = {
  nom: string
  code: string
  codesPostaux?: string[]
  centre?: { type: string; coordinates: [number, number] }
}

const COMMUNE_TYPES = [
  'commune-actuelle',
  'arrondissement-municipal',
  'commune-deleguee',
  'commune-associee',
] as const

const CITY_STOP_WORDS = new Set(['arrondissement', 'commune', 'cedex'])

/** Préfixe CP (69, 6900, 69001…) — suggestions locales sans attendre l’API. */
const POSTAL_PREFIX = /^\d{2,5}$/
const POSTAL_CODE = /^\d{5}$/

/**
 * Les 45 arrondissements municipaux (Lyon, Paris, Marseille).
 * Source : geo.api.gouv.fr — évite 4 appels réseau lents pour 69001 / 69 / 6900.
 */
const MUNICIPAL_ARRONDISSEMENTS: FrenchCommune[] = [
  { name: 'Marseille 1er Arrondissement', code: '13201', postcodes: ['13001'], lat: 43.3002, lng: 5.3828 },
  { name: 'Marseille 2e Arrondissement', code: '13202', postcodes: ['13002'], lat: 43.3225, lng: 5.3497 },
  { name: 'Marseille 3e Arrondissement', code: '13203', postcodes: ['13003'], lat: 43.3113, lng: 5.3806 },
  { name: 'Marseille 4e Arrondissement', code: '13204', postcodes: ['13004'], lat: 43.3063, lng: 5.4002 },
  { name: 'Marseille 5e Arrondissement', code: '13205', postcodes: ['13005'], lat: 43.2925, lng: 5.4006 },
  { name: 'Marseille 6e Arrondissement', code: '13206', postcodes: ['13006'], lat: 43.2876, lng: 5.3814 },
  { name: 'Marseille 7e Arrondissement', code: '13207', postcodes: ['13007'], lat: 43.2796, lng: 5.3274 },
  { name: 'Marseille 8e Arrondissement', code: '13208', postcodes: ['13008'], lat: 43.215, lng: 5.3256 },
  { name: 'Marseille 9e Arrondissement', code: '13209', postcodes: ['13009'], lat: 43.2366, lng: 5.4523 },
  { name: 'Marseille 10e Arrondissement', code: '13210', postcodes: ['13010'], lat: 43.2743, lng: 5.4243 },
  { name: 'Marseille 11e Arrondissement', code: '13211', postcodes: ['13011'], lat: 43.2877, lng: 5.4787 },
  { name: 'Marseille 12e Arrondissement', code: '13212', postcodes: ['13012'], lat: 43.3071, lng: 5.4418 },
  { name: 'Marseille 13e Arrondissement', code: '13213', postcodes: ['13013'], lat: 43.3528, lng: 5.4301 },
  { name: 'Marseille 14e Arrondissement', code: '13214', postcodes: ['13014'], lat: 43.3468, lng: 5.3915 },
  { name: 'Marseille 15e Arrondissement', code: '13215', postcodes: ['13015'], lat: 43.3531, lng: 5.3653 },
  { name: 'Marseille 16e Arrondissement', code: '13216', postcodes: ['13016'], lat: 43.3642, lng: 5.3161 },
  { name: 'Lyon 1er Arrondissement', code: '69381', postcodes: ['69001'], lat: 45.7701, lng: 4.8264 },
  { name: 'Lyon 2e Arrondissement', code: '69382', postcodes: ['69002'], lat: 45.7464, lng: 4.8265 },
  { name: 'Lyon 3e Arrondissement', code: '69383', postcodes: ['69003'], lat: 45.7514, lng: 4.8685 },
  { name: 'Lyon 4e Arrondissement', code: '69384', postcodes: ['69004'], lat: 45.7805, lng: 4.826 },
  { name: 'Lyon 5e Arrondissement', code: '69385', postcodes: ['69005'], lat: 45.756, lng: 4.8012 },
  { name: 'Lyon 6e Arrondissement', code: '69386', postcodes: ['69006'], lat: 45.7753, lng: 4.8548 },
  { name: 'Lyon 7e Arrondissement', code: '69387', postcodes: ['69007'], lat: 45.7321, lng: 4.8393 },
  { name: 'Lyon 8e Arrondissement', code: '69388', postcodes: ['69008'], lat: 45.7342, lng: 4.8695 },
  { name: 'Lyon 9e Arrondissement', code: '69389', postcodes: ['69009'], lat: 45.7836, lng: 4.8128 },
  { name: 'Paris 1er Arrondissement', code: '75101', postcodes: ['75001'], lat: 48.862, lng: 2.3359 },
  { name: 'Paris 2e Arrondissement', code: '75102', postcodes: ['75002'], lat: 48.8677, lng: 2.3411 },
  { name: 'Paris 3e Arrondissement', code: '75103', postcodes: ['75003'], lat: 48.8626, lng: 2.3593 },
  { name: 'Paris 4e Arrondissement', code: '75104', postcodes: ['75004'], lat: 48.8541, lng: 2.3569 },
  { name: 'Paris 5e Arrondissement', code: '75105', postcodes: ['75005'], lat: 48.8454, lng: 2.3514 },
  { name: 'Paris 6e Arrondissement', code: '75106', postcodes: ['75006'], lat: 48.8495, lng: 2.3307 },
  { name: 'Paris 7e Arrondissement', code: '75107', postcodes: ['75007'], lat: 48.8548, lng: 2.3115 },
  { name: 'Paris 8e Arrondissement', code: '75108', postcodes: ['75008'], lat: 48.8732, lng: 2.3111 },
  { name: 'Paris 9e Arrondissement', code: '75109', postcodes: ['75009'], lat: 48.8771, lng: 2.3379 },
  { name: 'Paris 10e Arrondissement', code: '75110', postcodes: ['75010'], lat: 48.876, lng: 2.3624 },
  { name: 'Paris 11e Arrondissement', code: '75111', postcodes: ['75011'], lat: 48.8601, lng: 2.3816 },
  { name: 'Paris 12e Arrondissement', code: '75112', postcodes: ['75012'], lat: 48.8342, lng: 2.4173 },
  { name: 'Paris 13e Arrondissement', code: '75113', postcodes: ['75013'], lat: 48.8303, lng: 2.3656 },
  { name: 'Paris 14e Arrondissement', code: '75114', postcodes: ['75014'], lat: 48.8297, lng: 2.323 },
  { name: 'Paris 15e Arrondissement', code: '75115', postcodes: ['75015'], lat: 48.8417, lng: 2.2937 },
  { name: 'Paris 16e Arrondissement', code: '75116', postcodes: ['75016', '75116'], lat: 48.8572, lng: 2.263 },
  { name: 'Paris 17e Arrondissement', code: '75117', postcodes: ['75017'], lat: 48.8874, lng: 2.305 },
  { name: 'Paris 18e Arrondissement', code: '75118', postcodes: ['75018'], lat: 48.8919, lng: 2.3487 },
  { name: 'Paris 19e Arrondissement', code: '75119', postcodes: ['75019'], lat: 48.8871, lng: 2.3878 },
  { name: 'Paris 20e Arrondissement', code: '75120', postcodes: ['75020'], lat: 48.8625, lng: 2.3966 },
]

const normalizeCity = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

function mapApiCommune(entry: ApiCommune): FrenchCommune {
  return {
    name: entry.nom,
    code: entry.code,
    postcodes: entry.codesPostaux ?? [],
    lat: entry.centre?.coordinates[1],
    lng: entry.centre?.coordinates[0],
  }
}

function filterArrondissementsByPostalPrefix(prefix: string): FrenchCommune[] {
  const hits = MUNICIPAL_ARRONDISSEMENTS.filter((entry) =>
    entry.postcodes.some((code) => code.startsWith(prefix)),
  )
  return hits.sort((a, b) => {
    const aExact = a.postcodes.includes(prefix) ? 0 : 1
    const bExact = b.postcodes.includes(prefix) ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    const aCode = a.postcodes[0] ?? ''
    const bCode = b.postcodes[0] ?? ''
    return aCode.localeCompare(bCode)
  })
}

/**
 * Suggestions CP sans réseau : `69` → 9 Lyon, `6900` → Lyon 1er…, `69001` → Lyon 1er.
 * Renvoie `null` seulement pour un CP à 5 chiffres hors arrondissement (ex. 69110) → API.
 */
export function searchLocalPostalCommunes(query: string, limit = 16): FrenchCommune[] | null {
  const trimmed = query.trim()
  if (!POSTAL_PREFIX.test(trimmed)) return null
  const local = filterArrondissementsByPostalPrefix(trimmed)
  if (local.length > 0) return local.slice(0, Math.max(limit, 24))
  if (trimmed.length < 5) return []
  return null
}

async function searchCommunesByPostalCode(
  postal: string,
  limit: number,
  signal?: AbortSignal,
): Promise<FrenchCommune[]> {
  const url = new URL('https://geo.api.gouv.fr/communes')
  url.searchParams.set('codePostal', postal)
  url.searchParams.set('fields', 'nom,code,codesPostaux,centre')
  url.searchParams.set('limit', String(Math.max(limit, 8)))

  const response = await fetch(url, { signal })
  if (!response.ok) return []
  const data = (await response.json()) as ApiCommune[]
  return data.map(mapApiCommune)
}

/** Commune actuelle, arrondissement (Lyon 5e…), déléguée ou associée. */
export async function searchFrenchCommunes(
  query: string,
  limit = 12,
  signal?: AbortSignal,
): Promise<FrenchCommune[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const localPostal = searchLocalPostalCommunes(trimmed, limit)
  if (localPostal) return localPostal

  if (POSTAL_CODE.test(trimmed)) {
    const remote = await searchCommunesByPostalCode(trimmed, limit, signal)
    return remote.slice(0, Math.max(limit * 2, 24))
  }

  const perType = Math.max(limit, 8)
  const batches = await Promise.all(
    COMMUNE_TYPES.map(async (type) => {
      const url = new URL('https://geo.api.gouv.fr/communes')
      url.searchParams.set('nom', trimmed)
      url.searchParams.set('boost', 'population')
      url.searchParams.set('fields', 'nom,code,codesPostaux,centre')
      url.searchParams.set('limit', String(perType))
      url.searchParams.set('type', type)

      const response = await fetch(url, { signal })
      if (!response.ok) return [] as FrenchCommune[]

      const data = (await response.json()) as ApiCommune[]
      return data.map(mapApiCommune)
    }),
  )

  const seen = new Set<string>()
  const merged: FrenchCommune[] = []
  for (const batch of batches) {
    for (const entry of batch) {
      if (seen.has(entry.code)) continue
      seen.add(entry.code)
      merged.push(entry)
    }
  }

  return merged.slice(0, Math.max(limit * 2, 24))
}

export function matchesCitySearch(source: string, query: string) {
  const sourceNorm = normalizeCity(source)
  const tokens = normalizeCity(query)
    .split(' ')
    .filter((token) => token && !CITY_STOP_WORDS.has(token))
  if (!tokens.length) return true
  return tokens.every((token) => {
    if (sourceNorm.includes(token)) return true
    const ordinal = token.match(/^(\d+)(e|er|eme)?$/)
    if (!ordinal) return false
    const n = ordinal[1]
    return sourceNorm.includes(`${n}e`) || sourceNorm.includes(`${n}eme`) || sourceNorm.includes(`${n}er`)
  })
}

export function formatCommuneLabel(commune: FrenchCommune) {
  if (!commune.postcodes.length) return commune.name
  const preview = commune.postcodes.slice(0, 2).join(', ')
  const suffix = commune.postcodes.length > 2 ? '…' : ''
  return `${commune.name} (${preview}${suffix})`
}

export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const centerCache = new Map<string, { lat: number; lng: number } | null>()

export async function lookupCommuneCenter(name: string, signal?: AbortSignal) {
  const key = normalizeCity(name)
  if (!key) return null
  if (centerCache.has(key)) return centerCache.get(key) ?? null

  const results = await searchFrenchCommunes(name, 8, signal)
  const exact = results.find((entry) => normalizeCity(entry.name) === key)
  const pick = exact ?? results.find((entry) => matchesCitySearch(entry.name, name)) ?? results[0]
  const center =
    pick && Number.isFinite(pick.lat) && Number.isFinite(pick.lng)
      ? { lat: pick.lat as number, lng: pick.lng as number }
      : null
  centerCache.set(key, center)
  return center
}
