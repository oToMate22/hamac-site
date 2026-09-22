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

const normalizeCity = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Commune actuelle, arrondissement (Lyon 5e…), déléguée ou associée. */
export async function searchFrenchCommunes(
  query: string,
  limit = 12,
  signal?: AbortSignal,
): Promise<FrenchCommune[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const perType = Math.max(limit, 8)
  const batches = await Promise.all(
    COMMUNE_TYPES.map(async (type) => {
      const url = new URL('https://geo.api.gouv.fr/communes')
      url.searchParams.set('nom', trimmed)
      url.searchParams.set('fields', 'nom,code,codesPostaux,centre')
      url.searchParams.set('boost', 'population')
      url.searchParams.set('limit', String(perType))
      url.searchParams.set('type', type)

      const response = await fetch(url, { signal })
      if (!response.ok) return [] as FrenchCommune[]

      const data = (await response.json()) as ApiCommune[]
      return data.map((entry) => ({
        name: entry.nom,
        code: entry.code,
        postcodes: entry.codesPostaux ?? [],
        lat: entry.centre?.coordinates[1],
        lng: entry.centre?.coordinates[0],
      }))
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
