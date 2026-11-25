// Flux en lecture seule pour les fonctions Vercel (fiches, catalogues, sitemap, images).
// Authentification : en-tête x-feed-token = secret LISTING_FEED_TOKEN (dédié, révocable).
// La clé de service reste ici, côté Supabase : Vercel n'en dispose jamais.
// Routage et règles : ../_shared/catalog/feed.ts (handleFeedRequest, testé sous Node).
import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { handleFeedRequest, type StoredSnapshot } from "../_shared/catalog/feed.ts"
import type { IndexEntry, RawListing } from "../_shared/catalog/model.ts"
import { parseProxyResponse } from "../_shared/catalog/proxy.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const FEED_TOKEN = Deno.env.get("LISTING_FEED_TOKEN") ?? ""
const APIMO_PROXY_URL = Deno.env.get("APIMO_PROXY_URL") ?? `${SUPABASE_URL}/functions/v1/apimo-proxy`

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

type Row = {
  id: string
  kind: "acheter" | "louer"
  status: StoredSnapshot["status"]
  payload: RawListing
  og_hash: string | null
  og_status: StoredSnapshot["ogStatus"]
  updated_at_apimo: string | null
  withdrawn_at: string | null
}

async function must<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

Deno.serve((req) =>
  handleFeedRequest(req, {
    token: FEED_TOKEN,
    log: (message, error) => console.error(message, error),
    async getSnapshot(id) {
      const row = (await must(
        db.from("listing_snapshots").select("id,kind,status,payload,og_hash,og_status,updated_at_apimo,withdrawn_at").eq("id", id).maybeSingle(),
      )) as Row | null
      return row
        ? {
            id: row.id,
            kind: row.kind,
            status: row.status,
            payload: row.payload,
            ogHash: row.og_hash,
            ogStatus: row.og_status,
            updatedAtApimo: row.updated_at_apimo,
            withdrawnAt: row.withdrawn_at,
          }
        : null
    },
    async maxKnownId() {
      const value = await must(db.rpc("listing_snapshots_max_id"))
      return value === null || value === undefined ? null : Number(value)
    },
    async countSnapshots() {
      const { count, error } = await db.from("listing_snapshots").select("id", { count: "exact", head: true })
      if (error) throw new Error(error.message)
      return count ?? 0
    },
    async listCatalog(kind) {
      const rows = (await must(
        db
          .from("listing_snapshots")
          .select("payload,og_hash,og_status")
          .eq("kind", kind)
          .in("status", ["active", "pending_withdrawal"])
          .order("id", { ascending: false })
          .limit(2000),
      )) as Array<{ payload: RawListing; og_hash: string | null; og_status: StoredSnapshot["ogStatus"] }>
      return rows.map((row) => ({ payload: row.payload, ogHash: row.og_hash, ogStatus: row.og_status }))
    },
    async listIndex() {
      const rows = (await must(
        db.from("listing_snapshots").select("id,kind,status,updated_at_apimo,og_hash,og_status,withdrawn_at").order("id").limit(5000),
      )) as Array<Omit<Row, "payload">>
      return rows.map(
        (row): IndexEntry => ({
          id: row.id,
          kind: row.kind,
          status: row.status,
          updatedAt: row.updated_at_apimo,
          ogHash: row.og_hash,
          ogStatus: row.og_status,
          withdrawnAt: row.withdrawn_at,
        }),
      )
    },
    async syncMeta() {
      const { data } = await db.from("catalog_sync_state").select("mode,last_success_at,failing_since").eq("id", true).maybeSingle()
      return { mode: data?.mode ?? null, lastSuccessAt: data?.last_success_at ?? null, failingSince: data?.failing_since ?? null }
    },
    async readLiveCatalog() {
      try {
        const res = await fetch(APIMO_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
          body: JSON.stringify({ route: "properties" }),
          signal: AbortSignal.timeout(20_000),
        })
        return parseProxyResponse(res.status, res.headers, await res.json().catch(() => null))
      } catch (error) {
        return { ok: false as const, status: 0, error: (error as Error).message }
      }
    },
  })
)
