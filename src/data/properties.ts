export type PropertyType = 'appartement' | 'maison' | 'terrain' | 'commerce' | 'bureau' | 'garage' | 'immeuble'
export type Amenity = 'jardin' | 'piscine' | 'terrasse' | 'garage'

export type Property = {
  slug: string
  title: string
  city: string
  type: PropertyType
  price: number
  surface: number
  rooms: number
  bedrooms: number
  badge: 'Exclusivite' | 'Nouveau'
  reference: string
  description: string
  heating: string
  exposure: string
  year: number
  dpe: string
  lat: number
  lng: number
  amenities: Amenity[]
  images: string[]
}

export const CITIES = [
  'Sainte-Foy-lès-Lyon',
  'Tassin-la-Demi-Lune',
  'Écully',
  'Francheville',
  'Craponne',
  'Oullins',
]
