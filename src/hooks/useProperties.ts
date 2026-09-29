import type { Amenity } from '../data/properties'

export type PropertyFilters = {
  type?: string
  city?: string
  budgetMin?: number
  budgetMax?: number
  surfaceMin?: number
  bedroomsMin?: number
  q?: string
  amenities?: Amenity[]
}

export type PropertySort = 'recent' | 'price-asc' | 'price-desc' | 'surface'
