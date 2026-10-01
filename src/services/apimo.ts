import { supabase } from '../lib/supabase'
import {
  AREATYPE_LABELS,
  CONDITION_LABELS,
  FLOOR_LABELS,
  HEATINGACCESS_LABELS,
  HEATINGDEVICE_LABELS,
  HEATINGTYPE_LABELS,
  HOTWATERACCESS_LABELS,
  HOTWATERDEVICE_LABELS,
  ORIENTATION_LABELS,
  PROXIMITY_LABELS,
  VIEWTYPE_LABELS,
  WASTEWATER_LABELS,
  type ApimoLabelMap,
} from './apimoCatalogs'

const isSupabaseConfigured = () =>
  Boolean(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim())

export type ApimoPropertyType = 'appartement' | 'maison' | 'terrain' | 'commerce' | 'bureau' | 'garage' | 'immeuble'

/** Étiquette DPE ou GES : classe (A→G) et/ou valeur chiffrée. */
export type EnergyRating = {
  class?: string
  value?: number
}

/** Une pièce du bien (section « Surfaces »). */
export type PropertyAreaEntry = {
  label: string
  count: number
  surface?: number
}

/** Caractéristiques détaillées (section « Sommaire »). */
export type PropertyDetails = {
  reference?: string
  surfaceTotal?: number
  floorLabel?: string
  floorsTotal?: string
  condition?: string
  exposures?: string[]
  view?: string
  /** Appareil de chauffage (« Type de chauffage »). */
  heatingType?: string
  /** Énergie de chauffage (« Énergie de chauffage »). */
  heatingEnergy?: string
  /** Mode de chauffage : individuel / collectif (« Moyen de chauffage »). */
  heatingMode?: string
  hotWaterDevice?: string
  hotWaterMode?: string
  wasteWater?: string
}

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
  // Détails enrichis (fiche bien)
  details?: PropertyDetails
  areas?: PropertyAreaEntry[]
  proximities?: string[]
  energy?: EnergyRating
  ges?: EnergyRating
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

function labelFrom(map: ApimoLabelMap, code: unknown): string | undefined {
  if (code === null || code === undefined) return undefined
  if (typeof code === 'object') return undefined
  return map[String(code)]
}

const FRENCH_NUMBER_WORDS: Record<string, number> = {
  une: 1,
  un: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
}

/**
 * Apimo renvoie parfois `bedrooms: 0` (donnée manquante). On tente alors de
 * retrouver le nombre de chambres dans la description (« 3 chambres », « trois
 * belles chambres »…). Renvoie undefined si rien d'exploitable.
 */
function inferBedroomsFromText(text?: string): number | undefined {
  if (!text) return undefined
  const normalized = text.toLowerCase()
  const candidates: number[] = []

  const adjectives = '(?:belles?\\s+|grandes?\\s+|jolies?\\s+|spacieuses?\\s+|vastes?\\s+)?'

  const numericPattern = new RegExp(`(\\d+)\\s*${adjectives}chambres?\\b`, 'g')
  let match: RegExpExecArray | null
  while ((match = numericPattern.exec(normalized)) !== null) {
    const n = Number(match[1])
    if (Number.isFinite(n) && n > 0 && n <= 30) candidates.push(n)
  }

  const wordPattern = new RegExp(
    `\\b(une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\\s+${adjectives}chambres?\\b`,
    'g',
  )
  while ((match = wordPattern.exec(normalized)) !== null) {
    const n = FRENCH_NUMBER_WORDS[match[1]]
    if (n) candidates.push(n)
  }

  if (!candidates.length) return undefined
  return Math.max(...candidates)
}

function isEnergyClass(value: unknown): value is string {
  return typeof value === 'string' && /^[A-G]$/i.test(value.trim())
}

/** DPE (type 1 valeur, 166 classe) + GES (type 2 valeur, 167 classe). */
function extractRatings(raw: ApimoRawProperty): { energy?: EnergyRating; ges?: EnergyRating } {
  const regsRaw = raw.regulations
  if (!Array.isArray(regsRaw)) return {}
  const regs = regsRaw.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')

  const find = (type: number) => regs.find((r) => toOptionalNumber(r.type) === type)

  const resolveClass = (classReg?: Record<string, unknown>, valueReg?: Record<string, unknown>) => {
    if (classReg && isEnergyClass(classReg.value)) return String(classReg.value).toUpperCase()
    if (valueReg && isEnergyClass(valueReg.label)) return String(valueReg.label).toUpperCase()
    return undefined
  }

  const resolveValue = (valueReg?: Record<string, unknown>) => {
    const n = valueReg ? toOptionalNumber(valueReg.value) : undefined
    return n !== undefined && n > 0 ? n : undefined
  }

  const energyValueReg = find(1)
  const gesValueReg = find(2)

  const energyRating: EnergyRating = {
    class: resolveClass(find(166), energyValueReg),
    value: resolveValue(energyValueReg),
  }
  const gesRating: EnergyRating = {
    class: resolveClass(find(167), gesValueReg),
    value: resolveValue(gesValueReg),
  }

  return {
    energy: energyRating.class || energyRating.value !== undefined ? energyRating : undefined,
    ges: gesRating.class || gesRating.value !== undefined ? gesRating : undefined,
  }
}

function extractAreaEntries(raw: ApimoRawProperty): PropertyAreaEntry[] {
  const areasRaw = raw.areas
  if (!Array.isArray(areasRaw)) return []

  const entries: PropertyAreaEntry[] = []
  for (const item of areasRaw) {
    if (!item || typeof item !== 'object') continue
    const area = item as Record<string, unknown>
    const label = labelFrom(AREATYPE_LABELS, area.type)
    if (!label) continue
    const surface = toOptionalNumber(area.area)
    const count = toOptionalNumber(area.number) ?? 1
    entries.push({ label, count, surface })
  }
  return entries
}

function extractProximities(raw: ApimoRawProperty): string[] {
  const proximitiesRaw = raw.proximities
  if (!Array.isArray(proximitiesRaw)) return []
  const labels = proximitiesRaw
    .map((code) => labelFrom(PROXIMITY_LABELS, code))
    .filter((label): label is string => Boolean(label))
  return Array.from(new Set(labels))
}

function extractDetails(raw: ApimoRawProperty, surfaceValue?: number): PropertyDetails {
  const details: PropertyDetails = {}

  const reference = raw.reference
  if (typeof reference === 'string' && reference.trim()) details.reference = reference.trim()

  const areaObj = (raw.area && typeof raw.area === 'object' ? raw.area : null) as { total?: unknown } | null
  const totalSurface = toOptionalNumber(areaObj?.total)
  if (totalSurface !== undefined && totalSurface > 0 && totalSurface !== surfaceValue) {
    details.surfaceTotal = totalSurface
  }

  const floorObj = (raw.floor && typeof raw.floor === 'object' ? raw.floor : null) as
    | { type?: unknown; floors?: unknown }
    | null
  const floorLabel = labelFrom(FLOOR_LABELS, floorObj?.type)
  if (floorLabel) details.floorLabel = floorLabel
  const floorsTotal = floorObj?.floors
  if (typeof floorsTotal === 'string' && floorsTotal.trim()) details.floorsTotal = floorsTotal.trim()
  else if (typeof floorsTotal === 'number' && Number.isFinite(floorsTotal)) details.floorsTotal = String(floorsTotal)

  const condition = labelFrom(CONDITION_LABELS, raw.condition)
  if (condition) details.condition = condition

  const orientationsRaw = raw.orientations
  if (Array.isArray(orientationsRaw)) {
    const exposures = orientationsRaw
      .map((code) => labelFrom(ORIENTATION_LABELS, code))
      .filter((label): label is string => Boolean(label))
    if (exposures.length) details.exposures = Array.from(new Set(exposures))
  }

  const viewObj = (raw.view && typeof raw.view === 'object' ? raw.view : null) as { type?: unknown } | null
  const view = labelFrom(VIEWTYPE_LABELS, viewObj?.type)
  if (view) details.view = view

  const heatingObj = (raw.heating && typeof raw.heating === 'object' ? raw.heating : null) as
    | { device?: unknown; type?: unknown; access?: unknown }
    | null
  const heatingType = labelFrom(HEATINGDEVICE_LABELS, heatingObj?.device)
  if (heatingType) details.heatingType = heatingType
  const heatingEnergy = labelFrom(HEATINGTYPE_LABELS, heatingObj?.type)
  if (heatingEnergy) details.heatingEnergy = heatingEnergy
  const heatingMode = labelFrom(HEATINGACCESS_LABELS, heatingObj?.access)
  if (heatingMode) details.heatingMode = heatingMode

  const waterObj = (raw.water && typeof raw.water === 'object' ? raw.water : null) as
    | { hot_device?: unknown; hot_access?: unknown; waste?: unknown }
    | null
  const hotWaterDevice = labelFrom(HOTWATERDEVICE_LABELS, waterObj?.hot_device)
  if (hotWaterDevice) details.hotWaterDevice = hotWaterDevice
  const hotWaterMode = labelFrom(HOTWATERACCESS_LABELS, waterObj?.hot_access)
  if (hotWaterMode) details.hotWaterMode = hotWaterMode
  const wasteWater = labelFrom(WASTEWATER_LABELS, waterObj?.waste)
  if (wasteWater) details.wasteWater = wasteWater

  return details
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

  // Apimo renvoie parfois 0 chambre (donnée manquante) : on tente de la déduire
  // de la description plutôt que d'afficher « 0 chambre ».
  const resolvedBedrooms = bedrooms > 0 ? bedrooms : inferBedroomsFromText(description) ?? 0

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
    bedrooms: resolvedBedrooms,
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

    // Détails enrichis (fiche bien)
    details: extractDetails(property, surfaceValue),
    areas: extractAreaEntries(property),
    proximities: extractProximities(property),
    ...extractRatings(property),
  }
}

function extractList<T>(payload: unknown): T[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>

    const dataVal = obj.data
    const resultsVal = obj.results
    const propertiesVal = obj.properties
    const itemsVal = obj.items

    const firstArray =
      (Array.isArray(dataVal) ? dataVal : null) ??
      (Array.isArray(resultsVal) ? resultsVal : null) ??
      (Array.isArray(propertiesVal) ? propertiesVal : null) ??
      (Array.isArray(itemsVal) ? itemsVal : null) ??
      null

    if (firstArray) {
      return firstArray as T[]
    }
  }

  return []
}

const LOCAL_PROPERTIES_CACHE = 'hamac:apimo-properties'
const LOCAL_PROPERTIES_CACHE_AT = 'hamac:apimo-properties-at'
const CATALOG_FETCH_TIMEOUT_MS = 45_000

export class CatalogLoadError extends Error {
  readonly status?: number
  readonly kind: 'quota' | 'timeout' | 'network'

  constructor(kind: 'quota' | 'timeout' | 'network', message: string, status?: number) {
    super(message)
    this.name = 'CatalogLoadError'
    this.kind = kind
    this.status = status
  }
}

export type CatalogFetchResult = {
  properties: FeaturedProperty[]
  cacheServedAt?: number
}

function readLocalPropertiesCache(): { properties: FeaturedProperty[]; savedAt?: number } | null {
  try {
    const raw = sessionStorage.getItem(LOCAL_PROPERTIES_CACHE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FeaturedProperty[]
    if (!Array.isArray(parsed) || !parsed.length) return null
    const savedRaw = sessionStorage.getItem(LOCAL_PROPERTIES_CACHE_AT)
    const savedAt = savedRaw ? Number(savedRaw) : undefined
    return { properties: parsed, savedAt: Number.isFinite(savedAt) ? savedAt : undefined }
  } catch {
    return null
  }
}

function writeLocalPropertiesCache(properties: FeaturedProperty[]) {
  try {
    sessionStorage.setItem(LOCAL_PROPERTIES_CACHE, JSON.stringify(properties))
    sessionStorage.setItem(LOCAL_PROPERTIES_CACHE_AT, String(Date.now()))
  } catch {
    // quota / private mode
  }
}

function extractHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const record = error as {
    context?: { status?: number }
    status?: number
    data?: { status?: number }
    message?: string
  }
  if (typeof record.context?.status === 'number') return record.context.status
  if (typeof record.status === 'number') return record.status
  if (typeof record.data?.status === 'number') return record.data.status
  try {
    const raw = JSON.stringify(error)
    if (raw.includes('"status":429') || raw.includes('Too Many Requests')) return 429
  } catch {
    /* ignore */
  }
  if (typeof record.message === 'string' && record.message.includes('429')) return 429
  return undefined
}

function isAbortLike(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { name?: string; message?: string; context?: { name?: string } }
  if (record.name === 'AbortError') return true
  if (record.context?.name === 'AbortError') return true
  return typeof record.message === 'string' && /aborted|AbortError/i.test(record.message)
}

function toCatalogLoadError(error: unknown): CatalogLoadError {
  if (error instanceof CatalogLoadError) return error
  const status = extractHttpStatus(error)
  if (status === 429) {
    return new CatalogLoadError('quota', 'Quota Apimo atteint', 429)
  }
  if (isAbortLike(error)) {
    return new CatalogLoadError('timeout', 'Délai de chargement dépassé', 408)
  }
  return new CatalogLoadError('network', error instanceof Error ? error.message : 'Impossible de charger les biens', status)
}

async function invokeCatalog(signal?: AbortSignal) {
  return supabase.functions.invoke('apimo-proxy', {
    body: { route: 'properties' },
    signal,
    timeout: CATALOG_FETCH_TIMEOUT_MS,
  })
}

function mapRawList(payload: unknown): FeaturedProperty[] {
  const rawList = extractList<ApimoRawProperty>(payload)
  return rawList.map(mapFeaturedProperty).filter((p) => p.images.length > 0 || p.title)
}

async function getAllMappedProperties(signal?: AbortSignal): Promise<CatalogFetchResult> {
  if (!isSupabaseConfigured()) {
    return { properties: [] }
  }

  try {
    const res = await invokeCatalog(signal)
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const payload = (res as { data?: unknown }).data ?? res
    const statusFromBody =
      payload && typeof payload === 'object' && 'status' in payload
        ? Number((payload as { status?: unknown }).status)
        : undefined

    if ('error' in res && res.error) {
      if (signal?.aborted) throw res.error
      const status = extractHttpStatus(res.error) ?? (statusFromBody === 429 ? 429 : undefined)
      const cached = readLocalPropertiesCache()
      if (cached) return { properties: cached.properties, cacheServedAt: cached.savedAt }
      throw toCatalogLoadError(
        status === 429 ? new CatalogLoadError('quota', 'Quota Apimo atteint', 429) : res.error,
      )
    }

    if (statusFromBody === 429) {
      const cached = readLocalPropertiesCache()
      if (cached) return { properties: cached.properties, cacheServedAt: cached.savedAt }
      throw new CatalogLoadError('quota', 'Quota Apimo atteint', 429)
    }

    const mapped = mapRawList(payload)
    if (mapped.length) {
      writeLocalPropertiesCache(mapped)
      return { properties: mapped }
    }

    const cached = readLocalPropertiesCache()
    if (cached) return { properties: cached.properties, cacheServedAt: cached.savedAt }
    return { properties: [] }
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw error
    }
    const cached = readLocalPropertiesCache()
    if (cached) return { properties: cached.properties, cacheServedAt: cached.savedAt }
    throw toCatalogLoadError(error)
  }
}

export async function getProperties(): Promise<FeaturedProperty[]> {
  const filtered = (await getAllMappedProperties()).properties
  return filtered.filter((p) => !p.isRental)
}

export async function getRentalProperties(): Promise<FeaturedProperty[]> {
  const filtered = (await getAllMappedProperties()).properties
  return filtered.filter((p) => p.isRental)
}

export async function fetchCatalogProperties(
  mode: 'sale' | 'rent',
  signal?: AbortSignal,
): Promise<CatalogFetchResult> {
  const result = await getAllMappedProperties(signal)
  const properties =
    mode === 'rent'
      ? result.properties.filter((property) => property.isRental)
      : result.properties.filter((property) => !property.isRental && property.agreementType !== 2)
  return { properties, cacheServedAt: result.cacheServedAt }
}

export async function getPropertyById(id: string | number): Promise<FeaturedProperty | null> {
  const slugToFind = String(id)

  const all = await getProperties()

  const matched = all.find((p) => p.slug === slugToFind)

  return matched ?? null
}

