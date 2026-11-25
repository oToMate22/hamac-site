// Orchestration d'un run de synchronisation, indépendante de l'environnement :
// les accès (base, stockage, Vercel, e-mail) sont injectés. catalog-sync/index.ts branche Supabase ;
// scripts/catalog-sync.test.ts et scripts/simulate-catalog.ts branchent des doubles en mémoire.
import { backoffSeconds, decide, DEFAULT_POLICY, ogOutcome, type CatalogRead, type OgJob, type Snapshot, type SyncPolicy, type Upsert } from './decide.ts'
import { ogFileName, OG_FILE_PATTERN } from './model.ts'

export type SyncMode = 'observe' | 'active'

export type SyncState = {
  enabled: boolean
  mode: SyncMode
  backoffUntil: string | null
  consecutiveFailures: number
  failingSince: string | null
  lastSuccessAt: string | null
  lastAlertAt: string | null
  lastCleanupAt: string | null
}

export type SnapshotWrite = Upsert & { lastSeenAt: string }
export type SnapshotPatch = Partial<Snapshot> & { id: string; ogLastError?: string | null }

export type RunRecord = {
  startedAt: string
  finishedAt: string
  outcome: 'ok' | 'degraded' | 'failed' | 'skipped'
  mode: SyncMode
  trustworthy: boolean | null
  reason: string | null
  httpStatus: number | null
  source: string | null
  seen: number
  created: number
  updated: number
  reactivated: number
  pendingWithdrawal: number
  withdrawn: number
  ogGenerated: number
  ogFailed: number
  revalidatedTags: number
  durationMs: number
  details: Record<string, unknown>
}

export type RenderResult = { ok: true; bytes: Uint8Array; sourceIndex: number } | { ok: false; error: string }

export type SyncDeps = {
  now(): Date
  readCatalog(): Promise<CatalogRead>
  store: {
    getState(): Promise<SyncState>
    updateState(patch: Partial<SyncState>): Promise<void>
    tryLock(): Promise<boolean>
    releaseLock(): Promise<void>
    listSnapshots(): Promise<Snapshot[]>
    writeSnapshots(rows: SnapshotWrite[]): Promise<void>
    patchSnapshots(rows: SnapshotPatch[]): Promise<void>
    insertRun(run: RunRecord): Promise<void>
  }
  images: {
    exists(file: string): Promise<boolean>
    put(file: string, bytes: Uint8Array): Promise<void>
    list(): Promise<Array<{ name: string; createdAt: string | null }>>
    remove(files: string[]): Promise<void>
  }
  /** null : Vercel non configuré (aucune génération ni invalidation). */
  site: null | {
    renderOg(job: OgJob): Promise<RenderResult>
    revalidate(tags: string[]): Promise<boolean>
  }
  alert(subject: string, text: string): Promise<void>
  log(message: string): void
  options?: Partial<SyncOptions>
}

export type SyncOptions = {
  policy: SyncPolicy
  /** Images générées au plus par run (le rattrapage initial s'étale sur plusieurs runs). */
  ogJobsPerRun: number
  /** Alerte après X minutes sans run fiable. */
  alertAfterMinutes: number
  /** Une alerte au plus toutes les X heures. */
  alertRepeatHours: number
  /** Les images remplacées restent X jours (aperçus WhatsApp déjà envoyés). */
  cleanupGraceDays: number
  /** Un nettoyage au plus toutes les X heures. */
  cleanupEveryHours: number
}

export const DEFAULT_OPTIONS: SyncOptions = {
  policy: DEFAULT_POLICY,
  ogJobsPerRun: 12,
  alertAfterMinutes: 60,
  alertRepeatHours: 6,
  cleanupGraceDays: 30,
  cleanupEveryHours: 24,
}

const MAX_JPEG_BYTES = 512 * 1024

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
}

function hoursBetween(a: string | null, now: Date) {
  return a ? (now.getTime() - Date.parse(a)) / 3_600_000 : Number.POSITIVE_INFINITY
}

export async function runSync(deps: SyncDeps): Promise<RunRecord> {
  const options = { ...DEFAULT_OPTIONS, ...deps.options }
  const started = deps.now()
  const startedMs = Date.now()
  const state = await deps.store.getState()
  const record: RunRecord = {
    startedAt: started.toISOString(),
    finishedAt: started.toISOString(),
    outcome: 'skipped',
    mode: state.mode,
    trustworthy: null,
    reason: null,
    httpStatus: null,
    source: null,
    seen: 0,
    created: 0,
    updated: 0,
    reactivated: 0,
    pendingWithdrawal: 0,
    withdrawn: 0,
    ogGenerated: 0,
    ogFailed: 0,
    revalidatedTags: 0,
    durationMs: 0,
    details: {},
  }
  const finish = async () => {
    record.finishedAt = deps.now().toISOString()
    record.durationMs = Date.now() - startedMs
    await deps.store.insertRun(record)
    return record
  }

  if (!state.enabled) {
    record.reason = 'synchronisation désactivée'
    return finish()
  }
  if (state.backoffUntil && Date.parse(state.backoffUntil) > started.getTime()) {
    // Pas d'appel Apimo pendant un backoff (quota) : on ne journalise pas chaque créneau sauté.
    record.reason = `backoff jusqu'à ${state.backoffUntil}`
    deps.log(record.reason)
    return record
  }
  if (!(await deps.store.tryLock())) {
    record.reason = 'un run est déjà en cours'
    deps.log(record.reason)
    return record
  }

  try {
    const read = await deps.readCatalog()
    if (!read.ok) {
      const failures = state.consecutiveFailures + 1
      const wait = backoffSeconds(failures, read.retryAfterSeconds, read.status)
      record.outcome = 'failed'
      record.httpStatus = read.status
      record.reason = read.error
      await deps.store.updateState({
        consecutiveFailures: failures,
        failingSince: state.failingSince ?? started.toISOString(),
        backoffUntil: wait > 0 ? new Date(started.getTime() + wait * 1000).toISOString() : null,
      })
      record.details.backoffSeconds = wait
      await maybeAlert(deps, options, { ...state, failingSince: state.failingSince ?? started.toISOString() }, started, record)
      return finish()
    }

    record.source = read.source
    const previous = await deps.store.listSnapshots()
    const decision = await decide(previous, read, started, options.policy)
    record.trustworthy = decision.trustworthy
    record.reason = decision.reason
    Object.assign(record, {
      seen: decision.stats.seen,
      created: decision.stats.created,
      updated: decision.stats.updated,
      reactivated: decision.stats.reactivated,
      pendingWithdrawal: decision.stats.pendingWithdrawal,
      withdrawn: decision.stats.withdrawn,
    })

    // Écritures : seuls les biens qui changent (payload, statut, image, compteur d'absence).
    const previousById = new Map(previous.map((snap) => [snap.id, snap]))
    const writes: SnapshotWrite[] = decision.upserts
      .filter((row) => {
        const prev = previousById.get(row.id)
        return (
          !prev ||
          row.change !== 'unchanged' ||
          prev.status !== 'active' ||
          prev.missingRuns !== 0 ||
          prev.ogHash !== row.ogHash
        )
      })
      .map((row) => ({ ...row, lastSeenAt: started.toISOString() }))
    if (writes.length) await deps.store.writeSnapshots(writes)
    if (decision.missing.length) {
      await deps.store.patchSnapshots(
        decision.missing.map((snap) => ({
          id: snap.id,
          status: snap.status,
          missingRuns: snap.missingRuns,
          withdrawnAt: snap.withdrawnAt,
        })),
      )
    }

    const tags = new Set(decision.tags)
    if (state.mode === 'active' && deps.site) {
      const generated = await processOgJobs(deps, options, decision.ogJobs, previousById, tags, started)
      record.ogGenerated = generated.ok
      record.ogFailed = generated.failed
      record.details.ogPending = Math.max(0, decision.ogJobs.length - generated.ok - generated.failed)
      if (tags.size) {
        const ok = await deps.site.revalidate([...tags])
        record.revalidatedTags = ok ? tags.size : 0
        if (!ok) record.details.revalidateError = true
      }
      if (hoursBetween(state.lastCleanupAt, started) >= options.cleanupEveryHours) {
        record.details.cleanup = await cleanupImages(deps, options, started)
        await deps.store.updateState({ lastCleanupAt: started.toISOString() })
      }
    } else {
      record.details.ogPending = decision.ogJobs.length
      record.details.tagsNotSent = [...tags].length
    }

    if (decision.trustworthy) {
      record.outcome = 'ok'
      await deps.store.updateState({
        consecutiveFailures: 0,
        failingSince: null,
        backoffUntil: null,
        lastSuccessAt: started.toISOString(),
      })
    } else {
      // Lecture partielle ou périmée : données conservées, aucun retrait, et on surveille la durée.
      record.outcome = 'degraded'
      const failingSince = state.failingSince ?? started.toISOString()
      await deps.store.updateState({ consecutiveFailures: state.consecutiveFailures + 1, failingSince, backoffUntil: null })
      await maybeAlert(deps, options, { ...state, failingSince }, started, record)
    }
    return finish()
  } catch (error) {
    record.outcome = 'failed'
    record.reason = `erreur interne : ${(error as Error).message}`
    await deps.store.updateState({
      consecutiveFailures: state.consecutiveFailures + 1,
      failingSince: state.failingSince ?? started.toISOString(),
    })
    return finish()
  } finally {
    await deps.store.releaseLock()
  }
}

async function processOgJobs(
  deps: SyncDeps,
  options: SyncOptions,
  jobs: OgJob[],
  previousById: Map<string, Snapshot>,
  tags: Set<string>,
  now: Date,
) {
  let ok = 0
  let failed = 0
  const patches: SnapshotPatch[] = []
  // Les nouvelles fiches d'abord (premier partage), puis les rattrapages.
  const ordered = [...jobs].sort((a, b) => Number(previousById.has(a.id)) - Number(previousById.has(b.id)))
  for (const job of ordered.slice(0, options.ogJobsPerRun)) {
    const file = ogFileName(job.id, job.ogHash)
    let success = false
    let error: string | null = null
    try {
      // Idempotent : une image déjà stockée (réactivation, run interrompu) n'est pas regénérée.
      if (await deps.images.exists(file)) success = true
      else {
        const result = await deps.site!.renderOg(job)
        if (!result.ok) error = result.error
        else if (!isJpeg(result.bytes)) error = 'réponse og-render non JPEG'
        else if (result.bytes.length > MAX_JPEG_BYTES) error = `image trop lourde (${result.bytes.length} o)`
        else {
          await deps.images.put(file, result.bytes)
          success = true
        }
      }
    } catch (caught) {
      error = (caught as Error).message
    }
    const outcome = ogOutcome(job, success, now, options.policy)
    patches.push({ id: job.id, ...outcome, ogLastError: success ? null : error })
    if (success) {
      ok++
      // La page affichait l'image par défaut (échec précédent) : elle doit être rafraîchie.
      if (previousById.get(job.id)?.ogStatus === 'failed') tags.add(`listing-${job.id}`)
    } else {
      failed++
      deps.log(`image ${job.id} (tentative ${job.attempt}) : ${error}`)
      if (outcome.ogAttempts >= options.policy.ogMaxAttempts) tags.add(`listing-${job.id}`)
    }
  }
  if (patches.length) await deps.store.patchSnapshots(patches)
  return { ok, failed }
}

async function cleanupImages(deps: SyncDeps, options: SyncOptions, now: Date) {
  const snapshots = await deps.store.listSnapshots()
  const graceMs = options.cleanupGraceDays * 86_400_000
  const keep = new Set<string>()
  for (const snap of snapshots) {
    if (!snap.ogHash) continue
    const recentlyWithdrawn = snap.status === 'withdrawn' && snap.withdrawnAt && now.getTime() - Date.parse(snap.withdrawnAt) < graceMs
    if (snap.status !== 'withdrawn' || recentlyWithdrawn) keep.add(ogFileName(snap.id, snap.ogHash))
  }
  const files = await deps.images.list()
  const stale = files
    .filter((file) => OG_FILE_PATTERN.test(file.name) && !keep.has(file.name))
    .filter((file) => !file.createdAt || now.getTime() - Date.parse(file.createdAt) >= graceMs)
    .map((file) => file.name)
  if (stale.length) await deps.images.remove(stale)
  return { scanned: files.length, removed: stale.length }
}

async function maybeAlert(deps: SyncDeps, options: SyncOptions, state: SyncState, now: Date, record: RunRecord) {
  if (!state.failingSince) return
  const minutes = (now.getTime() - Date.parse(state.failingSince)) / 60_000
  if (minutes < options.alertAfterMinutes) return
  if (hoursBetween(state.lastAlertAt, now) < options.alertRepeatHours) return
  const subject = `[Hamac] Synchronisation Apimo en échec depuis ${Math.round(minutes)} min`
  const text = [
    `Depuis : ${state.failingSince}`,
    `Dernier succès : ${state.lastSuccessAt ?? 'jamais'}`,
    `Dernière erreur : ${record.reason ?? 'inconnue'} (HTTP ${record.httpStatus ?? '-'})`,
    '',
    'Le site continue de servir la dernière version valide de chaque fiche ; aucun bien n’est retiré tant que le catalogue est incomplet.',
    'Journal : table public.catalog_sync_runs.',
  ].join('\n')
  try {
    await deps.alert(subject, text)
    await deps.store.updateState({ lastAlertAt: now.toISOString() })
    record.details.alertSent = true
  } catch (error) {
    deps.log(`alerte non envoyée : ${(error as Error).message}`)
  }
}
