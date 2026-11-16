// ─────────────────────────────────────────────
// supabase/functions/submit-form/turnstile.ts
// Vérification serveur du token Cloudflare Turnstile.
// Obligatoire : un token non vérifié côté serveur ne protège rien.
// ─────────────────────────────────────────────

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export type TurnstileCheck = { ok: true } | { ok: false; reason: string }

type SiteverifyResponse = {
  success: boolean
  hostname?: string
  action?: string
  "error-codes"?: string[]
}

export async function verifyTurnstile(opts: {
  token: string
  secret: string
  remoteIp: string | null
  action: string
  allowedHostnames: string[]
}): Promise<TurnstileCheck> {
  const { token, secret, remoteIp, action, allowedHostnames } = opts

  if (!token) return { ok: false, reason: "missing_token" }
  if (token.length > 2048) return { ok: false, reason: "token_too_long" }

  const body = new URLSearchParams()
  body.set("secret", secret)
  body.set("response", token)
  if (remoteIp) body.set("remoteip", remoteIp)

  let payload: SiteverifyResponse
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
    })
    payload = (await res.json()) as SiteverifyResponse
  } catch (err) {
    console.error("[submit-form] siteverify unreachable", err instanceof Error ? err.name : "unknown")
    return { ok: false, reason: "siteverify_unreachable" }
  }

  if (!payload.success) {
    return { ok: false, reason: (payload["error-codes"] ?? ["invalid"]).join(",") }
  }

  // Le token est lié au widget et au domaine qui l'a émis.
  if (payload.action && payload.action !== action) {
    return { ok: false, reason: "action_mismatch" }
  }
  if (payload.hostname && allowedHostnames.length > 0) {
    const host = payload.hostname.toLowerCase()
    const allowed = allowedHostnames.some(
      (entry) => host === entry || (entry.startsWith("*.") && host.endsWith(entry.slice(1))),
    )
    if (!allowed) return { ok: false, reason: "hostname_mismatch" }
  }

  return { ok: true }
}
