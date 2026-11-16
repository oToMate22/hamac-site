// ─────────────────────────────────────────────
// supabase/functions/submit-form/index.ts
// Point d'entrée UNIQUE des 4 formulaires du site (contact, demande sur un bien,
// estimation, off-market). Remplace l'insertion anonyme directe :
//
//   navigateur ──► submit-form (verify_jwt = false)
//                    1. validation serveur         (validate.ts)
//                    2. token Turnstile vérifié    (turnstile.ts)
//                    3. quota par IP               (throttle.ts)
//                    4. INSERT en service_role ──► trigger notify_*_on_insert ──► notify-lead
//
// Secrets requis (Supabase → Edge Functions → Secrets) :
//   TURNSTILE_SECRET_KEY   clé secrète du widget Cloudflare
//   FORM_IP_SALT           sel de hachage des IP (chaîne aléatoire stable)
// Optionnels :
//   SITE_ORIGINS           origines autorisées en CORS (défaut : domaine Hamac)
//   TURNSTILE_HOSTNAMES    domaines acceptés par siteverify (défaut : idem + localhost)
// ─────────────────────────────────────────────

import { FORM_KINDS, validateSubmission, type FormKind } from "./validate.ts"
import { verifyTurnstile } from "./turnstile.ts"
import { claimSlot, clientIp, hashIp } from "./throttle.ts"

const DEFAULT_ORIGINS = "https://hamacpatrimoine.com,https://www.hamacpatrimoine.com"
const DEFAULT_HOSTNAMES = "hamacpatrimoine.com,www.hamacpatrimoine.com,localhost"

const splitEnv = (raw: string | undefined, fallback: string): string[] =>
  (raw?.trim() || fallback)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

const SITE_ORIGINS = splitEnv(Deno.env.get("SITE_ORIGINS"), DEFAULT_ORIGINS)
const TURNSTILE_HOSTNAMES = splitEnv(Deno.env.get("TURNSTILE_HOSTNAMES"), DEFAULT_HOSTNAMES)

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })

/** CORS : on renvoie l'origine du visiteur seulement si elle est légitime. */
function corsHeaders(req: Request): Record<string, string> {
  const origin = (req.headers.get("origin") ?? "").toLowerCase()
  const allowed =
    origin &&
    (SITE_ORIGINS.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:"))
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
  if (allowed) headers["Access-Control-Allow-Origin"] = origin
  return headers
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()
  const serviceKey = (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY")
  )?.trim()
  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY")?.trim()
  const ipSalt = Deno.env.get("FORM_IP_SALT")?.trim()

  if (!supabaseUrl || !serviceKey || !turnstileSecret || !ipSalt) {
    console.error("[submit-form] configuration incomplète (secret manquant)")
    return json({ error: "unavailable" }, 500, cors)
  }

  let payload: { form?: unknown; turnstileToken?: unknown; data?: unknown }
  try {
    payload = (await req.json()) as typeof payload
  } catch {
    return json({ error: "invalid_body" }, 400, cors)
  }

  const form = typeof payload.form === "string" ? (payload.form as FormKind) : null
  if (!form || !FORM_KINDS.includes(form)) return json({ error: "invalid_form" }, 400, cors)

  // 1. validation serveur — même règles que les contraintes CHECK en base
  const validated = validateSubmission(form, payload.data)
  if (!validated.ok) {
    return json({ error: "invalid_payload", fields: validated.fields }, 400, cors)
  }

  // 2. anti-robot : le token est à usage unique et expire en 300 s
  const ip = clientIp(req)
  const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken.trim() : ""
  const check = await verifyTurnstile({
    token: turnstileToken,
    secret: turnstileSecret,
    remoteIp: ip,
    action: form,
    allowedHostnames: TURNSTILE_HOSTNAMES,
  })
  if (!check.ok) {
    console.warn(`[submit-form] turnstile refusé: ${check.reason} form=${form}`)
    return json({ error: "turnstile_failed", reason: check.reason }, 403, cors)
  }

  // 3. quota : 5 / 10 min par IP et 60 / h global (claim_form_slot, service_role only)
  if (ip) {
    const ipHash = await hashIp(ip, ipSalt)
    const slot = await claimSlot({ supabaseUrl, serviceKey, form, ipHash })
    if (!slot) {
      console.warn(`[submit-form] quota atteint form=${form}`)
      return json({ error: "rate_limited", retry_after: 600 }, 429, cors)
    }
  } else {
    // Pas d'IP fiable : on n'applique AUCUN quota plutôt que de faire
    // partager un seau commun à tous les visiteurs ("unknown"), ce qui
    // bloquerait de vrais prospects après 5 envois. Turnstile reste exigé
    // juste au-dessus, et le plafond global de 60/h reste porté par les
    // autres requêtes qui, elles, ont une IP.
    console.warn(`[submit-form] IP absente, quota par IP ignoré form=${form}`)
  }

  // 4. insertion en service_role : RLS contournée, déclenche notify-lead
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${validated.table}?select=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(validated.row),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      console.error(`[submit-form] insert ${validated.table} ${res.status}: ${detail}`)
      return json({ error: "insert_failed" }, 502, cors)
    }
    const rows = (await res.json()) as Array<{ id?: string }>
    console.log(`[submit-form] ok form=${form} table=${validated.table} id=${rows[0]?.id ?? "?"}`)
    return json({ ok: true, id: rows[0]?.id ?? null }, 200, cors)
  } catch (err) {
    console.error("[submit-form] insert unreachable", err instanceof Error ? err.name : "unknown")
    return json({ error: "insert_failed" }, 502, cors)
  }
})
