import { getNeighborhoodBySlug, type Neighborhood } from '../data/neighborhoods'
import type { CatalogMode } from '../search/criteria'

export function buildCatalogSearchFromNeighborhood(neighborhood: Neighborhood): URLSearchParams {
  const params = new URLSearchParams()
  params.set('q', neighborhood.name)
  return params
}

export function getCatalogListingHref(slug: string, mode: CatalogMode = 'sale'): string {
  const neighborhood = getNeighborhoodBySlug(slug)
  const base = mode === 'rent' ? '/louer' : '/acheter'
  if (!neighborhood) return base
  return `${base}?${buildCatalogSearchFromNeighborhood(neighborhood).toString()}`
}

export function applyQuartierParamToSearch(
  params: URLSearchParams,
  quartierSlug: string,
): URLSearchParams | null {
  const neighborhood = getNeighborhoodBySlug(quartierSlug)
  if (!neighborhood) return null

  const next = new URLSearchParams(params)
  next.delete('quartier')
  next.set('q', neighborhood.name)
  return next
}
