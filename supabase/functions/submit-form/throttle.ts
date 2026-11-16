// ─────────────────────────────────────────────
// supabase/functions/submit-form/throttle.ts
// Limitation de débit par IP, sans stocker l'IP en clair :
// on hache l'adresse avec un sel (FORM_IP_SALT) avant de la confier à Postgres.
// Le comptage et l'insertion se font dans la fonction SQL claim_form_slot()
// (atomique, service_role uniquement).
// ─────────────────────────────────────────────

const IP_HEADERS = ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]

/** IP cliente vue par Supabase (Cloud Run) : renseignée par la plateforme, non falsifiable par le client. */
export function clientIp(req: Request): string | null {
  for (const header of IP_HEADERS) {
    const value = req.headers.get(header)
    if (!value) continue
    const first = value.split(",")[0]?.trim()
    if (first) return first
  }
  return null
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Réserve un créneau de soumission. `false` = quota atteint.
 * Échoue en fermé : si la vérification est indisponible, la soumission est refusée.
 */
export async function claimSlot(opts: {
  supabaseUrl: string
  serviceKey: string
  form: string
  ipHash: string
}): Promise<boolean> {
  const { supabaseUrl, serviceKey, form, ipHash } = opts
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_form_slot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ p_form: form, p_ip_hash: ipHash }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      console.error("[submit-form] claim_form_slot http", res.status)
      return false
    }
    return (await res.json()) === true
  } catch (err) {
    console.error("[submit-form] claim_form_slot failed", err instanceof Error ? err.name : "unknown")
    return false
  }
}
