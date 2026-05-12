import { useMemo } from 'react'
import { PROPERTIES, type Amenity, type Property } from '../data/properties'

export type PropertyFilters = {
  type?: string
  city?: string
  budgetMax?: number
  surfaceMin?: number
  bedroomsMin?: number
  q?: string
  amenities?: Amenity[]
}

export type PropertySort = 'recent' | 'price-asc' | 'price-desc' | 'surface'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export const useProperties = (filters: PropertyFilters, sort: PropertySort = 'recent') => {
  return useMemo(() => {
    const filtered = PROPERTIES.filter((property) => {
      if (filters.type && filters.type !== 'all' && property.type !== filters.type) return false
      if (filters.city && filters.city !== 'all' && normalize(property.city) !== normalize(filters.city)) return false
      if (filters.budgetMax && property.price > filters.budgetMax) return false
      if (filters.surfaceMin && property.surface < filters.surfaceMin) return false
      if (filters.bedroomsMin && property.bedrooms < filters.bedroomsMin) return false
      if (filters.q && !normalize(property.city).includes(normalize(filters.q))) return false
      if (filters.amenities?.length && !filters.amenities.every((entry) => property.amenities.includes(entry))) return false
      return true
    })

    const sorted = [...filtered]
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price)
    if (sort === 'surface') sorted.sort((a, b) => b.surface - a.surface)
    if (sort === 'recent') sorted.sort((a, b) => (a.reference < b.reference ? 1 : -1))

    return sorted
  }, [filters.amenities, filters.bedroomsMin, filters.budgetMax, filters.city, filters.q, filters.surfaceMin, filters.type, sort])
}

export const getPropertyBySlug = (slug: string): Property | undefined => PROPERTIES.find((entry) => entry.slug === slug)
