// Modèle commun du catalogue Hamac : code pur (aucune API Deno ni Node), partagé par
// les fonctions Edge Supabase (catalog-sync, listing-feed) et les fonctions Vercel (server/).
// Seules dépendances : WebCrypto (crypto.subtle) et TextEncoder, disponibles partout.

export type ListingKind = 'acheter' | 'louer'
export type ListingStatus = 'active' | 'pending_withdrawal' | 'withdrawn'
export type OgStatus = 'pending' | 'ready' | 'failed' | 'none'

/** Bien Apimo brut tel que renvoyé par apimo-proxy (on ne type que ce qui est lu). */
export type RawListing = Record<string, unknown> & {
  id?: unknown
  updated_at?: unknown
  price?: { period?: unknown } | null
  pictures?: Array<{ url?: unknown; rank?: unknown; internet?: unknown }> | null
}

/** Version du générateur d'images : la changer force la régénération de tout le catalogue. */
export const OG_GENERATOR_VERSION = 'og1'
/** Nombre de photos essayées pour l'image de partage (photo principale puis suivantes). */
export const OG_MAX_CANDIDATES = 5
export const LISTING_ID_PATTERN = /^\d{5,12}$/
export const OG_HASH_PATTERN = /^[0-9a-f]{12}$/
export const OG_FILE_PATTERN = /^(\d{5,12})-([0-9a-f]{12})\.jpg$/
/** Seul hôte autorisé pour télécharger une photo (protection SSRF). */
export const ALLOWED_PHOTO_HOST = 'media.apimo.pro'

export function listingId(raw: RawListing): string | null {
  const id = raw?.id
  if (id === null || id === undefined) return null
  const value = String(id).trim()
  return LISTING_ID_PATTERN.test(value) ? value : null
}

/** Même règle que le site (collect-routes, apimo.ts) : une période de prix = location. */
export function listingKind(raw: RawListing): ListingKind {
  const period = raw?.price && typeof raw.price === 'object' ? (raw.price as { period?: unknown }).period : undefined
  return period !== null && period !== undefined ? 'louer' : 'acheter'
}

export function listingPath(kind: ListingKind, id: string) {
  return `/${kind}/${id}`
}

export function isAllowedPhotoUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === ALLOWED_PHOTO_HOST && !url.username && !url.password
  } catch {
    return false
  }
}

/** Photos publiables triées par rang Apimo, limitées aux candidates de l'image de partage. */
export function candidatePhotoUrls(raw: RawListing, max = OG_MAX_CANDIDATES): string[] {
  const pictures = Array.isArray(raw?.pictures) ? raw.pictures : []
  return [...pictures]
    .filter((p) => p && p.internet !== 0 && p.internet !== false && p.internet !== '0')
    .sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0))
    .map((p) => p.url)
    .filter(isAllowedPhotoUrl)
    .slice(0, max)
}

const encoder = new TextEncoder()

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Empreinte de l'image de partage, calculable AVANT la génération : version du générateur
 * + URL des photos candidates. Apimo change l'URL (md5) quand une photo change, donc
 * l'empreinte change aussi → nouvelle URL d'image → caches WhatsApp/Facebook contournés.
 */
export async function computeOgHash(urls: string[]): Promise<string | null> {
  if (!urls.length) return null
  return (await sha256Hex(`${OG_GENERATOR_VERSION}\n${urls.join('\n')}`)).slice(0, 12)
}

export function ogFileName(id: string, ogHash: string) {
  return `${id}-${ogHash}.jpg`
}

/** JSON stable (clés triées) pour détecter toute modification d'un bien, même sans updated_at. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
  return `{${entries.join(',')}}`
}

export async function payloadHash(raw: RawListing) {
  return (await sha256Hex(stableStringify(raw))).slice(0, 16)
}

export function apimoUpdatedAt(raw: RawListing): string | null {
  const value = raw?.updated_at
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Liste BLANCHE des champs Apimo transmis hors de Supabase : uniquement ce que le site affiche ou
 * utilise (fiche, carte, filtres, JSON-LD). Tout autre champ — propriétaire, locataire, adresse,
 * cadastre, commentaires internes, journaux, données financières, ou tout champ ajouté plus tard
 * par Apimo — est retiré. Vérifié par scripts/catalog-sync.test.ts : le site rend exactement la
 * même fiche avec la charge filtrée qu'avec la charge complète, sur tout le catalogue réel.
 */
export const PUBLIC_KEYS = [
  'id',
  'reference',
  'type',
  'subtype',
  'category',
  'step',
  'status',
  'name',
  'city',
  'district',
  'latitude',
  'longitude',
  'area',
  'plot',
  'rooms',
  'bedrooms',
  'price',
  'floor',
  'heating',
  'water',
  'condition',
  'standing',
  'view',
  'construction',
  'orientations',
  'proximities',
  'services',
  'areas',
  'regulations',
  'comments',
  'pictures',
  'agreement',
  'availability',
  'available_at',
  'updated_at',
  'created_at',
  'user',
] as const

/** Sous-champs du conseiller (affiché sur la fiche) : pas de date de naissance, d'identifiants internes… */
export const PUBLIC_USER_KEYS = [
  'firstname',
  'lastname',
  'name',
  'fullName',
  'email',
  'mail',
  'phone',
  'mobile',
  'telephone',
  'tel',
  'picture',
  'photo',
  'avatar',
] as const

function pick(source: Record<string, unknown>, keys: readonly string[]) {
  const out: Record<string, unknown> = {}
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key]
  return out
}

export function publicPayload(raw: RawListing): RawListing {
  const copy = pick(raw, PUBLIC_KEYS) as RawListing
  if (copy.user && typeof copy.user === 'object') copy.user = pick(copy.user as Record<string, unknown>, PUBLIC_USER_KEYS)
  return copy
}

/** Résumé exposé par le flux (index) : assez pour le sitemap et le routage, sans le contenu. */
export type IndexEntry = {
  id: string
  kind: ListingKind
  status: ListingStatus
  updatedAt: string | null
  ogHash: string | null
  ogStatus: OgStatus
  withdrawnAt?: string | null
}

/** Réponse du flux pour un bien. */
export type FeedItem =
  | {
      status: 'active' | 'pending_withdrawal'
      id: string
      kind: ListingKind
      payload: RawListing
      ogHash: string | null
      ogStatus: OgStatus
      source: 'snapshot' | 'live'
      updatedAt: string | null
    }
  | { status: 'withdrawn'; id: string; kind: ListingKind; withdrawnAt: string | null }
  | { status: 'unknown'; id: string }

/** Une fiche « en cours de retrait » reste servie normalement (200) : un seul catalogue incomplet ne suffit pas. */
export function isServable(status: ListingStatus) {
  return status === 'active' || status === 'pending_withdrawal'
}
