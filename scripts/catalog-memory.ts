// Doubles en mémoire de Supabase (tables, verrou, stockage) pour tester la synchronisation et le flux
// sans base réelle. Même contrat que supabase/functions/catalog-sync/index.ts et listing-feed/index.ts.
import type { Snapshot } from '../supabase/functions/_shared/catalog/decide.ts'
import type { FeedDeps, FeedServerDeps, StoredSnapshot } from '../supabase/functions/_shared/catalog/feed.ts'
import { isServable, type RawListing } from '../supabase/functions/_shared/catalog/model.ts'
import type { RunRecord, SnapshotPatch, SnapshotWrite, SyncDeps, SyncState } from '../supabase/functions/_shared/catalog/sync.ts'

type Row = Snapshot & { payload: RawListing; ogLastError?: string | null; lastSeenAt?: string }

export class MemoryDb {
  state: SyncState & { locked: boolean } = {
    enabled: true,
    mode: 'active',
    backoffUntil: null,
    consecutiveFailures: 0,
    failingSince: null,
    lastSuccessAt: null,
    lastAlertAt: null,
    lastCleanupAt: null,
    locked: false,
  }
  rows = new Map<string, Row>()
  runs: RunRecord[] = []

  store(): SyncDeps['store'] {
    return {
      getState: async () => ({ ...this.state }),
      updateState: async (patch) => {
        Object.assign(this.state, patch)
      },
      tryLock: async () => {
        if (this.state.locked) return false
        this.state.locked = true
        return true
      },
      releaseLock: async () => {
        this.state.locked = false
      },
      listSnapshots: async () => [...this.rows.values()].map(({ payload: _p, ogLastError: _e, lastSeenAt: _l, ...snap }) => ({ ...snap })),
      writeSnapshots: async (rows: SnapshotWrite[]) => {
        for (const { change: _c, ...row } of rows) this.rows.set(row.id, { ...row })
      },
      patchSnapshots: async (rows: SnapshotPatch[]) => {
        for (const patch of rows) {
          const row = this.rows.get(patch.id)
          if (row) this.rows.set(patch.id, { ...row, ...patch })
        }
      },
      insertRun: async (run) => {
        this.runs.push(run)
      },
    }
  }

  feedDeps(readLiveCatalog: FeedDeps['readLiveCatalog']): FeedDeps {
    return {
      getSnapshot: async (id) => {
        const row = this.rows.get(id)
        return row ? toStored(row) : null
      },
      maxKnownId: async () => (this.rows.size ? Math.max(...[...this.rows.keys()].map(Number)) : null),
      readLiveCatalog,
    }
  }

  feedServerDeps(token: string, readLiveCatalog: FeedDeps['readLiveCatalog']): FeedServerDeps {
    return {
      ...this.feedDeps(readLiveCatalog),
      token,
      countSnapshots: async () => this.rows.size,
      listCatalog: async (kind) =>
        [...this.rows.values()]
          .filter((row) => row.kind === kind && isServable(row.status))
          .sort((a, b) => Number(b.id) - Number(a.id))
          .map((row) => ({ payload: row.payload, ogHash: row.ogHash, ogStatus: row.ogStatus })),
      listIndex: async () =>
        [...this.rows.values()].map((row) => ({
          id: row.id,
          kind: row.kind,
          status: row.status,
          updatedAt: row.updatedAtApimo,
          ogHash: row.ogHash,
          ogStatus: row.ogStatus,
          withdrawnAt: row.withdrawnAt,
        })),
      syncMeta: async () => ({ mode: this.state.mode, lastSuccessAt: this.state.lastSuccessAt, failingSince: this.state.failingSince }),
    }
  }
}

export function toStored(row: Row): StoredSnapshot {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    payload: row.payload,
    ogHash: row.ogHash,
    ogStatus: row.ogStatus,
    updatedAtApimo: row.updatedAtApimo,
    withdrawnAt: row.withdrawnAt,
  }
}

export class MemoryImages {
  files = new Map<string, { bytes: Uint8Array; createdAt: string }>()
  clock: () => Date

  constructor(clock: () => Date = () => new Date()) {
    this.clock = clock
  }

  api(): SyncDeps['images'] {
    return {
      exists: async (file) => this.files.has(file),
      put: async (file, bytes) => {
        this.files.set(file, { bytes, createdAt: this.clock().toISOString() })
      },
      list: async () => [...this.files].map(([name, value]) => ({ name, createdAt: value.createdAt })),
      remove: async (names) => {
        for (const name of names) this.files.delete(name)
      },
    }
  }
}
