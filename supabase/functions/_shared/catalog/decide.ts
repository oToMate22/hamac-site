// Décision de synchronisation : compare le dernier état connu (instantanés) avec un catalogue
// fraîchement lu et en déduit les créations, modifications, retraits et images à produire.
// Code pur et déterministe (testé sous Node : scripts/catalog-sync.test.ts).
//
// Règle d'or : une panne ou une réponse partielle ne doit JAMAIS retirer un bien valide.
// Un retrait exige `withdrawAfterRuns` catalogues complets, frais et cohérents d'affilée.
import {
  apimoUpdatedAt,
  candidatePhotoUrls,
  computeOgHash,
  isServable,
  listingId,
  listingKind,
  payloadHash,
  publicPayload,
  type ListingKind,
  type ListingStatus,
  type OgStatus,
  type RawListing,
} from './model.ts'

export type Snapshot = {
  id: string
  kind: ListingKind
  status: ListingStatus
  payloadHash: string
  updatedAtApimo: string | null
  ogHash: string | null
  ogStatus: OgStatus
  ogAttempts: number
  ogNextAttemptAt: string | null
  missingRuns: number
  withdrawnAt: string | null
}

/** Catalogue lu via apimo-proxy. */
export type CatalogRead =
  | {
      ok: true
      items: RawListing[]
      /** Toutes les pages et tous les statuts Apimo ont répondu. */
      complete: boolean
      /** false si apimo-proxy a servi son cache périmé faute de réponse Apimo. */
      fresh: boolean
      source: string
    }
  | { ok: false; status: number; error: string; retryAfterSeconds?: number }

export type SyncPolicy = {
  withdrawAfterRuns: number
  /** Baisse maximale tolérée du nombre de biens d'un run à l'autre avant de suspecter une anomalie. */
  maxDropRatio: number
  /** En dessous, la règle de baisse ne s'applique pas (petits catalogues). */
  dropCheckMinActive: number
  ogMaxAttempts: number
  ogRetryBaseMinutes: number
}

export const DEFAULT_POLICY: SyncPolicy = {
  withdrawAfterRuns: 2,
  maxDropRatio: 0.2,
  dropCheckMinActive: 10,
  ogMaxAttempts: 5,
  ogRetryBaseMinutes: 10,
}

export type Upsert = Snapshot & { payload: RawListing; change: 'new' | 'updated' | 'reactivated' | 'unchanged' }
export type OgJob = { id: string; ogHash: string; urls: string[]; attempt: number }

export type Decision = {
  /** Le catalogue permet-il de décider des retraits ? */
  trustworthy: boolean
  reason: string | null
  upserts: Upsert[]
  /** Biens absents de ce catalogue (mise à jour du compteur, éventuel retrait). */
  missing: Snapshot[]
  ogJobs: OgJob[]
  tags: string[]
  stats: { seen: number; created: number; updated: number; reactivated: number; pendingWithdrawal: number; withdrawn: number }
}

function minutesFrom(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60_000).toISOString()
}

export async function decide(
  previous: Snapshot[],
  read: CatalogRead,
  now: Date,
  policy: SyncPolicy = DEFAULT_POLICY,
): Promise<Decision> {
  const decision: Decision = {
    trustworthy: false,
    reason: null,
    upserts: [],
    missing: [],
    ogJobs: [],
    tags: [],
    stats: { seen: 0, created: 0, updated: 0, reactivated: 0, pendingWithdrawal: 0, withdrawn: 0 },
  }
  if (!read.ok) {
    decision.reason = `apimo-proxy HTTP ${read.status} : ${read.error}`
    return decision
  }

  const byId = new Map(previous.map((snap) => [snap.id, snap]))
  const seen = new Map<string, RawListing>()
  for (const raw of read.items) {
    const id = listingId(raw)
    // Minimisation : seuls les champs publics sont comparés et stockés (liste blanche).
    if (id) seen.set(id, publicPayload(raw))
  }
  decision.stats.seen = seen.size

  const previouslyServable = previous.filter((snap) => isServable(snap.status)).length
  const dropTooLarge =
    previouslyServable >= policy.dropCheckMinActive && seen.size < previouslyServable * (1 - policy.maxDropRatio)
  if (!read.complete) decision.reason = 'catalogue Apimo incomplet (page ou statut en erreur)'
  else if (!read.fresh) decision.reason = 'apimo-proxy a servi son cache périmé (Apimo indisponible)'
  else if (seen.size === 0 && previouslyServable > 0) decision.reason = 'catalogue vide inattendu'
  else if (dropTooLarge) decision.reason = `baisse anormale du catalogue (${previouslyServable} → ${seen.size})`
  decision.trustworthy = decision.reason === null

  const tags = new Set<string>()
  const touchKind = (kind: ListingKind) => {
    tags.add(`catalog-${kind}`)
    tags.add('sitemap')
  }

  // 1. Biens présents : toujours mis à jour (même si le catalogue est partiel, ce qui est lu est fiable).
  for (const [id, raw] of seen) {
    const prev = byId.get(id)
    const kind = listingKind(raw)
    const hash = await payloadHash(raw)
    const urls = candidatePhotoUrls(raw)
    const ogHash = await computeOgHash(urls)
    let change: Upsert['change'] = 'unchanged'
    if (!prev) change = 'new'
    else if (!isServable(prev.status)) change = 'reactivated'
    else if (prev.payloadHash !== hash || prev.kind !== kind) change = 'updated'

    const ogChanged = !prev || prev.ogHash !== ogHash
    const upsert: Upsert = {
      id,
      kind,
      status: 'active',
      payload: raw,
      payloadHash: hash,
      updatedAtApimo: apimoUpdatedAt(raw),
      ogHash,
      ogStatus: ogHash === null ? 'none' : ogChanged ? 'pending' : prev!.ogStatus,
      ogAttempts: ogChanged ? 0 : prev!.ogAttempts,
      ogNextAttemptAt: ogChanged ? null : prev!.ogNextAttemptAt,
      missingRuns: 0,
      withdrawnAt: null,
      change,
    }
    decision.upserts.push(upsert)

    if (change !== 'unchanged') {
      tags.add(`listing-${id}`)
      touchKind(kind)
      if (prev && prev.kind !== kind) touchKind(prev.kind)
      if (change === 'new') decision.stats.created++
      else if (change === 'updated') decision.stats.updated++
      else decision.stats.reactivated++
    } else if (prev && prev.status === 'pending_withdrawal') {
      // Revenu après une absence ponctuelle : rien à invalider, il était toujours servi.
    }

    // 2. Image de partage à produire ?
    if (ogHash && urls.length) {
      const due =
        upsert.ogStatus === 'pending' ||
        (upsert.ogStatus === 'failed' &&
          upsert.ogAttempts < policy.ogMaxAttempts &&
          (!upsert.ogNextAttemptAt || Date.parse(upsert.ogNextAttemptAt) <= now.getTime()))
      if (due) decision.ogJobs.push({ id, ogHash, urls, attempt: upsert.ogAttempts + 1 })
    }
  }

  // 3. Biens absents : uniquement si le catalogue est digne de confiance.
  if (decision.trustworthy) {
    for (const prev of previous) {
      if (seen.has(prev.id) || prev.status === 'withdrawn') continue
      const missingRuns = prev.missingRuns + 1
      const withdraw = missingRuns >= policy.withdrawAfterRuns
      decision.missing.push({
        ...prev,
        missingRuns,
        status: withdraw ? 'withdrawn' : 'pending_withdrawal',
        withdrawnAt: withdraw ? now.toISOString() : null,
      })
      if (withdraw) {
        decision.stats.withdrawn++
        tags.add(`listing-${prev.id}`)
        touchKind(prev.kind)
      } else decision.stats.pendingWithdrawal++
    }
  }

  decision.tags = [...tags].sort()
  return decision
}

/** Résultat d'une tentative de génération : nouvel état de l'image pour l'instantané. */
export function ogOutcome(
  job: OgJob,
  success: boolean,
  now: Date,
  policy: SyncPolicy = DEFAULT_POLICY,
): Pick<Snapshot, 'ogStatus' | 'ogAttempts' | 'ogNextAttemptAt'> {
  if (success) return { ogStatus: 'ready', ogAttempts: job.attempt, ogNextAttemptAt: null }
  // Délai croissant : 10, 20, 40, 80 min… plafonné à 12 h.
  const delay = Math.min(policy.ogRetryBaseMinutes * 2 ** (job.attempt - 1), 12 * 60)
  return { ogStatus: 'failed', ogAttempts: job.attempt, ogNextAttemptAt: minutesFrom(now, delay) }
}

/** Délai d'attente après un 429 ou une panne Apimo (secondes), selon le nombre d'échecs consécutifs. */
export function backoffSeconds(consecutiveFailures: number, retryAfterSeconds?: number, status?: number) {
  if (retryAfterSeconds && retryAfterSeconds > 0) return Math.min(retryAfterSeconds, 6 * 3600)
  if (status === 429) return Math.min(15 * 60 * 2 ** Math.max(0, consecutiveFailures - 1), 6 * 3600)
  // Panne réseau / 5xx : on réessaie au prochain créneau, puis on espace.
  if (consecutiveFailures <= 2) return 0
  return Math.min(5 * 60 * 2 ** (consecutiveFailures - 3), 3600)
}
