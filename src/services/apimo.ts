import { supabase } from '../lib/supabase'

export type ApimoPropertyType = 'appartement' | 'maison' | 'terrain' | 'commerce' | 'bureau' | 'garage' | 'immeuble'

export type FeaturedProperty = {
  slug: string
  title: string
  city: string
  type: ApimoPropertyType
  agreementType?: number
  isRental?: boolean
  zipcode?: string
  price: number
  surface: number
  rooms: number
  bedrooms: number
  description?: string
  agent?: {
    name: string
    phone?: string
    email?: string
    picture?: string
  }
  badge?: 'Exclusivite' | 'Nouveau'
  amenities: Array<'jardin' | 'piscine' | 'terrasse' | 'garage'>
  images: string[]
  // Useful later for map sync if we ever feed these into Leaflet.
  lat?: number
  lng?: number
}

type ApimoRawProperty = Record<string, unknown>

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/\s+/g, '').replace(',', '.')
    const n = Number(cleaned)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function extractAmenities(raw: ApimoRawProperty): FeaturedProperty['amenities'] {
  const known: FeaturedProperty['amenities'] = []
  const amenitiesRaw = (raw.amenities ?? raw.equipements ?? raw.features) as unknown

  const list: string[] = Array.isArray(amenitiesRaw)
    ? (amenitiesRaw.filter(Boolean).map((x) => String(x)) as string[])
    : typeof amenitiesRaw === 'string'
      ? [amenitiesRaw]
      : []

  const joined = list.join(' ').toLowerCase()
  if (joined.includes('jardin')) known.push('jardin')
  if (joined.includes('piscine')) known.push('piscine')
  if (joined.includes('terrasse')) known.push('terrasse')
  if (joined.includes('garage')) known.push('garage')

  return Array.from(new Set(known))
}

function normalizeBadge(raw: ApimoRawProperty): FeaturedProperty['badge'] {
  const badge =
    (raw.badge as unknown as string | undefined) ??
    (raw.exclusivite ? 'Exclusivite' : undefined) ??
    (raw.is_new ? 'Nouveau' : undefined)

  if (typeof badge === 'string') {
    const s = badge.toLowerCase()
    if (s.includes('exclus')) return 'Exclusivite'
    if (s.includes('nouveau') || s.includes('new')) return 'Nouveau'
  }
  return undefined
}

function toOptionalNumber(value: unknown): number | undefined {
  const n = toNumber(value)
  return n
}

function mapTypeFromApimoType(apimoType: unknown): ApimoPropertyType {
  const n = toOptionalNumber(apimoType)
  if (n === undefined) return 'maison'
  // Apimo type mapping
  if (n === 1) return 'appartement'
  if (n === 2) return 'maison'
  if (n === 3) return 'terrain'
  if (n === 4) return 'commerce'
  if (n === 5) return 'bureau'
  if (n === 6) return 'garage'
  if (n === 7) return 'immeuble'
  return 'maison'
}

function mapFeaturedProperty(raw: ApimoRawProperty): FeaturedProperty {
  const property = raw as Record<string, unknown>

  const id = property.id
  const reference = property.reference

  const slug =
    typeof reference === 'string'
      ? reference
      : id != null
        ? String(id)
        : 'apimo'

  const cityObj = (property.city && typeof property.city === 'object' ? property.city : null) as
    | { name?: unknown; zipcode?: unknown }
    | null
  const cityName = (cityObj?.name as unknown) as string | undefined
  const zipcode = (cityObj?.zipcode as unknown) as string | undefined

  const areaObj = (property.area && typeof property.area === 'object' ? property.area : null) as
    | { value?: unknown }
    | null
  const surfaceValue = toOptionalNumber(areaObj?.value)

  const priceObj = (property.price && typeof property.price === 'object' ? property.price : null) as
    | { value?: unknown; period?: unknown }
    | null
  const priceValue = toOptionalNumber(priceObj?.value)
  const isRental = priceObj?.period !== null && priceObj?.period !== undefined

  const rooms = toOptionalNumber(property.rooms) ?? 0
  const bedrooms = toOptionalNumber(property.bedrooms) ?? 0

  // Title: city.name + area.value + "m²" (fallback to reference)
  const title =
    cityName && surfaceValue !== undefined ? `${cityName} ${surfaceValue}m²` : typeof reference === 'string' ? reference : 'Bien immobilier'

  const images = (() => {
    const picturesRaw = property.pictures
    if (!Array.isArray(picturesRaw)) return []
    const pictures = picturesRaw as Array<Record<string, unknown>>
    const sorted = [...pictures].sort((a, b) => {
      const ra = toOptionalNumber(a.rank) ?? 0
      const rb = toOptionalNumber(b.rank) ?? 0
      return ra - rb
    })
    return sorted
      .map((p) => (typeof p.url === 'string' ? p.url : null))
      .filter((x): x is string => Boolean(x))
  })()

  const latitude = toOptionalNumber(property.latitude)
  const longitude = toOptionalNumber(property.longitude)
  const agreementObj = (property.agreement && typeof property.agreement === 'object' ? property.agreement : null) as
    | { type?: unknown }
    | null
  const agreementType = toOptionalNumber(agreementObj?.type)

  // Description: sourced from `property.comments` (fr first, then fallback to first)
  const description = (() => {
    const commentsRaw = property.comments
    if (typeof commentsRaw === 'string') return commentsRaw.replace(/\r\n/g, '\n')
    if (!Array.isArray(commentsRaw)) return undefined

    const comments = commentsRaw.filter(
      (c): c is { language?: unknown; comment?: unknown } => Boolean(c) && typeof c === 'object',
    )

    const frenchComment = comments.find((c) => typeof c.language === 'string' && c.language.toLowerCase() === 'fr')
    const selectedComment = frenchComment ?? comments[0]

    if (!selectedComment || typeof selectedComment.comment !== 'string') return undefined
    return selectedComment.comment.replace(/\r\n/g, '\n')
  })()

  // Agent: sourced from `property.user` (name, phone, email, picture)
  const agent = (() => {
    const userRaw = property.user && typeof property.user === 'object' ? property.user : null
    if (!userRaw) return undefined
    const user = userRaw as Record<string, unknown>

    const name =
      (typeof user.name === 'string' ? user.name : undefined) ??
      (typeof user.fullName === 'string' ? user.fullName : undefined) ??
      ''

    const phone =
      (typeof user.phone === 'string' ? user.phone : undefined) ??
      (typeof user.telephone === 'string' ? user.telephone : undefined) ??
      (typeof user.tel === 'string' ? user.tel : undefined)

    const email =
      (typeof user.email === 'string' ? user.email : undefined) ??
      (typeof user.mail === 'string' ? user.mail : undefined)

    const pictureRaw = user.picture ?? user.photo ?? user.avatar
    const picture =
      (typeof pictureRaw === 'string' ? pictureRaw : undefined) ??
      (pictureRaw && typeof pictureRaw === 'object' && typeof (pictureRaw as any).url === 'string'
        ? (pictureRaw as any).url
        : undefined) ??
      (pictureRaw && typeof pictureRaw === 'object' && typeof (pictureRaw as any).src === 'string'
        ? (pictureRaw as any).src
        : undefined)

    if (!name && !phone && !email && !picture) return undefined

    return {
      name: name || 'Conseiller',
      phone,
      email,
      picture,
    }
  })()

  return {
    // Required fields (per request)
    slug,
    title,
    price: priceValue ?? 0,
    surface: surfaceValue ?? 0,
    rooms, // not in FeaturedProperty type, but kept for debug? (we don't have it)
    bedrooms,
    city: cityName ?? '',
    zipcode,
    lat: latitude,
    lng: longitude,
    images,
    type: mapTypeFromApimoType(property.type),
    agreementType,
    isRental,

    // Existing optional enrichments (may be empty depending on Apimo payload)
    badge: normalizeBadge(property),
    amenities: extractAmenities(property),

    // Detail-only fields
    description,
    agent,
  }
}

function extractList<T>(payload: unknown): T[] {
  if (!payload) {
    console.log('[apimo] extractList: payload is empty:', payload)
    return []
  }

  if (Array.isArray(payload)) {
    console.log('[apimo] extractList: payload is array, length:', payload.length)
    return payload as T[]
  }

  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    console.log('[apimo] extractList: payload keys:', Object.keys(obj))

    const dataVal = obj.data
    const resultsVal = obj.results
    const propertiesVal = obj.properties
    const itemsVal = obj.items

    console.log('[apimo] extractList: has arrays?',
      'data:', Array.isArray(dataVal),
      'results:', Array.isArray(resultsVal),
      'properties:', Array.isArray(propertiesVal),
      'items:', Array.isArray(itemsVal),
    )

    const firstArray =
      (Array.isArray(dataVal) ? dataVal : null) ??
      (Array.isArray(resultsVal) ? resultsVal : null) ??
      (Array.isArray(propertiesVal) ? propertiesVal : null) ??
      (Array.isArray(itemsVal) ? itemsVal : null) ??
      null

    if (firstArray) {
      console.log('[apimo] extractList: using array length:', (firstArray as unknown[]).length)
      return firstArray as T[]
    }
  }

  console.log('[apimo] extractList: no array found in payload')
  return []
}

async function getAllMappedProperties(): Promise<FeaturedProperty[]> {
  console.log('[apimo] getProperties: invoking edge function apimo-proxy with route=properties')

  const res = await supabase.functions.invoke('apimo-proxy', {
    body: { route: 'properties' },
  })

  const anyRes = res as any
  console.log('[apimo] getProperties: raw invoke response:', anyRes)
  console.log('[apimo] getProperties: invoke response keys:', anyRes ? Object.keys(anyRes) : [])
  console.log('[apimo] getProperties: invoke res.data:', anyRes?.data)
  console.log('[apimo] getProperties: invoke res.error:', anyRes?.error)

  // supabase-js returns { data, error } depending on version; keep tolerant parsing
  if ('error' in res && res.error) throw res.error

  const payload = (res as any).data ?? (res as any)
  console.log('[apimo] getProperties: payload for extractList:', payload)

  const rawList = extractList<ApimoRawProperty>(payload)
  console.log('[apimo] getProperties: extracted raw list length:', rawList.length)
  console.log(
    '[apimo] agreements:',
    rawList.map((p: any) => ({
      id: p.id,
      price: p.price?.value,
      agreement_type: p.agreement?.type,
    })),
  )
  console.log(
    '[apimo] agreement types sample:',
    rawList.slice(0, 5).map((p: any) => ({ id: p.id, agreement: p.agreement })),
  )
  const rental = rawList.find((p: any) => p.id === 86973766)
  console.log('[apimo] suspicious property full:', JSON.stringify(rental, null, 2))
  console.log('[apimo] unique types:', [...new Set(rawList.map((p: any) => p.type))])

  const uniqueCategories = [...new Set(rawList.map((p) => (p as Record<string, unknown>).category))]
  console.log('[apimo] categories found:', uniqueCategories)

  const categorySamples = (() => {
    const samples = new Map<unknown, string>()
    for (const item of rawList) {
      const propertyItem = item as Record<string, unknown>
      const category = propertyItem.category
      if (samples.has(category)) continue

      const cityObj =
        propertyItem.city && typeof propertyItem.city === 'object'
          ? (propertyItem.city as { name?: unknown })
          : undefined
      const cityName = typeof cityObj?.name === 'string' ? cityObj.name : undefined
      const reference = typeof propertyItem.reference === 'string' ? propertyItem.reference : undefined
      const sampleTitle = cityName ?? reference ?? String(propertyItem.id ?? 'N/A')
      samples.set(category, sampleTitle)
    }
    return Array.from(samples.entries()).map(([category, title]) => ({ category, title }))
  })()
  console.log('[apimo] category sample titles:', categorySamples)

  if (rawList.length) {
    const firstRaw = rawList[0]
    try {
      console.log('[apimo] first raw property:', JSON.stringify(firstRaw, null, 2))
    } catch (err) {
      console.error('[apimo] failed to stringify first raw property:', err)
    }
    console.log('[apimo] getProperties: first raw item keys:', Object.keys(firstRaw))
  }

  const mapped = rawList.map(mapFeaturedProperty)
  console.log('[apimo] getProperties: mapped properties count:', mapped.length)
  const filtered = mapped.filter((p) => p.images.length > 0 || p.title)
  console.log('[apimo] getProperties: filtered properties count (images or title):', filtered.length)

  return filtered
}

export async function getProperties(): Promise<FeaturedProperty[]> {
  const filtered = await getAllMappedProperties()
  return filtered.filter((p) => !p.isRental)
}

export async function getRentalProperties(): Promise<FeaturedProperty[]> {
  const filtered = await getAllMappedProperties()
  return filtered.filter((p) => p.isRental)
}

export async function getPropertyById(id: string | number): Promise<FeaturedProperty | null> {
  console.log('[apimo] getPropertyById: requested id:', id, 'type:', typeof id)

  const slugToFind = String(id)
  console.log('[apimo] getPropertyById: searching by slug:', slugToFind)

  const all = await getProperties()
  console.log('[apimo] getPropertyById: getProperties() returned count:', all.length)
  console.log('[apimo] getPropertyById: first mapped property slug:', all[0]?.slug)

  const matched = all.find((p) => p.slug === slugToFind)
  console.log('[apimo] getPropertyById: matched by slug?', Boolean(matched))

  return matched ?? null
}

