// ─────────────────────────────────────────────
// src/analytics/url.ts
// Nettoyage des URL et référents envoyés à GA4 (spécification §1.5 et §1.6).
// Règle : liste blanche de paramètres. Tout paramètre inconnu ou toute valeur
// suspecte est SUPPRIMÉ, jamais transmis ni journalisé.
// ─────────────────────────────────────────────

import { CITIES } from '../data/properties'
import { NEIGHBORHOODS } from '../data/neighborhoods'

// ── Détection de données personnelles ────────────────────────────────────────

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const FR_PHONE_RE = /(\+33|0033|0)[1-9]([\s.-]?\d{2}){4}/
const HEX_HASH_RE = /^[a-f0-9]{32,}$/i

/** true si la valeur ressemble à une donnée personnelle (email, téléphone, hachage). */
export function looksPersonal(value: string): boolean {
  if (value.includes('@')) return true
  if (EMAIL_RE.test(value)) return true
  if (FR_PHONE_RE.test(value)) return true
  if (/\d{9,}/.test(value.replace(/[\s.\-()+]/g, ''))) return true
  if (HEX_HASH_RE.test(value)) return true
  return false
}

// ── Communes autorisées (sources de confiance uniquement) ───────────────────

/** Normalisation commune aux sources et aux valeurs testées (§1.5). */
export function normalizeCommune(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[’‘ʼ`]/g, "'")
    .replace(/[\s\-']+/g, ' ')
    .trim()
}

const COMMUNE_FORMAT_RE = /^[\p{L}][\p{L}' -]{1,49}$/u

/** clé normalisée → libellé canonique. Seules des sources du code ou du catalogue serveur y entrent. */
const trustedCommunes = new Map<string, string>()

function addTrusted(label: string) {
  const trimmed = label.trim()
  if (!COMMUNE_FORMAT_RE.test(trimmed)) return
  const key = normalizeCommune(trimmed)
  if (key && !trustedCommunes.has(key)) trustedCommunes.set(key, trimmed)
}

for (const city of CITIES) addTrusted(city)
for (const neighborhood of NEIGHBORHOODS) addTrusted(neighborhood.name)

/**
 * Ajoute les communes du catalogue Apimo chargé par le proxy serveur.
 * À appeler UNIQUEMENT avec des données du catalogue, jamais avec l'URL ou une saisie.
 */
export function registerCatalogCommunes(cities: readonly string[]) {
  for (const city of cities) addTrusted(city)
}

/**
 * Libellé canonique d'une commune de confiance, ou null.
 * La valeur reçue sert seulement de clé : la valeur renvoyée vient toujours de la source.
 */
export function canonicalCommune(raw: string): string | null {
  if (!raw || raw.length > 50 || /[\u0000-\u001f]/.test(raw)) return null
  return trustedCommunes.get(normalizeCommune(raw)) ?? null
}

/** Liste de communes (séparées par des virgules) → libellés canoniques, ou 'hors_liste'. */
export function communeTerm(raw: string): { term: string; count: number } {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const allowed: string[] = []
  let rejected = false
  for (const part of parts) {
    const label = canonicalCommune(part)
    if (label) {
      if (!allowed.includes(label)) allowed.push(label)
    } else {
      rejected = true
    }
  }
  allowed.sort((a, b) => a.localeCompare(b, 'fr'))
  const pieces = rejected ? [...allowed, 'hors_liste'] : allowed
  let term = pieces.join(',') || 'hors_liste'
  if (term.length > 100) {
    const kept: string[] = []
    for (const piece of pieces) {
      const next = [...kept, piece].join(',')
      if (next.length > 92) break
      kept.push(piece)
    }
    term = `${kept.join(',')},…+${pieces.length - kept.length}`
  }
  return { term, count: parts.length }
}

// ── Paramètres d'URL autorisés ──────────────────────────────────────────────

export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
] as const

const UTM_VALUE_RE = /^[\p{L}\p{N} ._\-+|/:()]{1,100}$/u

function validUtm(value: string): boolean {
  return UTM_VALUE_RE.test(value) && !looksPersonal(value)
}

const NUMBER_RE = /^\d{1,8}$/
const SLUG_RE = /^[a-z0-9-]{1,60}$/
const TOKEN_LIST_RE = /^[a-z_]{1,30}(,[a-z_]{1,30}){0,9}$/

/** Paramètres fonctionnels du site (relevés dans le code) et leur règle de valeur. */
const SITE_PARAM_RULES: Record<string, (value: string) => string | null> = {
  type: (v) => (/^[a-z]{1,20}$/.test(v) ? v : null),
  budget: (v) => (NUMBER_RE.test(v) || v === 'all' ? v : null),
  budgetMin: (v) => (NUMBER_RE.test(v) ? v : null),
  budgetMax: (v) => (NUMBER_RE.test(v) || v === 'all' ? v : null),
  surface: (v) => (/^\d{1,5}$/.test(v) || v === 'all' ? v : null),
  rooms: (v) => (/^\d{1,2}$/.test(v) || v === 'all' ? v : null),
  radius: (v) => (/^\d{1,3}$/.test(v) ? v : null),
  amenities: (v) => (TOKEN_LIST_RE.test(v) ? v : null),
  sort: (v) => (['recent', 'price-asc', 'price-desc', 'surface'].includes(v) ? v : null),
  view: (v) => (v === 'map' || v === 'list' ? v : null),
  quartier: (v) => (SLUG_RE.test(v) ? v : null),
  projet: (v) => (/^[a-z-]{1,20}$/.test(v) ? v : null),
  // q : réécrit avec les libellés canoniques ; supprimé s'il ne contient aucune commune autorisée.
  q: (v) => {
    const { term } = communeTerm(v)
    return term === 'hors_liste' ? null : term
  },
}

function cleanSearch(search: URLSearchParams, options: { utm: boolean }): URLSearchParams {
  const out = new URLSearchParams()
  for (const [key, value] of search) {
    if (out.has(key)) continue
    if ((UTM_KEYS as readonly string[]).includes(key)) {
      if (options.utm && validUtm(value)) out.set(key, value)
      continue
    }
    const rule = SITE_PARAM_RULES[key]
    if (!rule || looksPersonal(value)) continue
    const cleaned = rule(value)
    if (cleaned !== null) out.set(key, cleaned)
  }
  return out
}

/** URL nettoyée : origine + chemin + paramètres autorisés. Fragment supprimé. */
export function sanitizeUrl(href: string, options: { utm: boolean } = { utm: true }): string | undefined {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
  const query = cleanSearch(url.searchParams, options).toString()
  const result = `${url.origin}${url.pathname}${query ? `?${query}` : ''}`
  return result.slice(0, 1000)
}

/** Référent : même origine → nettoyé comme une page ; externe → origine seule. */
export function sanitizeReferrer(referrer: string): string | undefined {
  if (!referrer) return undefined
  let url: URL
  try {
    url = new URL(referrer)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
  if (url.origin === location.origin) return sanitizeUrl(referrer)?.slice(0, 420)
  return `${url.origin}/`
}

// ── Mémoire de l'arrivée (en mémoire uniquement, jamais stockée) ────────────

export type CampaignFields = {
  campaign_source?: string
  campaign_medium?: string
  campaign_name?: string
  campaign_term?: string
  campaign_content?: string
  campaign_id?: string
}

const UTM_TO_CAMPAIGN: Record<string, keyof CampaignFields> = {
  utm_source: 'campaign_source',
  utm_medium: 'campaign_medium',
  utm_campaign: 'campaign_name',
  utm_term: 'campaign_term',
  utm_content: 'campaign_content',
  utm_id: 'campaign_id',
}

let landingCampaign: CampaignFields = {}
let landingReferrer: string | undefined

/** À appeler une seule fois au démarrage, avant toute navigation SPA. */
export function captureLanding() {
  landingReferrer = sanitizeReferrer(document.referrer)
  const params = new URL(location.href).searchParams
  const campaign: CampaignFields = {}
  for (const [utm, field] of Object.entries(UTM_TO_CAMPAIGN)) {
    const value = params.get(utm)
    if (value && validUtm(value)) campaign[field] = value
  }
  landingCampaign = campaign
}

export function getLandingReferrer(): string | undefined {
  return landingReferrer
}

/**
 * Champs campaign_* à transmettre à l'initialisation de la balise Google,
 * uniquement si le consentement arrive sur une page dont l'URL réelle n'a pas d'UTM
 * alors que l'URL d'arrivée en avait (acceptation tardive, D3).
 * L'URL de la page suivie n'est jamais complétée.
 */
export function lateConsentCampaign(currentHref: string): CampaignFields {
  if (Object.keys(landingCampaign).length === 0) return {}
  const current = new URL(currentHref).searchParams
  if (UTM_KEYS.some((key) => current.has(key))) return {}
  return { ...landingCampaign }
}
