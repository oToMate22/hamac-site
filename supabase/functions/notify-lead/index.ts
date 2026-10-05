import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

function jwtRole(req: Request): string | null {
  const header = req.headers.get("authorization")
  if (!header?.toLowerCase().startsWith("bearer ")) return null
  const token = header.slice(7).trim()
  const payloadPart = token.split(".")[1]
  if (!payloadPart) return null
  try {
    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(padded)) as { role?: string }
    return payload.role ?? null
  } catch {
    return null
  }
}

function text(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (jwtRole(req) !== "service_role") return json({ error: "forbidden" }, 403)

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim()
  const to = Deno.env.get("LEAD_NOTIFY_TO")?.trim() || "agence@hamacpatrimoine.com"
  const from = Deno.env.get("LEAD_NOTIFY_FROM")?.trim() || "Hamac <agence@hamacpatrimoine.com>"
  if (!apiKey) {
    console.error("[notify-lead] missing RESEND_API_KEY")
    return json({ error: "unavailable" }, 500)
  }

  let record: Record<string, unknown> = {}
  try {
    const payload = (await req.json()) as { record?: Record<string, unknown> }
    record = payload.record && typeof payload.record === "object" ? payload.record : payload
  } catch {
    console.error("[notify-lead] invalid json")
    return json({ error: "invalid_body" }, 400)
  }

  const nom = text(record.nom) || "—"
  const email = text(record.email) || "—"
  const telephone = text(record.telephone) || "—"
  const message = text(record.message) || "—"
  const bienRef = text(record.bien_ref) || "—"
  const typeContact = text(record.type_contact) || "—"
  const origin =
    text(record.origin_url) || text(record.page_url) || "non transmise (insert SQL)"

  const subject = `Nouvelle demande Hamac — ${typeContact}`
  const body = [
    `Type : ${typeContact}`,
    `Nom : ${nom}`,
    `Email : ${email}`,
    `Téléphone : ${telephone}`,
    `Référence bien : ${bienRef}`,
    `Page d’origine : ${origin}`,
    "",
    "Message :",
    message,
  ].join("\n")

  try {
    const resend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    })
    if (!resend.ok) {
      console.error("[notify-lead] resend status", resend.status)
      return json({ error: "send_failed" }, 502)
    }
  } catch (err) {
    console.error("[notify-lead] send error", err instanceof Error ? err.name : "unknown")
    return json({ error: "send_failed" }, 502)
  }

  return json({ ok: true })
})
