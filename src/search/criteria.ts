export type CatalogMode = 'sale' | 'rent'

export const TYPE_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'maison', label: 'Maison' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'bureau', label: 'Bureau' },
  { value: 'garage', label: 'Garage / Parking' },
  { value: 'immeuble', label: 'Immeuble' },
] as const

const SALE_BUDGET_MAX_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: '300000', label: "Jusqu'à 300 000 €" },
  { value: '500000', label: "Jusqu'à 500 000 €" },
  { value: '750000', label: "Jusqu'à 750 000 €" },
  { value: '1000000', label: "Jusqu'à 1 000 000 €" },
  { value: '1500000', label: "Jusqu'à 1 500 000 €" },
  { value: '2000000', label: "Jusqu'à 2 000 000 €" },
  { value: '3000000', label: "Jusqu'à 3 000 000 €" },
] as const

const RENT_BUDGET_MAX_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: '800', label: "Jusqu'à 800 € / mois" },
  { value: '1200', label: "Jusqu'à 1 200 € / mois" },
  { value: '1500', label: "Jusqu'à 1 500 € / mois" },
  { value: '2000', label: "Jusqu'à 2 000 € / mois" },
  { value: '2500', label: "Jusqu'à 2 500 € / mois" },
  { value: '3000', label: "Jusqu'à 3 000 € / mois" },
  { value: '4000', label: "Jusqu'à 4 000 € / mois" },
] as const

export const BUDGET_SLIDER_CAP: Record<CatalogMode, number> = {
  sale: 1_950_000,
  rent: 8_000,
}

export const BUDGET_SLIDER_STEP: Record<CatalogMode, number> = {
  sale: 50_000,
  rent: 100,
}

const KEYS_CLEARED_ON_ALL = new Set(['type', 'q', 'radius', 'surface', 'rooms', 'sort', 'amenities', 'budgetMin'])

export function budgetMaxOptions(mode: CatalogMode): ReadonlyArray<{ value: string; label: string }> {
  return mode === 'rent' ? RENT_BUDGET_MAX_OPTIONS : SALE_BUDGET_MAX_OPTIONS
}

export function catalogModeFromAction(action: string): CatalogMode {
  return action.includes('louer') ? 'rent' : 'sale'
}

export function formatEuroAmount(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(value)} €`
}

export function formatBudgetMaxLabel(value: number, mode: CatalogMode): string {
  const suffix = mode === 'rent' ? ' / mois' : ''
  return `Jusqu'à ${formatEuroAmount(value)}${suffix}`
}

/** `budgetMax` absent ou `all` = aucun plafond. Relit `budget` le temps de la compatibilité. */
export function parseBudgetMax(params: URLSearchParams): number | undefined {
  const raw = params.get('budgetMax') ?? params.get('budget')
  if (raw == null || raw === '' || raw === 'all') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

/** `budgetMin` absent, `all` ou `0` = aucun plancher. */
export function parseBudgetMin(params: URLSearchParams): number {
  const raw = params.get('budgetMin')
  if (raw == null || raw === '' || raw === 'all') return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export function searchBarBudgetValue(params: URLSearchParams): string {
  const raw = params.get('budgetMax') ?? params.get('budget')
  if (raw == null || raw === '') return 'all'
  return raw
}

export function applyCatalogParam(next: URLSearchParams, key: string, value: string) {
  if (key === 'budgetMax') {
    if (!value) next.delete('budgetMax')
    else next.set('budgetMax', value)
    next.delete('budget')
    return
  }

  if (key === 'budgetMin') {
    if (!value || value === 'all' || value === '0') next.delete('budgetMin')
    else next.set('budgetMin', value)
    return
  }

  if (!value || (KEYS_CLEARED_ON_ALL.has(key) && value === 'all')) next.delete(key)
  else next.set(key, value)
}
