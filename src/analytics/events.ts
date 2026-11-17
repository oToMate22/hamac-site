// ─────────────────────────────────────────────
// src/analytics/events.ts
// Schéma fermé des événements Analytics Hamac.
//
// Les descripteurs viennent du moteur générique. Les listes ci-dessous sont
// les valeurs métier autorisées. Aucun événement n'est émis depuis les pages :
// ce module ne fait que décrire et valider.
// ─────────────────────────────────────────────

import type { PropertyType } from '../data/properties'
import type { PropertySort } from '../hooks/useProperties'
import { TYPE_OPTIONS, type CatalogMode } from '../search/criteria'
import type { FormKind, SubmissionErrorCode } from '../services/submissions'
import type { PageType } from './pageType'
import {
  communeParam,
  countParam,
  defineSchema,
  enumParam,
  numberParam,
  refParam,
  validateParams,
  type FailureReason,
  type InferredParams,
} from './params'
import { canonicalCommune } from './url'

function assertTrue<_T extends true>(): void {}

export const PROPERTY_REF_PATTERN = /^[a-z0-9-]{1,60}$/

export const CATALOG_PROPERTY_TYPES = [
  'maison',
  'appartement',
  'terrain',
  'commerce',
  'bureau',
  'garage',
  'immeuble',
] as const

export const ESTIMATE_PROPERTY_TYPES = ['maison', 'appartement', 'terrain'] as const

export const OFFMARKET_PROPERTY_TYPES = ['Maison', 'Appartement', 'Les deux'] as const

export const OFFMARKET_SECTORS = [
  'Sainte-Foy-lès-Lyon',
  'Tassin-la-Demi-Lune',
  'Écully',
  'Francheville',
  'Craponne',
  'Oullins',
  "Tout l'Ouest Lyonnais",
] as const

export const LISTING_KINDS = ['sale', 'rent'] as const

export const FORM_KINDS = ['contact', 'bien', 'estimation', 'offmarket'] as const

export const ERROR_CODES = ['turnstile', 'rate_limited', 'invalid', 'network', 'server'] as const

export const PAGE_TYPES = [
  'home',
  'listing_sale',
  'listing_rent',
  'property',
  'estimate',
  'contact',
  'offmarket',
  'selling',
  'invest',
  'agency',
  'neighborhood_index',
  'neighborhood',
  'blog_index',
  'blog_post',
  'legal',
  'not_found',
] as const

export const PHONE_CTAS = [
  'nav_phone',
  'footer_phone',
  'contact_phone',
  'property_phone',
  'property_mobile_phone',
  'listing_phone',
  'neighborhood_phone',
  'legal_phone',
] as const

export const EMAIL_CTAS = ['footer_email', 'contact_email', 'property_email', 'legal_email'] as const

/** Plafonds existants, jamais un montant saisi. Le préfixe distingue vente et location. */
export const BUDGET_MAX = [
  'sale_to_300000',
  'sale_to_500000',
  'sale_to_750000',
  'sale_to_1000000',
  'sale_to_1500000',
  'sale_to_2000000',
  'sale_to_3000000',
  'rent_to_800',
  'rent_to_1200',
  'rent_to_1500',
  'rent_to_2000',
  'rent_to_2500',
  'rent_to_3000',
  'rent_to_4000',
] as const

/** Pas du curseur catalogue : 10, 20, … 300. */
export const SURFACE_MIN = [
  '10', '20', '30', '40', '50', '60', '70', '80', '90', '100',
  '110', '120', '130', '140', '150', '160', '170', '180', '190', '200',
  '210', '220', '230', '240', '250', '260', '270', '280', '290', '300',
] as const

export const SORTS = ['recent', 'price-asc', 'price-desc', 'surface'] as const

export const VIEWS = ['map', 'list'] as const

export const FILTER_AXES = [
  'property_type',
  'city',
  'budget_max',
  'surface_min',
  'bedrooms_min',
  'sort',
  'view',
] as const

type CatalogPropertyType = (typeof CATALOG_PROPERTY_TYPES)[number]
type FromTypeOptions = Exclude<(typeof TYPE_OPTIONS)[number]['value'], 'all'>

type _ListsMatch = [
  Exclude<PageType, (typeof PAGE_TYPES)[number]>,
  Exclude<(typeof PAGE_TYPES)[number], PageType>,
  Exclude<PropertyType, CatalogPropertyType>,
  Exclude<CatalogPropertyType, PropertyType>,
  Exclude<FromTypeOptions, CatalogPropertyType>,
  Exclude<CatalogPropertyType, FromTypeOptions>,
  Exclude<(typeof ESTIMATE_PROPERTY_TYPES)[number], CatalogPropertyType>,
  Exclude<CatalogMode, (typeof LISTING_KINDS)[number]>,
  Exclude<(typeof LISTING_KINDS)[number], CatalogMode>,
  Exclude<FormKind, (typeof FORM_KINDS)[number]>,
  Exclude<(typeof FORM_KINDS)[number], FormKind>,
  Exclude<SubmissionErrorCode, (typeof ERROR_CODES)[number]>,
  Exclude<(typeof ERROR_CODES)[number], SubmissionErrorCode>,
  Exclude<PropertySort, (typeof SORTS)[number]>,
  Exclude<(typeof SORTS)[number], PropertySort>,
] extends [never, never, never, never, never, never, never, never, never, never, never, never, never, never, never]
  ? true
  : never

assertTrue<_ListsMatch>()

const propertyRef = refParam(PROPERTY_REF_PATTERN)
const catalogType = enumParam(CATALOG_PROPERTY_TYPES)
const city = communeParam(canonicalCommune)
const listingKind = enumParam(LISTING_KINDS)
const budgetMax = enumParam(BUDGET_MAX)
const surfaceMin = enumParam(SURFACE_MIN)
const bedroomsMin = numberParam({ min: 1, max: 4, integer: true })
const sort = enumParam(SORTS)
const view = enumParam(VIEWS)
const resultsCount = countParam(500)

const pageViewSchema = defineSchema({})

const propertyViewSchema = defineSchema({
  property_ref: propertyRef,
  property_type: catalogType,
  city,
  listing_kind: listingKind,
})

const propertySearchSchema = defineSchema({
  results_count: resultsCount,
  property_type: catalogType,
  city,
  listing_kind: listingKind,
  budget_max: budgetMax,
  surface_min: surfaceMin,
  bedrooms_min: bedroomsMin,
  sort,
  view,
})

const propertyFilterSchema = defineSchema({
  filter_axis: enumParam(FILTER_AXES),
  property_type: catalogType,
  city,
  budget_max: budgetMax,
  surface_min: surfaceMin,
  bedrooms_min: bedroomsMin,
  sort,
  view,
})

const noSearchResultsSchema = defineSchema({
  results_count: numberParam({ min: 0, max: 0, integer: true }),
  property_type: catalogType,
  city,
  listing_kind: listingKind,
  budget_max: budgetMax,
  surface_min: surfaceMin,
  bedrooms_min: bedroomsMin,
  sort,
  view,
})

const contactSubmitSchema = defineSchema({
  form: enumParam(['contact']),
})

const propertyInquirySchema = defineSchema({
  form: enumParam(['bien']),
  property_ref: propertyRef,
})

const estimateSubmitSchema = defineSchema({
  form: enumParam(['estimation']),
  property_type: enumParam(ESTIMATE_PROPERTY_TYPES),
  city,
  surface: countParam(9999),
  rooms: numberParam({ min: 1, max: 7, integer: true }),
})

const offmarketSubmitSchema = defineSchema({
  form: enumParam(['offmarket']),
  property_type: enumParam(OFFMARKET_PROPERTY_TYPES),
  sector: enumParam(OFFMARKET_SECTORS),
})

const phoneClickSchema = defineSchema({
  cta: enumParam(PHONE_CTAS),
  page_type: enumParam(PAGE_TYPES),
})

const emailClickSchema = defineSchema({
  cta: enumParam(EMAIL_CTAS),
  page_type: enumParam(PAGE_TYPES),
})

const formErrorSchema = defineSchema({
  form: enumParam(FORM_KINDS),
  error_code: enumParam(ERROR_CODES),
})

const generateLeadSchema = defineSchema({
  form: enumParam(FORM_KINDS),
})

export const EVENT_SCHEMAS = {
  page_view: pageViewSchema,
  property_view: propertyViewSchema,
  property_search: propertySearchSchema,
  property_filter: propertyFilterSchema,
  no_search_results: noSearchResultsSchema,
  contact_submit: contactSubmitSchema,
  property_inquiry_submit: propertyInquirySchema,
  estimate_submit: estimateSubmitSchema,
  offmarket_submit: offmarketSubmitSchema,
  phone_click: phoneClickSchema,
  email_click: emailClickSchema,
  form_error: formErrorSchema,
  generate_lead: generateLeadSchema,
} as const

export type AnalyticsEventName = keyof typeof EVENT_SCHEMAS

const REQUIRED_KEYS = {
  page_view: [],
  property_view: ['property_ref', 'property_type', 'listing_kind'],
  property_search: ['listing_kind', 'results_count'],
  property_filter: ['filter_axis'],
  no_search_results: ['listing_kind', 'results_count'],
  contact_submit: ['form'],
  property_inquiry_submit: ['form', 'property_ref'],
  estimate_submit: ['form', 'property_type', 'surface'],
  offmarket_submit: ['form'],
  phone_click: ['cta', 'page_type'],
  email_click: ['cta', 'page_type'],
  form_error: ['form', 'error_code'],
  generate_lead: ['form'],
} as const satisfies { [E in AnalyticsEventName]: readonly string[] }

type SchemaOf<E extends AnalyticsEventName> = (typeof EVENT_SCHEMAS)[E]
type OptionalParams<E extends AnalyticsEventName> = InferredParams<SchemaOf<E>>
type RequiredOf<E extends AnalyticsEventName> = (typeof REQUIRED_KEYS)[E][number]

type FilterAxis = (typeof FILTER_AXES)[number]
type FilterCompanion = {
  property_type: CatalogPropertyType
  city: string
  budget_max: (typeof BUDGET_MAX)[number]
  surface_min: (typeof SURFACE_MIN)[number]
  bedrooms_min: number
  sort: (typeof SORTS)[number]
  view: (typeof VIEWS)[number]
}

type StrictFilter<A extends Exclude<FilterAxis, 'city'>> = {
  readonly filter_axis: A
} & { readonly [K in A]: FilterCompanion[A] }

/** `city` peut être omis : une commune non canonique ne rejette pas le filtre. */
export type PropertyFilterParams =
  | { readonly filter_axis: 'city'; readonly city?: string }
  | { [A in Exclude<FilterAxis, 'city'>]: StrictFilter<A> }[Exclude<FilterAxis, 'city'>]

type WithRequired<E extends AnalyticsEventName> = RequiredOf<E> extends never
  ? OptionalParams<E>
  : Omit<OptionalParams<E>, RequiredOf<E>> & {
      readonly [K in RequiredOf<E>]-?: Exclude<OptionalParams<E>[K & keyof OptionalParams<E>], undefined>
    }

export type EventParams<E extends AnalyticsEventName> = E extends 'property_filter'
  ? PropertyFilterParams
  : E extends 'no_search_results'
    ? Omit<WithRequired<E>, 'results_count'> & { readonly results_count: 0 }
    : WithRequired<E>

export type EventFailureReason = FailureReason | 'missing_key' | 'inconsistent'

export type EventValidation<E extends AnalyticsEventName> =
  | { readonly ok: true; readonly params: EventParams<E> }
  | { readonly ok: false; readonly reason: EventFailureReason; readonly keys: readonly string[] }

function fail(reason: EventFailureReason, keys: readonly string[] = []): EventValidation<never> {
  return { ok: false, reason, keys }
}

function missingKeys(params: object, keys: readonly string[]): string[] {
  const missing: string[] = []
  for (const key of keys) {
    if (!Object.hasOwn(params, key)) missing.push(key)
  }
  return missing
}

function companionKeys(params: object): FilterAxis[] {
  const found: FilterAxis[] = []
  for (const key of FILTER_AXES) {
    if (Object.hasOwn(params, key)) found.push(key)
  }
  return found
}

const EVENTS_WITH_CITY = new Set<AnalyticsEventName>([
  'property_view',
  'property_search',
  'property_filter',
  'no_search_results',
  'estimate_submit',
])

function isAmbiguousCity(value: string): boolean {
  return value.includes(',') || value.includes('hors_liste') || value.includes('…')
}

/** Libellé canonique, ou undefined si la commune ne doit pas être transmise. */
function canonicalCity(value: string): string | undefined {
  if (isAmbiguousCity(value)) return undefined
  const resolved = canonicalCommune(value)
  if (typeof resolved !== 'string' || resolved.length === 0) return undefined
  return resolved
}

/**
 * Prépare `city` avant la validation.
 * Seule la forme canonique est conservée. Une commune inconnue, absente,
 * multiple ou ambiguë est retirée : l'événement n'est pas rejeté pour ce motif.
 * Une valeur d'un autre type est laissée au moteur, qui la refuse.
 */
function prepareCity(event: AnalyticsEventName, input: unknown): unknown {
  if (!EVENTS_WITH_CITY.has(event)) return input
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return input
  if (!Object.hasOwn(input, 'city')) return input

  const current = Object.getOwnPropertyDescriptor(input, 'city')
  if (!current || 'get' in current || 'set' in current) return input

  const value = current.value
  const omit = value == null || Array.isArray(value) || (typeof value === 'string' && canonicalCity(value) === undefined)
  const canonical = typeof value === 'string' ? canonicalCity(value) : undefined
  if (!omit && canonical === undefined) return input

  const prepared = Object.create(null) as object
  for (const key of Object.getOwnPropertyNames(input)) {
    if (key === 'city') continue
    const property = Object.getOwnPropertyDescriptor(input, key)
    if (property) Object.defineProperty(prepared, key, property)
  }
  for (const symbol of Object.getOwnPropertySymbols(input)) {
    const property = Object.getOwnPropertyDescriptor(input, symbol)
    if (property) Object.defineProperty(prepared, symbol, property)
  }
  if (canonical !== undefined) {
    Object.defineProperty(prepared, 'city', {
      value: canonical,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  }
  return prepared
}

function budgetAgreesWithListing(params: object): boolean {
  if (!Object.hasOwn(params, 'budget_max') || !Object.hasOwn(params, 'listing_kind')) return true
  const budget = Object.getOwnPropertyDescriptor(params, 'budget_max')?.value
  const listing = Object.getOwnPropertyDescriptor(params, 'listing_kind')?.value
  if (listing === 'sale' && typeof budget === 'string') return budget.startsWith('sale_to_')
  if (listing === 'rent' && typeof budget === 'string') return budget.startsWith('rent_to_')
  return false
}

function crossRules(event: AnalyticsEventName, params: object): EventValidation<never> | null {
  if (event === 'property_filter') {
    const axis = Object.getOwnPropertyDescriptor(params, 'filter_axis')?.value
    const companions = companionKeys(params)
    if (axis === 'city') {
      if (companions.length === 0) return null
      if (companions.length !== 1 || companions[0] !== 'city') {
        return fail('inconsistent', ['filter_axis', ...companions])
      }
      return null
    }
    if (companions.length === 0) return fail('missing_key', typeof axis === 'string' ? [axis] : [])
    if (companions.length !== 1 || companions[0] !== axis) {
      return fail('inconsistent', ['filter_axis', ...companions])
    }
  }
  if (event === 'no_search_results') {
    const count = Object.getOwnPropertyDescriptor(params, 'results_count')?.value
    if (count !== 0) return fail('invalid_value', ['results_count'])
  }
  if ((event === 'property_search' || event === 'no_search_results') && !budgetAgreesWithListing(params)) {
    return fail('inconsistent', ['listing_kind', 'budget_max'])
  }
  return null
}

/**
 * Valide un événement contre son schéma.
 * Une clé inconnue, une valeur invalide, un paramètre obligatoire absent
 * ou une règle croisée non respectée rejette l'objet entier.
 * Une commune non canonique est omise, elle ne rejette pas l'événement.
 * Le résultat d'échec ne contient pas les valeurs.
 */
export function validateEvent<E extends AnalyticsEventName>(event: E, input: unknown): EventValidation<E> {
  const validated = validateParams(EVENT_SCHEMAS[event], prepareCity(event, input))
  if (!validated.ok) return validated

  const absent = missingKeys(validated.params, REQUIRED_KEYS[event])
  if (absent.length > 0) return fail('missing_key', absent) as EventValidation<E>

  const crossed = crossRules(event, validated.params)
  if (crossed) return crossed as EventValidation<E>

  return { ok: true, params: validated.params as EventParams<E> }
}
