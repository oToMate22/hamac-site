// Données Apimo autorisées hors de Supabase : liste blanche PROFONDE, appliquée côté serveur.
// Utilisée par apimo-proxy (navigateur, clé anon), listing-feed (Vercel) et catalog-sync (instantanés).
// Tout champ absent d'une règle est retiré, à chaque niveau, y compris un champ ajouté plus tard par Apimo.
// Contrôlé par scripts/apimo-public.test.ts.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** Règle d'un champ : valeur simple, objet décrit, liste d'éléments décrits, ou liste de valeurs simples. */
type Rule =
  | 'scalar'
  | 'scalars'
  | 'labels'
  | { object: Record<string, Rule> }
  | { list: Record<string, Rule>; keep?: (item: Record<string, unknown>) => boolean }

/** Statuts Apimo affichés par le site (1 = en cours, 22 = offre, 29 = autre). */
export const PUBLISHED_STATUSES = ['1', '22', '29'] as const

/** Coordonnées arrondies à 3 décimales (environ 110 m × 80 m) quand l'adresse n'est pas publiée. */
export const COARSE_COORDINATE_DECIMALS = 3

const PUBLISHED_PICTURE = (item: Record<string, unknown>) => {
  const flag = item.internet
  return !(flag === 0 || flag === false || flag === '0')
}

const RULES: Record<string, Rule> = {
  id: 'scalar',
  reference: 'scalar',
  type: 'scalar',
  subtype: 'scalar',
  category: 'scalar',
  step: 'scalar',
  status: 'scalar',
  name: 'scalar',
  rooms: 'scalar',
  bedrooms: 'scalar',
  condition: 'scalar',
  standing: 'scalar',
  availability: 'scalar',
  available_at: 'scalar',
  updated_at: 'scalar',
  created_at: 'scalar',
  orientations: 'scalars',
  proximities: 'scalars',
  services: 'scalars',
  city: { object: { id: 'scalar', name: 'scalar', zipcode: 'scalar' } },
  district: { object: { id: 'scalar', name: 'scalar' } },
  area: { object: { total: 'scalar', unit: 'scalar', value: 'scalar', weighted: 'scalar' } },
  plot: { object: { height: 'scalar', land_type: 'scalar', net_floor: 'scalar', serviced_plot: 'scalar', width: 'scalar' } },
  floor: { object: { floors: 'scalar', levels: 'scalar', type: 'scalar', value: 'scalar' } },
  heating: { object: { access: 'scalar', device: 'scalar', devices: 'scalars', type: 'scalar', types: 'scalars' } },
  water: { object: { hot_access: 'scalar', hot_device: 'scalar', waste: 'scalar' } },
  // Sans coût de rénovation.
  construction: { object: { construction_year: 'scalar', construction_step: 'scalar', method: 'scalar', renovation_year: 'scalar' } },
  view: { object: { landscape: 'scalars', type: 'scalar' } },
  // Prix affiché uniquement : ni commissions, ni honoraires, ni dépôt, ni frais, ni part locataire, ni rente.
  price: { object: { value: 'scalar', currency: 'scalar', period: 'scalar', hide: 'scalar', max: 'scalar', unit: 'scalar' } },
  // Type de mandat (exclusif ou non) : ni numéro, ni dates.
  agreement: { object: { type: 'scalar' } },
  // Pièces : ni prix ni numéro de lot.
  areas: {
    list: {
      type: 'scalar',
      number: 'scalar',
      area: 'scalar',
      floor: 'scalar',
      orientations: 'scalars',
      comments: 'scalar',
      flooring: 'scalar',
      ceiling_height: 'scalar',
      beds: 'scalar',
    },
  },
  comments: {
    list: { language: 'scalar', title: 'scalar', subtitle: 'scalar', hook: 'scalar', comment: 'scalar', comment_full: 'scalar' },
  },
  pictures: {
    list: {
      id: 'scalar',
      rank: 'scalar',
      url: 'scalar',
      width_max: 'scalar',
      height_max: 'scalar',
      comments: { list: { language: 'scalar', comment: 'scalar' } },
      panorama: 'scalar',
      child: 'scalar',
      type_id: 'scalar',
    },
    keep: PUBLISHED_PICTURE,
  },
  regulations: {
    list: { type: 'scalar', value: 'scalar', date: 'scalar', label: 'scalar', graph: 'scalar', graph_i18ns: 'labels' },
  },
  // Conseiller : coordonnées professionnelles affichées sur la fiche (domaine de l'agence).
  // Ni date de naissance, ni mobile, ni identifiants internes, ni dates de compte.
  user: {
    object: {
      firstname: 'scalar',
      lastname: 'scalar',
      name: 'scalar',
      fullName: 'scalar',
      email: 'scalar',
      mail: 'scalar',
      phone: 'scalar',
      telephone: 'scalar',
      tel: 'scalar',
      picture: 'scalar',
      photo: 'scalar',
      avatar: 'scalar',
    },
  },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isScalar = (value: unknown): value is string | number | boolean | null =>
  value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))

function applyRule(rule: Rule, value: unknown): Json | undefined {
  if (rule === 'scalar') return isScalar(value) ? value : undefined
  if (rule === 'scalars') {
    if (isScalar(value)) return value
    return Array.isArray(value) ? value.filter(isScalar) : undefined
  }
  if (rule === 'labels') {
    if (!isRecord(value)) return undefined
    const out: Record<string, Json> = {}
    for (const [key, label] of Object.entries(value)) if (typeof label === 'string') out[key] = label
    return out
  }
  if ('object' in rule) return isRecord(value) ? applyObject(rule.object, value) : value === null ? null : undefined
  if (!Array.isArray(value)) return undefined
  return value
    .filter(isRecord)
    .filter((item) => (rule.keep ? rule.keep(item) : true))
    .map((item) => applyObject(rule.list, item))
}

function applyObject(rules: Record<string, Rule>, source: Record<string, unknown>): Record<string, Json> {
  const out: Record<string, Json> = {}
  for (const [key, rule] of Object.entries(rules)) {
    if (!Object.hasOwn(source, key)) continue
    const value = applyRule(rule, source[key])
    if (value !== undefined) out[key] = value
  }
  return out
}

function coarse(value: unknown): number | undefined {
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number)) return undefined
  const factor = 10 ** COARSE_COORDINATE_DECIMALS
  return Math.round(number * factor) / factor
}

function exact(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && Number.isFinite(Number(value))) return value
  return undefined
}

/** Un bien Apimo réduit aux champs que le site affiche. */
export function sanitizeListing(raw: unknown): Record<string, Json> | null {
  if (!isRecord(raw)) return null
  const out = applyObject(RULES, raw)
  // Coordonnées : exactes seulement si l'agence publie l'adresse du bien ; l'adresse elle-même n'est jamais transmise.
  const precise = raw.publish_address === true || raw.publish_address === 1 || raw.publish_address === '1'
  const latitude = precise ? exact(raw.latitude) : coarse(raw.latitude)
  const longitude = precise ? exact(raw.longitude) : coarse(raw.longitude)
  if (latitude !== undefined && longitude !== undefined) {
    out.latitude = latitude
    out.longitude = longitude
  }
  // Indicateur seul (pas l'adresse) : un second filtrage garde ainsi la même précision.
  out.publish_address = precise
  return out
}

export function isPublishedStatus(raw: unknown): boolean {
  return isRecord(raw) && (PUBLISHED_STATUSES as readonly string[]).includes(String(raw.status))
}

/**
 * Réponse publique d'apimo-proxy : enveloppe reconstruite (aucun champ d'Apimo recopié tel quel),
 * biens publiés uniquement, chacun filtré. S'applique aussi aux réponses lues dans les caches.
 */
export function publicCatalogEnvelope(payload: unknown): Record<string, Json> {
  const source = isRecord(payload) ? payload : {}
  const list = Array.isArray(source.properties) ? source.properties : Array.isArray(payload) ? payload : []
  const properties = list.filter(isPublishedStatus).map(sanitizeListing).filter((item): item is Record<string, Json> => item !== null)
  const meta = isRecord(source.sync_meta) ? source.sync_meta : null
  const complete = typeof meta?.complete === 'boolean' ? meta.complete : true
  const dropped = list.length - properties.length
  const total = Number(source.total_items)
  return {
    properties,
    total_items: Number.isFinite(total) ? Math.max(0, total - dropped) : properties.length,
    fetched_items: properties.length,
    status_filter: PUBLISHED_STATUSES.join(','),
    sync_meta: { complete },
  }
}
