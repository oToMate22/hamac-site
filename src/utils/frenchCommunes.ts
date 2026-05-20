export type FrenchCommune = {
  name: string
  code: string
  postcodes: string[]
}

type ApiCommune = {
  nom: string
  code: string
  codesPostaux?: string[]
}

export async function searchFrenchCommunes(
  query: string,
  limit = 12,
  signal?: AbortSignal,
): Promise<FrenchCommune[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const url = new URL('https://geo.api.gouv.fr/communes')
  url.searchParams.set('nom', trimmed)
  url.searchParams.set('fields', 'nom,code,codesPostaux')
  url.searchParams.set('boost', 'population')
  url.searchParams.set('limit', String(limit))

  const response = await fetch(url, { signal })
  if (!response.ok) return []

  const data = (await response.json()) as ApiCommune[]
  return data.map((entry) => ({
    name: entry.nom,
    code: entry.code,
    postcodes: entry.codesPostaux ?? [],
  }))
}

export function formatCommuneLabel(commune: FrenchCommune) {
  if (!commune.postcodes.length) return commune.name
  const preview = commune.postcodes.slice(0, 2).join(', ')
  const suffix = commune.postcodes.length > 2 ? '…' : ''
  return `${commune.name} (${preview}${suffix})`
}
