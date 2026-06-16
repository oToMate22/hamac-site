import { getNeighborhoodBySlug, type Neighborhood } from '../data/neighborhoods'

const DEFAULT_BUDGET_MIN_SALE = 650_000
const DEFAULT_BUDGET_MAX_SALE = 1_950_000
const DEFAULT_BUDGET_MAX_RENT = 3_000

export function buildCatalogSearchFromNeighborhood(
  neighborhood: Neighborhood,
  mode: 'sale' | 'rent' = 'sale',
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('city', neighborhood.name)
  params.set('q', neighborhood.name)
  params.set('budgetMin', String(mode === 'rent' ? 0 : DEFAULT_BUDGET_MIN_SALE))
  params.set('budget', String(mode === 'rent' ? DEFAULT_BUDGET_MAX_RENT : DEFAULT_BUDGET_MAX_SALE))
  return params
}

export function getCatalogListingHref(slug: string, mode: 'sale' | 'rent' = 'sale'): string {
  const neighborhood = getNeighborhoodBySlug(slug)
  const base = mode === 'rent' ? '/louer' : '/acheter'
  if (!neighborhood) return base
  return `${base}?${buildCatalogSearchFromNeighborhood(neighborhood, mode).toString()}`
}

export function applyQuartierParamToSearch(
  params: URLSearchParams,
  quartierSlug: string,
  mode: 'sale' | 'rent' = 'sale',
): URLSearchParams | null {
  const neighborhood = getNeighborhoodBySlug(quartierSlug)
  if (!neighborhood) return null

  const next = new URLSearchParams(params)
  next.delete('quartier')
  next.set('city', neighborhood.name)
  next.set('q', neighborhood.name)
  if (!next.has('budgetMin')) next.set('budgetMin', String(mode === 'rent' ? 0 : DEFAULT_BUDGET_MIN_SALE))
  if (!next.has('budget')) {
    next.set('budget', String(mode === 'rent' ? DEFAULT_BUDGET_MAX_RENT : DEFAULT_BUDGET_MAX_SALE))
  }
  return next
}
