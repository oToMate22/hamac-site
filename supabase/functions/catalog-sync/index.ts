// Synchronisation autonome Apimo → instantanés → images de partage → invalidation du CDN Vercel.
// Déclenchée par pg_cron (private.catalog_sync_invoke) avec la clé de service, qui ne quitte pas Supabase.
// Logique : ../_shared/catalog/sync.ts (testée sous Node).
import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import type { Snapshot } from "../_shared/catalog/decide.ts"
import { signRequest } from "../_shared/catalog/hmac.ts"
import { parseProxyResponse } from "../_shared/catalog/proxy.ts"
import { runSync, type SnapshotPatch, type SnapshotWrite, type SyncDeps, type SyncState } from "../_shared/catalog/sync.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
/** Origine du site Vercel qui génère les images et purge son CDN (Preview ou production). */
const SITE_ORIGIN = (Deno.env.get("SITE_ORIGIN") ?? "").replace(/\/$/, "")
const SYNC_HMAC_SECRET = Deno.env.get("SYNC_HMAC_SECRET") ?? ""
/** Optionnel : contourne la protection des déploiements Preview Vercel. */
const VERCEL_BYPASS = Deno.env.get("VERCEL_PROTECTION_BYPASS") ?? ""
/** Optionnel : lire un autre apimo-proxy (tests locaux avec un faux Apimo). */
const APIMO_PROXY_URL = Deno.env.get("APIMO_PROXY_URL") ?? `${SUPABASE_URL}/functions/v1/apimo-proxy`
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
const ALERT_EMAIL_TO = Deno.env.get("ALERT_EMAIL_TO") ?? ""
const ALERT_EMAIL_FROM =
  Deno.env.get("ALERT_EMAIL_FROM") ?? "Hamac — site <notifications@send.hamacpatrimoine.com>"
const OG_JOBS_PER_RUN = Number(Deno.env.get("SYNC_OG_JOBS_PER_RUN") ?? "") || undefined
const BUCKET = "og-listings"

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

/** Seule la clé de service (pg_cron) peut déclencher un run : la clé anon publique est refusée. */
function isServiceCaller(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!token) return false
  if (SERVICE_KEY && token === SERVICE_KEY) return true
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
    return payload?.role === "service_role"
  } catch {
    return false
  }
}

type SnapshotRow = {
  id: string
  kind: "acheter" | "louer"
  status: Snapshot["status"]
  payload_hash: string
  updated_at_apimo: string | null
  og_hash: string | null
  og_status: Snapshot["ogStatus"]
  og_attempts: number
  og_next_attempt_at: string | null
  missing_runs: number
  withdrawn_at: string | null
}

const toSnapshot = (row: SnapshotRow): Snapshot => ({
  id: row.id,
  kind: row.kind,
  status: row.status,
  payloadHash: row.payload_hash,
  updatedAtApimo: row.updated_at_apimo,
  ogHash: row.og_hash,
  ogStatus: row.og_status,
  ogAttempts: row.og_attempts,
  ogNextAttemptAt: row.og_next_attempt_at,
  missingRuns: row.missing_runs,
  withdrawnAt: row.withdrawn_at,
})

function patchToRow(patch: SnapshotPatch) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.missingRuns !== undefined) row.missing_runs = patch.missingRuns
  if (patch.withdrawnAt !== undefined) row.withdrawn_at = patch.withdrawnAt
  if (patch.ogStatus !== undefined) row.og_status = patch.ogStatus
  if (patch.ogAttempts !== undefined) row.og_attempts = patch.ogAttempts
  if (patch.ogNextAttemptAt !== undefined) row.og_next_attempt_at = patch.ogNextAttemptAt
  if (patch.ogLastError !== undefined) row.og_last_error = patch.ogLastError?.slice(0, 500) ?? null
  return row
}

const stateKeys: Record<keyof SyncState, string> = {
  enabled: "enabled",
  mode: "mode",
  backoffUntil: "backoff_until",
  consecutiveFailures: "consecutive_failures",
  failingSince: "failing_since",
  lastSuccessAt: "last_success_at",
  lastAlertAt: "last_alert_at",
  lastCleanupAt: "last_cleanup_at",
}

async function must<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, what: string) {
  const { data, error } = await promise
  if (error) throw new Error(`${what} : ${error.message}`)
  return data
}

async function signedPost(path: string, body: unknown, timeoutMs: number) {
  const raw = JSON.stringify(body)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await signRequest(SYNC_HMAC_SECRET, "POST", path, raw)),
  }
  if (VERCEL_BYPASS) headers["x-vercel-protection-bypass"] = VERCEL_BYPASS
  return fetch(`${SITE_ORIGIN}${path}`, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(timeoutMs) })
}

const deps: SyncDeps = {
  now: () => new Date(),
  log: (message) => console.log(`[catalog-sync] ${message}`),
  async readCatalog() {
    try {
      // Pas de « refresh » : on partage le cache apimo_cache (5 min) avec les visiteurs du site.
      const res = await fetch(APIMO_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: JSON.stringify({ route: "properties" }),
        signal: AbortSignal.timeout(90_000),
      })
      const body = await res.json().catch(() => null)
      return parseProxyResponse(res.status, res.headers, body)
    } catch (error) {
      return { ok: false, status: 0, error: `apimo-proxy injoignable : ${(error as Error).message}` }
    }
  },
  store: {
    async getState() {
      const row = await must(db.from("catalog_sync_state").select("*").eq("id", true).single(), "lecture état")
      return {
        enabled: row.enabled,
        mode: row.mode,
        backoffUntil: row.backoff_until,
        consecutiveFailures: row.consecutive_failures,
        failingSince: row.failing_since,
        lastSuccessAt: row.last_success_at,
        lastAlertAt: row.last_alert_at,
        lastCleanupAt: row.last_cleanup_at,
      }
    },
    async updateState(patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const [key, value] of Object.entries(patch)) row[stateKeys[key as keyof SyncState]] = value
      await must(db.from("catalog_sync_state").update(row).eq("id", true), "écriture état")
    },
    async tryLock() {
      return (await must(db.rpc("catalog_sync_try_lock"), "verrou")) === true
    },
    async releaseLock() {
      await must(db.rpc("catalog_sync_release_lock"), "libération verrou")
    },
    async listSnapshots() {
      const rows: SnapshotRow[] = []
      for (let from = 0; ; from += 1000) {
        const page = await must(
          db
            .from("listing_snapshots")
            .select("id,kind,status,payload_hash,updated_at_apimo,og_hash,og_status,og_attempts,og_next_attempt_at,missing_runs,withdrawn_at")
            .order("id")
            .range(from, from + 999),
          "lecture instantanés",
        )
        rows.push(...(page as SnapshotRow[]))
        if ((page as SnapshotRow[]).length < 1000) break
      }
      return rows.map(toSnapshot)
    },
    async writeSnapshots(rows: SnapshotWrite[]) {
      const now = new Date().toISOString()
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100).map((row) => ({
          id: row.id,
          kind: row.kind,
          status: row.status,
          payload: row.payload,
          payload_hash: row.payloadHash,
          updated_at_apimo: row.updatedAtApimo,
          og_hash: row.ogHash,
          og_status: row.ogStatus,
          og_attempts: row.ogAttempts,
          og_next_attempt_at: row.ogNextAttemptAt,
          missing_runs: row.missingRuns,
          withdrawn_at: row.withdrawnAt,
          last_seen_at: row.lastSeenAt,
          updated_at: now,
        }))
        await must(db.from("listing_snapshots").upsert(batch, { onConflict: "id" }), "écriture instantanés")
      }
    },
    async patchSnapshots(rows) {
      for (const patch of rows) {
        await must(db.from("listing_snapshots").update(patchToRow(patch)).eq("id", patch.id), `mise à jour ${patch.id}`)
      }
    },
    async insertRun(run) {
      const { error } = await db.from("catalog_sync_runs").insert({
        started_at: run.startedAt,
        finished_at: run.finishedAt,
        outcome: run.outcome,
        mode: run.mode,
        trustworthy: run.trustworthy,
        reason: run.reason,
        http_status: run.httpStatus,
        source: run.source,
        seen: run.seen,
        created: run.created,
        updated: run.updated,
        reactivated: run.reactivated,
        pending_withdrawal: run.pendingWithdrawal,
        withdrawn: run.withdrawn,
        og_generated: run.ogGenerated,
        og_failed: run.ogFailed,
        revalidated_tags: run.revalidatedTags,
        duration_ms: run.durationMs,
        details: run.details,
      })
      if (error) console.error("[catalog-sync] journal :", error.message)
    },
  },
  images: {
    async exists(file) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${file}`, { method: "HEAD" })
      return res.ok
    },
    async put(file, bytes) {
      await must(
        db.storage.from(BUCKET).upload(file, bytes, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true }),
        `stockage ${file}`,
      )
    },
    async list() {
      const files: Array<{ name: string; createdAt: string | null }> = []
      for (let offset = 0; ; offset += 1000) {
        const page = await must(db.storage.from(BUCKET).list("", { limit: 1000, offset }), "liste images")
        files.push(...page.map((f) => ({ name: f.name, createdAt: f.created_at ?? null })))
        if (page.length < 1000) break
      }
      return files
    },
    async remove(files) {
      for (let i = 0; i < files.length; i += 100) {
        await must(db.storage.from(BUCKET).remove(files.slice(i, i + 100)), "suppression images")
      }
    },
  },
  site:
    SITE_ORIGIN && SYNC_HMAC_SECRET.length >= 32
      ? {
          async renderOg(job) {
            try {
              const res = await signedPost("/api/og-render", { id: job.id, ogHash: job.ogHash, urls: job.urls }, 45_000)
              if (!res.ok) return { ok: false, error: `og-render HTTP ${res.status} ${(await res.text()).slice(0, 200)}` }
              return {
                ok: true,
                bytes: new Uint8Array(await res.arrayBuffer()),
                sourceIndex: Number(res.headers.get("x-og-source-index") ?? 0),
              }
            } catch (error) {
              return { ok: false, error: `og-render injoignable : ${(error as Error).message}` }
            }
          },
          async revalidate(tags) {
            try {
              const res = await signedPost("/api/revalidate", { tags }, 15_000)
              return res.ok
            } catch {
              return false
            }
          },
        }
      : null,
  async alert(subject, text) {
    if (!RESEND_API_KEY || !ALERT_EMAIL_TO) throw new Error("RESEND_API_KEY / ALERT_EMAIL_TO absents")
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: ALERT_EMAIL_FROM, to: ALERT_EMAIL_TO.split(",").map((s) => s.trim()), subject, text }),
    })
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}`)
  },
  options: OG_JOBS_PER_RUN ? { ogJobsPerRun: OG_JOBS_PER_RUN } : undefined,
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  if (!isServiceCaller(req)) return json({ error: "Unauthorized" }, 401)
  const params = new URL(req.url).searchParams
  // Test du canal d'alerte : un e-mail à ALERT_EMAIL_TO uniquement (jamais aux agents),
  // sans lecture d'Apimo ni écriture en base.
  if (params.get("test-alert") === "1") {
    try {
      await deps.alert(
        "[Hamac] Test du canal d'alerte du catalogue",
        [
          "Message de test envoyé par catalog-sync (aucune panne en cours).",
          `Destinataire configuré : ALERT_EMAIL_TO (${ALERT_EMAIL_TO.split(",").length} adresse(s)).`,
          "Les vraies alertes partent après 60 min sans synchronisation fiable, au plus une fois toutes les 6 h.",
        ].join("\n"),
      )
      return json({ alert: "sent", recipients: ALERT_EMAIL_TO.split(",").length })
    } catch (error) {
      return json({ alert: "failed", error: (error as Error).message }, 502)
    }
  }
  const wait = params.get("wait") === "1"
  const task = runSync(deps).catch((error) => {
    console.error("[catalog-sync] run :", error)
    return null
  })
  if (wait) return json(await task)
  // Réponse immédiate à pg_net ; le run continue en tâche de fond.
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
  if (runtime) runtime.waitUntil(task)
  else await task
  return json({ accepted: true }, 202)
})
