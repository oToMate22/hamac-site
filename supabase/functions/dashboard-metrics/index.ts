import { buildDocument, type MetricsRead } from "./document.ts"
import {
  SIGNATURE_WINDOW_SECONDS,
  SIGNED_PATH,
  rejectionBody,
  signHex,
  timingSafeEqual,
  type SignatureInput,
  type VerifyKey,
} from "./signature.ts"

const BODY_LIMIT = 256_000

type Env = {
  get(name: string): string | undefined
}

type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>

function json(status: number, body: { error: "rejected" | "unavailable" } | Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

function keys(env: Env): VerifyKey[] | null {
  const currentId = env.get("DASHBOARD_KEY_ID") ?? ""
  const currentSecret = env.get("DASHBOARD_SECRET") ?? ""
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(currentId) || currentSecret.length < 32) return null
  const list: VerifyKey[] = [{ id: currentId, secret: currentSecret }]
  const previousId = env.get("DASHBOARD_KEY_ID_PREVIOUS") ?? ""
  const previousSecret = env.get("DASHBOARD_SECRET_PREVIOUS") ?? ""
  if (previousId !== "" || previousSecret !== "") {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(previousId) || previousSecret.length < 32) return null
    list.push({ id: previousId, secret: previousSecret })
  }
  return list
}

function allowedOrg(env: Env): string | null {
  const ids = (env.get("DASHBOARD_ORG_IDS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
  if (ids.length !== 1) return null
  const id = ids[0].toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null
  return id
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function requestInput(raw: string, headers: Headers): SignatureInput | null {
  const timestamp = Number(headers.get("x-oto-timestamp"))
  const nonce = headers.get("x-oto-nonce") ?? ""
  if (!Number.isInteger(timestamp) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) return null
  return { method: "POST", path: SIGNED_PATH, query: {}, body: raw, timestamp, nonce }
}

export async function handleMetrics(
  request: Request,
  env: Env,
  rpc: Rpc,
  nowSeconds: number,
): Promise<Response> {
  if (request.method !== "POST" || request.headers.has("origin")) return json(401, rejectionBody())
  const url = new URL(request.url)
  if (url.search !== "") return json(401, rejectionBody())
  const keyList = keys(env)
  const org = allowedOrg(env)
  if (!keyList || !org) return json(500, { error: "unavailable" })

  const raw = await request.text()
  if (raw.length > BODY_LIMIT) return json(401, rejectionBody())
  const input = requestInput(raw, request.headers)
  const keyId = request.headers.get("x-oto-key-id") ?? ""
  const signature = request.headers.get("x-oto-signature") ?? ""
  const key = keyList.find((item) => item.id === keyId)
  if (!input || !key || !/^[a-f0-9]{64}$/.test(signature)) return json(401, rejectionBody())
  if (Math.abs(nowSeconds - input.timestamp) > SIGNATURE_WINDOW_SECONDS) return json(401, rejectionBody())
  const expected = await signHex(input, key.secret)
  if (!timingSafeEqual(signature, expected)) return json(401, rejectionBody())

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json(401, rejectionBody())
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(401, rejectionBody())
  const body = parsed as Record<string, unknown>
  const fields = Object.keys(body).sort()
  if (fields.join(",") !== "from,orgId,to,version") return json(401, rejectionBody())
  if (body.version !== 1 || typeof body.orgId !== "string" || body.orgId.toLowerCase() !== org) {
    return json(401, rejectionBody())
  }
  if (!calendarDate(body.from) || !calendarDate(body.to) || body.from > body.to) {
    return json(401, rejectionBody())
  }
  const days = Math.round((Date.parse(`${body.to}T00:00:00Z`) - Date.parse(`${body.from}T00:00:00Z`)) / 86_400_000) + 1
  if (days > 366) return json(401, rejectionBody())

  let fresh = false
  try {
    fresh = (await rpc("dashboard_nonce_consume", { p_key_id: key.id, p_nonce: input.nonce })) === true
  } catch {
    return json(500, { error: "unavailable" })
  }
  if (!fresh) return json(401, rejectionBody())

  try {
    const metrics = (await rpc("dashboard_metrics_read", {
      p_from: body.from,
      p_to: body.to,
    })) as MetricsRead
    return json(200, buildDocument({ from: body.from, to: body.to }, metrics))
  } catch {
    return json(500, { error: "unavailable" })
  }
}

function databaseRpc(env: Env): Rpc {
  return async (name, args) => {
    const base = env.get("SUPABASE_URL")
    const serviceKey = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!base || !serviceKey) throw new Error("database")
    const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
    })
    if (!response.ok) throw new Error("rpc")
    return response.json()
  }
}

if (typeof globalThis.Deno !== "undefined") {
  const runtime = globalThis.Deno
  runtime.serve((request) =>
    handleMetrics(request, runtime.env, databaseRpc(runtime.env), Math.floor(Date.now() / 1000))
  )
}
